import { redirect } from "next/navigation";

// The Agent workspace merged into /admin/ai. Any old deep link lands here
// and we bounce to the unified AI Workspace.
export default function LegacyAgentPage() {
  redirect("/admin/ai");
}
