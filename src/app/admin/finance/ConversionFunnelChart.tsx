"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Point {
  status: string;
  label: string;
  count: number;
}

const COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#10b981", "#94a3b8"];

export function ConversionFunnelChart({ data }: { data: Point[] }) {
  return (
    <div className="h-64 min-h-[256px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: unknown) =>
              typeof value === "number" ? value.toLocaleString() : String(value ?? "")
            }
          />
          <Bar dataKey="count" name="Leads" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
