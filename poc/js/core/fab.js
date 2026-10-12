// ds-sense 產出 — 回到最上方（浮動圓形按鈕，全站共用）
// setBackToTop(true, 門檻px)：捲動超過門檻時顯示。
// 每次換頁由 main.js 的路由器在呼叫頁面 render 前先 resetBackToTop()，頁面若要用再呼叫 setBackToTop(true, ...) 開啟；
// 這樣可避免「頁面剛啟用、换頁監聽才解除」的事件順序競態。
import { icon } from '../views/icons.js';

let fab = null;
let enabled = false;
let threshold = 0;

function update() {
  if (!fab) return;
  fab.hidden = !(enabled && window.scrollY > threshold);
}

function ensureFab() {
  if (fab) return;
  fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'fab-top';
  fab.setAttribute('aria-label', '回到最上方');
  fab.innerHTML = icon('arrowUp', { size: 22 });
  fab.hidden = true;
  fab.addEventListener('click', () => {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
    document.querySelector('.page-title')?.focus({ preventScroll: true });
  });
  document.body.append(fab);
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}

export function setBackToTop(on, px = window.innerHeight) {
  ensureFab();
  enabled = on;
  threshold = px;
  update();
}

/** 換頁時呼叫，重置為關閉；想要的頁面會在自己的 render 裡再次開啟 */
export function resetBackToTop() {
  ensureFab();
  enabled = false;
  update();
}
