import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchItems } from './api';

export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export const useSearch = (q: string) =>
  useQuery({
    queryKey: ['search', q],
    queryFn: () => searchItems(q),
    enabled: q.length > 0,
  });
