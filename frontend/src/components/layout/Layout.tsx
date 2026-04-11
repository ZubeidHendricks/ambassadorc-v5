import { type ReactNode } from 'react'
import Header from '@/components/layout/Header'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1">{children}</main>
    </div>
  )
}
