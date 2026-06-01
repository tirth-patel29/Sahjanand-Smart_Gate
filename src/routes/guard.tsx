import { useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/lib/auth'
import { PortalShell, StatCard } from '@/components/PortalShell'
import { QrScanner } from '@/components/QrScanner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { LogIn, LogOut, Loader2, Search, QrCode, Clock } from 'lucide-react'

type V = {
  id: string; full_name: string; mobile: string; vehicle_number: string | null; purpose: string | null;
  visitor_count: number; status: 'pending' | 'approved' | 'rejected' | 'wait_at_gate' | 'entered' | 'exited';
  created_at: string; entered_at: string | null; exited_at: string | null;
  houses?: { house_number: string } | null;
}

export default function GuardPage() {
  const { session, role, loading } = useAuth()
  const nav = useNavigate()
  const [items, setItems] = useState<V[]>([])
  const [entryLogs, setEntryLogs] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('scanner')

  useEffect(() => {
    if (!loading && (!session || role !== 'guard')) nav('/login?role=guard')
  }, [loading, session, role, nav])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("visitors").select("*, houses(house_number)").order("created_at", { ascending: false }).limit(200);
      setItems((data ?? []) as V[]);
    };
    load();
    const ch = supabase.channel("guard-v").on("postgres_changes", { event: "*", schema: "public", table: "visitors" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    const loadEntryLogs = async () => {
      const { data } = await supabase
        .from("entry_logs")
        .select("*, guest_passes(guest_name, valid_date), houses(house_number)")
        .order("scanned_at", { ascending: false })
        .limit(50);
      setEntryLogs((data ?? []) as any[]);
    };
    loadEntryLogs();
    const ch = supabase
      .channel("entry-logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "entry_logs" },
        loadEntryLogs
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-6">
        <StatCard label="Awaiting" value={groups.pending.length} accent="warning" />
        <StatCard label="Approved" value={groups.approved.length} accent="success" />
        <StatCard label="Closed" value={groups.rejected.length} accent="danger" />
        <StatCard label="Today's Entries" value={entryLogs.filter(e => !e.denied).length} accent="info" />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="glass grid grid-cols-2 sm:grid-cols-4 w-full h-auto p-1 gap-1 sm:gap-0">
          <TabsTrigger value="scanner" className="gap-1 text-xs sm:text-sm py-2">
            <QrCode className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Scanner</span>
          </TabsTrigger>
          <TabsTrigger value="approved" className="text-xs sm:text-sm py-2 px-1.5 sm:px-3">
            <span>Appr. {groups.approved.length}</span>
          </TabsTrigger>
          <TabsTrigger value="pending" className="text-xs sm:text-sm py-2 px-1.5 sm:px-3">
            <span>Pend. {groups.pending.length}</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1 text-xs sm:text-sm py-2">
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Logs</span>
          </TabsTrigger>
        </TabsList>

        {/* QR Scanner Tab */}
        <TabsContent value="scanner" className="mt-5">
          <Card className="glass rounded-3xl p-6">
            <QrScanner onScanComplete={() => setTab('logs')} />
          </Card>
        </TabsContent>

        {/* Approved Visitors Tab */}
        <TabsContent value="approved" className="mt-5">
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 glass" placeholder="Search visitor..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {groups.approved.length === 0 ? (
            <Card className="glass p-10 text-center text-muted-foreground rounded-3xl">No approved visitors</Card>
          ) : (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {groups.approved.map((v) => <GuardCard key={v.id} v={v} onEnter={markEntered} onExit={markExited} />)}
            </div>
          )}
        </TabsContent>

        {/* Pending Visitors Tab */}
        <TabsContent value="pending" className="mt-5">
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 glass" placeholder="Search visitor..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {groups.pending.length === 0 ? (
            <Card className="glass p-10 text-center text-muted-foreground rounded-3xl">No pending visitors</Card>
          ) : (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {groups.pending.map((v) => <GuardCard key={v.id} v={v} onEnter={markEntered} onExit={markExited} />)}
            </div>
          )}
        </TabsContent>

        {/* Entry Logs Tab */}
        <TabsContent value="logs" className="mt-5">
          {entryLogs.length === 0 ? (
            <Card className="glass p-10 text-center text-muted-foreground rounded-3xl">No entries logged today</Card>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {entryLogs.map((log) => (
                <Card key={log.id} className="glass rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{log.guest_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(log.scanned_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {log.denied ? (
                      <div className="text-xs px-2 py-1 bg-red-500/20 text-red-700 rounded">Denied</div>
                    ) : (
                      <div className="text-xs px-2 py-1 bg-green-500/20 text-green-700 rounded">Allowed</div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
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
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="text-base sm:text-lg font-semibold truncate">{v.full_name}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">{v.mobile}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">House</div>
            <div className="text-lg sm:text-xl font-bold text-gradient">{v.houses?.house_number ?? "—"}</div>
          </div>
        </div>
        <div className="space-y-1 text-xs sm:text-sm mb-3">
          {v.vehicle_number && <div className="text-muted-foreground truncate">🚗 {v.vehicle_number}</div>}
          {v.purpose && <div className="truncate">{v.purpose}</div>}
          <div className="text-muted-foreground text-xs">{new Date(v.created_at).toLocaleString()}</div>
        </div>
        {v.status === "approved" && (
          <Button className="w-full h-9 sm:h-10 bg-[var(--success)] hover:bg-[var(--success)]/90 text-white border-0 text-xs sm:text-sm" onClick={() => onEnter(v.id)}>
            <LogIn className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />Mark Entered
          </Button>
        )}
        {v.status === "entered" && (
          <Button variant="outline" className="w-full h-9 sm:h-10 text-xs sm:text-sm" onClick={() => onExit(v.id)}>
            <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />Mark Exited
          </Button>
        )}
      </div>
    </Card>
  );
}
