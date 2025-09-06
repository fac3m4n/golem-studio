import * as React from "react";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ExpiryProps = {
  expiresAtBlock?: number;
  currentBlock: number;
};

// Thresholds (blocks); tweak for your UX:
// 1800 blocks ≈ 1 hour, 300 ≈ 10 min on Kaolin
const GREEN = 1800;
const ORANGE = 300;

// cap the bar to GREEN for a nice scale (everything > GREEN shows full green bar)
function calc(expiresAt: number, head: number) {
  const remaining = Math.max(0, expiresAt - head);
  const pct = Math.min(100, Math.round((remaining / GREEN) * 100));
  let color = "bg-[--green]"; // you can map to Tailwind classes below
  if (remaining <= ORANGE) color = "bg-red-500";
  else if (remaining <= GREEN) color = "bg-amber-500";
  else color = "bg-emerald-500";
  return { remaining, pct, color };
}

export function ExpiryBar({ expiresAtBlock, currentBlock }: ExpiryProps) {
  if (!expiresAtBlock || !currentBlock)
    return <span className="text-muted-foreground">-</span>;
  const { remaining, pct, color } = calc(expiresAtBlock, currentBlock);
  const secs = remaining * 2; // ~2s per block
  const mins = Math.floor(secs / 60);
  const s = secs % 60;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 min-w-[180px]">
            <div className="relative w-full">
              <Progress value={pct} className="h-2">
                {/* shadcn Progress doesn’t accept color prop, so we tint via CSS override */}
              </Progress>
              <div
                className={`pointer-events-none absolute inset-0 rounded-full ${color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-20 tabular-nums text-xs text-muted-foreground">
              {remaining} blk
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <div>
              <b>Remaining:</b> {remaining} blocks
            </div>
            <div>
              ≈ {mins}m {s}s
            </div>
            <div>
              <b>Expires at block:</b> {expiresAtBlock}
            </div>
            <div>
              <b>Head:</b> {currentBlock}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
