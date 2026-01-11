'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Database,
  Table2,
  Download,
  Loader2,
  Search,
  Clock,
  CheckCircle,
} from 'lucide-react';
import {
  fetchSourceTables,
  cacheTable,
  type Source,
  type SourceTable,
  type CacheTableRequest,
} from '@/lib/sourceApi';

interface SourceTableBrowserModalProps {
  projectId: string;
  source: Source | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCacheCreated?: () => void;
}

export function SourceTableBrowserModal({
  projectId,
  source,
  open,
  onOpenChange,
  onCacheCreated,
}: SourceTableBrowserModalProps) {
  const [tables, setTables] = useState<SourceTable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Caching state
  const [cachingTable, setCachingTable] = useState<string | null>(null);
  const [cacheSuccess, setCacheSuccess] = useState<string | null>(null);
  
  // Snapshot options modal
  const [showSnapshotOptions, setShowSnapshotOptions] = useState(false);
  const [selectedTable, setSelectedTable] = useState<SourceTable | null>(null);
  const [localName, setLocalName] = useState('');
  const [filterSql, setFilterSql] = useState('');
  const [expiresHours, setExpiresHours] = useState<number | ''>('');

  const loadTables = useCallback(async () => {
    if (!source) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await fetchSourceTables(projectId, source.name);
      setTables(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tables');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, source]);

  useEffect(() => {
    if (open && source) {
      loadTables();
      setCacheSuccess(null);
    }
  }, [open, source, loadTables]);

  const handleCreateSnapshot = (table: SourceTable) => {
    setSelectedTable(table);
    setLocalName(`${source?.name}_${table.table_name}_cache`);
    setFilterSql('');
    setExpiresHours('');
    setShowSnapshotOptions(true);
  };

  const handleConfirmSnapshot = async () => {
    if (!selectedTable || !source) return;
    
    setCachingTable(selectedTable.table_name);
    setShowSnapshotOptions(false);
    
    try {
      const request: CacheTableRequest = {
        source_name: source.name,
        table_name: selectedTable.table_name,
        local_name: localName || undefined,
        filter_sql: filterSql || undefined,
        expires_hours: expiresHours ? Number(expiresHours) : undefined,
      };
      
      await cacheTable(projectId, request);
      setCacheSuccess(selectedTable.table_name);
      
      // Refresh tables to update mode
      await loadTables();
      
      // Notify parent
      if (onCacheCreated) {
        onCacheCreated();
      }
      
      // Clear success after 3 seconds
      setTimeout(() => setCacheSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create snapshot');
    } finally {
      setCachingTable(null);
    }
  };

  const filteredTables = tables.filter((table) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      table.table_name.toLowerCase().includes(query) ||
      table.schema_name.toLowerCase().includes(query)
    );
  });

  if (!source) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {source.name}
            </DialogTitle>
            <DialogDescription>
              Browse tables and create snapshots for offline analysis
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Success */}
            {cacheSuccess && (
              <div className="mb-4 rounded-md bg-green-500/10 p-3 text-sm text-green-600 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Snapshot created for {cacheSuccess}
              </div>
            )}

            {/* Table List */}
            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTables.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Table2 className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No tables match your search' : 'No tables found'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTables.map((table) => (
                    <div
                      key={`${table.schema_name}.${table.table_name}`}
                      className="flex items-center justify-between rounded-lg border border-border bg-card p-3 hover:bg-muted/50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${
                          table.mode === 'cached' ? 'bg-blue-500/10' : 'bg-muted'
                        }`}>
                          <Table2 className={`h-4 w-4 ${
                            table.mode === 'cached' ? 'text-blue-500' : 'text-muted-foreground'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {table.schema_name !== 'public' && `${table.schema_name}.`}
                            {table.table_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {table.mode === 'cached' ? (
                              <span className="text-blue-500">● Cached as {table.local_table}</span>
                            ) : (
                              <span>Live query</span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {cachingTable === table.table_name ? (
                          <Button variant="outline" size="sm" disabled>
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            Creating...
                          </Button>
                        ) : table.mode === 'cached' ? (
                          <span className="text-xs text-muted-foreground px-2">
                            Already cached
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCreateSnapshot(table)}
                          >
                            <Download className="mr-1 h-3 w-3" />
                            Create Snapshot
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Snapshot Options Modal */}
      <Dialog open={showSnapshotOptions} onOpenChange={setShowSnapshotOptions}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Snapshot</DialogTitle>
            <DialogDescription>
              Configure snapshot settings for {selectedTable?.table_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Local Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Local Table Name</label>
              <Input
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                placeholder="my_cached_table"
              />
              <p className="text-xs text-muted-foreground">
                Name for the cached table in your local database
              </p>
            </div>

            {/* Filter SQL */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Filter (Optional)</label>
              <Input
                value={filterSql}
                onChange={(e) => setFilterSql(e.target.value)}
                placeholder="WHERE created_at > '2024-01-01'"
              />
              <p className="text-xs text-muted-foreground">
                SQL WHERE clause to filter data (without WHERE keyword)
              </p>
            </div>

            {/* Expiration */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Expiration (Optional)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={expiresHours}
                  onChange={(e) => setExpiresHours(e.target.value ? Number(e.target.value) : '')}
                  placeholder="24"
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty for permanent cache
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSnapshotOptions(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSnapshot}>
              Create Snapshot
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

