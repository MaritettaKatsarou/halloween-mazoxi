import { lazy, Suspense, useSyncExternalStore } from 'react'
import { App } from './App'
import { resolveRoute } from './routing'
const AdminApp = lazy(() => import('./admin/AdminApp'))
const subscribe = (listener: () => void) => {
  window.addEventListener('hashchange', listener); window.addEventListener('popstate', listener)
  return () => { window.removeEventListener('hashchange', listener); window.removeEventListener('popstate', listener) }
}
export function AppRouter() {
  const route = useSyncExternalStore(subscribe,
    () => resolveRoute(window.location.hash, window.location.pathname, import.meta.env.BASE_URL), () => '/')
  return route.startsWith('/admin/')
    ? <Suspense fallback={<div className="admin-loading" role="status">Opening the door…</div>}><AdminApp route={route} /></Suspense>
    : <App />
}
