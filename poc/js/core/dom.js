// ds-sense 產出 — 小型 DOM 工具（無框架）

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Tagged template：插值自動跳脫；陣列直接串接；以 raw() 包住的字串不跳脫。 */
export function html(strings, ...values) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) out += toStr(values[i]);
  });
  return new Raw(out);
}
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);
function toStr(v) {
  if (v == null || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(toStr).join('');
  return esc(v);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** 事件委派：on(root, 'click', '[data-action="x"]', (e, el) => {}) */
export function on(root, type, selector, handler) {
  root.addEventListener(type, (e) => {
    const el = e.target.closest(selector);
    if (el && root.contains(el)) handler(e, el);
  });
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

const dtf = new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
export const fmtDateTime = (iso) => dtf.format(new Date(iso));
export const fmtDate = (s) => s.replaceAll('-', '/');

// MB 口徑：1 MB = 1,048,576 bytes（程式與畫面一致）
export const MB = 1024 * 1024;
export const fmtSize = (bytes) => (bytes === 0 ? '0 bytes' : bytes >= MB / 10 ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

let toastTimer;
export function toast(message) {
  const region = document.getElementById('toast-region');
  region.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast__icon" aria-hidden="true">✓</span><span></span>`;
  el.lastChild.textContent = message;
  region.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 4000);
}

/** 只有螢幕閱讀器會讀的狀態宣告 */
export function announce(message) {
  const el = document.getElementById('sr-status');
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = message; });
}
