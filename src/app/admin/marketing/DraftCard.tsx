"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ClipboardCopy,
  Edit2,
  Send,
  Trash2,
  Archive,
  Zap,
  Clock,
} from "lucide-react";
import {
  deleteSocialPostDraftAction,
  publishSocialPostDraftAction,
  scheduleSocialPostDraftAction,
  updateSocialPostDraftAction,
} from "@/app/actions/marketing";
import type { SocialPostDraft } from "@/lib/types";
import { ImageUploadField } from "./ImageUploadField";

const PLATFORM_BADGES: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  instagram: { label: "Instagram", bg: "bg-pink-100", text: "text-pink-800" },
  facebook: { label: "Facebook", bg: "bg-blue-100", text: "text-blue-800" },
  x: { label: "X", bg: "bg-stone-200", text: "text-stone-900" },
  linkedin: { label: "LinkedIn", bg: "bg-sky-100", text: "text-sky-800" },
};

const STATUS_BADGES: Record<
  SocialPostDraft["status"],
  { label: string; bg: string; text: string }
> = {
  draft: { label: "Draft", bg: "bg-[#f4ecdd]", text: "text-[#5e7279]" },
  approved: { label: "Approved", bg: "bg-emerald-100", text: "text-emerald-700" },
  scheduled: { label: "Scheduled", bg: "bg-purple-100", text: "text-purple-800" },
  posted: { label: "Posted", bg: "bg-[#dce8dc]", text: "text-[#375a3f]" },
  archived: { label: "Archived", bg: "bg-stone-100", text: "text-stone-600" },
};

/**
 * Format an ISO datetime for the <input type="datetime-local"> value
 * attribute, which expects "YYYY-MM-DDTHH:MM" in local time. We
 * derive a "now + 1 hour" default for the picker on first render so
 * admin doesn't have to type a date from scratch.
 */
