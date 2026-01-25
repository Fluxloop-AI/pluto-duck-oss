'use client';

import { useState, useEffect } from 'react';
import { History, Pencil, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AssetTableView } from '../editor/components/AssetTableView';
import { previewFileData, type FileAsset, type FilePreview } from '../../lib/fileAssetApi';
import { fetchCachedTablePreview, type CachedTable, type CachedTablePreview } from '../../lib/sourceApi';

export type Dataset = FileAsset | CachedTable;

type DatasetTab = 'summary' | 'history' | 'table';

interface DatasetDetailViewProps {
  projectId: string;
  dataset: Dataset;
}

function isFileAsset(dataset: Dataset): dataset is FileAsset {
  return 'file_type' in dataset;
}

function getDatasetName(dataset: Dataset): string {
  if (isFileAsset(dataset)) {
    return dataset.name || dataset.table_name;
  }
  return dataset.local_table;
}

export function DatasetDetailView({
  projectId,
  dataset,
}: DatasetDetailViewProps) {
  const [activeTab, setActiveTab] = useState<DatasetTab>('summary');
  const [preview, setPreview] = useState<FilePreview | CachedTablePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load table preview data when dataset changes or tab becomes 'table'
  useEffect(() => {
    if (activeTab !== 'table') return;

    const loadPreview = async () => {
      setLoading(true);
      setError(null);
      try {
        if (isFileAsset(dataset)) {
          const data = await previewFileData(projectId, dataset.id);
          setPreview(data);
        } else {
          const data = await fetchCachedTablePreview(projectId, dataset.local_table);
          setPreview(data);
        }
      } catch (err) {
        console.error('Failed to load preview:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data preview');
      } finally {
        setLoading(false);
      }
    };

    void loadPreview();
  }, [projectId, dataset, activeTab]);

  const tabs: { id: DatasetTab; label: string }[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'history', label: 'History' },
    { id: 'table', label: 'Table' },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Tab Bar */}
      <div className="flex items-center bg-background pt-2">
        <div className="w-full max-w-4xl pl-6">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm transition-colors',
                  activeTab === tab.id
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-6 px-8">
        {activeTab === 'table' && (
          <TableTabContent
            preview={preview}
            loading={loading}
            error={error}
          />
        )}
        {activeTab === 'summary' && (
          <SummaryTabContent dataset={dataset} />
        )}
        {activeTab === 'history' && (
          <PlaceholderTabContent
            icon={<History className="h-8 w-8 text-muted-foreground" />}
            title="Coming soon"
            description="Change history and version tracking"
          />
        )}
      </div>
    </div>
  );
}

interface SummaryTabContentProps {
  dataset: Dataset;
}

function SummaryTabContent({ dataset }: SummaryTabContentProps) {
  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{getDatasetName(dataset)}</h2>
        <button
          type="button"
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          title="Rename dataset"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">6 Columns • 123 Rows</p>
    </div>
  );
}

interface TableTabContentProps {
  preview: FilePreview | CachedTablePreview | null;
  loading: boolean;
  error: string | null;
}

function TableTabContent({ preview, loading, error }: TableTabContentProps) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <AssetTableView
      columns={preview.columns}
      rows={preview.rows}
      totalRows={preview.total_rows ?? preview.rows.length}
      rowsPerPage={10}
    />
  );
}

interface PlaceholderTabContentProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function PlaceholderTabContent({ icon, title, description }: PlaceholderTabContentProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <div className="text-center">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
