// src-tauri/src/commands.rs
// Thay thế toàn bộ src/main/ipcHandlers.ts

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;
use tauri::AppHandle;

// ─── Shared types (mirror src/shared/types.ts) ───────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CliResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    #[serde(rename = "exitCode")]
    pub exit_code: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OpenVPN3Available {
    pub available: bool,
    pub version: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VpnProfile {
    pub name: String,
    pub path: String,
    pub owner: Option<String>,
    pub locked: Option<bool>,
    #[serde(rename = "importTimestamp")]
    pub import_timestamp: Option<String>,
    pub tags: Option<Vec<String>>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VpnSession {
    #[serde(rename = "sessionPath")]
    pub session_path: String,
    #[serde(rename = "configName")]
    pub config_name: String,
    #[serde(rename = "configPath")]
    pub config_path: String,
    pub status: String,
    #[serde(rename = "statusMinor")]
    pub status_minor: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<String>,
    #[serde(rename = "connectedAt")]
    pub connected_at: Option<String>,
    #[serde(rename = "bytesReceived")]
    pub bytes_received: Option<u64>,
    #[serde(rename = "bytesSent")]
    pub bytes_sent: Option<u64>,
    #[serde(rename = "remoteAddress")]
    pub remote_address: Option<String>,
    #[serde(rename = "localAddress")]
    pub local_address: Option<String>,
    #[serde(rename = "durationSeconds")]
    pub duration_seconds: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    #[serde(rename = "darkMode")]
    pub dark_mode: bool,
    #[serde(rename = "windowWidth")]
    pub window_width: u32,
    #[serde(rename = "windowHeight")]
    pub window_height: u32,
    #[serde(rename = "windowX")]
    pub window_x: Option<i32>,
    #[serde(rename = "windowY")]
    pub window_y: Option<i32>,
    #[serde(rename = "autoRefreshSessions")]
    pub auto_refresh_sessions: bool,
    #[serde(rename = "refreshIntervalMs")]
    pub refresh_interval_ms: u32,
    #[serde(rename = "sidebarCollapsed")]
    pub sidebar_collapsed: bool,
    #[serde(rename = "profileSortBy")]
    pub profile_sort_by: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            dark_mode: true,
            window_width: 1100,
            window_height: 720,
            window_x: None,
            window_y: None,
            auto_refresh_sessions: true,
            refresh_interval_ms: 5000,
            sidebar_collapsed: false,
            profile_sort_by: "name".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProfileMeta {
    #[serde(rename = "configName")]
    pub config_name: Option<String>,
    pub tags: Vec<String>,
    pub notes: String,
    pub favorite: bool,
    #[serde(rename = "importedAt")]
    pub imported_at: String,
}

// ─── Helper: run shell command ────────────────────────────────────────────────

fn run_command(cmd: &str) -> CliResult {
    let extra_path = "/usr/bin:/usr/local/bin:/bin:/snap/bin";
    let path_env = std::env::var("PATH").unwrap_or_default();
    let full_path = format!("{}:{}", extra_path, path_env);

    let output = Command::new("sh")
        .arg("-c")
        .arg(cmd)
        .env("PATH", &full_path)
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            let exit_code = out.status.code().unwrap_or(1);
            CliResult {
                success: out.status.success(),
                stdout,
                stderr,
                exit_code,
            }
        }
        Err(e) => CliResult {
            success: false,
            stdout: String::new(),
            stderr: e.to_string(),
            exit_code: 1,
        },
    }
}

// ─── Helper: sanitize shell argument ─────────────────────────────────────────

fn sanitize(s: &str) -> String {
    s.replace(['`', '$', '\\', ';', '|', '&', '"'], "")
}

// ─── Helper: parse profiles JSON ─────────────────────────────────────────────

fn parse_profiles_json(raw: &str) -> Vec<VpnProfile> {
    if let Ok(obj) = serde_json::from_str::<serde_json::Value>(raw) {
        if let Some(map) = obj.as_object() {
            return map
                .iter()
                .filter_map(|(path, item)| {
                    Some(VpnProfile {
                        name: item["name"].as_str().unwrap_or("").to_string(),
                        path: path.clone(),
                        owner: item["acl"]["owner"].as_str().map(|s| s.to_string()),
                        locked: item["acl"]["locked_down"].as_bool(),
                        import_timestamp: item["imported_tstamp"]
                            .as_i64()
                            .map(|t| t.to_string()),
                        tags: None,
                        notes: None,
                    })
                })
                .collect();
        }
    }
    // Fallback: line-based parsing
    raw.lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty() && !l.starts_with("Config") && !l.starts_with("---"))
        .map(|name| VpnProfile {
            name: name.to_string(),
            path: name.to_string(),
            owner: None,
            locked: None,
            import_timestamp: None,
            tags: None,
            notes: None,
        })
        .collect()
}

