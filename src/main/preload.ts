// src/main/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, AppSettings, ProfileMeta } from '../shared/types';

const api: ElectronAPI = {
  checkOpenVPN3: () => ipcRenderer.invoke('openvpn3:check'),
  listConfigs: () => ipcRenderer.invoke('openvpn3:configs-list'),
  importConfig: (filePath) => ipcRenderer.invoke('openvpn3:config-import', filePath),
  removeConfig: (configName) => ipcRenderer.invoke('openvpn3:config-remove', configName),
  listSessions: () => ipcRenderer.invoke('openvpn3:sessions-list'),
  startSession: (configName) => ipcRenderer.invoke('openvpn3:session-start', configName),
  disconnectSession: (sessionPath) => ipcRenderer.invoke('openvpn3:session-disconnect', sessionPath),
  getSessionStats: (sessionPath) => ipcRenderer.invoke('openvpn3:session-stats', sessionPath),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke('settings:set', settings),
  getAllProfileMeta: () => ipcRenderer.invoke('profile-meta:get-all'),
  setProfileMeta: (configName: string, meta: Partial<ProfileMeta>) =>
    ipcRenderer.invoke('profile-meta:set', configName, meta),
  removeProfileMeta: (configName: string) => ipcRenderer.invoke('profile-meta:remove', configName),
  openFileDialog: () => ipcRenderer.invoke('dialog:open-file'),
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close'),
};

contextBridge.exposeInMainWorld('electronAPI', api);
