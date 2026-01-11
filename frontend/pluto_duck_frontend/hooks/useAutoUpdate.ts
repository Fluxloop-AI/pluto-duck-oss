import { useState, useEffect, useCallback } from 'react';

// Lazy imports for Tauri plugins (only available in Tauri environment)
let check: typeof import('@tauri-apps/plugin-updater').check | null = null;
let relaunch: typeof import('@tauri-apps/plugin-process').relaunch | null = null;
let listen: typeof import('@tauri-apps/api/event').listen | null = null;

// Initialize Tauri imports
async function initTauriImports() {
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    const [updaterModule, processModule, eventModule] = await Promise.all([
      import('@tauri-apps/plugin-updater'),
      import('@tauri-apps/plugin-process'),
      import('@tauri-apps/api/event'),
    ]);
    check = updaterModule.check;
    relaunch = processModule.relaunch;
    listen = eventModule.listen;
    return true;
  }
  return false;
}

export interface UseAutoUpdateOptions {
  /** Auto-download updates when available (default: true) */
  autoDownload?: boolean;
  /** Enable update checking (default: true) */
  enabled?: boolean;
}

export interface UseAutoUpdateReturn {
  /** New version available (null if none) */
  updateAvailable: string | null;
  /** Update has been downloaded and is ready to install */
  readyToRestart: boolean;
  /** Currently downloading update */
  downloading: boolean;
  /** Download progress (0-100) */
  progress: number;
  /** Error message if update check/download failed */
  error: string | null;
  /** Manually trigger update download */
  downloadUpdate: () => Promise<void>;
  /** Manually check for updates */
  checkNow: () => Promise<string | null>;
  /** Restart app to apply update */
  restartApp: () => Promise<void>;
  /** Dismiss update notification */
  dismiss: () => void;
}

export function useAutoUpdate({
  autoDownload = true,
  enabled = true,
}: UseAutoUpdateOptions = {}): UseAutoUpdateReturn {
  const [initialized, setInitialized] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
  const [readyToRestart, setReadyToRestart] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Initialize Tauri imports
  useEffect(() => {
    initTauriImports().then(setInitialized);
  }, []);

  // Download update
  const downloadUpdate = useCallback(async () => {
    if (!check) {
      setError('Update check not available');
      return;
    }

    try {
      setDownloading(true);
      setError(null);
      setProgress(0);

      const update = await check();
      if (update?.available) {
        // Simple progress indicator (indeterminate since we don't have total size)
        setProgress(10);
        await update.downloadAndInstall((event) => {
          if (event.event === 'Progress') {
            // Increment progress gradually
            setProgress((prev) => Math.min(prev + 5, 95));
          } else if (event.event === 'Finished') {
            setProgress(100);
          }
        });
        setReadyToRestart(true);
      }
    } catch (e) {
      console.error('Update download failed:', e);
      setError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }, []);

  // Manual check for updates
  const checkNow = useCallback(async (): Promise<string | null> => {
    if (!check) {
      setError('Update check not available');
      return null;
    }

    try {
      setError(null);
      const update = await check();
      if (update?.available) {
        setUpdateAvailable(update.version);
        return update.version;
      }
      return null;
    } catch (e) {
      console.error('Update check failed:', e);
      setError(e instanceof Error ? e.message : 'Check failed');
      return null;
    }
  }, []);

  // Restart app
  const restartApp = useCallback(async () => {
    if (relaunch) {
      await relaunch();
    }
  }, []);

  // Dismiss update notification
  const dismiss = useCallback(() => {
    setUpdateAvailable(null);
    setReadyToRestart(false);
    setProgress(0);
    setError(null);
  }, []);

  // Listen for update-available events from Rust backend
  useEffect(() => {
    if (!initialized || !enabled || !listen) return;

    const listenFn = listen; // Capture non-null reference
    
    const setupListener = async () => {
      const unlisten = await listenFn<string>('update-available', async (event) => {
        const version = event.payload;
        console.log(`Update available: ${version}`);
        setUpdateAvailable(version);

        if (autoDownload && !downloading && !readyToRestart) {
          await downloadUpdate();
        }
      });

      return unlisten;
    };

    const unlistenPromise = setupListener();

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [initialized, enabled, autoDownload, downloading, readyToRestart, downloadUpdate]);

  return {
    updateAvailable,
    readyToRestart,
    downloading,
    progress,
    error,
    downloadUpdate,
    checkNow,
    restartApp,
    dismiss,
  };
}
