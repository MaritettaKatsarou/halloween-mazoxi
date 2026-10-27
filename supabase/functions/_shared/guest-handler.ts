export type GuestTicket = {
  id: string; ownerId: string; editionId: string; displayNumber: string
  status: 'issued' | 'redeemed'; createdAt: string; redeemedAt: string | null
  qrCredential: string | null
}
export type GuestDependencies = {
  authenticate: (token: string) => Promise<{ id: string; isAnonymous: boolean } | null>
  issue: (ownerId: string, create: boolean) => Promise<GuestTicket | null>
}

export function createGuestHandler(dependencies: GuestDependencies) {
  return async (request: Request): Promise<Response> => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store, private',
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    }
    const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get('Authorization') || '')
    if (!match) return respond({ error: 'Authentication required' }, 401)
    try {
      // Never trust a decoded JWT or a user/edition ID supplied in the body.
      const user = await dependencies.authenticate(match[1])
      if (!user) return respond({ error: 'Session expired. Please retry.' }, 401)
      if (!user.isAnonymous) return respond({ error: 'An anonymous guest session is required.' }, 403)
      if (Number(request.headers.get('Content-Length') || 0) > 256) return respond({ error: 'Request too large' }, 413)
      const text = await request.text()
      if (text.length > 256) return respond({ error: 'Request too large' }, 413)
      let body: { action?: string }
      try { body = JSON.parse(text) } catch { return respond({ error: 'Invalid request' }, 400) }
      if (!body || Object.keys(body).some(key => key !== 'action') || !['lookup', 'claim'].includes(body.action || '')) {
        return respond({ error: 'Invalid request' }, 400)
      }
      const ticket = await dependencies.issue(user.id, body.action === 'claim')
      return respond({ ticket })
    } catch {
      // Never log database payloads, bearer tokens or credentials.
      return respond({ error: 'Ticket service temporarily unavailable. Please retry.' }, 503)
    }
  }
}
