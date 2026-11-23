import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createNote, deleteNote, getNote, listNotes } from './api';

export const notesKey = (nodeId: string) => ['items', 'node', nodeId] as const;

export const useNotes = (nodeId: string) =>
  useQuery({ queryKey: notesKey(nodeId), queryFn: () => listNotes(nodeId) });

// gcTime 0: o editor inicia a partir do que foi buscado; cache velho mostraria texto desatualizado.
export const useNote = (id: string) =>
  useQuery({ queryKey: ['item', id], queryFn: () => getNote(id), gcTime: 0 });

export function useNoteMutations(nodeId: string) {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: notesKey(nodeId) });
  return {
    create: useMutation({ mutationFn: (title: string) => createNote(nodeId, title), onSuccess }),
    remove: useMutation({ mutationFn: (id: string) => deleteNote(id), onSuccess }),
  };
}
