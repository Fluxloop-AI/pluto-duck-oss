'use client';

import type { Board } from '../../../lib/boardsApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { LayoutDashboard } from 'lucide-react';

interface BoardSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boards: Board[];
  onSelect: (boardId: string) => void;
}

export function BoardSelectorModal({
  open,
  onOpenChange,
  boards,
  onSelect,
}: BoardSelectorModalProps) {
  const handleSelect = (boardId: string) => {
    onSelect(boardId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select a Board</DialogTitle>
          <DialogDescription>
            Choose a board to send the content to
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {boards.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <LayoutDashboard className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No boards available</p>
              <p className="text-xs mt-1">Create a board first to send content</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {boards.map((board) => (
                <li key={board.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(board.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors text-left"
                  >
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{board.name}</p>
                      {board.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {board.description}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
