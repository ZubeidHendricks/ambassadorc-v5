import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { submitLead } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { UserPlus } from 'lucide-react'

const CONTACT_METHODS = ['Call', 'SMS', 'WhatsApp', 'Email']

export default function SubmitLead() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    contactNo: '',
    preferredContact: '',
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
      })
      toast({
        title: 'Lead Submitted!',
        description: `${form.firstName} ${form.lastName} has been submitted as a lead.`,
        variant: 'success',
      })
      navigate('/leads/history')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Submission failed'
      // Check for duplicate warning
      if (message.toLowerCase().includes('duplicate')) {
        toast({
          title: 'Possible Duplicate',
          description: message,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Submission Failed',
          description: message,
          variant: 'destructive',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-brand-teal" />
            Submit a Lead
          </CardTitle>
          <CardDescription>
            Submit a direct lead for someone interested in Lifesaver insurance.
            Earn R100 per sign-up!
          </CardDescription>
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
                {errors.firstName && (
                  <p className="text-xs text-red-500">{errors.firstName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="leadLastName">Last Name</Label>
                <Input
                  id="leadLastName"
                  value={form.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  placeholder="Last name"
                />
                {errors.lastName && (
                  <p className="text-xs text-red-500">{errors.lastName}</p>
                )}
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
              {errors.contactNo && (
                <p className="text-xs text-red-500">{errors.contactNo}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Preferred Contact Method</Label>
              <Select
                value={form.preferredContact}
                onValueChange={(v) => updateField('preferredContact', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.preferredContact && (
                <p className="text-xs text-red-500">
                  {errors.preferredContact}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Lead'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
