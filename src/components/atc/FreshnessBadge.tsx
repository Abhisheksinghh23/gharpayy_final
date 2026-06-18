import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { freshnessFor, reconfirmProperty, useATC } from "@/lib/atc/store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function FreshnessBadge({ propertyId, compact = false }: { propertyId: string; compact?: boolean }) {
  useATC(); // subscribe
  const f = freshnessFor(propertyId);
  if (!f.stale && f.ageMs !== null) {
    const m = Math.floor(f.ageMs / 60000);
    return (
      <Badge variant="outline" className="text-[10px] gap-1 border-won/40 text-won">
        <ShieldCheck className="h-2.5 w-2.5" /> verified {m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`}
      </Badge>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant="outline" className="text-[10px] gap-1 border-do-today/50 text-do-today">
        <AlertTriangle className="h-2.5 w-2.5" /> needs reconfirm
      </Badge>
      {!compact && (
        <Button
          size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]"
          onClick={(e) => {
            e.stopPropagation();
            reconfirmProperty(propertyId);
            toast.success("Marked verified");
          }}
        >
          reconfirm
        </Button>
      )}
    </span>
  );
}
