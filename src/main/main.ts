// src/main/main.ts
import { app, BrowserWindow, nativeTheme } from 'electron';
import * as path from 'path';
import log from 'electron-log';
import Store from 'electron-store';
import { registerIpcHandlers } from './ipcHandlers';
import type { AppSettings } from '../shared/types';

log.initialize({ preload: true });
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: true,
  windowWidth: 1100,
  windowHeight: 720,
  autoRefreshSessions: true,
  refreshIntervalMs: 5000,
  sidebarCollapsed: false,
  profileSortBy: 'name',
};

const store = new Store<{ settings: AppSettings }>({
  defaults: { settings: DEFAULT_SETTINGS },
});

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const settings = store.get('settings', DEFAULT_SETTINGS);
  nativeTheme.themeSource = settings.darkMode ? 'dark' : 'light';

  mainWindow = new BrowserWindow({
    width: settings.windowWidth || 1100,
    height: settings.windowHeight || 720,
    x: settings.windowX,
    y: settings.windowY,
    minWidth: 800,
    minHeight: 560,
    frame: false,           // Custom title bar
    titleBarStyle: 'hidden',
    backgroundColor: '#0d1117',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
  });

  // Load renderer
  const rendererPath = path.join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(rendererPath).catch((err) => {
    log.error('Failed to load renderer:', err);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow!.show();
    if (process.env.NODE_ENV === 'development') {
      mainWindow!.webContents.openDevTools();
    }
  });

  // Save window bounds on close
  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      const current = store.get('settings', DEFAULT_SETTINGS);
      store.set('settings', {
        ...current,
        windowWidth: bounds.width,
        windowHeight: bounds.height,
        windowX: bounds.x,
        windowY: bounds.y,
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  registerIpcHandlers(mainWindow);
  log.info('Main window created');
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  log.info('Application quitting');
});
