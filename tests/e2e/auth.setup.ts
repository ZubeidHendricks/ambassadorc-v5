import { test as setup } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const AUTH_FILE = path.join(__dirname, '../../playwright/.auth/user.json')

setup('authenticate once via API', async () => {
  // Authenticate via the API directly — avoids browser form & rate limiter
  const res = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobileNo: '0800000000', password: 'Admin@2024' }),
  })
  const json = await res.json() as { data?: { token?: string } }
  const token = json.data?.token
  if (!token) throw new Error(`Auth failed: ${JSON.stringify(json)}`)

  // Save as Playwright storage state: inject token into localStorage
  const storageState = {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:5000',
        localStorage: [{ name: 'ambassador_token', value: token }],
      },
    ],
  }
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })
  fs.writeFileSync(AUTH_FILE, JSON.stringify(storageState))
  console.log('Auth token saved to', AUTH_FILE)
})
