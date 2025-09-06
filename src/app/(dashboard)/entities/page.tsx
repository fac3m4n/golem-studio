"use client";

import { useEffect, useMemo, useState } from "react";
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
import { CreateEntityDialog } from "@/components/create-entity-dialog";
import { EditEntityDialog } from "@/components/edit-entity-dialog";
import { Search, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { ExpiryBar } from "@/components/expiry";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Item = {
  entityKey: `0x${string}`;
  value: any;
  annotations: {
    strings: Record<string, string>;
    numbers: Record<string, number>;
  };
  expiresAtBlock?: number;
};

function textColorOn(bgHex: string) {
  // simple luminance check; assumes #rrggbb
  const hex = bgHex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 160 ? "#111827" /* slate-900 */ : "#ffffff";
}

export default function EntitiesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const [head, setHead] = useState<number>(0);

  async function fetchHead() {
    try {
      const res = await fetch("/api/chain", { cache: "no-store" });
      const j = await res.json();
      if (j?.currentBlock) setHead(j.currentBlock);
    } catch {}
  }

  useEffect(() => {
    fetchHead();
    const t = setInterval(fetchHead, 10000); // every 10s; adjust as you like
    return () => clearInterval(t);
  }, []);

  const [collections, setCollections] = useState<
    { id: string; name: string; color: string }[]
  >([]);
  useEffect(() => {
    fetch("/api/collections", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setCollections(j.items ?? []))
      .catch(() => {});
  }, []);

  const typeColor = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of collections) map[c.name] = c.color;
    return map;
  }, [collections]);

  async function load() {
    setLoading(true);
    const sp = new URLSearchParams();
    if (collectionFilter) sp.set("collection", collectionFilter);
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
        collection: collectionFilter,
        data: { msg: "Hello Golem DB!", t: Date.now() },
        extra: { app: "studio" },
      }),
    });
    if (!res.ok) return toast.error("Create failed");
    toast.success("Entity created");
    load();
  }

  async function remove(key: string) {
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
            placeholder="collection (note,ticket,…)"
            value={collectionFilter}
            onChange={(e) => setCollectionFilter(e.target.value)}
            className="w-44"
          />
          <Input
            placeholder='query (e.g., id = "…" || version > 0)'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-80"
          />
          <Button variant="secondary" onClick={load} disabled={loading}>
            <Search className="size-4" />
            Search
          </Button>
          <CreateEntityDialog
            defaultCollection={collectionFilter || "note"}
            defaultBTL={1200}
            onCreated={load}
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Collection</TableHead>
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
                  <Link
                    href={`https://explorer.ethwarsaw.holesky.golemdb.io/entity/${it.entityKey}`}
                    className="text-blue-500 hover:underline"
                    target="_blank"
                  >
                    {it.entityKey.substring(0, 6)}...
                    {it.entityKey.substring(62)}
                  </Link>
                </TableCell>
                <TableCell>
                  {(() => {
                    const collectionName =
                      it.annotations.strings["collection"] ?? "-";
                    const color = typeColor[collectionName] ?? "#e5e7eb"; // fallback gray-200
                    const fg = textColorOn(color);
                    return (
                      <Badge
                        style={{
                          backgroundColor: color,
                          color: fg,
                        }}
                        title={collectionName}
                      >
                        {collectionName}
                      </Badge>
                    );
                  })()}
                </TableCell>
                <TableCell>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">
                    {JSON.stringify(it.value, null, 2)}
                  </pre>
                </TableCell>
                <TableCell>
                  {it.annotations.numbers["version"] ?? "-"}
                </TableCell>
                <TableCell>
                  {" "}
                  <ExpiryBar
                    expiresAtBlock={it.expiresAtBlock}
                    currentBlock={head}
                  />
                </TableCell>

                <TableCell className="flex items-center gap-2">
                  <EditEntityDialog row={it} onUpdated={load} />

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost">
                        <Trash2Icon className="size-4" color="red" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Entity</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this entity? This
                          action cannot be undone.
                          <br />
                          <br />
                          <strong>Entity Key:</strong>{" "}
                          {it.entityKey.slice(0, 6)}...{it.entityKey.slice(62)}
                          <br />
                          <strong>Collection:</strong>{" "}
                          {it.annotations.strings["collection"] ?? "-"}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => remove(it.entityKey)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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
