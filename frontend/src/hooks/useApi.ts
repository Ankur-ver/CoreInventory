// src/hooks/useApi.ts
import { useState, useEffect, useCallback } from 'react';

interface UseApiOptions<T> {
  immediate?: boolean;
  initialData?: T;
}

export function useApi<T>(
  fetcher: () => Promise<{ data: { data: T } }>,
  options: UseApiOptions<T> = {}
) {
  const { immediate = true, initialData } = options;
  const [data, setData] = useState<T | undefined>(initialData);
  const [isLoading, setIsLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      setData(res.data.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Something went wrong';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (immediate) execute();
  }, [immediate, execute]);

  return { data, isLoading, error, refetch: execute };
}

// src/hooks/usePagination.ts
export function usePagination(initialPage = 1, initialLimit = 20) {
  const [page, setPage] = useState(initialPage);
  const [limit] = useState(initialLimit);

  return { page, limit, setPage };
}

// keep useState import used
// function useState<T>(v: T): [T, React.Dispatch<React.SetStateAction<T>>] {
//   return (require('react') as typeof import('react')).useState(v);
// }
