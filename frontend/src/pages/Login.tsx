import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { Logo, LogoMark } from '@/components/ui/Logo'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [mobileNo, setMobileNo] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    <div className="relative flex min-h-screen overflow-hidden" style={{ background: '#080C14', fontFamily: "'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, sans-serif" }}>

      {/* Noise texture */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '128px' }} />

      {/* Left panel */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between p-14 overflow-hidden">
        {/* Orbs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 -left-20 h-[500px] w-[500px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(ellipse, #004D99 0%, transparent 70%)', filter: 'blur(80px)' }} />
          <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(ellipse, #9933FF 0%, transparent 70%)', filter: 'blur(60px)' }} />
          <div className="absolute top-1/2 left-1/3 h-[200px] w-[200px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(ellipse, #0AB3CC 0%, transparent 70%)', filter: 'blur(50px)' }} />
        </div>

        {/* Logo */}
        <Logo size={30} textSize="text-sm" className="relative" />

        {/* Content */}
        <div className="relative">
          <p className="mb-3 text-[10px] uppercase tracking-[0.2em] font-semibold text-white/30">Insurance Platform</p>
          <h2 className="text-5xl font-black tracking-tight text-white leading-[1.05] mb-6">
            Insurance<br />
            <span style={{
              background: 'linear-gradient(135deg, #0AB3CC 0%, #004D99 60%, #9933FF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>reimagined.</span>
          </h2>
          <p className="text-sm text-white/40 max-w-xs leading-relaxed">
            Unified platform for South African insurance sales, billing, CRM, and AI-powered automation.
          </p>

          {/* Stats */}
          <div className="mt-12 grid grid-cols-2 gap-px"
            style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden', background: 'rgba(255,255,255,0.07)' }}>
            {[
              { v: '85K+', l: 'Clients' },
              { v: '1.1M+', l: 'Records' },
              { v: '29', l: 'Data Tables' },
              { v: '7', l: 'AI Agents' },
            ].map(({ v, l }) => (
              <div key={l} className="flex flex-col items-center justify-center py-6 gap-1"
                style={{ background: '#080C14' }}>
                <span className="text-2xl font-black tracking-tight text-white">{v}</span>
                <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative flex items-center justify-between">
          <p className="text-[11px] text-white/20">&copy; {new Date().getFullYear()} AmbassadorC</p>
          <Link to="/" className="text-[11px] text-white/30 hover:text-white/60 transition-colors">Back to home</Link>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="relative flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden mb-10">
            <Logo size={28} textSize="text-sm" />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-black tracking-tight text-white">Welcome back</h1>
            <p className="mt-1.5 text-sm text-white/40">Sign in to your account to continue.</p>
          </div>

          {/* Form card */}
          <div className="rounded-2xl p-6"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>

            {error && (
              <div className="mb-4 rounded-xl p-3 text-sm text-red-400"
                style={{ background: 'rgba(240,82,82,0.1)', border: '1px solid rgba(240,82,82,0.2)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-[0.1em]">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={mobileNo}
                  onChange={(e) => setMobileNo(e.target.value)}
                  placeholder="0712345678"
                  autoComplete="tel"
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(10,179,204,0.4)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-[0.1em]">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-white/20 outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(10,179,204,0.4)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-[#080C14] transition-all disabled:opacity-60"
                style={{ background: 'white', boxShadow: '0 0 30px rgba(0,77,153,0.25)' }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#080C14]/30 border-t-[#080C14]" />
                    Signing in…
                  </span>
                ) : (
                  <>Sign In <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-sm text-white/30">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-white/60 hover:text-white transition-colors">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
