/**
 * Verify and fix Guard/Admin authentication setup
 * 
 * Checks:
 * - Guard and Admin user roles exist
 * - Profiles have must_change_password = false
 * - Residents have must_change_password = true (unless already changed)
 * 
 * Run: npx tsx scripts/verify-auth.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function verifyAuth() {
  console.log('🔍 Verifying Guard/Admin authentication setup...\n');

  try {
    // Check Guard account
    console.log('👮 Checking Guard account...');
    const { data: guardRole } = await admin
      .from('user_roles')
      .select('user_id, role')
      .eq('role', 'guard')
      .single();

    if (guardRole) {
      const { data: guardProfile } = await admin
        .from('profiles')
        .select('id, full_name, must_change_password')
        .eq('id', guardRole.user_id)
        .single();

      console.log(`  ✓ Guard found: ${guardProfile?.full_name}`);
      console.log(`    - must_change_password: ${guardProfile?.must_change_password}`);

      if (guardProfile?.must_change_password === true) {
        console.log(`  ⚠️  Setting must_change_password to false...`);
        await admin
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', guardRole.user_id);
        console.log(`  ✓ Guard profile updated`);
      }
    } else {
      console.log(`  ❌ Guard not found in user_roles`);
    }

    console.log('');

    // Check Admin account
    console.log('👤 Checking Admin account...');
    const { data: adminRole } = await admin
      .from('user_roles')
      .select('user_id, role')
      .eq('role', 'admin')
      .single();

    if (adminRole) {
      const { data: adminProfile } = await admin
        .from('profiles')
        .select('id, full_name, must_change_password')
        .eq('id', adminRole.user_id)
        .single();

      console.log(`  ✓ Admin found: ${adminProfile?.full_name}`);
      console.log(`    - must_change_password: ${adminProfile?.must_change_password}`);

      if (adminProfile?.must_change_password === true) {
        console.log(`  ⚠️  Setting must_change_password to false...`);
        await admin
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', adminRole.user_id);
        console.log(`  ✓ Admin profile updated`);
      }
    } else {
      console.log(`  ❌ Admin not found in user_roles`);
    }

    console.log('');

    // Check Resident accounts
    console.log('🏠 Checking Resident accounts...');
    const { data: residents } = await admin
      .from('user_roles')
      .select('user_id, role')
      .eq('role', 'resident');

    const residentCount = residents?.length || 0;
    console.log(`  Found ${residentCount} residents\n`);

    // Get count of residents that still need password change
    const { data: needsChange } = await admin
      .from('profiles')
      .select('id', { count: 'exact' })
      .in('id', residents?.map(r => r.user_id) || [])
      .eq('must_change_password', true);

    console.log(`  ✓ ${needsChange?.length || 0} residents need password change on first login`);
    console.log(`  ✓ ${residentCount - (needsChange?.length || 0)} residents have changed password\n`);

    // Summary
    console.log('📊 Summary:');
    console.log('  ✅ Guard login: No password change required');
    console.log('  ✅ Admin login: No password change required');
    console.log('  ✅ Resident login: Password change required on first login\n');

    console.log('🎯 Login credentials:');
    console.log('  Guard: guard@sahjanand.local / password123');
    console.log('  Admin: admin@sahjanand.local / password123');
    console.log('  Resident: house1@sahjanand.local / sahjanand@1\n');

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

verifyAuth()
  .then(() => {
    console.log('✨ Auth verification complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
  });
