// src/renderer/components/Settings.tsx
import React from "react";
import type { AppSettings, OpenVPN3Available } from "../shared/types";
import { useToast } from "../hooks/useToast";

interface Props {
  settings: AppSettings;
  ovpnInfo: OpenVPN3Available | null;
  onSettingsChange: (partial: Partial<AppSettings>) => void;
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div
      className={`toggle ${on ? "on" : ""}`}
      onClick={onToggle}
      role="switch"
      aria-checked={on}
    >
      <div className="toggle-knob" />
    </div>
  );
}

export function Settings({ settings, ovpnInfo, onSettingsChange }: Props) {
  const { showToast } = useToast();

  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (val >= 1000 && val <= 60000) {
      onSettingsChange({ refreshIntervalMs: val });
    }
  };

  const copyInstallCmd = (cmd: string) => {
    navigator.clipboard
      .writeText(cmd)
      .then(() => showToast("Copied to clipboard", "success"));
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Settings</h1>
          <span className="page-subtitle">
            Configure application preferences
          </span>
        </div>
      </div>

      {/* OpenVPN3 status */}
      <div className="settings-section">
        <div className="settings-section-header">OpenVPN3 Status</div>

        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-label">openvpn3 CLI</div>
            <div className="settings-row-desc">
              {ovpnInfo?.available
                ? `Available — ${ovpnInfo.version || "version unknown"}`
                : "Not found on system PATH"}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: ovpnInfo?.available
                ? "var(--accent-green)"
                : "var(--accent-red)",
            }}
          >
            <div
              className={`status-dot ${ovpnInfo?.available ? "online" : "offline"}`}
            />
            {ovpnInfo?.available ? "Installed" : "Not installed"}
          </div>
        </div>

        {!ovpnInfo?.available && (
          <div style={{ padding: "0 16px 16px" }}>
            <div className="install-guide">
              <div className="install-guide-title">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                openvpn3 is not installed
              </div>
              <p>Install OpenVPN3 on Ubuntu/Debian:</p>
              <div
                className="code-block"
                onClick={() =>
                  copyInstallCmd(
                    'sudo apt install apt-transport-https\ncurl -fsSL https://packages.openvpn.net/packages-repo.gpg | sudo gpg --dearmor -o /etc/apt/keyrings/openvpn.gpg\necho "deb [signed-by=/etc/apt/keyrings/openvpn.gpg] https://packages.openvpn.net/openvpn3/debian $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/openvpn3.list\nsudo apt update\nsudo apt install openvpn3',
                  )
                }
                style={{ cursor: "pointer" }}
                title="Click to copy"
              >
                {`sudo apt install apt-transport-https
curl -fsSL https://packages.openvpn.net/packages-repo.gpg \\
  | sudo gpg --dearmor -o /etc/apt/keyrings/openvpn.gpg
echo "deb [signed-by=/etc/apt/keyrings/openvpn.gpg] \\
  https://packages.openvpn.net/openvpn3/debian \\
  $(lsb_release -cs) main" \\
  | sudo tee /etc/apt/sources.list.d/openvpn3.list
sudo apt update && sudo apt install openvpn3`}
              </div>
              <p
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  marginTop: 4,
                }}
              >
                Click the code block above to copy to clipboard
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Appearance */}
      <div className="settings-section">
        <div className="settings-section-header">Appearance</div>

        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-label">Dark Mode</div>
            <div className="settings-row-desc">
              Use dark color theme (recommended)
            </div>
          </div>
          <Toggle
            on={settings.darkMode}
            onToggle={() => onSettingsChange({ darkMode: !settings.darkMode })}
          />
        </div>
      </div>

      {/* Sessions */}
      <div className="settings-section">
        <div className="settings-section-header">Sessions</div>

        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-label">Auto-refresh Sessions</div>
            <div className="settings-row-desc">
              Automatically poll active sessions
            </div>
          </div>
          <Toggle
            on={settings.autoRefreshSessions}
            onToggle={() =>
              onSettingsChange({
                autoRefreshSessions: !settings.autoRefreshSessions,
              })
            }
          />
        </div>

        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-label">Refresh Interval</div>
            <div className="settings-row-desc">
              How often to poll sessions (ms) — current:{" "}
              {settings.refreshIntervalMs}ms
            </div>
          </div>
          <input
            type="range"
            min="2000"
            max="30000"
            step="1000"
            value={settings.refreshIntervalMs}
            onChange={handleIntervalChange}
            style={{ width: 120, accentColor: "var(--accent-cyan)" }}
          />
        </div>
      </div>

      {/* Profiles */}
      <div className="settings-section">
        <div className="settings-section-header">Profiles</div>

        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-label">Default Sort Order</div>
            <div className="settings-row-desc">
              How to sort profiles in the list
            </div>
          </div>
          <select
            className="select"
            value={settings.profileSortBy}
            onChange={(e) =>
              onSettingsChange({
                profileSortBy: e.target.value as AppSettings["profileSortBy"],
              })
            }
          >
            <option value="name">By Name</option>
            <option value="importDate">By Import Date</option>
            <option value="status">By Connection Status</option>
          </select>
        </div>
      </div>

      {/* About */}
      <div className="settings-section">
        <div className="settings-section-header">About</div>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-label">OpenVPN Manager</div>
            <div className="settings-row-desc">
              Version 1.0.0 — Built with Electron + React
            </div>
          </div>
          <span className="version-badge">v1.0.0</span>
        </div>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-label">Dev</div>
            <div className="settings-row-desc">
              Đỗ Đức Bình - doducbinh1995@gmail.com 
            </div>
          </div>
        </div>
          <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-label">AI</div>
            <div className="settings-row-desc">
              Claude, Deepseek, Gemini
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
