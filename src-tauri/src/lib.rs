// src-tauri/src/lib.rs
mod commands;
mod store;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::check_openvpn3,
            commands::list_configs,
            commands::import_config,
            commands::remove_config,
            commands::list_sessions,
            commands::start_session,
            commands::disconnect_session,
            commands::get_session_stats,
            commands::get_settings,
            commands::set_settings,
            commands::get_all_profile_meta,
            commands::set_profile_meta,
            commands::remove_profile_meta,
            commands::open_file_dialog,
        ])
        .setup(|app| {
            // Initialize store on startup
            let store = tauri_plugin_store::StoreBuilder::new(app, "config.json").build()?;
            app.manage(std::sync::Mutex::new(store));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
