"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Import } from "lucide-react";

type Collection = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
};

export function BatchImportDialog({
  onImported,
  trigger,
}: {
  onImported?: () => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [collection, setCollection] = React.useState<string>("");
  const [btl, setBtl] = React.useState<number | undefined>(1200);
  const [json, setJson] = React.useState<string>("");
  const [count, setCount] = React.useState<number>(0);
  const [busy, setBusy] = React.useState(false);
  const [extra, setExtra] = React.useState<{ key: string; value: string }[]>(
    []
  );

  React.useEffect(() => {
    fetch("/api/collections", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setCollections(j.items ?? []))
      .catch(() => setCollections([]));
  }, []);

  function parseItems(text: string): any[] {
    // Support: JSON array, JSONL (one JSON per line), or a simple comma-separated list of strings
    const t = text.trim();
    if (!t) return [];
    // Try JSON array first
    try {
      const arr = JSON.parse(t);
      if (Array.isArray(arr)) return arr;
    } catch {}
    // Try JSONL
    const lines = t
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const items: any[] = [];
    for (const line of lines) {
      try {
        items.push(JSON.parse(line));
      } catch {
        // fallback: treat as raw string
        items.push({ value: line });
      }
    }
    return items;
  }

  React.useEffect(() => {
    setCount(parseItems(json).length);
  }, [json]);

  function addExtra() {
    setExtra((a) => [...a, { key: "", value: "" }]);
  }
  function removeExtra(i: number) {
    setExtra((a) => a.filter((_, idx) => idx !== i));
  }
  function updateExtra(i: number, field: "key" | "value", v: string) {
    setExtra((a) =>
      a.map((row, idx) => (idx === i ? { ...row, [field]: v } : row))
    );
  }

  async function submit() {
    const items = parseItems(json);
    if (!collection) return toast.error("Pick a collection");
    if (!items.length) return toast.error("Add at least one item");

    const extraMap: Record<string, string | number> = {};
    for (const e of extra) {
      if (!e.key || !e.value) continue;
      const n = Number(e.value);
      extraMap[e.key] =
        !Number.isNaN(n) && /^\d+(\.\d+)?$/.test(e.value.trim()) ? n : e.value;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/entities/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ collection, btl, items, extra: extraMap }),
      });
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json(); // { batchId, total, entityKeys }
      toast.success(
        `Imported ${j.total} entities (batch ${j.batchId.slice(0, 8)}…)`
      );
      setOpen(false);
      setJson("");
      setExtra([]);
      onImported?.();
    } catch (e: any) {
      console.error(e);
      toast.error("Batch import failed");
    } finally {
      setBusy(false);
    }
  }

  const Trigger = trigger ?? (
    <Button variant="secondary">
      <Import className="size-4" />
      Batch import
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{Trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Batch import</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Collection & BTL */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Collection</Label>
              <Select value={collection} onValueChange={setCollection}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a collection…" />
                </SelectTrigger>
                <SelectContent>
                  {collections.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      <span
                        className="mr-2 inline-block h-3 w-3 rounded-full align-middle"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>BTL (blocks)</Label>
              <Input
                type="number"
                min={1}
                value={btl ?? ""}
                onChange={(e) =>
                  setBtl(e.target.value ? Number(e.target.value) : undefined)
                }
              />
              <p className="text-xs text-muted-foreground">~2s per block</p>
            </div>
          </div>

          {/* Paste or upload */}
          <div className="space-y-2">
            <Label>Items (JSON array or JSONL)</Label>
            <Textarea
              value={json}
              onChange={(e) => setJson(e.target.value)}
              className="min-h-[180px]"
              placeholder={`JSON array example:
[
  {"title":"Note A","body":"..."},
  {"title":"Note B","body":"..."}
]

JSONL example (one per line):
{"subject":"Ticket A","priority":2}
{"subject":"Ticket B","priority":5}
`}
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Parsed:</span>
              <span className="font-medium">{count}</span>
              <UploadJsonButton onLoaded={(text) => setJson(text)} />
            </div>
          </div>

          {/* Extra annotations (apply to all) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Extra annotations (apply to all)</Label>
              <Button variant="secondary" size="sm" onClick={addExtra}>
                Add
              </Button>
            </div>
            <div className="grid gap-2">
              {extra.map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr,1fr,auto] items-center gap-2"
                >
                  <Input
                    placeholder="key (e.g., source)"
                    value={row.key}
                    onChange={(e) => updateExtra(i, "key", e.target.value)}
                  />
                  <Input
                    placeholder="value (e.g., import)"
                    value={row.value}
                    onChange={(e) => updateExtra(i, "value", e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeExtra(i)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {!extra.length && (
                <p className="text-xs text-muted-foreground">
                  No extra annotations.
                </p>
              )}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Tip: We automatically add <code>collection</code>,{" "}
            <code>app="studio"</code>, <code>id</code>, <code>version=1</code>{" "}
            and a unique <code>batchId</code> for this import.
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !collection || !count}>
            Import {count ? `(${count})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadJsonButton({ onLoaded }: { onLoaded: (text: string) => void }) {
  const ref = React.useRef<HTMLInputElement | null>(null);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => ref.current?.click()}>
        Upload .json / .jsonl
      </Button>
      <input
        ref={ref}
        type="file"
        accept=".json,.jsonl,application/json,text/plain"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          onLoaded(text);
        }}
      />
    </>
  );
}
