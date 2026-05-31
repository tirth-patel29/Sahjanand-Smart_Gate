import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PortalShell, StatCard } from "@/components/PortalShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Download, Plus, Megaphone, Home, Users } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Portal — Sahjanand Smart Gate" }] }),
  component: AdminPortal,
});

function AdminPortal() {
  const { session, role, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && (!session || role !== "admin")) nav({ to: "/login", search: { role: "admin" } });
  }, [loading, session, role, nav]);

  const [stats, setStats] = useState({ houses: 0, residents: 0, visitorsToday: 0, totalVisitors: 0 });
  useEffect(() => {
    const load = async () => {
      const [h, r, t, vt] = await Promise.all([
        supabase.from("houses").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }).not("house_id", "is", null),
        supabase.from("visitors").select("*", { count: "exact", head: true }).gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.from("visitors").select("*", { count: "exact", head: true }),
      ]);
      setStats({ houses: h.count ?? 0, residents: r.count ?? 0, visitorsToday: t.count ?? 0, totalVisitors: vt.count ?? 0 });
    };
    load();
  }, []);

  if (loading) return <div className="min-h-screen grid place-items-center gradient-soft"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <PortalShell title="Admin Dashboard" subtitle="Manage your society — houses, residents, notices and reports">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Houses" value={stats.houses} accent="primary" />
        <StatCard label="Residents" value={stats.residents} accent="info" />
        <StatCard label="Visitors Today" value={stats.visitorsToday} accent="success" />
        <StatCard label="All-time Visitors" value={stats.totalVisitors} accent="warning" />
      </div>

      <Tabs defaultValue="reports">
        <TabsList className="glass">
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="houses"><Home className="mr-1.5 h-4 w-4" />Houses</TabsTrigger>
          <TabsTrigger value="residents"><Users className="mr-1.5 h-4 w-4" />Residents</TabsTrigger>
          <TabsTrigger value="notices"><Megaphone className="mr-1.5 h-4 w-4" />Notices</TabsTrigger>
        </TabsList>
        <TabsContent value="reports" className="mt-5"><Reports /></TabsContent>
        <TabsContent value="houses" className="mt-5"><HousesTable /></TabsContent>
        <TabsContent value="residents" className="mt-5"><ResidentsTable /></TabsContent>
        <TabsContent value="notices" className="mt-5"><NoticesAdmin /></TabsContent>
      </Tabs>
    </PortalShell>
  );
}

type Report = {
  id: string; full_name: string; mobile: string; vehicle_number: string | null;
  purpose: string | null; status: string; created_at: string;
  houses?: { house_number: string } | null;
};

