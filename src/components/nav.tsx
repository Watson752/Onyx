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
    <header className="border-b border-line bg-bone/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-5 sm:gap-10 sm:px-6 sm:py-8">
        <Link href="/suppliers" className="group flex items-center gap-3 sm:gap-4">
          <Image
            src="/onyx-mark.webp"
            alt=""
            width={64}
            height={80}
            priority
            className="h-12 w-auto sm:h-20"
          />
          <span className="font-display text-2xl font-semibold tracking-[0.14em] text-espresso group-hover:text-terracotta sm:text-3xl">
            ONYX
          </span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-8">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-espresso-soft hover:text-terracotta sm:text-base"
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
