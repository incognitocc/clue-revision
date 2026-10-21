// ds-sense 產出 — A. 社群口碑分析
import { html, raw, on, $, debounce, fmtDateTime, announce, toast } from '../core/dom.js';
import { store, DEFAULT_LIST } from '../core/store.js';
import { listAnalyses, ownerName, setPinned, deleteAnalysis } from '../services/mock-service.js';
import { navigate } from '../core/router.js';
import { setBackToTop } from '../core/fab.js';
import { openShareDrawer } from './share-drawer.js';
import { track } from '../core/telemetry.js';
import { statusBadge, spinner, STATUS } from './ui.js';
import { icon } from './icons.js';


// 首頁 Hero（入口儀式：大標＋副標＋圓形 + CTA）。位於內容容器之外，才能撐滿整個內容欄寬。
const heroHtml = () => html`<section class="hero" aria-labelledby="hero-title">
  <h1 class="hero__title page-title" id="hero-title" lang="en" tabindex="-1" data-doc-title="社群口碑分析">Every Conversation Holds a Clue</h1>
  <div class="hero__sub">
    <p>Clue 社群口碑分析工具<br>上傳從 OpView、Keypo、QSearch 取得的社群貼文，系統會同時以兩種方法分析：AI 閱讀貼文歸納洞察，LDA 主題模型（非生成式 AI）依用詞相似度將貼文分群，兩者互相對照，讓結論更有依據。</p>
    <p class="hero__intro-action">在這裡建立新的分析，或繼續查看你的分析與同事分享的成果</p>
  </div>
  <a class="hero__cta" href="#/create/1" data-action="create"><span class="hero__plus" aria-hidden="true">${raw(icon('plusBold', { size: 24 }))}</span><span class="hero__cta-label">創建新檔</span></a>
</section>`;

