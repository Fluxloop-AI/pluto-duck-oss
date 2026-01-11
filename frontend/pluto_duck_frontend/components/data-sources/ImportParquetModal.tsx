'use client';

import { useState, useEffect } from 'react';
import { FolderOpenIcon, Plus, Layers } from 'lucide-react';
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
import { importFile, listFileAssets, type FileAsset, type ImportMode } from '../../lib/fileAssetApi';

interface ImportParquetModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess?: () => void;
  preselectedTable?: string;
}

export function ImportParquetModal({ 
  projectId, 
  open, 
  onOpenChange, 
  onImportSuccess,
  preselectedTable,
}: ImportParquetModalProps) {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [filePath, setFilePath] = useState('');
  const [tableName, setTableName] = useState('');
  const [description, setDescription] = useState('');
  
  // Mode state
  const [importType, setImportType] = useState<'new' | 'existing'>('new');
  const [mode, setMode] = useState<ImportMode>('replace');
  const [targetTable, setTargetTable] = useState('');
  const [mergeKeys, setMergeKeys] = useState('');
  
  // Existing tables
  const [existingTables, setExistingTables] = useState<FileAsset[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);

  useEffect(() => {
    if (open) {
      loadExistingTables();
      
      if (preselectedTable) {
        setImportType('existing');
        setTargetTable(preselectedTable);
        setMode('append');
      }
    }
  }, [open, preselectedTable]);

  const loadExistingTables = async () => {
    setLoadingTables(true);
    try {
      const tables = await listFileAssets(projectId);
      setExistingTables(tables);
    } catch (err) {
      console.error('Failed to load existing tables:', err);
    } finally {
      setLoadingTables(false);
    }
  };

  const handleImport = async () => {
    setError(null);
    setSuccessMessage(null);
    
    if (!filePath.trim()) {
      setError('File path is required');
      return;
    }
    
    if (importType === 'new') {
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
    } else {
      if (!targetTable) {
        setError('Please select a target table');
        return;
      }
      if (mode === 'merge' && !mergeKeys.trim()) {
        setError('Merge keys are required for merge mode');
        return;
      }
    }

    setImporting(true);
    
    try {
      const request = {
        file_path: filePath.trim(),
        file_type: 'parquet' as const,
        table_name: importType === 'new' ? tableName.trim() : targetTable,
        name: importType === 'new' ? name.trim() : undefined,
        description: importType === 'new' ? description.trim() || undefined : undefined,
        mode: importType === 'new' ? 'replace' as const : mode,
        target_table: importType === 'existing' ? targetTable : undefined,
        merge_keys: mode === 'merge' ? mergeKeys.split(',').map(k => k.trim()).filter(Boolean) : undefined,
      };

      const asset = await importFile(projectId, request);
      
      const modeLabel = importType === 'new' ? 'imported' : mode === 'append' ? 'appended' : 'merged';
      setSuccessMessage(`Successfully ${modeLabel} ${asset.row_count ?? 0} rows`);
      
      resetForm();
      
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

  const resetForm = () => {
    setName('');
    setFilePath('');
    setTableName('');
    setDescription('');
    setImportType('new');
    setMode('replace');
    setTargetTable('');
    setMergeKeys('');
  };

  const handleCancel = () => {
    setError(null);
    setSuccessMessage(null);
    resetForm();
    onOpenChange(false);
  };

  const handleNameChange = (value: string) => {
    setName(value);
    const prefix = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    setTableName(prefix);
  };

  const handleBrowse = async () => {
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
            Create a new table or add data to an existing table
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Import Type Selection */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">Import Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setImportType('new')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors ${
                  importType === 'new'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <Plus className="h-4 w-4" />
                Create new table
              </button>
              <button
                type="button"
                onClick={() => setImportType('existing')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors ${
                  importType === 'existing'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <Layers className="h-4 w-4" />
                Add to existing table
              </button>
            </div>
          </div>

          {/* File Path */}
          <div className="grid gap-2">
            <label htmlFor="file-path" className="text-sm font-medium">
              File Path *
            </label>
            <div className="flex gap-2">
              <Input
                id="file-path"
                placeholder="/Users/username/data/sales.parquet"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
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

          {importType === 'new' ? (
            <>
              <div className="grid gap-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Display Name *
                </label>
                <Input
                  id="name"
                  placeholder="Sales Data"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
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
              onChange={(e) => setTableName(e.target.value)}
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
            </>
          ) : (
            <>
              <div className="grid gap-2">
                <label htmlFor="target-table" className="text-sm font-medium">
                  Target Table *
            </label>
                <select
                  id="target-table"
                  value={targetTable}
                  onChange={(e) => setTargetTable(e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">Select a table...</option>
                  {existingTables.map((table) => (
                    <option key={table.id} value={table.table_name}>
                      {table.name} ({table.table_name}) - {table.row_count?.toLocaleString()} rows
                    </option>
                  ))}
                </select>
                {loadingTables && (
                  <p className="text-xs text-muted-foreground">Loading tables...</p>
                )}
                {!loadingTables && existingTables.length === 0 && (
                  <p className="text-xs text-muted-foreground">No existing tables found. Create a new table first.</p>
                )}
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Mode</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('append')}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      mode === 'append'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    Append
                    <span className="block text-xs font-normal text-muted-foreground">Add rows</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('merge')}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      mode === 'merge'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    Merge
                    <span className="block text-xs font-normal text-muted-foreground">Upsert by key</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('replace')}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      mode === 'replace'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    Replace
                    <span className="block text-xs font-normal text-muted-foreground">Overwrite all</span>
                  </button>
                </div>
          </div>

              {mode === 'merge' && (
                <div className="grid gap-2">
                  <label htmlFor="merge-keys" className="text-sm font-medium">
                    Merge Keys *
                  </label>
                  <Input
                    id="merge-keys"
                    placeholder="id, email"
                    value={mergeKeys}
                    onChange={(e) => setMergeKeys(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Column names separated by commas. Rows with matching keys will be updated.
                  </p>
                </div>
              )}
            </>
          )}

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
            {importing ? 'Importing...' : importType === 'new' ? 'Create Table' : `${mode.charAt(0).toUpperCase() + mode.slice(1)} Data`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
