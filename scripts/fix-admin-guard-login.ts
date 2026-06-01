/**
 * Admin & Guard Login Fix Script
 * 
 * Checks and fixes:
 * - Admin/Guard users exist in auth.users
 * - Admin/Guard profiles exist in public.profiles
 * - Admin/Guard roles are in public.user_roles
 * - Passwords are set to: admin: mihir@123, guard: Tirth@123
 * - must_change_password = false for admin/guard
 * 
 * Run: npx tsx scripts/fix-admin-guard-login.ts
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

async function fixAdminGuardLogin() {
  console.log('🔧 Fixing Admin & Guard Login Issues...\n');

  try {
    // 1. Check and fix ADMIN
    console.log('👤 Checking ADMIN account...');
    
    const { data: adminAuthList } = await admin.auth.admin.listUsers();
    const adminAuthUser = adminAuthList?.users.find(u => u.email === 'admin@sahjanand.local');
    
    if (!adminAuthUser) {
      console.log('  ❌ Admin auth user not found!');
      process.exit(1);
    }
    
    console.log(`  ✓ Admin auth user found: ${adminAuthUser.id}`);
    
    // Check if admin profile exists
    const { data: adminProfile } = await admin
      .from('profiles')
      .select('id, full_name, must_change_password')
      .eq('id', adminAuthUser.id)
      .maybeSingle();
    
    if (!adminProfile) {
      console.log('  ⚠️  Admin profile missing - creating...');
      const { error: profileError } = await admin
        .from('profiles')
        .insert({
          id: adminAuthUser.id,
          full_name: 'Society Admin',
          must_change_password: false,
        });
      if (profileError) {
        console.log(`  ❌ Profile creation failed: ${profileError.message}`);
      } else {
        console.log('  ✓ Admin profile created');
      }
    } else {
      console.log(`  ✓ Admin profile exists`);
      if (adminProfile.must_change_password) {
        console.log('  ⚠️  Setting must_change_password = false...');
        await admin
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', adminAuthUser.id);
        console.log('  ✓ Admin profile updated');
      }
    }
    
    // Check if admin role exists
    const { data: adminRole } = await admin
      .from('user_roles')
      .select('id')
      .eq('user_id', adminAuthUser.id)
      .eq('role', 'admin')
      .maybeSingle();
    
    if (!adminRole) {
      console.log('  ⚠️  Admin role missing - creating...');
      const { error: roleError } = await admin
        .from('user_roles')
        .insert({
          user_id: adminAuthUser.id,
          role: 'admin',
        });
      if (roleError) {
        console.log(`  ❌ Role creation failed: ${roleError.message}`);
      } else {
        console.log('  ✓ Admin role created');
      }
    } else {
      console.log(`  ✓ Admin role exists`);
    }
    
    // Update admin password
    console.log('  ⚠️  Updating admin password...');
    const { error: adminPwdError } = await admin.auth.admin.updateUserById(
      adminAuthUser.id,
      { password: 'mihir@123' }
    );
    if (adminPwdError) {
      console.log(`  ❌ Password update failed: ${adminPwdError.message}`);
    } else {
      console.log('  ✓ Admin password updated to: mihir@123');
    }
    
    console.log('');
    
    // 2. Check and fix GUARD
    console.log('👮 Checking GUARD account...');
    
    const guardAuthUser = adminAuthList?.users.find(u => u.email === 'guard@sahjanand.local');
    
    if (!guardAuthUser) {
      console.log('  ❌ Guard auth user not found!');
      process.exit(1);
    }
    
    console.log(`  ✓ Guard auth user found: ${guardAuthUser.id}`);
    
    // Check if guard profile exists
    const { data: guardProfile } = await admin
      .from('profiles')
      .select('id, full_name, must_change_password')
      .eq('id', guardAuthUser.id)
      .maybeSingle();
    
    if (!guardProfile) {
      console.log('  ⚠️  Guard profile missing - creating...');
      const { error: profileError } = await admin
        .from('profiles')
        .insert({
          id: guardAuthUser.id,
          full_name: 'Main Gate Guard',
          must_change_password: false,
        });
      if (profileError) {
        console.log(`  ❌ Profile creation failed: ${profileError.message}`);
      } else {
        console.log('  ✓ Guard profile created');
      }
    } else {
      console.log(`  ✓ Guard profile exists`);
      if (guardProfile.must_change_password) {
        console.log('  ⚠️  Setting must_change_password = false...');
        await admin
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', guardAuthUser.id);
        console.log('  ✓ Guard profile updated');
      }
    }
    
    // Check if guard role exists
    const { data: guardRole } = await admin
      .from('user_roles')
      .select('id')
      .eq('user_id', guardAuthUser.id)
      .eq('role', 'guard')
      .maybeSingle();
    
    if (!guardRole) {
      console.log('  ⚠️  Guard role missing - creating...');
      const { error: roleError } = await admin
        .from('user_roles')
        .insert({
          user_id: guardAuthUser.id,
          role: 'guard',
        });
      if (roleError) {
        console.log(`  ❌ Role creation failed: ${roleError.message}`);
      } else {
        console.log('  ✓ Guard role created');
      }
    } else {
      console.log(`  ✓ Guard role exists`);
    }
    
    // Update guard password
    console.log('  ⚠️  Updating guard password...');
    const { error: guardPwdError } = await admin.auth.admin.updateUserById(
      guardAuthUser.id,
      { password: 'Tirth@123' }
    );
    if (guardPwdError) {
      console.log(`  ❌ Password update failed: ${guardPwdError.message}`);
    } else {
      console.log('  ✓ Guard password updated to: Tirth@123');
    }
    
    console.log('\n✨ Admin & Guard Login Fixed!');
    console.log('\n🎯 Login Credentials:');
    console.log('  Admin: admin@sahjanand.local / mihir@123');
    console.log('  Guard: guard@sahjanand.local / Tirth@123');
    console.log('  Resident: house1@sahjanand.local / sahjanand@1\n');
    
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

fixAdminGuardLogin()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
  });
