// src-tauri/src/store.rs
// Thay thế electron-store — lưu dữ liệu vào ~/.config/openvpn-manager/config.json

use crate::commands::{AppSettings, ProfileMeta};
use serde_json::Value;
use std::collections::HashMap;
use tauri::AppHandle;
use tauri_plugin_store::{Store, StoreExt};
use std::sync::Arc;

const STORE_PATH: &str = "config.json";

fn get_store(app: &AppHandle) -> Arc<Store<tauri::Wry>> {
    app.store(STORE_PATH).expect("failed to open store")
}

// ─── Settings ─────────────────────────────────────────────────────────────────

pub fn get_settings(app: &AppHandle) -> AppSettings {
    let store = get_store(app);
    if let Some(val) = store.get("settings") {
        if let Ok(s) = serde_json::from_value::<AppSettings>(val.clone()) {
            return s;
        }
    }
    AppSettings::default()
}

pub fn set_settings(app: &AppHandle, partial: Value) -> Result<(), String> {
    let store = get_store(app);
    let current = if let Some(val) = store.get("settings") {
        serde_json::from_value::<Value>(val.clone()).unwrap_or_default()
    } else {
        serde_json::to_value(AppSettings::default()).unwrap()
    };

    // Merge partial into current
    let mut merged = current.as_object().cloned().unwrap_or_default();
    if let Some(patch) = partial.as_object() {
        for (k, v) in patch {
            merged.insert(k.clone(), v.clone());
        }
    }

    store
        .set("settings", Value::Object(merged));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Profile meta ─────────────────────────────────────────────────────────────

pub fn get_config_id(config_path: &str) -> String {
    // Same logic as src/shared/utils.ts getConfigId
    config_path
        .replace(['/', '\\', '.', ' '], "_")
        .trim_matches('_')
        .to_string()
}

pub fn get_all_profile_meta(app: &AppHandle) -> HashMap<String, ProfileMeta> {
    let store = get_store(app);
    if let Some(val) = store.get("profileMeta") {
        if let Ok(m) = serde_json::from_value::<HashMap<String, ProfileMeta>>(val.clone()) {
            return m;
        }
    }
    HashMap::new()
}

pub fn set_profile_meta(
    app: &AppHandle,
    config_path: &str,
    meta_patch: Value,
) -> Result<(), String> {
    let store = get_store(app);
    let config_id = get_config_id(config_path);

    let mut all: HashMap<String, Value> = if let Some(val) = store.get("profileMeta") {
        serde_json::from_value(val.clone()).unwrap_or_default()
    } else {
        HashMap::new()
    };

    let old = all
        .get(&config_id)
        .cloned()
        .unwrap_or_else(|| {
            serde_json::json!({
                "configId": config_id,
                "tags": [],
                "notes": "",
                "favorite": false,
                "importedAt": chrono_now()
            })
        });

    let mut merged = old.as_object().cloned().unwrap_or_default();
    if let Some(patch) = meta_patch.as_object() {
        for (k, v) in patch {
            merged.insert(k.clone(), v.clone());
        }
    }

    all.insert(config_id, Value::Object(merged));
    store.set("profileMeta", serde_json::to_value(all).unwrap());
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn remove_profile_meta(app: &AppHandle, config_path: &str) -> Result<(), String> {
    let store = get_store(app);
    let config_id = get_config_id(config_path);

    let mut all: HashMap<String, Value> = if let Some(val) = store.get("profileMeta") {
        serde_json::from_value(val.clone()).unwrap_or_default()
    } else {
        HashMap::new()
    };

    all.remove(&config_id);
    store.set("profileMeta", serde_json::to_value(all).unwrap());
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

fn chrono_now() -> String {
    // Simple ISO timestamp without chrono dependency
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{}", secs)
}
