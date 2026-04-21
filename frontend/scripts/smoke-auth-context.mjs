let smokeUser = null

export function setSmokeUser(user) {
  smokeUser = user
}

export function useAuth() {
  return {
    user: smokeUser,
    loading: false,
    logout: () => {},
    login: () => Promise.reject(new Error('smoke')),
    register: () => Promise.reject(new Error('smoke')),
    refreshUser: () => Promise.resolve(),
  }
}