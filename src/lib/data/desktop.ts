// Detect the Tauri desktop shell and read its identity without touching the web build.
export interface DesktopHost {
  shell: string;
  version: string;
  storage: string;
}

/** True only when the page is rendered inside the Tauri desktop shell. */
export function desktopHosted(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Ask the shell for its version and storage wording. The Tauri API is imported
 * lazily so the website build never loads desktop code, and any failure simply
 * leaves the browser wording in place.
 */
export async function readDesktopHost(): Promise<DesktopHost | null> {
  if (!desktopHosted()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const info = await invoke<Partial<DesktopHost>>('desktop_info');
    return {
      shell: typeof info.shell === 'string' ? info.shell : 'tauri',
      version: typeof info.version === 'string' ? info.version : '',
      storage: typeof info.storage === 'string' ? info.storage : '',
    };
  } catch {
    return null;
  }
}
