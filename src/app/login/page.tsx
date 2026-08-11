'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase';
import { ThemeToggle } from '@/components/theme-toggle';

type Mode = 'login' | 'signup' | 'reset';

function SetupNotice() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6 text-sm shadow-sm">
        <h1 className="mb-2 text-lg font-semibold [font-family:var(--font-display)]">
          Configuração pendente
        </h1>
        <p className="text-[var(--muted)]">
          A aplicação está publicada, mas as variáveis do Firebase
          (<code>NEXT_PUBLIC_FIREBASE_*</code>) ainda não foram configuradas neste ambiente.
          Preencha-as conforme o <code>.env.example</code> e faça um novo deploy.
        </p>
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Already signed in? Go straight to the maps list.
  useEffect(() => {
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      if (u) router.replace(params.get('next') || '/');
    });
  }, [router, params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    const auth = getFirebaseAuth();

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        router.replace(params.get('next') || '/');
      } else if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
        router.replace('/');
      } else {
        await sendPasswordResetEmail(auth, email);
        setInfo('Enviamos um link de recuperação para o seu e-mail.');
      }
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ink)] text-2xl font-bold text-[var(--bg)] [font-family:var(--font-display)]">
            L
          </div>
          <h1 className="text-2xl font-semibold tracking-tight [font-family:var(--font-display)]">
            Homens | Família &amp; Legado
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Que tipo de família estamos construindo?
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm"
        >
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            E-mail
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]"
            placeholder="voce@exemplo.com"
          />

          {mode !== 'reset' && (
            <>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Senha
              </label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mb-4 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]"
                placeholder="••••••••"
              />
            </>
          )}

          {error && (
            <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {info && (
            <p className="mb-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[var(--ink)] py-2.5 text-sm font-medium text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy
              ? 'Aguarde…'
              : mode === 'login'
                ? 'Entrar'
                : mode === 'signup'
                  ? 'Criar conta'
                  : 'Enviar link de recuperação'}
          </button>

          <div className="mt-5 flex items-center justify-between text-xs text-[var(--muted)]">
            {mode === 'login' ? (
              <>
                <button type="button" onClick={() => setMode('reset')} className="hover:text-[var(--ink)]">
                  Esqueci minha senha
                </button>
                <button type="button" onClick={() => setMode('signup')} className="hover:text-[var(--ink)]">
                  Criar conta
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setMode('login')} className="hover:text-[var(--ink)]">
                ← Voltar ao login
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function translateAuthError(err: unknown): string {
  const code = err instanceof FirebaseError ? err.code : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha incorretos.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já possui cadastro.';
    case 'auth/weak-password':
      return 'A senha deve ter pelo menos 6 caracteres.';
    case 'auth/invalid-email':
      return 'E-mail inválido.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde alguns minutos.';
    case 'auth/network-request-failed':
      return 'Sem conexão. Verifique sua internet.';
    default:
      return err instanceof Error ? err.message : 'Erro inesperado.';
  }
}

export default function LoginPage() {
  if (!isFirebaseConfigured) return <SetupNotice />;
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
