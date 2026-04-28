const HUB_URL  = process.env.NEXT_PUBLIC_HUB_SUPABASE_URL
const HUB_KEY  = process.env.NEXT_PUBLIC_HUB_SUPABASE_ANON_KEY

// Llama a esto cuando el usuario esté autenticado
// platform: 'onduty' | 'coms' | 'core' | 'archive' | 'sherpa' | 'tavern' | 'ops'
export async function sendHeartbeat(platform, userId) {
  if (!HUB_URL || !HUB_KEY || !userId) return

  try {
    await fetch(`${HUB_URL}/rest/v1/platform_heartbeats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': HUB_KEY,
        'Authorization': `Bearer ${HUB_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        platform,
        user_id: userId,
        last_seen: new Date().toISOString()
      })
    })
  } catch (_) {
    // fire & forget — no afecta la app si falla
  }
}
