
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'guard', 'resident');

CREATE TABLE public.houses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_number TEXT NOT NULL UNIQUE,
  owner_name TEXT,
  mobile_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  mobile TEXT,
  house_id UUID REFERENCES public.houses(id) ON DELETE SET NULL,
  disabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

CREATE TYPE public.visitor_status AS ENUM ('pending','approved','rejected','wait_at_gate','entered','exited');

CREATE TABLE public.visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  vehicle_number TEXT,
  purpose TEXT,
  visitor_count INT NOT NULL DEFAULT 1,
  expected_duration TEXT,
  photo_url TEXT,
  status public.visitor_status NOT NULL DEFAULT 'pending',
  guest_pass_id UUID,
  entered_at TIMESTAMPTZ,
  exited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE public.frequent_category AS ENUM ('maid','driver','cook','tutor','family','other');

CREATE TABLE public.frequent_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mobile TEXT,
  category public.frequent_category NOT NULL DEFAULT 'other',
  auto_approve BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.guest_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  mobile TEXT,
  valid_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  qr_token TEXT NOT NULL UNIQUE DEFAULT md5(random()::text || clock_timestamp()::text),
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

CREATE OR REPLACE FUNCTION public.current_house_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT house_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Grants
GRANT SELECT ON public.houses TO anon, authenticated;
GRANT ALL ON public.houses TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.visitors TO anon, authenticated;
GRANT ALL ON public.visitors TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.frequent_visitors TO authenticated;
GRANT ALL ON public.frequent_visitors TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_passes TO anon, authenticated;
GRANT ALL ON public.guest_passes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notices TO authenticated;
GRANT SELECT ON public.notices TO anon;
GRANT ALL ON public.notices TO service_role;

-- Enable RLS
ALTER TABLE public.houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frequent_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- Policies: houses - public readable (so visitor portal can lookup house numbers)
CREATE POLICY "houses readable" ON public.houses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manage houses" ON public.houses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Profiles: user can read own, admin all
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'guard'));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin insert profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- user_roles: read own, admin all
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- visitors: anon can insert (gate visitor form), residents see their house, guards see all
CREATE POLICY "anyone insert visitor" ON public.visitors FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "residents read own" ON public.visitors FOR SELECT TO authenticated
  USING (
    house_id = public.current_house_id()
    OR public.has_role(auth.uid(),'guard')
    OR public.has_role(auth.uid(),'admin')
  );
CREATE POLICY "anon read own pending" ON public.visitors FOR SELECT TO anon USING (true);
CREATE POLICY "residents update own visitors" ON public.visitors FOR UPDATE TO authenticated
  USING (
    house_id = public.current_house_id()
    OR public.has_role(auth.uid(),'guard')
    OR public.has_role(auth.uid(),'admin')
  );

-- frequent_visitors: resident own house
CREATE POLICY "freq read own" ON public.frequent_visitors FOR SELECT TO authenticated
  USING (house_id = public.current_house_id() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "freq insert own" ON public.frequent_visitors FOR INSERT TO authenticated
  WITH CHECK (house_id = public.current_house_id());
CREATE POLICY "freq update own" ON public.frequent_visitors FOR UPDATE TO authenticated
  USING (house_id = public.current_house_id());
CREATE POLICY "freq delete own" ON public.frequent_visitors FOR DELETE TO authenticated
  USING (house_id = public.current_house_id());

-- guest_passes: resident own house, anon can read by qr (to validate)
CREATE POLICY "gp read own or guard" ON public.guest_passes FOR SELECT TO authenticated
  USING (house_id = public.current_house_id() OR public.has_role(auth.uid(),'guard') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "gp read anon" ON public.guest_passes FOR SELECT TO anon USING (true);
CREATE POLICY "gp insert own" ON public.guest_passes FOR INSERT TO authenticated
  WITH CHECK (house_id = public.current_house_id());
CREATE POLICY "gp update own" ON public.guest_passes FOR UPDATE TO authenticated, anon
  USING (true);
CREATE POLICY "gp delete own" ON public.guest_passes FOR DELETE TO authenticated
  USING (house_id = public.current_house_id());

-- notices: everyone reads, admin writes
CREATE POLICY "notices read" ON public.notices FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "notices admin write" ON public.notices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.visitors;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_passes;

-- Seed 89 houses
INSERT INTO public.houses (house_number, owner_name, mobile_number)
SELECT n::text, 'Owner ' || n, '90000000' || lpad(n::text,2,'0')
FROM generate_series(1,89) n;