export async function renderWorkbench(root, { restoreScroll = true } = {}) {
  closeMenu();
  const s = store.list;
  const view = document.createElement('div');
  view.className = 'view view--work';
  view.innerHTML = html`
    <div class="tabs tabs--list" role="tablist" aria-label="分析清單">
      ${tabBtn('mine', '我的分析', s.tab)}
      ${tabBtn('shared', '與我分享', s.tab)}
    </div>
    <section class="zone zone--filters" aria-label="篩選分析" data-zone="filters">
      <div class="filters" id="list-filters">
        <div class="field field--search">
          <label class="field__label" for="f-q">搜尋</label>
          <div class="input-wrap">
            ${raw(icon('search', { size: 16 }))}
            <input id="f-q" class="input" type="search" placeholder="專案名稱、品牌或客戶" value="${s.q}" autocomplete="off">
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="f-status">狀態</label>
          <select id="f-status" class="select">
            <option value="all" ${s.status === 'all' ? 'selected' : ''}>全部狀態</option>
            ${Object.entries(STATUS).map(([k, v]) => html`<option value="${k}" ${s.status === k ? 'selected' : ''}>${v.label}</option>`)}
          </select>
        </div>
        <div class="field">
          <label class="field__label" for="f-sort">排序</label>
          <select id="f-sort" class="select">
            ${[['updated-desc', '更新時間：新到舊'], ['updated-asc', '更新時間：舊到新'], ['name-asc', '名稱：A → Z'], ['name-desc', '名稱：Z → A']]
              .map(([v, l]) => html`<option value="${v}" ${s.sort === v ? 'selected' : ''}>${l}</option>`)}
          </select>
        </div>
      </div>
    </section>
    <section class="zone zone--data" aria-label="分析清單" id="list-panel" role="tabpanel" aria-labelledby="tab-${s.tab}" data-zone="data">
      ${spinner('正在載入分析…')}
    </section>`;
  const hero = document.createElement('div');
  hero.innerHTML = heroHtml();
  root.replaceChildren(hero.firstElementChild, view);

  let rowsById = new Map();
  const refresh = async ({ announceCount = false } = {}) => {
    const st = store.list;
    const { rows, totalInTab } = await listAnalyses(st);
    // 若期間已換頁面就放棄
    if (!view.isConnected) return;
    rowsById = new Map(rows.map((r) => [r.id, r]));
    renderHead(view, st, totalInTab);
    renderData(view, st, rows, totalInTab);
    if (announceCount) announce(`找到 ${rows.length} 筆分析`);
  };

  await refresh();
  setBackToTop(true, 300);   // 清單捲動超過 300px 就出現「回到最上方」
  if (restoreScroll && s.scrollY) requestAnimationFrame(() => window.scrollTo(0, s.scrollY));
  else window.scrollTo(0, 0);

  // ── 事件 ──
  const onSearch = debounce(() => { store.setList({ q: $('#f-q', view).value, page: 1 }); refresh({ announceCount: true }); }, 250);
  $('#f-q', view).addEventListener('input', onSearch);
  $('#f-status', view).addEventListener('change', (e) => { store.setList({ status: e.target.value, page: 1 }); refresh({ announceCount: true }); });
  $('#f-sort', view).addEventListener('change', (e) => { store.setList({ sort: e.target.value }); syncSortSelect(view); refresh(); });

  on(view, 'click', '[role="tab"]', (e, el) => selectTab(el.dataset.tab));
  on(view, 'keydown', '[role="tab"]', (e, el) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const tabs = [...view.querySelectorAll('[role="tab"]')];
    const i = tabs.indexOf(el);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus();
    selectTab(tabs[next].dataset.tab);
  });
  function selectTab(tab) {
    if (store.list.tab === tab) return;
    store.setList({ tab, page: 1, scrollY: 0 });
    view.querySelectorAll('[role="tab"]').forEach((t) => {
      const sel = t.dataset.tab === tab;
      t.setAttribute('aria-selected', sel);
      t.tabIndex = sel ? 0 : -1;
    });
    $('#list-panel', view).setAttribute('aria-labelledby', `tab-${tab}`);
    refresh();
  }

  on(view, 'click', '[data-sort-col]', (e, el) => {
    const col = el.dataset.sortCol;
    const [field, dir] = store.list.sort.split('-');
    const next = field === col ? `${col}-${dir === 'asc' ? 'desc' : 'asc'}` : `${col}-${col === 'name' ? 'asc' : 'desc'}`;
    store.setList({ sort: next });
    syncSortSelect(view);
    refresh();
  });
  on(view, 'click', '[data-action="clear-filters"]', () => {
    store.resetListFilters();
    $('#f-q', view).value = '';
    $('#f-status', view).value = 'all';
    refresh({ announceCount: true });
    $('#f-q', view).focus();
  });
  on(view, 'click', '[data-action="go-mine"]', () => selectTab('mine'));
  // 離開清單前記住捲動位置
  on(view, 'click', 'a[data-row-link]', () => store.setList({ scrollY: window.scrollY }));
  $('.hero__cta', root).addEventListener('click', () => store.setList({ scrollY: window.scrollY }));
  // ── 專案列「⋯」次選單（置頂／分享／刪除）──
  const reopenFocus = (id) => $(`[data-action="row-menu"][data-id="${id}"]`, view)?.focus();
  const runAction = async (key, an) => {
    if (key === 'pin') {
      const next = !an.pinned;
      await setPinned(an.id, next);
      track('project_pin_toggled', { analysisId: an.id, result: next ? 'pinned' : 'unpinned' });
      await refresh();
  setBackToTop(true, 300);   // 清單捲動超過 300px 就出現「回到最上方」
      toast(next ? '已置頂「' + an.name.slice(0, 24) + '」' : '已取消置頂');
      announce(next ? '已置頂' : '已取消置頂');
      reopenFocus(an.id);
    } else if (key === 'share') {
      track('analysis_share_opened', { analysisId: an.id, via: 'list-menu' });
      openShareDrawer(an, { onShared: () => refresh() });
    } else if (key === 'delete') {
      await confirmDelete(an, async () => {
        await deleteAnalysis(an.id);
        store.dropRecentItem(an.id);
        track('analysis_deleted', { analysisId: an.id });
        await refresh();
  setBackToTop(true, 300);   // 清單捲動超過 300px 就出現「回到最上方」
        toast('已刪除「' + an.name.slice(0, 24) + '」');
        ($('.row-link', view) || $('.hero__cta', root))?.focus();
      }, () => reopenFocus(an.id));
    }
  };
  on(view, 'click', '[data-action="row-menu"]', (e, el) => {
    e.stopPropagation();
    if (menuTrigger === el) { closeMenu(); return; }
    const an = rowsById.get(el.dataset.id);
    if (an) openMenu(el, an, runAction);
  });
  on(view, 'keydown', '[data-action="row-menu"]', (e, el) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const an = rowsById.get(el.dataset.id);
    if (an) openMenu(el, an, runAction, e.key === 'ArrowUp' ? 'last' : 'first');
  });
  on(view, 'click', 'tr[data-href]', (e, el) => {
    if (e.target.closest('a, button')) return;
    store.setList({ scrollY: window.scrollY });
    location.hash = el.dataset.href;
  });
}

