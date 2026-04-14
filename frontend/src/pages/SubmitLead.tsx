import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { submitLead } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { UserPlus, Users, CheckCircle2 } from 'lucide-react'

const CONTACT_METHODS = ['Call', 'SMS', 'WhatsApp', 'Email']

type LeadType = 'REFERRAL_LEAD' | 'MEMBER_SIGNUP'

const LEAD_TYPES: { value: LeadType; label: string; description: string; earning: string; icon: typeof UserPlus }[] = [
  {
    value: 'REFERRAL_LEAD',
    label: 'Referral Lead',
    description: 'Submit a contact who may be interested. Earn R100 per batch of 10 referrals submitted.',
    earning: 'R100 per 10 referrals',
    icon: Users,
  },
  {
    value: 'MEMBER_SIGNUP',
    label: 'Member Sign-Up',
    description: 'Submit a pre-qualified government employee who has confirmed their interest and intent to join.',
    earning: 'R100 per confirmed sale',
    icon: CheckCircle2,
  },
]

export default function SubmitLead() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [leadType, setLeadType] = useState<LeadType>('REFERRAL_LEAD')
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    contactNo: '',
    preferredContact: '',
    employerName: '',
    idNumber: '',
    notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.firstName.trim()) e.firstName = 'First name is required'
    if (!form.lastName.trim()) e.lastName = 'Last name is required'
    if (!/^0[6-8]\d{8}$/.test(form.contactNo))
      e.contactNo = 'Enter a valid SA mobile number'
    if (!form.preferredContact)
      e.preferredContact = 'Select preferred contact method'
    if (leadType === 'MEMBER_SIGNUP' && !form.employerName.trim())
      e.employerName = 'Employer / department name is required for member sign-ups'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      await submitLead({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        contactNo: form.contactNo,
        preferredContact: form.preferredContact,
        type: leadType,
        employerName: form.employerName.trim() || undefined,
        idNumber: form.idNumber.trim() || undefined,
        notes: form.notes.trim() || undefined,
      })
      const label = leadType === 'MEMBER_SIGNUP' ? 'Member sign-up' : 'Lead'
      toast({
        title: `${label} Submitted!`,
        description: `${form.firstName} ${form.lastName} has been submitted successfully.`,
        variant: 'success',
      })
      navigate('/leads/history')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Submission failed'
      toast({
        title: message.toLowerCase().includes('duplicate') ? 'Possible Duplicate' : 'Submission Failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const selectedType = LEAD_TYPES.find((t) => t.value === leadType)!

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      {/* Lead Type Selector */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          What type of submission is this?
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {LEAD_TYPES.map((t) => {
            const Icon = t.icon
            const active = leadType === t.value
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setLeadType(t.value)}
                className={`rounded-xl border-2 p-4 text-left transition-all ${
                  active
                    ? 'border-primary-light bg-blue-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${active ? 'text-primary-light' : 'text-gray-400'}`} />
                  <span className={`font-semibold text-sm ${active ? 'text-primary-light' : 'text-gray-700'}`}>
                    {t.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-snug">{t.description}</p>
                <p className={`mt-2 text-xs font-bold ${active ? 'text-green-600' : 'text-gray-400'}`}>
                  {t.earning}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary-light" />
            Submit {selectedType.label}
          </CardTitle>
          <CardDescription>{selectedType.description}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leadFirstName">First Name</Label>
                <Input
                  id="leadFirstName"
                  value={form.firstName}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  placeholder="First name"
                />
                {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="leadLastName">Last Name</Label>
                <Input
                  id="leadLastName"
                  value={form.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  placeholder="Last name"
                />
                {errors.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="leadContactNo">Contact Number</Label>
              <Input
                id="leadContactNo"
                type="tel"
                value={form.contactNo}
                onChange={(e) => updateField('contactNo', e.target.value)}
                placeholder="0712345678"
              />
              {errors.contactNo && <p className="text-xs text-red-500">{errors.contactNo}</p>}
            </div>

            <div className="space-y-2">
              <Label>Preferred Contact Method</Label>
              <Select value={form.preferredContact} onValueChange={(v) => updateField('preferredContact', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.preferredContact && <p className="text-xs text-red-500">{errors.preferredContact}</p>}
            </div>

            {/* Member sign-up extra fields */}
            {leadType === 'MEMBER_SIGNUP' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="employerName">
                    Government Employer / Department <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="employerName"
                    value={form.employerName}
                    onChange={(e) => updateField('employerName', e.target.value)}
                    placeholder="e.g. Department of Health, SAPS"
                  />
                  {errors.employerName && <p className="text-xs text-red-500">{errors.employerName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idNumber">ID Number (optional)</Label>
                  <Input
                    id="idNumber"
                    value={form.idNumber}
                    onChange={(e) => updateField('idNumber', e.target.value)}
                    placeholder="13-digit SA ID"
                    maxLength={13}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                    placeholder="Any additional details about this member's interest..."
                    rows={3}
                  />
                </div>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Submitting...' : `Submit ${selectedType.label}`}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
