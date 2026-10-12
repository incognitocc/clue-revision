// ds-sense 產出 — 共用提示框（hover／focus／click 顯示；供話題摘要與長條圖數值共用）
import { html } from '../core/dom.js';

let tip = null;
let current = null;
let shownAt = 0;

function ensure() {
  if (tip) return tip;
  tip = document.createElement('div');
  tip.className = 'topic-tip';
  tip.id = 'topic-tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.append(tip);
  const hide = () => topicTip.hide();
  // 捲動時關閉；剛顯示的 300ms 內忽略（瀏覽器為了露出元素而觸發的捲動不應把提示關掉）
  window.addEventListener('scroll', () => { if (Date.now() - shownAt > 300) hide(); }, { passive: true });
  window.addEventListener('hashchange', hide);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  // 點其他地方（非觸發元素、非提示框本身）關閉；讓觸控裝置也能用點擊顯示、點別處收起
  document.addEventListener('pointerdown', (e) => {
    if (!tip || tip.hidden) return;
    if (e.target === current || current?.contains(e.target) || tip.contains(e.target)) return;
    hide();
  });
  return tip;
}

function place(el) {
  const r = el.getBoundingClientRect();
  const w = tip.offsetWidth; const h = tip.offsetHeight;
  const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
  const top = r.top - h - 8 >= 8 ? r.top - h - 8 : r.bottom + 8;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

export const topicTip = {
  show(el, title, brief, keywords) {
    const t = ensure();
    t.innerHTML = html`<p class="topic-tip__title">${title}</p><p class="topic-tip__brief">${brief}</p><p class="topic-tip__kw">關鍵字：${keywords}</p>`;
    t.hidden = false;
    shownAt = Date.now();
    current = el;
    el.setAttribute('aria-describedby', 'topic-tip');
    place(el);
  },
  /** 單行簡易提示（例如長條圖的數值） */
  showSimple(el, text) {
    const t = ensure();
    t.innerHTML = html`<p class="topic-tip__title">${text}</p>`;
    t.hidden = false;
    shownAt = Date.now();
    current = el;
    el.setAttribute('aria-describedby', 'topic-tip');
    place(el);
  },
  /** 多系列提示（例如折線圖某一天的總聲量／正面／負面），rows: [{ label, value, cls }] */
  showMulti(el, title, rows) {
    const t = ensure();
    t.innerHTML = html`<p class="topic-tip__title">${title}</p>${rows.map((r) => html`<p class="topic-tip__row"><span class="legend legend--${r.cls}">${r.label}</span><span class="num">${r.value}</span></p>`)}`;
    t.hidden = false;
    shownAt = Date.now();
    current = el;
    el.setAttribute('aria-describedby', 'topic-tip');
    place(el);
  },
  hide() {
    if (!tip || tip.hidden) return;
    tip.hidden = true;
    current?.removeAttribute('aria-describedby');
    current = null;
  },
};
