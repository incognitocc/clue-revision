// ds-sense 產出 — 本機事件紀錄（不接 GA、不送出任何網路請求）
// 只記事件名稱與非敏感屬性；不得包含文章全文、上傳內容、Email、客戶機密。

const KEY = 'clue-poc:events';
const ALLOWED = new Set(['mode', 'source', 'result', 'errorTypes', 'analysisId', 'articleId', 'status', 'fileCount', 'step', 'target', 'via']);

export function track(name, props = {}) {
  const safe = {};
  for (const [k, v] of Object.entries(props)) if (ALLOWED.has(k)) safe[k] = v;
  const evt = { name, props: safe, at: new Date().toISOString() };
  const list = read();
  list.unshift(evt);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
  console.debug('[telemetry:local]', name, safe);
}

export function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

export function clear() { localStorage.removeItem(KEY); }
