// Host the shared web build in a native window and expose shell facts to it.
mod info;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![info::desktop_info])
        .run(tauri::generate_context!())
        .expect("failed to start the gwaymaegyi chess desktop shell");
}
