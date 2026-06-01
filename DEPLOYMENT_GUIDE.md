# Deployment Guide - React + Vite SPA

## Overview

This project is now a **static Single-Page Application** built with React + Vite. It can be deployed to any static hosting platform.

---

## Vercel Deployment (Recommended)

### Step 1: Connect Repository
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Select the project root directory

### Step 2: Configure Build Settings
Vercel **auto-detects** Vite projects. Confirm these settings:

```
Framework: Vite
Build Command: npm run build
Output Directory: dist
Node Version: 18.x or higher
```

### Step 3: Environment Variables
Set these in Vercel Dashboard → Settings → Environment Variables:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### Step 4: Deploy
Click "Deploy" - Vercel will automatically:
- Run `npm install`
- Run `npm run build`
- Upload `dist/` folder
- Set up CDN + SSL

---

## Setup API Endpoint (Seeding)

The app calls `/api/public/seed` on first load. For Vercel, create a serverless function:

### Create `api/seed.ts` (in project root):

```typescript
import { ensureUser, seedDatabase } from '../src/routes/api/public/seed'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await seedDatabase()
    return res.status(200).json(result)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ 
      error: (error as Error).message 
    })
  }
}
```

### Or: Skip Auto-Seeding

If you prefer manual seeding, comment out the fetch call in `src/routes/index.tsx`:

```typescript
// useEffect(() => {
//   if (typeof window === 'undefined') return
//   if (localStorage.getItem('sahjanand_seeded') === '1') return
//   fetch('/api/public/seed', { method: 'POST' })
//     .then((r) => r.ok && localStorage.setItem('sahjanand_seeded', '1'))
//     .catch(() => {})
// }, [])
```

Then run seeding manually:
```bash
npm run seed  # Uses scripts/seed-users.ts instead
```

---

## Other Hosting Options

### Netlify
1. Connect repository
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Deploy

### GitHub Pages
1. Add to `package.json`:
   ```json
   "homepage": "https://yourusername.github.io/repo-name"
   ```
2. Install: `npm install --save-dev gh-pages`
3. Add scripts:
   ```json
   "deploy": "npm run build && gh-pages -d dist",
   "predeploy": "npm run build"
   ```
4. Run: `npm run deploy`

### AWS S3 + CloudFront
1. Build: `npm run build`
2. Upload `dist/` to S3 bucket
3. Configure CloudFront distribution
4. Enable CORS if needed

### Self-Hosted
1. Build: `npm run build`
2. Copy `dist/` to your server
3. Configure web server (nginx/Apache) for SPA routing:
   ```nginx
   # nginx example - serve dist/index.html for all routes
   location / {
       try_files $uri $uri/ /index.html;
   }
   ```

---

## Post-Deployment Checklist

- [ ] App loads on `/`
- [ ] All routes work (no 404s)
- [ ] Login page works
- [ ] Visitor form submits
- [ ] Admin/Resident/Guard portals accessible
- [ ] Supabase connection works
- [ ] Database seeding completed
- [ ] Error handling displays properly

---

## Environment Variables

Required for Supabase connection:

```bash
# Client-side (public, prefixed with VITE_)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxx...

# Server-side (secret, used for seeding)
SUPABASE_SERVICE_ROLE_KEY=eyJxxxx...
```

Get these from:
1. Supabase Dashboard → Project Settings → API
2. For service role key → API Keys section (marked "SERVICE_ROLE")

---

## Common Issues

### **Routes show 404**
**Solution:** Ensure your hosting platform rewrites `/index.html` for all routes

**Vercel:** Done automatically for SPA
**Self-hosted:** Use `try_files` (nginx) or `FallbackResource` (Apache)

### **Supabase connection fails**
**Solution:** Verify environment variables are set and the keys match your Supabase project

### **Build fails**
**Solution:** 
```bash
npm install
npm run build  # Test locally first
```

### **Seed endpoint 404s**
**Solution:** Create `api/seed.ts` serverless function (see above)

### **Styles don't load**
**Solution:** Check that Tailwind CSS is building correctly
```bash
npm run build && npm run preview
```

---

## Performance Tips

1. **Enable compression** (Vercel does this automatically)
2. **Set cache headers** for `dist/assets/` (10+ years)
3. **Set cache headers** for `dist/index.html` (no cache, revalidate)
4. **Monitor bundle size**:
   ```bash
   npm run build -- --stats
   ```

---

## Monitoring

### Vercel Dashboard
- Deployments → see build logs
- Analytics → page load times
- Error Tracking → see runtime errors

### Browser Console
Check for any errors in production (F12 → Console tab)

---

## Rollback

If something goes wrong:
- **Vercel:** Go to "Deployments" tab, click "Redeploy" on previous version
- **GitHub Pages:** Push old version to main branch
- **Self-hosted:** Deploy previous build from local backup

---

## Next Steps

1. **Deploy to Vercel** (easiest)
2. **Set environment variables**
3. **Test all routes**
4. **Run seeding** (or enable auto-seed)
5. **Monitor for errors**

For questions, see `MIGRATION_COMPLETE.md` or `MIGRATION_QUICK_REF.md`
