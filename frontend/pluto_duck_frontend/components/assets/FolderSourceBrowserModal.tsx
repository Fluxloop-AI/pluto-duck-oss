'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Folder, RefreshCw } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { listFolderFiles, type FolderFile, type FolderSource } from '@/lib/sourceApi';
import { AddToExistingDatasetModal } from './AddToExistingDatasetModal';

interface FolderSourceBrowserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  folderSource: FolderSource | null;
  onCreateDatasetFromFile: (file: FolderFile) => void;
  onDatasetsChanged?: () => void;
}

export function FolderSourceBrowserModal({
  open,
  onOpenChange,
  projectId,
  folderSource,
  onCreateDatasetFromFile,
  onDatasetsChanged,
}: FolderSourceBrowserModalProps) {
  const [files, setFiles] = useState<FolderFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [selectedAddFile, setSelectedAddFile] = useState<FolderFile | null>(null);

  const load = useCallback(async () => {
    if (!folderSource) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await listFolderFiles(projectId, folderSource.id, 1000);
      setFiles(data);
    } catch (e) {
      console.error('[FolderSourceBrowserModal] Failed to load files', e);
      setError(e instanceof Error ? e.message : 'Failed to load files');
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [folderSource, projectId]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return files;
    const q = search.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
  }, [files, search]);

  const formatBytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    const kb = n / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(1)} GB`;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setSearch('');
          setFiles([]);
          setError(null);
          setAddOpen(false);
          setSelectedAddFile(null);
        }
      }}
    >
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            {folderSource ? folderSource.name : 'Folder'}
          </DialogTitle>
          <DialogDescription>
            {folderSource ? folderSource.path : 'Browse files in a connected folder'}
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 border-b border-border flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files…"
            className="max-w-sm"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={isLoading || !folderSource}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Rescan
          </Button>
        </div>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground">No files found.</div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((f) => (
                    <div
                      key={f.path}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate" title={f.name}>
                          {f.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate" title={f.path}>
                          {f.file_type.toUpperCase()} • {formatBytes(f.size_bytes)} • {new Date(f.modified_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => {
                          setSelectedAddFile(f);
                          setAddOpen(true);
                        }}>
                          Add to existing
                        </Button>
                        <Button type="button" size="sm" onClick={() => onCreateDatasetFromFile(f)}>
                          Create Dataset
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <AddToExistingDatasetModal
          open={addOpen}
          onOpenChange={(v) => {
            setAddOpen(v);
            if (!v) setSelectedAddFile(null);
          }}
          projectId={projectId}
          sourceFile={selectedAddFile}
          onSuccess={() => {
            onDatasetsChanged?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

