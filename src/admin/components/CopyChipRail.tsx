import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { CopyBlock } from "@/admin/lib/exporters/whatsapp-blocks";

export function CopyChipRail({ blocks, dense }: { blocks: CopyBlock[]; dense?: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (b: CopyBlock) => {
    try {
      await navigator.clipboard.writeText(b.text);
      setCopied(b.key);
      toast.success(`Copied "${b.label}"`);
      setTimeout(() => setCopied((c) => (c === b.key ? null : c)), 1200);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <div className={cn("flex flex-wrap gap-1.5", dense && "gap-1")}>
      {blocks.map((b) => (
        <button key={b.key} onClick={() => copy(b)} title={b.text}
          className={cn(
            "inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border transition-colors",
            b.internal
              ? "border-warning/40 bg-warning/10 text-warning-foreground hover:bg-warning/20"
              : "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20",
          )}>
          {copied === b.key ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {b.label}
          {b.internal && <span className="text-[9px] uppercase opacity-60">int</span>}
        </button>
      ))}
    </div>
  );
}
