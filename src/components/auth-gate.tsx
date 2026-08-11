'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase';

/**
 * Client-side route protection. The data itself is protected server-side by
 * Firestore security rules; this gate handles the UX redirect.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(getFirebaseAuth(), (u) => setUser(u));
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) router.replace('/login');
  }, [router]);

  useEffect(() => {
    if (user === null) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [user, router, pathname]);

  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-[var(--muted)]">
        Carregando…
      </div>
    );
  }
  return <>{children}</>;
}
