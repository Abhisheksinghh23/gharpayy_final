import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface State { hasError: boolean; error?: Error; key: number }

/**
 * Soft, inline recovery boundary for the Impact Queue.
 * Never lets a child throw escape to the route-level "Try again" screen —
 * the rest of the app stays navigable.
 */
export class ImpactErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, key: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("[ImpactQueue] caught:", error, info);
  }
  reset = () => this.setState((s) => ({ hasError: false, error: undefined, key: s.key + 1 }));

  render() {
    if (this.state.hasError) {
      return (
        <div className="m-4 rounded-xl border border-warning/40 bg-warning/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold">A card hiccuped — your work is safe</h3>
              <p className="text-xs text-muted-foreground mt-1">
                The Impact Queue recovered locally. Click reload to refresh just this view —
                the rest of the workspace is untouched.
              </p>
              {this.state.error?.message && (
                <pre className="mt-3 max-h-24 overflow-auto rounded bg-muted p-2 text-[10px] font-mono text-muted-foreground">
                  {this.state.error.message}
                </pre>
              )}
              <div className="mt-3">
                <Button size="sm" onClick={this.reset} className="h-7 text-xs gap-1">
                  <RotateCcw className="h-3 w-3" /> Reload Impact Queue
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return <div key={this.state.key}>{this.props.children}</div>;
  }
}
