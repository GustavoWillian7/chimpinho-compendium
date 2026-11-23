import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { ApiError } from '../../lib/api';
import { t } from '../../lib/strings';
import { signIn, verifyTotp } from './api';
import { sessionKey, useSession } from './useSession';

function messageFor(e: unknown, fallback: string) {
  if (e instanceof ApiError && e.status === 429) return t.auth.tooMany;
  if (e instanceof ApiError && e.status >= 400 && e.status < 500) return fallback;
  return t.auth.generic;
}

export function LoginPage() {
  const qc = useQueryClient();
  const session = useSession();
  const [step, setStep] = useState<'credentials' | 'totp'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session.data) return <Navigate to="/" replace />;

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(messageFor(e, fallback));
    } finally {
      setBusy(false);
    }
  }

  const onCredentials = (ev: FormEvent) => {
    ev.preventDefault();
    void run(async () => {
      const { twoFactor } = await signIn(email, password);
      if (twoFactor) setStep('totp');
      else await qc.invalidateQueries({ queryKey: sessionKey });
    }, t.auth.invalid);
  };

  const onTotp = (ev: FormEvent) => {
    ev.preventDefault();
    void run(async () => {
      await verifyTotp(code.trim());
      await qc.invalidateQueries({ queryKey: sessionKey });
    }, t.auth.invalidCode);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="font-topic text-5xl tracking-wide text-red uppercase">{t.appName}</h1>
      {step === 'credentials' ? (
        <form onSubmit={onCredentials} className="flex flex-col gap-4">
          <Field
            label={t.auth.email}
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label={t.auth.password}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-yellow">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {t.auth.signIn}
          </Button>
        </form>
      ) : (
        <form onSubmit={onTotp} className="flex flex-col gap-4">
          <Field
            label={t.auth.code}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-yellow">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {t.auth.verify}
          </Button>
        </form>
      )}
    </main>
  );
}
