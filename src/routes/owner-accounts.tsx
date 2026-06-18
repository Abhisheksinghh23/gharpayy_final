import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useMemo, useState } from "react";
import {
  allOwnerAccounts, loginAsOwner, useOwnerSession, ownerScorecard, pgsForOwnerCode,
} from "@/lib/owners/account-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Phone, Building2, LogIn, ArrowRight, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/owner-accounts")({
  head: () => ({ meta: [{ title: "Owner Accounts — Gharpayy" }] }),
  component: () => <AppShell><OwnerAccountsPage /></AppShell>,
});

function OwnerAccountsPage() {
  const session = useOwnerSession();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const accounts = useMemo(() => allOwnerAccounts(), []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return accounts;
    return accounts.filter((a) =>
      a.name.toLowerCase().includes(t) ||
      a.phone.includes(t) ||
      a.code.toLowerCase().includes(t),
    );
  }, [accounts, q]);

  const handleLogin = (code: string, name: string) => {
    loginAsOwner(code);
    toast.success(`Signed in as ${name}`);
    navigate({ to: "/owner-portal" });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Owner accounts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            One account per owner in the Property Hub. Sign in as any owner to update live inventory —
            Impact will only schedule tours against beds the owner has confirmed available.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{accounts.length} owners</Badge>
          {session && (
            <Button asChild size="sm" variant="outline">
              <Link to="/owner-portal">My portal <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
            </Button>
          )}
        </div>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search owner by name, phone or account code…"
          className="pl-9 h-9"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((a) => {
          const sc = ownerScorecard(a.code);
          const pgs = pgsForOwnerCode(a.code);
          const isMe = session === a.code;
          return (
            <div key={a.code} className={`rounded-lg border bg-card p-4 space-y-2 ${isMe ? "border-primary/60 ring-1 ring-primary/30" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{a.name}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span className="font-mono">{a.code}</span>
                    {a.phone && (
                      <a href={`tel:${a.phone}`} className="flex items-center gap-1 hover:text-primary">
                        <Phone className="h-3 w-3" />{a.phone}
                      </a>
                    )}
                  </div>
                </div>
                {isMe && <Badge className="text-[10px]">Signed in</Badge>}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Badge variant="outline" className="gap-1"><Building2 className="h-3 w-3" />{a.pgCount} PG{a.pgCount > 1 ? "s" : ""}</Badge>
                <Badge variant="outline">{sc.availableBeds} beds live</Badge>
                {sc.paused > 0 && <Badge variant="destructive" className="text-[10px]">{sc.paused} paused</Badge>}
                {sc.stale > 0 && <Badge variant="outline" className="text-[10px] border-do-now/40 text-do-now">{sc.stale} stale</Badge>}
              </div>

              <div className="text-[11px] text-muted-foreground line-clamp-2">
                {pgs.slice(0, 3).map((p) => p.name).join(" · ")}
                {pgs.length > 3 && ` +${pgs.length - 3} more`}
              </div>

              <Button
                size="sm"
                className="w-full h-8 text-xs gap-1"
                variant={isMe ? "outline" : "default"}
                onClick={() => handleLogin(a.code, a.name)}
              >
                <LogIn className="h-3.5 w-3.5" />
                {isMe ? "Open portal" : "Sign in as owner"}
              </Button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-sm text-muted-foreground py-12">
            No owners match “{q}”.
          </div>
        )}
      </div>
    </div>
  );
}