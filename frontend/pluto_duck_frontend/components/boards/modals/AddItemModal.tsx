'use client';

import { useState } from 'react';
import type { Board } from '../../../lib/boardsApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import {
  FileTextIcon,
  BarChartIcon,
  TableIcon,
  TrendingUpIcon,
  ImageIcon,
} from 'lucide-react';

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (itemType: string, title: string) => Promise<void>;
}

const ITEM_TYPES = [
  {
    type: 'markdown',
    name: 'Markdown Note',
    description: 'Rich text notes and documentation',
    icon: FileTextIcon,
    color: 'text-blue-500',
  },
  {
    type: 'chart',
    name: 'Chart',
    description: 'Data visualization with queries',
    icon: BarChartIcon,
    color: 'text-green-500',
  },
  {
    type: 'table',
    name: 'Table',
    description: 'Tabular data display',
    icon: TableIcon,
    color: 'text-purple-500',
  },
  {
    type: 'metric',
    name: 'Metric',
    description: 'KPI card with trends',
    icon: TrendingUpIcon,
    color: 'text-orange-500',
  },
  {
    type: 'image',
    name: 'Image',
    description: 'Upload images and screenshots',
    icon: ImageIcon,
    color: 'text-pink-500',
  },
];

export function AddItemModal({ open, onOpenChange, onSubmit }: AddItemModalProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) return;

    setLoading(true);
    try {
      await onSubmit(selectedType, title.trim() || undefined!);
      setTitle('');
      setSelectedType(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create item:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Item to Board</DialogTitle>
          <DialogDescription>
            Choose the type of content you want to add
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Item type selection */}
            <div className="grid grid-cols-2 gap-3">
              {ITEM_TYPES.map((itemType) => {
                const Icon = itemType.icon;
                const isSelected = selectedType === itemType.type;
                
                return (
                  <button
                    key={itemType.type}
                    type="button"
                    onClick={() => setSelectedType(itemType.type)}
                    className={`
                      flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all
                      ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-accent'
                      }
                    `}
                  >
                    <Icon className={`h-5 w-5 ${itemType.color}`} />
                    <div>
                      <p className="font-medium">{itemType.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {itemType.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Title input */}
            {selectedType && (
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium">
                  Title (optional)
                </label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`Enter ${ITEM_TYPES.find(t => t.type === selectedType)?.name} title`}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setSelectedType(null);
                setTitle('');
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedType || loading}>
              {loading ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