function tabBtn(id, label, active) {
  const sel = id === active;
  return html`<button type="button" role="tab" id="tab-${id}" data-tab="${id}" aria-selected="${sel ? "true" : "false"}" aria-controls="list-panel" tabindex="${sel ? 0 : -1}" class="tabs__tab">${label}</button>`;
}

function syncSortSelect(view) { $('#f-sort', view).value = store.list.sort; }

function renderHead(view, st, totalInTab) {
  // 空清單時收起篩選區（主行動由 Hero 的「創建新檔」承擔）
  $('[data-zone="filters"] .filters', view).hidden = totalInTab === 0;
}

function renderData(view, st, rows, totalInTab) {
  const zone = $('[data-zone="data"]', view);
  if (totalInTab === 0) {
    zone.innerHTML = st.tab === 'mine'
      ? html`<div class="empty-hero">
          <h2 class="empty-hero__title">還沒有任何分析</h2>
          <p class="empty-hero__body">匯入一批社群文章，看出大家主要在討論哪些主題，並回到原始文章查核。沒有檔案也能先用範本資料走一遍。點上方「創建新檔」開始。</p>
        </div>`
      : html`<div class="empty-hero empty-hero--quiet">
          <h2 class="empty-hero__title">目前沒有人與你分享分析</h2>
          <p class="empty-hero__body">同事分享分析給你之後，會出現在這裡，並標示你的檢視權限。</p>
          <button type="button" class="btn btn--secondary" data-action="go-mine">查看我的分析</button>
        </div>`;
    return;
  }
  if (rows.length === 0) {
    const parts = [st.q && `「${st.q}」`, st.status !== 'all' && `狀態為「${STATUS[st.status].label}」`].filter(Boolean).join('、');
    zone.innerHTML = html`<div class="empty-hero empty-hero--quiet">
      <h2 class="empty-hero__title">沒有符合條件的分析</h2>
      <p class="empty-hero__body">在「${st.tab === 'mine' ? '我的分析' : '與我分享'}」中找不到 ${parts} 的結果。試試其他關鍵字，或清除條件查看全部 ${totalInTab} 筆。</p>
      <button type="button" class="btn btn--secondary" data-action="clear-filters">清除搜尋與篩選</button>
    </div>`;
    return;
  }

  const slice = rows;   // 捲動清單：不分頁
  const [sf, sd] = st.sort.split('-');
  const ariaSort = (col) => (sf === col ? (sd === 'asc' ? 'ascending' : 'descending') : 'none');
  const sortHead = (col, label) => html`<th scope="col" aria-sort="${ariaSort(col)}">
    <button type="button" class="th-sort" data-sort-col="${col}">${label}<span class="th-sort__arrow" aria-hidden="true">${sf === col ? (sd === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>`;

  zone.innerHTML = html`
    <p class="list-count" aria-live="polite">共 ${rows.length} 筆${rows.length !== totalInTab ? `（全部 ${totalInTab} 筆）` : ''}${rows.some((r) => r.pinned) ? ' · 已置頂的專案固定在最上方' : ''}</p>
    <div class="table-wrap">
      <table class="table table--list">
        <caption class="sr-only">${st.tab === 'mine' ? '我的分析' : '與我分享'}清單</caption>
        <thead><tr>
          ${sortHead('name', '專案名稱')}
          <th scope="col">狀態</th>
          ${sortHead('updated', '更新時間')}
          <th scope="col">建立者</th>
          <th scope="col" class="col-actions"><span class="sr-only">更多操作</span></th>
        </tr></thead>
        <tbody>
          ${slice.map((an) => html`<tr data-href="#/analysis/${an.id}">
            <td class="cell-name" data-label="專案名稱">
              <a href="#/analysis/${an.id}" data-row-link class="row-link">${an.name}</a>
              <span class="cell-sub">${an.pinned ? html`<span class="role-chip role-chip--pin">${raw(icon('pin', { size: 12 }))}已置頂</span> · ` : ''}${an.brand || an.client}${an.access === 'viewer' ? html` · <span class="role-chip">${raw(icon('lock', { size: 12 }))}唯讀</span>` : ''}</span>
            </td>
            <td data-label="狀態">${statusBadge(an.status)}</td>
            <td data-label="更新時間" class="num">${fmtDateTime(an.updatedAt)}</td>
            <td data-label="建立者">${ownerName(an)}</td>
            <td class="cell-actions"><button type="button" class="icon-btn" data-action="row-menu" data-id="${an.id}" aria-haspopup="menu" aria-expanded="false" aria-label="更多操作：${an.name}">${raw(icon('more', { size: 20 }))}</button></td>
          </tr>`)}
        </tbody>
      </table>
    </div>`;
}

