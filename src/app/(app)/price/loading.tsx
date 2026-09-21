export default function PriceLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 sm:py-16">
      <div className="flex items-start gap-4 rounded-2xl border border-line bg-cream p-5 text-espresso-soft sm:items-center sm:p-10">
        <span className="mt-0.5 size-5 shrink-0 animate-spin rounded-full border-2 border-terracotta border-t-transparent sm:mt-0" />
        <p>Searching catalogs and requesting read-only supplier quotes…</p>
      </div>
    </main>
  );
}