function Reports() {
  const [items, setItems] = useState<Report[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [house, setHouse] = useState("");
  const [name, setName] = useState("");

  const load = async () => {
    let q = supabase.from("visitors").select("*, houses(house_number)").order("created_at", { ascending: false }).limit(500);
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to + "T23:59:59");
    if (name) q = q.ilike("full_name", `%${name}%`);
    const { data } = await q;
    let arr = (data ?? []) as Report[];
    if (house) arr = arr.filter((r) => r.houses?.house_number === house);
    setItems(arr);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const csv = () => {
    const headers = ["Date", "Name", "Mobile", "Vehicle", "House", "Purpose", "Status"];
    const rows = items.map((v) => [
      new Date(v.created_at).toLocaleString(), v.full_name, v.mobile,
      v.vehicle_number ?? "", v.houses?.house_number ?? "", v.purpose ?? "", v.status,
    ]);
    const blob = new Blob([[headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `visitors-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <Card className="glass rounded-2xl p-5 grid sm:grid-cols-5 gap-3">
        <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><Label>House #</Label><Input value={house} onChange={(e) => setHouse(e.target.value)} placeholder="e.g. 12" /></div>
        <div><Label>Visitor Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="flex items-end gap-2">
          <Button onClick={load} className="gradient-hero text-white border-0">Apply</Button>
          <Button variant="outline" onClick={csv}><Download className="h-4 w-4 mr-1" />CSV</Button>
        </div>
      </Card>
      <Card className="glass rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Date</TableHead><TableHead>Visitor</TableHead><TableHead>Mobile</TableHead><TableHead>House</TableHead><TableHead>Purpose</TableHead><TableHead>Status</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No results</TableCell></TableRow> :
              items.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="text-xs">{new Date(v.created_at).toLocaleString()}</TableCell>
                  <TableCell className="font-medium">{v.full_name}</TableCell>
                  <TableCell>{v.mobile}</TableCell>
                  <TableCell>{v.houses?.house_number ?? "—"}</TableCell>
                  <TableCell className="text-sm">{v.purpose ?? "—"}</TableCell>
                  <TableCell><span className="text-xs capitalize">{v.status}</span></TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

type House = { id: string; house_number: string; owner_name: string | null; mobile_number: string | null };
function HousesTable() {
  const [items, setItems] = useState<House[]>([]);
  useEffect(() => {
    supabase.from("houses").select("*").order("house_number").then(({ data }) => {
      setItems(((data ?? []) as House[]).sort((a, b) => Number(a.house_number) - Number(b.house_number)));
    });
  }, []);
  return (
    <Card className="glass rounded-2xl overflow-hidden">
      <Table>
        <TableHeader><TableRow><TableHead>House #</TableHead><TableHead>Owner</TableHead><TableHead>Mobile</TableHead><TableHead>Login</TableHead></TableRow></TableHeader>
        <TableBody>
          {items.map((h) => (
            <TableRow key={h.id}>
              <TableCell className="font-semibold">{h.house_number}</TableCell>
              <TableCell>{h.owner_name ?? "—"}</TableCell>
              <TableCell>{h.mobile_number ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">house{h.house_number}@sahjanand.local</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

type Resident = { id: string; full_name: string | null; mobile: string | null; disabled: boolean; houses?: { house_number: string } | null };
function ResidentsTable() {
  const [items, setItems] = useState<Resident[]>([]);
  const load = async () => {
    const { data } = await supabase.from("profiles").select("*, houses(house_number)").not("house_id", "is", null);
    setItems(((data ?? []) as Resident[]).sort((a, b) => Number(a.houses?.house_number ?? 0) - Number(b.houses?.house_number ?? 0)));
  };
  useEffect(() => { load(); }, []);
  const toggle = async (id: string, disabled: boolean) => {
    const { error } = await supabase.from("profiles").update({ disabled: !disabled }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); load(); }
  };
  return (
    <Card className="glass rounded-2xl overflow-hidden">
      <Table>
        <TableHeader><TableRow><TableHead>House</TableHead><TableHead>Name</TableHead><TableHead>Mobile</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {items.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-semibold">{r.houses?.house_number}</TableCell>
              <TableCell>{r.full_name ?? "—"}</TableCell>
              <TableCell>{r.mobile ?? "—"}</TableCell>
              <TableCell><span className={`text-xs ${r.disabled ? "text-destructive" : "text-[var(--success)]"}`}>{r.disabled ? "Disabled" : "Active"}</span></TableCell>
              <TableCell><Button size="sm" variant="outline" onClick={() => toggle(r.id, r.disabled)}>{r.disabled ? "Enable" : "Disable"}</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

type Notice = { id: string; title: string; description: string | null; created_at: string };
function NoticesAdmin() {
  const [items, setItems] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", description: "" });
  const load = async () => {
    const { data } = await supabase.from("notices").select("*").order("created_at", { ascending: false });
    setItems((data ?? []) as Notice[]);
  };
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!f.title.trim()) return toast.error("Title required");
    const { error } = await supabase.from("notices").insert(f);
    if (error) toast.error(error.message);
    else { toast.success("Notice posted"); setOpen(false); setF({ title: "", description: "" }); load(); }
  };
  const del = async (id: string) => { await supabase.from("notices").delete().eq("id", id); load(); };
  return (
    <>
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gradient-hero text-white border-0"><Plus className="h-4 w-4 mr-1" />New Notice</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Post a Notice</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={4} /></div>
            </div>
            <DialogFooter><Button onClick={add} className="gradient-hero text-white border-0">Post</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-3">
        {items.map((n) => (
          <Card key={n.id} className="glass rounded-2xl p-5 flex justify-between gap-4">
            <div>
              <div className="font-semibold">{n.title}</div>
              {n.description && <p className="text-sm text-muted-foreground mt-1">{n.description}</p>}
              <div className="text-xs text-muted-foreground mt-2">{new Date(n.created_at).toLocaleString()}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => del(n.id)}>Delete</Button>
          </Card>
        ))}
      </div>
    </>
  );
}
