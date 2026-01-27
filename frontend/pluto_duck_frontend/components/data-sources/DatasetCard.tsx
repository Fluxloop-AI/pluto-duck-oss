'use client';

import { Pencil, FileSpreadsheet } from 'lucide-react';
import { StatusBadge, type DatasetStatus } from './StatusBadge';

export interface Dataset {
  id: number;
  name: string;
  status: DatasetStatus;
  description: string;
  files: string[];
}

interface DatasetCardProps {
  dataset: Dataset;
  isEditing: boolean;
  editName: string;
  onStartEdit: (id: number, name: string) => void;
  onSaveEdit: (id: number) => void;
  onEditNameChange: (name: string) => void;
}

export function DatasetCard({
  dataset,
  isEditing,
  editName,
  onStartEdit,
  onSaveEdit,
  onEditNameChange,
}: DatasetCardProps) {
  return (
    <div className="border border-border rounded-xl overflow-hidden p-4 transition-all hover:shadow-sm hover:border-muted-foreground/30">
      <StatusBadge status={dataset.status} />

      <div className="mt-3 mb-2 flex items-center gap-2">
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onBlur={() => onSaveEdit(dataset.id)}
            onKeyDown={(e) => e.key === 'Enter' && onSaveEdit(dataset.id)}
            className="text-lg font-semibold text-foreground bg-muted rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        ) : (
          <>
            <h3 className="text-lg font-semibold text-foreground">{dataset.name}</h3>
            <button
              onClick={() => onStartEdit(dataset.id, dataset.name)}
              className="p-1.5 hover:bg-muted rounded-lg transition-colors"
            >
              <Pencil className="w-4 h-4 text-muted-foreground" />
            </button>
          </>
        )}
      </div>

      {dataset.description && (
        <p className="text-muted-foreground text-sm leading-relaxed mb-4">
          {dataset.description}
        </p>
      )}

      <div className="space-y-2">
        {dataset.files.map((file, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2.5 bg-muted rounded-lg px-3 py-2 border border-border"
          >
            <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground text-sm font-medium">{file}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
