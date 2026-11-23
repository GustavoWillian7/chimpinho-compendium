import { useQueryClient } from '@tanstack/react-query';
import { EditorContent, useEditor, type Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { t } from '../../lib/strings';
import { updateNote, type Note } from './api';
import { notesKey, useNote, useNoteMutations } from './useNotes';

type Status = 'saved' | 'dirty' | 'saving' | 'error';
type Patch = { title?: string; content?: JSONContent };

const SAVE_DELAY_MS = 800;

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 min-w-11 rounded-panel px-2 font-sub font-semibold ${
        active ? 'bg-red text-white' : 'text-gray hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const chain = () => editor.chain().focus();
  return (
    <div
      role="toolbar"
      aria-label={t.notes.toolbar}
      className="flex flex-wrap gap-1 border-b border-gray/30 pb-2"
    >
      <ToolbarButton
        label={t.notes.bold}
        active={editor.isActive('bold')}
        onClick={() => chain().toggleBold().run()}
      >
        B
      </ToolbarButton>
      <ToolbarButton
        label={t.notes.italic}
        active={editor.isActive('italic')}
        onClick={() => chain().toggleItalic().run()}
      >
        I
      </ToolbarButton>
      <ToolbarButton
        label={t.notes.heading2}
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        label={t.notes.heading3}
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      >
        H3
      </ToolbarButton>
      <ToolbarButton
        label={t.notes.bullets}
        active={editor.isActive('bulletList')}
        onClick={() => chain().toggleBulletList().run()}
      >
        •
      </ToolbarButton>
      <ToolbarButton
        label={t.notes.numbered}
        active={editor.isActive('orderedList')}
        onClick={() => chain().toggleOrderedList().run()}
      >
        1.
      </ToolbarButton>
      <ToolbarButton
        label={t.notes.quote}
        active={editor.isActive('blockquote')}
        onClick={() => chain().toggleBlockquote().run()}
      >
        “
      </ToolbarButton>
    </div>
  );
}

function NoteEditor({ note }: { note: Note }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const m = useNoteMutations(note.nodeId);
  const [title, setTitle] = useState(note.title);
  const [status, setStatus] = useState<Status>('saved');
  const pending = useRef<Patch>({});
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;
    pending.current = {};
    setStatus('saving');
    try {
      await updateNote(note.id, patch);
      if (Object.keys(pending.current).length === 0) setStatus('saved');
      void qc.invalidateQueries({ queryKey: notesKey(note.nodeId) });
    } catch {
      pending.current = { ...patch, ...pending.current };
      setStatus('error');
    }
  }, [note.id, note.nodeId, qc]);

  const schedule = useCallback(
    (patch: Patch) => {
      pending.current = { ...pending.current, ...patch };
      setStatus('dirty');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  // Ao sair da página, grava o que ainda estiver pendente.
  useEffect(() => () => void flush(), [flush]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: note.content,
    editorProps: {
      attributes: { 'aria-label': t.notes.editor, role: 'textbox', 'aria-multiline': 'true' },
    },
    onUpdate: ({ editor: ed }) => schedule({ content: ed.getJSON() }),
  });

  const onTitle = (value: string) => {
    setTitle(value);
    // O backend exige título com 1+ caracteres: título vazio não é enviado.
    if (value.trim()) schedule({ title: value.trim() });
  };

  const remove = () => {
    if (!window.confirm(t.notes.confirmDelete(title))) return;
    pending.current = {};
    window.clearTimeout(timer.current);
    m.remove.mutate(note.id, { onSuccess: () => navigate(`/topics/${note.nodeId}`) });
  };

  const statusText = {
    saved: t.notes.saved,
    saving: t.notes.saving,
    dirty: t.notes.dirty,
    error: t.notes.saveError,
  }[status];

  return (
    <section className="flex flex-col gap-4">
      <Link to={`/topics/${note.nodeId}`} className="min-h-11 py-2 text-gray hover:text-yellow">
        ← {t.notes.back}
      </Link>
      <input
        aria-label={t.notes.noteTitle}
        value={title}
        maxLength={255}
        onChange={(e) => onTitle(e.target.value)}
        className="min-h-11 w-full border-b border-gray/40 bg-transparent font-topic text-3xl tracking-wide text-red uppercase focus:border-yellow"
      />
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="note-editor font-text" />
      <div className="flex items-center justify-between gap-2">
        <p role="status" className={status === 'error' ? 'text-yellow' : 'text-gray'}>
          {statusText}
        </p>
        <Button variant="ghost" onClick={remove}>
          {t.notes.delete}
        </Button>
      </div>
    </section>
  );
}

export function NotePage() {
  const { id = '' } = useParams();
  const note = useNote(id);
  if (note.isPending) return <p className="text-gray">{t.loading}</p>;
  if (note.isError) return <p className="text-gray">{t.notes.notFound}</p>;
  return <NoteEditor key={note.data.id} note={note.data} />;
}
