"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Point {
  month: string;
  incoming: number;
  outgoing: number;
}

export function CashFlowChart({ data }: { data: Point[] }) {
  return (
    <div className="h-64 min-h-[256px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}`} />
          <Tooltip
            formatter={(value: unknown) =>
              typeof value === "number" ? value.toLocaleString() : String(value ?? "")
            }
          />
          <Legend />
          <Bar dataKey="incoming" name="Incoming" fill="#10b981" />
          <Bar dataKey="outgoing" name="Outgoing" fill="#ef4444" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
