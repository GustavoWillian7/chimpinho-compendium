import type { JSONContent } from '@tiptap/react';
import { api } from '../../lib/api';

export type NoteSummary = {
  id: string;
  nodeId: string;
  type: 'note';
  title: string;
  position: string;
  createdAt: string;
  updatedAt: string;
};

export type Note = NoteSummary & { content: JSONContent };

export const listNotes = (nodeId: string) =>
  api<NoteSummary[]>('GET', `/api/v1/nodes/${nodeId}/items`);
export const createNote = (nodeId: string, title: string) =>
  api<Note>('POST', `/api/v1/nodes/${nodeId}/items`, { title, type: 'note' });
export const getNote = (id: string) => api<Note>('GET', `/api/v1/items/${id}`);
export const updateNote = (id: string, patch: { title?: string; content?: JSONContent }) =>
  api<Note>('PATCH', `/api/v1/items/${id}`, patch);
export const deleteNote = (id: string) => api('DELETE', `/api/v1/items/${id}`);
