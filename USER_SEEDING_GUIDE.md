# User Seeding Guide

## Overview

This guide explains how to populate Supabase Authentication with resident, guard, and admin users for the Sahjanand Smart Gate system.

## Architecture

### Three-Table System

```
┌─────────────────────────────────────────────┐
│  Supabase Auth (auth.users)                 │
│  - Manages authentication (email + password)│
│  - Generated UUID assigned to id            │
│  - Encrypted password storage               │
└─────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────┐
│  Public Profiles (public.profiles)          │
│  - User metadata (name, house_number, role) │
│  - Links to houses table                    │
│  - must_change_password flag for residents  │
└─────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────┐
│  User Roles (public.user_roles)             │
│  - Role assignments (resident/guard/admin)  │
│  - Enables RLS policies                     │
└─────────────────────────────────────────────┘
```

## Why Not Pure SQL?

❌ **SQL migrations cannot create Supabase Auth users** because:
1. Auth users are managed by Supabase Auth service, not PostgreSQL directly
2. Passwords must be hashed with bcrypt (not plaintext SQL)
3. Auth metadata requires Supabase-specific APIs
4. Email confirmation flow is managed by Supabase

✅ **Admin API is correct approach** because:
1. Uses service role key (admin credentials)
2. Handles password hashing automatically
3. Integrates with Supabase Auth system
4. Can set custom metadata directly
5. Transactional error handling per user

## Safety Levels Comparison

| Method | Safety | Speed | Reliability | Recommended |
|--------|--------|-------|-------------|-------------|
| **Admin API (TypeScript)** | ⭐⭐⭐⭐⭐ | Fast | High | ✅ YES |
| SQL Migration | ❌ Not possible | N/A | N/A | N/A |
| REST API calls | ⭐⭐⭐ | Slower | Medium | Backup only |
| Direct DB inserts | ❌ Insecure | Fast | Breaks auth | NEVER |

## Users to Create

### Residents (89 total)
- Email: `house{N}@sahjanand.local` (1-89)
- Password: `sahjanand@{N}` (temporary)
- Role: `resident`
- Flag: `must_change_password = true`
- House: Linked to houses table by house_number

### Guard (1 total)
- Email: `guard@sahjanand.local`
- Password: `tirth@123//.@123` (permanent)
- Role: `guard`
- Flag: `must_change_password = false`

### Admin (1 total)
- Email: `admin@sahjanand.local`
- Password: `Man@123.//@123` (permanent)
- Role: `admin`
- Flag: `must_change_password = false`

## How to Run

### Prerequisites

1. **Verify environment variables** are set:
   ```bash
   echo $env:VITE_SUPABASE_URL
   echo $env:SUPABASE_SERVICE_ROLE_KEY
   ```

2. **Install tsx** (if not already installed):
   ```powershell
   npm install --save-dev tsx
   ```

### Step 1: Run the seed script

```bash
npm run seed
```

### Step 2: Monitor output

Expected output:
```
🌱 Starting user seeding...

📝 Preparing 89 resident users...
📝 Preparing 1 guard user...
📝 Preparing 1 admin user...
✓ Prepared 91 users total

Creating resident: house1@sahjanand.local...
  ✓ Auth user created: <uuid>
  ✓ Profile created
  ✓ Role assigned: resident

Creating resident: house2@sahjanand.local...
...
📊 Seeding Summary:
✅ Successful: 91
❌ Failed: 0
📋 Total: 91

User Breakdown:
  🏠 Residents: 89
  👮 Guards: 1
  👤 Admins: 1

✨ Sample credentials:
  Resident: house1@sahjanand.local / sahjanand@1
  Guard: guard@sahjanand.local / tirth@123//.@123
  Admin: admin@sahjanand.local / Man@123.//@123

🎉 User seeding complete!
```

### Step 3: Verify in Supabase

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Should see 91 users listed
3. Check **Profiles table**:
   ```sql
   SELECT COUNT(*), role FROM profiles GROUP BY role;
   -- Result: resident=89, guard=1, admin=1
   ```

## Testing the Setup

### Test 1: Resident First Login

```typescript
// Test password change flow
const { data: { session } } = await supabase.auth.signInWithPassword({
  email: 'house1@sahjanand.local',
  password: 'sahjanand@1',
});

// Check must_change_password flag
const { data: profile } = await supabase
  .from('profiles')
  .select('must_change_password')
  .eq('id', session.user.id)
  .single();

// Should be true - triggers password change dialog
assert(profile.must_change_password === true);
```

