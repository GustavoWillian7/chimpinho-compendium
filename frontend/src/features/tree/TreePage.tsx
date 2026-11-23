import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { t } from '../../lib/strings';
import type { TopicNode } from './api';
import { useTree, useTreeMutations } from './useTree';

type Mutations = ReturnType<typeof useTreeMutations>;

function TitleForm({
  initial = '',
  onSubmit,
  onCancel,
}: {
  initial?: string;
  onSubmit: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial);
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const trimmed = title.trim();
    if (trimmed) onSubmit(trimmed);
  };
  return (
    <form onSubmit={submit} className="flex gap-2 py-1">
      <input
        autoFocus
        aria-label={t.tree.topicName}
        value={title}
        maxLength={255}
        onChange={(e) => setTitle(e.target.value)}
        className="min-h-11 min-w-0 flex-1 rounded-panel border border-gray/40 bg-black px-3 focus:border-yellow"
      />
      <Button type="submit">{t.save}</Button>
      <Button type="button" variant="ghost" onClick={onCancel}>
        {t.cancel}
      </Button>
    </form>
  );
}

function TreeItem({ node, depth, m }: { node: TopicNode; depth: number; m: Mutations }) {
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<'idle' | 'rename' | 'child'>('idle');
  const hasChildren = node.children.length > 0;
  const titleClass =
    depth === 0 ? 'font-topic text-2xl tracking-wide uppercase' : 'font-sub text-lg font-semibold';

  return (
    <li>
      <div className="flex items-center gap-1" style={{ paddingLeft: depth * 16 }}>
        {hasChildren ? (
          <button
            type="button"
            aria-label={open ? t.tree.collapse : t.tree.expand}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="min-h-11 w-8 text-gray"
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span aria-hidden className="w-8" />
        )}
        {mode === 'rename' ? (
          <div className="flex-1">
            <TitleForm
              initial={node.title}
              onCancel={() => setMode('idle')}
              onSubmit={(title) =>
                m.rename.mutate({ id: node.id, title }, { onSuccess: () => setMode('idle') })
              }
            />
          </div>
        ) : (
          <>
            <Link
              to={`/topics/${node.id}`}
              className={`min-h-11 flex-1 truncate py-2 hover:text-yellow ${titleClass}`}
            >
              {node.title}
            </Link>
            <button
              type="button"
              aria-label={`${t.tree.newChild}: ${node.title}`}
              onClick={() => {
                setOpen(true);
                setMode('child');
              }}
              className="min-h-11 min-w-11 text-yellow"
            >
              ＋
            </button>
            <button
              type="button"
              aria-label={`${t.tree.rename}: ${node.title}`}
              onClick={() => setMode('rename')}
              className="min-h-11 min-w-11 text-gray hover:text-yellow"
            >
              ✎
            </button>
            <button
              type="button"
              aria-label={`${t.tree.delete}: ${node.title}`}
              onClick={() => {
                if (window.confirm(t.tree.confirmDelete(node.title))) m.remove.mutate(node.id);
              }}
              className="min-h-11 min-w-11 text-gray hover:text-white"
            >
              ✕
            </button>
          </>
        )}
      </div>
      {mode === 'child' && (
        <div style={{ paddingLeft: (depth + 1) * 16 + 32 }}>
          <TitleForm
            onCancel={() => setMode('idle')}
            onSubmit={(title) =>
              m.create.mutate({ title, parentId: node.id }, { onSuccess: () => setMode('idle') })
            }
          />
        </div>
      )}
      {open && hasChildren && (
        <ul>
          {node.children.map((c) => (
            <TreeItem key={c.id} node={c} depth={depth + 1} m={m} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function TreePage() {
  const { data, isPending, isError } = useTree();
  const m = useTreeMutations();
  const [adding, setAdding] = useState(false);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-topic text-4xl tracking-wide text-red uppercase">{t.tree.title}</h1>
        <Button onClick={() => setAdding(true)}>{t.tree.newTopic}</Button>
      </div>
      {adding && (
        <TitleForm
          onCancel={() => setAdding(false)}
          onSubmit={(title) =>
            m.create.mutate({ title, parentId: null }, { onSuccess: () => setAdding(false) })
          }
        />
      )}
      {isPending && <p className="text-gray">{t.loading}</p>}
      {isError && (
        <p role="alert" className="text-yellow">
          {t.auth.generic}
        </p>
      )}
      {data && data.length === 0 && !adding && (
        <p className="font-text text-gray">{t.tree.empty}</p>
      )}
      {data && data.length > 0 && (
        <ul className="border-y border-gray/30 py-2">
          {data.map((n) => (
            <TreeItem key={n.id} node={n} depth={0} m={m} />
          ))}
        </ul>
      )}
    </section>
  );
}