function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}
function defaultScheduledLocal(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

export function DraftCard({
  draft,
  targetLabel,
}: {
  draft: SocialPostDraft;
  targetLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [copy, setCopy] = useState(draft.copy);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platformBadge =
    PLATFORM_BADGES[draft.platform] ?? PLATFORM_BADGES.instagram;
  const statusBadge = STATUS_BADGES[draft.status];

  const handleCopy = async () => {
    try {
      const tagText = draft.tags.length > 0
        ? "\n\n" + draft.tags.map((t) => `#${t}`).join(" ")
        : "";
      await navigator.clipboard.writeText(copy + tagText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy to clipboard.");
    }
  };

  const updateStatus = (status: SocialPostDraft["status"]) => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await updateSocialPostDraftAction(draft.id, { status });
        if (r.error) setError(r.error);
        else router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      }
    });
  };

  const saveEdit = () => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await updateSocialPostDraftAction(draft.id, { copy });
        if (r.error) {
          setError(r.error);
          return;
        }
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      }
    });
  };

  /**
   * Publish via OAuth — calls the platform's API directly.
   * Instagram requires an image; we use the URL persisted on the
   * draft (uploaded via ImageUploadField). The server action
   * handles the rest (token decrypt, dispatch, status flip,
   * audit log).
   */
  const handlePublish = () => {
    setError(null);
    if (draft.platform === "instagram" && !draft.imageUrl) {
      setError(
        "Instagram needs an image. Upload one above before publishing."
      );
      return;
    }
    if (
      !confirm(
        `Publish this ${draft.platform} post live? This will appear on your ${draft.platform} feed immediately.`
      )
    )
      return;
    startTransition(async () => {
      try {
        const r = await publishSocialPostDraftAction(draft.id);
        if (r.error) {
          setError(r.error);
          return;
        }
        if (r.postUrl) {
          window.open(r.postUrl, "_blank", "noopener");
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      }
    });
  };

  // Inline schedule picker. Open/close + the local datetime value
  // are component state — the server action runs only when admin
  // clicks "Confirm schedule".
  const [scheduling, setScheduling] = useState(false);
  const [scheduledLocal, setScheduledLocal] = useState(() =>
    draft.scheduledFor
      ? isoToDatetimeLocal(draft.scheduledFor)
      : defaultScheduledLocal()
  );

  const handleSchedule = () => {
    if (draft.platform === "instagram" && !draft.imageUrl) {
      setError(
        "Instagram needs an image. Upload one above before scheduling."
      );
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        // The picker emits "YYYY-MM-DDTHH:MM" in LOCAL time. Convert
        // to a real ISO string before sending to the server so the
        // schedule action sees the correct moment.
        const iso = new Date(scheduledLocal).toISOString();
        const r = await scheduleSocialPostDraftAction(draft.id, iso);
        if (r.error) {
          setError(r.error);
          return;
        }
        setScheduling(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      }
    });
  };

  const cancelSchedule = () => {
    setError(null);
    startTransition(async () => {
      try {
        // Clearing scheduledFor + flipping status back to "approved"
        // takes the draft out of the cron worker's queue.
        const r = await updateSocialPostDraftAction(draft.id, {
          status: "approved",
          scheduledFor: undefined,
        });
        if (r.error) setError(r.error);
        else router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Delete this draft? This can't be undone.")) return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await deleteSocialPostDraftAction(draft.id);
        if (r.error) setError(r.error);
        else router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      }
    });
  };

  return (
    <div className="paraiso-card space-y-3 rounded-2xl p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${platformBadge.bg} ${platformBadge.text}`}
        >
          {platformBadge.label}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge.bg} ${statusBadge.text}`}
        >
          {statusBadge.label}
        </span>
        <span className="ml-auto text-xs text-[#8a9ba1]">{targetLabel}</span>
      </div>

      {editing ? (
        <textarea
          value={copy}
          onChange={(e) => setCopy(e.target.value)}
          rows={Math.max(4, copy.split("\n").length + 1)}
          className="w-full resize-y rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm leading-relaxed focus:border-[#5e3aa3] focus:outline-none focus:ring-2 focus:ring-[#5e3aa3]/20"
        />
      ) : (
        <p className="whitespace-pre-wrap rounded-xl bg-[#fffbf4] px-3 py-2 text-sm leading-relaxed text-[#11272b]">
          {copy}
        </p>
      )}

      {draft.tags.length > 0 && (
        <p className="text-xs text-[#5e3aa3]">
          {draft.tags.map((t) => `#${t}`).join("  ")}
        </p>
      )}

      {draft.imageDirection && (
        <p className="rounded-lg bg-[#f4ecdd] px-3 py-2 text-xs italic text-[#5e7279]">
          📷 {draft.imageDirection}
        </p>
      )}

      {/* Image upload — required for Instagram (IG API rejects
          text-only posts), optional but encouraged for FB / LinkedIn,
          unused for X (which has its own media-upload flow). */}
      {draft.platform !== "x" && draft.status !== "posted" && (
        <ImageUploadField
          draftId={draft.id}
          currentUrl={draft.imageUrl}
          required={draft.platform === "instagram"}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={pending}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
            copied
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : "border-[#e0e4dd] bg-[#fffbf4] text-[#11272b] hover:bg-[#f4ecdd]"
          }`}
        >
          {copied ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <ClipboardCopy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>

        {editing ? (
          <>
            <button
              type="button"
              onClick={saveEdit}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#5e3aa3] px-3 py-1.5 text-xs font-bold text-[#f6ead6] hover:bg-[#4a2e83] disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setCopy(draft.copy);
                setEditing(false);
              }}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-1.5 text-xs font-medium text-[#5e7279] hover:bg-[#f4ecdd]"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-1.5 text-xs font-medium text-[#11272b] hover:bg-[#f4ecdd] disabled:opacity-50"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit
          </button>
        )}

        {/* Status transitions — only the next forward step is shown */}
        {draft.status === "draft" && !editing && (
          <button
            type="button"
            onClick={() => updateStatus("approved")}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Approve
          </button>
        )}
        {(draft.status === "draft" || draft.status === "approved") &&
          !editing && (
            <>
              <button
                type="button"
                onClick={handlePublish}
                disabled={pending}
                title="Post directly to the platform via OAuth"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#5e3aa3] px-3 py-1.5 text-xs font-bold text-[#f6ead6] transition hover:bg-[#4a2e83] disabled:opacity-50"
              >
                <Zap className="h-3.5 w-3.5" />
                Publish
              </button>
              <button
                type="button"
                onClick={() => setScheduling(true)}
                disabled={pending || scheduling}
                title="Schedule for a future date — cron worker publishes automatically"
                className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
              >
                <Clock className="h-3.5 w-3.5" />
                Schedule
              </button>
              <button
                type="button"
                onClick={() => updateStatus("posted")}
                disabled={pending}
                title="Manually mark as posted (after copy-pasting yourself)"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#dce8dc] bg-[#dce8dc] px-3 py-1.5 text-xs font-medium text-[#375a3f] hover:bg-[#c8d8c8] disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                Mark posted
              </button>
            </>
          )}
        {draft.status === "scheduled" && !editing && (
          <>
            <button
              type="button"
              onClick={cancelSchedule}
              disabled={pending}
              title="Take this out of the cron worker's queue"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-1.5 text-xs font-medium text-[#5e7279] hover:bg-[#f4ecdd] disabled:opacity-50"
            >
              Cancel schedule
            </button>
          </>
        )}
        {draft.status !== "archived" && draft.status !== "posted" && !editing && (
          <button
            type="button"
            onClick={() => updateStatus("archived")}
            disabled={pending}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-1.5 text-xs font-medium text-[#5e7279] hover:bg-[#f4ecdd] disabled:opacity-50"
            title="Archive without posting"
          >
            <Archive className="h-3.5 w-3.5" />
            Archive
          </button>
        )}
        {!editing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            title="Delete this draft"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
