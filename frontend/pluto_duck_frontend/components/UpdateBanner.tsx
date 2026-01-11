'use client';

import { X, Download, RefreshCw } from 'lucide-react';
import { useAutoUpdate } from '../hooks/useAutoUpdate';
import { Button } from './ui/button';

/**
 * Update Banner Component
 * 
 * Shows a dismissible banner when:
 * 1. Update is ready to install (restart required)
 * 2. Update is available but not yet downloaded (if auto-download is off)
 * 
 * Positioned at the top of the app, below the header.
 */
export function UpdateBanner() {
  const {
    updateAvailable,
    readyToRestart,
    downloading,
    progress,
    autoDownload,
    downloadUpdate,
    restart,
    dismiss,
  } = useAutoUpdate();

  // Don't show if no update or if downloading with auto-download on
  if (!updateAvailable && !readyToRestart) return null;
  if (downloading && autoDownload) return null;

  // Ready to restart - high priority banner
  if (readyToRestart) {
    return (
      <div className="bg-gradient-to-r from-emerald-500/90 to-green-600/90 text-white px-4 py-2.5 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-4 w-4" />
          <span className="text-sm font-medium">
            Update ready! Restart to apply the latest version.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
            onClick={dismiss}
          >
            Later
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-white text-emerald-700 hover:bg-white/90"
            onClick={restart}
          >
            Restart Now
          </Button>
        </div>
      </div>
    );
  }

  // Downloading in progress
  if (downloading) {
    return (
      <div className="bg-blue-500/90 text-white px-4 py-2.5 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Download className="h-4 w-4 animate-bounce" />
          <span className="text-sm font-medium">
            Downloading update... {progress}%
          </span>
        </div>
        <div className="w-32 h-1.5 bg-white/30 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // Update available but not auto-downloading
  if (updateAvailable && !autoDownload) {
    return (
      <div className="bg-amber-500/90 text-white px-4 py-2.5 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Download className="h-4 w-4" />
          <span className="text-sm font-medium">
            Version {updateAvailable} is available
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
            onClick={dismiss}
          >
            <X className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-white text-amber-700 hover:bg-white/90"
            onClick={downloadUpdate}
          >
            Download
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
