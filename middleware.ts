import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS =
  process.env.NODE_ENV === "development" ? ["/login", "/signup"] : ["/login"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function middleware(request: NextRequest) {
  // Mode démo : sans Supabase configuré, pas d'auth — tout est accessible
  // (données fictives). Évite le crash MIDDLEWARE_INVOCATION_FAILED d'un
  // déploiement Vercel sans variables d'environnement.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { pathname } = request.nextUrl;
    if (pathname === "/login" || pathname === "/signup") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Refreshes the Supabase session cookie on every request.
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Unauthenticated visitors are sent to /login (except on public routes).
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return copyCookies(supabaseResponse, NextResponse.redirect(url));
  }

  // Authenticated users have no business on the auth pages.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return copyCookies(supabaseResponse, NextResponse.redirect(url));
  }

  return supabaseResponse;
}

// Preserve the refreshed Supabase auth cookies on redirect responses.
function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
