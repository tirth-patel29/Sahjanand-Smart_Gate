import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type Role = "admin" | "guard" | "resident";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: Role | null;
  houseId: string | null;
  houseNumber: string | null;
  fullName: string | null;
  mustChangePassword: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [houseId, setHouseId] = useState<string | null>(null);
  const [houseNumber, setHouseNumber] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadMeta = async (uid: string) => {
    try {
      // Fetch user role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .maybeSingle();
      
      const r = (roles?.role as Role) ?? null;
      setRole(r);
      
      // Fetch profile with house info
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, house_id, must_change_password, houses(house_number)")
        .eq("id", uid)
        .maybeSingle();
      
      if (profile) {
        setHouseId(profile.house_id ?? null);
        setFullName(profile.full_name ?? null);
        // Only show password change modal for residents (not guards/admins)
        const shouldChangePassword = profile.must_change_password === true && r === 'resident';
        setMustChangePassword(shouldChangePassword);
        
        const houses = (profile as { houses?: { house_number?: string } | null } | null)?.houses;
        setHouseNumber(houses?.house_number ?? null);
      }
    } catch (e) {
      console.error("Error loading auth metadata:", e);
    }
  };

  useEffect(() => {
    // Subscribe to auth state changes
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        loadMeta(s.user.id);
      } else {
        setRole(null);
        setHouseId(null);
        setHouseNumber(null);
        setFullName(null);
        setMustChangePassword(false);
      }
    });

    // Get initial session
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        await loadMeta(data.session.user.id);
      } else {
        // No valid session - clear all auth state
        setRole(null);
        setHouseId(null);
        setHouseNumber(null);
        setFullName(null);
        setMustChangePassword(false);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthCtx = {
    user: session?.user ?? null,
    session,
    role,
    houseId,
    houseNumber,
    fullName,
    mustChangePassword,
    loading,
    signOut: async () => {
      // Clear all state before signing out
      setRole(null);
      setHouseId(null);
      setHouseNumber(null);
      setFullName(null);
      setMustChangePassword(false);
      setSession(null);
      await supabase.auth.signOut();
    },
    refresh: async () => {
      if (session?.user) await loadMeta(session.user.id);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
