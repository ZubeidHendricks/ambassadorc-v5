import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { ArrowRight, Zap } from 'lucide-react'

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

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
}

const inputFocusStyle: React.CSSProperties = {
  borderColor: 'rgba(10,179,204,0.4)',
}

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
  const [focused, setFocused] = useState<string | null>(null)

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

  const field = (id: string, label: string, children: React.ReactNode, error?: string) => (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-white/40">
        {label}
      </label>
      {children}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  )

  const inp = (props: React.InputHTMLAttributes<HTMLInputElement> & { fieldId: string }) => {
    const { fieldId, ...rest } = props
    return (
      <input
        {...rest}
        id={fieldId}
        className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors"
        style={focused === fieldId ? { ...inputStyle, ...inputFocusStyle } : inputStyle}
        onFocus={() => setFocused(fieldId)}
        onBlur={() => setFocused(null)}
      />
    )
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden" style={{ background: '#080C14', fontFamily: "'Google Sans', 'Inter', system-ui, sans-serif" }}>

      {/* Noise texture */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '128px' }} />

      {/* Left panel */}
      <div className="relative hidden lg:flex lg:w-[40%] flex-col justify-between p-14 overflow-hidden shrink-0">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 -left-20 h-[500px] w-[500px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(ellipse, #004D99 0%, transparent 70%)', filter: 'blur(80px)' }} />
          <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(ellipse, #0FCC85 0%, transparent 70%)', filter: 'blur(60px)' }} />
        </div>

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#004D99] text-xs font-black text-white">AC</div>
          <span className="text-sm font-semibold text-white">AmbassadorC</span>
        </div>

        <div className="relative">
          <p className="mb-3 text-[10px] uppercase tracking-[0.2em] font-semibold text-white/30">Refer &amp; Earn</p>
          <h2 className="text-4xl font-black tracking-tight text-white leading-[1.05] mb-6">
            Join the<br />
            <span style={{
              background: 'linear-gradient(135deg, #0FCC85 0%, #0AB3CC 60%, #004D99 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Ambassador</span><br />
            Network.
          </h2>
          <p className="text-sm text-white/40 leading-relaxed max-w-xs">
            Earn commissions by referring colleagues. No experience needed — just your network and ambition.
          </p>

          <div className="mt-10 space-y-3">
            {[
              'Earn R100 per direct sign-up',
              'R100 for every 10 referrals',
              'Track earnings in real-time',
              'Climb the tier ladder',
            ].map((perk) => (
              <div key={perk} className="flex items-center gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(15,204,133,0.15)', border: '1px solid rgba(15,204,133,0.2)' }}>
                  <Zap className="h-3 w-3 text-[#0FCC85]" />
                </div>
                <span className="text-sm text-white/50">{perk}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-between">
          <p className="text-[11px] text-white/20">&copy; {new Date().getFullYear()} AmbassadorC</p>
          <Link to="/" className="text-[11px] text-white/30 hover:text-white/60 transition-colors">Back to home</Link>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="relative flex flex-1 items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#004D99] text-xs font-black text-white">AC</div>
            <span className="text-sm font-semibold text-white">AmbassadorC</span>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-black tracking-tight text-white">Create your account</h1>
            <p className="mt-1.5 text-sm text-white/40">Join the AmbassadorC Refer &amp; Earn Program.</p>
          </div>

          <div className="rounded-2xl p-6"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name row */}
              <div className="grid gap-4 sm:grid-cols-2">
                {field('firstName', 'First Name',
                  inp({ fieldId: 'firstName', value: form.firstName, onChange: (e) => updateField('firstName', e.target.value), placeholder: 'John' }),
                  errors.firstName
                )}
                {field('lastName', 'Last Name',
                  inp({ fieldId: 'lastName', value: form.lastName, onChange: (e) => updateField('lastName', e.target.value), placeholder: 'Doe' }),
                  errors.lastName
                )}
              </div>

              {field('mobileNo', 'Mobile Number',
                inp({ fieldId: 'mobileNo', type: 'tel', value: form.mobileNo, onChange: (e) => updateField('mobileNo', e.target.value), placeholder: '0712345678', autoComplete: 'tel' }),
                errors.mobileNo
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {field('password', 'Password',
                  inp({ fieldId: 'password', type: 'password', value: form.password, onChange: (e) => updateField('password', e.target.value), placeholder: 'Min. 6 characters', autoComplete: 'new-password' }),
                  errors.password
                )}
                {field('confirmPassword', 'Confirm Password',
                  inp({ fieldId: 'confirmPassword', type: 'password', value: form.confirmPassword, onChange: (e) => updateField('confirmPassword', e.target.value), placeholder: 'Repeat password' }),
                  errors.confirmPassword
                )}
              </div>

              {field('province', 'Province',
                <select
                  id="province"
                  value={form.province}
                  onChange={(e) => updateField('province', e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-colors appearance-none"
                  style={focused === 'province' ? { ...inputStyle, ...inputFocusStyle } : inputStyle}
                  onFocus={() => setFocused('province')}
                  onBlur={() => setFocused(null)}
                >
                  <option value="" style={{ background: '#0D1117' }}>Select province</option>
                  {SA_PROVINCES.map((p) => (
                    <option key={p} value={p} style={{ background: '#0D1117' }}>{p}</option>
                  ))}
                </select>,
                errors.province
              )}

              {field('department', 'Government Department',
                inp({ fieldId: 'department', value: form.department, onChange: (e) => updateField('department', e.target.value), placeholder: 'e.g. Department of Health' }),
                errors.department
              )}

              {/* Terms */}
              <div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      checked={form.acceptTerms}
                      onChange={(e) => updateField('acceptTerms', e.target.checked)}
                      className="sr-only"
                    />
                    <div className="h-4 w-4 rounded flex items-center justify-center transition-all"
                      style={{
                        background: form.acceptTerms ? '#004D99' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${form.acceptTerms ? '#004D99' : 'rgba(255,255,255,0.15)'}`,
                      }}>
                      {form.acceptTerms && (
                        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 12 10">
                          <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-white/40 leading-relaxed">
                    I accept the Terms and Conditions of the AmbassadorC Refer &amp; Earn Program.
                  </span>
                </label>
                {errors.acceptTerms && <p className="mt-1.5 text-[11px] text-red-400">{errors.acceptTerms}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-[#080C14] transition-all disabled:opacity-60"
                style={{ background: 'white', boxShadow: '0 0 30px rgba(0,77,153,0.25)' }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#080C14]/30 border-t-[#080C14]" />
                    Creating account…
                  </span>
                ) : (
                  <>Create Account <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-sm text-white/30">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-white/60 hover:text-white transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
