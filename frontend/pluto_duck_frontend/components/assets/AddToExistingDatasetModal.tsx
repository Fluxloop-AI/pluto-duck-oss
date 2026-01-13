'use client';

import { useEffect, useMemo, useState } from 'react';
import { Layers } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { importFile, listFileAssets, type FileAsset } from '@/lib/fileAssetApi';
import type { FolderFile } from '@/lib/sourceApi';

type Mode = 'append' | 'replace';

interface AddToExistingDatasetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sourceFile: FolderFile | null;
  onSuccess?: () => void;
}

export function AddToExistingDatasetModal({
  open,
  onOpenChange,
  projectId,
  sourceFile,
  onSuccess,
}: AddToExistingDatasetModalProps) {
  const [datasets, setDatasets] = useState<FileAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [targetId, setTargetId] = useState<string>('');
  const [mode, setMode] = useState<Mode>('append');
  const [skipExactDuplicates, setSkipExactDuplicates] = useState(true);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSearch('');
    setTargetId('');
    setMode('append');
    setSkipExactDuplicates(true);
    setIsSubmitting(false);

    void (async () => {
      setIsLoading(true);
      try {
        const items = await listFileAssets(projectId);
        setDatasets(items);
      } catch (e) {
        console.error('[AddToExistingDatasetModal] Failed to load datasets', e);
        setDatasets([]);
        setError(e instanceof Error ? e.message : 'Failed to load datasets');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [open, projectId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return datasets;
    return datasets.filter((d) => {
      return (
        d.name.toLowerCase().includes(q) ||
        d.table_name.toLowerCase().includes(q) ||
        d.file_path.toLowerCase().includes(q)
      );
    });
  }, [datasets, search]);

  const selected = useMemo(() => datasets.find((d) => d.id === targetId) || null, [datasets, targetId]);

  const canSubmit = !!sourceFile && !!selected && !isSubmitting;

  const handleSubmit = async () => {
    if (!sourceFile || !selected) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await importFile(projectId, {
        file_path: sourceFile.path,
        file_type: sourceFile.file_type,
        // When adding to an existing dataset, we operate on the existing table_name.
        table_name: selected.table_name,
        name: selected.name,
        description: selected.description ?? undefined,
        mode,
        target_table: mode === 'append' ? selected.table_name : undefined,
        overwrite: mode === 'replace',
        deduplicate: mode === 'append' ? skipExactDuplicates : false,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (e) {
      console.error('[AddToExistingDatasetModal] Failed', e);
      setError(e instanceof Error ? e.message : 'Failed to add data');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Add to existing Dataset
          </DialogTitle>
          <DialogDescription>
            {sourceFile ? (
              <>
                Source file: <span className="font-mono">{sourceFile.name}</span>
              </>
            ) : (
              'Choose a target Dataset and how to apply this file.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Target Dataset</label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search datasets…" />

            <div className="max-h-56 overflow-auto rounded-md border border-border">
              {isLoading ? (
                <div className="p-3 text-sm text-muted-foreground">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No datasets found.</div>
              ) : (
                filtered.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setTargetId(d.id)}
                    className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted ${
                      targetId === d.id ? 'bg-primary/10' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{d.name}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate">{d.table_name}</div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {d.row_count?.toLocaleString?.() ?? '-'} rows
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Mode</label>
            <div className="flex gap-2">
              <Button type="button" variant={mode === 'append' ? 'default' : 'outline'} onClick={() => setMode('append')}>
                Append
              </Button>
              <Button type="button" variant={mode === 'replace' ? 'default' : 'outline'} onClick={() => setMode('replace')}>
                Replace
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Append requires matching columns. Replace overwrites the dataset table.
            </p>
          </div>

          {mode === 'append' && (
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3">
              <input
                id="dedup-exact"
                type="checkbox"
                className="mt-0.5"
                checked={skipExactDuplicates}
                onChange={(e) => setSkipExactDuplicates(e.target.checked)}
              />
              <label htmlFor="dedup-exact" className="text-sm">
                Skip exact duplicates (same values across all columns)
                <div className="text-xs text-muted-foreground">
                  Useful when date ranges overlap and the same rows may be re-imported.
                </div>
              </label>
            </div>
          )}

          {selected && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              Target: <span className="font-mono">{selected.table_name}</span>
            </div>
          )}

          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? 'Applying…' : mode === 'append' ? 'Append data' : 'Replace dataset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

