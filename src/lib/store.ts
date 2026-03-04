import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthState, User } from './types'

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user: User, token: string) => {
        // Set cookie so server-side middleware can check auth
        document.cookie = `gallio-auth=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`
        set({ user, token })
      },
      logout: () => {
        document.cookie = 'gallio-auth=; path=/; max-age=0'
        set({ user: null, token: null })
      },
    }),
    {
      name: 'auth-storage',
    }
  )
)
