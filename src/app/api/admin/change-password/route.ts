import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/admin-session";
import { changeAdminPassword, validatePasswordStrength } from "@/lib/settings";
import { authLogger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    /* --- Auth check: require a valid admin session --- */
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    const session = await verifyAdminSessionToken(sessionToken);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const currentPassword = body?.currentPassword;
    const newPassword = body?.newPassword;

    if (!currentPassword || typeof currentPassword !== "string") {
      return NextResponse.json({ ok: false, error: "Current password required" }, { status: 400 });
    }
    if (!newPassword || typeof newPassword !== "string") {
      return NextResponse.json({ ok: false, error: "New password required" }, { status: 400 });
    }

    /* --- Server-side password strength validation --- */
    const strength = validatePasswordStrength(newPassword);
    if (!strength.ok) {
      return NextResponse.json({ ok: false, error: strength.error }, { status: 400 });
    }

    const result = await changeAdminPassword(currentPassword, newPassword);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    authLogger.error("Change password API error", {}, err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
