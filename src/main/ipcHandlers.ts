// src/main/ipcHandlers.ts
import { ipcMain, dialog, BrowserWindow } from "electron";
import { exec } from "child_process";
import { promisify } from "util";
import Store from "electron-store";
import log from "electron-log";
import type {
  VpnProfile,
  VpnSession,
  CliResult,
  OpenVPN3Available,
  AppSettings,
  ProfileMeta,
  ConfigRaw,
} from "../shared/types";

const execAsync = promisify(exec);

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: true,
  windowWidth: 1100,
  windowHeight: 720,
  autoRefreshSessions: true,
  refreshIntervalMs: 5000,
  sidebarCollapsed: false,
  profileSortBy: "name",
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

async function runCommand(cmd: string): Promise<CliResult> {
  log.info(`[CLI] Running: ${cmd}`);
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 30000,
      env: {
        ...process.env,
        PATH:
          "/usr/bin:/usr/local/bin:/bin:/snap/bin:" + (process.env.PATH || ""),
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
      stdout: error.stdout || "",
      stderr: error.stderr || error.message || "Unknown error",
      exitCode: error.code || 1,
    };
  }
}

function parseProfilesJson(raw: string): VpnProfile[] {
  try {
    log.log(`>>> Parse profile`);
    log.log(raw);
    const ObjData = JSON.parse(raw);
    const profileNames = Object.keys(ObjData);
    return profileNames.map((field) => {
      const item = ObjData[field];
      return {
        name: String(item["name"] || ""),
        path: field,
        owner: String(item?.acl.owner),
        locked: Boolean(item.acl.locked_down),
        importTimestamp: String(item["imported_tstamp"] || ""),
      };
    });
  } catch {
    // Try line-based parsing as fallback
    log.warn("[Parser] JSON parse failed for configs-list, using fallback");
    const lines = raw.trim().split("\n");
    const profiles: VpnProfile[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed &&
        !trimmed.startsWith("Config") &&
        !trimmed.startsWith("---")
      ) {
        profiles.push({ name: trimmed, path: trimmed });
      }
    }
    return profiles;
  }
}

