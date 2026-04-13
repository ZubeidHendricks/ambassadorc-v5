import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { submitReferralBatch, type ReferralEntry } from '@/lib/api'
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
import { Plus, Trash2, Send } from 'lucide-react'

interface ReferralRow extends ReferralEntry {
  key: string
}

function createRow(): ReferralRow {
  return { key: Math.random().toString(36).slice(2), name: '', contactNo: '' }
}

export default function SubmitReferrals() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [batchName, setBatchName] = useState('')
  const [rows, setRows] = useState<ReferralRow[]>(() =>
    Array.from({ length: 3 }, createRow)
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  function addRow() {
    if (rows.length >= 10) return
    setRows((prev) => [...prev, createRow()])
  }

  function removeRow(key: string) {
    if (rows.length <= 1) return
    setRows((prev) => prev.filter((r) => r.key !== key))
  }

  function updateRow(key: string, field: 'name' | 'contactNo', value: string) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    )
    if (errors[`${key}_${field}`]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[`${key}_${field}`]
        return next
      })
    }
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!batchName.trim()) e.batchName = 'Batch name is required'

    const filledRows = rows.filter(
      (r) => r.name.trim() || r.contactNo.trim()
    )
    if (filledRows.length === 0) {
      e.general = 'At least one referral is required'
    }

    filledRows.forEach((r) => {
      if (!r.name.trim()) e[`${r.key}_name`] = 'Name required'
      if (!/^0[6-8]\d{8}$/.test(r.contactNo))
        e[`${r.key}_contactNo`] = 'Invalid SA mobile number'
    })

    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    if (!validate()) return

    const referrals = rows
      .filter((r) => r.name.trim() && r.contactNo.trim())
      .map(({ name, contactNo }) => ({ name: name.trim(), contactNo }))

    setLoading(true)
    try {
      await submitReferralBatch({ batchName: batchName.trim(), referrals })
      toast({
        title: 'Referrals Submitted!',
        description: `${referrals.length} referral(s) submitted successfully.`,
        variant: 'success',
      })
      navigate('/referrals/history')
    } catch (err) {
      toast({
        title: 'Submission Failed',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Submit Referrals
          </CardTitle>
          <CardDescription>
            Add up to 10 referrals per batch. Earn R100 for every 10 referrals!
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="batchName">Batch Name</Label>
              <Input
                id="batchName"
                value={batchName}
                onChange={(e) => {
                  setBatchName(e.target.value)
                  if (errors.batchName)
                    setErrors((p) => ({ ...p, batchName: '' }))
                }}
                placeholder="e.g. April 2025 - Dept of Health"
              />
              {errors.batchName && (
                <p className="text-xs text-red-500">{errors.batchName}</p>
              )}
            </div>

            {errors.general && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {errors.general}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Referrals ({rows.length}/10)</Label>
                {rows.length < 10 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addRow}
                    className="text-primary-light"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add Row
                  </Button>
                )}
              </div>

              {rows.map((row, i) => (
                <div
                  key={row.key}
                  className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <span className="mt-2.5 text-xs font-bold text-gray-400 w-5 shrink-0">
                    {i + 1}.
                  </span>
                  <div className="flex-1 space-y-2">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Input
                          value={row.name}
                          onChange={(e) =>
                            updateRow(row.key, 'name', e.target.value)
                          }
                          placeholder="Full Name"
                          className="bg-white"
                        />
                        {errors[`${row.key}_name`] && (
                          <p className="mt-1 text-xs text-red-500">
                            {errors[`${row.key}_name`]}
                          </p>
                        )}
                      </div>
                      <div>
                        <Input
                          value={row.contactNo}
                          onChange={(e) =>
                            updateRow(row.key, 'contactNo', e.target.value)
                          }
                          placeholder="0712345678"
                          type="tel"
                          className="bg-white"
                        />
                        {errors[`${row.key}_contactNo`] && (
                          <p className="mt-1 text-xs text-red-500">
                            {errors[`${row.key}_contactNo`]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="mt-2 text-gray-400 hover:text-red-500 transition-colors"
                      aria-label="Remove row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Referrals'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
