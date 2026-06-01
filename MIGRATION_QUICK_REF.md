# Quick Reference - Migration Guide

## For Developers

### Import Changes
```typescript
// ❌ OLD (TanStack Router)
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"

// ✅ NEW (React Router)
import { useNavigate, Link, useSearchParams } from "react-router-dom"
```

### Navigation
```typescript
// ❌ OLD (TanStack)
const nav = useNavigate()
nav({ to: "/path", search: { role: "admin" } })

// ✅ NEW (React Router)
const nav = useNavigate()
nav("/path?role=admin")
```

### Search Params
```typescript
// ❌ OLD (TanStack)
const { role } = Route.useSearch()

// ✅ NEW (React Router)
const [searchParams] = useSearchParams()
const role = searchParams.get('role')
```

### Route Definition
```typescript
// ❌ OLD (TanStack - File-based)
export const Route = createFileRoute("/path")({
  component: MyComponent,
  head: () => ({ meta: [...] }),
})

// ✅ NEW (React Router - Centralized)
// In src/App.tsx:
<Route path="/path" element={<MyComponent />} />
```

### Creating New Routes

To add a new route `/new-page`:

1. Create `src/routes/new-page.tsx`:
```typescript
import { useNavigate } from 'react-router-dom'

export default function NewPage() {
  const nav = useNavigate()
  return <div>Your content here</div>
}
```

2. Add to `src/App.tsx`:
```typescript
import NewPage from '@/routes/new-page'

// Inside <Routes>
<Route path="/new-page" element={<NewPage />} />
```

### Protected Routes

To protect a route (require authentication):

```typescript
// In your route component
const { session, role, loading } = useAuth()
const nav = useNavigate()

useEffect(() => {
  if (!loading && (!session || role !== 'admin')) {
    nav('/login?role=admin')
  }
}, [loading, session, role, nav])

// Return loading state or redirect will handle
if (loading) return <Loader />
```

---

## Build & Deploy

### Development
```bash
npm run dev        # Start Vite dev server (port 5173)
```

### Production Build
```bash
npm run build      # Creates dist/ folder
npm run preview    # Preview production build locally
```

### Vercel Deployment
```bash
# Push to GitHub, connect to Vercel
# Vercel auto-detects Vite SPA
# Builds from: npm run build
# Output dir: dist
# Environment: Set .env variables in Vercel dashboard
```

---

## Dependencies Summary

### Removed (SSR-related)
- `@tanstack/react-start` (1.167.50)
- `@tanstack/react-router` (1.168.25)
- `@tanstack/router-plugin` (1.167.28)
- `@lovable.dev/vite-tanstack-config` (2.1.1)
- `nitro` (3.0.260429-beta)

### Added
- `react-router-dom` (7.3.0)
- `@types/react-router-dom` (5.3.3)

### Retained
- All UI: Radix UI + shadcn/ui components
- Data: `@tanstack/react-query`, Supabase
- Styling: Tailwind CSS
- Forms: React Hook Form, Zod

---

## Common Issues & Solutions

### Issue: "Cannot find module 'react-router-dom'"
**Solution:** Run `npm install`

### Issue: Route not matching
**Solution:** Check path in App.tsx matches the component you're trying to access

### Issue: Search params not working
**Solution:** Use `useSearchParams()` hook instead of `Route.useSearch()`

### Issue: Navigation not working
**Solution:** Make sure you're using React Router's `useNavigate()` from "react-router-dom"

### Issue: TypeScript errors
**Solution:** Verify all imports are from "react-router-dom" not "@tanstack/react-router"

---

## File Organization

```
src/
├── main.tsx              # NEW: App entry point
├── App.tsx               # NEW: Routes & layout
├── routes/
│   ├── index.tsx         # UPDATED: Landing page
│   ├── login.tsx         # UPDATED: Login form
│   ├── visitor.tsx       # UPDATED: Visitor entry
│   ├── admin.tsx         # UPDATED: Admin portal
│   ├── resident.tsx      # UPDATED: Resident portal
│   ├── guard.tsx         # UPDATED: Guard portal
│   └── api/              # Unchanged: API routes
├── components/           # Unchanged: All UI components
├── integrations/         # Unchanged: Supabase integration
├── lib/                  # Unchanged: Utilities
└── styles.css            # Unchanged: Tailwind CSS

vite.config.ts           # UPDATED: Standard React config
package.json             # UPDATED: Dependencies
index.html               # NEW: SPA entry point
tsconfig.json            # Unchanged: TypeScript config
```

---

## Key Takeaways

1. **SPA Now:** No server rendering, all routing is client-side
2. **Simpler:** No more TanStack complexity, standard React Router
3. **Faster:** No server build step, direct to bundle
4. **Cleaner:** All routes in one place (App.tsx)
5. **Same Features:** All UI, styling, and functionality preserved
6. **Vercel Ready:** Deploy anywhere, works great with Vercel

---

Questions? Check `MIGRATION_COMPLETE.md` for detailed documentation.
