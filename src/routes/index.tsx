import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ShieldCheck, Home, UserCog, ScanLine, ArrowRight, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/PortalShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sahjanand Smart Gate — Modern Society Visitor Management" },
      { name: "description", content: "QR-based visitor entry, instant resident approvals, guard dashboard, and admin reports — all in one beautiful app." },
    ],
  }),
  component: Landing,
});

const portals = [
  { to: "/visitor", title: "Visitor", desc: "Request entry at the gate", icon: ScanLine, accent: "from-cyan-400/30" },
  { to: "/login?role=resident", title: "Resident", desc: "Approve visitors instantly", icon: Home, accent: "from-indigo-400/30" },
  { to: "/login?role=guard", title: "Guard", desc: "Manage gate operations", icon: ShieldCheck, accent: "from-purple-400/30" },
  { to: "/login?role=admin", title: "Admin", desc: "Society management hub", icon: UserCog, accent: "from-fuchsia-400/30" },
];

function Landing() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("sahjanand_seeded") === "1") return;
    fetch("/api/public/seed", { method: "POST" })
      .then((r) => r.ok && localStorage.setItem("sahjanand_seeded", "1"))
      .catch(() => {});
  }, []);
  return (
    <div className="min-h-screen gradient-soft">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-2xl gradient-hero shadow-glass">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">Sahjanand</div>
            <div className="text-xs text-muted-foreground -mt-0.5">Smart Gate</div>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <section className="mx-auto max-w-7xl px-4 pt-8 pb-16 sm:px-6 sm:pt-16 sm:pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)] animate-pulse" />
            89 homes · realtime approvals
          </div>
          <h1 className="mt-5 text-4xl sm:text-6xl font-semibold tracking-tight">
            Visitor management,<br /><span className="text-gradient">reimagined for societies.</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground">
            QR-based gate entry, instant resident approvals, and a beautiful admin hub. Built for modern residential communities.
          </p>
        </div>

        <div className="mt-12 sm:mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {portals.map((p) => (
            <Link key={p.to} to={p.to} className="group relative overflow-hidden rounded-3xl glass p-6 transition-all hover:-translate-y-1 hover:shadow-glass">
              <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${p.accent} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="grid h-12 w-12 place-items-center rounded-2xl gradient-hero shadow-glass">
                <p.icon className="h-6 w-6 text-white" />
              </div>
              <div className="mt-5 text-lg font-semibold">{p.title} Portal</div>
              <div className="mt-1 text-sm text-muted-foreground">{p.desc}</div>
              <div className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-16 rounded-3xl glass p-6 sm:p-8">
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { k: "Realtime", v: "Approvals reach the guard instantly — no refresh." },
              { k: "QR Guest Passes", v: "Generate one-time passes that auto-approve at the gate." },
              { k: "Full audit", v: "Every entry, exit and approval is logged for admins." },
            ].map((f) => (
              <div key={f.k}>
                <div className="text-sm font-semibold text-gradient">{f.k}</div>
                <div className="mt-1 text-sm text-muted-foreground">{f.v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 text-center text-xs text-muted-foreground">
          IF ANY QUERY CONTACT : TIRTH PATEL (HOUSE NO. 83)
        </div>
      </section>
    </div>
  );
}
