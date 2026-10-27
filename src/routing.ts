export function resolveRoute(hash: string, pathname: string, base: string) {
  if (hash.startsWith('#/')) return hash.slice(1).split('?')[0].replace(/\/$/, '') || '/'
  const relative = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, '')
  return relative.startsWith('admin/') ? '/' + relative.replace(/\/$/, '') : '/'
}
export function routeHref(route: string) { return `${import.meta.env.BASE_URL}#${route}` }
