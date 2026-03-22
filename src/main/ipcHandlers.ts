// src/main/ipcHandlers.ts
import { ipcMain, dialog, BrowserWindow } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import Store from 'electron-store';
import log from 'electron-log';
import type {
  VpnProfile,
  VpnSession,
  CliResult,
  OpenVPN3Available,
  AppSettings,
  ProfileMeta,
} from '../shared/types';

const execAsync = promisify(exec);

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: true,
  windowWidth: 1100,
  windowHeight: 720,
  autoRefreshSessions: true,
  refreshIntervalMs: 5000,
  sidebarCollapsed: false,
  profileSortBy: 'name',
};

interface StoreSchema {
  settings: AppSettings;
  profileMeta: Record<string, ProfileMeta>;
}

const store = new Store<StoreSchema>({
  defaults: {
    settings: DEFAULT_SETTINGS,
    profileMeta: {},
  },
});

// ---------------------------------------------------------------------------
// Core CLI runner
// ---------------------------------------------------------------------------

async function runCommand(cmd: string): Promise<CliResult> {
  log.info(`[CLI] Running: ${cmd}`);
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 30000,
      env: {
        ...process.env,
        PATH: '/usr/bin:/usr/local/bin:/bin:/snap/bin:' + (process.env.PATH || ''),
      },
    });
    log.info(`[CLI] Success stdout: ${stdout.substring(0, 200)}`);
    if (stderr) log.warn(`[CLI] stderr: ${stderr.substring(0, 200)}`);
    return { success: true, stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const error = err as {
      stdout?: string;
      stderr?: string;
      code?: number;
      message?: string;
    };
    log.error(`[CLI] Error: ${error.message}`);
    return {
      success: false,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || 'Unknown error',
      exitCode: error.code || 1,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the value portion of a "Label:  value" line.
 * Example: "  Config name:   my-vpn"  →  "my-vpn"
 */
function extractField(line: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = line.match(new RegExp(`^\\s*${escaped}\\s*:\\s*(.+)`, 'i'));
  return match ? match[1].trim() : '';
}

/**
 * Split raw text output into per-entry blocks separated by blank lines.
 * Completely blank blocks are discarded.
 */
function splitBlocks(raw: string): string[][] {
  const lines = raw.split('\n');
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.trim() === '') {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

/**
 * Parse `openvpn3 configs-list` text output.
 *
 * Block format (one block per profile):
 *   Configuration path:   /net/openvpn/v3/configuration/xxxxxxxx
 *   Name:                 my-vpn
 *   Owned by:             alice    Read only: No
 *   Persistent config:    Yes
 */
function parseProfilesText(raw: string): VpnProfile[] {
  const profiles: VpnProfile[] = [];

  for (const block of splitBlocks(raw)) {
    let path = '';
    let name = '';
    let owner = '';
    let locked = false;
    let importTimestamp = '';

    for (const line of block) {
      if (/^\s*configuration path\s*:/i.test(line)) {
        path = extractField(line, 'Configuration path');
      } else if (/^\s*name\s*:/i.test(line)) {
        name = extractField(line, 'Name');
      } else if (/^\s*owned by\s*:/i.test(line)) {
        // "Owned by:  alice   Read only: No"
        const ownerMatch = line.match(/owned by\s*:\s*(\S+)/i);
        owner = ownerMatch ? ownerMatch[1] : '';
        locked = /read only\s*:\s*yes/i.test(line);
      } else if (/^\s*import(ed)?\s*(at|timestamp)?\s*:/i.test(line)) {
        importTimestamp =
          extractField(line, 'Imported at') ||
          extractField(line, 'Import timestamp') ||
          extractField(line, 'Import');
      }
    }

    // Keep blocks that have at least a name or a path
    if (name || path) {
      profiles.push({
        name: name || path,
        path: path || name,
        owner,
        locked,
        importTimestamp,
      });
    }
  }

  return profiles;
}

/**
 * Parse `openvpn3 sessions-list` text output.
 *
 * Block format (one block per session):
 *   Session path:      /net/openvpn/v3/sessions/xxxxxxxx
 *   Config name:       my-vpn
 *   Config path:       /net/openvpn/v3/configuration/xxxxxxxx
 *   Status:            Connection, Client connected
 *   Session created:   2024-01-15 09:00:00
 *   Connected since:   2024-01-15 09:00:05
 *   Bytes received:    12345
 *   Bytes sent:        6789
 *   Remote address:    1.2.3.4
 *   Local address:     10.8.0.2
 *   Duration:          0:10:23
 */
function parseSessionsText(raw: string): VpnSession[] {
  const sessions: VpnSession[] = [];

  for (const block of splitBlocks(raw)) {
    let sessionPath = '';
    let configName = '';
    let configPath = '';
    let status = 'UNKNOWN';
    let statusMinor = '';
    let createdAt = '';
    let connectedAt = '';
    let bytesReceived = 0;
    let bytesSent = 0;
    let remoteAddress = '';
    let localAddress = '';
    let durationSeconds = 0;

    for (const line of block) {
      if (/^\s*session path\s*:/i.test(line)) {
        sessionPath = extractField(line, 'Session path');
      } else if (/^\s*config(uration)? name\s*:/i.test(line)) {
        configName =
          extractField(line, 'Config name') ||
          extractField(line, 'Configuration name');
      } else if (/^\s*config(uration)? path\s*:/i.test(line)) {
        configPath =
          extractField(line, 'Config path') ||
          extractField(line, 'Configuration path');
      } else if (/^\s*status\s*:/i.test(line)) {
        // "Status: Connection, Client connected"  →  major / minor split on comma
        const rawStatus = extractField(line, 'Status');
        const parts = rawStatus.split(',').map((s) => s.trim());
        status = parts[0] || 'UNKNOWN';
        statusMinor = parts.slice(1).join(', ');
      } else if (/^\s*session created\s*:/i.test(line)) {
        createdAt = extractField(line, 'Session created');
      } else if (/^\s*connected since\s*:/i.test(line)) {
        connectedAt = extractField(line, 'Connected since');
      } else if (/^\s*bytes? received\s*:/i.test(line)) {
        const val =
          extractField(line, 'Bytes received') ||
          extractField(line, 'Byte received');
        bytesReceived = parseByteValue(val);
      } else if (/^\s*bytes? sent\s*:/i.test(line)) {
        const val =
          extractField(line, 'Bytes sent') ||
          extractField(line, 'Byte sent');
        bytesSent = parseByteValue(val);
      } else if (/^\s*remote address\s*:/i.test(line)) {
        remoteAddress = extractField(line, 'Remote address');
      } else if (/^\s*local address\s*:/i.test(line)) {
        localAddress = extractField(line, 'Local address');
      } else if (/^\s*(connected )?duration\s*:/i.test(line)) {
        const val =
          extractField(line, 'Connected duration') ||
          extractField(line, 'Duration');
        durationSeconds = parseDuration(val);
      }
    }

    if (sessionPath) {
      sessions.push({
        sessionPath,
        configName,
        configPath,
        status,
        statusMinor,
        createdAt,
        connectedAt,
        bytesReceived,
        bytesSent,
        remoteAddress,
        localAddress,
        durationSeconds,
      });
    }
  }

  return sessions;
}

/**
 * Parse `openvpn3 session-stats` text output into a simple key/value map.
 *
 * Example output:
 *   Session path: /net/openvpn/v3/sessions/xxxxxxxx
 *       Sent:         5.1 KiB
 *   Received:        12.3 KiB
 *   Duration:        0:10:23
 *   Started at:      2024-01-15 09:00:05
 */
function parseSessionStats(raw: string): Record<string, string> {
  const stats: Record<string, string> = {};

  for (const line of raw.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key && value) {
      stats[key] = value;
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Unit converters
// ---------------------------------------------------------------------------

/**
 * Convert byte strings like "12345", "12.3 KiB", "1.5 MiB" to a raw number.
 */
function parseByteValue(val: string): number {
  if (!val) return 0;
  const match = val.match(/([\d.]+)\s*(KiB|MiB|GiB|KB|MB|GB|B)?/i);
  if (!match) return parseInt(val, 10) || 0;
  const num = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1_000,
    KIB: 1_024,
    MB: 1_000 ** 2,
    MIB: 1_024 ** 2,
    GB: 1_000 ** 3,
    GIB: 1_024 ** 3,
  };
  return Math.round(num * (multipliers[unit] ?? 1));
}

/**
 * Convert duration strings like "0:10:23" or "1h 5m 3s" to total seconds.
 */
function parseDuration(val: string): number {
  if (!val) return 0;

  // Format H:MM:SS or HH:MM:SS
  const hms = val.match(/^(\d+):(\d+):(\d+)$/);
  if (hms) {
    return parseInt(hms[1]) * 3600 + parseInt(hms[2]) * 60 + parseInt(hms[3]);
  }

  // Format "1h 5m 3s" (any combination)
  let total = 0;
  const hourMatch = val.match(/(\d+)\s*h/i);
  const minMatch  = val.match(/(\d+)\s*m/i);
  const secMatch  = val.match(/(\d+)\s*s/i);
  if (hourMatch) total += parseInt(hourMatch[1]) * 3600;
  if (minMatch)  total += parseInt(minMatch[1])  * 60;
  if (secMatch)  total += parseInt(secMatch[1]);
  return total;
}

// ---------------------------------------------------------------------------
// Sanitisation helpers
// ---------------------------------------------------------------------------

/** Strip shell-dangerous characters from a file path argument. */
function sanitizePath(p: string): string {
  return p.replace(/[`$\\;|&]/g, '');
}

/** Strip shell-dangerous characters from a general CLI argument. */
function sanitizeArg(s: string): string {
  return s.replace(/[`$\\;|&"]/g, '');
}

// ---------------------------------------------------------------------------
// IPC handler registration
// ---------------------------------------------------------------------------

export function registerIpcHandlers(mainWindow: BrowserWindow): void {

  // -------------------------------------------------------------------------
  // openvpn3:check
  // -------------------------------------------------------------------------
  ipcMain.handle('openvpn3:check', async (): Promise<OpenVPN3Available> => {
    const result = await runCommand('openvpn3 version');
    if (result.success) {
      // Output example: "openvpn3  Community Ed. v23 (git:v23/...)"
      const firstLine = result.stdout.trim().split('\n')[0];
      const versionMatch = firstLine.match(/openvpn3[\s:]+(.+)/i);
      return {
        available: true,
        version: versionMatch ? versionMatch[1].trim() : firstLine,
        path: '/usr/bin/openvpn3',
      };
    }

    // CLI not found – try to locate it anyway for a helpful error message
    const whichResult = await runCommand('which openvpn3');
    return {
      available: false,
      path: whichResult.stdout.trim() || undefined,
    };
  });

  // -------------------------------------------------------------------------
  // openvpn3:configs-list
  // -------------------------------------------------------------------------
  ipcMain.handle('openvpn3:configs-list', async () => {
    const result = await runCommand('openvpn3 configs-list');
    if (!result.success) {
      log.error('[configs-list] Command failed:', result.stderr);
      return { profiles: [], error: result.stderr };
    }

    const profiles = parseProfilesText(result.stdout);
    log.info(`[configs-list] Parsed ${profiles.length} profile(s)`);
    return { profiles, error: undefined };
  });

  // -------------------------------------------------------------------------
  // openvpn3:config-import
  // -------------------------------------------------------------------------
  ipcMain.handle(
    'openvpn3:config-import',
    async (_event, filePath: string): Promise<CliResult> => {
      if (!filePath) {
        return { success: false, stdout: '', stderr: 'No file path provided', exitCode: 1 };
      }
      // Accept both .ovpn and .conf – consistent with the file-dialog filter
      if (!/\.(ovpn|conf)$/i.test(filePath)) {
        return {
          success: false,
          stdout: '',
          stderr: 'Invalid file: must be an .ovpn or .conf file',
          exitCode: 1,
        };
      }
      const safe = sanitizePath(filePath);
      return runCommand(`openvpn3 config-import --config "${safe}" --persistent`);
    },
  );

  // -------------------------------------------------------------------------
  // openvpn3:config-remove
  // -------------------------------------------------------------------------
  ipcMain.handle(
    'openvpn3:config-remove',
    async (_event, configName: string): Promise<CliResult> => {
      const safe = sanitizeArg(configName);
      // --force suppresses the interactive confirmation prompt correctly
      return runCommand(`openvpn3 config-remove --config "${safe}" --force`);
    },
  );

  // -------------------------------------------------------------------------
  // openvpn3:sessions-list
  // -------------------------------------------------------------------------
  ipcMain.handle('openvpn3:sessions-list', async () => {
    const result = await runCommand('openvpn3 sessions-list');
    if (!result.success) {
      log.error('[sessions-list] Command failed:', result.stderr);
      return { sessions: [], error: result.stderr };
    }

    // "No sessions available" is a normal empty state, not an error
    if (/no sessions/i.test(result.stdout)) {
      return { sessions: [], error: undefined };
    }

    const sessions = parseSessionsText(result.stdout);
    log.info(`[sessions-list] Parsed ${sessions.length} session(s)`);
    return { sessions, error: undefined };
  });

  // -------------------------------------------------------------------------
  // openvpn3:session-start
  // -------------------------------------------------------------------------
  ipcMain.handle(
    'openvpn3:session-start',
    async (_event, configName: string): Promise<CliResult> => {
      const safe = sanitizeArg(configName);
      // No --wait: returns immediately so the IPC call does not block
      return runCommand(`openvpn3 session-start --config "${safe}"`);
    },
  );

  // -------------------------------------------------------------------------
  // openvpn3:session-disconnect
  // -------------------------------------------------------------------------
  ipcMain.handle(
    'openvpn3:session-disconnect',
    async (_event, sessionPath: string): Promise<CliResult> => {
      const safe = sanitizeArg(sessionPath);
      return runCommand(
        `openvpn3 session-manage --session-path "${safe}" --disconnect`,
      );
    },
  );

  // -------------------------------------------------------------------------
  // openvpn3:session-stats
  // -------------------------------------------------------------------------
  ipcMain.handle(
    'openvpn3:session-stats',
    async (
      _event,
      sessionPath: string,
    ): Promise<CliResult & { stats?: Record<string, string> }> => {
      const safe = sanitizeArg(sessionPath);
      const result = await runCommand(
        `openvpn3 session-stats --session-path "${safe}"`,
      );
      if (!result.success) return result;

      const stats = parseSessionStats(result.stdout);
      log.info(`[session-stats] Parsed ${Object.keys(stats).length} field(s)`);
      return { ...result, stats };
    },
  );

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------
  ipcMain.handle('settings:get', (): AppSettings => {
    return store.get('settings', DEFAULT_SETTINGS);
  });

  ipcMain.handle('settings:set', (_event, partial: Partial<AppSettings>): void => {
    const current = store.get('settings', DEFAULT_SETTINGS);
    store.set('settings', { ...current, ...partial });
  });

  // -------------------------------------------------------------------------
  // Profile metadata
  // -------------------------------------------------------------------------
  ipcMain.handle('profile-meta:get-all', (): Record<string, ProfileMeta> => {
    return store.get('profileMeta', {});
  });

  ipcMain.handle(
    'profile-meta:set',
    (_event, configName: string, meta: Partial<ProfileMeta>): void => {
      const all = store.get('profileMeta', {});
      all[configName] = {
        configName,
        tags: [],
        notes: '',
        favorite: false,
        importedAt: new Date().toISOString(),
        ...(all[configName] as ProfileMeta | undefined),
        ...meta,
      };
      store.set('profileMeta', all);
    },
  );

  ipcMain.handle('profile-meta:remove', (_event, configName: string): void => {
    const all = store.get('profileMeta', {});
    delete all[configName];
    store.set('profileMeta', all);
  });

  // -------------------------------------------------------------------------
  // File dialog
  // -------------------------------------------------------------------------
  ipcMain.handle('dialog:open-file', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select OpenVPN Configuration',
      filters: [{ name: 'OpenVPN Config', extensions: ['ovpn', 'conf'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // -------------------------------------------------------------------------
  // Window controls
  // -------------------------------------------------------------------------
  ipcMain.on('window:minimize', () => mainWindow.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window:close', () => mainWindow.close());
}