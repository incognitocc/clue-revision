// ds-sense 產出 — OpView 社群資料索取（專屬頁面）與使用指南（FAQ）
import { html, raw, on, $, $$, debounce, announce, fmtDateTime, toast } from '../core/dom.js';
import { href } from '../core/router.js';
import { pageHead } from './ui.js';
import { icon } from './icons.js';
import { track } from '../core/telemetry.js';
import { FAQ, FAQ_CATEGORIES } from '../data/faq.js';
import { setBackToTop } from '../core/fab.js';
import { countRequests, listRequests, addRequest, setRequestPinned, deleteRequest, getArticles } from '../services/mock-service.js';
import { openRowMenu, closeRowMenu, isMenuOpenFor, confirmDelete } from './row-menu.js';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ───────────────────────── OpView 社群資料索取 ─────────────────────────

// 來源選項為 POC 示範；正式清單待 OpView 確認
const SOURCES = [
  { key: 'forum', label: '討論區', options: ['全部討論區', 'Ptt', 'Dcard', '其他討論區'] },
  { key: 'social', label: '社群網站', options: ['全部社群網站', 'Facebook', 'Instagram', 'YouTube', 'Plurk', '其他社群網站'] },
  { key: 'news', label: '新聞', options: ['全部新聞網站', '入口網站新聞', '其他新聞網站'] },
  { key: 'qa', label: '問答網站' },
  { key: 'blog', label: '部落格' },
];

const fmtRange = (a, b) => `${a.replaceAll('-', '/')} – ${b.replaceAll('-', '/')}`;
const blank = () => ({ client: '', keywords: '', from: today(), to: today(), sources: {}, advanced: '' });
let formState = blank();

let opTab = 'new';       // 'new'｜'list'
let reqCount = 0;
let reqList = { q: '', sort: 'created-desc' };
let docAbort = null;

const opTabBtn = (id, label) => html`<button type="button" role="tab" id="op-tab-${id}" data-op-tab="${id}" aria-selected="${opTab === id ? 'true' : 'false'}" aria-controls="op-panel" tabindex="${opTab === id ? 0 : -1}" class="tabs__tab">${label}</button>`;
// 沒有任何已索取資料時，整組 Tab 不顯示
const opTabs = () => (reqCount > 0 ? html`<div class="tabs tabs--list" role="tablist" aria-label="OpView 社群資料索取">${opTabBtn('new', '新增索取資料')}${opTabBtn('list', `已索取資料 (${reqCount})`)}</div>` : '');

export async function renderOpview(root) {
  const view = document.createElement('div');
  view.className = 'view view--opview';
  root.replaceChildren(view);
  opTab = 'new';
  reqCount = await countRequests();
  if (!view.isConnected) return;
  const switchTab = (tab) => {
    if (opTab === tab) return;
    opTab = tab;
    closeRowMenu({ restoreFocus: false });
    (tab === 'list' ? showList : showForm)(view);
    $(`#op-tab-${tab}`, view)?.focus({ preventScroll: true });
  };
  on(view, 'click', '[data-op-tab]', (e, el) => switchTab(el.dataset.opTab));
  on(view, 'keydown', '[data-op-tab]', (e, el) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const tabs = [...view.querySelectorAll('[data-op-tab]')];
    const i = tabs.indexOf(el);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    switchTab(tabs[next].dataset.opTab);
  });
  showForm(view);
}

