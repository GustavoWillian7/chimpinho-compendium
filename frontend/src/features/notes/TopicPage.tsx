import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { t } from '../../lib/strings';
import { useTree } from '../tree/useTree';
import type { TopicNode } from '../tree/api';
import { useNoteMutations, useNotes } from './useNotes';

function findNode(nodes: TopicNode[], id: string): TopicNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return undefined;
}

export function TopicPage() {
  const { nodeId = '' } = useParams();
  const navigate = useNavigate();
  const tree = useTree();
  const notes = useNotes(nodeId);
  const m = useNoteMutations(nodeId);
  const node = tree.data ? findNode(tree.data, nodeId) : undefined;

  const create = () =>
    m.create.mutate(t.notes.untitled, {
      onSuccess: (note) => navigate(`/notes/${note.id}`),
    });

  if (tree.data && !node) return <p className="text-gray">{t.notes.notFound}</p>;

  return (
    <section className="flex flex-col gap-4">
      <Link to="/" className="min-h-11 py-2 text-gray hover:text-yellow">
        ← {t.notes.backToTopics}
      </Link>
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-topic text-4xl tracking-wide text-red uppercase">
          {node?.title ?? ''}
        </h1>
        <Button onClick={create} disabled={m.create.isPending}>
          {t.notes.newNote}
        </Button>
      </div>
      {notes.isPending && <p className="text-gray">{t.loading}</p>}
      {notes.isError && (
        <p role="alert" className="text-yellow">
          {t.auth.generic}
        </p>
      )}
      {notes.data && notes.data.length === 0 && (
        <p className="font-text text-gray">{t.notes.empty}</p>
      )}
      {notes.data && notes.data.length > 0 && (
        <ul className="border-y border-gray/30">
          {notes.data.map((n) => (
            <li key={n.id} className="flex items-center">
              <Link
                to={`/notes/${n.id}`}
                className="min-h-11 flex-1 truncate py-3 font-sub text-lg font-semibold hover:text-yellow"
              >
                {n.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
