"use client";
import * as React from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateCollectionDialog } from "@/components/create-collection-dialog";
import { Trash2Icon } from "lucide-react";

type Collection = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
};

export default function CollectionsPage() {
  const [items, setItems] = React.useState<Collection[]>([]);
  const [loading, setLoading] = React.useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/collections", { cache: "no-store" });
    const json = await res.json();
    setItems(json.items ?? []);
    setLoading(false);
  }
  React.useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    if (
      !confirm("Delete this collection? (Does NOT delete entities on Golem DB)")
    )
      return;
    const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Delete failed");
    toast.success("Collection deleted");
    load();
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Collections</h1>
        <CreateCollectionDialog onCreated={load} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Card key={c.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg">{c.name}</CardTitle>
                <div
                  className="mt-1 h-2 w-12 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Created: {format(c.createdAt, "yyyy-MM-dd HH:mm")}
              </CardContent>
              <CardFooter className="mt-auto flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono">
                  {c.id.slice(0, 8)}…
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => remove(c.id)}
                >
                  <Trash2Icon className="size-4" color="red" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          No collections yet. Create one to start organizing your entities.
        </div>
      )}
    </section>
  );
}
