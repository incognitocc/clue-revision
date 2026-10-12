// ds-sense 產出 — 簡單 hash router（主要畫面可直達；未知路徑有明確返回路徑）

const routes = [];
let notFound = null;
let current = null;

export function route(pattern, handler) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ re, keys, handler, pattern });
}
export function fallback(handler) { notFound = handler; }

export function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = h.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(qs)) };
}

export function href(path, query = {}) {
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== '')).toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}

export function navigate(path, query, { replace = false } = {}) {
  const target = href(path, query);
  const same = location.hash === target;
  if (replace) history.replaceState(null, '', target);
  else location.hash = target.slice(1);
  if (replace || same) resolve();
}

export function currentRoute() { return current; }

export async function resolve() {
  const { path, query } = parseHash();
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      current = { path, query, params, pattern: r.pattern };
      await r.handler({ params, query, path });
      return;
    }
  }
  current = { path, query, params: {}, pattern: null };
  notFound?.({ path, query });
}

export function start() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
