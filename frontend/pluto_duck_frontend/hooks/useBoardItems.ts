import { useCallback, useEffect, useState } from 'react';
import {
  fetchBoardItems,
  createBoardItem as createItemApi,
  updateBoardItem as updateItemApi,
  deleteBoardItem as deleteItemApi,
  updateBoardItemPosition as updatePositionApi,
  type BoardItem,
} from '../lib/boardsApi';

export interface UseBoardItemsOptions {
  boardId?: string;
  enabled?: boolean;
}

export function useBoardItems({ boardId, enabled = true }: UseBoardItemsOptions = {}) {
  const [items, setItems] = useState<BoardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!boardId || !enabled) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchBoardItems(boardId);
      setItems(data);
    } catch (err) {
      console.error('Failed to load board items:', err);
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [boardId, enabled]);

  const addItem = useCallback(async (data: {
    item_type: string;
    title?: string;
    payload: Record<string, any>;
    render_config?: Record<string, any>;
    position_x?: number;
    position_y?: number;
    width?: number;
    height?: number;
  }) => {
    if (!boardId) return null;

    try {
      const newItem = await createItemApi(boardId, data);
      setItems(prev => [...prev, newItem]);
      return newItem;
    } catch (err) {
      console.error('Failed to create item:', err);
      throw err;
    }
  }, [boardId]);

  const updateItem = useCallback(async (
    itemId: string,
    updates: { title?: string; payload?: Record<string, any>; render_config?: Record<string, any> }
  ) => {
    try {
      const updated = await updateItemApi(itemId, updates);
      setItems(prev => prev.map(item => item.id === itemId ? updated : item));
      return updated;
    } catch (err) {
      console.error('Failed to update item:', err);
      throw err;
    }
  }, []);

  const deleteItem = useCallback(async (itemId: string) => {
    try {
      await deleteItemApi(itemId);
      setItems(prev => prev.filter(item => item.id !== itemId));
    } catch (err) {
      console.error('Failed to delete item:', err);
      throw err;
    }
  }, []);

  const updateItemPosition = useCallback(async (
    itemId: string,
    position: { position_x: number; position_y: number; width: number; height: number }
  ) => {
    try {
      const updated = await updatePositionApi(itemId, position);
      setItems(prev => prev.map(item => item.id === itemId ? updated : item));
      return updated;
    } catch (err) {
      console.error('Failed to update position:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    if (boardId && enabled) {
      void loadItems();
    }
  }, [boardId, enabled, loadItems]);

  return {
    items,
    loading,
    error,
    loadItems,
    addItem,
    updateItem,
    deleteItem,
    updateItemPosition,
  };
}

