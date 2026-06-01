import { supabaseAdmin } from '@/integrations/supabase/client.server'

/**
 * Seed Endpoint for SPA
 * 
 * In a standard SPA, API routes need to be handled differently:
 * - Option 1: Vercel Serverless Functions (api/seed.ts in root)
 * - Option 2: Separate backend server
 * - Option 3: Run seed as part of deployment setup
 * 
 * Currently, this is called via:
 * fetch('/api/public/seed', { method: 'POST' })
 * 
 * For Vercel deployment:
 * Create api/seed.ts in project root with this logic
 * 
 * For local development:
 * Run: npm run seed (uses scripts/seed-users.ts instead)
 */

// Idempotent seed: creates admin, guard, and resident accounts for each of the 89 houses.
// Default password: password123
export async function ensureUser(email: string, password: string, meta: Record<string, unknown>) {
  // Try to find existing user
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  let user = list?.users.find((u) => u.email === email)
  if (!user) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: meta,
    })
    if (error) throw error
    user = data.user!
  }
  return user
}

export async function seedDatabase() {
  try {
    // Admin
    const admin = await ensureUser('admin@sahjanand.local', 'password123', { name: 'Society Admin' })
    await supabaseAdmin.from('user_roles').upsert({ user_id: admin.id, role: 'admin' }, { onConflict: 'user_id,role' })
    await supabaseAdmin.from('profiles').upsert({ id: admin.id, full_name: 'Society Admin' })

    // Guard
    const guard = await ensureUser('guard@sahjanand.local', 'password123', { name: 'Main Gate Guard' })
    await supabaseAdmin.from('user_roles').upsert({ user_id: guard.id, role: 'guard' }, { onConflict: 'user_id,role' })
    await supabaseAdmin.from('profiles').upsert({ id: guard.id, full_name: 'Main Gate Guard' })

    // Residents for all houses
    const { data: houses } = await supabaseAdmin.from('houses').select('id, house_number, owner_name, mobile_number')
    let created = 0
    for (const h of houses ?? []) {
      const email = `house${h.house_number}@sahjanand.local`
      const u = await ensureUser(email, 'password123', { house: h.house_number })
      await supabaseAdmin.from('user_roles').upsert({ user_id: u.id, role: 'resident' }, { onConflict: 'user_id,role' })
      await supabaseAdmin.from('profiles').upsert({
        id: u.id,
        full_name: h.owner_name,
        mobile: h.mobile_number,
        house_id: h.id,
      })
      created++
    }

    // Sample notice
    const { count } = await supabaseAdmin.from('notices').select('*', { count: 'exact', head: true })
    if (!count) {
      await supabaseAdmin.from('notices').insert([
        { title: 'Welcome to Sahjanand Smart Gate', description: 'Our new visitor management system is now live. Please use the QR code at the gate for visitor entries.' },
        { title: 'Diwali Celebration', description: 'Join us in the clubhouse on Saturday at 7 PM for Diwali festivities.' },
      ])
    }

    // Sample visitor requests
    const { count: vcount } = await supabaseAdmin.from('visitors').select('*', { count: 'exact', head: true })
    if (!vcount && houses?.length) {
      await supabaseAdmin.from('visitors').insert([
        { house_id: houses[0].id, full_name: 'Amit Kumar', mobile: '9876543210', purpose: 'Delivery', visitor_count: 1, status: 'pending' },
        { house_id: houses[1].id, full_name: 'Priya Shah', mobile: '9876500001', vehicle_number: 'GJ-01-AB-1234', purpose: 'Family Visit', visitor_count: 3, status: 'approved' },
      ])
    }

    return { ok: true, residents: created }
  } catch (e) {
    console.error(e)
    throw e
  }
