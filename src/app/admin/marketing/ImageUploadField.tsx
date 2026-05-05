"use client";

/**
 * Image upload field for a marketing draft. Renders three states:
 *
 *   1. No image yet → "Choose image" button + drag-drop hint
 *   2. Uploading → spinner + filename
 *   3. Uploaded → preview + "Replace" button + Remove button
 *
 * Uploads run server-side via uploadMarketingImageAction so the
 * Supabase service-role key never touches the browser. Public URL
 * persists on the draft, so admin doesn't re-upload across publish
 * retries.
 *
 * 8MB cap matches Instagram's image limit (the strictest of the
 * platforms we publish to). Client-side validation lets admin see
 * the error without a round-trip on oversized files.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Image as ImageIcon,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { uploadMarketingImageAction } from "@/app/actions/marketing";

interface ImageUploadFieldProps {
  draftId: string;
  /** Current image URL (if previously uploaded). Hides the upload
   *  button and shows the preview/replace UI when set. */
  currentUrl?: string;
  /** Optional callback after a successful upload — gives the
   *  parent the new URL without forcing a router.refresh wait. */
  onUploaded?: (url: string) => void;
  /** When true, this is the platform that REQUIRES an image to
   *  publish (Instagram). Renders a stronger "required" affordance. */
  required?: boolean;
}

export function ImageUploadField({
  draftId,
  currentUrl,
  onUploaded,
  required = false,
}: ImageUploadFieldProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  // The display URL: prefer the local preview while the upload is
  // in flight (instant feedback) so admin sees their selection
  // without waiting for the round-trip. Once the server returns
  // the public URL we drop back to it.
  const displayUrl = localPreviewUrl ?? currentUrl;

  const handleFile = (file: File) => {
    setError(null);

    // Client-side validation — saves a round-trip on obvious
    // failures.
    if (!file.type.startsWith("image/")) {
      setError(`Expected an image file; got ${file.type || "unknown"}.`);
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError(
        `Image is ${(file.size / 1024 / 1024).toFixed(1)} MB — max is 8 MB.`
      );
      return;
    }

    // Show local preview while the server uploads.
    const localUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(localUrl);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("image", file);
        const r = await uploadMarketingImageAction(draftId, formData);
        if (r.error) {
          setError(r.error);
          // Drop the preview so admin sees the upload didn't land.
          URL.revokeObjectURL(localUrl);
          setLocalPreviewUrl(null);
          return;
        }
        if (r.url) {
          // Hand off to the server URL + clean up the blob URL.
          URL.revokeObjectURL(localUrl);
          setLocalPreviewUrl(null);
          onUploaded?.(r.url);
          router.refresh();
        }
      } catch (err) {
        URL.revokeObjectURL(localUrl);
        setLocalPreviewUrl(null);
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't reach the server. Please check your connection and try again."
        );
      }
    });
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset the input so picking the same filename twice still
    // fires onChange (browsers debounce identical-value events).
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onChange}
        className="hidden"
      />

      {displayUrl ? (
        <div className="space-y-2">
          {/* Preview. Plain <img> rather than next/image because the
              host URL is dynamic and may live outside the configured
              next.config.js remote patterns. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayUrl}
            alt="Marketing image preview"
            className={`max-h-48 w-full rounded-xl border border-[#e0e4dd] object-cover ${
              pending ? "opacity-50" : ""
            }`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-1.5 text-xs font-medium text-[#11272b] transition hover:bg-[#f4ecdd] disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Replace
            </button>
            {pending && (
              <span className="text-xs text-[#5e7279]">Uploading…</span>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={pending}
          className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-sm font-medium transition disabled:opacity-50 ${
            required
              ? "border-pink-300 bg-pink-50 text-pink-700 hover:bg-pink-100"
              : "border-[#e0e4dd] bg-[#fffbf4] text-[#5e7279] hover:bg-[#f4ecdd]"
          }`}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
          {pending
            ? "Uploading…"
            : required
              ? "Upload Instagram image (required)"
              : "Add an image (optional)"}
        </button>
      )}

      {error && (
        <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
