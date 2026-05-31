import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PortalShell, StatCard } from "@/components/PortalShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Clock, Plus, Trash2, QrCode, Bell, UserCircle2, Megaphone, Loader2 } from "lucide-react";

export const Route = createFileRoute("/resident")({
  head: () => ({ meta: [{ title: "Resident Portal — Sahjanand Smart Gate" }] }),
  component: ResidentPortal,
});

type Visitor = {
  id: string; house_id: string; full_name: string; mobile: string; vehicle_number: string | null;
  purpose: string | null; visitor_count: number; photo_url: string | null;
  status: "pending" | "approved" | "rejected" | "wait_at_gate" | "entered" | "exited";
  created_at: string; entered_at: string | null; exited_at: string | null;
};

function ResidentPortal() {
  const { session, role, houseId, loading } = useAuth();
  const nav = useNavigate();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [tab, setTab] = useState("pending");

  useEffect(() => {
    if (!loading && (!session || role !== "resident")) nav({ to: "/login", search: { role: "resident" } });
  }, [loading, session, role, nav]);

  useEffect(() => {
    if (!houseId) return;
    const load = async () => {
      const { data } = await supabase.from("visitors").select("*").eq("house_id", houseId).order("created_at", { ascending: false });
      setVisitors((data ?? []) as Visitor[]);
    };
    load();
    const ch = supabase.channel(`v-${houseId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "visitors", filter: `house_id=eq.${houseId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [houseId]);

  const groups = useMemo(() => ({
    pending: visitors.filter((v) => v.status === "pending" || v.status === "wait_at_gate"),
    approved: visitors.filter((v) => v.status === "approved" || v.status === "entered" || v.status === "exited"),
    rejected: visitors.filter((v) => v.status === "rejected"),
    all: visitors,
  }), [visitors]);

  const act = async (id: string, status: Visitor["status"]) => {
    const { error } = await supabase.from("visitors").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Updated");
  };

  if (loading || !houseId) return <div className="min-h-screen grid place-items-center gradient-soft"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <PortalShell title="Resident Dashboard" subtitle="Manage visitors and guest passes for your home">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Pending" value={groups.pending.length} accent="warning" />
        <StatCard label="Approved" value={groups.approved.length} accent="success" />
        <StatCard label="Rejected" value={groups.rejected.length} accent="danger" />
        <StatCard label="Total" value={visitors.length} accent="primary" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="glass">
          <TabsTrigger value="pending"><Bell className="mr-1.5 h-4 w-4" />Requests</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="frequent"><UserCircle2 className="mr-1.5 h-4 w-4" />Frequent</TabsTrigger>
          <TabsTrigger value="passes"><QrCode className="mr-1.5 h-4 w-4" />Guest Passes</TabsTrigger>
          <TabsTrigger value="notices"><Megaphone className="mr-1.5 h-4 w-4" />Notices</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-5">
          {groups.pending.length === 0 ? <Empty title="No pending requests" sub="You'll see new visitor requests here in real time." /> :
            <div className="grid gap-4 md:grid-cols-2">
              {groups.pending.map((v) => <VisitorCard key={v.id} v={v} onAct={act} />)}
            </div>}
        </TabsContent>

        <TabsContent value="history" className="mt-5">
          {groups.all.length === 0 ? <Empty title="No history yet" /> :
            <div className="grid gap-4 md:grid-cols-2">
              {groups.all.map((v) => <VisitorCard key={v.id} v={v} onAct={act} compact />)}
            </div>}
        </TabsContent>

        <TabsContent value="frequent" className="mt-5"><FrequentList houseId={houseId} /></TabsContent>
        <TabsContent value="passes" className="mt-5"><GuestPasses houseId={houseId} /></TabsContent>
        <TabsContent value="notices" className="mt-5"><Notices /></TabsContent>
      </Tabs>
    </PortalShell>
  );
}

function StatusBadge({ status }: { status: Visitor["status"] }) {
  const map = {
    pending: ["Pending", "bg-[color-mix(in_oklab,var(--warning)_25%,transparent)] text-[color-mix(in_oklab,var(--warning)_70%,black)]"],
    wait_at_gate: ["Waiting", "bg-[color-mix(in_oklab,var(--warning)_25%,transparent)]"],
    approved: ["Approved", "bg-[color-mix(in_oklab,var(--success)_25%,transparent)] text-[color-mix(in_oklab,var(--success)_70%,black)]"],
    rejected: ["Rejected", "bg-[color-mix(in_oklab,var(--destructive)_22%,transparent)] text-[color-mix(in_oklab,var(--destructive)_70%,black)]"],
    entered: ["Entered", "bg-[color-mix(in_oklab,var(--accent)_25%,transparent)]"],
    exited: ["Exited", "bg-muted text-muted-foreground"],
  } as const;
  const [l, c] = map[status];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${c}`}>{l}</span>;
}

function VisitorCard({ v, onAct, compact }: { v: Visitor; onAct: (id: string, s: Visitor["status"]) => void; compact?: boolean }) {
  return (
    <Card className="glass rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{v.full_name}</div>
          <div className="text-sm text-muted-foreground">{v.mobile} {v.vehicle_number && `· ${v.vehicle_number}`}</div>
          {v.purpose && <div className="text-sm mt-1.5">{v.purpose}</div>}
          <div className="mt-1 text-xs text-muted-foreground">
            {new Date(v.created_at).toLocaleString()} · {v.visitor_count} {v.visitor_count > 1 ? "people" : "person"}
          </div>
        </div>
        <StatusBadge status={v.status} />
      </div>
      {!compact && (v.status === "pending" || v.status === "wait_at_gate") && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Button size="sm" className="bg-[var(--success)] hover:bg-[var(--success)]/90 text-white border-0" onClick={() => onAct(v.id, "approved")}>
            <Check className="h-4 w-4 mr-1" />Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAct(v.id, "wait_at_gate")}>
            <Clock className="h-4 w-4 mr-1" />Wait
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onAct(v.id, "rejected")}>
            <X className="h-4 w-4 mr-1" />Reject
          </Button>
        </div>
      )}
    </Card>
  );
}

function Empty({ title, sub }: { title: string; sub?: string }) {
  return (
    <Card className="glass rounded-3xl p-10 text-center">
      <div className="text-lg font-medium">{title}</div>
      {sub && <div className="mt-1 text-sm text-muted-foreground">{sub}</div>}
    </Card>
  );
}

type Freq = { id: string; name: string; mobile: string | null; category: string };

function FrequentList({ houseId }: { houseId: string }) {
  const [items, setItems] = useState<Freq[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", mobile: "", category: "maid" });
  const load = async () => {
    const { data } = await supabase.from("frequent_visitors").select("*").eq("house_id", houseId).order("created_at", { ascending: false });
    setItems((data ?? []) as Freq[]);
  };
  useEffect(() => { load(); }, [houseId]);

  const add = async () => {
    if (!f.name.trim()) return toast.error("Name required");
    const { error } = await supabase.from("frequent_visitors").insert({ name: f.name, mobile: f.mobile, category: f.category as "maid"|"driver"|"cook"|"tutor"|"family"|"other", house_id: houseId });
    if (error) toast.error(error.message);
    else { toast.success("Added"); setOpen(false); setF({ name: "", mobile: "", category: "maid" }); load(); }
  };
  const del = async (id: string) => {
    await supabase.from("frequent_visitors").delete().eq("id", id);
    load();
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gradient-hero text-white border-0"><Plus className="h-4 w-4 mr-1" />Add Frequent Visitor</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Frequent Visitor</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
              <div><Label>Mobile</Label><Input value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} /></div>
              <div><Label>Category</Label>
                <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["maid", "driver", "cook", "tutor", "family", "other"].map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={add} className="gradient-hero text-white border-0">Add</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {items.length === 0 ? <Empty title="No frequent visitors" sub="Add maids, drivers, or family members for quick approval." /> :
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <Card key={i.id} className="glass rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{i.name}</div>
                <div className="text-xs text-muted-foreground">{i.mobile}</div>
                <Badge variant="secondary" className="mt-1 capitalize">{i.category}</Badge>
              </div>
              <Button size="icon" variant="ghost" onClick={() => del(i.id)}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </div>}
    </>
  );
}

type Pass = { id: string; guest_name: string; mobile: string | null; valid_date: string; start_time: string; end_time: string; qr_token: string; used: boolean };

function GuestPasses({ houseId }: { houseId: string }) {
  const [items, setItems] = useState<Pass[]>([]);
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ guest_name: "", mobile: "", valid_date: today, start_time: "09:00", end_time: "21:00" });

  const load = async () => {
    const { data } = await supabase.from("guest_passes").select("*").eq("house_id", houseId).order("created_at", { ascending: false });
    setItems((data ?? []) as Pass[]);
  };
  useEffect(() => { load(); }, [houseId]);

  const add = async () => {
    if (!f.guest_name.trim()) return toast.error("Name required");
    const { error } = await supabase.from("guest_passes").insert({ ...f, house_id: houseId });
    if (error) toast.error(error.message);
    else { toast.success("Pass generated"); setOpen(false); load(); }
  };
  const del = async (id: string) => { await supabase.from("guest_passes").delete().eq("id", id); load(); };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gradient-hero text-white border-0"><Plus className="h-4 w-4 mr-1" />New Guest Pass</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Generate Guest Pass</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Guest Name</Label><Input value={f.guest_name} onChange={(e) => setF({ ...f, guest_name: e.target.value })} /></div>
              <div><Label>Mobile</Label><Input value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Date</Label><Input type="date" value={f.valid_date} onChange={(e) => setF({ ...f, valid_date: e.target.value })} /></div>
                <div><Label>From</Label><Input type="time" value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} /></div>
                <div><Label>To</Label><Input type="time" value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={add} className="gradient-hero text-white border-0">Generate</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {items.length === 0 ? <Empty title="No guest passes" sub="Generate a QR pass for your guests for automatic approval." /> :
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((p) => {
            const url = typeof window !== "undefined" ? `${window.location.origin}/visitor?qr=${p.qr_token}` : "";
            const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}`;
            return (
              <Card key={p.id} className="glass rounded-2xl p-4 flex items-center gap-4">
                <img src={qrSrc} alt="QR" className="h-32 w-32 rounded-xl bg-white p-2" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{p.guest_name}</div>
                  <div className="text-xs text-muted-foreground">{p.mobile}</div>
                  <div className="text-xs mt-1">{p.valid_date} · {p.start_time}–{p.end_time}</div>
                  <Badge className="mt-2" variant={p.used ? "secondary" : "default"}>{p.used ? "Used" : "Active"}</Badge>
                  <div className="mt-2"><Button size="sm" variant="ghost" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button></div>
                </div>
              </Card>
            );
          })}
        </div>}
    </>
  );
}

type Notice = { id: string; title: string; description: string | null; created_at: string };
function Notices() {
  const [items, setItems] = useState<Notice[]>([]);
  useEffect(() => {
    supabase.from("notices").select("*").order("created_at", { ascending: false }).then(({ data }) => setItems((data ?? []) as Notice[]));
    const ch = supabase.channel("notices").on("postgres_changes", { event: "*", schema: "public", table: "notices" }, () => {
      supabase.from("notices").select("*").order("created_at", { ascending: false }).then(({ data }) => setItems((data ?? []) as Notice[]));
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  if (items.length === 0) return <Empty title="No notices yet" />;
  return (
    <div className="space-y-3">
      {items.map((n) => (
        <Card key={n.id} className="glass rounded-2xl p-5">
          <div className="font-semibold">{n.title}</div>
          {n.description && <p className="text-sm text-muted-foreground mt-1">{n.description}</p>}
          <div className="text-xs text-muted-foreground mt-2">{new Date(n.created_at).toLocaleString()}</div>
        </Card>
      ))}
    </div>
  );
}
