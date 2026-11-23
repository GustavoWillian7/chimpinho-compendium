import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createNode, deleteNode, listTree, renameNode } from './api';

const treeKey = ['nodes'] as const;

export const useTree = () => useQuery({ queryKey: treeKey, queryFn: listTree });

export function useTreeMutations() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: treeKey });
  return {
    create: useMutation({
      mutationFn: (v: { title: string; parentId: string | null }) =>
        createNode(v.title, v.parentId),
      onSuccess,
    }),
    rename: useMutation({
      mutationFn: (v: { id: string; title: string }) => renameNode(v.id, v.title),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => deleteNode(id), onSuccess }),
  };
}
