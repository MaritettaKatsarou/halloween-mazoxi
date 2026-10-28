export type AdminTicket = {
  id: string; editionId: string; displayNumber: string; status: 'issued' | 'redeemed'
  createdAt: string; redeemedAt: string | null; redeemedBy: string | null
}
export type AdmissionResult = { result: 'INVALID' } | { result: 'VALID' | 'ADMITTED' | 'ALREADY_USED'; ticket: AdminTicket }
export type AdminDashboard = {
  total: number; admitted: number; remaining: number
  baselineAt: string | null; lifetimeAdmitted: number; lifetimeGenerated: number; lifetimeRemaining: number
  distribution: { editionId: string; total: number; admitted: number; remaining: number }[]
  recent: Pick<AdminTicket, 'id' | 'editionId' | 'displayNumber' | 'redeemedAt' | 'redeemedBy'>[]
}
export type HistoryCursor = { redeemedAt: string; id: string }
export type AdminHistory = {
  items: AdminDashboard['recent']; nextCursor: HistoryCursor | null
  resets: { id: string; baselineAt: string; resetBy: string }[]
}
export type PeriodSnapshot = Pick<AdminDashboard, 'total' | 'admitted' | 'remaining' | 'distribution' | 'lifetimeGenerated' | 'lifetimeAdmitted' | 'lifetimeRemaining'>
export type ClosedPeriod = { id: string; closedAt: string; resetBy: string; periodStart: string | null; snapshot: PeriodSnapshot | null }
export type CountingHistory = { periods: ClosedPeriod[]; nextBeforeId: string | null; lifetime: { generated: number; admitted: number; outstanding: number } }
export type ResetCountResult = { baselineAt: string; resetId: string; period: AdminDashboard }
export type AdminAction = 'session' | 'dashboard' | 'validate' | 'admit' | 'reset-count' | 'history' | 'periods'
export type AdminOperationOptions = { requestId?: string; cursor?: HistoryCursor; beforeId?: string }
export type AdminDependencies = {
  authenticate: (token: string) => Promise<{ id: string; permanent: boolean } | null>
  execute: (adminId: string, action: AdminAction, credential?: string, options?: AdminOperationOptions) => Promise<unknown>
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
      let body: { action?: AdminAction; credential?: string; requestId?: string; cursor?: HistoryCursor; beforeId?: string }
      try { body = JSON.parse(text) } catch { return respond({ error: 'Invalid request' }, 400) }
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['action', 'credential', 'requestId', 'cursor', 'beforeId'].includes(key))
        || !['session', 'dashboard', 'validate', 'admit', 'reset-count', 'history', 'periods'].includes(body.action || '')) {
        return respond({ error: 'Invalid request' }, 400)
      }
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (body.action === 'periods') {
        if (body.credential !== undefined || body.requestId !== undefined || body.cursor !== undefined || body.beforeId !== undefined &&
          (typeof body.beforeId !== 'string' || !/^[1-9]\d{0,18}$/.test(body.beforeId) || BigInt(body.beforeId) > 9223372036854775807n)) return respond({ error: 'Invalid period cursor' }, 400)
        return respond(await dependencies.execute(user.id, 'periods', undefined, body.beforeId ? { beforeId: body.beforeId } : {}))
      }
      if (body.beforeId !== undefined) return respond({ error: 'Invalid request' }, 400)
      if (body.action === 'reset-count') {
        if (typeof body.requestId !== 'string' || !uuid.test(body.requestId) || body.credential !== undefined || body.cursor !== undefined) return respond({ error: 'Invalid reset request' }, 400)
        return respond(await dependencies.execute(user.id, 'reset-count', undefined, { requestId: body.requestId }))
      }
      if (body.requestId !== undefined) return respond({ error: 'Invalid request' }, 400)
      if (body.action === 'history') {
        const cursor = body.cursor
        if (body.credential !== undefined || cursor !== undefined && (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)
          || Object.keys(cursor).some(key => !['redeemedAt', 'id'].includes(key))
          || typeof cursor.id !== 'string' || !uuid.test(cursor.id) || typeof cursor.redeemedAt !== 'string'
          || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|\+00:00)$/.test(cursor.redeemedAt)
          || !Number.isFinite(Date.parse(cursor.redeemedAt)))) return respond({ error: 'Invalid history request' }, 400)
        return respond(await dependencies.execute(user.id, 'history', undefined, cursor ? { cursor } : {}))
      }
      if (body.cursor !== undefined) return respond({ error: 'Invalid request' }, 400)
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
