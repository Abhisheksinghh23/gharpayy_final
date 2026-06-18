import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { formatRemaining, type SmartHold } from "@/lib/atc/store";

export function HoldCountdown({ hold }: { hold: SmartHold }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (hold.status !== "active") {
    const tone =
      hold.status === "converted" ? "bg-won text-white" :
      hold.status === "expired"   ? "bg-do-now text-white" :
                                    "bg-muted text-muted-foreground";
    return <Badge className={`text-[10px] ${tone}`}>{hold.status}</Badge>;
  }
  const remain = hold.expiresAt - Date.now();
  const tone =
    remain < 5 * 60_000  ? "bg-do-now text-white" :
    remain < 30 * 60_000 ? "bg-do-today text-white" :
                           "bg-do-soon text-white";
  return (
    <Badge className={`text-[10px] gap-1 ${tone}`}>
      <Clock className="h-2.5 w-2.5" /> {formatRemaining(remain)}
    </Badge>
  );
}
