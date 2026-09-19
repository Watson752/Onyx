import Link from "next/link";

const links = [
  ["/suppliers", "Suppliers"],
  ["/request", "Request"],
  ["/price", "Price"],
] as const;

export function Nav() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
        <Link href="/suppliers" className="text-xl font-black tracking-tight">
          ONYX
        </Link>
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-950"
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
