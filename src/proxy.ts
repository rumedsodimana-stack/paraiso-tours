import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getSafeAdminNextPath,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

const PUBLIC_ADMIN_API_PATHS = new Set([
  "/api/admin/auth",
  "/api/admin/logout",
]);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isLoginPage = pathname === "/admin/login";
  const isAdminApi = pathname.startsWith("/api/admin");

  if (PUBLIC_ADMIN_API_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const session = await verifyAdminSessionToken(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  );

  if (isLoginPage) {
    if (session) {
      return NextResponse.redirect(
        new URL(
          getSafeAdminNextPath(request.nextUrl.searchParams.get("next")),
          request.url
        )
      );
    }
    return NextResponse.next();
  }

  if ((pathname.startsWith("/admin") || isAdminApi) && !session) {
    if (isAdminApi) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
