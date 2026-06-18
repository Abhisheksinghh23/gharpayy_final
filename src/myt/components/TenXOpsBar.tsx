import { useEffect, useState } from 'react';
import { Activity, Bell, ClipboardCopy, Sunrise, TrendingUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

export interface TenXDigestItem {
  id: string;
  title: string;
  subtitle?: string;
  tag?: string;
}

interface Props {
  role: 'Flow Ops' | 'TCM';
  /** completed/booked/quotes-sent count for today */
  moved: number;
  /** count of SLA breaches / overdue items */
  breach: number;
  /** current toward target (e.g. tours scheduled today) */
  current: number;
  target: number;
  targetLabel: string;
  /** top 5 next actions to do */
  top5: TenXDigestItem[];
  /** stalled items needing escalation */
  stalled: TenXDigestItem[];
}

/**
 * 10x command bar: live re-rank pulse, streak counter, SLA breach pulse,
 * target progress, and one-tap daily-digest copy to WhatsApp.
 * Drop this at the top of any operator dashboard.
 */
export function TenXOpsBar({ role, moved, breach, current, target, targetLabel, top5, stalled }: Props) {
  const [lastRerank, setLastRerank] = useState<number>(() => Date.now());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => t + 1);
      setLastRerank(Date.now());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const ago = Math.max(0, Math.floor((Date.now() - lastRerank) / 1000));
  const agoLabel = ago < 60 ? `${ago}s ago` : `${Math.floor(ago / 60)}m ago`;
  void tick;

  const progress = Math.min(100, Math.round((current / Math.max(target, 1)) * 100));

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/10 via-card to-success/5 backdrop-blur-xl">
      <div className="h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="flex flex-wrap items-center gap-3 md:gap-4 p-3">
        {/* Live pulse */}
        <div className="flex items-center gap-2">
          <div className="relative h-2.5 w-2.5">
            <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-60" />
            <span className="absolute inset-0 rounded-full bg-success" />
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">{role} · live</div>
            <div className="text-[11px] font-mono">re-rank {agoLabel}</div>
          </div>
        </div>

        <Sep />

        {/* Streak */}
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-success/15 text-success flex items-center justify-center">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Streak</div>
            <div className="text-base font-heading font-semibold leading-none">{moved}<span className="text-[10px] text-muted-foreground ml-1">moved</span></div>
          </div>
        </div>

        <Sep />

        {/* SLA breach pulse */}
        <div className="flex items-center gap-2">
          <div className={`relative h-9 w-9 rounded-md flex items-center justify-center ${breach > 0 ? 'bg-danger/15 text-danger' : 'bg-muted text-muted-foreground'}`}>
            <Bell className="h-4 w-4" />
            {breach > 0 && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-danger animate-pulse" />}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">SLA breach</div>
            <div className={`text-base font-heading font-semibold leading-none ${breach > 0 ? 'text-danger' : ''}`}>{breach}<span className="text-[10px] text-muted-foreground ml-1">items</span></div>
          </div>
        </div>

        <Sep />

        {/* Target progress */}
        <div className="flex items-center gap-2 min-w-[160px] flex-1">
          <div className="h-9 w-9 rounded-md bg-primary/15 text-primary flex items-center justify-center">
            <Activity className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">{targetLabel}</div>
              <div className="text-[10px] font-mono text-muted-foreground">{current}/{target}</div>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
              <div className="h-full bg-gradient-to-r from-primary to-success transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* Daily digest */}
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <Sunrise className="h-3.5 w-3.5" /> Digest
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Sunrise className="h-4 w-4 text-primary" /> {role} · today's digest</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Moved" value={moved} />
                <Stat label="Stalled" value={stalled.length} tone="danger" />
                <Stat label={targetLabel} value={`${current}/${target}`} tone="primary" />
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Next 5 actions</div>
                <ol className="space-y-1">
                  {top5.length === 0 && <li className="text-xs text-muted-foreground italic">Queue clear.</li>}
                  {top5.map((e, i) => (
                    <li key={e.id} className="flex items-center gap-2 text-xs rounded-md border border-border bg-card p-2">
                      <span className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{e.title}</div>
                        {e.subtitle && <div className="text-[10px] text-muted-foreground truncate">{e.subtitle}</div>}
                      </div>
                      {e.tag && <Badge variant="outline" className="text-[9px]">{e.tag}</Badge>}
                    </li>
                  ))}
                </ol>
              </div>

              {stalled.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-danger font-semibold mb-1">Stalled — escalate</div>
                  <ul className="space-y-1">
                    {stalled.map(e => (
                      <li key={e.id} className="flex items-center gap-2 text-xs rounded-md border border-danger/30 bg-danger/5 p-2">
                        <Zap className="h-3 w-3 text-danger" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{e.title}</div>
                          {e.subtitle && <div className="text-[10px] text-muted-foreground truncate">{e.subtitle}</div>}
                        </div>
                        {e.tag && <Badge variant="outline" className="text-[9px] border-danger/40 text-danger">{e.tag}</Badge>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                size="sm"
                className="w-full gap-1.5"
                onClick={() => {
                  const txt = `*${role} digest*\nMoved: ${moved}  ·  Stalled: ${stalled.length}  ·  ${targetLabel}: ${current}/${target}\n\nNext 5:\n${top5.map((e, i) => `${i + 1}. ${e.title}${e.tag ? ` — ${e.tag}` : ''}`).join('\n') || 'Queue clear.'}${stalled.length ? `\n\nEscalate:\n${stalled.map(e => `• ${e.title}${e.tag ? ` (${e.tag})` : ''}`).join('\n')}` : ''}`;
                  navigator.clipboard?.writeText(txt);
                  toast.success('Digest copied — paste into WhatsApp');
                }}
              >
                <ClipboardCopy className="h-3.5 w-3.5" /> Copy digest for WhatsApp
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function Sep() {
  return <div className="hidden md:block h-8 w-px bg-border" />;
}

function Stat({ label, value, tone = 'default' }: { label: string; value: number | string; tone?: 'default' | 'danger' | 'primary' }) {
  const cls = tone === 'danger' ? 'text-danger' : tone === 'primary' ? 'text-primary' : '';
  return (
    <div className="rounded-md border border-border p-2 text-center">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xl font-heading font-semibold ${cls}`}>{value}</div>
    </div>
  );
}