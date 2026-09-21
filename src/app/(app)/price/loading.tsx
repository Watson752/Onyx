export default function PriceLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 sm:py-16">
      <div className="flex items-center gap-4 rounded-2xl border border-line bg-cream p-6 text-espresso-soft sm:p-10">
        <span className="size-5 animate-spin rounded-full border-2 border-terracotta border-t-transparent" />
        Searching catalogs and requesting read-only supplier quotes…
      </div>
    </main>
  );
}
