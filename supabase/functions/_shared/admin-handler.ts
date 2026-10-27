export type AdminTicket = {
  id: string; editionId: string; displayNumber: string; status: 'issued' | 'redeemed'
  createdAt: string; redeemedAt: string | null; redeemedBy: string | null
}
export type AdmissionResult = { result: 'INVALID' } | { result: 'VALID' | 'ADMITTED' | 'ALREADY_USED'; ticket: AdminTicket }
export type AdminDashboard = {
  total: number; admitted: number; remaining: number
  distribution: { editionId: string; total: number; admitted: number }[]
  recent: Pick<AdminTicket, 'id' | 'editionId' | 'displayNumber' | 'redeemedAt' | 'redeemedBy'>[]
}
export type AdminAction = 'session' | 'dashboard' | 'validate' | 'admit'
export type AdminDependencies = {
  authenticate: (token: string) => Promise<{ id: string; permanent: boolean } | null>
  execute: (adminId: string, action: AdminAction, credential?: string) => Promise<unknown>
}
export class AdminDenied extends Error {}

export function createAdminHandler(dependencies: AdminDependencies) {
  return async (request: Request): Promise<Response> => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json', 'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    }
    const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)
    const bearer = /^Bearer ([^\s]+)$/i.exec(request.headers.get('Authorization') || '')
    if (!bearer) return respond({ error: 'Sign in as an administrator.' }, 401)
    try {
      const user = await dependencies.authenticate(bearer[1])
      if (!user) return respond({ error: 'Session expired. Sign in again.' }, 401)
      if (!user.permanent) return respond({ error: 'Administrator access required.' }, 403)
      // Check the current allowlist before parsing credentials or returning any data.
      await dependencies.execute(user.id, 'session')
      if (Number(request.headers.get('Content-Length') || 0) > 256) return respond({ error: 'Invalid request' }, 400)
      const text = await request.text()
      if (text.length > 256) return respond({ error: 'Invalid request' }, 400)
      let body: { action?: AdminAction; credential?: string }
      try { body = JSON.parse(text) } catch { return respond({ error: 'Invalid request' }, 400) }
      if (!body || Object.keys(body).some(key => !['action', 'credential'].includes(key))
        || !['session', 'dashboard', 'validate', 'admit'].includes(body.action || '')) {
        return respond({ error: 'Invalid request' }, 400)
      }
      if (body.action === 'validate' || body.action === 'admit') {
        if (typeof body.credential !== 'string' || !/^hm1_[A-Za-z0-9_-]{43}$/.test(body.credential)) {
          return respond({ result: 'INVALID' })
        }
      } else if (body.credential !== undefined) return respond({ error: 'Invalid request' }, 400)
      return respond(await dependencies.execute(user.id, body.action!, body.credential))
    } catch (error) {
      if (error instanceof AdminDenied) return respond({ error: 'Administrator access required.' }, 403)
      return respond({ error: 'Connection interrupted. Check the ticket again before admitting.' }, 503)
    }
  }
}
