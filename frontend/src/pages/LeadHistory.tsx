import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLeads, type Lead } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, statusToBadgeVariant } from '@/components/ui/badge'
import { UserPlus, Inbox } from 'lucide-react'

export default function LeadHistory() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLeads()
      .then(setLeads)
      .catch(() => setLeads([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-light border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead History</h1>
          <p className="mt-1 text-sm text-gray-500">
            All your submitted leads and their current status
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link to="/leads">
            <UserPlus className="mr-2 h-4 w-4" />
            New Lead
          </Link>
        </Button>
      </div>

      {leads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Inbox className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No leads submitted yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Submit your first lead to start earning
            </p>
            <Button asChild variant="secondary" className="mt-6">
              <Link to="/leads">Submit a Lead</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {leads.map((lead) => (
            <Card key={lead.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">
                    {lead.firstName} {lead.lastName}
                  </CardTitle>
                  <Badge variant={statusToBadgeVariant(lead.status)}>
                    {lead.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Contact</span>
                    <span className="font-medium text-gray-700">
                      {lead.contactNo}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Preferred</span>
                    <span className="font-medium text-gray-700">
                      {lead.preferredContact}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Submitted</span>
                    <span className="text-gray-700">
                      {new Date(lead.createdAt).toLocaleDateString('en-ZA', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
