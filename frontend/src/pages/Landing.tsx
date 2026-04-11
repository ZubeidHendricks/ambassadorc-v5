import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { UserPlus, Send, Banknote, Shield, TrendingUp, Users } from 'lucide-react'

const steps = [
  {
    icon: UserPlus,
    title: 'Register',
    description:
      'Sign up as a Lifesaver ambassador in minutes. All South African government employees are eligible.',
  },
  {
    icon: Send,
    title: 'Refer',
    description:
      'Submit referrals of colleagues and friends who could benefit from Lifesaver insurance products.',
  },
  {
    icon: Banknote,
    title: 'Earn',
    description:
      'Earn R100 for every 10 referrals you submit or R100 per direct sign-up. No limits!',
  },
]

const benefits = [
  {
    icon: Shield,
    title: 'Trusted Insurance',
    description: 'Government employee focused insurance products designed for your needs.',
  },
  {
    icon: TrendingUp,
    title: 'Unlimited Earnings',
    description: 'No cap on referrals. The more you refer, the more you earn.',
  },
  {
    icon: Users,
    title: 'Help Colleagues',
    description: 'Connect your colleagues with insurance products that protect their families.',
  },
]

export default function Landing() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-dark via-brand-dark to-brand-blue py-20 sm:py-28 lg:py-36">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--color-brand-green)_0%,_transparent_50%)] opacity-20" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center rounded-full bg-brand-green/20 px-4 py-1.5 text-sm font-medium text-brand-green">
              Ambassador Program
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Earn{' '}
              <span className="bg-gradient-to-r from-brand-green to-brand-green-light bg-clip-text text-transparent">
                R100
              </span>{' '}
              for Every 10 Referrals
            </h1>
            <p className="mt-6 text-lg text-gray-300 sm:text-xl">
              Join the Lifesaver Refer & Earn program. Help your colleagues get
              the insurance they deserve while earning rewards for every
              successful referral.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" asChild>
                <Link to="/register">Get Started Free</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-white/30 text-white hover:bg-white/10 hover:text-white">
                <Link to="/login">I Have an Account</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Three simple steps to start earning
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {steps.map((step, i) => {
              const Icon = step.icon
              return (
                <Card
                  key={step.title}
                  className="relative overflow-hidden border-0 shadow-lg"
                >
                  <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-brand-green to-brand-teal" />
                  <CardContent className="pt-8 pb-8 text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-green/10">
                      <Icon className="h-7 w-7 text-brand-green" />
                    </div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-teal">
                      Step {i + 1}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm text-gray-500 leading-relaxed">
                      {step.description}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-gray-100 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Why Join?
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Benefits of becoming a Lifesaver Ambassador
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {benefits.map((b) => {
              const Icon = b.icon
              return (
                <div key={b.title} className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10">
                    <Icon className="h-6 w-6 text-brand-teal" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{b.title}</h3>
                    <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                      {b.description}
                    </p>
                  </div>
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
            Ready to Start Earning?
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Join thousands of South African government employees already earning
            with Lifesaver.
          </p>
          <div className="mt-8">
            <Button size="lg" asChild>
              <Link to="/register">Register Now</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500 sm:px-6 lg:px-8">
          &copy; {new Date().getFullYear()} Lifesaver Insurance. All rights
          reserved.
        </div>
      </footer>
    </div>
  )
}
