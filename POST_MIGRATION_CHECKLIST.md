# Post-Migration Verification Checklist

Use this checklist to verify the migration was successful.

---

## ✅ Project Files Verification

### New Files Created
- [ ] `index.html` exists in project root
- [ ] `src/main.tsx` exists
- [ ] `src/App.tsx` exists
- [ ] `MIGRATION_COMPLETE.md` exists
- [ ] `MIGRATION_QUICK_REF.md` exists
- [ ] `DEPLOYMENT_GUIDE.md` exists
- [ ] `MIGRATION_SUMMARY.md` exists

### Configuration Files Updated
- [ ] `vite.config.ts` uses standard Vite config (no @lovable)
- [ ] `package.json` has `react-router-dom` dependency
- [ ] `package.json` has NO `@tanstack/react-start`
- [ ] `package.json` has NO `@tanstack/react-router`
- [ ] `package.json` has NO `@lovable.dev/vite-tanstack-config`
- [ ] `package.json` has NO `nitro`
- [ ] `tsconfig.json` looks correct (check paths alias)

### Route Files Updated
- [ ] `src/routes/index.tsx` has `export default function`
- [ ] `src/routes/login.tsx` imports `useSearchParams` from react-router-dom
- [ ] `src/routes/visitor.tsx` has `export default function`
- [ ] `src/routes/admin.tsx` uses `useNavigate('/path')`
- [ ] `src/routes/resident.tsx` has type definitions
- [ ] `src/routes/guard.tsx` has type definitions

### Component Updates
- [ ] `src/components/PortalShell.tsx` imports from `react-router-dom`

---

## ✅ Dependency Verification

Run: `npm list | grep -E "react-router|@tanstack/react-start|@lovable"`

Expected output:
```
react-router-dom@7.3.0
```

NOT expected (should NOT appear):
```
@tanstack/react-start
@tanstack/react-router
@tanstack/router-plugin
@lovable.dev/vite-tanstack-config
nitro
```

---

## ✅ Code Quality Checks

### No TanStack Router Imports
```bash
grep -r "@tanstack/react-router" src/ --include="*.tsx"
```
Expected: **Only matches in src/routeTree.gen.ts, src/routes/__root.tsx, src/router.tsx** (old files, not used)

### All Routes Exported as Default
```bash
grep -r "export default function\|export const Route" src/routes/ --include="*.tsx"
```
Expected: All route files have `export default function`

