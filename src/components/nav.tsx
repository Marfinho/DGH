"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** match: weitere Pfade, bei denen der Punkt aktiv ist (z. B. /kalender gehört zu „Termine“). */
export type NavItem = { href: string; label: string; match?: string[]; wide?: boolean }; // wide: erst auf breiten Bildschirmen in der Kopfzeile
const under = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
const active = (path: string, i: NavItem) => [i.href, ...(i.match ?? [])].some((h) => under(path, h));

/** Hauptmenü ab Tablet-Breite (Kopfzeile). */
export function TopNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const any = items.some((i) => i.href !== "/mehr" && active(path, i));
  return (
    <nav aria-label="Hauptmenü" className="hidden flex-1 flex-nowrap gap-1 md:flex">
      {items.map((i) => { const on = i.href === "/mehr" ? !any && path !== "/" : active(path, i); return (
        <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
          className={`rounded-md px-2 py-2 font-display text-base font-bold uppercase tracking-wide lg:px-3 lg:text-lg ${i.wide ? "hidden xl:block" : ""} ${on ? "bg-brand-600 text-white" : "text-ink hover:bg-brand-50"}`}>
          {i.label}
        </Link>
      ); })}
    </nav>
  );
}

/** Tab-Leiste am unteren Rand auf dem Handy. */
export function BottomNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const moreActive = !items.some((i) => active(path, i));
  return (
    <nav aria-label="Hauptmenü" className="fixed inset-x-0 bottom-0 z-20 flex gap-1 bg-brand-600 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 md:hidden">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={active(path, i) ? "page" : undefined}
          className={`flex min-h-[48px] flex-1 items-center justify-center rounded-md font-display text-lg font-bold uppercase ${active(path, i) ? "bg-sun text-brand-600" : "text-white"}`}>
          {i.label}
        </Link>
      ))}
      <Link href="/mehr" aria-current={moreActive ? "page" : undefined}
        className={`flex min-h-[48px] flex-1 items-center justify-center rounded-md font-display text-lg font-bold uppercase ${moreActive ? "bg-sun text-brand-600" : "text-white"}`}>
        Mehr
      </Link>
    </nav>
  );
}
