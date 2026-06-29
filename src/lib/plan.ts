export type Plan = 'free' | 'pro'

export function isPro(user: { plan?: string | null } | null | undefined): boolean {
  return user?.plan === 'pro'
}
