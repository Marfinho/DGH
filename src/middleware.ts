import { NextRequest, NextResponse } from "next/server";

// Grobe Vorprüfung (Cookie vorhanden?). Die eigentliche Prüfung machen requireUser() in Seiten und Actions.
const OPEN = [/^\/login/, /^\/api\/ical\//, /^\/api\/cron\//, /^\/manifest\.webmanifest$/, /^\/sw\.js$/, /^\/icons\//, /^\/_next\//, /^\/favicon/];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (OPEN.some((r) => r.test(pathname)) || req.cookies.has("dp_session")) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", req.url));
}
export const config = { matcher: "/((?!_next/static|_next/image).*)" };
