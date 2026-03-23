// src-tauri/src/lib.rs
mod commands;
mod store;

use tauri::menu::Menu;
use tauri::tray::TrayIconBuilder;
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
            // // Tạo menu rỗng (bắt buộc trên Linux)
            // let menu = Menu::new(app)?;

            // // Nhúng file icon vào binary (đường dẫn tính từ file lib.rs)
            // let icon_bytes = include_bytes!("../icons/icon.png");

            // // Giải mã PNG thành RGBA
            // let img = image::load_from_memory(icon_bytes).expect("Không thể giải mã icon");
            // let rgba = img.to_rgba8();
            // let (width, height) = rgba.dimensions();

            // // Tạo Image của Tauri từ dữ liệu RGBA
            // let icon = tauri::image::Image::new_owned(rgba.into_raw(), width, height);

            // // Tạo tray icon
            // let _tray = TrayIconBuilder::new().icon(icon).menu(&menu).build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
