// src/shared/types.ts
// Bỏ ElectronAPI + IpcChannel — dùng Tauri invoke() thay thế

export interface VpnProfile {
  name: string;
  path: string;
  owner?: string;
  locked?: boolean;
  importTimestamp?: string;
  tags?: string[];
  notes?: string;
}

export interface VpnSession {
  sessionPath: string;
  configName: string;
  configPath: string;
  status: string;
  statusMinor?: string;
  createdAt?: string;
  connectedAt?: string;
  bytesReceived?: number;
  bytesSent?: number;
  remoteAddress?: string;
  localAddress?: string;
  durationSeconds?: number;
}

export interface AppSettings {
  darkMode: boolean;
  windowWidth: number;
  windowHeight: number;
  windowX?: number;
  windowY?: number;
  autoRefreshSessions: boolean;
  refreshIntervalMs: number;
  sidebarCollapsed: boolean;
  profileSortBy: 'name' | 'importDate' | 'status';
}

export interface ProfileMeta {
  configName: string;
  tags: string[];
  notes: string;
  favorite: boolean;
  importedAt: string;
}

export interface CliResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface OpenVPN3Available {
  available: boolean;
  version?: string;
  path?: string;
}

export interface ConfigRaw {
  acl: {
    locked_down: boolean;
    owner: string;
    public_access: boolean;
  };
  dco: boolean;
  imported: string;
  imported_tstamp: number;
  lastused: string;
  lastused_tstamp: number;
  name: string;
  transfer_owner_session: boolean;
  use_count: number;
  valid: boolean;
}
