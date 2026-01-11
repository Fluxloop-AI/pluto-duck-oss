import { useState, useEffect, useCallback } from 'react';

// Lazy imports for Tauri plugins (only available in Tauri environment)
let check: typeof import('@tauri-apps/plugin-updater').check | null = null;
let relaunch: typeof import('@tauri-apps/plugin-process').relaunch | null = null;
let listen: typeof import('@tauri-apps/api/event').listen | null = null;
let getVersion: typeof import('@tauri-apps/api/app').getVersion | null = null;

const AUTO_DOWNLOAD_KEY = 'pluto-duck-auto-download';

// Initialize Tauri imports
async function initTauriImports() {
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    const [updaterModule, processModule, eventModule, appModule] = await Promise.all([
      import('@tauri-apps/plugin-updater'),
      import('@tauri-apps/plugin-process'),
      import('@tauri-apps/api/event'),
      import('@tauri-apps/api/app'),
    ]);
    check = updaterModule.check;
    relaunch = processModule.relaunch;
    listen = eventModule.listen;
    getVersion = appModule.getVersion;
    return true;
  }
  return false;
}

export interface UseAutoUpdateOptions {
  /** Enable update checking (default: true) */
  enabled?: boolean;
}

export interface UseAutoUpdateReturn {
  /** Current app version */
  currentVersion: string | null;
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
  /** Auto-download setting */
  autoDownload: boolean;
  /** Set auto-download preference */
  setAutoDownload: (value: boolean) => void;
  /** Manually trigger update download */
  downloadUpdate: () => Promise<void>;
  /** Manually check for updates */
  checkForUpdates: () => Promise<string | null>;
  /** Restart app to apply update */
  restart: () => Promise<void>;
  /** Dismiss update notification */
  dismiss: () => void;
}

export function useAutoUpdate({
  enabled = true,
}: UseAutoUpdateOptions = {}): UseAutoUpdateReturn {
  const [initialized, setInitialized] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
  const [readyToRestart, setReadyToRestart] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [autoDownload, setAutoDownloadState] = useState(true);

  // Load autoDownload preference from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(AUTO_DOWNLOAD_KEY);
      if (saved !== null) {
        setAutoDownloadState(saved === 'true');
      }
    }
  }, []);

  // Save autoDownload preference to localStorage
  const setAutoDownload = useCallback((value: boolean) => {
    setAutoDownloadState(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTO_DOWNLOAD_KEY, String(value));
    }
  }, []);

  // Initialize Tauri imports and get current version
  useEffect(() => {
    initTauriImports().then(async (success) => {
      setInitialized(success);
      if (success && getVersion) {
        try {
          const version = await getVersion();
          setCurrentVersion(version);
        } catch (e) {
          console.error('Failed to get app version:', e);
        }
      }
    });
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
  const checkForUpdates = useCallback(async (): Promise<string | null> => {
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
  const restart = useCallback(async () => {
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
    currentVersion,
    updateAvailable,
    readyToRestart,
    downloading,
    progress,
    error,
    autoDownload,
    setAutoDownload,
    downloadUpdate,
    checkForUpdates,
    restart,
    dismiss,
  };
}