function showForm(view) {
  const s = formState;
  view.innerHTML = html`
    ${pageHead({
      title: 'OpView 社群資料索取',
      desc: '填寫條件向 OpView 索取社群資料；取得匯出檔後，再到「創建新檔」的資料步驟使用。',
      crumbs: [{ label: '社群口碑分析', href: '#/' }, { label: 'OpView 社群資料索取' }],
    })}
    ${opTabs()}
    <div id="op-panel" role="tabpanel" aria-labelledby="op-tab-new">
    <form class="form-card" id="opview-form" novalidate>
      <div class="field">
        <label class="field__label" for="o-client">客戶名稱 <span class="req" aria-hidden="true">*</span><span class="sr-only">（必填）</span></label>
        <input id="o-client" class="input" type="text" maxlength="60" value="${s.client}" autocomplete="off" aria-describedby="e-client">
        <p class="field__error" id="e-client" hidden></p>
      </div>

      <div class="field">
        <label class="field__label" for="o-keywords">主題關鍵字 <span class="req" aria-hidden="true">*</span><span class="sr-only">（必填）</span></label>
        <textarea id="o-keywords" class="textarea" rows="4" maxlength="1000" placeholder="請用 | 分隔關鍵字　例：(全聯|PXPay)&(支付|APP)|全支付!贈!送!活動" aria-describedby="h-keywords e-keywords">${s.keywords}</textarea>
        <p class="field__hint" id="h-keywords">「|」＝或、「&」＝且、「!」＝排除，可用括號分組。</p>
        <p class="field__error" id="e-keywords" hidden></p>
      </div>

      <div class="field range-wrap" id="range-wrap">
        <span class="field__label" id="range-label">查詢區間 <span class="req" aria-hidden="true">*</span><span class="sr-only">（必填）</span></span>
        <button type="button" class="input range-field" id="o-range" aria-haspopup="dialog" aria-expanded="false" aria-labelledby="range-label o-range" aria-describedby="e-range">
          <span class="range-field__text num" id="o-range-text">${fmtRange(s.from, s.to)}</span>
          ${raw(icon('calendar', { size: 20 }))}
        </button>
        <div class="datepicker" id="range-pop" role="dialog" aria-label="選擇查詢區間" hidden></div>
        <p class="field__error" id="e-range" hidden></p>
      </div>

      <fieldset class="fieldset fieldset--tight" aria-describedby="h-sources e-sources">
        <legend class="field__label">主題來源 <span class="req" aria-hidden="true">*</span><span class="sr-only">（必填，至少選 1 項）</span></legend>
        <p class="field__hint" id="h-sources">至少選 1 項；勾選後可再指定平台。</p>
        <div class="source-grid">
          ${SOURCES.map((src) => {
            const v = s.sources[src.key];
            return html`<div class="source-row">
              <label class="check"><input type="checkbox" data-source="${src.key}" ${v ? 'checked' : ''}><span>${src.label}</span></label>
              ${src.options ? html`<select class="select" data-source-opt="${src.key}" aria-label="${src.label}：指定平台" ${v ? '' : 'disabled hidden'}>
                ${src.options.map((o) => html`<option ${v === o ? 'selected' : ''}>${o}</option>`)}</select>` : ''}
            </div>`;
          })}
        </div>
        <p class="field__error" id="e-sources" hidden></p>
      </fieldset>

      <div class="field">
        <label class="field__label" for="o-adv">進階設定 <span class="optional">選填</span></label>
        <textarea id="o-adv" class="textarea" rows="4" maxlength="1000" placeholder="請填寫其他關鍵字設定條件">${s.advanced}</textarea>
      </div>

      <div class="form-card__foot">
        <button type="button" class="btn btn--secondary" data-action="reset">重新輸入</button>
        <button type="submit" class="btn btn--primary">確認送出</button>
      </div>
    </form>
    </div>`;
  setBackToTop(false);
  $('.page-title', view).focus({ preventScroll: true });

  const panel = $('#op-panel', view);
  const form = $('#opview-form', view);
  const err = (id, msg) => {
    const el = $(`#e-${id}`, view);
    el.hidden = !msg;
    el.innerHTML = msg ? `${icon('alert', { size: 14 })}<span></span>` : '';
    if (msg) el.lastChild.textContent = msg;
  };
  const read = () => {
    const sources = {};
    $$('[data-source]', view).forEach((c) => {
      if (c.checked) sources[c.dataset.source] = $(`[data-source-opt="${c.dataset.source}"]`, view)?.value ?? '已選取';
    });
    formState = { client: $('#o-client', view).value, keywords: $('#o-keywords', view).value, from: formState.from, to: formState.to, sources, advanced: $('#o-adv', view).value };
    return formState;
  };

  on(panel, 'change', '[data-source]', (e, el) => {
    const sel = $(`[data-source-opt="${el.dataset.source}"]`, view);
    if (sel) { sel.disabled = !el.checked; sel.hidden = !el.checked; }
    err('sources', '');
  });
  $('#o-client', view).addEventListener('input', () => err('client', ''));
  $('#o-keywords', view).addEventListener('input', () => err('keywords', ''));

  // ── 日期區間選擇器：先點起日、再點迄日（若迄日早於起日自動對調），選完自動關閉 ──
  const pop = $('#range-pop', view);
  const field = $('#o-range', view);
  const pk = { y: 0, m: 0, start: null, end: null, picking: false, focus: null };
  const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return { y, m: m - 1, d }; };
  const maxDate = today();
  const renderCal = () => {
    const first = new Date(pk.y, pk.m, 1).getDay();
    const days = new Date(pk.y, pk.m + 1, 0).getDate();
    const lo = pk.start && pk.end ? (pk.start < pk.end ? pk.start : pk.end) : pk.start;
    const hi = pk.start && pk.end ? (pk.start < pk.end ? pk.end : pk.start) : pk.start;
    const cells = [];
    for (let i = 0; i < first; i++) cells.push('<span class="datepicker__blank"></span>');
    for (let d = 1; d <= days; d++) {
      const v = iso(pk.y, pk.m, d);
      const disabled = v > maxDate;
      const isEdge = v === lo || v === hi;
      const inRange = lo && hi && v > lo && v < hi;
      cells.push(`<button type="button" class="datepicker__day${isEdge ? ' is-edge' : ''}${inRange ? ' is-range' : ''}${v === maxDate ? ' is-today' : ''}" data-date="${v}" tabindex="${v === pk.focus ? 0 : -1}" ${disabled ? 'aria-disabled="true"' : ''} aria-pressed="${isEdge}" aria-label="${pk.y} 年 ${pk.m + 1} 月 ${d} 日${v === maxDate ? '（今天）' : ''}">${d}</button>`);
    }
    const nextDisabled = iso(pk.y, pk.m + 1, 1) > maxDate;
    pop.innerHTML = `<div class="datepicker__head">
        <button type="button" class="icon-btn" data-cal="prev" aria-label="上個月">${icon('chevronRight', { size: 18 }).replace('<svg', '<svg style="transform:rotate(180deg)"')}</button>
        <span class="datepicker__title" aria-live="polite">${pk.y} 年 ${pk.m + 1} 月</span>
        <button type="button" class="icon-btn" data-cal="next" aria-label="下個月" ${nextDisabled ? 'aria-disabled="true"' : ''}>${icon('chevronRight', { size: 18 })}</button>
      </div>
      <p class="datepicker__hint" aria-live="polite">${pk.picking ? '請選擇結束日期' : '請選擇開始日期'}</p>
      <div class="datepicker__week" aria-hidden="true">${['日', '一', '二', '三', '四', '五', '六'].map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="datepicker__grid" role="grid">${cells.join('')}</div>`;
  };
  const openPop = () => {
    const t = parse(formState.to || maxDate);
    Object.assign(pk, { y: t.y, m: t.m, start: formState.from, end: formState.to, picking: false, focus: formState.to || maxDate });
    renderCal();
    pop.hidden = false;
    field.setAttribute('aria-expanded', 'true');
    $(`[data-date="${pk.focus}"]`, pop)?.focus();
  };
  const closePop = (focusField = true) => {
    if (pop.hidden) return;
    pop.hidden = true;
    field.setAttribute('aria-expanded', 'false');
    if (focusField) field.focus();
  };
  const moveFocus = (v) => {
    if (v > maxDate) v = maxDate;
    const t = parse(v);
    pk.y = t.y; pk.m = t.m; pk.focus = v;
    renderCal();
    $(`[data-date="${v}"]`, pop)?.focus();
  };
  const pick = (v) => {
    if (v > maxDate) return;
    if (!pk.picking) {
      Object.assign(pk, { start: v, end: null, picking: true, focus: v });
      renderCal();
      $(`[data-date="${v}"]`, pop)?.focus();
      return;
    }
    const [lo, hi] = v < pk.start ? [v, pk.start] : [pk.start, v];
    formState.from = lo; formState.to = hi;
    $('#o-range-text', view).textContent = fmtRange(lo, hi);
    err('range', '');
    announce(`查詢區間 ${fmtRange(lo, hi)}`);
    closePop(true);
  };
  on(panel, 'click', '#o-range', () => (pop.hidden ? openPop() : closePop(false)));
  on(panel, 'click', '.datepicker__day', (e, el) => pick(el.dataset.date));
  on(panel, 'click', '[data-cal]', (e, el) => {
    if (el.getAttribute('aria-disabled') === 'true') return;
    const d = new Date(pk.y, pk.m + (el.dataset.cal === 'next' ? 1 : -1), 1);
    pk.y = d.getFullYear(); pk.m = d.getMonth();
    pk.focus = iso(pk.y, pk.m, 1) > maxDate ? maxDate : iso(pk.y, pk.m, 1);
    renderCal();
    $(`[data-cal="${el.dataset.cal}"]`, pop)?.focus();
  });
  on(panel, 'keydown', '.datepicker__day', (e, el) => {
    const cur = parse(el.dataset.date);
    const shift = (days) => { const d = new Date(cur.y, cur.m, cur.d + days); return iso(d.getFullYear(), d.getMonth(), d.getDate()); };
    const month = (n) => { const d = new Date(cur.y, cur.m + n, Math.min(cur.d, 28)); return iso(d.getFullYear(), d.getMonth(), d.getDate()); };
    const map = { ArrowLeft: () => shift(-1), ArrowRight: () => shift(1), ArrowUp: () => shift(-7), ArrowDown: () => shift(7), PageUp: () => month(-1), PageDown: () => month(1), Home: () => shift(-new Date(cur.y, cur.m, cur.d).getDay()), End: () => shift(6 - new Date(cur.y, cur.m, cur.d).getDay()) };
    if (map[e.key]) { e.preventDefault(); moveFocus(map[e.key]()); }
  });
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { e.preventDefault(); closePop(true); } });
  docAbort?.abort();
  docAbort = new AbortController();
  document.addEventListener('pointerdown', (e) => {
    if (!view.isConnected) return;
    if (!pop.hidden && !e.target.closest('#range-wrap')) closePop(false);
  }, { signal: docAbort.signal });

  on(panel, 'click', '[data-action="reset"]', () => {
    formState = blank();
    showForm(view);
    announce('已清除所有欄位');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = read();
    const errors = [];
    if (!v.client.trim()) errors.push(['client', '請輸入客戶名稱。', '#o-client']);
    if (!v.keywords.trim()) errors.push(['keywords', '請輸入主題關鍵字，用「|」分隔多個關鍵字。', '#o-keywords']);
    if (!v.from || !v.to) errors.push(['range', '請選擇查詢區間的起訖日期。', '#o-range']);
    else if (v.from > v.to) errors.push(['range', '起日不能晚於迄日，請調整查詢區間。', '#o-range']);
    if (!Object.keys(v.sources).length) errors.push(['sources', '請至少選擇 1 個主題來源。', '[data-source]']);
    ['client', 'keywords', 'range', 'sources'].forEach((k) => err(k, errors.find((x) => x[0] === k)?.[1] || ''));
    if (errors.length) { $(errors[0][2], view).focus(); announce(`有 ${errors.length} 個欄位需要修正`); return; }
    track('opview_request_submitted', { result: 'simulated', fileCount: Object.keys(v.sources).length });
    await addRequest(v);
    reqCount = await countRequests();
    showSubmitted(view, v);
  });
}

