import { api } from '../../lib/api';

export type SearchHit = {
  id: string;
  nodeId: string;
  nodeTitle: string;
  nodeArchived: boolean;
  type: 'note';
  title: string;
  snippet: string;
  updatedAt: string;
};

export const searchItems = (q: string) =>
  api<SearchHit[]>('GET', `/api/v1/search?q=${encodeURIComponent(q)}`);
