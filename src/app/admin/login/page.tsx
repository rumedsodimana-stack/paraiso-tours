import { redirect } from "next/navigation";

// Login disabled - go straight to admin
export default function AdminLoginPage() {
  redirect("/admin");
}
