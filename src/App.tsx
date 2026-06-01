import { Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/lib/auth'
import { Toaster } from '@/components/ui/sonner'
import { PasswordChangeDialog } from '@/components/PasswordChangeDialog'
import { useEffect, useState } from 'react'

// Route Components
import LandingPage from '@/routes/index'
import LoginPage from '@/routes/login'
import VisitorPage from '@/routes/visitor'
import AdminPage from '@/routes/admin'
import ResidentPage from '@/routes/resident'
import GuardPage from '@/routes/guard'

const queryClient = new QueryClient()

function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center gradient-soft px-4">
      <div className="max-w-md text-center glass rounded-3xl p-10">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">This page doesn't exist.</p>
        <a href="/" className="mt-6 inline-flex rounded-xl gradient-hero text-white px-5 py-2.5 text-sm font-medium shadow-glass">Go home</a>
      </div>
    </div>
  )
}

function AppContent() {
  const { mustChangePassword } = useAuth()
  const [showPasswordChange, setShowPasswordChange] = useState(false)

  useEffect(() => {
    setShowPasswordChange(mustChangePassword)
  }, [mustChangePassword])

  return (
    <>
      <PasswordChangeDialog 
        open={showPasswordChange} 
        onComplete={() => setShowPasswordChange(false)} 
      />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/visitor" element={<VisitorPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/resident" element={<ResidentPage />} />
        <Route path="/guard" element={<GuardPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster position="top-right" richColors />
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  )
}
