"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

/**
 * Green success banner shown after saving/updating across the admin.
 * Auto-dismisses after 4 seconds.
 */
export function SaveSuccessBanner({ message = "Saved successfully" }: { message?: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="mb-6 flex items-center justify-center gap-3 rounded-xl border border-[#b8d6b8] bg-[#dce8dc] px-6 py-4 text-[#375a3f] shadow-sm"
      role="status"
      aria-live="polite"
    >
      <CheckCircle2 className="h-8 w-8 shrink-0 text-[#375a3f]" />
      <span className="text-lg font-semibold">{message}</span>
    </div>
  );
}
