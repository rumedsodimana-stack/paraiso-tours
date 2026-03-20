import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

export const config = {
  matcher: ["/admin/:path*"],
};

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow the login page and its API through without a session check
  if (
    pathname === "/admin/login" ||
    pathname.startsWith("/admin/login/")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifyAdminSessionToken(token);

  if (!session) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