export { DEFAULT_LIST };

// ───────────────────────── 專案列次選單（WAI-ARIA menu button） ─────────────────────────

let menuEl = null;
let menuTrigger = null;
let menuRun = null;
let menuAn = null;
let menuOpenedAt = 0;

function menuItems(an) {
  const items = [{ key: 'pin', label: an.pinned ? '取消置頂' : '置頂', ico: an.pinned ? 'unpin' : 'pin' }];
  if (an.access === 'owner') {
    items.push({ key: 'share', label: '分享', ico: 'share', disabled: an.status !== 'completed', hint: '完成後才能分享' });
    items.push({ sep: true });
    items.push({ key: 'delete', label: '刪除', ico: 'delete', danger: true });
  }
  return items;
}

function ensureMenu() {
  if (menuEl) return menuEl;
  menuEl = document.createElement('div');
  menuEl.className = 'menu';
  menuEl.id = 'row-menu';
  menuEl.setAttribute('role', 'menu');
  menuEl.hidden = true;
  document.body.append(menuEl);
  menuEl.addEventListener('click', (e) => {
    const item = e.target.closest('[role="menuitem"]');
    if (!item || item.getAttribute('aria-disabled') === 'true') return;
    const run = menuRun; const an = menuAn; const trigger = menuTrigger;
    closeMenu({ restoreFocus: false });
    run?.(item.dataset.key, an, trigger);
  });
  menuEl.addEventListener('keydown', (e) => {
    const items = [...menuEl.querySelectorAll('[role="menuitem"]')];
    const i = items.indexOf(document.activeElement);
    const go = { ArrowDown: (i + 1) % items.length, ArrowUp: (i - 1 + items.length) % items.length, Home: 0, End: items.length - 1 }[e.key];
    if (go != null) { e.preventDefault(); items[go].focus(); return; }
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
    if (e.key === 'Tab') closeMenu({ restoreFocus: false });
  });
  document.addEventListener('pointerdown', (e) => {
    if (!menuEl.hidden && !menuEl.contains(e.target) && !e.target.closest('[data-action="row-menu"]')) closeMenu({ restoreFocus: false });
  }, true);
  // 捲動／縮放時關閉（固定定位的選單不會跟著按鈕移動）；剛開啟的 250ms 內忽略，避免瀏覽器為了露出按鈕而觸發的捲動把選單關掉
  ['scroll', 'resize', 'hashchange'].forEach((t) => window.addEventListener(t, () => { if (t === 'hashchange' || Date.now() - menuOpenedAt > 250) closeMenu({ restoreFocus: false }); }, true));
  return menuEl;
}