### Correct React Router Imports
```bash
grep -r "from ['\"]react-router-dom" src/ --include="*.tsx" | grep -v node_modules
```
Expected: Multiple matches in src/routes/* and src/App.tsx

---

## ✅ Development Server Test

Run:
```bash
npm install
npm run dev
```

Expected:
- ✅ Server starts on `http://localhost:5173`
- ✅ No console errors
- ✅ Page loads without 404s
- ✅ Can navigate to `/login`, `/visitor`, `/admin`, etc.

Test each route:
- [ ] `/` - Landing page loads
- [ ] `/login` - Login form renders
- [ ] `/visitor` - Visitor entry form renders
- [ ] `/login?role=admin` - Login page shows admin tab selected
- [ ] `/nonexistent` - 404 page displays

---

## ✅ Build Verification

Run:
```bash
npm run build
```

Expected:
- ✅ Build succeeds with no errors
- ✅ `dist/` folder created
- ✅ `dist/index.html` exists
- ✅ `dist/assets/` folder has JS and CSS files

Check output:
```
dist/
├── index.html
└── assets/
    ├── main.xxxxx.js
    ├── react.xxxxx.js
    └── ...css files
```

File size check:
```bash
ls -lh dist/index.html
ls -lh dist/assets/main.*.js
```

Expected:
- index.html: 1-3 KB
- main JS: 400-500 KB

---

## ✅ Preview Build Locally

Run:
```bash
npm run build
npm run preview
```

Expected:
- ✅ Preview server starts on `http://localhost:4173`
- ✅ All routes work
- ✅ No console errors
- ✅ Styling looks correct
- ✅ Functionality works (can click buttons, fill forms)

---

## ✅ TypeScript Validation

Run:
```bash
npx tsc --noEmit
```

Expected:
- ✅ No errors
- ✅ No warnings (or only expected warnings)

---

## ✅ Lint Check

Run:
```bash
npm run lint
```

Expected:
- ✅ No critical errors
- ✅ Fixable warnings can be ignored for now

---

## ✅ Environment Variables Test

Create `.env.local` (if needed):
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_key_here
```

Test in app:
- [ ] Login page can submit form
- [ ] No Supabase connection errors in console
- [ ] Database queries work (check Network tab)

---

## ✅ Navigation Testing

### Test all navigation paths:
- [ ] Click "/" link → lands on `/`
- [ ] Click "Back" link → goes to previous route
- [ ] Type URL directly → route works
- [ ] Query params work → `/login?role=admin` works
- [ ] 404 page works → `/nonexistent` shows 404
- [ ] useNavigate hook works → buttons navigate correctly

### Test Link components:
```bash
npm run dev
# In browser, click all <Link> elements
# Check that routes change without full page reload
```

---

## ✅ Build Output Verification for Vercel

The following should be true:

```bash
cat vite.config.ts | grep "rollupOptions"
# Should output showing asset file naming pattern
```

Expected output format:
```
entryFileNames: 'assets/[name].[hash].js'
chunkFileNames: 'assets/[name].[hash].js'
assetFileNames: 'assets/[name].[hash][.ext]'
```

This ensures:
- ✅ index.html is at root (Vercel SPA routing requirement)
- ✅ Assets are hashed (cache busting works)
- ✅ All assets in one folder (CDN caching optimization)

---

## ✅ Git Verification

Check what files were changed:
```bash
git status
```

Expected:
- ✅ New files: index.html, src/main.tsx, src/App.tsx, MIGRATION_*.md
- ✅ Modified files: package.json, vite.config.ts, src/routes/*.tsx, src/components/PortalShell.tsx
- ✅ No unexpected changes to UI components

Check git history:
```bash
git log --oneline | head -10
# Should show your migration commits
```

---

## ✅ Features Still Working

Test core functionality:

### Authentication
- [ ] Can see login page
- [ ] Form validates required fields
- [ ] Can attempt login (will fail without credentials, that's okay)

### Routes & Navigation
- [ ] All 6 routes accessible
- [ ] No 404 errors on valid routes
- [ ] 404 shown on invalid routes
- [ ] Browser back/forward buttons work

### UI Components
- [ ] Buttons clickable
- [ ] Forms have correct styling
- [ ] Modals/dialogs work
- [ ] Tabs switch content
- [ ] Dropdowns open/close
- [ ] Theme toggle works (if implemented)

### Supabase Integration
- [ ] No CORS errors in console
- [ ] API calls being made (check Network tab)
- [ ] Data loading works (if you have data)

---

## ✅ Deployment Readiness

Before deploying to Vercel:

- [ ] All tests pass above
- [ ] No console errors in dev or preview mode
- [ ] TypeScript build succeeds
- [ ] Git repo is clean (all changes committed)
- [ ] Environment variables documented
- [ ] README updated (if needed)

---

## 🚀 Ready to Deploy?

If ALL checkboxes are checked:

```bash
# Final verification
npm run build && npm run preview

# Push to GitHub
git add .
git commit -m "feat: migrate to React + Vite SPA"
git push origin main

# Deploy to Vercel
# 1. Go to vercel.com
# 2. Import your repo
# 3. Configure environment variables
# 4. Click Deploy
```

---

## ❓ Troubleshooting

If something fails, check:

### Issue: Build fails
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue: Routes not working
- Check `src/App.tsx` has all routes defined
- Check file names in imports match actual files
- Check `index.html` has `<div id="root"></div>`

### Issue: Styling looks wrong
```bash
npm run build
npm run preview
# If preview looks good but dev doesn't, try:
npm run dev -- --force
```

### Issue: TypeScript errors
```bash
npx tsc --noEmit
# Fix errors shown
```

### Issue: Environment variables not loading
- Create `.env.local` file (not `.env`)
- Variables must start with `VITE_`
- Restart dev server after adding variables

---

## 📞 Support

- See `MIGRATION_COMPLETE.md` for detailed info
- See `MIGRATION_QUICK_REF.md` for code patterns
- See `DEPLOYMENT_GUIDE.md` for Vercel setup

**Migration completed on:** 2026-06-01  
**Status:** ✅ Ready for verification and deployment
