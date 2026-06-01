import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { CheckCircle2, Building2, Loader2, ArrowLeft, Sparkles } from 'lucide-react'
import { ThemeToggle } from '@/components/PortalShell'

type House = { id: string; house_number: string }

export default function VisitorPage() {
  const [houses, setHouses] = useState<House[]>([])
  const [qrToken, setQrToken] = useState<string | null>(null)
  const [done, setDone] = useState<'approved' | 'pending' | null>(null)

  useEffect(() => {
    supabase.from('houses').select('id, house_number').order('house_number').then(({ data }) => {
      setHouses(((data ?? []) as House[]).sort((a, b) => Number(a.house_number) - Number(b.house_number)))
    })
    if (typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('qr')
      if (t) setQrToken(t)
    }
  }, [])

  if (done) return <Confirmation status={done} />;

  return (
    <div className="min-h-screen gradient-soft">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Link to="/" className="inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> <span className="text-sm">Home</span></Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-16">
        <div className="text-center mb-8">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl gradient-hero shadow-glass">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Visitor entry request</h1>
          <p className="mt-1 text-sm text-muted-foreground">Fill in your details — the resident will be notified instantly.</p>
        </div>
        <Card className="glass rounded-3xl p-6 sm:p-8">
          {qrToken ? <QrEntry token={qrToken} onDone={setDone} /> : <ManualForm houses={houses} onDone={setDone} />}
        </Card>
      </main>
    </div>
  );
}

function QrEntry({ token, onDone }: { token: string; onDone: (s: "approved") => void }) {
  const [status, setStatus] = useState<"checking" | "valid" | "invalid">("checking");
  const [pass, setPass] = useState<{ id: string; guest_name: string; house_id: string; valid_date: string; start_time: string; end_time: string; used: boolean } | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("guest_passes").select("*").eq("qr_token", token).maybeSingle();
      if (!data) return setStatus("invalid");
      const now = new Date();
      const dt = new Date(`${data.valid_date}T${data.end_time}`);
      if (data.used || dt < now) return setStatus("invalid");
      setPass(data as never);
      setStatus("valid");
    })();
  }, [token]);

  const submit = async () => {
    if (!pass) return;
    await supabase.from("visitors").insert({
      house_id: pass.house_id, full_name: pass.guest_name, mobile: "", purpose: "Guest Pass",
      visitor_count: 1, status: "approved", guest_pass_id: pass.id,
    });
    await supabase.from("guest_passes").update({ used: true }).eq("id", pass.id);
    toast.success("Approved via guest pass");
    onDone("approved");
  };

  if (status === "checking") return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (status === "invalid") return <div className="text-center py-6"><p className="text-destructive font-medium">This QR code is invalid or expired.</p></div>;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[color-mix(in_oklab,var(--success)_15%,transparent)] p-4">
        <div className="font-semibold">Valid guest pass</div>
        <div className="text-sm text-muted-foreground">Guest: {pass?.guest_name}</div>
      </div>
      <Button onClick={submit} className="w-full gradient-hero text-white border-0">Confirm entry</Button>
    </div>
  );
}

function ManualForm({ houses, onDone }: { houses: House[]; onDone: (s: "pending") => void }) {
  const [f, setF] = useState({
    full_name: "", mobile: "", vehicle_number: "", purpose: "", house_id: "",
    visitor_count: 1, expected_duration: "1 hour",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.full_name.trim()) return toast.error("Name is required");
    if (!f.mobile.trim() || f.mobile.length < 10) return toast.error("Valid mobile number required");
    if (!f.house_id) return toast.error("Please select the house number");
    setBusy(true);
    const { error } = await supabase.from("visitors").insert({ ...f, status: "pending" });
    setBusy(false);
    if (error) return toast.error(error.message);
    onDone("pending");
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Full Name *</Label>
          <Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        </div>
        <div>
          <Label>Mobile Number *</Label>
          <Input inputMode="tel" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} />
        </div>
        <div>
          <Label>House Number *</Label>
          <Select value={f.house_id} onValueChange={(v) => setF({ ...f, house_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select house" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {houses.map((h) => <SelectItem key={h.id} value={h.id}>House {h.house_number}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Vehicle Number</Label>
          <Input value={f.vehicle_number} onChange={(e) => setF({ ...f, vehicle_number: e.target.value })} placeholder="Optional" />
        </div>
        <div>
          <Label>Number of Visitors</Label>
          <Input type="number" min={1} value={f.visitor_count} onChange={(e) => setF({ ...f, visitor_count: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Expected Stay</Label>
          <Select value={f.expected_duration} onValueChange={(v) => setF({ ...f, expected_duration: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["15 min", "30 min", "1 hour", "2 hours", "Half day", "Full day"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Purpose of Visit</Label>
        <Textarea value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder="e.g. Family visit, delivery..." rows={3} />
      </div>
      <Button type="submit" disabled={busy} className="w-full gradient-hero text-white border-0 shadow-glass">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Entry Request"}
      </Button>
    </form>
  );
}

function Confirmation({ status }: { status: "approved" | "pending" }) {
  return (
    <div className="min-h-screen gradient-soft grid place-items-center px-4">
      <Card className="glass rounded-3xl p-10 max-w-md text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[color-mix(in_oklab,var(--success)_25%,transparent)]">
          <CheckCircle2 className="h-9 w-9 text-[var(--success)]" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold">
          {status === "approved" ? "Entry approved!" : "Request submitted!"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {status === "approved"
            ? "Please proceed to the gate. The guard will let you in."
            : "Your entry request has been submitted and is awaiting approval from the resident."}
        </p>
        <Building2 className="mx-auto mt-6 h-6 w-6 text-muted-foreground" />
        <div className="mt-2 text-xs text-muted-foreground">Sahjanand Smart Gate</div>
      </Card>
    </div>
  );
}
