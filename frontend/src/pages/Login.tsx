import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Shield } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [mobileNo, setMobileNo] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!mobileNo || !password) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)
    try {
      const ambassador = await login({ mobileNo, password })
      toast({ title: 'Welcome back!', variant: 'success' })
      const role = (ambassador as any)?.role || 'AMBASSADOR'
      if (role === 'ADMIN') navigate('/admin')
      else if (role === 'QA_OFFICER') navigate('/admin/qa')
      else if (role === 'AGENT') navigate('/admin/clients')
      else navigate('/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-sidebar via-primary-dark to-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--color-primary-light)_0%,_transparent_50%)] opacity-20" />
        <div className="relative flex flex-col justify-center px-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary font-bold text-white text-lg">
              AC
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">
              Ambassador<span className="text-primary-light">C</span>
            </span>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight">
            Insurance Management<br />
            <span className="text-primary-200">Reimagined.</span>
          </h2>
          <p className="mt-4 text-lg text-blue-200/70 max-w-md">
            Unified platform for insurance sales, billing, CRM, and AI-powered automation.
          </p>
          <div className="mt-12 space-y-4">
            {['85,000+ Clients managed', '1.1M+ Historical records', '7 AI Automation agents'].map((stat) => (
              <div key={stat} className="flex items-center gap-3 text-white/80">
                <div className="h-2 w-2 rounded-full bg-primary-light" />
                <span className="text-sm">{stat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 bg-surface-dim">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary font-bold text-white">
                AC
              </div>
              <span className="text-xl font-bold text-gray-900">AmbassadorC</span>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
              <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-xl border border-error/20 bg-error-light p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="mobileNo">Mobile Number</Label>
                <Input
                  id="mobileNo"
                  type="tel"
                  value={mobileNo}
                  onChange={(e) => setMobileNo(e.target.value)}
                  placeholder="0712345678"
                  autoComplete="tel"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="h-11"
                />
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold text-primary hover:underline">
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
