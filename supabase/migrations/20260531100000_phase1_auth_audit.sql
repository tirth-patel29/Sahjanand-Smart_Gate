-- Phase 1: Authentication, Audit & Security
-- Created: 2026-05-31
-- Purpose: Add audit logging, password management, approval tracking, and tightened RLS

-- ============================================================================
-- PART 1: EXTEND PROFILES TABLE WITH PASSWORD MANAGEMENT
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Comment for clarity
COMMENT ON COLUMN public.profiles.must_change_password IS 'Force user to change password on next login (set for new residents)';
COMMENT ON COLUMN public.profiles.password_changed_at IS 'Timestamp of last password change';
COMMENT ON COLUMN public.profiles.last_login_at IS 'Timestamp of last successful login';

-- ============================================================================
-- PART 2: AUDIT LOGS TABLE (IMMUTABLE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who did the action
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,  -- Denormalized for audit trail
  user_role public.app_role,  -- Denormalized role at time of action
  
  -- What action was performed
  action TEXT NOT NULL,  -- e.g., 'visitor_approved', 'visitor_rejected', 'resident_created'
  resource_type TEXT NOT NULL,  -- e.g., 'visitor', 'resident', 'guest_pass'
  resource_id UUID,  -- ID of affected record
  
  -- Additional context
  changes JSONB,  -- Before/after values: { before: {...}, after: {...} }
  metadata JSONB,  -- Additional context
  
  -- Timestamp (immutable)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,  -- Client IP if available
  user_agent TEXT  -- Browser/client info if available
);

-- Create indexes for efficient querying
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Comment on table
COMMENT ON TABLE public.audit_logs IS 'Immutable audit trail of all significant actions. Never delete records.';

-- ============================================================================
-- PART 3: VISITOR APPROVALS TABLE (Track who approved/rejected)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.visitor_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  visitor_id UUID NOT NULL REFERENCES public.visitors(id) ON DELETE CASCADE,
  house_id UUID NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  
  -- Who made the decision
  approved_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- Decision details
  status public.visitor_status NOT NULL,  -- 'approved', 'rejected', or 'wait_at_gate'
  reason TEXT,  -- Why was visitor rejected/asked to wait?
  
  -- Timestamps
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_visitor_approvals_visitor_id ON public.visitor_approvals(visitor_id);
CREATE INDEX idx_visitor_approvals_house_id ON public.visitor_approvals(house_id);
CREATE INDEX idx_visitor_approvals_approved_by ON public.visitor_approvals(approved_by);

COMMENT ON TABLE public.visitor_approvals IS 'Track who approved/rejected each visitor and why';

-- ============================================================================
-- PART 4: AUDIT LOGGING FUNCTIONS
-- ============================================================================

-- Function to log actions to audit_logs
CREATE OR REPLACE FUNCTION public.log_audit(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_changes JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_user_id UUID := auth.uid();
  v_user_email TEXT;
  v_user_role public.app_role;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  
  -- Get user's role if authenticated
  IF v_user_id IS NOT NULL THEN
    SELECT role INTO v_user_role FROM public.user_roles WHERE user_id = v_user_id LIMIT 1;
  END IF;
  
  -- Insert audit log
  INSERT INTO public.audit_logs (
    user_id, user_email, user_role, action, resource_type, resource_id, changes, metadata
  ) VALUES (
    v_user_id, v_user_email, v_user_role, p_action, p_resource_type, p_resource_id, p_changes, p_metadata
  ) RETURNING audit_logs.id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Update last_login_at when user logs in (trigger via application code)
CREATE OR REPLACE FUNCTION public.update_last_login()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET last_login_at = now()
  WHERE id = auth.uid();
  RETURN NEW;
END;
$$;

-- Function to update password_changed_at
CREATE OR REPLACE FUNCTION public.update_password_changed_at()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET password_changed_at = now(), must_change_password = false
  WHERE id = auth.uid();
END;
$$;

-- ============================================================================
-- PART 5: GRANTS FOR NEW FUNCTIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.log_audit(TEXT, TEXT, UUID, JSONB, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_password_changed_at() TO authenticated;

-- audit_logs: Only authenticated users can read (filtered by role), service_role has all
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only service_role can insert into audit_logs (via triggers/functions)
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

-- visitor_approvals: Track approvals
ALTER TABLE public.visitor_approvals ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.visitor_approvals TO authenticated;
GRANT ALL ON public.visitor_approvals TO service_role;

-- ============================================================================
-- PART 6: RLS POLICIES FOR AUDIT LOGS
-- ============================================================================

-- Admins can read all audit logs
CREATE POLICY "admin read all audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Guards can read audit logs for visitors (not for system actions)
CREATE POLICY "guard read visitor audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'guard')
    AND resource_type = 'visitor'
  );

-- Residents can read audit logs only for their own house's visitors
CREATE POLICY "resident read own audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'resident')
    AND resource_type IN ('visitor', 'guest_pass', 'frequent_visitor')
    AND resource_id IN (
      SELECT v.id FROM public.visitors v
      WHERE v.house_id = public.current_house_id()
      UNION
      SELECT g.id FROM public.guest_passes g
      WHERE g.house_id = public.current_house_id()
      UNION
      SELECT f.id FROM public.frequent_visitors f
      WHERE f.house_id = public.current_house_id()
    )
  );

-- ============================================================================
-- PART 7: RLS POLICIES FOR VISITOR APPROVALS
-- ============================================================================

