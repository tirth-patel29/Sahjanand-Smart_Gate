import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { logAudit } from '@/lib/auth-utils'
import { ShieldCheck, Home, UserCog, ArrowLeft, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const { session, role, loading } = useAuth()
  const nav = useNavigate()
  const pre = searchParams.get('role') as 'resident' | 'guard' | 'admin' | undefined
  const [tab, setTab] = useState<'resident' | 'guard' | 'admin'>(pre ?? 'resident')

  useEffect(() => {
    if (!loading && session && role) {
      nav(role === 'admin' ? '/admin' : role === 'guard' ? '/guard' : '/resident')
    }
  }, [loading, session, role, nav])

  return (
    <div className="min-h-screen gradient-soft grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-6 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <Card className="glass rounded-3xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl gradient-hero shadow-glass">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to your portal</p>
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid w-full grid-cols-3 mb-5">
              <TabsTrigger value="resident"><Home className="mr-1.5 h-4 w-4" />Resident</TabsTrigger>
              <TabsTrigger value="guard"><ShieldCheck className="mr-1.5 h-4 w-4" />Guard</TabsTrigger>
              <TabsTrigger value="admin"><UserCog className="mr-1.5 h-4 w-4" />Admin</TabsTrigger>
            </TabsList>
            <TabsContent value="resident"><ResidentForm /></TabsContent>
            <TabsContent value="guard"><GenericForm email="guard@sahjanand.local" role="guard" /></TabsContent>
            <TabsContent value="admin"><GenericForm email="admin@sahjanand.local" role="admin" /></TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}

function ResidentForm() {
  const [house, setHouse] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  // Auto-fill password with temporary format as user types house number
  useEffect(() => {
    if (house && !password) {
      setPassword(`sahjanand@${house}`)
    }
  }, [house])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!house) return toast.error('Enter your house number')
    if (!password) return toast.error('Enter your password')

    setBusy(true)
    try {
      const email = `house${house}@sahjanand.local`
      
      // Attempt login
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        // Log failed attempt to audit
        await logAudit('login_failed', 'resident', undefined, null, {
          house_number: house,
          reason: error.message,
        }).catch(() => {})

        toast.error(error.message === 'Invalid login credentials' 
          ? 'Invalid house number or password' 
          : error.message)
      } else {
        // Log successful login
        await logAudit('login_success', 'resident', undefined, null, {
          house_number: house,
        }).catch(() => {})

        toast.success('Welcome back! Follow the password change prompt.')
      }
    } catch (e) {
      const message = (e as Error).message || 'Login failed'
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-900 dark:text-blue-100 text-sm">
          Your temporary password is: <code className="font-mono font-semibold">sahjanand@[house-number]</code>
          <br />
          Example: <code className="font-mono text-xs">sahjanand@12</code>
        </AlertDescription>
      </Alert>

      <div>
        <Label>House Number</Label>
        <Input 
          value={house} 
          onChange={(e) => setHouse(e.target.value)} 
          placeholder="e.g. 12" 
          inputMode="numeric" 
          disabled={busy}
          required
        />
      </div>

      <div>
        <Label>Temporary Password</Label>
        <Input 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          placeholder="Auto-filled based on house number"
          disabled={busy}
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          You'll be asked to change this password after your first login.
        </p>
      </div>

      <Button type="submit" disabled={busy} className="w-full gradient-hero text-white border-0 shadow-glass">
        {busy ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  )
}

function GenericForm({ email: defaultEmail, role }: { email: string; role: 'guard' | 'admin' }) {
  const [email, setEmail] = useState(defaultEmail)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return toast.error('Enter your password')

    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        // Log failed attempt
        await logAudit('login_failed', role, undefined, null, {
          email,
          reason: error.message,
        }).catch(() => {})

        toast.error(error.message)
      } else {
        // Log successful login
        await logAudit('login_success', role, undefined, null, { email }).catch(() => {})
        toast.success('Welcome back')
      }
    } catch (e) {
      const message = (e as Error).message || 'Login failed'
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>Email</Label>
        <Input 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          disabled={true}
          type="email"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Contact admin to change email
        </p>
      </div>

      <div>
        <Label>Password</Label>
        <Input 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          placeholder="Enter your password"
          disabled={busy}
          required
        />
      </div>

      <Button type="submit" disabled={busy} className="w-full gradient-hero text-white border-0 shadow-glass">
        {busy ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  )
}