// ─── Helper: parse sessions plain-text ───────────────────────────────────────

fn parse_sessions_text(raw: &str) -> Vec<VpnSession> {
    if raw.trim().is_empty() || raw.to_lowercase().contains("no sessions") {
        return vec![];
    }

    let mut sessions = Vec::new();
    // Split by lines of 10+ dashes
    let text = raw;
    let block_sep = regex_split_dashes(text);

    for block in block_sep {
        let block = block.trim();
        if block.is_empty() {
            continue;
        }

        let get = |pattern: &str| -> String {
            for line in block.lines() {
                let line = line.trim();
                if let Some(rest) = line.strip_prefix(pattern) {
                    return rest.trim_start_matches(':').trim().to_string();
                }
            }
            String::new()
        };

        let session_path = get("Path");
        if session_path.is_empty() {
            continue;
        }

        // "Created: Thu Jan  2 10:00:00 2025                  PID: 12345"
        let created_raw = get("Created");
        let created_at = if let Some(pos) = created_raw.to_uppercase().find("PID") {
            created_raw[..pos].trim().to_string()
        } else {
            created_raw.trim().to_string()
        };

        let status_raw = get("Status");
        let parts: Vec<&str> = status_raw.splitn(2, ',').map(|s| s.trim()).collect();
        let status = parts.get(1).copied().unwrap_or(parts.first().copied().unwrap_or("UNKNOWN")).to_string();
        let status_minor = if parts.len() > 1 {
            Some(parts[0].to_string())
        } else {
            None
        };

        sessions.push(VpnSession {
            session_path,
            config_name: get("Config name"),
            config_path: get("Config path"),
            status,
            status_minor,
            created_at: if created_at.is_empty() { None } else { Some(created_at) },
            connected_at: None,
            bytes_received: Some(0),
            bytes_sent: Some(0),
            remote_address: Some(String::new()),
            local_address: Some(String::new()),
            duration_seconds: Some(0),
        });
    }

    sessions
}

/// Split text into blocks separated by lines of 10+ dashes
fn regex_split_dashes(text: &str) -> Vec<String> {
    let mut blocks = Vec::new();
    let mut current = String::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.len() >= 10 && trimmed.chars().all(|c| c == '-') {
            if !current.trim().is_empty() {
                blocks.push(current.clone());
            }
            current.clear();
        } else {
            current.push_str(line);
            current.push('\n');
        }
    }
    if !current.trim().is_empty() {
        blocks.push(current);
    }
    blocks
}

// ─── Tauri Commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn check_openvpn3() -> OpenVPN3Available {
    let result = run_command("openvpn3 version");
    if result.success {
        let version = result
            .stdout
            .lines()
            .find(|l| l.to_lowercase().contains("openvpn"))
            .map(|l| l.trim().to_string());
        return OpenVPN3Available {
            available: true,
            version,
            path: Some("/usr/bin/openvpn3".to_string()),
        };
    }
    let which = run_command("which openvpn3");
    OpenVPN3Available {
        available: false,
        path: if which.success {
            Some(which.stdout.trim().to_string())
        } else {
            None
        },
        version: None,
    }
}

