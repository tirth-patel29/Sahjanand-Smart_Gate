# Sahjanand Smart Gate - Phase 1 Implementation Documentation

## Overview

Phase 1 implements the critical foundation for production-ready authentication, audit logging, and security. This document explains all changes made to the database schema, authentication flow, and row-level security (RLS) policies.

---

## 1. SQL MIGRATIONS

### Migration File: `20260531100000_phase1_auth_audit.sql`

The migration adds three main components:

#### 1.1 Profiles Table Extensions

```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
```

**Purpose:**
- `must_change_password`: Forces residents to change their temporary password on first login
- `password_changed_at`: Tracks when password was last changed (for security policies)
- `last_login_at`: Records last successful login (for audit/monitoring)

**Initial State:**
- All existing residents get `must_change_password = true`
- Admin/Guard get `must_change_password = false`

---

#### 1.2 Audit Logs Table

```sql
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  user_role app_role,
  action TEXT NOT NULL,           -- 'visitor_approved', 'login_success', etc
  resource_type TEXT NOT NULL,    -- 'visitor', 'resident', 'guest_pass'
  resource_id UUID,               -- ID of affected record
  changes JSONB,                  -- Before/after: { before: {...}, after: {...} }
  metadata JSONB,                 -- Additional context
  created_at TIMESTAMPTZ DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);
```

**Indexes for Performance:**
- `idx_audit_logs_user_id` - Query logs by user
- `idx_audit_logs_created_at` - Query logs by time (sorted DESC)
- `idx_audit_logs_resource` - Query logs by resource type/id
- `idx_audit_logs_action` - Query logs by action type

**Important:** This table is **immutable** - never delete records.

**Audit Actions Tracked:**
- `login_success` / `login_failed` - Authentication events
- `password_changed` - Password changes
- `visitor_pending` / `visitor_approved` / `visitor_rejected` - Visitor status changes
- `resident_created` / `resident_updated` - Resident management
- Any action via `log_audit()` function

---

#### 1.3 Visitor Approvals Table

```sql
CREATE TABLE public.visitor_approvals (
  id UUID PRIMARY KEY,
  visitor_id UUID NOT NULL REFERENCES visitors(id),
  house_id UUID NOT NULL REFERENCES houses(id),
  approved_by UUID NOT NULL REFERENCES auth.users(id),
  status visitor_status NOT NULL,
  reason TEXT,                    -- Why rejected/wait_at_gate
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);
```

**Purpose:** Maintains audit trail of who approved/rejected each visitor and when.

---

### 1.4 Database Functions

#### Function: `log_audit()`

```sql
CREATE OR REPLACE FUNCTION public.log_audit(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_changes JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER SET search_path = public
```

**Usage from Application:**
```typescript
// Log a visitor approval
await logAudit(
  'visitor_approved',
  'visitor',
  visitorId,
  { before_status: 'pending', after_status: 'approved' },
  { house_id: houseId }
);
```

**Accessible to:** `authenticated` and `service_role`

---

#### Function: `update_password_changed_at()`

```sql
CREATE OR REPLACE FUNCTION public.update_password_changed_at()
RETURNS void
SECURITY DEFINER SET search_path = public
```

**Purpose:** Called after successful password change to:
1. Set `password_changed_at = now()`
2. Set `must_change_password = false`

**Usage:**
```typescript
await supabase.rpc('update_password_changed_at');
```

---

### 1.5 Data Constraints Added

```sql
ALTER TABLE public.visitors
  ADD CONSTRAINT chk_visitor_count_positive CHECK (visitor_count > 0);

ALTER TABLE public.visitors
  ADD CONSTRAINT chk_mobile_not_empty CHECK (mobile <> '');
```

**Purpose:** Prevent invalid data at database level (not just UI).

---

## 2. DATABASE SCHEMA

### Updated Schema Structure

```
auth.users (Supabase built-in)
├── id (UUID)
├── email
├── encrypted_password
└── user_metadata

public.user_roles
├── user_id → auth.users
├── role (admin|guard|resident)

public.profiles ✨ UPDATED
├── id → auth.users
├── full_name
├── house_id → houses
├── mobile
├── must_change_password ✨ NEW
├── password_changed_at ✨ NEW
├── last_login_at ✨ NEW

public.houses
├── id
├── house_number (1-89)
├── owner_name
├── mobile_number

public.visitors
├── id
├── house_id
├── full_name
├── mobile (NOT NULL, NOT EMPTY)
├── visitor_count (> 0) ✨ CONSTRAINED
├── status (pending|approved|...)
├── entered_at
├── exited_at

public.visitor_approvals ✨ NEW
├── visitor_id → visitors
├── approved_by → auth.users
├── house_id → houses
├── status
├── reason (optional)
├── approved_at

public.guest_passes
├── id
├── house_id
├── qr_token
├── used (boolean)

public.audit_logs ✨ NEW
├── user_id → auth.users
├── action (TEXT)
├── resource_type (TEXT)
├── resource_id (UUID)
├── changes (JSONB)
├── created_at (indexed, DESC)
```

