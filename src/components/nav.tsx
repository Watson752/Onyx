import Image from "next/image";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  ["/suppliers", "Suppliers"],
  ["/request", "Request"],
  ["/price", "Price"],
] as const;

export function Nav() {
  return (
    <header className="border-b border-line bg-bone/85 pt-[env(safe-area-inset-top,0px)] backdrop-blur">
      <nav className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-10 sm:px-6 sm:py-8">
        <div className="flex items-center justify-between gap-3 sm:contents">
          <Link
            href="/suppliers"
            className="group flex min-w-0 items-center gap-3 sm:gap-4"
          >
            <Image
              src="/onyx-mark.webp"
              alt=""
              width={64}
              height={80}
              priority
              className="h-10 w-auto sm:h-20"
            />
            <span className="font-display text-xl font-semibold tracking-[0.14em] text-espresso group-hover:text-terracotta sm:text-3xl">
              ONYX
            </span>
          </Link>
          <div className="shrink-0 sm:order-last sm:ml-auto">
            <ThemeToggle />
          </div>
        </div>
        <div className="flex items-center justify-between gap-1 sm:justify-start sm:gap-8">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-2 text-sm text-espresso-soft hover:bg-beige hover:text-terracotta sm:flex-none sm:px-0 sm:hover:bg-transparent sm:text-base"
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
