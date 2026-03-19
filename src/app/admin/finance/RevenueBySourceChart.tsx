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
  source: string;
  revenue: number;
  tourCount: number;
}

const COLORS = ["#0d9488", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];

export function RevenueBySourceChart({ data }: { data: Point[] }) {
  return (
    <div className="h-64 min-h-[256px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
        <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tickFormatter={(v) => v.toLocaleString()} />
          <YAxis type="category" dataKey="source" width={90} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: unknown) =>
              typeof value === "number" ? value.toLocaleString() : String(value ?? "")
            }
          />
          <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
