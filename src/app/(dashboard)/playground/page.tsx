"use client";

import * as React from "react";
import Editor, { OnMount } from "@monaco-editor/react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ---------- Types from your API ----------
type Row = {
  entityKey: `0x${string}`;
  value: any;
  annotations: {
    strings: Record<string, string>;
    numbers: Record<string, number>;
  };
  expiresAtBlock?: number;
};

type Collection = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
};
type SavedQuery = { id: string; name: string; query: string; ts: number };

// ---------- Constants ----------
const BASE_FIELDS = ["app", "collection", "id"];
const NUM_FIELDS = ["version"];
const OPERATORS = ["=", ">", "<", "&&", "||"];
const START_QUERY = 'app = "studio" && collection = "users"';
const LS_KEY = "golemStudio.savedQueries";

// ---------- LocalStorage helpers ----------
function loadSaved(): SavedQuery[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveSaved(list: SavedQuery[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

// ---------- Monaco completion helpers (use numeric kinds to avoid types leakage) ----------
const CompletionItemKind = {
  Keyword: 14,
  Operator: 25,
  Text: 12,
} as const;

function mkKeyword(label: string, detail?: string) {
  return { label, kind: CompletionItemKind.Keyword, insertText: label, detail };
}
function mkOp(op: string) {
  return {
    label: op,
    kind: CompletionItemKind.Operator,
    insertText: ` ${op} `,
    detail: "operator",
  };
}
function mkValue(v: string, detail?: string) {
  return {
    label: v.replaceAll('"', ""),
    kind: CompletionItemKind.Text,
    insertText: v,
    detail,
  };
}

// ---------- NL → Query (rule-based demo; swap later with AI) ----------
function nl2query(s: string): string {
  const t = s.toLowerCase().trim();

  const type =
    (/\bnotes?\b/.test(t) && "note") ||
    (/\btickets?\b/.test(t) && "ticket") ||
    (/\bposts?\b/.test(t) && "post") ||
    undefined;

  const vgt = t.match(/version\s*>\s*(\d+)/);
  const vlt = t.match(/version\s*<\s*(\d+)/);
  const veq = t.match(/version\s*=\s*(\d+)/);

  const parts: string[] = [`collection = "users"`];
  if (type) parts.push(`type = "${type}"`);
  if (vgt) parts.push(`version > ${vgt[1]}`);
  if (vlt) parts.push(`version < ${vlt[1]}`);
  if (veq) parts.push(`version = ${veq[1]}`);

  const id = t.match(/\bid[:\s]+([0-9a-f-]{6,})/);
  if (id) parts.push(`id = "${id[1]}"`);

  return parts.join(" && ");
}

// ---------- Component ----------
export default function QueryPlayground() {
  const [query, setQuery] = React.useState<string>(START_QUERY);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [types, setTypes] = React.useState<string[]>([]);
  const [versions, setVersions] = React.useState<number[]>([]);
  const [limit, setLimit] = React.useState<number>(50);
  const [saved, setSaved] = React.useState<SavedQuery[]>([]);
  const [stats, setStats] = React.useState<{ ms: number; count: number }>({
    ms: 0,
    count: 0,
  });

  const editorRef = React.useRef<monaco.editor.IStandaloneCodeEditor | null>(
    null
  );

  // Load collections (for dynamic suggestions)
  React.useEffect(() => {
    fetch("/api/collections", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setCollections(j.items ?? []))
      .catch(() => setCollections([]));
  }, []);

  // Live data sample → extract distinct types/versions for autocomplete
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          "/api/entities?" +
            new URLSearchParams({
              q: 'collection = "users"',
              limit: "200",
            }).toString(),
          { cache: "no-store" }
        );
        const j = await res.json();
        const tset = new Set<string>();
        const vset = new Set<number>();
        for (const r of j.items ?? []) {
          const t = r?.annotations?.strings?.collection;
          if (t) tset.add(String(t));
          const v = r?.annotations?.numbers?.version;
          if (typeof v === "number") vset.add(v);
        }
        setTypes(Array.from(tset).sort());
        setVersions(Array.from(vset).sort((a, b) => a - b));
      } catch {}
    })();
  }, []);

  // Saved queries
  React.useEffect(() => {
    setSaved(loadSaved());
  }, []);

  function doSaveQuery(name?: string) {
    const nm = name || prompt("Name this query:");
    if (!nm) return;
    const now = Date.now();
    const item: SavedQuery = {
      id: crypto.randomUUID(),
      name: nm.trim(),
      query,
      ts: now,
    };
    const list = [item, ...saved].slice(0, 50);
    setSaved(list);
    saveSaved(list);
    toast.success("Saved query");
  }
  function loadQuery(id: string) {
    const item = saved.find((s) => s.id === id);
    if (!item) return;
    setQuery(item.query);
    toast.success(`Loaded: ${item.name}`);
  }
  function deleteQuery(id: string) {
    const list = saved.filter((s) => s.id !== id);
    setSaved(list);
    saveSaved(list);
  }

  // Run query
  async function run(forcedQuery?: string) {
    setLoading(true);
    const t0 = performance.now();
    try {
      const current =
        forcedQuery ??
        editorRef.current?.getValue() ?? // ← freshest text from Monaco
        query;

      // keep state in sync (so Run button uses same text after a hotkey run)
      if (current !== query) setQuery(current);

      const params = new URLSearchParams({ q: current, limit: String(limit) });
      const res = await fetch("/api/entities?" + params.toString(), {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const items = json.items ?? [];
      setRows(items);
      setStats({
        ms: Math.max(1, Math.round(performance.now() - t0)),
        count: items.length,
      });
    } catch (e) {
      toast.error("Query failed");
      console.error(e);
      setStats({ ms: 0, count: 0 });
    } finally {
      setLoading(false);
    }
  }

  // Monaco setup
  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    monaco.languages.register({ id: "golem-query" });
    monaco.languages.setMonarchTokensProvider("golem-query", {
      tokenizer: {
        root: [
          [/\b(and|or)\b/i, "operator"],
          [/\b(collection|id|version)\b/, "key"],
          [/\s(=|&&|\|\||>|<)\s/, "operator"],
          [/".*?"/, "string"],
          [/\d+/, "number"],
        ],
      },
    });
    monaco.editor.defineTheme("golem-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "key", foreground: "86C5FF", fontStyle: "bold" },
        { token: "operator", foreground: "FFD479" },
        { token: "string", foreground: "C3E88D" },
        { token: "number", foreground: "F78C6C" },
      ],
      colors: {},
    });
    monaco.editor.setTheme("golem-dark");

    monaco.languages.registerCompletionItemProvider("golem-query", {
      triggerCharacters: [" ", '"', "=", "&", "|", ">", "<"],
      provideCompletionItems: (model, position) => {
        const text = model.getValue().slice(0, model.getOffsetAt(position));
        const last = text.trim().slice(-1);
        const suggestValues =
          last === "=" ||
          last === '"' ||
          /(\bcollection|\bid|\bversion)\s*=\s*$/i.test(text);

        const fieldSuggestions = [
          ...BASE_FIELDS.map((k) => mkKeyword(k, "field")),
          ...NUM_FIELDS.map((k) => mkKeyword(k, "number field")),
        ];
        const opSuggestions = OPERATORS.map((op) => mkOp(op));
        const dynCollectionValues = types.map((n) =>
          mkValue(`"${n}"`, "Known collection")
        );
        const dynVersionValues = versions.map((v) =>
          mkValue(String(v), "Known version")
        );
        const commonValues = [mkValue(`"users"`, "Common collection name")];
        const collectionNames = collections.map((c) => c.name);

        const valueSuggestions = [
          ...collectionNames.map((n) => mkValue(`"${n}"`, "Collection")),
          ...versions.map((v) => mkValue(String(v), "Known version")),
          mkValue(`"studio"`, "App tag"), // handy
        ];

        const suggestions = suggestValues
          ? valueSuggestions
          : [...fieldSuggestions, ...opSuggestions];

        return { suggestions };
      },
    });

    // Shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      run(editor.getValue());
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const firstLine = editor.getValue().split("\n")[0]?.trim() || "Query";
      doSaveQuery(firstLine.slice(0, 50));
    });
    editor.addCommand(monaco.KeyCode.Escape, () =>
      (document.activeElement as HTMLElement)?.blur()
    );

    // Global ⌘/Ctrl+K focus
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        editor.focus();
      }
    };
    window.addEventListener("keydown", handler);
    // cleanup
    editor.onDidDispose(() => window.removeEventListener("keydown", handler));
  };

  // UI actions
  async function copyResults() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
      toast.success("Results copied");
    } catch {
      toast.error("Clipboard failed");
    }
  }

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Query Playground</h1>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            className="w-24"
            value={limit}
            min={1}
            onChange={(e) => setLimit(Number(e.target.value || 50))}
          />
          <span className="text-sm text-muted-foreground">Limit</span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Saved</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[260px]">
              {saved.length ? (
                saved.map((sq) => (
                  <DropdownMenuItem
                    key={sq.id}
                    onClick={() => loadQuery(sq.id)}
                  >
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="truncate">{sq.name}</span>
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteQuery(sq.id);
                        }}
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No saved queries
                </div>
              )}
              <div className="border-t" />
              <DropdownMenuItem onClick={() => doSaveQuery()}>
                + Save current
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={() => run()} disabled={loading}>
            {loading ? "Running…" : "Run (⌘/Ctrl+Enter)"}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border">
            <Editor
              height="220px"
              defaultLanguage="golem-query"
              language="golem-query"
              value={query}
              onChange={(v) => setQuery(v ?? "")}
              onMount={onMount}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                wordWrap: "on",
                automaticLayout: true,
              }}
            />
          </div>

          {/* Status line */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div>
              {stats.count ? `${stats.count} rows` : "—"}{" "}
              {stats.ms ? `• ${stats.ms} ms` : ""}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Results</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={copyResults}
              disabled={!rows.length}
            >
              Copy results
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Collection</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.entityKey}>
                    <TableCell className="font-mono text-xs">
                      {r.entityKey.slice(0, 12)}…
                    </TableCell>
                    <TableCell>
                      {r.annotations.strings["collection"] ?? "-"}
                    </TableCell>
                    <TableCell>
                      {r.annotations.numbers["version"] ?? "-"}
                    </TableCell>
                    <TableCell>
                      <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">
                        {JSON.stringify(r.value, null, 2)}
                      </pre>
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      No results yet. Write a query and hit Run.
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
