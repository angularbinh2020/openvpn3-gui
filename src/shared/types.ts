// src/shared/types.ts

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

export type IpcChannel =
  | 'openvpn3:check'
  | 'openvpn3:configs-list'
  | 'openvpn3:config-import'
  | 'openvpn3:config-remove'
  | 'openvpn3:sessions-list'
  | 'openvpn3:session-start'
  | 'openvpn3:session-disconnect'
  | 'openvpn3:session-stats'
  | 'settings:get'
  | 'settings:set'
  | 'profile-meta:get-all'
  | 'profile-meta:set'
  | 'profile-meta:remove'
  | 'dialog:open-file'
  | 'window:minimize'
  | 'window:maximize'
  | 'window:close';

export interface ElectronAPI {
  checkOpenVPN3: () => Promise<OpenVPN3Available>;
  listConfigs: () => Promise<{ profiles: VpnProfile[]; error?: string }>;
  importConfig: (filePath: string) => Promise<CliResult>;
  removeConfig: (configName: string) => Promise<CliResult>;
  listSessions: () => Promise<{ sessions: VpnSession[]; error?: string }>;
  startSession: (configPath: string) => Promise<CliResult>;
  disconnectSession: (sessionPath: string) => Promise<CliResult>;
  getSessionStats: (sessionPath: string) => Promise<CliResult>;
  getSettings: () => Promise<AppSettings>;
  setSettings: (settings: Partial<AppSettings>) => Promise<void>;
  getAllProfileMeta: () => Promise<Record<string, ProfileMeta>>;
  setProfileMeta: (configPath: string, meta: Partial<ProfileMeta>) => Promise<void>;
  removeProfileMeta: (configName: string) => Promise<void>;
  openFileDialog: () => Promise<string | null>;
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

interface AccessControlList {
  locked_down: boolean;
  owner: string;
  public_access: boolean;
}

export interface ConfigRaw {
  acl: AccessControlList;
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