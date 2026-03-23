// src/App.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { AppSettings, OpenVPN3Available, VpnSession, ProfileMeta } from './shared/types';
import { ProfileList } from './components/ProfileList';
import { SessionList } from './components/SessionList';
import { Settings } from './components/Settings';
import { StatusBar } from './components/StatusBar';
import * as api from './api';

type TabId = 'profiles' | 'sessions' | 'settings';

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  {
    id: 'profiles',
    label: 'Profiles',
    icon: (
      <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    id: 'sessions',
    label: 'Sessions',
    icon: (
      <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
      </svg>
    ),
  },
];

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('profiles');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [ovpnInfo, setOvpnInfo] = useState<OpenVPN3Available | null>(null);
  const [sessions, setSessions] = useState<VpnSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [profileMetas, setProfileMetas] = useState<Record<string, ProfileMeta>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load initial data — dùng api.ts thay vì window.electronAPI
  useEffect(() => {
    (async () => {
      const [s, info, metas] = await Promise.all([
        api.getSettings(),
        api.checkOpenVPN3(),
        api.getAllProfileMeta(),
      ]);
      setSettings(s);
      setOvpnInfo(info);
      setProfileMetas(metas);
      setSidebarCollapsed(s.sidebarCollapsed);
    })();
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const result = await api.listSessions();
      setSessions(result.sessions || []);
      setLastRefresh(new Date());
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  // Setup auto-refresh for sessions
  useEffect(() => {
    if (!settings) return;
    loadSessions();

    if (intervalRef.current) clearInterval(intervalRef.current);

    if (settings.autoRefreshSessions) {
      intervalRef.current = setInterval(loadSessions, settings.refreshIntervalMs);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [settings?.autoRefreshSessions, settings?.refreshIntervalMs, loadSessions]);

  const handleSettingsChange = async (partial: Partial<AppSettings>) => {
    const updated = { ...settings!, ...partial };
    setSettings(updated);
    await api.setSettings(partial);

    if ('darkMode' in partial) {
      document.documentElement.classList.toggle('light-mode', !partial.darkMode);
    }
  };

  const handleSidebarToggle = async () => {
    const newVal = !sidebarCollapsed;
    setSidebarCollapsed(newVal);
    await api.setSettings({ sidebarCollapsed: newVal });
  };

  const handleMetaChange = async () => {
    const metas = await api.getAllProfileMeta();
    setProfileMetas(metas);
  };

  useEffect(() => {
    if (settings) {
      document.documentElement.classList.toggle('light-mode', !settings.darkMode);
    }
  }, [settings?.darkMode]);

  const activeSessionCount = sessions.length;

  if (!settings) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            border: '3px solid var(--border-card)',
            borderTopColor: 'var(--accent-cyan)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
            letterSpacing: '0.1em',
          }}
        >
          INITIALIZING...
        </span>
      </div>
    );
  }

  return (
    <div className="app-root">
      {/* Custom title bar — drag region phải dùng data-tauri-drag-region */}
      <div className="titlebar" data-tauri-drag-region>
        <div className="titlebar-left" data-tauri-drag-region>
          <div className="titlebar-logo">
            <svg className="titlebar-logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <span className="titlebar-title">OpenVPN Manager</span>
          </div>
        </div>

        <div className="titlebar-center" data-tauri-drag-region>
          {ovpnInfo?.available ? (
            <span style={{ color: 'var(--accent-green)' }}>● CONNECTED</span>
          ) : (
            <span>○ openvpn3 not found</span>
          )}
        </div>

        <div className="titlebar-controls">
          <button className="titlebar-btn" onClick={api.windowMinimize} title="Minimize">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
              <rect y="5" width="12" height="2" rx="1" />
            </svg>
          </button>
          <button className="titlebar-btn" onClick={api.windowMaximize} title="Maximize">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="10" height="10" rx="1" />
            </svg>
          </button>
          <button className="titlebar-btn close" onClick={api.windowClose} title="Close">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="main-layout">
        {/* Sidebar */}
        <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <nav className="sidebar-nav">
            {!sidebarCollapsed && (
              <div className="nav-section-label">Navigation</div>
            )}
            {TABS.map((tab) => (
              <div
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                title={sidebarCollapsed ? tab.label : undefined}
              >
                {tab.icon}
                {!sidebarCollapsed && <span className="nav-label">{tab.label}</span>}
                {!sidebarCollapsed && tab.id === 'sessions' && activeSessionCount > 0 && (
                  <span className="nav-badge green">{activeSessionCount}</span>
                )}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button className="sidebar-collapse-btn" onClick={handleSidebarToggle} title="Toggle sidebar">
              <svg
                style={{ width: 16, height: 16, flexShrink: 0, transition: 'transform 0.2s', transform: sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {!sidebarCollapsed && (
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>Collapse</span>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="content-area">
          {activeTab === 'profiles' && (
            <ProfileList
              sessions={sessions}
              onSessionsChange={loadSessions}
              profileMetas={profileMetas}
              onMetaChange={handleMetaChange}
            />
          )}
          {activeTab === 'sessions' && (
            <SessionList
              sessions={sessions}
              loading={sessionsLoading}
              onRefresh={loadSessions}
              autoRefresh={settings.autoRefreshSessions}
            />
          )}
          {activeTab === 'settings' && (
            <Settings
              settings={settings}
              ovpnInfo={ovpnInfo}
              onSettingsChange={handleSettingsChange}
            />
          )}
        </div>
      </div>

      {/* Status bar */}
      <StatusBar ovpnInfo={ovpnInfo} sessions={sessions} lastRefresh={lastRefresh} />
    </div>
  );
}
