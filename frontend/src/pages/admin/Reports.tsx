import { useState } from 'react'
import { downloadEarningsReport } from '@/lib/api'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileDown, Users, CheckCircle2, FileSpreadsheet } from 'lucide-react'

export default function Reports() {
  const [downloading, setDownloading] = useState(false)

  function handleDownload() {
    setDownloading(true)
    try {
      downloadEarningsReport()
      // Brief delay for UX — the download fires async
      setTimeout(() => setDownloading(false), 2000)
    } catch {
      setDownloading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Generate and download reports for FNB Cash Send payments to ambassadors
        </p>
      </div>

      <div className="grid gap-6">
        {/* Ambassador Earnings Report */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              Ambassador Earnings Report
            </CardTitle>
            <CardDescription>
              Excel report ready for FNB Enterprise Cash Send upload. Contains all ambassador
              earnings broken down by referral batches and member sign-up conversions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-blue-50 p-4 text-center">
                <Users className="mx-auto mb-1 h-5 w-5 text-blue-600" />
                <p className="text-sm font-semibold text-blue-700">Sheet 1</p>
                <p className="text-xs text-blue-600 mt-1">FNB Cash Send Summary</p>
                <p className="text-xs text-gray-500 mt-1">All ambassadors · earnings · amount due</p>
              </div>
              <div className="rounded-lg border bg-purple-50 p-4 text-center">
                <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-purple-600" />
                <p className="text-sm font-semibold text-purple-700">Sheet 2</p>
                <p className="text-xs text-purple-600 mt-1">Member Sign-Ups Detail</p>
                <p className="text-xs text-gray-500 mt-1">Individual sign-up records with status</p>
              </div>
              <div className="rounded-lg border bg-sky-50 p-4 text-center">
                <Users className="mx-auto mb-1 h-5 w-5 text-sky-600" />
                <p className="text-sm font-semibold text-sky-700">Sheet 3</p>
                <p className="text-xs text-sky-600 mt-1">Referral Batches</p>
                <p className="text-xs text-gray-500 mt-1">Batch counts and milestone earnings</p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6">
              <p className="text-sm text-amber-800">
                <strong>FNB Cash Send process:</strong> Download this report → open Sheet 1 →
                use the "Amount Due" column to initiate Cash Send payments per ambassador
                from your FNB Enterprise account. After processing, mark payments as paid
                in the system.
              </p>
            </div>

            <Button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full sm:w-auto"
              size="lg"
            >
              <FileDown className="mr-2 h-5 w-5" />
              {downloading ? 'Generating...' : 'Download Ambassador Earnings (.xlsx)'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