function showSubmitted(view, v) {
  const src = SOURCES.filter((x) => v.sources[x.key]).map((x) => (x.options ? `${x.label}：${v.sources[x.key]}` : x.label));
  view.innerHTML = html`
    ${pageHead({
      title: 'OpView 社群資料索取',
      desc: '已產生需求摘要。',
      crumbs: [{ label: '社群口碑分析', href: '#/' }, { label: 'OpView 社群資料索取' }],
    })}
    ${opTabs()}
    <div id="op-panel" role="tabpanel" aria-labelledby="op-tab-new">
    <section class="state-panel" aria-labelledby="sub-title">
      <h2 id="sub-title" class="state-panel__title">${raw(icon('check', { size: 20 }))}需求摘要已產生</h2>
      <dl class="summary__list">
        <div><dt>客戶名稱</dt><dd class="break">${v.client}</dd></div>
        <div><dt>主題關鍵字</dt><dd class="break"><code>${v.keywords}</code></dd></div>
        <div><dt>查詢區間</dt><dd class="num">${v.from.replaceAll('-', '/')} – ${v.to.replaceAll('-', '/')}</dd></div>
        <div><dt>主題來源</dt><dd>${src.join('、')}</dd></div>
        <div><dt>進階設定</dt><dd class="break">${v.advanced.trim() || '未填寫'}</dd></div>
      </dl>
      <h3 class="subpanel__title">接下來的流程</h3>
      <ol class="steps-list">
        <li>需求送到 OpView 處理。</li>
        <li>取得匯出的 CSV／XLSX 檔案。</li>
        <li>回到「創建新檔 › 資料」，選擇「上傳本機檔案」使用這份資料。</li>
      </ol>
      <div class="state-block__actions">
        <button type="button" class="btn btn--secondary" data-action="edit">修改條件</button>
        <button type="button" class="btn btn--ghost" data-action="new">新增另一筆索取</button>
        <a class="btn btn--primary" href="#/create/1">前往創建新檔</a>
      </div>
    </section>
    </div>`;
  $('.page-title', view).focus({ preventScroll: true });
  announce('需求摘要已產生');
  on($('#op-panel', view), 'click', '[data-action="edit"]', () => showForm(view));
  on($('#op-panel', view), 'click', '[data-action="new"]', () => { formState = blank(); showForm(view); });
}

