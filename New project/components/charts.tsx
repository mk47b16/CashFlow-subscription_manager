"use client";

import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { categoryColors, currency } from "../lib/intelligence";
import { Category } from "../lib/types";

export type TrendPoint = { month: string; spend: number };
export type CategorySlice = { name: string; value: number };

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="spend" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#9c6b4b" stopOpacity=".4" />
            <stop offset="1" stopColor="#9c6b4b" stopOpacity="0" />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
        <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => currency(v).replace(/\.\d+/, "")} style={{ fontSize: 10 }} />
        <Tooltip formatter={(v: number) => currency(v)} contentStyle={{ background: "#f7f1e8", border: "1px solid #c8b7a6", borderRadius: 12, color: "#2e2a26" }} />
        <Area dataKey="spend" type="monotone" stroke="#9c6b4b" strokeWidth={2.5} fill="url(#spend)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data }: { data: CategorySlice[] }) {
  return (
    <PieChart width={150} height={150}>
      <Pie data={data} dataKey="value" innerRadius={48} outerRadius={69} paddingAngle={3}>
        {data.map(entry => <Cell key={entry.name} fill={categoryColors[entry.name as Category] ?? categoryColors.Other} />)}
      </Pie>
      <Tooltip formatter={(v: number) => currency(v)} contentStyle={{ background: "#101c39", border: "1px solid #2a3b61", borderRadius: 12 }} />
    </PieChart>
  );
}
