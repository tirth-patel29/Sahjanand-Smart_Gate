-- Fix for: function lower(visitor_status) does not exist
-- The previous trigger tried to call lower() on an enum type
-- Solution: Cast enum to text before calling lower()
-- Date: 2026-06-01

-- Drop the broken trigger
DROP TRIGGER IF EXISTS trigger_record_visitor_approval ON public.visitors;

-- Drop the broken function
DROP FUNCTION IF EXISTS public.record_visitor_approval();

-- Recreate the function with the fix
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
    -- FIX: Cast enum to text first: lower(NEW.status::text)
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

-- Recreate the trigger
CREATE TRIGGER trigger_record_visitor_approval
  AFTER UPDATE OF status ON public.visitors
  FOR EACH ROW
  EXECUTE FUNCTION public.record_visitor_approval();
