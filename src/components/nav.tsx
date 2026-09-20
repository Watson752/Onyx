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
      <nav className="mx-auto flex max-w-6xl items-center gap-10 px-6 py-8">
        <Link href="/suppliers" className="group flex items-center gap-4">
          <Image
            src="/onyx-mark.webp"
            alt=""
            width={64}
            height={80}
            priority
            className="h-20 w-auto"
          />
          <span className="font-display text-3xl font-semibold tracking-[0.14em] text-espresso group-hover:text-terracotta">
            ONYX
          </span>
        </Link>
        <div className="flex items-center gap-8">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="text-base text-espresso-soft hover:text-terracotta"
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
