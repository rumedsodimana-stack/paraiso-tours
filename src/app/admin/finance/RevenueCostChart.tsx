"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Point {
  month: string;
  revenue: number;
  cost: number;
  margin: number;
}

export function RevenueCostChart({ data }: { data: Point[] }) {
  return (
    <div className="h-64 min-h-[256px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}`} />
          <Tooltip
            formatter={(value: unknown) =>
              typeof value === "number" ? value.toLocaleString() : String(value ?? "")
            }
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="#0d9488"
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="cost"
            name="Cost"
            stroke="#ef4444"
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="margin"
            name="Margin"
            stroke="#10b981"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
