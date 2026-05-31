import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Building2, LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const isDark = localStorage.getItem("theme") === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        const n = !dark;
        setDark(n);
        document.documentElement.classList.toggle("dark", n);
        localStorage.setItem("theme", n ? "dark" : "light");
      }}
      aria-label="Toggle theme"
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}

export function PortalShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { signOut, fullName, role, houseNumber } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-screen gradient-soft">
      <header className="sticky top-0 z-30 glass border-b backdrop-blur-xl">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-hero shadow-glass">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">Sahjanand</div>
              <div className="text-xs text-muted-foreground">Smart Gate</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-medium">{fullName ?? "User"}</div>
              <div className="text-xs text-muted-foreground capitalize">
                {role} {houseNumber ? `· House ${houseNumber}` : ""}
              </div>
            </div>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={async () => { await signOut(); nav({ to: "/" }); }} aria-label="Sign out">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}

export function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: "primary" | "success" | "warning" | "danger" | "info" }) {
  const color = {
    primary: "from-[color-mix(in_oklab,var(--primary)_20%,transparent)] to-transparent",
    success: "from-[color-mix(in_oklab,var(--success)_20%,transparent)] to-transparent",
    warning: "from-[color-mix(in_oklab,var(--warning)_25%,transparent)] to-transparent",
    danger: "from-[color-mix(in_oklab,var(--destructive)_20%,transparent)] to-transparent",
    info: "from-[color-mix(in_oklab,var(--accent)_25%,transparent)] to-transparent",
  }[accent ?? "primary"];
  return (
    <div className={`glass rounded-2xl p-5 bg-gradient-to-br ${color}`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}
