import { Link } from 'react-router-dom'
import { ArrowRight, Shield, Bot, Zap, TrendingUp, Users, Send, CheckCircle } from 'lucide-react'

const stats = [
  { value: '1.1M+', label: 'Records synced' },
  { value: '85K+', label: 'Clients managed' },
  { value: '29', label: 'Live data tables' },
  { value: '7', label: 'AI agents running' },
]

const features = [
  {
    icon: Shield,
    tag: 'Core',
    title: 'Insurance Management',
    description: 'Complete policy lifecycle — life cover, legal, SOS, and more. From sales through to claims.',
    accent: '#0AB3CC',
    size: 'large',
  },
  {
    icon: Bot,
    tag: 'AI',
    title: 'AI-Powered Automation',
    description: 'Automated QA checks, commission calculations, lead scoring, and SMS dispatch running 24/7.',
    accent: '#9933FF',
    size: 'normal',
  },
  {
    icon: Zap,
    tag: 'Billing',
    title: 'Integrated Billing',
    description: 'SagePay, QLink, and NetCash — live payment processing with full reconciliation.',
    accent: '#0FCC85',
    size: 'normal',
  },
  {
    icon: TrendingUp,
    tag: 'Analytics',
    title: 'Performance Analytics',
    description: 'Real-time dashboards, pipeline views, and agent leaderboards.',
    accent: '#004D99',
    size: 'normal',
  },
  {
    icon: Users,
    tag: 'Network',
    title: 'Ambassador Network',
    description: 'Manage your entire ambassador program with tiers, gamified commissions, and engagement tools.',
    accent: '#F0527A',
    size: 'normal',
  },
  {
    icon: Send,
    tag: 'Comms',
    title: 'Multi-Channel Comms',
    description: 'SMS, WhatsApp (WATI), and ViciDialer call center — all connected in one platform.',
    accent: '#0AB3CC',
    size: 'normal',
  },
]

const steps = [
  { n: '01', title: 'Register', body: 'Sign up as an ambassador in minutes. All South African government employees are eligible.' },
  { n: '02', title: 'Refer', body: 'Submit referrals of colleagues and friends who benefit from our insurance products.' },
  { n: '03', title: 'Earn', body: 'Earn R100 per 10 referrals submitted, or R100 per direct sign-up. No cap.' },
]

