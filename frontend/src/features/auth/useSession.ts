import { useQuery } from '@tanstack/react-query';
import { fetchMe } from './api';

export const sessionKey = ['me'] as const;

export function useSession() {
  return useQuery({ queryKey: sessionKey, queryFn: fetchMe, staleTime: 60_000, retry: false });
}
