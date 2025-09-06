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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PencilIcon } from "lucide-react";

type Row = {
  entityKey: `0x${string}`;
  value: any;
  annotations: {
    strings: Record<string, string>;
    numbers: Record<string, number>;
  };
};

export function EditEntityDialog({
  row,
  trigger,
  onUpdated,
}: {
  row: Row;
  trigger?: React.ReactNode;
  onUpdated?: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  const currentCollection =
    row.annotations.strings["collection"] ?? row.value?.meta?.collection ?? "";
  const [collection, setCollection] = React.useState(currentCollection || "");
  const currentId =
    row.annotations.strings["id"] ??
    (row.value?.meta?.id as string | undefined) ??
    "";
  const currentVersion = Number(
    row.annotations.numbers["version"] ?? row.value?.meta?.version ?? 0
  );

  const [btl, setBtl] = React.useState<number | undefined>(1200);
  const [json, setJson] = React.useState(
    JSON.stringify(
      // if your payload is { meta, data }, edit just data; otherwise edit whole object:
      row.value?.data ?? row.value ?? {},
      null,
      2
    )
  );
  const [jsonError, setJsonError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // collections for Select
  const [collections, setCollections] = React.useState<
    { id: string; name: string; color: string }[]
  >([]);
  React.useEffect(() => {
    fetch("/api/collections", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setCollections(j.items ?? []))
      .catch(() => setCollections([]));
  }, []);

  React.useEffect(() => {
    try {
      JSON.parse(json);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message ?? "Invalid JSON");
    }
  }, [json]);

  async function save() {
    if (!currentId) {
      toast.error("Missing entity id annotation—cannot update.");
      return;
    }
    if (jsonError) {
      toast.error("Fix JSON first");
      return;
    }
    setBusy(true);
    try {
      const parsed = JSON.parse(json);

      // If your stored payload format is { meta, data }, preserve meta and only replace data.
      // Otherwise, update with parsed as-is. Choose ONE of the two bodies below.

      const useMetaEnvelope = !!row.value?.meta || !!row.value?.data;

      const body = useMetaEnvelope
        ? {
            id: currentId,
            collection,
            version: currentVersion + 1,
            btl,
            data: {
              meta: { id: currentId, collection, version: currentVersion + 1 },
              data: parsed,
            },
          }
        : {
            id: currentId,
            collection,
            version: currentVersion + 1,
            btl,
            data: parsed,
          };

      const res = await fetch(`/api/entities/${row.entityKey}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());

      toast.success("Entity updated");
      setOpen(false);
      onUpdated?.();
    } catch (e) {
      console.error(e);
      toast.error("Update failed");
    } finally {
      setBusy(false);
    }
  }

  const Trigger = trigger ?? (
    <Button variant="ghost" size="icon">
      <PencilIcon className="size-4" color="blue" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{Trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Entity</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
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

          <div className="space-y-2">
            <Label>Payload (JSON)</Label>
            <Textarea
              className="min-h-[180px]"
              value={json}
              onChange={(e) => setJson(e.target.value)}
            />
            <div className="text-xs">
              {jsonError ? (
                <span className="text-red-500">JSON error: {jsonError}</span>
              ) : (
                <span className="text-muted-foreground">Looks good ✓</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label>Entity Key</Label>
              <Input readOnly value={row.entityKey} />
            </div>
            <div>
              <Label>Id (annotation)</Label>
              <Input readOnly value={currentId} />
            </div>
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
          <Button onClick={save} disabled={busy || !!jsonError}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
