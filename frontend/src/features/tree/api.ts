import { api } from '../../lib/api';

export type TopicNode = {
  id: string;
  parentId: string | null;
  title: string;
  icon: string | null;
  color: string | null;
  position: string;
  children: TopicNode[];
};

export const listTree = () => api<TopicNode[]>('GET', '/api/v1/nodes');
export const createNode = (title: string, parentId: string | null) =>
  api('POST', '/api/v1/nodes', { title, parentId });
export const renameNode = (id: string, title: string) =>
  api('PATCH', `/api/v1/nodes/${id}`, { title });
export const deleteNode = (id: string) => api('DELETE', `/api/v1/nodes/${id}`);
