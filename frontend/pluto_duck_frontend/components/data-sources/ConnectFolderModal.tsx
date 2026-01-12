'use client';

import { useEffect, useState } from 'react';
import { FolderOpenIcon } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { createFolderSource } from '@/lib/sourceApi';
import { isTauriRuntime } from '@/lib/tauriRuntime';

interface ConnectFolderModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ConnectFolderModal({ projectId, open, onOpenChange, onSuccess }: ConnectFolderModalProps) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setPath('');
    setError(null);
    setSuccess(null);
    setIsSaving(false);
  }, [open]);

  const handlePickFolder = async () => {
    setError(null);
    if (!isTauriRuntime()) {
      const manual = window.prompt('Paste the absolute folder path:');
      if (manual) setPath(manual);
      return;
    }
    try {
      const selected = await openDialog({
        multiple: false,
        directory: true,
      });
      if (selected) {
        setPath(selected as string);
        if (!name.trim()) {
          const base = (selected as string).split('/').filter(Boolean).pop() || 'Folder';
          setName(base);
        }
      }
    } catch (e) {
      console.error('[ConnectFolderModal] Failed to open folder dialog', e);
      setError('Failed to open folder picker');
    }
  };

  const handleConnect = async () => {
    setError(null);
    setSuccess(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!path.trim()) {
      setError('Folder path is required');
      return;
    }

    setIsSaving(true);
    try {
      await createFolderSource(projectId, {
        name: name.trim(),
        path: path.trim(),
        allowed_types: 'both',
      });
      setSuccess('Folder connected');
      onSuccess?.();
      setTimeout(() => {
        onOpenChange(false);
      }, 600);
    } catch (e) {
      console.error('[ConnectFolderModal] Failed to connect folder', e);
      setError(e instanceof Error ? e.message : 'Failed to connect folder');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Connect folder</DialogTitle>
          <DialogDescription>
            Add a local folder as a Source. You can browse and import its files into Datasets from the Asset Library.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Folder</label>
            <div className="flex gap-2">
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                readOnly={isTauriRuntime()}
                placeholder={isTauriRuntime() ? 'Select a folder…' : 'Paste an absolute folder path…'}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={handlePickFolder} title="Pick folder">
                <FolderOpenIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. marketing_data" />
          </div>

          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          {success && <div className="rounded-md bg-primary/10 p-3 text-sm text-primary">{success}</div>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConnect} disabled={isSaving || !path.trim() || !name.trim()}>
            {isSaving ? 'Connecting…' : 'Connect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

