"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export interface TopHolding {
  name: string;
  value: number;
}

export interface MonthlyPnl {
  month: string;
  realizedPnl: number;
}

export interface BrokerShare {
  name: string;
  value: number;
}

export function TopHoldingsChart({ data }: { data: TopHolding[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>十大持股（依成本）</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} stroke="var(--color-border)" />
              <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} fontSize={11} stroke="var(--color-muted-foreground)" />
              <YAxis type="category" dataKey="name" width={90} fontSize={12} stroke="var(--color-muted-foreground)" />
              <Tooltip
                formatter={(v) => formatCurrency(Number(v))}
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function MonthlyPnlChart({ data }: { data: MonthlyPnl[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>月度已實現損益</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ left: 8, right: 16 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="month" fontSize={11} stroke="var(--color-muted-foreground)" />
              <YAxis tickFormatter={(v) => formatCurrency(v)} fontSize={11} stroke="var(--color-muted-foreground)" width={70} />
              <Tooltip
                formatter={(v) => formatCurrency(Number(v))}
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="realizedPnl" radius={[4, 4, 0, 0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.realizedPnl >= 0 ? "var(--color-destructive)" : "var(--color-success)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function AllocationChart({ data, title }: { data: TopHolding[]; title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v) => formatCurrency(Number(v))}
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
      尚無足夠資料產生圖表
    </div>
  );
}
