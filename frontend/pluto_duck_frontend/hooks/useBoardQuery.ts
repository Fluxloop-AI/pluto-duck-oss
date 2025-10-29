import { useCallback, useEffect, useState } from 'react';
import {
  executeQuery as executeQueryApi,
  getCachedQueryResult,
  type QueryResult,
} from '../lib/boardsApi';

export interface UseBoardQueryOptions {
  itemId?: string;
  projectId?: string;
  autoFetch?: boolean;
}

export function useBoardQuery({ itemId, projectId, autoFetch = true }: UseBoardQueryOptions = {}) {
  const [data, setData] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeQuery = useCallback(async () => {
    if (!itemId || !projectId) return;

    setLoading(true);
    setError(null);
    try {
      const result = await executeQueryApi(itemId, projectId);
      setData(result);
    } catch (err) {
      console.error('Failed to execute query:', err);
      setError(err instanceof Error ? err.message : 'Failed to execute query');
    } finally {
      setLoading(false);
    }
  }, [itemId, projectId]);

  const refresh = useCallback(() => {
    void executeQuery();
  }, [executeQuery]);

  const fetchCached = useCallback(async () => {
    if (!itemId) return;

    try {
      const result = await getCachedQueryResult(itemId);
      setData(result);
    } catch (err) {
      console.error('No cached result:', err);
      // Silently fail - cached result might not exist yet
    }
  }, [itemId]);

  // Auto-fetch cached result on mount
  useEffect(() => {
    if (itemId && autoFetch) {
      void fetchCached();
    }
  }, [itemId, autoFetch, fetchCached]);

  return {
    data,
    loading,
    error,
    executeQuery,
    refresh,
    fetchCached,
  };
}

