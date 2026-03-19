import { NextResponse } from "next/server";
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
    return NextResponse.json({
      ok: true,
      token: "admin-session",
    });
  } catch (err) {
    authLogger.error("Auth API error", {}, err);
    return NextResponse.json(
      { ok: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}
