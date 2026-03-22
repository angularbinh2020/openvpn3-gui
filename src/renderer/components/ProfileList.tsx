// src/renderer/components/ProfileList.tsx
import React, { useState, useEffect, useCallback } from "react";
import type { VpnProfile, VpnSession, ProfileMeta } from "../../shared/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "../hooks/useToast";

interface Props {
  sessions: VpnSession[];
  onSessionsChange: () => void;
  profileMetas: Record<string, ProfileMeta>;
  onMetaChange: () => void;
}

interface LoadingState {
  [key: string]: boolean;
}

export function ProfileList({
  sessions,
  onSessionsChange,
  profileMetas,
  onMetaChange,
}: Props) {
  const [profiles, setProfiles] = useState<VpnProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingState, setLoadingState] = useState<LoadingState>({});
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "status">("name");
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirm, setConfirm] = useState<{ name: string; path: string } | null>(
    null,
  );
  const [editMeta, setEditMeta] = useState<{
    name: string;
    notes: string;
    tags: string;
  } | null>(null);
  const { showToast } = useToast();

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.listConfigs();
      setProfiles(result.profiles || []);
    } catch (e) {
      showToast("Failed to load profiles", "error");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const setItemLoading = (key: string, val: boolean) =>
    setLoadingState((s) => ({ ...s, [key]: val }));

  const getSessionForProfile = (configPath: string) =>
    sessions.find(
      (s) =>
        s.configName === configPath ||
        s.configPath === configPath ||
        s.sessionPath.includes(configPath),
    );

  const handleImportFile = async (filePath?: string) => {
    const path = filePath || (await window.electronAPI.openFileDialog());
    if (!path) return;
    setImporting(true);
    try {
      const result = await window.electronAPI.importConfig(path);
      if (result.success) {
        showToast("Profile imported successfully", "success");
        await loadProfiles();
        const profiles = await window.electronAPI.listConfigs();
        const imported = profiles.profiles
          .sort((a, b) =>
            a.importTimestamp && b.importTimestamp
              ? new Date(a.importTimestamp).getTime() -
                new Date(b.importTimestamp).getTime()
              : 0,
          )
          .pop();
        if (imported) {
          await window.electronAPI.setProfileMeta(imported.path, {
            importedAt: new Date().toISOString(),
          });
        }
        onMetaChange();
      } else {
        showToast(`Import failed: ${result.stderr || result.stdout}`, "error");
      }
    } catch (e) {
      showToast("Import error", "error");
    } finally {
      setImporting(false);
    }
  };

  const handleRemove = async (configPath: string) => {
    setConfirm(null);
    setItemLoading(configPath, true);
    try {
      const result = await window.electronAPI.removeConfig(configPath);
      if (result.success) {
        showToast("Profile removed", "success");
        await window.electronAPI.removeProfileMeta(configPath);
        onMetaChange();
        await loadProfiles();
      } else {
        showToast(`Remove failed: ${result.stderr}`, "error");
      }
    } catch {
      showToast("Remove error", "error");
    } finally {
      setItemLoading(configPath, false);
    }
  };

  const handleConnect = async (configName: string, configPath: string) => {
    setItemLoading(configName + ":connect", true);
    try {
      const result = await window.electronAPI.startSession(configPath);
      if (result.success || result.stdout.includes("Session started")) {
        showToast(`Connecting to ${configName}...`, "info");
        setTimeout(() => onSessionsChange(), 2000);
      } else {
        showToast(`Connect failed: ${result.stderr || result.stdout}`, "error");
      }
    } catch {
      showToast("Connection error", "error");
    } finally {
      setItemLoading(configName + ":connect", false);
    }
  };

  const handleDisconnect = async (sessionPath: string, configName: string) => {
    setItemLoading(configName + ":disconnect", true);
    try {
      const result = await window.electronAPI.disconnectSession(sessionPath);
      if (result.success) {
        showToast(`Disconnected from ${configName}`, "success");
        setTimeout(() => onSessionsChange(), 1000);
      } else {
        showToast(`Disconnect failed: ${result.stderr}`, "error");
      }
    } catch {
      showToast("Disconnect error", "error");
    } finally {
      setItemLoading(configName + ":disconnect", false);
    }
  };

  const handleToggleFavorite = async (configPath: string) => {
    const meta = profileMetas[configPath];
    await window.electronAPI.setProfileMeta(configPath, {
      favorite: !meta?.favorite,
    });
    onMetaChange();
  };

  const handleSaveMeta = async () => {
    if (!editMeta) return;
    await window.electronAPI.setProfileMeta(editMeta.name, {
      notes: editMeta.notes,
      tags: editMeta.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    onMetaChange();
    setEditMeta(null);
    showToast("Notes saved", "success");
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.name.endsWith(".ovpn") || file.name.endsWith(".conf")) {
        await handleImportFile((file as File & { path: string }).path);
      }
    }
  };

  const filtered = profiles
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "status") {
        const aConn = !!getSessionForProfile(a.path);
        const bConn = !!getSessionForProfile(b.path);
        if (aConn !== bConn) return aConn ? -1 : 1;
      }
      const aFav = !!profileMetas[a.name]?.favorite;
      const bFav = !!profileMetas[b.name]?.favorite;
      if (aFav !== bFav) return aFav ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">VPN Profiles</h1>
          <span className="page-subtitle">
            {profiles.length} profile{profiles.length !== 1 ? "s" : ""} imported
          </span>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={loadProfiles}
            disabled={loading}
            title="Refresh"
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
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleImportFile()}
            disabled={importing}
          >
            {importing ? (
              <span className="spinner" />
            ) : (
              <svg
                width="13"
                height="13"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            Import .ovpn
          </button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`drop-zone ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => handleImportFile()}
      >
        <svg
          className="drop-zone-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
          />
        </svg>
        <div className="drop-zone-text">
          Drop .ovpn files here or click to browse
        </div>
        <div className="drop-zone-hint">Supports .ovpn and .conf files</div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-bar">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <input
            className="search-input"
            placeholder="Search profiles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "name" | "status")}
        >
          <option value="name">Sort: Name</option>
          <option value="status">Sort: Status</option>
        </select>
      </div>

      {/* Profile list */}
      {loading ? (
        <div className="empty-state">
          <span className="spinner" style={{ width: 24, height: 24 }} />
          <span
            style={{
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            Loading profiles...
          </span>
        </div>
      ) : filtered.length === 0 ? (
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
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />
          </svg>
          <div className="empty-title">
            {search ? "No profiles match your search" : "No profiles yet"}
          </div>
          <div className="empty-desc">
            {search
              ? "Try a different search term"
              : "Import a .ovpn configuration file to get started"}
          </div>
        </div>
      ) : (
        <div className="profiles-grid">
          {filtered.map((profile) => {
            const session = getSessionForProfile(profile.path);
            const isConnected = !!session;
            const meta = profileMetas[profile.name];
            const isConnecting = loadingState[profile.name + ":connect"];
            const isDisconnecting = loadingState[profile.name + ":disconnect"];
            const isRemoving = loadingState[profile.name];

            return (
              <div
                key={profile.path}
                className={`profile-card ${isConnected ? "connected" : ""}`}
              >
                <div
                  className={`profile-status-dot ${isConnected ? "connected" : isConnecting ? "connecting" : ""}`}
                />

                <div className="profile-info">
                  <div className="profile-name">{profile.name}</div>
                  <div className="profile-path">{profile.path}</div>
                  {(meta?.tags?.length || meta?.notes) && (
                    <div className="profile-meta-row">
                      {meta?.tags?.map((tag) => (
                        <span key={tag} className="tag">
                          {tag}
                        </span>
                      ))}
                      {meta?.notes && (
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--text-muted)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {meta.notes.substring(0, 40)}
                          {meta.notes.length > 40 ? "…" : ""}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="profile-actions">
                  {/* Favorite toggle */}
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => handleToggleFavorite(profile.path)}
                    title={
                      meta?.favorite
                        ? "Remove from favorites"
                        : "Add to favorites"
                    }
                    style={{
                      color: meta?.favorite
                        ? "var(--accent-yellow)"
                        : "var(--text-muted)",
                    }}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 20 20"
                      fill={meta?.favorite ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                      />
                    </svg>
                  </button>

                  {/* Notes edit */}
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() =>
                      setEditMeta({
                        name: profile.name,
                        notes: meta?.notes || "",
                        tags: (meta?.tags || []).join(", "),
                      })
                    }
                    title="Edit notes"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>

                  {/* Connect / Disconnect */}
                  {isConnected ? (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() =>
                        handleDisconnect(session.sessionPath, profile.name)
                      }
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
                  ) : (
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleConnect(profile.name, profile.path)}
                      disabled={isConnecting}
                    >
                      {isConnecting ? (
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
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      Connect
                    </button>
                  )}

                  {/* Remove */}
                  <button
                    className="btn btn-danger btn-icon btn-sm"
                    onClick={() =>
                      setConfirm({ name: profile.name, path: profile.path })
                    }
                    disabled={isRemoving || isConnected}
                    title={isConnected ? "Disconnect first" : "Remove profile"}
                  >
                    {isRemoving ? (
                      <span className="spinner" />
                    ) : (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm remove dialog */}
      {confirm && (
        <ConfirmDialog
          title="Remove Profile"
          body={
            <>
              Remove <strong>{confirm.name}</strong>? This will delete the
              configuration from openvpn3.
            </>
          }
          confirmLabel="Remove"
          danger
          onConfirm={() => handleRemove(confirm.path)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Edit meta dialog */}
      {editMeta && (
        <div className="modal-overlay" onClick={() => setEditMeta(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Edit Profile Info</div>
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                TAGS (comma-separated)
              </label>
              <input
                className="text-input"
                value={editMeta.tags}
                onChange={(e) =>
                  setEditMeta({ ...editMeta, tags: e.target.value })
                }
                placeholder="work, personal, us-east..."
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                NOTES
              </label>
              <textarea
                className="textarea"
                value={editMeta.notes}
                onChange={(e) =>
                  setEditMeta({ ...editMeta, notes: e.target.value })
                }
                placeholder="Add notes about this profile..."
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setEditMeta(null)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveMeta}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
