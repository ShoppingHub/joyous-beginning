/**
 * PostHog analytics wrapper.
 * All tracking calls go through this module so events stay consistent
 * and we can easily add guards (e.g. demo mode).
 */
import posthog from '@/lib/posthog'
import { supabase } from '@/integrations/supabase/client'

// ─── Identify / Reset ───

export async function identifyUser(userId: string) {
  try {
    const [userRes, areasRes, cardsRes] = await Promise.all([
      supabase.from('users').select('plus_active, language, created_at').eq('user_id', userId).single(),
      supabase.from('areas').select('id').eq('user_id', userId).is('archived_at', null),
      supabase.from('user_cards').select('card_type').eq('user_id', userId).eq('enabled', true),
    ])

    posthog.identify(userId, {
      plan: userRes.data?.plus_active ? 'plus' : 'free',
      language: userRes.data?.language ?? 'en',
      areas_count: areasRes.data?.length ?? 0,
      cards_enabled: (cardsRes.data ?? []).map(c => c.card_type),
      created_at: userRes.data?.created_at,
    })
  } catch {
    // Fallback: identify without properties
    posthog.identify(userId)
  }
}

export function resetUser() {
  posthog.reset()
}

// ─── Generic capture ───

export function track(event: string, properties?: Record<string, unknown>) {
  posthog.capture(event, properties)
}

// ─── User property updates ───

export function updateUserProperties(userId: string, props: Record<string, unknown>) {
  posthog.identify(userId, { $set: props })
}
