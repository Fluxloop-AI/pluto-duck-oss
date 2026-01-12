'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { importFile, listFileAssets } from '../../lib/fileAssetApi';
import { fetchCachedTables } from '@/lib/sourceApi';
import { listAnalyses } from '@/lib/assetsApi';
import { isTauriRuntime } from '@/lib/tauriRuntime';

interface ImportParquetModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess?: () => void;
  initialFilePath?: string;
}

export function ImportParquetModal({ 
  projectId, 
  open, 
  onOpenChange, 
  onImportSuccess,
  initialFilePath,
}: ImportParquetModalProps) {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [filePath, setFilePath] = useState('');
  const [tableName, setTableName] = useState('');
  const [description, setDescription] = useState('');
  const [reservedTableNames, setReservedTableNames] = useState<Set<string>>(new Set());
  const [tableNameTouched, setTableNameTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setError(null);
      setSuccessMessage(null);

      setNameTouched(false);
      setTableNameTouched(false);
      setName('');
      setTableName('');
      setDescription('');

      if (initialFilePath) {
        setFilePath(initialFilePath);
      } else {
        setFilePath('');
      }

      void (async () => {
        try {
          const [files, cached, analyses] = await Promise.all([
            listFileAssets(projectId),
            fetchCachedTables(projectId),
            listAnalyses({ projectId }),
          ]);
          const names = new Set<string>();
          files.forEach((f) => names.add(f.table_name));
          cached.forEach((c) => names.add(c.local_table));
          analyses.forEach((a) => names.add(a.result_table));
          setReservedTableNames(names);
        } catch (e) {
          console.warn('[ImportParquetModal] Failed to load reserved table names:', e);
          setReservedTableNames(new Set());
        }
      })();
    }
  }, [open, initialFilePath, projectId]);

  const baseFileName = useMemo(() => {
    if (!filePath) return '';
    const parts = filePath.split('/').filter(Boolean);
    const file = parts[parts.length - 1] || '';
    return file.replace(/\.parquet$/i, '');
  }, [filePath]);

  const toIdentifier = (raw: string) => {
    let s = raw.toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    s = s.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    if (s && /^[0-9]/.test(s)) s = `_${s}`;
    return s || 'unnamed';
  };

  const ensureUniqueTableName = (candidate: string) => {
    const base = toIdentifier(candidate);
    if (!reservedTableNames.has(base)) return base;
    let i = 2;
    while (reservedTableNames.has(`${base}_${i}`)) i += 1;
    return `${base}_${i}`;
  };

  useEffect(() => {
    if (!open) return;
    if (!filePath) return;

    if (!nameTouched) {
      setName(baseFileName || 'Parquet Dataset');
    }
    if (!tableNameTouched) {
      setTableName(ensureUniqueTableName(baseFileName || 'parquet_dataset'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filePath, baseFileName, reservedTableNames]);

  const handleImport = async () => {
    setError(null);
    setSuccessMessage(null);
    
    if (!filePath.trim()) {
      setError('File path is required');
      return;
    }
    
    if (!name.trim()) {
      setError('Display name is required');
      return;
    }
    if (!tableName.trim()) {
      setError('Table name is required');
      return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      setError('Table name must start with a letter or underscore and contain only letters, numbers, and underscores');
      return;
    }

    setImporting(true);
    
    try {
      const request = {
        file_path: filePath.trim(),
        file_type: 'parquet' as const,
        table_name: tableName.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        overwrite: false,
        mode: 'replace' as const,
      };

      const asset = await importFile(projectId, request);
      
      setSuccessMessage(`Successfully imported ${asset.row_count ?? 0} rows`);
      
      if (onImportSuccess) {
        onImportSuccess();
      }
      
      setTimeout(() => {
        onOpenChange(false);
        setSuccessMessage(null);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import Parquet');
    } finally {
      setImporting(false);
    }
  };

  const handleCancel = () => {
    setError(null);
    setSuccessMessage(null);
    onOpenChange(false);
  };

  const handleBrowse = async () => {
    if (!isTauriRuntime()) {
      const manual = window.prompt('Paste the absolute Parquet file path:');
      if (manual) setFilePath(manual);
      return;
    }
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [{
          name: 'Parquet Files',
          extensions: ['parquet']
        }]
      });
      
      if (selected) {
        setFilePath(selected as string);
      }
    } catch (err) {
      console.error('Failed to open file dialog:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Import Parquet File</DialogTitle>
          <DialogDescription>
            Create a new Dataset from a Parquet file
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* File Path */}
          <div className="grid gap-2">
            <label htmlFor="file-path" className="text-sm font-medium">
              File Path *
            </label>
            <div className="flex gap-2">
              <Input
                id="file-path"
                placeholder="Select a Parquet file…"
                value={filePath}
                readOnly={isTauriRuntime()}
                onChange={(e) => {
                  if (!isTauriRuntime()) setFilePath(e.target.value);
                }}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleBrowse}
                title="Browse files"
              >
                <FolderOpenIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-medium">
              Display Name *
            </label>
            <Input
              id="name"
              placeholder="Sales Data"
              value={name}
              onChange={(e) => {
                setNameTouched(true);
                setName(e.target.value);
              }}
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="table-name" className="text-sm font-medium">
              Table Name *
            </label>
            <Input
              id="table-name"
              placeholder="sales"
              value={tableName}
              onChange={(e) => {
                setTableNameTouched(true);
                setTableName(e.target.value);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Name for the DuckDB table
            </p>
          </div>

          <div className="grid gap-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description (optional)
            </label>
            <Input
              id="description"
              placeholder="Quarterly sales reports"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
              {successMessage}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={importing}>
            {importing ? 'Importing...' : 'Create Dataset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
