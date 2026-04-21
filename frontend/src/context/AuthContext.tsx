import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import {
  login as apiLogin,
  register as apiRegister,
  getMe,
  setToken,
  clearToken,
  type Ambassador,
  type LoginPayload,
  type RegisterPayload,
} from '@/lib/api'

interface AuthContextType {
  user: Ambassador | null
  loading: boolean
  login: (payload: LoginPayload) => Promise<Ambassador>
  register: (payload: RegisterPayload) => Promise<Ambassador>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Ambassador | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const ambassador = await getMe()
      setUser(ambassador)
    } catch {
      setUser(null)
      clearToken()
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('ambassador_token')
    if (token) {
      refreshUser().finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [refreshUser])

  const login = useCallback(async (payload: LoginPayload): Promise<Ambassador> => {
    const data = await apiLogin(payload)
    setToken(data.token)
    setUser(data.ambassador)
    return data.ambassador
  }, [])

  const register = useCallback(async (payload: RegisterPayload): Promise<Ambassador> => {
    const data = await apiRegister(payload)
    setToken(data.token)
    setUser(data.ambassador)
    return data.ambassador
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    if (import.meta.env.DEV) {
      console.warn('[useAuth] Called outside AuthProvider — returning loading fallback (HMR recovery)')
    }
    return {
      user: null,
      loading: true,
      login: () => Promise.reject(new Error('AuthProvider not ready')),
      register: () => Promise.reject(new Error('AuthProvider not ready')),
      logout: () => {},
      refreshUser: () => Promise.resolve(),
    }
  }
  return context
}
