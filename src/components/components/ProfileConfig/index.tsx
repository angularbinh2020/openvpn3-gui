import React from "react";
import { ProfileMeta, VpnProfile, VpnSession } from "../../../shared/types";

interface Props {
  getProfileMeta: (configPath: string) => ProfileMeta;
  getSessionForProfile: (configPath: string) => VpnSession | undefined;
  profile: VpnProfile;
  loadingState: any;
  handleToggleFavorite: (configPath: string) => Promise<void>;
  setEditMeta: any;
  handleDisconnect: (sessionPath: string, configName: string) => Promise<void>;
  handleConnect: (configName: string, configPath: string) => Promise<void>;
  setConfirm: any;
}
export const ProfileConfig = ({
  getProfileMeta,
  getSessionForProfile,
  profile,
  loadingState,
  handleToggleFavorite,
  setEditMeta,
  handleDisconnect,
  handleConnect,
  setConfirm,
}: Props) => {
  const session = getSessionForProfile(profile.name);
  const isConnected = !!session;
  const meta = getProfileMeta(profile.path);
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
          title={meta?.favorite ? "Remove from favorites" : "Add to favorites"}
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
              path: profile.path,
              notes: meta?.notes || "",
              tags: (meta?.tags || []).join(", "),
            })
          }
          title="Edit notes"
        >
          <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </button>

        {/* Connect / Disconnect */}
        {isConnected ? (
          <button
            className="btn btn-danger btn-sm"
            onClick={() => handleDisconnect(session.sessionPath, profile.name)}
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
          onClick={() => setConfirm({ name: profile.name, path: profile.path })}
          disabled={isRemoving || isConnected}
          title={isConnected ? "Disconnect first" : "Remove profile"}
        >
          {isRemoving ? (
            <span className="spinner" />
          ) : (
            <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
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
};
