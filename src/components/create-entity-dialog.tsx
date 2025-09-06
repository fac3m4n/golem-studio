"use client";

import * as React from "react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FormSchema = z.object({
  type: z.string().min(1, "Type is required"),
  btl: z.number().int().positive().optional(),
  json: z.string().min(1, "Payload is required"),
  annotations: z.array(
    z.object({
      key: z.string().min(1),
      value: z.string().min(1),
    })
  ),
});

type Props = {
  trigger?: React.ReactNode;
  defaultType?: string;
  defaultBTL?: number;
  onCreated?: () => void; // refresh table
};

export function CreateEntityDialog({
  trigger,
  defaultType = "note",
  defaultBTL = 1200,
  onCreated,
}: Props) {
  const [open, setOpen] = React.useState(false);

  const [type, setType] = React.useState(defaultType);
  const [btl, setBtl] = React.useState<number | undefined>(defaultBTL);
  const [json, setJson] = React.useState(
    '{\n  "msg": "Hello Golem DB!",\n  "t": ' + Date.now() + "\n}"
  );
  const [ann, setAnn] = React.useState<{ key: string; value: string }[]>([
    { key: "app", value: "studio" },
  ]);

  const [jsonError, setJsonError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const [collections, setCollections] = React.useState<
    { id: string; name: string }[]
  >([]);
  React.useEffect(() => {
    fetch("/api/collections", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setCollections(j.items ?? []))
      .catch(() => setCollections([]));
  }, []);

  // live JSON validation
  React.useEffect(() => {
    try {
      JSON.parse(json);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message ?? "Invalid JSON");
    }
  }, [json]);

  function addAnn() {
    setAnn((a) => [...a, { key: "", value: "" }]);
  }
  function removeAnn(i: number) {
    setAnn((a) => a.filter((_, idx) => idx !== i));
  }
  function updateAnn(i: number, field: "key" | "value", v: string) {
    setAnn((a) =>
      a.map((row, idx) => (idx === i ? { ...row, [field]: v } : row))
    );
  }

  async function submit() {
    // validate form fields
    const parsed = FormSchema.safeParse({
      type,
      btl,
      json,
      annotations: ann.filter((a) => a.key && a.value),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    if (jsonError) {
      toast.error("Fix JSON first");
      return;
    }

    // build body
    let data: any;
    try {
      data = JSON.parse(json);
    } catch {
      data = {};
    }
    const extra: Record<string, string | number> = {};
    for (const a of parsed.data.annotations) {
      // auto-cast numbers if possible
      const num = Number(a.value);
      extra[a.key] =
        !Number.isNaN(num) &&
        a.value.trim() !== "" &&
        /^\d+(\.\d+)?$/.test(a.value.trim())
          ? num
          : a.value;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/entities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: parsed.data.type,
          btl: parsed.data.btl,
          data,
          extra,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Entity created");
      setOpen(false);
      onCreated?.();
    } catch (e: any) {
      toast.error("Create failed");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  const TriggerEl = trigger ?? <Button>Create</Button>;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{TriggerEl}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Entity</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Type & BTL */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Collection / Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a collection…" />
                </SelectTrigger>
                <SelectContent>
                  {collections.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="btl">BTL (blocks)</Label>
              <Input
                id="btl"
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

          {/* Payload JSON */}
          <div className="space-y-2">
            <Label htmlFor="json">Payload (JSON)</Label>
            <Textarea
              id="json"
              value={json}
              onChange={(e) => setJson(e.target.value)}
              className="min-h-[160px]"
            />
            <div className="text-xs">
              {jsonError ? (
                <span className="text-red-500">JSON error: {jsonError}</span>
              ) : (
                <span className="text-muted-foreground">Looks good ✓</span>
              )}
            </div>
          </div>

          {/* Annotations */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Annotations (key → value)</Label>
              <Button variant="secondary" size="sm" onClick={addAnn}>
                Add
              </Button>
            </div>
            <div className="grid gap-2">
              {ann.map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr,1fr,auto] items-center gap-2"
                >
                  <Input
                    placeholder="key (e.g., priority)"
                    value={row.key}
                    onChange={(e) => updateAnn(i, "key", e.target.value)}
                  />
                  <Input
                    placeholder="value (e.g., 5, urgent)"
                    value={row.value}
                    onChange={(e) => updateAnn(i, "value", e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAnn(i)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {!ann.length && (
                <p className="text-xs text-muted-foreground">
                  No annotations yet.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={!!jsonError || submitting}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
