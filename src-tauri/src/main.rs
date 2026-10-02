// Keep the desktop binary a thin entry point over the shared library.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    gwaymaegyi_chess_lib::run();
}
