# OpenVPN Manager — Tauri Edition

A desktop application for managing OpenVPN3 connections on Linux (Linux Mint / Ubuntu), rebuilt with **Tauri 2 + React + TypeScript + Vite**.

> **Tại sao Tauri?** Electron đóng gói cả Chromium + Node.js (~200 MB RAM idle). Tauri dùng WebKit2GTK của hệ thống và backend Rust nhẹ — idle chỉ ~30–50 MB RAM, file cài đặt nhỏ hơn ~10×.

---

## So sánh Electron vs Tauri

| | Electron | Tauri |
|---|---|---|
| RAM idle | ~200 MB | ~30–50 MB |
| Bundle size | ~80 MB | ~6–10 MB |
| Backend | Node.js | Rust |
| Renderer | Bundled Chromium | System WebKit2GTK |
| IPC | `ipcMain` / `contextBridge` | `invoke()` / Tauri commands |

---

## Prerequisites

### Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

### System deps (Ubuntu/Linux Mint)
```bash
sudo apt install libwebkit2gtk-4.1-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

### Node.js 22+
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 22 && nvm use 22
```

### OpenVPN3
```bash
sudo apt install apt-transport-https
curl -fsSL https://packages.openvpn.net/packages-repo.gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/openvpn.gpg
echo "deb [signed-by=/etc/apt/keyrings/openvpn.gpg] \
  https://packages.openvpn.net/openvpn3/debian \
  $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/openvpn3.list
sudo apt update && sudo apt install openvpn3
```

---

## Setup & Development

```bash
npm install
npm run tauri:dev     # Dev server với hot-reload
```

---

## Build & Packaging

```bash
npm run tauri:build             # Build tất cả targets
npm run tauri:build:deb         # Chỉ .deb
npm run tauri:build:appimage    # Chỉ .AppImage
```

Output: `src-tauri/target/release/bundle/`

---

## Cấu trúc dự án

```
openvpn3-gui-tauri/
├── src/                         # React + TypeScript (renderer)
│   ├── main.tsx                 # Entry point (thay index.tsx)
│   ├── App.tsx                  # Root component
│   ├── api.ts                   # ★ Tauri invoke() — thay window.electronAPI
│   ├── shared/
│   │   ├── types.ts             # TypeScript interfaces
│   │   └── utils.ts
│   ├── components/
│   │   ├── ProfileList.tsx
│   │   ├── SessionList.tsx
│   │   ├── Settings.tsx
│   │   ├── StatusBar.tsx
│   │   ├── ConfirmDialog.tsx
│   │   └── components/
│   │       ├── EditProfileMetaDialog/
│   │       └── ProfileConfig/
│   ├── hooks/
│   │   └── useToast.tsx
│   └── styles/
│       └── global.css
├── src-tauri/                   # Rust backend (thay src/main/)
│   ├── src/
│   │   ├── main.rs              # Entry
│   │   ├── lib.rs               # App setup + plugin registration
│   │   ├── commands.rs          # ★ Tauri commands — thay ipcHandlers.ts
│   │   └── store.rs             # ★ tauri-plugin-store — thay electron-store
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json          # ★ Thay electron-builder.json
├── index.html
├── vite.config.ts               # ★ Thay webpack.renderer.config.js
├── tsconfig.json                # ★ Gộp tsconfig.main + tsconfig.renderer
└── package.json
```

---

## Mapping: Electron → Tauri

| Electron | Tauri |
|---|---|
| `ipcMain.handle(channel, fn)` | `#[tauri::command] fn my_cmd()` + `generate_handler![]` |
| `window.electronAPI.foo()` | `import * as api from './api'` → `api.foo()` |
| `contextBridge` / `preload.ts` | Không cần — `invoke()` built-in |
| `electron-store` | `tauri-plugin-store` |
| `electron-log` | `println!` / `eprintln!` (hoặc `log` crate) |
| `dialog.showOpenDialog()` | `tauri-plugin-dialog` |
| `BrowserWindow` controls | `getCurrentWindow().minimize()` etc. |
| `frame: false` + drag | `data-tauri-drag-region` attribute |
| `webpack` | `vite` |
| `electron-builder` | `tauri build` |

---

## Data storage

Dữ liệu lưu tại: `~/.config/com.openvpn.manager/config.json`  
(tương đương `~/.config/openvpn-manager/config.json` của electron-store)

---

## Troubleshooting

**Build fails: `webkit2gtk-4.1` not found**
```bash
sudo apt install libwebkit2gtk-4.1-dev
```

**`openvpn3: command not found`**  
Xem hướng dẫn cài đặt trong Settings → OpenVPN3 Status.

**Permission denied on session-start**
```bash
sudo usermod -aG openvpn $USER && newgrp openvpn
```
