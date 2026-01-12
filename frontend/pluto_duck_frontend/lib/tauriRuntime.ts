export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  // Tauri v2 exposes __TAURI_INTERNALS__ with transformCallback / invoke.
  return !!(w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.transformCallback === 'function');
}

