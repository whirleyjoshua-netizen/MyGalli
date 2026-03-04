import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthState, User } from './types'

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setAuth: (user: User) => {
        set({ user })
      },
      logout: async () => {
        set({ user: null })
        await fetch('/api/auth/logout', { method: 'POST' })
      },
    }),
    {
      name: 'auth-storage',
    }
  )
)
