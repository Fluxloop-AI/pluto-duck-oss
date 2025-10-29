'use client';

import { useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { useBoards } from '../../hooks/useBoards';
import { useBoardItems } from '../../hooks/useBoardItems';
import { BoardToolbar } from './BoardToolbar';
import { BoardCanvas } from './BoardCanvas';
import { AddItemModal } from './modals/AddItemModal';
import { TestEditorModal } from './modals/TestEditorModal';
import { MarkdownItem, ChartItem, TableItem, MetricItem, ImageItem } from './items';
import { Loader } from '../ai-elements';
import type { BoardItem, Board } from '../../lib/boardsApi';

interface BoardsViewProps {
  projectId: string;
  activeBoard: Board | null;
}

export function BoardsView({ projectId, activeBoard }: BoardsViewProps) {
  const {
    items,
    loading: itemsLoading,
    addItem,
    updateItem,
    deleteItem,
  } = useBoardItems({ boardId: activeBoard?.id });

  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showTestEditorModal, setShowTestEditorModal] = useState(false);

  const handleAddItem = () => {
    setShowAddItemModal(true);
  };

  const handleTestEditor = () => {
    setShowTestEditorModal(true);
  };

  const handleCreateItem = async (itemType: string, title?: string) => {
    if (!activeBoard) return;

    // Create default payload based on item type
    let payload: Record<string, any> = {};
    let width = 6; // Default width (half of 12 columns)

    switch (itemType) {
      case 'markdown':
        payload = { content: {} };
        width = 12; // Full width for markdown
        break;
      case 'chart':
      case 'table':
      case 'metric':
        // Will need query configuration - for now create placeholder
        payload = { query_id: null, note: 'Query configuration needed' };
        width = itemType === 'table' ? 12 : 6;
        break;
      case 'image':
        payload = { asset_id: null, note: 'Upload image needed' };
        width = 6;
        break;
    }

    await addItem({
      item_type: itemType,
      title: title || undefined,
      payload,
      width,
      height: 1,
    });
  };

  const handleSettings = () => {
    // TODO: Open board settings modal
    console.log('Settings clicked');
  };

  const renderItem = (item: BoardItem) => {
    switch (item.item_type) {
      case 'markdown':
        return <MarkdownItem item={item} onUpdate={updateItem} />;
      case 'chart':
        return <ChartItem item={item} projectId={projectId} />;
      case 'table':
        return <TableItem item={item} projectId={projectId} />;
      case 'metric':
        return <MetricItem item={item} projectId={projectId} />;
      case 'image':
        return <ImageItem item={item} />;
      default:
        return (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">Unknown item type: {item.item_type}</p>
          </div>
        );
    }
  };

  if (!activeBoard) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted">
            <svg
              className="h-6 w-6 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5z"
              />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">Select a board from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AddItemModal
        open={showAddItemModal}
        onOpenChange={setShowAddItemModal}
        onSubmit={handleCreateItem}
      />
      
      <TestEditorModal
        open={showTestEditorModal}
        onOpenChange={setShowTestEditorModal}
      />

      <div className="flex h-full flex-col">
        <BoardToolbar
          board={activeBoard}
          onAddItem={handleAddItem}
          onSettings={handleSettings}
          onTestEditor={handleTestEditor}
        />

        <BoardCanvas
          items={items}
          onItemUpdate={updateItem}
          onItemDelete={deleteItem}
        >
          {renderItem}
        </BoardCanvas>
      </div>
    </>
  );
}