---

## 3. ROW LEVEL SECURITY (RLS) POLICIES

### 3.1 Audit Logs Policies

**Policy 1: Admins can read all audit logs**
```sql
CREATE POLICY "admin read all audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

**Policy 2: Guards can read audit logs for visitors only**
```sql
CREATE POLICY "guard read visitor audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'guard')
    AND resource_type = 'visitor'
  );
```

**Policy 3: Residents can read audit for their house's resources**
```sql
CREATE POLICY "resident read own audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'resident')
    AND resource_type IN ('visitor', 'guest_pass', 'frequent_visitor')
    AND resource_id IN (
      SELECT v.id FROM public.visitors v WHERE v.house_id = public.current_house_id()
      -- Similar for guest_passes and frequent_visitors
    )
  );
```

---

### 3.2 Guest Passes - Fixed Policy

**Old (Vulnerable) Policy:**
```sql
-- VULNERABLE - Anyone could mark guest_pass as used!
FOR UPDATE TO authenticated, anon USING (true)
```

**New Policy:**
```sql
CREATE POLICY "gp update own or guard" ON public.guest_passes FOR UPDATE TO authenticated
  USING (
    house_id = public.current_house_id()
    OR public.has_role(auth.uid(), 'guard')
    OR public.has_role(auth.uid(), 'admin')
  );

-- IMPORTANT: Anon users cannot update
CREATE POLICY "anon cannot update guest_pass" ON public.guest_passes FOR UPDATE TO anon
  USING (false);
```

**Effect:** Prevents unauthorized marking of guest passes as used.

---

### 3.3 Visitors - Prevent Post-Exit Updates

**Old Policy:**
```sql
-- Allowed updates even after guest exited
USING (house_id = public.current_house_id() OR ...)
```

**New Policy:**
```sql
CREATE POLICY "residents update own visitors v2" ON public.visitors FOR UPDATE TO authenticated
  USING (
    (house_id = public.current_house_id() OR public.has_role(...))
    AND status <> 'exited'  -- ← ADDED: Can't modify after guest left
  );
```

**Effect:** Once visitor status is "exited", no further modifications allowed.

---

### 3.4 Visitor Approvals - New RLS

**Policy 1: Residents read approvals for their house**
```sql
CREATE POLICY "resident read approvals" ON public.visitor_approvals FOR SELECT TO authenticated
  USING (house_id = public.current_house_id() OR public.has_role(auth.uid(), 'admin'));
```

**Policy 2: Residents insert approvals for their house**
```sql
CREATE POLICY "resident approve visitors" ON public.visitor_approvals FOR INSERT TO authenticated
  WITH CHECK (house_id = public.current_house_id());
