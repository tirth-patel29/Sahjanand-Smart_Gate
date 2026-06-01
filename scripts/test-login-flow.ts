/**
 * Test Admin & Guard Login Flow
 * 
 * Simulates the complete login flow to identify any issues
 * 
 * Run: npx tsx scripts/test-login-flow.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY environment variables');
}

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function testLoginFlow() {
  console.log('🧪 Testing Admin & Guard Login Flow...\n');

  // Test Admin Login
  console.log('👤 Testing ADMIN login...');
  const { data: adminAuth, error: adminAuthError } = await supabase.auth.signInWithPassword({
    email: 'admin@sahjanand.local',
    password: 'mihir@123',
  });

  if (adminAuthError) {
    console.log(`  ❌ Auth failed: ${adminAuthError.message}`);
  } else {
    console.log(`  ✓ Auth succeeded: ${adminAuth.user?.id}`);

    // Try to load role
    const adminId = adminAuth.user!.id;
    const { data: adminRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', adminId)
      .maybeSingle();

    if (roleError) {
      console.log(`  ❌ Role query failed: ${roleError.message}`);
    } else if (!adminRole) {
      console.log(`  ❌ No role found for admin user`);
    } else {
      console.log(`  ✓ Role loaded: ${adminRole.role}`);
    }

    // Try to load profile
    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, must_change_password')
      .eq('id', adminId)
      .maybeSingle();

    if (profileError) {
      console.log(`  ❌ Profile query failed: ${profileError.message}`);
    } else if (!adminProfile) {
      console.log(`  ❌ No profile found for admin user`);
    } else {
      console.log(`  ✓ Profile loaded: ${adminProfile.full_name}, must_change_password=${adminProfile.must_change_password}`);
    }

    // Sign out
    await supabase.auth.signOut();
  }

  console.log('');

  // Test Guard Login
  console.log('👮 Testing GUARD login...');
  const { data: guardAuth, error: guardAuthError } = await supabase.auth.signInWithPassword({
    email: 'guard@sahjanand.local',
    password: 'Tirth@123',
  });

  if (guardAuthError) {
    console.log(`  ❌ Auth failed: ${guardAuthError.message}`);
  } else {
    console.log(`  ✓ Auth succeeded: ${guardAuth.user?.id}`);

    // Try to load role
    const guardId = guardAuth.user!.id;
    const { data: guardRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', guardId)
      .maybeSingle();

    if (roleError) {
      console.log(`  ❌ Role query failed: ${roleError.message}`);
    } else if (!guardRole) {
      console.log(`  ❌ No role found for guard user`);
    } else {
      console.log(`  ✓ Role loaded: ${guardRole.role}`);
    }

    // Try to load profile
    const { data: guardProfile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, must_change_password')
      .eq('id', guardId)
      .maybeSingle();

    if (profileError) {
      console.log(`  ❌ Profile query failed: ${profileError.message}`);
    } else if (!guardProfile) {
      console.log(`  ❌ No profile found for guard user`);
    } else {
      console.log(`  ✓ Profile loaded: ${guardProfile.full_name}, must_change_password=${guardProfile.must_change_password}`);
    }

    // Sign out
    await supabase.auth.signOut();
  }

  console.log('\n✨ Login flow test complete!');
}

testLoginFlow()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
  });
