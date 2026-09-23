"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatIDR, formatIDRCompact } from "@/lib/format";
import { budgetStats } from "@/lib/aggregate";
import type { BudgetCategory } from "@/types";

/**
 * Chart alokasi vs realisasi per kategori (FR-15, Recharts).
 * Bar horizontal → label kategori tetap terbaca di layar sempit (mobile).
 */
export function BudgetChart({ categories }: { categories: BudgetCategory[] }) {
  const data = categories
    .map((category) => ({
      name: category.categoryName,
      Alokasi: Number(category.allocatedAmount) || 0,
      Realisasi: budgetStats([category]).spent,
    }))
    .filter((row) => row.Alokasi > 0 || row.Realisasi > 0);

  if (data.length === 0) return null;

  return (
    <div className="h-72 w-full" role="img" aria-label="Chart alokasi versus realisasi budget per kategori">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10 }}
            tickFormatter={(value: number) => formatIDRCompact(value)}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={86}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            formatter={(value) => formatIDR(Number(value))}
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Alokasi" fill="#f43f5e" radius={[0, 4, 4, 0]} />
          <Bar dataKey="Realisasi" fill="#0f766e" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