function parseSessionsText(raw: string): VpnSession[] {
  // "No sessions available" hoặc output rỗng
  if (!raw.trim() || /no sessions/i.test(raw)) return [];

  const sessions: VpnSession[] = [];

  // Tách từng block bởi dòng dashes (----)
  const blocks = raw
    .split(/^-{10,}\s*$/m)
    .map((b) => b.trim())
    .filter(Boolean);

  for (const block of blocks) {
    const get = (pattern: RegExp): string => {
      const m = block.match(pattern);
      return m ? m[1].trim() : "";
    };

    const sessionPath = get(/^\s*Path\s*:\s*(.+)$/im);
    if (!sessionPath) continue; // block không hợp lệ, bỏ qua

    // "Created: Thu Jan  2 10:00:00 2025                  PID: 12345"
    // → lấy phần ngày, bỏ phần "PID: ..."
    const createdRaw = get(/^\s*Created\s*:\s*(.+)$/im);
    const createdAt = createdRaw.replace(/\s{2,}PID\s*:\s*\S+.*$/i, "").trim();

    // "Status: Connection, Client connected"  hoặc  "Status: Disconnected"
    const statusRaw = get(/^\s*Status\s*:\s*(.+)$/im);
    const statusParts = statusRaw.split(",").map((s) => s.trim());
    // statusParts[0] = major ("Connection"), statusParts[1] = minor ("Client connected")
    const status = statusParts[1] || statusParts[0] || "UNKNOWN";
    const statusMinor = statusParts.length > 1 ? statusParts[0] : "";

    sessions.push({
      sessionPath,
      configName: get(/^\s*Config name\s*:\s*(.+)$/im),
      configPath: get(/^\s*Config path\s*:\s*(.+)$/im),
      status,
      statusMinor,
      createdAt: createdAt || undefined,
      // Các trường thống kê không có trong sessions-list plain-text
      // (cần `openvpn3 sessions-stats --path <path>` để lấy thêm)
      connectedAt: undefined,
      bytesReceived: 0,
      bytesSent: 0,
      remoteAddress: "",
      localAddress: "",
      durationSeconds: 0,
    });
  }

  return sessions;
}
export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // Check openvpn3 availability
  ipcMain.handle("openvpn3:check", async (): Promise<OpenVPN3Available> => {
    const result = await runCommand("openvpn3 version");
    if (result.success) {
      const versionMatch = result.stdout.match(/openvpn3[\s:]+([^\n]+)/i);
      return {
        available: true,
        version: versionMatch
          ? versionMatch[1].trim()
          : result.stdout.trim().split("\n")[0],
        path: "/usr/bin/openvpn3",
      };
    }
    // Try to find it
    const whichResult = await runCommand("which openvpn3");
    return {
      available: false,
      path: whichResult.stdout.trim() || undefined,
    };
  });

  // List configs
  ipcMain.handle("openvpn3:configs-list", async () => {
    log.log(">>> Get config list");
    const result = await runCommand("openvpn3 configs-list --json");
    // if (!result.success) {
    //   // try without --json
    //   console.log(">>> use fallback no json")
    //   const result2 = await runCommand('openvpn3 configs-list');
    //   return { profiles: parseProfilesJson(result2.stdout), error: undefined };
    // }
    const profiles = parseProfilesJson(result.stdout);
    return { profiles, error: undefined };
  });

  // Import config
  ipcMain.handle(
    "openvpn3:config-import",
    async (_event, filePath: string): Promise<CliResult> => {
      if (!filePath || !filePath.endsWith(".ovpn")) {
        return {
          success: false,
          stdout: "",
          stderr: "Invalid file path or not an .ovpn file",
          exitCode: 1,
        };
      }
      // Sanitize path
      const safe = filePath.replace(/[`$\\;|&]/g, "");
      return runCommand(
        `openvpn3 config-import --config "${safe}" --persistent`,
      );
    },
  );

  // Remove config
  ipcMain.handle(
    "openvpn3:config-remove",
    async (_event, configPath: string): Promise<CliResult> => {
      const safe = configPath.replace(/[`$\\;|&"]/g, "");
      const removeCommand=`echo "YES" | openvpn3 config-remove --config-path "${safe}"`
      const result = await runCommand(
        removeCommand
      );
      // openvpn3 may ask for confirmation via stdin - use --force if available or pipe yes
      if (!result.success && result.stderr.includes("confirm")) {
        return runCommand(
          `echo "yes" | ${removeCommand}`,
        );
      }
      return result;
    },
  );

  // List sessions
  ipcMain.handle("openvpn3:sessions-list", async () => {
    const result = await runCommand("openvpn3 sessions-list");
    if (!result.success) {
      return { sessions: [], error: result.stderr };
    }
    const sessions = parseSessionsText(result.stdout);
    return { sessions, error: undefined };
  });

  // Start session
  ipcMain.handle(
    "openvpn3:session-start",
    async (_event, configPath: string): Promise<CliResult> => {
      const safe = configPath.replace(/[`$\\;|&"]/g, "");
      // Start without --wait to avoid blocking
      return runCommand(`openvpn3 session-start --config-path "${safe}"`);
    },
  );

  // Disconnect session
  ipcMain.handle(
    "openvpn3:session-disconnect",
    async (_event, sessionPath: string): Promise<CliResult> => {
      const safe = sessionPath.replace(/[`$\\;|&"]/g, "");
      return runCommand(
        `openvpn3 session-manage --session-path "${safe}" --disconnect`,
      );
    },
  );

  // Session stats
  ipcMain.handle(
    "openvpn3:session-stats",
    async (_event, sessionPath: string): Promise<CliResult> => {
      const safe = sessionPath.replace(/[`$\\;|&"]/g, "");
      return runCommand(
        `openvpn3 session-stats --session-path "${safe}" --json`,
      );
    },
  );

  // Settings
  ipcMain.handle("settings:get", (): AppSettings => {
    return store.get("settings", DEFAULT_SETTINGS);
  });

  ipcMain.handle(
    "settings:set",
    (_event, partial: Partial<AppSettings>): void => {
      const current = store.get("settings", DEFAULT_SETTINGS);
      store.set("settings", { ...current, ...partial });
    },
  );

  // Profile meta
  ipcMain.handle("profile-meta:get-all", (): Record<string, ProfileMeta> => {
    return store.get("profileMeta", {});
  });

  ipcMain.handle(
    "profile-meta:set",
    (_event, configName: string, meta: Partial<ProfileMeta>): void => {
      const all = store.get("profileMeta", {});
      all[configName] = {
        configName,
        tags: [],
        notes: "",
        favorite: false,
        importedAt: new Date().toISOString(),
        ...(all[configName] as any),
        ...meta,
      };
      store.set("profileMeta", all);
    },
  );

  ipcMain.handle("profile-meta:remove", (_event, configPath: string): void => {
    const all = store.get("profileMeta", {});
    delete all[configPath];
    store.set("profileMeta", all);
  });

  // File dialog
  ipcMain.handle("dialog:open-file", async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Select OpenVPN Configuration",
      filters: [{ name: "OpenVPN Config", extensions: ["ovpn", "conf"] }],
      properties: ["openFile"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // Window controls
  ipcMain.on("window:minimize", () => mainWindow.minimize());
  ipcMain.on("window:maximize", () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on("window:close", () => mainWindow.close());
}
