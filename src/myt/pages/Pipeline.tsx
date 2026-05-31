import { useApp } from "@/lib/store";
import { useIdentityStore } from "@/lib/lead-identity/store";
import { useState, useMemo } from "react";
import { 
  SlidersHorizontal, Search, RefreshCw, MoveRight, User, 
  MapPin, CheckCircle, Flame, Sparkles, Building2, Trash2, Calendar
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";

type PipelineType = "arena" | "identity";

export default function Pipeline() {
  const { 
    leads: arenaLeads, 
    tcms, 
    properties, 
    setLeadStage, 
    reassignLead 
  } = useApp();
  
  const { 
    leads: identityLeads, 
    setLifecycleState,
    reassignPrimary 
  } = useIdentityStore();

  const [pipelineType, setPipelineType] = useState<PipelineType>("arena");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArea, setSelectedArea] = useState("All");
  const [selectedTcm, setSelectedTcm] = useState("All");
  const [selectedProperty, setSelectedProperty] = useState("All");

  // Arena Pipeline columns configuration
  const arenaColumns = [
    { id: "new", label: "New Lead", color: "border-t-info" },
    { id: "contacted", label: "Contacted", color: "border-t-primary" },
    { id: "tour-scheduled", label: "Tour Scheduled", color: "border-t-accent" },
    { id: "tour-done", label: "Tour Done", color: "border-t-warning" },
    { id: "negotiation", label: "Negotiation", color: "border-t-info" },
    { id: "booked", label: "Booked", color: "border-t-success" },
    { id: "dropped", label: "Dropped", color: "border-t-destructive" },
  ];

  // Identity Pipeline columns configuration (Lifecycle states)
  const identityColumns = [
    { id: "new", label: "New", color: "border-t-info" },
    { id: "contacted", label: "Contacted", color: "border-t-primary" },
    { id: "interested", label: "Interested", color: "border-t-accent" },
    { id: "visit-scheduled", label: "Visit Scheduled", color: "border-t-warning" },
    { id: "visit-done", label: "Visit Done", color: "border-t-info" },
    { id: "converted", label: "Converted 🏆", color: "border-t-success" },
    { id: "dropped", label: "Dropped 😭", color: "border-t-destructive" },
  ];

  // Helper to extract unique areas from both lead sets
  const availableAreas = useMemo(() => {
    const set = new Set<string>();
    arenaLeads.forEach(l => set.add(l.preferredArea));
    identityLeads.forEach(l => l.area && set.add(l.area));
    return ["All", ...Array.from(set)];
  }, [arenaLeads, identityLeads]);

  // Filtering logic for Arena leads
  const filteredArenaLeads = useMemo(() => {
    return arenaLeads.filter(l => {
      const matchesSearch = l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            l.phone.includes(searchQuery) ||
                            (l.id && l.id.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesArea = selectedArea === "All" || l.preferredArea === selectedArea;
      const matchesTcm = selectedTcm === "All" || l.assignedTcmId === selectedTcm;
      // Filter by property preferred match
      const matchesProp = selectedProperty === "All" || 
                          properties.find(p => p.id === selectedProperty)?.area === l.preferredArea;
      
      return matchesSearch && matchesArea && matchesTcm && matchesProp;
    });
  }, [arenaLeads, searchQuery, selectedArea, selectedTcm, selectedProperty, properties]);

  // Filtering logic for Identity leads
  const filteredIdentityLeads = useMemo(() => {
    return identityLeads.filter(l => {
      const matchesSearch = l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            l.phoneE164.includes(searchQuery);
      const matchesArea = selectedArea === "All" || l.area === selectedArea;
      const matchesTcm = selectedTcm === "All" || l.assigneeId === selectedTcm;
      const matchesProp = selectedProperty === "All" || 
                          properties.find(p => p.id === selectedProperty)?.area === l.area;

      return matchesSearch && matchesArea && matchesTcm && matchesProp;
    });
  }, [identityLeads, searchQuery, selectedArea, selectedTcm, selectedProperty, properties]);

  // Move Lead stage handlers
  const handleMoveArenaLead = (leadId: string, currentStage: string, direction: "next" | "prev") => {
    const idx = arenaColumns.findIndex(c => c.id === currentStage);
    if (idx === -1) return;
    const nextIdx = direction === "next" ? idx + 1 : idx - 1;
    if (nextIdx >= 0 && nextIdx < arenaColumns.length) {
      const nextStage = arenaColumns[nextIdx].id;
      setLeadStage(leadId, nextStage as any);
      toast.success(`Moved lead to ${arenaColumns[nextIdx].label}`);
    }
  };

  const handleMoveIdentityLead = (ulid: string, currentState: string, direction: "next" | "prev") => {
    const idx = identityColumns.findIndex(c => c.id === currentState);
    if (idx === -1) return;
    const nextIdx = direction === "next" ? idx + 1 : idx - 1;
    if (nextIdx >= 0 && nextIdx < identityColumns.length) {
      const nextState = identityColumns[nextIdx].id;
      setLifecycleState(ulid, nextState as any);
      toast.success(`Updated state to ${identityColumns[nextIdx].label}`);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Pipeline Board</h1>
          <p className="text-sm text-muted-foreground">
            Monitor and manage leads across stages. Switch between Arena Ops and Identity logs.
          </p>
        </div>

        {/* Pipeline Toggle */}
        <div className="flex rounded-lg border border-border p-1 bg-card w-fit">
          <button 
            onClick={() => setPipelineType("arena")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              pipelineType === "arena" 
                ? "bg-accent text-accent-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Arena Operations ({filteredArenaLeads.length})
          </button>
          <button 
            onClick={() => setPipelineType("identity")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              pipelineType === "identity" 
                ? "bg-accent text-accent-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Identity Registry ({filteredIdentityLeads.length})
          </button>
        </div>
      </header>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search leads by name or phone..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-xs outline-none focus:border-accent"
          />
        </div>

        <div>
          <select 
            value={selectedArea} 
            onChange={(e) => setSelectedArea(e.target.value)}
            className="w-full h-8 bg-background border border-border rounded-lg px-2 text-xs outline-none focus:border-accent"
          >
            <option value="All">All Areas</option>
            {availableAreas.filter(a => a !== "All").map(area => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
        </div>

        <div>
          <select 
            value={selectedTcm} 
            onChange={(e) => setSelectedTcm(e.target.value)}
            className="w-full h-8 bg-background border border-border rounded-lg px-2 text-xs outline-none focus:border-accent"
          >
            <option value="All">All TCMs</option>
            {tcms.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.zone})</option>
            ))}
          </select>
        </div>

        <div>
          <select 
            value={selectedProperty} 
            onChange={(e) => setSelectedProperty(e.target.value)}
            className="w-full h-8 bg-background border border-border rounded-lg px-2 text-xs outline-none focus:border-accent"
          >
            <option value="All">All Properties</option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin scroll-smooth select-none">
        {pipelineType === "arena" ? (
          arenaColumns.map(col => {
            const colLeads = filteredArenaLeads.filter(l => l.stage === col.id);
            return (
              <div 
                key={col.id}
                className="flex-shrink-0 w-80 rounded-xl border border-border bg-card/45 flex flex-col max-h-[70vh] shadow-sm"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const leadId = e.dataTransfer.getData("text/plain");
                  const type = e.dataTransfer.getData("type");
                  if (type === "arena") {
                    setLeadStage(leadId, col.id as any);
                    const targetColLabel = arenaColumns.find(c => c.id === col.id)?.label || col.id;
                    toast.success(`Moved lead to ${targetColLabel}`);
                  }
                }}
              >
                {/* Column Header */}
                <div className={`p-3 border-t-4 ${col.color} border-b border-border flex items-center justify-between bg-card rounded-t-xl`}>
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">{col.label}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{colLeads.length}</span>
                </div>

                {/* Cards List */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 scrollbar-thin min-h-[150px]">
                  {colLeads.map(lead => {
                    const tcm = tcms.find(t => t.id === lead.assignedTcmId);
                    return (
                      <div 
                        key={lead.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", lead.id);
                          e.dataTransfer.setData("type", "arena");
                        }}
                        className="rounded-lg border border-border bg-card p-3 space-y-3 hover:border-accent/40 shadow-sm transition-all group relative cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex justify-between items-start gap-1">
                          <h4 className="font-semibold text-xs text-foreground group-hover:text-accent transition-colors leading-tight">
                            {lead.name}
                          </h4>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0">#{lead.id}</span>
                        </div>

                        <div className="space-y-1 text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3" />
                            <span>{lead.preferredArea}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-muted-foreground text-[10px] w-3 text-center">₹</span>
                            <span>₹{lead.budget.toLocaleString()} / month</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3" />
                            <span>TCM: {tcm?.name || "Unassigned"}</span>
                          </div>
                          {lead.nextFollowUpAt && (
                            <div className="flex items-center gap-1.5 text-accent">
                              <Calendar className="h-3 w-3" />
                              <span>Follow-up: {new Date(lead.nextFollowUpAt).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {lead.tags.map(tag => (
                            <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground uppercase font-mono">
                              {tag}
                            </span>
                          ))}
                        </div>

                        {/* Card Shift Actions */}
                        <div className="flex justify-between items-center border-t border-border/80 pt-2 text-[10px]">
                          <button 
                            disabled={col.id === "new"}
                            onClick={() => handleMoveArenaLead(lead.id, lead.stage, "prev")}
                            className="text-muted-foreground hover:text-accent disabled:opacity-30 disabled:hover:text-muted-foreground"
                          >
                            &larr; Prev
                          </button>
                          
                          <span className="font-mono text-[9px] text-muted-foreground">{lead.intent} ({lead.confidence}%)</span>

                          <button 
                            disabled={col.id === "dropped"}
                            onClick={() => handleMoveArenaLead(lead.id, lead.stage, "next")}
                            className="text-muted-foreground hover:text-accent disabled:opacity-30 disabled:hover:text-muted-foreground"
                          >
                            Next &rarr;
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {colLeads.length === 0 && (
                    <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg">
                      No leads
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          identityColumns.map(col => {
            const colLeads = filteredIdentityLeads.filter(l => l.state === col.id);
            return (
              <div 
                key={col.id}
                className="flex-shrink-0 w-80 rounded-xl border border-border bg-card/45 flex flex-col max-h-[70vh] shadow-sm"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const ulid = e.dataTransfer.getData("text/plain");
                  const type = e.dataTransfer.getData("type");
                  if (type === "identity") {
                    setLifecycleState(ulid, col.id as any);
                    const targetColLabel = identityColumns.find(c => c.id === col.id)?.label || col.id;
                    toast.success(`Updated state to ${targetColLabel}`);
                  }
                }}
              >
                {/* Column Header */}
                <div className={`p-3 border-t-4 ${col.color} border-b border-border flex items-center justify-between bg-card rounded-t-xl`}>
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">{col.label}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{colLeads.length}</span>
                </div>

                {/* Cards List */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 scrollbar-thin min-h-[150px]">
                  {colLeads.map(lead => (
                    <div 
                      key={lead.ulid}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", lead.ulid);
                        e.dataTransfer.setData("type", "identity");
                      }}
                      className="rounded-lg border border-border bg-card p-3 space-y-3 hover:border-accent/40 shadow-sm transition-all group cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex justify-between items-start gap-1">
                        <h4 className="font-semibold text-xs text-foreground group-hover:text-accent transition-colors leading-tight">
                          {lead.name}
                        </h4>
                        <span className="text-[9px] text-muted-foreground font-mono shrink-0">..{lead.ulid.slice(-6)}</span>
                      </div>

                      <div className="space-y-1 text-[10px] text-muted-foreground">
                        {lead.area && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3" />
                            <span>{lead.area}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-muted-foreground text-[10px] w-3 text-center">₹</span>
                          <span>₹{lead.budget.toLocaleString()} / month</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3" />
                          <span>Owner: {lead.assigneeName || "Unassigned"}</span>
                        </div>
                      </div>

                      {lead.quality && (
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                          lead.quality === "hot" ? "bg-destructive/15 text-destructive" :
                          lead.quality === "good" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                        }`}>
                          {lead.quality === "hot" ? "🔥 Hot" : lead.quality === "good" ? "✅ Good" : "❌ Bad"}
                        </span>
                      )}

                      {/* Card Shift Actions */}
                      <div className="flex justify-between items-center border-t border-border/80 pt-2 text-[10px]">
                        <button 
                          disabled={col.id === "new"}
                          onClick={() => handleMoveIdentityLead(lead.ulid, lead.state, "prev")}
                          className="text-muted-foreground hover:text-accent disabled:opacity-30 disabled:hover:text-muted-foreground"
                        >
                          &larr; Prev
                        </button>
                        
                        <span className="font-mono text-[9px] text-muted-foreground">{lead.type}</span>

                        <button 
                          disabled={col.id === "dropped"}
                          onClick={() => handleMoveIdentityLead(lead.ulid, lead.state, "next")}
                          className="text-muted-foreground hover:text-accent disabled:opacity-30 disabled:hover:text-muted-foreground"
                        >
                          Next &rarr;
                        </button>
                      </div>
                    </div>
                  ))}
                  {colLeads.length === 0 && (
                    <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg">
                      No unified leads
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
