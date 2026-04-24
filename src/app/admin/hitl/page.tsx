import { redirect } from "next/navigation";

/**
 * Legacy approval-queue URL. The bookings-awaiting-approval panel now lives
 * inside /admin/ai alongside the agent chat — one page for everything HITL.
 * Kept as a redirect so old bookmarks / external links still land correctly.
 */
export default function HitlRedirect() {
  redirect("/admin/ai");
}
