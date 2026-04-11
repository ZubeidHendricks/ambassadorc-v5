import { useState, type FormEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { updateProfile, requestMobileChange } from '@/lib/api'
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
import { Badge } from '@/components/ui/badge'
import { User, Phone } from 'lucide-react'

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

export default function Profile() {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    province: user?.province || '',
    department: user?.department || '',
  })
  const [saving, setSaving] = useState(false)

  const [mobileForm, setMobileForm] = useState({ newMobileNo: '' })
  const [mobileLoading, setMobileLoading] = useState(false)

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave(ev: FormEvent) {
    ev.preventDefault()
    if (!user) return

    setSaving(true)
    try {
      await updateProfile(user.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        province: form.province,
        department: form.department.trim(),
      })
      await refreshUser()
      toast({ title: 'Profile Updated', variant: 'success' })
      setEditing(false)
    } catch (err) {
      toast({
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleMobileChange(ev: FormEvent) {
    ev.preventDefault()
    if (!/^0[6-8]\d{8}$/.test(mobileForm.newMobileNo)) {
      toast({
        title: 'Invalid Number',
        description: 'Enter a valid SA mobile number',
        variant: 'destructive',
      })
      return
    }

    setMobileLoading(true)
    try {
      const result = await requestMobileChange(mobileForm.newMobileNo)
      toast({
        title: 'Request Submitted',
        description: result.message || 'Your mobile change request has been submitted for review.',
        variant: 'success',
      })
      setMobileForm({ newMobileNo: '' })
    } catch (err) {
      toast({
        title: 'Request Failed',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      })
    } finally {
      setMobileLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="space-y-6">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal text-white text-lg font-bold">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Profile
                  </CardTitle>
                  <CardDescription>
                    Manage your ambassador details
                  </CardDescription>
                </div>
              </div>
              <Badge
                variant={user.status === 'active' ? 'success' : 'warning'}
              >
                {user.status}
              </Badge>
            </div>
          </CardHeader>

          {editing ? (
            <form onSubmit={handleSave}>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="profileFirstName">First Name</Label>
                    <Input
                      id="profileFirstName"
                      value={form.firstName}
                      onChange={(e) => updateField('firstName', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profileLastName">Last Name</Label>
                    <Input
                      id="profileLastName"
                      value={form.lastName}
                      onChange={(e) => updateField('lastName', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Province</Label>
                  <Select
                    value={form.province}
                    onValueChange={(v) => updateField('province', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SA_PROVINCES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profileDept">Department</Label>
                  <Input
                    id="profileDept"
                    value={form.department}
                    onChange={(e) => updateField('department', e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter className="gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false)
                    setForm({
                      firstName: user.firstName,
                      lastName: user.lastName,
                      province: user.province,
                      department: user.department,
                    })
                  }}
                >
                  Cancel
                </Button>
              </CardFooter>
            </form>
          ) : (
            <>
              <CardContent>
                <dl className="space-y-3">
                  {[
                    ['Name', `${user.firstName} ${user.lastName}`],
                    ['Mobile', user.mobileNo],
                    ['Province', user.province],
                    ['Department', user.department],
                    [
                      'Member Since',
                      new Date(user.createdAt).toLocaleDateString('en-ZA', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      }),
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex justify-between border-b border-gray-50 pb-2 last:border-0"
                    >
                      <dt className="text-sm text-gray-500">{label}</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
              <CardFooter>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  Edit Profile
                </Button>
              </CardFooter>
            </>
          )}
        </Card>

        {/* Mobile Change */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4" />
              Change Mobile Number
            </CardTitle>
            <CardDescription>
              Request a mobile number change. This requires admin approval.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleMobileChange}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newMobile">New Mobile Number</Label>
                <Input
                  id="newMobile"
                  type="tel"
                  value={mobileForm.newMobileNo}
                  onChange={(e) =>
                    setMobileForm({ newMobileNo: e.target.value })
                  }
                  placeholder="0712345678"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                variant="secondary"
                disabled={mobileLoading || !mobileForm.newMobileNo}
              >
                {mobileLoading ? 'Submitting...' : 'Request Change'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
