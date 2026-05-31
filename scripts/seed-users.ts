/**
 * Supabase User Seeding Script
 * 
 * Creates:
 * - 89 resident users (houses 1-89)
 * - 1 guard user
 * - 1 admin user
 * 
 * With:
 * - Matching profiles
 * - Role assignments
 * - House linking
 * - Password requirements
 * 
 * Safety: Uses SUPABASE_SERVICE_ROLE_KEY (admin credentials)
 * Run: npx tsx scripts/seed-users.ts
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

interface UserSeedData {
  email: string;
  password: string;
  metadata: {
    house_number?: number;
    full_name: string;
    role: 'resident' | 'guard' | 'admin';
  };
}

async function seedUsers() {
  console.log('🌱 Starting user seeding...\n');

  const usersToCreate: UserSeedData[] = [];

  // 1. Create residents (houses 1-89)
  console.log('📝 Preparing 89 resident users...');
  for (let i = 1; i <= 89; i++) {
    usersToCreate.push({
      email: `house${i}@sahjanand.local`,
      password: `sahjanand@${i}`,
      metadata: {
        house_number: i,
        full_name: `Resident ${i}`,
        role: 'resident',
      },
    });
  }

  // 2. Create guard
  console.log('📝 Preparing 1 guard user...');
  usersToCreate.push({
    email: 'guard@sahjanand.local',
    password: 'tirth@123//.@123',
    metadata: {
      full_name: 'Guard User',
      role: 'guard',
    },
  });

  // 3. Create admin
  console.log('📝 Preparing 1 admin user...');
  usersToCreate.push({
    email: 'admin@sahjanand.local',
    password: 'Man@123.//@123',
    metadata: {
      full_name: 'Admin User',
      role: 'admin',
    },
  });

  console.log(`✓ Prepared ${usersToCreate.length} users total\n`);

  // Create users
  const createdUsers: Array<{ id: string; email: string; role: string; house_number?: number }> = [];
  let successCount = 0;
  let errorCount = 0;

  for (const userData of usersToCreate) {
    try {
      console.log(`Creating ${userData.metadata.role}: ${userData.email}...`);

      // Create auth user
      const { data, error } = await admin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          house_number: userData.metadata.house_number,
          full_name: userData.metadata.full_name,
        },
      });

      if (error) {
        console.error(`  ❌ Auth creation failed: ${error.message}`);
        errorCount++;
        continue;
      }

      const userId = data.user!.id;
      console.log(`  ✓ Auth user created: ${userId}`);

      // Get house ID for residents
      let houseId: string | null = null;
      if (userData.metadata.house_number) {
        const { data: houseData, error: houseError } = await admin
          .from('houses')
          .select('id')
          .eq('house_number', userData.metadata.house_number)
          .single();

        if (houseError) {
          console.error(`  ⚠️ House lookup failed: ${houseError.message}`);
        } else {
          houseId = houseData.id;
        }
      }

      // Create profile
      const { error: profileError } = await admin.from('profiles').insert({
        id: userId,
        email: userData.email,
        full_name: userData.metadata.full_name,
        role: userData.metadata.role,
        house_id: houseId,
        house_number: userData.metadata.house_number || null,
        must_change_password: userData.metadata.role === 'resident' ? true : false,
      });

      if (profileError) {
        console.error(`  ❌ Profile creation failed: ${profileError.message}`);
        errorCount++;
        continue;
      }
      console.log(`  ✓ Profile created`);

      // Assign role
      const { error: roleError } = await admin.from('user_roles').insert({
        user_id: userId,
        role: userData.metadata.role,
      });

      if (roleError) {
        console.error(`  ❌ Role assignment failed: ${roleError.message}`);
        errorCount++;
        continue;
      }
      console.log(`  ✓ Role assigned: ${userData.metadata.role}`);

      createdUsers.push({
        id: userId,
        email: userData.email,
        role: userData.metadata.role,
        house_number: userData.metadata.house_number,
      });
      successCount++;
      console.log('');

    } catch (err) {
      console.error(`  ❌ Unexpected error: ${err}`);
      errorCount++;
    }
  }

  // Summary
  console.log('\n📊 Seeding Summary:');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`📋 Total: ${usersToCreate.length}\n`);

  // Breakdown
  const residents = createdUsers.filter(u => u.role === 'resident').length;
  const guards = createdUsers.filter(u => u.role === 'guard').length;
  const admins = createdUsers.filter(u => u.role === 'admin').length;

  console.log('User Breakdown:');
  console.log(`  🏠 Residents: ${residents}`);
  console.log(`  👮 Guards: ${guards}`);
  console.log(`  👤 Admins: ${admins}\n`);

  if (successCount > 0) {
    console.log('✨ Sample credentials:');
    console.log('  Resident: house1@sahjanand.local / sahjanand@1');
    console.log('  Guard: guard@sahjanand.local / tirth@123//.@123');
    console.log('  Admin: admin@sahjanand.local / Man@123.//@123\n');
  }

  if (errorCount > 0) {
    process.exit(1);
  }
}

seedUsers()
  .then(() => {
    console.log('🎉 User seeding complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
  });
