import { useCallback, useEffect, useState } from 'react'
import { Atmosphere } from '../components/Atmosphere'
import { routeHref } from '../routing'
import { AdminAccessError, adminRequest, signInAdmin, signOutAdmin } from './client'
import { Dashboard } from './Dashboard'
import { Scanner } from './Scanner'
import './admin.css'

export default function AdminApp({ route }: { route: string }) {
  const [access, setAccess] = useState<'checking' | 'login' | 'authorized' | 'error'>('checking')
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const denied = useCallback(() => {
    setAccess('login'); setError('Your administrator session is no longer authorized.')
    window.location.hash = '/admin/login'
  }, [])
  useEffect(() => {
    document.title = 'Halloween μαζωξη · Admin'
    return () => { document.title = 'Halloween μαζωξη' }
  }, [])
  useEffect(() => {
    let cancelled = false
    void adminRequest('session').then(() => {
      if (!cancelled) { setAccess('authorized'); setError(null); if (route === '/admin/login') window.location.hash = '/admin/scan' }
    }).catch(error => {
      if (cancelled) return
      if (error instanceof AdminAccessError) {
        setAccess('login')
        if (route !== '/admin/login') window.location.hash = '/admin/login'
      } else { setAccess('error'); setError(error instanceof Error ? error.message : 'Connection failed.') }
    })
    return () => { cancelled = true }
  }, [route, revision])
  async function login(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(null)
    const submittedPassword = password; setPassword('')
    try { await signInAdmin(email, submittedPassword); setAccess('authorized'); window.location.hash = '/admin/scan' }
    catch (error) { setError(error instanceof Error ? error.message : 'Sign in failed.') }
    finally { setBusy(false) }
  }
  async function logout() {
    setBusy(true)
    try { await signOutAdmin(); setAccess('login'); window.location.hash = '/admin/login' }
    catch (error) { setError(error instanceof Error ? error.message : 'Sign out failed.') }
    finally { setBusy(false) }
  }
  return <div className="admin-experience"><Atmosphere /><header className="admin-header"><a className="admin-brand" href={import.meta.env.BASE_URL}>Halloween <em>μαζωξη</em></a><span className="eyebrow">DOOR EDITION</span></header>
    {access === 'authorized' && <nav className="admin-nav" aria-label="Admin"><a aria-current={route === '/admin/scan' ? 'page' : undefined} href={routeHref('/admin/scan')}>Scanner</a><a aria-current={route === '/admin/dashboard' ? 'page' : undefined} href={routeHref('/admin/dashboard')}>The night</a><button disabled={busy} onClick={() => void logout()}>Sign out</button></nav>}
    <main className="admin-main">{access === 'checking' ? <p role="status">Checking administrator access…</p> : access === 'login' ? <section className="admin-login"><p className="eyebrow">FOR THE KEEPERS OF THE NIGHT</p><h1>The door <em>is yours.</em></h1><p className="admin-hint">Sign in with your authorized host account.</p><form onSubmit={event => void login(event)}><label>Email<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label><button className="admin-primary" disabled={busy}>{busy ? 'SIGNING IN…' : 'OPEN THE DOOR ↗'}</button></form></section> : access === 'error' ? <button className="admin-secondary" onClick={() => setRevision(revision + 1)}>RETRY CONNECTION</button> : route === '/admin/dashboard' ? <Dashboard onAccessDenied={denied} /> : <Scanner onAccessDenied={denied} />}
    {error && <p className="admin-error" role="alert">{error}</p>}</main><footer className="admin-footer">HALLOWEEN ΜΑΖΩΞΗ · PRIVATE GATHERING</footer>
  </div>
}
