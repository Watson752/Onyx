export default function PriceLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="flex items-center gap-3 rounded border bg-white p-6">
        <span className="size-5 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
        Searching catalogs and requesting read-only supplier quotes…
      </div>
    </main>
  );
}