export default function Landing() {
  return (
    <div className="bg-[#080C14] text-white min-h-screen overflow-x-hidden" style={{ fontFamily: "'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, sans-serif" }}>

      {/* ─── Noise texture overlay ─────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '128px' }} />

      {/* ─── Nav ───────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 h-14"
        style={{ background: 'rgba(8,12,20,0.7)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#004D99] text-xs font-black text-white">AC</div>
          <span className="text-sm font-semibold tracking-tight text-white">AmbassadorC</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-xs font-medium text-white/50">
          <a href="#platform" className="hover:text-white transition-colors">Platform</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          <a href="#stats" className="hover:text-white transition-colors">Impact</a>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-xs font-medium text-white/60 hover:text-white transition-colors">Sign In</Link>
          <Link to="/register"
            className="flex items-center gap-1.5 rounded-full bg-white text-[#080C14] px-4 py-1.5 text-xs font-semibold hover:bg-white/90 transition-colors">
            Get Started <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </nav>

      {/* ─── Hero ──────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-14 text-center">

        {/* Glow orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[600px] w-[800px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(ellipse, #004D99 0%, transparent 70%)', filter: 'blur(80px)' }} />
          <div className="absolute top-1/3 -left-40 h-[400px] w-[400px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(ellipse, #0AB3CC 0%, transparent 70%)', filter: 'blur(60px)' }} />
          <div className="absolute top-1/2 -right-40 h-[300px] w-[300px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(ellipse, #9933FF 0%, transparent 70%)', filter: 'blur(60px)' }} />
        </div>

        {/* Badge */}
        <div className="relative mb-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-white/70"
          style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0AB3CC] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#0AB3CC]" />
          </span>
          Trusted by South African insurance operations
        </div>

        {/* Headline */}
        <h1 className="relative max-w-5xl text-5xl font-black leading-[1.02] tracking-tight sm:text-7xl md:text-8xl lg:text-[96px]">
          <span className="text-white">The platform </span>
          <br className="hidden sm:block" />
          <span className="text-white">built for </span>
          <span style={{
            background: 'linear-gradient(135deg, #0AB3CC 0%, #004D99 50%, #9933FF 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>insurance.</span>
        </h1>

        <p className="relative mt-7 max-w-xl text-base text-white/40 leading-relaxed sm:text-lg">
          AmbassadorC unifies sales, billing, CRM, and AI automation into one
          cohesive platform — built for South African insurance teams.
        </p>

        <div className="relative mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link to="/register"
            className="flex items-center gap-2 rounded-full bg-white text-[#080C14] px-6 py-3 text-sm font-bold hover:bg-white/90 transition-all shadow-[0_0_40px_rgba(0,77,153,0.3)]">
            Start for free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/login"
            className="flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-white/60 hover:text-white transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            Sign in to your account
          </Link>
        </div>

        {/* Trust badges */}
        <div className="relative mt-16 flex flex-wrap items-center justify-center gap-6 text-xs text-white/25 font-medium">
          {['SagePay Integrated', 'QLink Connected', 'NetCash Ready', 'WATI WhatsApp', 'AI Automation'].map(b => (
            <span key={b} className="flex items-center gap-1.5">
              <CheckCircle className="h-3 w-3 text-[#0FCC85]" /> {b}
            </span>
          ))}
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/20">
          <div className="h-8 w-px bg-gradient-to-b from-white/0 to-white/20 animate-pulse" />
        </div>
      </section>

      {/* ─── Stats strip ───────────────────────────────────────── */}
      <section id="stats" className="relative px-6 py-0 pb-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px"
            style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col items-center justify-center py-10 gap-1"
                style={{ background: '#080C14' }}>
                <span className="text-4xl md:text-5xl font-black tracking-tighter text-white">{s.value}</span>
                <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features bento grid ───────────────────────────────── */}
      <section id="platform" className="relative px-6 pb-32">
        <div className="mx-auto max-w-5xl">

          {/* Section label */}
          <div className="mb-12 flex items-end justify-between">
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/30 font-semibold">Platform</p>
              <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">
                Everything in one place.
              </h2>
            </div>
            <Link to="/register"
              className="hidden md:flex items-center gap-1.5 text-xs font-medium text-white/40 hover:text-white transition-colors">
              Get started <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px"
            style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>

            {/* Large card — Insurance Management */}
            {(() => {
              const f = features[0]
              const Icon = f.icon
              return (
                <div key={f.title} className="md:col-span-2 group relative p-8 flex flex-col justify-between min-h-64"
                  style={{ background: '#0A0F1A' }}>
                  <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: `radial-gradient(400px at 30% 50%, ${f.accent}08 0%, transparent 70%)` }} />
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: `${f.accent}15`, border: `1px solid ${f.accent}25` }}>
                      <Icon className="h-5 w-5" style={{ color: f.accent }} />
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] px-2 py-0.5 rounded-full"
                      style={{ color: f.accent, background: `${f.accent}15`, border: `1px solid ${f.accent}20` }}>
                      {f.tag}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{f.title}</h3>
                    <p className="text-sm text-white/40 leading-relaxed max-w-sm">{f.description}</p>
                  </div>
                </div>
              )
            })()}

            {/* Normal cards */}
            {features.slice(1).map((f) => {
              const Icon = f.icon
              return (
                <div key={f.title} className="group relative p-6 flex flex-col justify-between min-h-48"
                  style={{ background: '#0A0F1A' }}>
                  <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: `radial-gradient(250px at 20% 30%, ${f.accent}08 0%, transparent 70%)` }} />
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ background: `${f.accent}15`, border: `1px solid ${f.accent}25` }}>
                      <Icon className="h-4 w-4" style={{ color: f.accent }} />
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] px-2 py-0.5 rounded-full"
                      style={{ color: f.accent, background: `${f.accent}15`, border: `1px solid ${f.accent}20` }}>
                      {f.tag}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1.5">{f.title}</h3>
                    <p className="text-xs text-white/35 leading-relaxed">{f.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── How it works ──────────────────────────────────────── */}
      <section id="how-it-works" className="relative px-6 pb-32">
        <div className="mx-auto max-w-5xl">

          <div className="mb-12">
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/30 font-semibold">Ambassador Program</p>
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Refer & Earn in 3 steps.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <div key={s.n} className="group relative rounded-2xl p-6 overflow-hidden"
                style={{ background: '#0A0F1A', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: 'radial-gradient(300px at 50% 0%, rgba(10,179,204,0.05) 0%, transparent 70%)' }} />
                <div className="mb-6 text-6xl font-black tracking-tighter"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                  {s.n}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-white/35 leading-relaxed">{s.body}</p>
                {i < steps.length - 1 && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 hidden md:flex h-6 w-6 items-center justify-center rounded-full"
                    style={{ background: '#0A0F1A', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <ArrowRight className="h-3 w-3 text-white/30" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────────────── */}
      <section className="relative px-6 pb-32">
        <div className="mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-3xl px-8 py-16 text-center"
            style={{ background: 'linear-gradient(135deg, #0A1629 0%, #0D1117 100%)', border: '1px solid rgba(255,255,255,0.07)' }}>

            {/* Glow behind */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-96 rounded-full opacity-20"
                style={{ background: 'radial-gradient(ellipse, #004D99 0%, transparent 70%)', filter: 'blur(40px)' }} />
            </div>

            <p className="relative mb-3 text-[10px] uppercase tracking-[0.2em] text-white/30 font-semibold">Get started today</p>
            <h2 className="relative text-3xl font-black tracking-tight text-white sm:text-5xl max-w-2xl mx-auto">
              Ready to unify your operations?
            </h2>
            <p className="relative mt-4 text-sm text-white/40 max-w-md mx-auto leading-relaxed">
              Join South African insurance teams already using AmbassadorC to manage policies, commissions, and client relationships.
            </p>
            <div className="relative mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link to="/register"
                className="flex items-center gap-2 rounded-full bg-white text-[#080C14] px-7 py-3 text-sm font-bold hover:bg-white/90 transition-all shadow-[0_0_40px_rgba(0,77,153,0.4)]">
                Create your account <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/login"
                className="flex items-center gap-2 rounded-full px-7 py-3 text-sm font-medium text-white/50 hover:text-white transition-colors"
                style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────── */}
      <footer className="px-6 pb-10" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="mx-auto max-w-5xl flex flex-col md:flex-row items-center justify-between gap-4 pt-8">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#004D99] text-[10px] font-black text-white">AC</div>
            <span className="text-xs font-semibold text-white/40">AmbassadorC</span>
          </div>
          <p className="text-[11px] text-white/20">
            &copy; {new Date().getFullYear()} AmbassadorC Insurance Platform. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-[11px] text-white/30">
            <a href="#platform" className="hover:text-white/60 transition-colors">Platform</a>
            <Link to="/login" className="hover:text-white/60 transition-colors">Sign In</Link>
            <Link to="/register" className="hover:text-white/60 transition-colors">Register</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