// ───────────────────────── 已索取資料（OpView 寄回的檔案清單） ─────────────────────────

const KW_MAX = 10;
const shortKeywords = (t) => { const c = Array.from(t); return c.length > KW_MAX ? `${c.slice(0, KW_MAX).join('')}...` : t; };

async function downloadRequestFile(r) {
  const list = await getArticles();
  const esc = (v) => { const t = String(v ?? ''); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const csv = ['文章ID,標題,內容,來源,發布時間', ...list.map((a) => [a.id, a.title, a.body, a.source, a.publishedAt].map(esc).join(','))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `OpView_${r.client}_${r.createdAt.slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  track('opview_request_downloaded', { requestId: r.id });
  toast(`已下載「${r.client}」的索取資料`);
}

const reqMenuItems = (r) => [
  { key: 'pin', label: r.pinned ? '取消置頂' : '置頂', ico: r.pinned ? 'unpin' : 'pin' },
  { key: 'download', label: '下載檔案', ico: 'download' },
  { sep: true },
  { key: 'delete', label: '刪除', ico: 'delete', danger: true },
];

function showList(view) {
  view.innerHTML = html`
    ${pageHead({
      title: 'OpView 社群資料索取',
      desc: '填寫條件向 OpView 索取社群資料；取得匯出檔後，再到「創建新檔」的資料步驟使用。',
      crumbs: [{ label: '社群口碑分析', href: '#/' }, { label: 'OpView 社群資料索取' }],
    })}
    ${opTabs()}
    <div id="op-panel" role="tabpanel" aria-labelledby="op-tab-list">
      <section class="zone zone--filters" aria-label="篩選已索取資料">
        <div class="filters">
          <div class="field field--search">
            <label class="field__label" for="rq-q">搜尋</label>
            <div class="input-wrap">
              ${raw(icon('search', { size: 16 }))}
              <input id="rq-q" class="input" type="search" placeholder="客戶名稱或主題關鍵字" value="${reqList.q}" autocomplete="off">
            </div>
          </div>
          <div class="field">
            <label class="field__label" for="rq-sort">排序</label>
            <select id="rq-sort" class="select">
              ${[['created-desc', '建檔時間：新到舊'], ['created-asc', '建檔時間：舊到新']].map(([v, l]) => html`<option value="${v}" ${reqList.sort === v ? 'selected' : ''}>${l}</option>`)}
            </select>
          </div>
        </div>
      </section>
      <section class="zone zone--data" id="rq-data" aria-label="已索取資料清單"></section>
    </div>`;
  setBackToTop(true, 300);
  $('.page-title', view).focus({ preventScroll: true });
  const panel = $('#op-panel', view);

  let rowsById = new Map();
  const refresh = async ({ announceCount = false } = {}) => {
    const { rows, total } = await listRequests(reqList);
    if (!view.isConnected || opTab !== 'list') return;
    rowsById = new Map(rows.map((r) => [r.id, r]));
    const zone = $('#rq-data', view);
    if (!rows.length) {
      zone.innerHTML = html`<div class="empty-hero empty-hero--quiet">
        <h2 class="empty-hero__title">沒有符合條件的索取資料</h2>
        <p class="empty-hero__body">找不到「${reqList.q}」的結果。試試其他關鍵字，或清除搜尋查看全部 ${total} 筆。</p>
        <button type="button" class="btn btn--secondary" data-action="rq-clear">清除搜尋</button>
      </div>`;
    } else {
      const desc = reqList.sort === 'created-desc';
      zone.innerHTML = html`
        <p class="list-count" aria-live="polite">共 ${rows.length} 筆${rows.length !== total ? `（全部 ${total} 筆）` : ''}${rows.some((r) => r.pinned) ? ' · 已置頂的資料固定在最上方' : ''}</p>
        <div class="table-wrap">
          <table class="table table--list">
            <caption class="sr-only">已索取資料清單</caption>
            <thead><tr>
              <th scope="col">客戶名稱</th>
              <th scope="col">主題關鍵字</th>
              <th scope="col" aria-sort="${desc ? 'descending' : 'ascending'}"><button type="button" class="th-sort" data-action="rq-sort">建檔時間<span class="th-sort__arrow" aria-hidden="true">${desc ? '↓' : '↑'}</span></button></th>
              <th scope="col">下載資料</th>
              <th scope="col" class="col-actions"><span class="sr-only">更多操作</span></th>
            </tr></thead>
            <tbody>
              ${rows.map((r) => html`<tr>
                <td class="cell-name" data-label="客戶名稱"><span class="row-name">${r.client}</span>${r.pinned ? html`<span class="cell-sub"><span class="role-chip role-chip--pin">${raw(icon('pin', { size: 12 }))}已置頂</span></span>` : ''}</td>
                <td data-label="主題關鍵字"><span title="${r.keywords}">${shortKeywords(r.keywords)}</span></td>
                <td data-label="建檔時間" class="num">${fmtDateTime(r.createdAt)}</td>
                <td data-label="下載資料"><button type="button" class="btn btn--secondary btn--sm" data-action="rq-download" data-id="${r.id}" aria-label="下載資料：${r.client}">${raw(icon('download', { size: 14 }))}下載</button></td>
                <td class="cell-actions"><button type="button" class="icon-btn" data-action="row-menu" data-id="${r.id}" aria-haspopup="menu" aria-expanded="false" aria-label="更多操作：${r.client}">${raw(icon('more', { size: 20 }))}</button></td>
              </tr>`)}
            </tbody>
          </table>
        </div>`;
    }
    if (announceCount) announce(`找到 ${rows.length} 筆索取資料`);
  };
  refresh();

  $('#rq-q', view).addEventListener('input', debounce(() => { reqList.q = $('#rq-q', view).value; refresh({ announceCount: true }); }, 250));
  $('#rq-sort', view).addEventListener('change', (e) => { reqList.sort = e.target.value; refresh(); });
  on(panel, 'click', '[data-action="rq-sort"]', () => {
    reqList.sort = reqList.sort === 'created-desc' ? 'created-asc' : 'created-desc';
    $('#rq-sort', view).value = reqList.sort;
    refresh();
  });
  on(panel, 'click', '[data-action="rq-clear"]', () => { reqList.q = ''; $('#rq-q', view).value = ''; refresh({ announceCount: true }); $('#rq-q', view).focus(); });
  on(panel, 'click', '[data-action="rq-download"]', async (e, el) => {
    const r = rowsById.get(el.dataset.id);
    if (!r) return;
    el.disabled = true;
    try { await downloadRequestFile(r); } finally { el.disabled = false; }
  });

  const reopenFocus = (id) => $(`[data-action="row-menu"][data-id="${id}"]`, view)?.focus();
  const run = async (key, r) => {
    if (key === 'pin') {
      const next = !r.pinned;
      await setRequestPinned(r.id, next);
      track('opview_request_pin_toggled', { requestId: r.id, result: next ? 'pinned' : 'unpinned' });
      await refresh();
      toast(next ? `已置頂「${r.client.slice(0, 24)}」` : '已取消置頂');
      announce(next ? '已置頂' : '已取消置頂');
      reopenFocus(r.id);
    } else if (key === 'download') {
      await downloadRequestFile(r);
      reopenFocus(r.id);
    } else if (key === 'delete') {
      await confirmDelete({ title: '刪除索取資料？', body: `「${r.client}」的索取資料會移除，無法復原。` }, async () => {
        await deleteRequest(r.id);
        track('opview_request_deleted', { requestId: r.id });
        reqCount = await countRequests();
        toast(`已刪除「${r.client.slice(0, 24)}」`);
        if (reqCount === 0) { opTab = 'new'; showForm(view); } else { showList(view); }
      }, () => reopenFocus(r.id));
    }
  };
  const open = (el, focus) => { const r = rowsById.get(el.dataset.id); if (r) openRowMenu(el, { label: `索取資料操作：${r.client}`, items: reqMenuItems(r), ctx: r }, run, focus); };
  on(panel, 'click', '[data-action="row-menu"]', (e, el) => { e.stopPropagation(); if (isMenuOpenFor(el)) closeRowMenu(); else open(el); });
  on(panel, 'keydown', '[data-action="row-menu"]', (e, el) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    open(el, e.key === 'ArrowUp' ? 'last' : 'first');
  });
}

// ───────────────────────── 使用指南（FAQ） ─────────────────────────

const PAGE = 10;

export function renderGuide(root, { query }) {
  const state = {
    q: query.q || '',
    cat: FAQ_CATEGORIES.includes(query.cat) ? query.cat : 'all',
  };
  const view = document.createElement('div');
  view.className = 'view view--guide';
  view.innerHTML = html`
    ${pageHead({
      title: '使用指南',
      desc: '常見問題與操作說明。可用關鍵字搜尋，或依問題類型篩選。',
      crumbs: [{ label: '社群口碑分析', href: '#/' }, { label: '使用指南' }],
    })}
    <section class="zone zone--filters zone--filters--sticky" aria-label="檢索問答">
      <div class="filters">
        <div class="field field--search">
          <label class="field__label" for="g-q">搜尋問題或答案</label>
          <div class="input-wrap">${raw(icon('search', { size: 16 }))}<input id="g-q" class="input" type="search" value="${state.q}" autocomplete="off" placeholder="例如：檔案大小、關鍵字"></div>
        </div>
        <div class="field">
          <label class="field__label" for="g-cat">問題類型</label>
          <select id="g-cat" class="select">
            <option value="all">全部類型（${FAQ.length}）</option>
            ${FAQ_CATEGORIES.map((c) => html`<option value="${c}" ${state.cat === c ? 'selected' : ''}>${c}（${FAQ.filter((f) => f.cat === c).length}）</option>`)}
          </select>
        </div>
      </div>
    </section>
    <section class="zone zone--data" id="faq-zone" aria-label="問答清單"></section>`;
  root.replaceChildren(view);
  $('.page-title', view).focus({ preventScroll: true });
  setBackToTop(true, 300);

  const matches = () => {
    const needle = state.q.trim().toLowerCase();
    return FAQ.filter((f) => (state.cat === 'all' || f.cat === state.cat) && (!needle || `${f.q} ${f.a} ${f.cat}`.toLowerCase().includes(needle)));
  };
  const render = (announceCount = false) => {
    const rows = matches();
    history.replaceState(null, '', href('/guide', { q: state.q, cat: state.cat === 'all' ? '' : state.cat }));
    $('#faq-zone', view).innerHTML = rows.length ? html`
      <p class="list-count" aria-live="polite">共 ${rows.length} 則</p>
      <ul class="faq-list">${rows.map((f) => html`<li><details class="faq-item">
        <summary class="faq-item__q"><span class="faq-item__text"><span class="status-tag status-tag--processing status-tag--wide">${f.cat}</span>${f.q}</span>${raw(icon('chevronDown', { size: 18 }))}</summary>
        <div class="faq-item__a">${f.a.split('\n').map((p) => html`<p>${p}</p>`)}</div>
      </details></li>`)}</ul>`
      : html`<div class="empty-hero empty-hero--quiet"><h2 class="empty-hero__title">找不到相關問答</h2>
          <p class="empty-hero__body">沒有符合${state.q ? `「${state.q}」` : ''}${state.cat !== 'all' ? `（類型：${state.cat}）` : ''}的問題。試試其他關鍵字，或清除條件查看全部 ${FAQ.length} 則。</p>
          <button type="button" class="btn btn--secondary" data-action="clear">清除搜尋與篩選</button></div>`;
    if (announceCount) announce(`找到 ${rows.length} 則問答`);
  };
  render();

  $('#g-q', view).addEventListener('input', debounce((e) => { state.q = e.target.value; render(true); }, 250));
  $('#g-cat', view).addEventListener('change', (e) => { state.cat = e.target.value; render(true); });
  on(view, 'click', '[data-action="clear"]', () => {
    Object.assign(state, { q: '', cat: 'all' });
    $('#g-q', view).value = ''; $('#g-cat', view).value = 'all';
    render(true);
    $('#g-q', view).focus();
  });
}
