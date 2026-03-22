// src/renderer/components/StatusBar.tsx
import React from 'react';
import type { OpenVPN3Available, VpnSession } from '../../shared/types';

interface Props {
  ovpnInfo: OpenVPN3Available | null;
  sessions: VpnSession[];
  lastRefresh: Date | null;
}

export function StatusBar({ ovpnInfo, sessions, lastRefresh }: Props) {
  const connectedCount = sessions.length;

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="statusbar">
      <div className="status-item">
        <div className={`status-dot ${ovpnInfo?.available ? 'online' : 'offline'}`} />
        openvpn3 {ovpnInfo?.available ? ovpnInfo.version || 'ready' : 'not found'}
      </div>

      <div className="status-divider" />

      <div className="status-item">
        <div className={`status-dot ${connectedCount > 0 ? 'online' : ''}`} />
        {connectedCount} active session{connectedCount !== 1 ? 's' : ''}
      </div>

      {connectedCount > 0 && (
        <>
          <div className="status-divider" />
          <div className="status-item">
            <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor" style={{ color: 'var(--accent-green)' }}>
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span style={{ color: 'var(--accent-green)' }}>VPN Active</span>
          </div>
        </>
      )}

      <div style={{ flex: 1 }} />

      {lastRefresh && (
        <div className="status-item">
          <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          Last refresh: {formatTime(lastRefresh)}
        </div>
      )}
    </div>
  );
}
