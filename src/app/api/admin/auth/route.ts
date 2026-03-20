import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
} from "@/lib/admin-session";
import { verifyAdminPassword } from "@/lib/settings";
import { authLogger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { ok: false, error: "Password required" },
        { status: 400 }
      );
    }

    const valid = await verifyAdminPassword(password);
    if (!valid) {
      authLogger.warn("Login failed: invalid password");
      return NextResponse.json(
        { ok: false, error: "Invalid password" },
        { status: 401 }
      );
    }

    authLogger.info("Admin login successful");
    const response = NextResponse.json({
      ok: true,
    });
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: await createAdminSessionToken(),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (err) {
    authLogger.error("Auth API error", {}, err);
    return NextResponse.json(
      { ok: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}
