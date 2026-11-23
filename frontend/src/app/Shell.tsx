import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { Button } from '../components/Button';
import { signOut } from '../features/auth/api';
import { sessionKey, useSession } from '../features/auth/useSession';
import { t } from '../lib/strings';

const tabs = [
  { to: '/', label: t.nav.topics },
  { to: '/search', label: t.nav.search },
];

export function Shell() {
  const qc = useQueryClient();
  const session = useSession();

  if (session.isPending) return <p className="p-6 text-gray">{t.loading}</p>;
  if (!session.data) return <Navigate to="/login" replace />;

  const logout = async () => {
    await signOut();
    qc.clear();
    await qc.invalidateQueries({ queryKey: sessionKey });
  };

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 flex-1 items-center justify-center px-4 font-sub font-semibold md:flex-none ${
      isActive
        ? 'border-yellow text-yellow max-md:border-t-2 md:border-b-2'
        : 'text-gray hover:text-white'
    }`;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-gray/30 px-4 py-2">
        <span className="font-topic text-xl tracking-wide uppercase">{t.appName}</span>
        <nav
          aria-label="Principal"
          className="max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-10 max-md:flex max-md:border-t max-md:border-gray/30 max-md:bg-black md:flex md:flex-1"
        >
          {tabs.map((tab) => (
            <NavLink key={tab.to} to={tab.to} end className={tabClass}>
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <Button variant="ghost" onClick={() => void logout()}>
          {t.auth.signOut}
        </Button>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 pb-20 md:pb-4">
        <Outlet />
      </main>
    </div>
  );
}