```

**Policy 3: Guards read all approvals**
```sql
CREATE POLICY "guard read approvals" ON public.visitor_approvals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'guard'));
```

---

## 4. AUTHENTICATION FLOW

### 4.1 Initial Setup (Seeding)

When an admin account or resident account is created:

```
1. Create auth.user with email: `house{N}@sahjanand.local`
2. Set temporary password: `sahjanand@{N}` (e.g., `sahjanand@12`)
3. Create profile with must_change_password = true
4. Create user_role entry (resident, guard, or admin)
5. Log to audit_logs: 'resident_created' action
```

**File:** `src/routes/api/public/seed.ts` handles initial seeding.

---

### 4.2 First Login Flow

```
┌─────────────────────────────────┐
│  Resident Opens App             │
├─────────────────────────────────┤
│  → User sees login page         │
│  → Resident enters house: 12    │
│  → System auto-fills password   │
│    with format: sahjanand@12    │
│  → User submits                 │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  Supabase Auth                  │
├─────────────────────────────────┤
│  Verifies credentials           │
│  Returns session token          │
│  App logs login_success audit   │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  Auth Context Updates           │
├─────────────────────────────────┤
│  → Loads profile                │
│  → Detects must_change_password │
│  → Sets flag in state           │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  PasswordChangeDialog Appears   │
├─────────────────────────────────┤
│  ✓ Shows only if must_change_   │
│    password = true              │
│  ✓ Blocks portal access         │
│  ✓ User must:                   │
│    - Enter current password     │
│    - Enter new password (2x)    │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  Password Change Handler        │
├─────────────────────────────────┤
│  Verifies current password      │
│  Updates Supabase auth password │
│  Calls update_password_changed_ │
│  at() function                  │
│  Sets must_change_password=false│
│  Logs password_changed audit    │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  Resident Portal Access         │
├─────────────────────────────────┤
│  Dialog closes                  │
│  /resident route loads          │
│  Full access granted            │
└─────────────────────────────────┘
```

---

### 4.3 Login Audit Logging

**Success Case:**
```typescript
await logAudit(
  'login_success',
  'resident',
  undefined,
  null,
  { house_number: '12' }
);
```

**Failure Case:**
```typescript
await logAudit(
  'login_failed',
  'resident',
  undefined,
  null,
  { house_number: '12', reason: 'Invalid credentials' }
);
```

---

### 4.4 Guards/Admins

- **No password change required** (must_change_password = false)
- Email/password from seed
- Direct access to dashboard
- All actions logged to audit_logs

---

## 5. ROLE-BASED ACCESS CONTROL (RBAC)

### Matrix

| Action | Resident | Guard | Admin | Anon |
|--------|----------|-------|-------|------|
| Read own house visitors | ✓ | ✗ | ✓ | ✗ |
| Read all visitors | ✗ | ✓ | ✓ | ✗ |
| Approve visitor | ✓* | ✗ | ✓ | ✗ |
| Mark entered/exited | ✗ | ✓ | ✓ | ✗ |
| Read audit logs | ✓** | ✓** | ✓ | ✗ |
| Manage houses | ✗ | ✗ | ✓ | ✗ |
| Manage residents | ✗ | ✗ | ✓ | ✗ |
| Create visitor request | ✓ | ✓ | ✓ | ✓ |
| Use guest pass QR | ✓ | ✓ | ✓ | ✓ |

**Legend:**
- `✓` = Allowed
- `✗` = Denied
- `✓*` = Only for own house
- `✓**` = Limited to own house's resources
- `*` = Via RLS policies

---

## 6. KEY SECURITY IMPROVEMENTS

### Before Phase 1:
- ❌ No audit trail
- ❌ Anyone could mark guest pass as used twice
- ❌ No password change enforcement
- ❌ Visitors could be modified after exit
- ❌ No tracking of who approved visitors
- ❌ Can't investigate security issues

### After Phase 1:
- ✅ Complete audit trail of all actions
- ✅ Guest passes locked after first use
- ✅ Forced password change on first login
- ✅ Visitor records immutable after exit
- ✅ Approval trail with timestamps
- ✅ Full investigative capability

---

## 7. APPLICATION CODE CHANGES

### New Files:
1. **`src/lib/auth-utils.ts`** - Auth utilities:
   - `logAudit()` - Log actions
   - `getUserMustChangePassword()` - Check password requirement
   - `markPasswordChanged()` - Mark password change complete
   - `recordVisitorApproval()` - Record approval
   - `getAuditLogs()` - Fetch audit logs

2. **`src/components/PasswordChangeDialog.tsx`** - First-login password dialog

3. **`.env.example`** - Environment variable template

### Modified Files:

1. **`src/lib/auth.tsx`**
   - Added `mustChangePassword` to auth context
   - Improved metadata loading (removed setTimeout hack)
   - Added error handling

2. **`src/routes/__root.tsx`**
   - Added `PasswordChangeDialog` component
   - Integrated password change flow

3. **`src/routes/login.tsx`**
   - Added temporary password UI with auto-fill
   - Added login audit logging
   - Improved UX with password format hints

4. **`src/integrations/supabase/types.ts`**
   - Added `audit_logs` table type
   - Added `visitor_approvals` table type
   - Extended `profiles` table type with new fields
   - Added function signatures for `log_audit()` and `update_password_changed_at()`

---

## 8. TESTING CHECKLIST

### Manual Testing (Before Deployment):

- [ ] **Seed Data**
  - [ ] Run seed endpoint
  - [ ] Verify 89 residents created with `must_change_password=true`
  - [ ] Verify admin/guard have `must_change_password=false`

- [ ] **First Login (Resident)**
  - [ ] Log in with house 1, password `sahjanand@1`
  - [ ] Verify password change dialog appears
  - [ ] Enter current password (sahjanand@1)
  - [ ] Enter new password (min 8 chars)
  - [ ] Verify redirect to resident portal
  - [ ] Log out and log in with new password
  - [ ] Verify no password change dialog on second login

- [ ] **First Login (Admin/Guard)**
  - [ ] Log in admin
  - [ ] Verify NO password change dialog
  - [ ] Direct access to dashboard

- [ ] **Audit Logging**
  - [ ] Check audit_logs table for login_success/login_failed entries
  - [ ] Verify user_email populated correctly
  - [ ] Check timestamp accuracy

- [ ] **RLS Policies**
  - [ ] Try to update guest_pass as anon (should fail)
  - [ ] Try to update guest_pass as resident of different house (should fail)
  - [ ] Try to read audit_logs as resident (should only see own house)
  - [ ] Try to read audit_logs as guard (should see all visitors)

- [ ] **Database Constraints**
  - [ ] Try to insert visitor with visitor_count=0 (should fail)
  - [ ] Try to insert visitor with empty mobile (should fail)

---

## 9. DEPLOYMENT STEPS

### 1. Backup Current Database
```bash
# Via Supabase dashboard: Database → Backups → Create Manual Backup
```

### 2. Deploy Migration
```bash
# Via Supabase dashboard: SQL Editor → Paste migration content
# Or use Supabase CLI if configured
supabase db push
```

### 3. Verify Migration
```sql
-- Check new columns exist
SELECT must_change_password, password_changed_at, last_login_at 
FROM public.profiles LIMIT 1;

