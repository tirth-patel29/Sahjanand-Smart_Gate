-- Create entry_logs table to track QR code scans and guard entries
-- Date: 2026-06-01

CREATE TABLE IF NOT EXISTS public.entry_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_pass_id UUID NOT NULL REFERENCES public.guest_passes(id) ON DELETE CASCADE,
  guard_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  house_id UUID NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  scanned_at TIMESTAMP WITH TIME ZONE NOT NULL,
  denied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_entry_logs_guest_pass_id ON public.entry_logs(guest_pass_id);
CREATE INDEX IF NOT EXISTS idx_entry_logs_guard_id ON public.entry_logs(guard_id);
CREATE INDEX IF NOT EXISTS idx_entry_logs_house_id ON public.entry_logs(house_id);
CREATE INDEX IF NOT EXISTS idx_entry_logs_scanned_at ON public.entry_logs(scanned_at);
CREATE INDEX IF NOT EXISTS idx_entry_logs_created_at ON public.entry_logs(created_at);

-- Add RLS policies for entry_logs
ALTER TABLE public.entry_logs ENABLE ROW LEVEL SECURITY;

-- Guards can view and insert entry logs for their house
CREATE POLICY "guards_view_entry_logs"
  ON public.entry_logs
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT DISTINCT user_id FROM user_roles WHERE role = 'guard'
    )
  );

CREATE POLICY "guards_insert_entry_logs"
  ON public.entry_logs
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT DISTINCT user_id FROM user_roles WHERE role = 'guard'
    )
    AND guard_id = auth.uid()
  );

-- Admin can view all entry logs
CREATE POLICY "admin_view_entry_logs"
  ON public.entry_logs
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT DISTINCT user_id FROM user_roles WHERE role = 'admin'
    )
  );

-- Residents can view entry logs for their house
CREATE POLICY "residents_view_entry_logs"
  ON public.entry_logs
  FOR SELECT
  USING (
    house_id IN (
      SELECT id FROM public.houses WHERE id IN (
        SELECT house_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- Function to log entry audit trail
CREATE OR REPLACE FUNCTION public.log_entry_scan()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Log to audit_logs
  PERFORM public.log_audit(
    CASE WHEN NEW.denied THEN 'entry_denied' ELSE 'entry_allowed' END,
    'entry_log',
    NEW.id,
    jsonb_build_object(
      'guest_pass_id', NEW.guest_pass_id,
      'guest_name', NEW.guest_name,
      'house_id', NEW.house_id,
      'denied', NEW.denied
    ),
    jsonb_build_object('guard_id', NEW.guard_id, 'scanned_at', NEW.scanned_at)
  );
  
  RETURN NEW;
END;
$$;

-- Trigger to log entry scans
CREATE TRIGGER trigger_log_entry_scan
  AFTER INSERT ON public.entry_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.log_entry_scan();

-- Update guest_passes table to reference entry_logs (optional)
-- ALTER TABLE public.guest_passes ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMP WITH TIME ZONE;
