// ds-sense 產出 — 進入點：路由與全域外框（shell）互動
import { route, fallback, start, currentRoute } from './core/router.js';
import { $, $$, on, html, toast } from './core/dom.js';
import { store } from './core/store.js';
import { renderExplore } from './views/explore.js?v=20261015-2';
import { renderWorkbench } from './views/workbench.js?v=20261015-2';
import { renderCreate } from './views/create.js';
import { renderAnalysis, renderSources, renderArticle } from './views/analysis.js';
import { renderPocPanel } from './views/poc-panel.js';
import { renderOpview, renderGuide } from './views/pages.js';
import { pageHead, errorBlock } from './views/ui.js';
import { track } from './core/telemetry.js';
import { resetBackToTop } from './core/fab.js';

const root = $('#view');
$('#feedback-toggle').addEventListener('click', () => toast('意見回饋功能尚未串接。'));
$('#notifications-toggle').addEventListener('click', () => toast('目前沒有通知。'));
let lastPattern = null;
let lastPath = null;

function scrollPageToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  root.querySelectorAll('.explore__scroll, .explore__history').forEach(el => {
    el.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  });
}

const withShell = (section, fn) => async (ctx) => {
  const enteringPage = lastPath !== ctx.path;
  lastPath = ctx.path;
  const fromPattern = lastPattern;
  lastPattern = currentRoute()?.pattern;
  setActiveNav(section);
  closeMobileNav();
  if (section === 'explore') setSidebarCollapsed(true);
  resetBackToTop();   // 每次換頁先關閉，避免上一頁開啟狀態與本頁的事件順序競態；頁面自己決定要不要重新開啟
  document.body.dataset.section = section;
  if (section === 'create' && fromPattern !== '/create/:step') track('analysis_create_started', { via: 'route' });
  await fn(ctx, fromPattern);
  updateTitle();
  if (enteringPage) scrollPageToTop();
};

route('/', withShell('work', () => renderWorkbench(root, { restoreScroll: false })));
route('/create/:step', withShell('create', (ctx) => renderCreate(root, ctx)));
route('/analysis/:id', withShell('work', (ctx) => renderAnalysis(root, ctx)));
route('/analysis/:id/sources', withShell('work', (ctx) => renderSources(root, ctx)));
route('/analysis/:id/articles/:aid', withShell('work', (ctx) => renderArticle(root, ctx)));
route('/poc', withShell('poc', () => renderPocPanel(root)));
route('/opview', withShell('opview', () => renderOpview(root)));
route('/explore', withShell('explore', () => renderExplore(root)));
route('/guide', withShell('guide', (ctx) => renderGuide(root, ctx)));
fallback(withShell('none', () => {
  root.innerHTML = html`<div class="view">${pageHead({ title: '找不到這個頁面', desc: '網址可能有誤。', crumbs: [{ label: '社群口碑分析', href: '#/' }, { label: '找不到頁面' }] })}
    ${errorBlock({ title: '這個頁面不存在', body: '請回到社群口碑分析，從清單重新進入。', actions: html`<a class="btn btn--secondary" href="#/">回到社群口碑分析</a>` })}</div>`;
  $('.page-title', root)?.focus();
}));

function updateTitle() {
  const h1 = $('.page-title', root);
  document.title = `Clue - ${h1 ? `${h1.dataset.docTitle || h1.textContent.trim()} · ` : ''}POC`;
  // 換頁後把焦點放在標題，螢幕閱讀器會讀出新頁面
  if (h1 && document.activeElement === document.body) h1.focus({ preventScroll: true });
}

function setActiveNav(section) {
  $$('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === section || (section === 'create' && a.dataset.nav === 'work');
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function renderRecent() {
  const list = $('#recent-list');
  const items = store.recent;
  $('#recent-block').hidden = items.length === 0;
  list.innerHTML = html`${items.map((r) => html`<li><a class="main-nav__recent" href="#/analysis/${r.id}">${r.name}</a></li>`)}`;
}
document.addEventListener('recent-changed', renderRecent);

// 行動版選單：在 header 下方展開（推移內容，不做浮動面板）
const menuBtn = $('#menu-toggle');
menuBtn.addEventListener('click', () => {
  const open = menuBtn.getAttribute('aria-expanded') !== 'true';
  menuBtn.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('nav-open', open);
  if (open) $('#main-nav a')?.focus();
});
function closeMobileNav() {
  menuBtn.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('nav-open');
}

// 桌機側欄：縮成只保留展開按鈕的窄欄。
const sidebarBtn = $('#sidebar-toggle');
const sidebar = $('#main-nav');
// Re-selecting the current section does not trigger hashchange.
sidebar.addEventListener('click', e => {
  const link = e.target.closest('a[data-nav]');
  if (link && link.getAttribute('href') === (location.hash || '#/')) {
    closeMobileNav();
    scrollPageToTop();
  }
});
function toggleSidebar() {
  setSidebarCollapsed(!document.body.classList.contains('nav-collapsed'));
}
function setSidebarCollapsed(collapsed) {
  document.body.classList.toggle('nav-collapsed', collapsed);
  const label = collapsed ? '展開側邊選單' : '收合側邊選單';
  sidebarBtn.setAttribute('aria-expanded', String(!collapsed));
  sidebarBtn.setAttribute('aria-label', label);
  sidebarBtn.title = label;
}
sidebarBtn.addEventListener('click', toggleSidebar);
sidebar.addEventListener('click', (e) => {
  if (window.innerWidth < 1024 || e.target.closest('a, button, input, select, textarea')) return;
  toggleSidebar();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('nav-open')) { closeMobileNav(); menuBtn.focus(); }
});

// 工具切換 lightbox（原生 <dialog>：焦點圈限、Esc 關閉、關閉後焦點回到觸發按鈕）
const switcher = $('#app-switcher');
const switchBtn = $('#app-switch-toggle');
switchBtn.addEventListener('click', () => {
  closeMobileNav();
  switcher.showModal();
  switchBtn.setAttribute('aria-expanded', 'true');
  $('.app-switcher__item[aria-current="true"]', switcher).focus();
});
switcher.addEventListener('close', () => switchBtn.setAttribute('aria-expanded', 'false'));
// 點背景（dialog 本體外）關閉
switcher.addEventListener('click', (e) => { if (e.target === switcher) switcher.close(); });
on(switcher, 'click', '[data-action="close-switcher"]', () => switcher.close());

// 其他 dentsu 工具：POC 不連結，給出明確回饋而不是無反應
on(document, 'click', '[data-app]', (e, el) => {
  if (el.getAttribute('aria-current') === 'true') { if (switcher.open) switcher.close(); return; }
  if (switcher.open) switcher.close();
  toast(`POC 未連結「${el.dataset.app}」，正式版會切換到該工具。`);
});

renderRecent();
start();