### Test 2: Guard Login

```typescript
const { data: { session } } = await supabase.auth.signInWithPassword({
  email: 'guard@sahjanand.local',
  password: 'tirth@123//.@123',
});

// Check role
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', session.user.id)
  .single();

// Should be 'guard'
assert(profile.role === 'guard');
```

### Test 3: Admin Login

```typescript
const { data: { session } } = await supabase.auth.signInWithPassword({
  email: 'admin@sahjanand.local',
  password: 'Man@123.//@123',
});

// Check role
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', session.user.id)
  .single();

// Should be 'admin'
assert(profile.role === 'admin');
```

## Troubleshooting

### Error: "User already exists"

Some users may exist from previous runs. Options:
1. **Skip duplicates**: Script continues to next user
2. **Delete existing**: Run in Supabase dashboard (Users → select → delete)
3. **Re-run**: Script will update profiles and roles

### Error: "House not found"

Residents are linked to houses by `house_number`. If house doesn't exist:
1. Verify houses 1-89 exist in `houses` table
2. Run: 
   ```sql
   SELECT COUNT(*) FROM houses WHERE house_number BETWEEN 1 AND 89;
   -- Should return 89
   ```

### Error: "Permission denied"

Check environment variables:
```bash
# Must use SERVICE_ROLE_KEY, not PUBLISHABLE_KEY
echo $env:SUPABASE_SERVICE_ROLE_KEY | Write-Host
# Should show long base64 string starting with 'eyJ'
```

### Error: "Connection timeout"

If script hangs or times out:
1. Check internet connection
2. Verify SUPABASE_URL is correct
3. Check Supabase project status (status.supabase.com)
4. Run script again (idempotent - safe to retry)

## Rollback Instructions

To delete all seeded users:

```sql
-- Via Supabase SQL editor:

-- Delete user_roles
DELETE FROM user_roles 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email LIKE '%@sahjanand.local'
);

-- Delete profiles
DELETE FROM profiles 
WHERE email LIKE '%@sahjanand.local';

-- Delete auth users (via Supabase dashboard UI or API)
-- Go to Authentication → Users → Select all → Delete
```

Or via admin API:

```typescript
// Delete all sahjanand users
const { data: users } = await admin.auth.admin.listUsers();
const sahjanandUsers = users.users.filter(u => 
  u.email?.includes('@sahjanand.local')
);

for (const user of sahjanandUsers) {
  await admin.auth.admin.deleteUser(user.id);
}
```

## Security Notes

### ✅ What's Secure

1. **Service role key**: Used only on server-side, never exposed to client
2. **Password hashing**: bcrypt handled by Supabase automatically
3. **Email confirmation**: All users created with `email_confirm: true`
4. **RLS policies**: Protect data access via role checks
5. **Audit logging**: All logins/approvals recorded in audit_logs

### ⚠️ What to Protect

1. **SUPABASE_SERVICE_ROLE_KEY**: Never commit to git, never share
2. **Temporary passwords**: Residents must change on first login
3. **Guard/admin passwords**: Store securely, share out-of-band
4. **Script runs**: Ideally run from secure environment (CI/CD or local machine)

### 🔒 Best Practices

1. **Run once**: Script is idempotent but only run when necessary
2. **Monitor logs**: Check audit_logs after seeding
3. **Rotate admin password**: Change `Man@123.//@123` after setup
4. **Rotate guard password**: Change `tirth@123//.@123` after setup
5. **Disable SQL role**: Remove direct SQL access for production
6. **Enable 2FA**: For guard and admin users in production

## Next Steps

After seeding:

1. ✅ Test login flows in UI (resident → password change → portal access)
2. ✅ Verify RLS policies prevent unauthorized access
3. ✅ Check audit logs for login events
4. ✅ Test role-based access control (guard can see visitors, residents can't)
5. ✅ Deploy to production when verified

## Related Files

- `scripts/seed-users.ts` - Main seeding script
- `src/lib/auth.tsx` - Auth context with password change support
- `src/components/PasswordChangeDialog.tsx` - First-login password change UI
- `supabase/migrations/20260531100000_phase1_auth_audit.sql` - Database schema
- `.env.example` - Required environment variables

## Questions?

Check the implementation:
- SQL: `supabase/migrations/20260531100000_phase1_auth_audit.sql`
- Types: `src/integrations/supabase/types.ts`
- Auth flow: `PHASE1_IMPLEMENTATION.md`
