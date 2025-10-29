'use client';

import type { BoardItem } from '../../lib/boardsApi';
import { ItemCard } from './ItemCard';

interface BoardCanvasProps {
  items: BoardItem[];
  onItemUpdate?: (itemId: string, updates: any) => void;
  onItemDelete?: (itemId: string) => void;
  children?: (item: BoardItem) => React.ReactNode;
}

export function BoardCanvas({ items, onItemUpdate, onItemDelete, children }: BoardCanvasProps) {
  return (
    <div className="flex-1 overflow-auto p-6 bg-transparent">
      {items.length === 0 ? (
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
                  d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z"
                />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">No items yet</p>
            <p className="text-xs text-muted-foreground">Click "Add Item" to get started</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4 auto-rows-min">
          {items.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              onDelete={onItemDelete}
            >
              {children ? children(item) : <ItemPlaceholder item={item} />}
            </ItemCard>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemPlaceholder({ item }: { item: BoardItem }) {
  return (
    <div className="flex items-center justify-center py-8 text-muted-foreground">
      <div className="text-center">
        <p className="text-sm font-medium">{item.item_type}</p>
        <p className="text-xs">Item renderer not implemented</p>
      </div>
    </div>
  );
}