-- Check audit_logs table exists
SELECT COUNT(*) FROM public.audit_logs;

-- Check visitor_approvals table exists
SELECT COUNT(*) FROM public.visitor_approvals;
```

### 4. Deploy Code Changes
```bash
npm run build
# Deploy to production
```

### 5. Run Seed (if fresh environment)
```bash
# Call POST /api/public/seed to create initial users
```

### 6. Verify Residents Need Password Change
```sql
SELECT COUNT(*) FROM public.profiles 
WHERE must_change_password = true 
AND id IN (SELECT user_id FROM public.user_roles WHERE role='resident');
-- Should return: 89
```

---

## 10. MONITORING & AUDIT

### View Login Attempts
```sql
SELECT user_email, action, metadata, created_at 
FROM public.audit_logs 
WHERE action IN ('login_success', 'login_failed') 
ORDER BY created_at DESC 
LIMIT 20;
```

### View Visitor Approvals
```sql
SELECT 
  va.approved_at,
  va.status,
  va.reason,
  pr.full_name as approved_by,
  v.full_name as visitor_name
FROM public.visitor_approvals va
JOIN public.profiles pr ON va.approved_by = pr.id
JOIN public.visitors v ON va.visitor_id = v.id
ORDER BY va.approved_at DESC;
```

### View Password Changes
```sql
SELECT user_email, metadata, created_at 
FROM public.audit_logs 
WHERE action = 'password_changed' 
ORDER BY created_at DESC;
```

---

## 11. TROUBLESHOOTING

### Problem: "must_change_password column doesn't exist"
**Solution:** 
- Verify migration was applied: `\d public.profiles`
- Check for error messages in Supabase UI

### Problem: Password change dialog doesn't appear
**Solution:**
- Check profile's `must_change_password` = true
- Clear browser cache/localStorage
- Check console for errors

### Problem: Guest pass can still be marked used multiple times
**Solution:**
- Verify RLS policy was applied: `SELECT * FROM pg_policies WHERE tablename='guest_passes'`
- Make sure anon policy exists with `USING (false)`

### Problem: Can't read audit_logs
**Solution:**
- Verify policies were applied
- Check role assignment in `user_roles` table
- Ensure policy matches user's role

---

## 12. NEXT STEPS

Phase 2 (Not included in Phase 1):
1. Add password reset functionality
2. Implement session timeout
3. Add 2FA for admins
4. Implement rate limiting
5. Add encryption for sensitive fields

---

## Appendix A: Migration Reversal (Emergency Only)

If migration causes issues and rollback needed:

```sql
-- DROP NEW TABLES
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.visitor_approvals CASCADE;

-- DROP COLUMNS FROM PROFILES
ALTER TABLE public.profiles DROP COLUMN IF EXISTS must_change_password;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS password_changed_at;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS last_login_at;

-- DROP FUNCTIONS
DROP FUNCTION IF EXISTS public.log_audit(...);
DROP FUNCTION IF EXISTS public.update_password_changed_at();

-- RESTORE OLD RLS POLICIES (restore from before migration)
```

⚠️ **WARNING:** Only use for emergency. Data loss may occur.

