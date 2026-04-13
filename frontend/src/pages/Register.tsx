import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Zap } from 'lucide-react'

const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
]

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    mobileNo: '',
    password: '',
    confirmPassword: '',
    province: '',
    department: '',
    acceptTerms: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.firstName.trim()) e.firstName = 'First name is required'
    if (!form.lastName.trim()) e.lastName = 'Last name is required'
    if (!/^0[6-8]\d{8}$/.test(form.mobileNo))
      e.mobileNo = 'Enter a valid SA mobile number (e.g. 0712345678)'
    if (form.password.length < 6) e.password = 'Password must be at least 6 characters'
    if (form.password !== form.confirmPassword)
      e.confirmPassword = 'Passwords do not match'
    if (!form.province) e.province = 'Select your province'
    if (!form.department.trim()) e.department = 'Department is required'
    if (!form.acceptTerms) e.acceptTerms = 'You must accept the terms'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        mobileNo: form.mobileNo,
        password: form.password,
        province: form.province,
        department: form.department.trim(),
      })
      toast({ title: 'Welcome!', description: 'Registration successful.', variant: 'success' })
      navigate('/dashboard')
    } catch (err) {
      toast({
        title: 'Registration Failed',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  function updateField(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
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
            Join the Ambassador<br />
            <span className="text-primary-200">Network Today.</span>
          </h2>
          <p className="mt-4 text-lg text-blue-200/70 max-w-md">
            Earn commissions by referring colleagues. No experience needed - just your network and ambition.
          </p>
          <div className="mt-12 space-y-4">
            {[
              'Earn R100 per direct sign-up',
              'R100 for every 10 referrals',
              'Track earnings in real-time',
              'Climb the tier ladder',
            ].map((perk) => (
              <div key={perk} className="flex items-center gap-3 text-white/80">
                <Zap className="h-4 w-4 text-amber-400" />
                <span className="text-sm">{perk}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 bg-surface-dim">
        <div className="w-full max-w-lg">
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
              <h1 className="text-2xl font-bold text-gray-900">Create Your Account</h1>
              <p className="mt-1 text-sm text-gray-500">Join the AmbassadorC Refer & Earn Program</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    placeholder="John"
                    className="h-11"
                  />
                  {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    placeholder="Doe"
                    className="h-11"
                  />
                  {errors.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobileNo">Mobile Number</Label>
                <Input
                  id="mobileNo"
                  type="tel"
                  value={form.mobileNo}
                  onChange={(e) => updateField('mobileNo', e.target.value)}
                  placeholder="0712345678"
                  className="h-11"
                />
                {errors.mobileNo && <p className="text-xs text-red-500">{errors.mobileNo}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    placeholder="Min. 6 characters"
                    className="h-11"
                  />
                  {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => updateField('confirmPassword', e.target.value)}
                    placeholder="Repeat password"
                    className="h-11"
                  />
                  {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Province</Label>
                <Select value={form.province} onValueChange={(v) => updateField('province', v)}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent>
                    {SA_PROVINCES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.province && <p className="text-xs text-red-500">{errors.province}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Government Department</Label>
                <Input
                  id="department"
                  value={form.department}
                  onChange={(e) => updateField('department', e.target.value)}
                  placeholder="e.g. Department of Health"
                  className="h-11"
                />
                {errors.department && <p className="text-xs text-red-500">{errors.department}</p>}
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="acceptTerms"
                  checked={form.acceptTerms}
                  onChange={(e) => updateField('acceptTerms', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary accent-primary"
                />
                <Label htmlFor="acceptTerms" className="text-xs text-gray-500 leading-relaxed">
                  I accept the Terms and Conditions of the AmbassadorC Refer & Earn Program.
                </Label>
              </div>
              {errors.acceptTerms && <p className="text-xs text-red-500">{errors.acceptTerms}</p>}

              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
