import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Auth disabled - middleware skipped for admin. Re-add matcher when enabling auth.
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [], // Empty = no routes pass through middleware (faster)
};
