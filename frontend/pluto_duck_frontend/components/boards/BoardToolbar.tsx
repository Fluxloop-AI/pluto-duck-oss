'use client';

import { PlusIcon, SettingsIcon, TestTubeIcon } from 'lucide-react';
import type { Board } from '../../lib/boardsApi';

interface BoardToolbarProps {
  board: Board | null;
  onAddItem?: () => void;
  onSettings?: () => void;
  onTestEditor?: () => void;
}

export function BoardToolbar({ board, onAddItem, onSettings, onTestEditor }: BoardToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold">{board?.name || 'Select a board'}</h2>
        {board?.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{board.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onTestEditor && (
          <button
            onClick={onTestEditor}
            className="flex items-center gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-sm font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-500/20"
          >
            <TestTubeIcon className="h-4 w-4" />
            Test Editor
          </button>
        )}
        
        {onAddItem && (
          <button
            onClick={onAddItem}
            className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20"
          >
            <PlusIcon className="h-4 w-4" />
            Add Item
          </button>
        )}
        
        {onSettings && (
          <button
            onClick={onSettings}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card hover:bg-accent"
            title="Board settings"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

