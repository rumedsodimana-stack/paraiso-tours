import type { AuditLog } from "@/lib/types";

function formatAuditTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditTimeline({
  title = "Activity",
  logs,
}: {
  title?: string;
  logs: AuditLog[];
}) {
  if (logs.length === 0) return null;

  return (
    <section className="rounded-2xl border border-white/30 bg-white/45 p-5 shadow-sm backdrop-blur-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
          {title}
        </h2>
      </div>
      <div className="space-y-3">
        {logs.map((log) => (
          <div
            key={log.id}
            className="rounded-xl border border-white/30 bg-white/60 px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-stone-900">{log.summary}</p>
              <span className="text-xs font-medium text-stone-500">
                {formatAuditTime(log.createdAt)}
              </span>
            </div>
            <p className="mt-1 text-xs uppercase tracking-wide text-stone-500">
              {log.actor} · {log.action.replace(/_/g, " ")}
            </p>
            {log.details?.length ? (
              <ul className="mt-2 space-y-1 text-sm text-stone-600">
                {log.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
