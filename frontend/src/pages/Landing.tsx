import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { UserPlus, Send, Banknote, Shield, TrendingUp, Users, ArrowRight, Bot, Zap } from 'lucide-react'

const steps = [
  {
    icon: UserPlus,
    title: 'Register',
    description: 'Sign up as an ambassador in minutes. All South African government employees are eligible.',
  },
  {
    icon: Send,
    title: 'Refer',
    description: 'Submit referrals of colleagues and friends who could benefit from our insurance products.',
  },
  {
    icon: Banknote,
    title: 'Earn',
    description: 'Earn R100 for every 10 referrals you submit or R100 per direct sign-up. No limits!',
  },
]

const features = [
  {
    icon: Shield,
    title: 'Insurance Management',
    description: 'Complete policy lifecycle from sales to claims. Life cover, legal, SOS and more.',
  },
  {
    icon: Bot,
    title: 'AI-Powered Automation',
    description: 'Automated QA checks, commission calculations, lead scoring, and SMS dispatch.',
  },
  {
    icon: Zap,
    title: 'Integrated Billing',
    description: 'SagePay, QLink, and NetCash integrations for seamless payment processing.',
  },
  {
    icon: TrendingUp,
    title: 'Performance Analytics',
    description: 'Real-time dashboards with revenue tracking, pipeline views, and agent leaderboards.',
  },
  {
    icon: Users,
    title: 'Ambassador Network',
    description: 'Manage your ambassador program with tiers, commissions, and gamified engagement.',
  },
  {
    icon: Send,
    title: 'Multi-Channel Comms',
    description: 'SMS, WhatsApp, and call center integration for client and agent communication.',
  },
]

export default function Landing() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sidebar via-primary-dark to-primary py-24 sm:py-32 lg:py-40">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--color-primary-light)_0%,_transparent_50%)] opacity-20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--color-ambassador)_0%,_transparent_50%)] opacity-10" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-1.5 text-sm font-medium text-white/90">
              <Zap className="mr-2 h-3.5 w-3.5 text-amber-400" />
              Insurance Management Platform
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-7xl">
              The Future of{' '}
              <span className="bg-gradient-to-r from-primary-light to-blue-300 bg-clip-text text-transparent">
                Insurance
              </span>{' '}
              Management
            </h1>
            <p className="mt-6 text-lg text-blue-100/80 sm:text-xl max-w-2xl mx-auto">
              AmbassadorC unifies insurance sales, billing, CRM, and AI automation
              into one powerful platform. Built for South African insurance operations.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" asChild className="shadow-xl shadow-primary/30">
                <Link to="/register">
                  Get Started Free
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="ghost" asChild className="text-white hover:bg-white/10 hover:text-white">
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Ambassador Program</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">
              Refer & Earn in 3 Steps
            </h2>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {steps.map((step, i) => {
              const Icon = step.icon
              return (
                <Card key={step.title} className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-primary to-primary-light" />
                  <CardContent className="pt-8 pb-8 text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
                      <Icon className="h-7 w-7 text-primary" />
                    </div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-primary-light">
                      Step {i + 1}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{step.title}</h3>
                    <p className="mt-3 text-sm text-gray-500 leading-relaxed">{step.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-surface-bright py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-secondary">Platform Features</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">
              Everything You Need
            </h2>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon
              return (
                <div key={f.title} className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 group-hover:bg-primary group-hover:text-white transition-colors">
                    <Icon className="h-6 w-6 text-primary group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="mt-4 font-semibold text-gray-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-gray-500 leading-relaxed">{f.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Ready to Get Started?
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Join thousands of South African government employees already earning with AmbassadorC.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" asChild>
              <Link to="/register">Create Account</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500 sm:px-6 lg:px-8">
          &copy; {new Date().getFullYear()} AmbassadorC Insurance Platform. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
