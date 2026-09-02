export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
        2026 foundation
      </p>
      <h1 className="max-w-3xl text-5xl font-semibold tracking-tight sm:text-7xl">
        HPPP NFL Pool
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
        The new pool is under construction. Picks, frozen consensus lines,
        scoring, and commissioner controls will be rebuilt on a tested Supabase
        foundation.
      </p>
    </main>
  );
}
