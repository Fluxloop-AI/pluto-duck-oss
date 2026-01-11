'use client';

import {
  Database,
  FileSpreadsheet,
  FileArchive,
  MoreVertical,
  Eye,
  Trash2,
  RefreshCw,
  Rows,
  Clock,
  ExternalLink,
  Plus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { CachedTable } from '@/lib/sourceApi';
import type { FileAsset } from '@/lib/fileAssetApi';

// Unified table type for display
export type TableItem = 
  | { type: 'database'; data: CachedTable }
  | { type: 'file'; data: FileAsset };

interface TableCardProps {
  item: TableItem;
  onView: (item: TableItem) => void;
  onRefresh: (item: TableItem) => void;
  onDelete: (item: TableItem) => void;
  onAddData?: (item: TableItem) => void; // Only for file-based tables
}

export function TableCard({
  item,
  onView,
  onRefresh,
  onDelete,
  onAddData,
}: TableCardProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
  };

  // Extract common display properties
  const isDatabase = item.type === 'database';
  const data = item.data;
  
  const tableName = isDatabase 
    ? (data as CachedTable).local_table 
    : (data as FileAsset).table_name;
  
  const displayName = isDatabase 
    ? (data as CachedTable).local_table 
    : (data as FileAsset).name;
  
  const rowCount = isDatabase 
    ? (data as CachedTable).row_count 
    : (data as FileAsset).row_count;
  
  const createdAt = isDatabase 
    ? (data as CachedTable).cached_at 
    : (data as FileAsset).created_at;

  const sourceInfo = isDatabase
    ? `${(data as CachedTable).source_name}.${(data as CachedTable).source_table}`
    : (data as FileAsset).file_path;

  const expiresAt = isDatabase ? (data as CachedTable).expires_at : null;

  // Icon based on type
  const TypeIcon = isDatabase 
    ? Database 
    : (data as FileAsset).file_type === 'csv' 
      ? FileSpreadsheet 
      : FileArchive;

  const iconBgColor = isDatabase ? 'bg-blue-500/10' : 'bg-primary/10';
  const iconColor = isDatabase ? 'text-blue-500' : 'text-primary';
  const typeBadge = isDatabase 
    ? 'FROM DB' 
    : (data as FileAsset).file_type.toUpperCase();
  const typeBadgeColor = isDatabase 
    ? 'bg-blue-500/10 text-blue-600' 
    : 'bg-primary/10 text-primary';

  return (
    <div className="group relative flex flex-col rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md min-w-[280px] w-full h-[180px] overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`flex h-8 w-8 items-center justify-center rounded-md ${iconBgColor} flex-shrink-0`}>
            <TypeIcon className={`h-4 w-4 ${iconColor}`} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-foreground truncate" title={displayName}>
              {displayName}
            </h3>
            <p className="text-xs text-muted-foreground font-mono truncate" title={tableName}>
              {tableName}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRefresh(item)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {isDatabase ? 'Refresh Snapshot' : 'Re-import'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(item)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Source Info */}
      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        <ExternalLink className="h-3 w-3 flex-shrink-0" />
        <span className="truncate" title={sourceInfo}>{sourceInfo}</span>
      </div>

      {/* Type Badge */}
      <div className="mt-2 flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs uppercase ${typeBadgeColor}`}>
          {typeBadge}
        </span>
        {expiresAt && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
            <Clock className="h-3 w-3" />
            Expires {formatDate(expiresAt)}
          </span>
        )}
      </div>

      {/* Stats Row */}
      <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground py-2 border-t border-border/50">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1" title="Rows">
            <Rows className="h-3 w-3" />
            {formatNumber(rowCount)}
          </span>
        </div>
        <span>{formatDate(createdAt)}</span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onView(item)}
          className={`flex items-center justify-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 ${
            isDatabase || !onAddData ? 'flex-1' : ''
          }`}
        >
          <Eye className="h-3 w-3" />
          {(isDatabase || !onAddData) && <span>Preview</span>}
        </button>
        {/* Add Data button - only for file-based tables */}
        {!isDatabase && onAddData && (
          <button
            onClick={() => onAddData(item)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            title="Add more data to this table"
          >
            <Plus className="h-3 w-3" />
            Add data from file
          </button>
        )}
        <button
          onClick={() => onRefresh(item)}
          className="flex items-center justify-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