#[derive(Serialize)]
pub struct ListConfigsResult {
    profiles: Vec<VpnProfile>,
    error: Option<String>,
}

#[tauri::command]
pub async fn list_configs() -> ListConfigsResult {
    let result = run_command("openvpn3 configs-list --json");
    let profiles = parse_profiles_json(&result.stdout);
    ListConfigsResult {
        profiles,
        error: None,
    }
}

#[tauri::command]
pub async fn import_config(file_path: String) -> CliResult {
    if !file_path.ends_with(".ovpn") && !file_path.ends_with(".conf") {
        return CliResult {
            success: false,
            stdout: String::new(),
            stderr: "Invalid file path or not an .ovpn file".to_string(),
            exit_code: 1,
        };
    }
    let safe = sanitize(&file_path);
    run_command(&format!(
        r#"openvpn3 config-import --config "{safe}" --persistent"#
    ))
}

#[tauri::command]
pub async fn remove_config(config_path: String) -> CliResult {
    let safe = sanitize(&config_path);
    let cmd = format!(r#"echo "YES" | openvpn3 config-remove --config-path "{safe}""#);
    let result = run_command(&cmd);
    if !result.success && result.stderr.contains("confirm") {
        return run_command(&format!(r#"echo "yes" | {cmd}"#));
    }
    result
}

#[derive(Serialize)]
pub struct ListSessionsResult {
    sessions: Vec<VpnSession>,
    error: Option<String>,
}

#[tauri::command]
pub async fn list_sessions() -> ListSessionsResult {
    let result = run_command("openvpn3 sessions-list");
    if !result.success {
        return ListSessionsResult {
            sessions: vec![],
            error: Some(result.stderr),
        };
    }
    ListSessionsResult {
        sessions: parse_sessions_text(&result.stdout),
        error: None,
    }
}

#[tauri::command]
pub async fn start_session(config_path: String) -> CliResult {
    let safe = sanitize(&config_path);
    run_command(&format!(
        r#"openvpn3 session-start --config-path "{safe}""#
    ))
}

#[tauri::command]
pub async fn disconnect_session(session_path: String) -> CliResult {
    let safe = sanitize(&session_path);
    run_command(&format!(
        r#"openvpn3 session-manage --session-path "{safe}" --disconnect"#
    ))
}

#[tauri::command]
pub async fn get_session_stats(session_path: String) -> CliResult {
    let safe = sanitize(&session_path);
    run_command(&format!(
        r#"openvpn3 session-stats --session-path "{safe}" --json"#
    ))
}

// ─── Settings (via tauri-plugin-store) ───────────────────────────────────────

#[tauri::command]
pub async fn get_settings(app: AppHandle) -> AppSettings {
    crate::store::get_settings(&app)
}

#[tauri::command]
pub async fn set_settings(app: AppHandle, settings: serde_json::Value) -> Result<(), String> {
    crate::store::set_settings(&app, settings)
}

// ─── Profile meta ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_all_profile_meta(app: AppHandle) -> HashMap<String, ProfileMeta> {
    crate::store::get_all_profile_meta(&app)
}

#[tauri::command]
pub async fn set_profile_meta(
    app: AppHandle,
    config_path: String,
    meta: serde_json::Value,
) -> Result<(), String> {
    crate::store::set_profile_meta(&app, &config_path, meta)
}

#[tauri::command]
pub async fn remove_profile_meta(app: AppHandle, config_path: String) -> Result<(), String> {
    crate::store::remove_profile_meta(&app, &config_path)
}

// ─── File dialog ──────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn open_file_dialog(app: AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .add_filter("OpenVPN Config", &["ovpn", "conf"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });
    rx.recv()
        .ok()
        .flatten()
        .map(|p| p.to_string())
}
