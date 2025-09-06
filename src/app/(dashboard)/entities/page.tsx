"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Item = {
  entityKey: `0x${string}`;
  value: any;
  annotations: {
    strings: Record<string, string>;
    numbers: Record<string, number>;
  };
  expiresAtBlock?: number;
};

export default function EntitiesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("note");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const sp = new URLSearchParams();
    if (type) sp.set("type", type);
    if (search) sp.set("q", search);
    const res = await fetch(`/api/entities?${sp.toString()}`, {
      cache: "no-store",
    });
    const json = await res.json();
    setItems(json.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, []);

  async function createQuick() {
    const res = await fetch("/api/entities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: type || "note",
        data: { msg: "Hello Golem DB!", t: Date.now() },
        extra: { app: "studio" },
      }),
    });
    if (!res.ok) return toast.error("Create failed");
    toast.success("Entity created");
    load();
  }

  async function remove(key: string) {
    const ok = confirm("Delete this entity?");
    if (!ok) return;
    const res = await fetch(`/api/entities/${key}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Delete failed");
    toast.success("Entity deleted");
    load();
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Entities</h1>
        <div className="flex items-center gap-2">
          <Input
            placeholder="type (note,ticket,…)"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-44"
          />
          <Input
            placeholder='query (e.g., id = "…" || version > 0)'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-80"
          />
          <Button variant="secondary" onClick={load} disabled={loading}>
            Search
          </Button>
          <Button onClick={createQuick} disabled={loading}>
            Create
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Expires (block)</TableHead>

              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow key={it.entityKey}>
                <TableCell className="font-mono text-xs">
                  {it.entityKey.slice(0, 12)}…
                </TableCell>
                <TableCell>{it.annotations.strings["type"] ?? "-"}</TableCell>
                <TableCell>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">
                    {JSON.stringify(it.value, null, 2)}
                  </pre>
                </TableCell>
                <TableCell>
                  {it.annotations.numbers["version"] ?? "-"}
                </TableCell>
                <TableCell>{it.expiresAtBlock ?? "-"}</TableCell>

                <TableCell>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => remove(it.entityKey)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!items.length && !loading && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  No data
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
