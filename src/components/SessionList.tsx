// src/renderer/components/SessionList.tsx
import React, { useState } from "react";
import type { VpnSession } from "../shared/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "../hooks/useToast";
import * as api from "../api";

interface Props {
  sessions: VpnSession[];
  loading: boolean;
  onRefresh: () => void;
  autoRefresh: boolean;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("connected") || s.includes("running")) return "connected";
  if (s.includes("connect") || s.includes("auth") || s.includes("assign"))
    return "connecting";
  return "unknown";
}

export function SessionList({
  sessions,
  loading,
  onRefresh,
  autoRefresh,
}: Props) {
  const [disconnectTarget, setDisconnectTarget] = useState<VpnSession | null>(
    null,
  );
  const [disconnecting, setDisconnecting] = useState<Record<string, boolean>>(
    {},
  );
  const { showToast } = useToast();

  const handleDisconnect = async (session: VpnSession) => {
    setDisconnectTarget(null);
    setDisconnecting((prev) => ({ ...prev, [session.sessionPath]: true }));
    try {
      const result = await api.disconnectSession(session.sessionPath);
      if (result.success) {
        showToast(`Disconnected from ${session.configName}`, "success");
        setTimeout(() => onRefresh(), 1000);
      } else {
        showToast(`Disconnect failed: ${result.stderr}`, "error");
      }
    } catch {
      showToast("Disconnect error", "error");
    } finally {
      setDisconnecting((prev) => ({ ...prev, [session.sessionPath]: false }));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Active Sessions</h1>
          <span className="page-subtitle">
            {sessions.length} active session{sessions.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="page-actions">
          <div className="auto-refresh-indicator" style={{ marginRight: 4 }}>
            <div
              className={`status-dot ${autoRefresh ? "active" : ""}`}
              style={{
                background: autoRefresh
                  ? "var(--accent-cyan)"
                  : "var(--text-muted)",
                animation: autoRefresh
                  ? "blink 2s ease-in-out infinite"
                  : "none",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--text-muted)",
              }}
            >
              {autoRefresh ? "Auto-refresh" : "Manual"}
            </span>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 20 20"
              fill="currentColor"
              style={loading ? { animation: "spin 1s linear infinite" } : {}}
            >
              <path
                fillRule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                clipRule="evenodd"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {loading && sessions.length === 0 ? (
        <div className="empty-state">
          <span className="spinner" style={{ width: 24, height: 24 }} />
          <span
            style={{
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            Fetching sessions...
          </span>
        </div>
      ) : sessions.length === 0 ? (
        <div className="empty-state">
          <svg
            className="empty-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
            />
          </svg>
          <div className="empty-title">No active sessions</div>
          <div className="empty-desc">
            Connect to a VPN profile from the Profiles tab to start a session.
          </div>
        </div>
      ) : (
        <div className="sessions-list">
          {sessions.map((session) => {
            const statusClass = getStatusClass(session.status);
            const isDisconnecting = !!disconnecting[session.sessionPath];

            return (
              <div key={session.sessionPath} className="session-card">
                <div className="session-header">
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <div className={`profile-status-dot ${statusClass}`} />
                    <span className="session-name">
                      {session.configName || "Unknown"}
                    </span>
                  </div>
                  <span className={`session-status-badge ${statusClass}`}>
                    <svg
                      width="7"
                      height="7"
                      viewBox="0 0 8 8"
                      fill="currentColor"
                    >
                      <circle cx="4" cy="4" r="4" />
                    </svg>
                    {session.status}
                  </span>
                </div>

                <div className="session-stats-grid">
                  {session.remoteAddress && (
                    <div className="stat-item">
                      <div className="stat-label">Remote IP</div>
                      <div className="stat-value cyan">
                        {session.remoteAddress}
                      </div>
                    </div>
                  )}
                  {session.localAddress && (
                    <div className="stat-item">
                      <div className="stat-label">Local IP</div>
                      <div className="stat-value">{session.localAddress}</div>
                    </div>
                  )}
                  {Boolean(session.durationSeconds) && (
                    <div className="stat-item">
                      <div className="stat-label">Duration</div>
                      <div className="stat-value green">
                        {formatDuration(session.durationSeconds || 0)}
                      </div>
                    </div>
                  )}
                  {Boolean(session.bytesReceived) && (
                    <div className="stat-item">
                      <div className="stat-label">↓ Received</div>
                      <div className="stat-value">
                        {formatBytes(session.bytesReceived || 0)}
                      </div>
                    </div>
                  )}
                  {Boolean(session.bytesSent) && (
                    <div className="stat-item">
                      <div className="stat-label">↑ Sent</div>
                      <div className="stat-value">
                        {formatBytes(session.bytesSent || 0)}
                      </div>
                    </div>
                  )}
                  {session.connectedAt && (
                    <div className="stat-item">
                      <div className="stat-label">Connected At</div>
                      <div className="stat-value">{session.connectedAt}</div>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 8 }}>
                  <div className="stat-label" style={{ marginBottom: 3 }}>
                    Session Path
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      color: "var(--text-muted)",
                      wordBreak: "break-all",
                    }}
                  >
                    {session.sessionPath}
                  </div>
                </div>

                <div className="session-footer">
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setDisconnectTarget(session)}
                    disabled={isDisconnecting}
                  >
                    {isDisconnecting ? (
                      <span className="spinner" />
                    ) : (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    Disconnect
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {disconnectTarget && (
        <ConfirmDialog
          title="Disconnect VPN"
          body={
            <>
              Disconnect session <strong>{disconnectTarget.configName}</strong>?
              Your VPN tunnel will be closed immediately.
            </>
          }
          confirmLabel="Disconnect"
          danger
          onConfirm={() => handleDisconnect(disconnectTarget)}
          onCancel={() => setDisconnectTarget(null)}
        />
      )}
    </div>
  );
}
