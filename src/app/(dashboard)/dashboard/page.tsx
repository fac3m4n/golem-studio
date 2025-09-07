"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  Cell,
} from "recharts";
import { RefreshCwIcon } from "lucide-react";

type ByCollection = { name: string; color: string; count: number };
type RecentItem = {
  entityKey: `0x${string}`;
  collection?: string;
  version?: number;
  value: any;
  expiresAtBlock?: number;
};
type Summary = {
  headBlock: number;
  totals: {
    totalEntities: number;
    totalCollections: number;
    expiringSoon: number;
  };
  byCollection: ByCollection[];
  recent: RecentItem[];
};

export default function DashboardPage() {
  const [data, setData] = React.useState<Summary | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const j = await res.json();
      setData(j);
    } finally {
      setLoading(false);
    }
  }
  React.useEffect(() => {
    load();
  }, []);

  // Build a tiny “recency pulse” area from recent[] (just count by collection top 5)
  const pulse = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of data?.recent ?? []) {
      const k = r.collection || "other";
      counts[k] = (counts[k] ?? 0) + 1;
    }
    const entries = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    // synthesize a tiny time-like series for animation
    return entries.map(([k, v], i) => ({ name: k, t: i + 1, value: v }));
  }, [data]);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={load} disabled={loading}>
            <RefreshCwIcon className={loading ? "animate-spin" : ""} />
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KPICard
          title="Entities"
          value={fmt(data?.totals.totalEntities)}
          hint="Studio scope"
          growth="+5.2%"
        />
        <KPICard
          title="Collections"
          value={fmt(data?.totals.totalCollections)}
          hint="From SQLite"
          growth="+1"
        />
        <KPICard
          title="Expiring soon"
          value={fmt(data?.totals.expiringSoon)}
          hint="≤ ~10 min"
          growth="-0.8%"
          negative
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* EvilCharts-style glowing bars */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Entities by collection</CardTitle>
            <span className="text-xs text-muted-foreground">Top 12</span>
          </CardHeader>
          <CardContent className="relative">
            {/* dotted bg like EvilCharts */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(theme(colors.slate.200)_1px,transparent_1px)] [background-size:14px_14px] dark:bg-[radial-gradient(theme(colors.slate.800)_1px,transparent_1px)]" />
            <div className="relative h-[280px] w-full">
              {data?.byCollection?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byCollection.slice(0, 12)} barSize={16}>
                    <CartesianGrid
                      vertical={false}
                      stroke="rgba(148,163,184,0.15)"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(148,163,184,0.12)" }}
                      contentStyle={{ fontSize: 12 }}
                    />

                    <defs>
                      {data.byCollection.slice(0, 12).map((entry, idx) => (
                        <linearGradient
                          key={idx}
                          id={`colGradient-${idx}`}
                          x1="0"
                          x2="0"
                          y1="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={entry.color}
                            stopOpacity={0.9}
                          />
                          <stop
                            offset="100%"
                            stopColor={entry.color}
                            stopOpacity={0.2}
                          />
                        </linearGradient>
                      ))}
                    </defs>

                    <Bar
                      dataKey="count"
                      radius={[8, 8, 2, 2]}
                      animationDuration={700}
                      isAnimationActive
                    >
                      {data.byCollection.slice(0, 12).map((_entry, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={`url(#colGradient-${idx})`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No collections yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Soft area pulse (animated) */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent pulse</CardTitle>
            <span className="text-xs text-muted-foreground">
              Head block:{" "}
              {data?.headBlock
                ? Intl.NumberFormat().format(data.headBlock)
                : "—"}
            </span>
          </CardHeader>
          <CardContent className="relative">
            {/* gradient stripe bg */}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(59,130,246,0.05))]" />
            <div className="relative h-[280px] w-full">
              {pulse.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={pulse}>
                    <CartesianGrid
                      vertical={false}
                      stroke="rgba(148,163,184,0.15)"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ stroke: "rgba(59,130,246,0.35)" }}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <defs>
                      <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="rgb(59,130,246)"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor="rgb(59,130,246)"
                          stopOpacity={0.06}
                        />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="rgb(59,130,246)"
                      strokeWidth={2.2}
                      fill="url(#areaFill)"
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                      animationDuration={700}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No recent data yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent snapshot table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent snapshot</CardTitle>
          <span className="text-xs text-muted-foreground">
            Last {data?.recent?.length ?? 0} items
          </span>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Collection</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead className="w-[55%]">Preview</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.recent ?? []).length ? (
                  data!.recent.map((r) => (
                    <TableRow key={r.entityKey}>
                      <TableCell className="font-mono text-[11px]">
                        {short(r.entityKey)}
                      </TableCell>
                      <TableCell>
                        <CollectionBadge name={r.collection ?? "-"} />
                      </TableCell>
                      <TableCell>{r.version ?? "-"}</TableCell>
                      <TableCell>
                        <pre className="max-h-28 overflow-auto whitespace-pre-wrap text-xs">
                          {JSON.stringify(r.value?.data ?? r.value, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      No data yet. Create an entity to see it here.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function KPICard({
  title,
  value,
  hint,
  growth,
  negative,
}: {
  title: string;
  value: string;
  hint?: string;
  growth?: string;
  negative?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-semibold">{value}</div>
          {growth && (
            <span
              className={`text-xs ${
                negative ? "text-red-500" : "text-emerald-500"
              }`}
            >
              {growth}
            </span>
          )}
        </div>
        {hint && (
          <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
        )}
      </CardContent>
    </Card>
  );
}

function fmt(n?: number) {
  return typeof n === "number" ? Intl.NumberFormat().format(n) : "—";
}
function short(s?: string) {
  return s ? s.slice(0, 10) + "…" : "—";
}

function CollectionBadge({ name }: { name: string }) {
  const [color, setColor] = React.useState<string>("#e5e7eb");
  React.useEffect(() => {
    fetch("/api/collections", { cache: "force-cache" })
      .then((r) => r.json())
      .then((j) => {
        const hit = (j.items ?? []).find((c: any) => c.name === name);
        if (hit?.color) setColor(hit.color);
      })
      .catch(() => {});
  }, [name]);

  const fg = textColorOn(color);
  return (
    <Badge
      style={{
        backgroundColor: color,
        color: fg,
        border: "1px solid rgba(0,0,0,0.06)",
      }}
      className="font-medium"
    >
      {name}
    </Badge>
  );
}
function textColorOn(bgHex: string) {
  const hex = bgHex.replace("#", "");
  if (hex.length < 6) return "#111827";
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 160 ? "#111827" : "#ffffff";
}
