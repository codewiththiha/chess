// Report shell identity so the shared frontend can describe its host honestly.
use serde::Serialize;
use tauri::AppHandle;

#[derive(Serialize)]
pub struct DesktopInfo {
    shell: &'static str,
    version: String,
    storage: &'static str,
}

/// Answer one question: which host is rendering the same web interface?
#[tauri::command]
pub fn desktop_info(app: AppHandle) -> DesktopInfo {
    DesktopInfo {
        shell: "tauri",
        version: app.package_info().version.to_string(),
        storage: "SQLite WASM in the system webview (origin private file system)",
    }
}