function openMenu(trigger, an, run, focus = 'first') {
  closeMenu({ restoreFocus: false });
  const el = ensureMenu();
  menuTrigger = trigger; menuRun = run; menuAn = an;
  el.setAttribute('aria-label', `專案操作：${an.name}`);
  el.innerHTML = menuItems(an).map((it) => it.sep ? '<div class="menu__sep" role="separator"></div>'
    : html`<button type="button" role="menuitem" class="menu__item ${it.danger ? 'is-danger' : ''}" data-key="${it.key}" tabindex="-1" ${it.disabled ? raw('aria-disabled="true"') : ''}>
        ${raw(icon(it.ico, { size: 16 }))}<span class="menu__text"><span>${it.label}</span>${it.disabled ? html`<span class="menu__hint">${it.hint}</span>` : ''}</span></button>`).join('');
  el.hidden = false;
  menuOpenedAt = Date.now();
  trigger.setAttribute('aria-expanded', 'true');
  // 定位：預設在按鈕下方、右緣對齊；空間不足時往上開
  const r = trigger.getBoundingClientRect();
  const w = el.offsetWidth; const h = el.offsetHeight;
  const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
  const top = r.bottom + 4 + h > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4;
  el.style.left = `${left}px`; el.style.top = `${top}px`;
  const items = el.querySelectorAll('[role="menuitem"]');
  (focus === 'last' ? items[items.length - 1] : items[0]).focus({ preventScroll: true });
}

function closeMenu({ restoreFocus = true } = {}) {
  if (!menuEl || menuEl.hidden) return;
  menuEl.hidden = true;
  menuTrigger?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) menuTrigger?.focus({ preventScroll: true });
  menuTrigger = null;
}

// 刪除確認（不可逆：必須確認；原生 <dialog> 提供焦點圈限與 Esc）
function confirmDelete(an, doDelete, onCancel) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'confirm-dialog';
    dlg.setAttribute('aria-labelledby', 'cd-title');
    dlg.setAttribute('aria-describedby', 'cd-desc');
    dlg.innerHTML = html`
      <h2 class="confirm-dialog__title" id="cd-title">刪除專案？</h2>
      <p id="cd-desc" class="break">「${an.name}」的結果與分享對象都會移除，無法復原。</p>
      <p class="field__error" id="cd-error" role="alert" hidden></p>
      <div class="confirm-dialog__actions">
        <button type="button" class="btn btn--secondary" data-cd="cancel">取消</button>
        <button type="button" class="btn btn--danger" data-cd="ok">確認刪除</button>
      </div>`;
    document.body.append(dlg);
    let busy = false; let done = false;
    const finish = (deleted) => { if (done) return; done = true; dlg.remove(); if (!deleted) onCancel?.(); resolve(deleted); };
    dlg.addEventListener('cancel', (e) => { if (busy) e.preventDefault(); });
    dlg.addEventListener('close', () => finish(false));
    dlg.querySelector('[data-cd="cancel"]').addEventListener('click', () => { if (!busy) dlg.close(); });
    dlg.querySelector('[data-cd="ok"]').addEventListener('click', async (e) => {
      if (busy) return;                       // 防重複送出
      busy = true;
      e.currentTarget.disabled = true;
      e.currentTarget.textContent = '正在刪除…';
      try {
        await doDelete();
        done = true; dlg.close(); dlg.remove(); resolve(true);
      } catch (err) {
        busy = false;
        e.currentTarget.disabled = false;
        e.currentTarget.textContent = '確認刪除';
        const er = dlg.querySelector('#cd-error');
        er.hidden = false; er.textContent = '刪除失敗：' + err.message;
      }
    });
    dlg.showModal();
    dlg.querySelector('[data-cd="cancel"]').focus();
  });
}
