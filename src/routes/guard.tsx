import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PortalShell, StatCard } from "@/components/PortalShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogIn, LogOut, Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/guard")({
  head: () => ({ meta: [{ title: "Guard Portal — Sahjanand Smart Gate" }] }),
  component: GuardPortal,
});

type V = {
  id: string; full_name: string; mobile: string; vehicle_number: string | null; purpose: string | null;
  visitor_count: number; status: "pending"|"approved"|"rejected"|"wait_at_gate"|"entered"|"exited";
  created_at: string; entered_at: string|null; exited_at: string|null;
  houses?: { house_number: string } | null;
};

function GuardPortal() {
  const { session, role, loading } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<V[]>([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("approved");

  useEffect(() => {
    if (!loading && (!session || role !== "guard")) nav({ to: "/login", search: { role: "guard" } });
  }, [loading, session, role, nav]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("visitors").select("*, houses(house_number)").order("created_at", { ascending: false }).limit(200);
      setItems((data ?? []) as V[]);
    };
    load();
    const ch = supabase.channel("guard-v").on("postgres_changes", { event: "*", schema: "public", table: "visitors" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((v) =>
      v.full_name.toLowerCase().includes(s) || v.mobile.includes(s) ||
      (v.vehicle_number?.toLowerCase().includes(s)) || (v.houses?.house_number?.includes(s))
    );
  }, [items, q]);

  const groups = useMemo(() => ({
    pending: filtered.filter((v) => v.status === "pending" || v.status === "wait_at_gate"),
    approved: filtered.filter((v) => v.status === "approved" || v.status === "entered"),
    rejected: filtered.filter((v) => v.status === "rejected" || v.status === "exited"),
  }), [filtered]);

  const markEntered = async (id: string) => {
    const { error } = await supabase.from("visitors").update({ status: "entered", entered_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Marked entered");
  };
  const markExited = async (id: string) => {
    const { error } = await supabase.from("visitors").update({ status: "exited", exited_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Marked exited");
  };

  if (loading) return <div className="min-h-screen grid place-items-center gradient-soft"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <PortalShell title="Gate Operations" subtitle="Track entries and exits in real time">
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Awaiting" value={groups.pending.length} accent="warning" />
        <StatCard label="Approved" value={groups.approved.length} accent="success" />
        <StatCard label="Closed" value={groups.rejected.length} accent="danger" />
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9 glass" placeholder="Search by name, mobile, vehicle, or house number" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="glass">
          <TabsTrigger value="approved">Approved · {groups.approved.length}</TabsTrigger>
          <TabsTrigger value="pending">Pending · {groups.pending.length}</TabsTrigger>
          <TabsTrigger value="rejected">Rejected/Exited · {groups.rejected.length}</TabsTrigger>
        </TabsList>
        {(["approved","pending","rejected"] as const).map((k) => (
          <TabsContent key={k} value={k} className="mt-5">
            {groups[k].length === 0 ? <Card className="glass p-10 text-center text-muted-foreground rounded-3xl">No visitors</Card> :
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {groups[k].map((v) => <GuardCard key={v.id} v={v} onEnter={markEntered} onExit={markExited} />)}
              </div>}
          </TabsContent>
        ))}
      </Tabs>
    </PortalShell>
  );
}

function GuardCard({ v, onEnter, onExit }: { v: V; onEnter: (id: string) => void; onExit: (id: string) => void }) {
  const colorBar = {
    pending: "bg-[var(--warning)]", wait_at_gate: "bg-[var(--warning)]",
    approved: "bg-[var(--success)]", entered: "bg-[var(--accent)]",
    rejected: "bg-[var(--destructive)]", exited: "bg-muted-foreground",
  }[v.status];
  return (
    <Card className="glass rounded-2xl overflow-hidden">
      <div className={`h-1.5 ${colorBar}`} />
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-lg font-semibold">{v.full_name}</div>
            <div className="text-sm text-muted-foreground">{v.mobile}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">House</div>
            <div className="text-xl font-bold text-gradient">{v.houses?.house_number ?? "—"}</div>
          </div>
        </div>
        <div className="mt-3 space-y-1 text-sm">
          {v.vehicle_number && <div className="text-muted-foreground">🚗 {v.vehicle_number}</div>}
          {v.purpose && <div>{v.purpose}</div>}
          <div className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</div>
        </div>
        {v.status === "approved" && (
          <Button size="lg" className="mt-4 w-full bg-[var(--success)] hover:bg-[var(--success)]/90 text-white border-0" onClick={() => onEnter(v.id)}>
            <LogIn className="h-5 w-5 mr-2" />Mark Entered
          </Button>
        )}
        {v.status === "entered" && (
          <Button size="lg" variant="outline" className="mt-4 w-full" onClick={() => onExit(v.id)}>
            <LogOut className="h-5 w-5 mr-2" />Mark Exited
          </Button>
        )}
      </div>
    </Card>
  );
}
