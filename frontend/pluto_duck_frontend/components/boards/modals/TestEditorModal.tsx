'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { MarkdownItem } from '../items/MarkdownItem';
import type { BoardItem } from '../../../lib/boardsApi';

interface TestEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TestEditorModal({ open, onOpenChange }: TestEditorModalProps) {
  // Create a dummy board item for testing
  const dummyItem: BoardItem = {
    id: 'test-item',
    board_id: 'test-board',
    item_type: 'markdown',
    title: 'Test Editor',
    position_x: 0,
    position_y: 0,
    width: 12,
    height: 8,
    payload: { content: {} },
    render_config: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Test Markdown Editor</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto p-4">
          <MarkdownItem item={dummyItem} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

