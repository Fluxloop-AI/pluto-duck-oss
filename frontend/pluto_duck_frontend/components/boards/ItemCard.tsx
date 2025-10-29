'use client';

import { MoreVerticalIcon, TrashIcon } from 'lucide-react';
import { ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import type { BoardItem } from '../../lib/boardsApi';

interface ItemCardProps {
  item: BoardItem;
  children: ReactNode;
  onDelete?: (itemId: string) => void;
  className?: string;
}

export function ItemCard({ item, children, onDelete, className = '' }: ItemCardProps) {
  return (
    <div
      className={`
        group relative rounded-lg border-2 border-transparent bg-transparent p-4 hover:border-border/60 transition-all
        ${className}
      `}
      style={{
        gridColumn: `span ${Math.min(item.width, 12)}`,
      }}
    >
      {/* Item actions */}
      {onDelete && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent">
                <MoreVerticalIcon className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onDelete(item.id)}
                className="text-destructive focus:text-destructive"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Item title */}
      {item.title && (
        <h3 className="text-sm font-semibold mb-3 pr-8">{item.title}</h3>
      )}

      {/* Item content */}
      <div className="w-full">
        {children}
      </div>
    </div>
  );
}

