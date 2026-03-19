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
  bucket: string;
  amount: number;
  count: number;
  fill?: string;
}

export function AgingChart({ data }: { data: Point[] }) {
  const colors = ["#10b981", "#f59e0b", "#f97316", "#ef4444"];
  return (
    <div className="h-64 min-h-[256px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
        <BarChart data={data} layout="vertical" margin={{ left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tickFormatter={(v) => v.toLocaleString()} />
          <YAxis type="category" dataKey="bucket" width={70} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: unknown) =>
              typeof value === "number" ? value.toLocaleString() : String(value ?? "")
            }
          />
          <Bar dataKey="amount" name="Amount" radius={[0, 4, 4, 0]}>
            {data.map((_, index) => (
              <Cell key={index} fill={colors[index] ?? "#94a3b8"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
