// ds-sense 產出 — 話題提示（hover／keyboard focus 時顯示簡短話題內容與關鍵字）
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
  return tip;
}

export const topicTip = {
  show(el, title, brief, keywords) {
    const t = ensure();
    t.innerHTML = html`<p class="topic-tip__title">${title}</p><p class="topic-tip__brief">${brief}</p><p class="topic-tip__kw">關鍵字：${keywords}</p>`;
    t.hidden = false;
    shownAt = Date.now();
    current = el;
    el.setAttribute('aria-describedby', 'topic-tip');
    const r = el.getBoundingClientRect();
    const w = t.offsetWidth; const h = t.offsetHeight;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    const top = r.top - h - 8 >= 8 ? r.top - h - 8 : r.bottom + 8;
    t.style.left = `${left}px`;
    t.style.top = `${top}px`;
  },
  hide() {
    if (!tip || tip.hidden) return;
    tip.hidden = true;
    current?.removeAttribute('aria-describedby');
    current = null;
  },
};