-- Residents can read approvals for their own house's visitors
CREATE POLICY "resident read approvals" ON public.visitor_approvals FOR SELECT TO authenticated
  USING (house_id = public.current_house_id() OR public.has_role(auth.uid(), 'admin'));

-- Residents can insert approvals for their own house
CREATE POLICY "resident approve visitors" ON public.visitor_approvals FOR INSERT TO authenticated
  WITH CHECK (house_id = public.current_house_id());

-- Guards can read all approvals
CREATE POLICY "guard read approvals" ON public.visitor_approvals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'guard'));

-- ============================================================================
-- PART 8: TIGHTEN GUEST PASSES RLS
-- ============================================================================

-- Drop old overly-permissive policy
DROP POLICY IF EXISTS "gp update own" ON public.guest_passes;

-- New policy: Only residents of the house or admins can update (mark as used)
-- Guards can also update (to mark used at gate)
CREATE POLICY "gp update own or guard" ON public.guest_passes FOR UPDATE TO authenticated
  USING (
    house_id = public.current_house_id()
    OR public.has_role(auth.uid(), 'guard')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (true);

-- Anon users cannot update (prevent QR reuse attack)
CREATE POLICY "anon cannot update guest_pass" ON public.guest_passes FOR UPDATE TO anon
  USING (false);

-- ============================================================================
-- PART 9: ADD VISITOR CONSTRAINTS
-- ============================================================================

-- Add check constraint: visitor_count must be > 0
ALTER TABLE public.visitors
  ADD CONSTRAINT chk_visitor_count_positive CHECK (visitor_count > 0);

-- Add check constraint: mobile is not empty
ALTER TABLE public.visitors
  ADD CONSTRAINT chk_mobile_not_empty CHECK (mobile <> '');

-- Add index on house_id for faster queries
CREATE INDEX IF NOT EXISTS idx_visitors_house_id ON public.visitors(house_id);
CREATE INDEX IF NOT EXISTS idx_visitors_status ON public.visitors(status);
CREATE INDEX IF NOT EXISTS idx_visitors_created_at ON public.visitors(created_at DESC);

-- ============================================================================
-- PART 10: VISITOR UPDATE POLICY - PREVENT MODIFICATION AFTER EXIT
-- ============================================================================

-- Drop old policy that allowed too much
DROP POLICY IF EXISTS "residents update own visitors" ON public.visitors;

-- New policy: Prevent updates to exited visitors
CREATE POLICY "residents update own visitors v2" ON public.visitors FOR UPDATE TO authenticated
  USING (
    (house_id = public.current_house_id() OR public.has_role(auth.uid(), 'guard') OR public.has_role(auth.uid(), 'admin'))
    AND status <> 'exited'  -- <-- IMPORTANT: Can't modify after guest has exited
  );

-- ============================================================================
-- PART 11: CREATE FUNCTION TO AUTO-RECORD VISITOR APPROVAL
-- ============================================================================

-- When visitor status changes, record approval
CREATE OR REPLACE FUNCTION public.record_visitor_approval()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reason TEXT;
BEGIN
  -- Only record if status changed to approved/rejected/wait_at_gate from pending/wait_at_gate
  IF NEW.status IN ('approved', 'rejected', 'wait_at_gate') 
     AND (OLD.status IS NULL OR OLD.status IN ('pending', 'wait_at_gate')) THEN
    
    -- Extract reason if provided in expected_duration field (for rejection reason)
    v_reason := CASE 
      WHEN NEW.status = 'rejected' AND NEW.expected_duration IS NOT NULL 
        THEN NEW.expected_duration
      ELSE NULL
    END;
    
    -- Insert approval record
    INSERT INTO public.visitor_approvals (visitor_id, house_id, approved_by, status, reason)
    VALUES (
      NEW.id,
      NEW.house_id,
      auth.uid(),
      NEW.status,
      v_reason
    );
    
    -- Log to audit_logs
    PERFORM public.log_audit(
      'visitor_' || lower(NEW.status::text),
      'visitor',
      NEW.id,
      jsonb_build_object('before_status', OLD.status, 'after_status', NEW.status),
      jsonb_build_object('house_id', NEW.house_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop old trigger if it exists
DROP TRIGGER IF EXISTS trigger_record_visitor_approval ON public.visitors;

-- Create trigger
CREATE TRIGGER trigger_record_visitor_approval
  AFTER UPDATE OF status ON public.visitors
  FOR EACH ROW
  EXECUTE FUNCTION public.record_visitor_approval();

-- ============================================================================
-- PART 12: SEED DEFAULT DATA - FORCE PASSWORD CHANGE FOR RESIDENTS
-- ============================================================================

-- Update all existing residents to require password change on next login
UPDATE public.profiles
SET must_change_password = true
WHERE id IN (SELECT user_id FROM public.user_roles WHERE role = 'resident');

-- Ensure admin/guard do not require password change
UPDATE public.profiles
SET must_change_password = false
WHERE id IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'guard'));

-- ============================================================================
-- PART 13: DOCUMENTATION
-- ============================================================================

-- Run this after all schema changes to verify
--
-- SELECT COUNT(*) as audit_logs_count FROM public.audit_logs;
-- SELECT COUNT(*) as visitor_approvals_count FROM public.visitor_approvals;
-- SELECT COUNT(*) as residents_needing_password_change FROM public.profiles WHERE must_change_password = true;
--
-- Test RLS:
-- SELECT * FROM public.audit_logs; -- Should fail if not admin
-- INSERT INTO public.audit_logs (...) VALUES (...); -- Should fail (not service_role)
