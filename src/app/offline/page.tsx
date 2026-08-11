export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--ink)] text-xl font-bold text-[var(--bg)] [font-family:var(--font-display)]">
        L
      </div>
      <h1 className="text-xl font-semibold [font-family:var(--font-display)]">Você está offline</h1>
      <p className="max-w-sm text-sm text-[var(--muted)]">
        Esta página ainda não está no cache. Reconecte-se à internet e tente novamente — os mapas
        já abertos continuam disponíveis offline.
      </p>
    </div>
  );
}
