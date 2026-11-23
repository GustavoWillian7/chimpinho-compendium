import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Field } from '../../components/Field';
import { t } from '../../lib/strings';
import { parseSnippet } from './snippet';
import { useDebounced, useSearch } from './useSearch';

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('q') ?? '');
  const q = useDebounced(input.trim(), 300).slice(0, 200);
  const search = useSearch(q);

  const onChange = (value: string) => {
    setInput(value);
    const trimmed = value.trim();
    setParams(trimmed ? { q: trimmed } : {}, { replace: true });
  };

  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-topic text-4xl tracking-wide text-red uppercase">{t.search.title}</h1>
      <Field
        label={t.search.label}
        type="search"
        value={input}
        maxLength={200}
        autoFocus
        onChange={(e) => onChange(e.target.value)}
      />
      {q && search.isPending && <p className="text-gray">{t.loading}</p>}
      {search.isError && (
        <p role="alert" className="text-yellow">
          {t.auth.generic}
        </p>
      )}
      {q && search.data && search.data.length === 0 && (
        <p className="font-text text-gray">{t.search.empty}</p>
      )}
      {q && search.data && search.data.length > 0 && (
        <ul className="border-y border-gray/30" aria-label={t.search.results}>
          {search.data.map((hit) => (
            <li key={hit.id} className="border-b border-gray/30 last:border-b-0">
              <Link to={`/notes/${hit.id}`} className="flex min-h-11 flex-col gap-1 py-3">
                <span className="font-sub text-lg font-semibold">{hit.title}</span>
                <span className="text-sm text-gray">
                  {hit.nodeTitle}
                  {hit.nodeArchived && ` · ${t.search.archived}`}
                </span>
                {hit.snippet && (
                  <span className="font-text text-gray">
                    {parseSnippet(hit.snippet).map((p, i) =>
                      p.match ? (
                        <mark key={i} className="bg-transparent font-semibold text-yellow">
                          {p.text}
                        </mark>
                      ) : (
                        <span key={i}>{p.text}</span>
                      ),
                    )}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
