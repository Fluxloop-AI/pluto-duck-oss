'use client';

import { PlusIcon, XIcon } from 'lucide-react';
import type { Board } from '../../lib/boardsApi';

interface BoardTabsProps {
  boards: Board[];
  activeId?: string;
  onSelect: (board: Board) => void;
  onNew: () => void;
  onDelete?: (board: Board) => void;
}

export function BoardTabs({ boards, activeId, onSelect, onNew, onDelete }: BoardTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border bg-muted/20 px-4">
      {boards.map(board => (
        <button
          key={board.id}
          onClick={() => onSelect(board)}
          className={`
            group relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors
            ${
              activeId === board.id
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }
          `}
        >
          <span>{board.name}</span>
          {onDelete && boards.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(board);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
            >
              <XIcon className="h-3 w-3" />
            </button>
          )}
        </button>
      ))}
      
      <button
        onClick={onNew}
        className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        title="New board"
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

