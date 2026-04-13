import { useState, useEffect } from 'react'
import { Trophy, Medal, Crown, Star, TrendingUp, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLeaderboard, type LeaderboardEntry } from '@/lib/api'

const tierColors: Record<string, { bg: string; text: string; dot: string }> = {
  Diamond: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  Platinum: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  Gold: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  Silver: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  Bronze: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
}

type TimeFilter = 'all_time' | 'this_month' | 'this_week'

export default function Leaderboard() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all_time')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    getLeaderboard(timeFilter).then(setLeaderboard).catch(() => {})
  }, [timeFilter])

  const top3 = leaderboard.slice(0, 3)
  const rest = leaderboard.slice(3)

  return (
    <div className="space-y-6 p-6 lg:p-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ambassador Leaderboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Top performing ambassadors ranked by referrals and earnings.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          {(['all_time', 'this_month', 'this_week'] as TimeFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-all',
                timeFilter === filter
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {filter === 'all_time' ? 'All Time' : filter === 'this_month' ? 'This Month' : 'This Week'}
            </button>
          ))}
        </div>
      </div>

      {/* Podium - Top 3 */}
      {top3.length >= 3 && (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* 2nd place */}
        <div className="order-2 sm:order-1 sm:mt-8">
          <PodiumCard entry={top3[1]} />
        </div>
        {/* 1st place */}
        <div className="order-1 sm:order-2">
          <PodiumCard entry={top3[0]} isFirst />
        </div>
        {/* 3rd place */}
        <div className="order-3 sm:mt-12">
          <PodiumCard entry={top3[2]} />
        </div>
      </div>
      )}

      {/* Rankings table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Full Rankings</h2>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Users className="h-4 w-4" />
            <span>{leaderboard.length} ambassadors</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Rank</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Ambassador</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Referrals</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Leads</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Earnings</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Tier</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Trend</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((entry) => (
                <tr key={entry.rank} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                      {entry.rank}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary-50 flex items-center justify-center text-xs font-bold text-primary">
                        {entry.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="font-medium text-gray-900">{entry.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-700">{entry.referrals}</td>
                  <td className="px-6 py-4 text-gray-700">{entry.leads}</td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-700">R{entry.earnings.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <TierBadge tier={entry.tier} />
                  </td>
                  <td className="px-6 py-4">
                    <TrendIndicator trend={entry.trend} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PodiumCard({ entry, isFirst = false }: { entry: LeaderboardEntry; isFirst?: boolean }) {
  const rankIcon = entry.rank === 1 ? Crown : entry.rank === 2 ? Medal : Trophy
  const RankIcon = rankIcon
  const rankColor = entry.rank === 1 ? 'text-amber-500' : entry.rank === 2 ? 'text-gray-400' : 'text-orange-500'
  const borderColor = entry.rank === 1 ? 'border-amber-200' : entry.rank === 2 ? 'border-gray-200' : 'border-orange-200'

  return (
    <div className={cn(
      'rounded-2xl border bg-white p-6 text-center shadow-sm transition-all hover:shadow-lg hover:-translate-y-1',
      borderColor,
      isFirst && 'ring-2 ring-amber-200/50'
    )}>
      <div className="flex justify-center mb-3">
        <RankIcon className={cn('h-8 w-8', rankColor)} />
      </div>
      <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-primary-50 flex items-center justify-center text-lg font-bold text-primary">
        {entry.name.split(' ').map(n => n[0]).join('')}
      </div>
      <h3 className="font-semibold text-gray-900">{entry.name}</h3>
      <div className="mt-1 mb-3">
        <TierBadge tier={entry.tier} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div>
          <p className="text-xs text-gray-400">Referrals</p>
          <p className="text-lg font-bold text-gray-900">{entry.referrals}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Earnings</p>
          <p className="text-lg font-bold text-gray-900">R{(entry.earnings / 1000).toFixed(1)}k</p>
        </div>
      </div>
    </div>
  )
}

function TierBadge({ tier }: { tier: string }) {
  const config = tierColors[tier] || tierColors.Bronze
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
      config.bg, config.text
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {tier}
    </span>
  )
}

function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'same' }) {
  if (trend === 'up') {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-success">
        <TrendingUp className="h-3.5 w-3.5" />
        Up
      </span>
    )
  }
  if (trend === 'down') {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-error">
        <TrendingUp className="h-3.5 w-3.5 rotate-180" />
        Down
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-gray-400">
      <Star className="h-3.5 w-3.5" />
      Same
    </span>
  )
}
