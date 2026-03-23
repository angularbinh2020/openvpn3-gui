// src/api.ts
// ============================================================
// Thay thế window.electronAPI — gọi Tauri commands qua invoke()
// ============================================================
import { invoke } from '@tauri-apps/api/core';
import type {
  AppSettings,
  CliResult,
  OpenVPN3Available,
  ProfileMeta,
  VpnProfile,
  VpnSession,
} from './shared/types';
import { getCurrentWindow } from '@tauri-apps/api/window';

// ─── OpenVPN3 ────────────────────────────────────────────────────────────────

export const checkOpenVPN3 = (): Promise<OpenVPN3Available> =>
  invoke('check_openvpn3');

export const listConfigs = (): Promise<{ profiles: VpnProfile[]; error?: string }> =>
  invoke('list_configs');

export const importConfig = (filePath: string): Promise<CliResult> =>
  invoke('import_config', { filePath });

export const removeConfig = (configPath: string): Promise<CliResult> =>
  invoke('remove_config', { configPath });

export const listSessions = (): Promise<{ sessions: VpnSession[]; error?: string }> =>
  invoke('list_sessions');

export const startSession = (configPath: string): Promise<CliResult> =>
  invoke('start_session', { configPath });

export const disconnectSession = (sessionPath: string): Promise<CliResult> =>
  invoke('disconnect_session', { sessionPath });

export const getSessionStats = (sessionPath: string): Promise<CliResult> =>
  invoke('get_session_stats', { sessionPath });

// ─── Settings ────────────────────────────────────────────────────────────────

export const getSettings = (): Promise<AppSettings> =>
  invoke('get_settings');

export const setSettings = (settings: Partial<AppSettings>): Promise<void> =>
  invoke('set_settings', { settings });

// ─── Profile Meta ─────────────────────────────────────────────────────────────

export const getAllProfileMeta = (): Promise<Record<string, ProfileMeta>> =>
  invoke('get_all_profile_meta');

export const setProfileMeta = (
  configPath: string,
  meta: Partial<ProfileMeta>
): Promise<void> => invoke('set_profile_meta', { configPath, meta });

export const removeProfileMeta = (configPath: string): Promise<void> =>
  invoke('remove_profile_meta', { configPath });

// ─── File dialog ──────────────────────────────────────────────────────────────

export const openFileDialog = (): Promise<string | null> =>
  invoke('open_file_dialog');

// ─── Window controls (Tauri built-in) ────────────────────────────────────────


export const windowMinimize = async () => {
  try {
    await getCurrentWindow().minimize();
  } catch (error) {
    console.error('Minimize failed:', error);
  }
};

export const windowMaximize = async () => {
  try {
    const win = getCurrentWindow();
    if (await win.isMaximized()) {
      await win.unmaximize();
    } else {
      await win.maximize();
    }
  } catch (error) {
    console.error('Maximize/unmaximize failed:', error);
  }
};

export const windowClose = async () => {
  try {
    await getCurrentWindow().close();
  } catch (error) {
    console.error('Close failed:', error);
  }
};