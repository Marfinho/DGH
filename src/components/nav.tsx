"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };
const active = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

/** Hauptmenü ab Tablet-Breite (Kopfzeile). */
export function TopNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Hauptmenü" className="hidden flex-1 flex-wrap gap-1 md:flex">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={active(path, i.href) ? "page" : undefined}
          className={`rounded-md px-2 py-2 font-display text-base font-bold uppercase tracking-wide lg:px-3 lg:text-lg ${active(path, i.href) ? "bg-brand-600 text-white" : "text-ink hover:bg-brand-50"}`}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

/** Tab-Leiste am unteren Rand auf dem Handy. */
export function BottomNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const moreActive = !items.some((i) => active(path, i.href));
  return (
    <nav aria-label="Hauptmenü" className="fixed inset-x-0 bottom-0 z-20 flex gap-1 bg-brand-600 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 md:hidden">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={active(path, i.href) ? "page" : undefined}
          className={`flex min-h-[48px] flex-1 items-center justify-center rounded-md font-display text-lg font-bold uppercase ${active(path, i.href) ? "bg-sun text-brand-600" : "text-white"}`}>
          {i.label}
        </Link>
      ))}
      <Link href="/mehr" aria-current={path === "/mehr" ? "page" : undefined}
        className={`flex min-h-[48px] flex-1 items-center justify-center rounded-md font-display text-lg font-bold uppercase ${path === "/mehr" || moreActive ? "bg-sun text-brand-600" : "text-white"}`}>
        Mehr
      </Link>
    </nav>
  );
}
