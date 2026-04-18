"use client";

import { useState } from "react";
import { createActivityAction } from "@/app/actions/planner-activities";
import type { PlannerActivityRecord } from "@/lib/types";
import { SaveSuccessBanner } from "../SaveSuccessBanner";

interface ActivityFormProps {
  destinations: { id: string; name: string }[];
  activity?: PlannerActivityRecord;
  updateAction?: (
    id: string,
    formData: FormData
  ) => Promise<{ error?: string; success?: boolean }>;
}

export function ActivityForm({
  destinations,
  activity,
  updateAction,
}: ActivityFormProps) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const formData = new FormData(e.currentTarget);

    let result: { error?: string; success?: boolean; id?: string };
    if (activity && updateAction) {
      result = await updateAction(activity.id, formData);
    } else {
      result = await createActivityAction(formData);
    }

    if (result?.error) {
      setError(result.error);
      return;
    }

    if (result?.success && !activity) {
      window.location.href = "/admin/activities?created=1";
      return;
    }

    if (activity && result && !result.error) {
      setSaved(true);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {saved && <SaveSuccessBanner message="Activity updated successfully" />}
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="destinationId"
            className="block text-sm font-medium text-[#11272b]"
          >
            Destination *
          </label>
          <select
            id="destinationId"
            name="destinationId"
            required
            defaultValue={activity?.destinationId ?? ""}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          >
            <option value="" disabled>
              Select a destination
            </option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-[#11272b]"
          >
            Title *
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={activity?.title}
            placeholder="Sigiriya Rock Fortress"
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="summary"
          className="block text-sm font-medium text-[#11272b]"
        >
          Summary *
        </label>
        <textarea
          id="summary"
          name="summary"
          required
          rows={3}
          defaultValue={activity?.summary}
          placeholder="Climb the iconic 5th-century rock fortress with panoramic views..."
          className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <div>
          <label
            htmlFor="durationLabel"
            className="block text-sm font-medium text-[#11272b]"
          >
            Duration
          </label>
          <input
            id="durationLabel"
            name="durationLabel"
            type="text"
            defaultValue={activity?.durationLabel ?? "2 hours"}
            placeholder="2 hours"
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>

        <div>
          <label
            htmlFor="energy"
            className="block text-sm font-medium text-[#11272b]"
          >
            Energy Level
          </label>
          <select
            id="energy"
            name="energy"
            defaultValue={activity?.energy ?? "easy"}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          >
            <option value="easy">Easy</option>
            <option value="moderate">Moderate</option>
            <option value="active">Active</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="estimatedPrice"
            className="block text-sm font-medium text-[#11272b]"
          >
            Estimated Price (USD)
          </label>
          <input
            id="estimatedPrice"
            name="estimatedPrice"
            type="number"
            min="0"
            step="0.01"
            defaultValue={activity?.estimatedPrice ?? 0}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="bestFor"
            className="block text-sm font-medium text-[#11272b]"
          >
            Best For
          </label>
          <input
            id="bestFor"
            name="bestFor"
            type="text"
            defaultValue={activity?.bestFor}
            placeholder="History lovers, photographers"
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>

        <div>
          <label
            htmlFor="tags"
            className="block text-sm font-medium text-[#11272b]"
          >
            Tags (comma-separated)
          </label>
          <input
            id="tags"
            name="tags"
            type="text"
            defaultValue={activity?.tags?.join(", ")}
            placeholder="culture, history, adventure"
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-[#e0e4dd] pt-6">
        <a
          href="/admin/activities"
          className="rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-5 py-2.5 text-sm font-medium text-[#5e7279] transition hover:bg-[#f4ecdd]"
        >
          Cancel
        </a>
        <button
          type="submit"
          className="rounded-xl bg-[#12343b] px-5 py-2.5 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
        >
          {activity ? "Save Changes" : "Create Activity"}
        </button>
      </div>
    </form>
  );
}
