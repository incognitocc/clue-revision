// ds-sense 產出 — C. 模擬執行與結果、D. 來源查核
import { html, raw, on, $, fmtDateTime, fmtDate, fmtSize, toast, announce, debounce } from '../core/dom.js';
import { navigate, href } from '../core/router.js';
import { store, wizard } from '../core/store.js';
import {
  getAnalysis, getResults, getStatus, retryAnalysis, getArticles, getArticle, deleteAnalysis, ownerName, ServiceError,
} from '../services/mock-service.js';
import { hBars, pairBars, columns, lineChart, heatTable, bubbles } from './charts.js';
import { pageHead, statusBadge, readOnlyNotice, spinner, errorBlock } from './ui.js';
import { icon } from './icons.js';
import { setBackToTop } from '../core/fab.js';
import { openShareDrawer } from './share-drawer.js';
import { topicTip } from './topic-tip.js';
import { track } from '../core/telemetry.js';

const backToList = html`<a class="btn btn--secondary" href="#/">${raw(icon('arrowLeft', { size: 16 }))}<span>回到社群口碑分析</span></a>`;

function mount(root, cls = '') {
  const view = document.createElement('div');
  view.className = `view ${cls}`;
  view.innerHTML = spinner('正在載入分析…');
  root.replaceChildren(view);
  return view;
}

function focusTitle(view) { $('.page-title', view)?.focus({ preventScroll: true }); }

/** 共用：載入分析並處理找不到／無權限 */
async function loadOr404(view, id) {
  try {
    return await getAnalysis(id);
  } catch (err) {
    if (!view.isConnected) return null;
    if (err instanceof ServiceError && err.code === 'FORBIDDEN') {
      view.innerHTML = html`${pageHead({ title: '沒有存取權限', desc: '你目前沒有這份分析的檢視權限。', crumbs: [{ label: '社群口碑分析', href: '#/' }, { label: '沒有存取權限' }] })}
        ${errorBlock({
          title: '這份分析未分享給你',
          body: `分析 ${id} 的擁有者是 ${err.detail.ownerName}。如需查看，請直接聯絡擁有者分享給你（POC 不會發送申請）。權限由後端驗證，前端不會顯示任何分析內容。`,
          actions: backToList,
        })}`;
    } else {
      view.innerHTML = html`${pageHead({ title: '找不到這份分析', desc: '連結可能有誤，或分析已不存在。', crumbs: [{ label: '社群口碑分析', href: '#/' }, { label: '找不到分析' }] })}
        ${errorBlock({ title: `找不到「${id}」`, body: '請確認連結是否正確，或回到「社群口碑分析」搜尋分析名稱。', actions: backToList })}`;
    }
    focusTitle(view);
    return null;
  }
}

function headMeta(an, res) {
  return html`<div class="meta-row">
    ${statusBadge(an.status)}
    ${res ? html`<span class="meta-item">資料範圍 <span class="num">${fmtDate(res.range.from)}–${fmtDate(res.range.to)}</span></span>
      <span class="meta-item"><span class="num">${res.articleCount}</span> 篇文章</span>` : ''}
    <span class="meta-item">更新 <span class="num">${fmtDateTime(an.updatedAt)}</span></span>
    <span class="meta-item">建立者 ${ownerName(an)}</span>
  </div>`;
}

// ───────────────────────── 分析詳情（處理中／失敗／結果） ─────────────────────────

let pollTimer;



export async function renderAnalysis(root, { params, query }) {
  clearInterval(pollTimer);
  const view = mount(root, 'view--detail');
  const an = await loadOr404(view, params.id);
  if (!an) return;
  store.pushRecent(an);
  document.dispatchEvent(new CustomEvent('recent-changed'));

  if (an.status === 'processing') return renderProcessing(view, an, root);
  if (an.status === 'failed') return renderFailed(view, an, root);
  return renderResults(view, an, query);
}

function renderProcessing(view, an, root) {
  view.innerHTML = html`
    ${pageHead({ title: an.name, crumbs: [{ label: '社群口碑分析', href: '#/' }, { label: an.name }], meta: headMeta(an) })}
    <section class="state-panel" aria-labelledby="proc-title">
      <h2 id="proc-title" class="state-panel__title">分析處理中</h2>
      <ol class="proc-steps">
        <li class="proc-steps__item is-done">${raw(icon('check', { size: 16 }))}<span>已收到分析設定與資料資訊</span></li>
        <li class="proc-steps__item is-active"><span class="pulse" aria-hidden="true"></span><span>模擬處理中…</span></li>
        <li class="proc-steps__item">${raw(icon('clock', { size: 16 }))}<span>完成後即可查看結果</span></li>
      </ol>
      <p class="state-panel__body">POC 以固定時間模擬處理，不顯示進度百分比或剩餘時間，因為目前沒有可確認的後端進度資訊。</p>
      <p class="state-panel__body">你可以離開此頁；完成後從「社群口碑分析」回到這份分析即可。取消功能待後端確認，POC 不提供。</p>
      <div class="state-block__actions">${backToList}</div>
      <p class="sr-only" role="status" id="proc-status">分析處理中</p>
    </section>`;
  focusTitle(view);
  pollTimer = setInterval(async () => {
    if (!view.isConnected) { clearInterval(pollTimer); return; }
    const st = await getStatus(an.id);
    if (st !== 'processing') {
      clearInterval(pollTimer);
      track(st === 'completed' ? 'analysis_completed' : 'analysis_failed', { analysisId: an.id, mode: an.mode });
      announce(st === 'completed' ? '分析已完成，正在顯示結果' : '分析失敗');
      renderAnalysis(root, { params: { id: an.id }, query: {} });
    }
  }, 1000);
}

function renderFailed(view, an, root) {
  const isOwner = an.access === 'owner';
  view.innerHTML = html`
    ${pageHead({ title: an.name, crumbs: [{ label: '社群口碑分析', href: '#/' }, { label: an.name }], meta: headMeta(an) })}
    ${!isOwner ? readOnlyNotice(ownerName(an)) : ''}
    <section class="state-panel state-panel--error" aria-labelledby="fail-title">
      <h2 id="fail-title" class="state-panel__title">${raw(icon('alert', { size: 20 }))}分析未完成</h2>
      <p class="state-panel__body"><strong>原因：</strong>${an.failure?.message ?? '模擬失敗。'}</p>
      <p class="state-panel__body">專案名稱、資料資訊與設定都已保留。你可以直接重新執行，或修改設定後重新建立。</p>
      ${isOwner ? html`
        <div class="state-block__actions">
          <button type="button" class="btn btn--primary" data-action="retry">${raw(icon('refresh', { size: 16 }))}<span>重新執行</span></button>
          <button type="button" class="btn btn--secondary" data-action="edit">修改設定後重新建立</button>
        </div>
        <p class="field__hint">POC 中「重新執行」會沿用同一筆分析並覆蓋結果；正式版是否新增工作、覆蓋結果或產生成本待確認。仍無法完成時，請聯絡 Clue 管理員。</p>`
      : html`<p class="state-panel__body">你是檢視者，無法重新執行。請聯絡擁有者 ${ownerName(an)}。</p>`}
      <div class="state-block__actions">${backToList}</div>
    </section>`;
  focusTitle(view);

  let busy = false;
  on(view, 'click', '[data-action="retry"]', async (e, el) => {
    if (busy) return;
    busy = true;
    el.disabled = true;
    el.textContent = '正在重新執行…';
    await retryAnalysis(an.id);
    renderAnalysis(root, { params: { id: an.id }, query: {} });
  });
  on(view, 'click', '[data-action="edit"]', () => {
    wizard.prefillFrom(an);
    navigate('/create/1');
  });
}

// ───────────────────────── 專案內頁（結果） ─────────────────────────

const TABS = [
  { key: 'insight', label: '話題洞察' },
  { key: 'layers', label: '話題分群' },
];
// 「話題分群」底下的第二層（按鈕式分頁）
const SUBS = [
  { key: 'clusters', label: '分群摘要' },
  { key: 'keywords', label: '關鍵字總表' },
  { key: 'summary', label: '摘要統整' },
];
// 情緒標籤沿用狀態標籤樣式：正面＝紫底白字、中立＝灰框、負面＝咖啡底白字
const sentiTone = (s) => (s === '正面' ? 'completed' : s === '負面' ? 'failed' : 'processing');
const pct1 = (n, d) => `${((n / d) * 100).toFixed(1)}%`;
const p1 = (v) => `${Number(v).toFixed(1)}%`;
const fmtN = (n) => Number(n).toLocaleString('zh-TW');
const firstSentence = (s) => (s.split('。')[0] || s) + '。';

async function renderResults(view, an, query) {
  let res;
  try { res = await getResults(an.id); } catch (err) {
    view.innerHTML = errorBlock({ title: '無法載入結果', body: `${err.message}。請重新整理頁面，或回到社群口碑分析清單。`, actions: backToList });
    return;
  }
  if (!view.isConnected) return;
  track('analysis_result_viewed', { analysisId: an.id, mode: an.mode });
  setBackToTop(true);
  const isOwner = an.access === 'owner';
  // 相容舊網址：tab=clusters／keywords／summary → 話題分群 › 該子分頁
  const legacySub = SUBS.some((s) => s.key === query.tab) ? query.tab : null;
  const tab = legacySub ? 'layers' : TABS.some((t) => t.key === query.tab) ? query.tab : 'insight';
  const sub = legacySub || (SUBS.some((s) => s.key === query.sub) ? query.sub : 'clusters');
  const cSel = res.clusters.some((c) => c.id === Number(query.c)) ? Number(query.c) : 1;
  const state = { tab, sub, c: cSel, kf: query.kf || 'all' };
  const M = res.meta;

  view.innerHTML = html`
    ${pageHead({
      title: an.name,
      crumbs: [{ label: '社群口碑分析', href: '#/' }, { label: an.name }],
      meta: html`<div class="meta-row">
        ${statusBadge(an.status)}
        <span class="meta-item">資料期間 <span class="num">2022/10/01–2022/12/31</span></span>
        <span class="meta-item"><span class="num">${fmtN(M.totalPosts)}</span> 篇主文</span>
        <span class="meta-item">更新 <span class="num">${fmtDateTime(an.updatedAt)}</span></span>
        <span class="meta-item">建立者 ${ownerName(an)}</span>
      </div>`,
      actions: html`
        <button type="button" class="btn btn--secondary" data-action="download">${raw(icon('download', { size: 14 }))}<span>下載資料</span></button>
        <button type="button" class="btn btn--secondary" data-action="share" aria-haspopup="dialog">${raw(icon('share', { size: 16 }))}<span>分享</span></button>`,
    })}
    ${!isOwner ? readOnlyNotice(ownerName(an)) : ''}

    <section class="result-section result-section--first" aria-label="分析結果">
      <div class="tabs" role="tablist" aria-label="分析結果分頁">
        ${TABS.map((t) => html`<button type="button" role="tab" id="tab-${t.key}" class="tabs__tab" data-tab="${t.key}" aria-controls="tabpanel" aria-selected="${t.key === state.tab ? 'true' : 'false'}" tabindex="${t.key === state.tab ? 0 : -1}">${t.label}</button>`)}
      </div>
      <div class="tabpanel" id="tabpanel" role="tabpanel" aria-labelledby="tab-${state.tab}" tabindex="0"></div>
    </section>

    <section class="project-actions" aria-label="專案操作">
      <div class="project-actions__main">
        <button type="button" class="btn btn--primary btn--xl" data-action="download">${raw(icon('download', { size: 16 }))}<span>下載資料</span></button>
        <button type="button" class="btn btn--secondary btn--xl" data-action="share" aria-haspopup="dialog">${raw(icon('share', { size: 18 }))}<span>分享</span></button>
      </div>
      ${isOwner ? html`<button type="button" class="btn btn--danger-ghost" data-action="delete" aria-expanded="false" aria-controls="delete-confirm">${raw(icon('delete', { size: 14 }))}<span>刪除專案</span></button>` : ''}
      <div id="delete-confirm" class="delete-confirm" hidden role="alertdialog" aria-labelledby="del-title" aria-describedby="del-desc" tabindex="-1">
        <h3 id="del-title" class="subpanel__title">確定刪除「${an.name}」？</h3>
        <p id="del-desc">刪除後，這份專案的結果與分享對象都會移除，無法復原。POC 只會從本機示範資料移除；可在 POC 情境面板重設。</p>
        <div class="notice__actions">
          <button type="button" class="btn btn--danger" data-action="confirm-delete">確認刪除</button>
          <button type="button" class="btn btn--secondary" data-action="cancel-delete">取消</button>
        </div>
      </div>
      <p class="form-status" id="action-status" role="status"></p>
    </section>`;
  focusTitle(view);

  const panel = $('#tabpanel', view);
  const syncUrl = () => history.replaceState(null, '', href(`/analysis/${an.id}`, {
    tab: state.tab === 'insight' ? '' : state.tab,
    sub: state.tab === 'layers' && state.sub !== 'clusters' ? state.sub : '',
    c: state.tab === 'layers' && state.sub === 'clusters' && state.c !== 1 ? state.c : '',
    kf: state.tab === 'layers' && state.sub === 'keywords' && state.kf !== 'all' ? state.kf : '',
  }));
  const subContent = () => (state.sub === 'clusters' ? clustersTab(an, res, state.c) : state.sub === 'keywords' ? keywordsTab(res, state.kf) : summaryTab(an, res));
  const renderTab = () => {
    panel.setAttribute('aria-labelledby', `tab-${state.tab}`);
    panel.innerHTML = state.tab === 'insight' ? insightTab(an, res) : html`
      <div class="segmented" role="tablist" aria-label="話題分群內容">
        ${SUBS.map((s) => html`<button type="button" role="tab" id="subtab-${s.key}" class="segmented__item" data-sub="${s.key}" aria-controls="subpanel" aria-selected="${s.key === state.sub ? 'true' : 'false'}" tabindex="${s.key === state.sub ? 0 : -1}">${s.label}</button>`)}
      </div>
      <div class="layer-panel" id="subpanel" role="tabpanel" aria-labelledby="subtab-${state.sub}" tabindex="0">${subContent()}</div>`;
    syncUrl();
  };
  renderTab();

  const selectTab = (key, focus) => {
    state.tab = key;
    view.querySelectorAll('.tabs__tab').forEach((t) => {
      const on = t.dataset.tab === key;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    renderTab();
  };
  const selectSub = (key, focus) => {
    state.sub = key;
    renderTab();
    if (focus) $(`#subtab-${key}`, view)?.focus();
  };
  on(view, 'click', '.tabs__tab', (e, el) => selectTab(el.dataset.tab));
  on(view, 'keydown', '.tabs__tab', (e, el) => {
    const keys = TABS.map((t) => t.key); const i = keys.indexOf(el.dataset.tab);
    const next = { ArrowRight: (i + 1) % keys.length, ArrowLeft: (i - 1 + keys.length) % keys.length, Home: 0, End: keys.length - 1 }[e.key];
    if (next == null) return;
    e.preventDefault();
    selectTab(keys[next], true);
  });
  // 話題標籤的 hover／focus 提示：簡短話題內容與關鍵字
  const showTip = (el) => {
    const c = res.clusters.find((x) => x.id === Number(el.dataset.topic));
    if (!c) return;
    const brief = (c.oneLiner || firstSentence(c.summary)).replace(/。$/, '');
    topicTip.show(el, `話題 ${c.id}`, brief.length > 64 ? brief.slice(0, 64) + '…' : brief, c.keywords.slice(0, 5).map((k) => k.k).join('、'));
  };
  view.addEventListener('mouseover', (e) => { const el = e.target.closest('[data-topic]'); if (el) showTip(el); });
  view.addEventListener('mouseout', (e) => { if (e.target.closest('[data-topic]')) topicTip.hide(); });
  view.addEventListener('focusin', (e) => { const el = e.target.closest('[data-topic]'); if (el) showTip(el); });
  view.addEventListener('focusout', (e) => { if (e.target.closest('[data-topic]')) topicTip.hide(); });
  on(view, 'click', '.segmented__item', (e, el) => selectSub(el.dataset.sub, true));
  on(view, 'keydown', '.segmented__item', (e, el) => {
    const keys = SUBS.map((s) => s.key); const i = keys.indexOf(el.dataset.sub);
    const next = { ArrowRight: (i + 1) % keys.length, ArrowLeft: (i - 1 + keys.length) % keys.length, Home: 0, End: keys.length - 1 }[e.key];
    if (next == null) return;
    e.preventDefault();
    selectSub(keys[next], true);
  });
  // 從洞察頁或其他地方跳到指定分群
  on(view, 'click', '[data-goto-cluster]', (e, el) => {
    e.preventDefault();
    state.c = Number(el.dataset.gotoCluster);
    state.sub = 'clusters';
    selectTab('layers');
    $('.tabs', view).scrollIntoView({ block: 'start' });
    $('#cluster-select', view)?.focus();
  });
  on(view, 'change', '#cluster-select', (e) => { state.c = Number(e.target.value); renderTab(); $('#cluster-select', view).focus(); announce(`已切換到分群 ${state.c}`); });
  on(view, 'click', '[data-cluster]', (e, el) => {
    if (state.tab !== 'layers' || state.sub !== 'clusters') return;
    state.c = Number(el.dataset.cluster); renderTab(); $('#cluster-select', view).focus();
  });
  on(view, 'change', '#kw-filter', (e) => { state.kf = e.target.value; renderTab(); $('#kw-filter', view).focus(); });
  on(view, 'click', '[data-sort-table] [data-sort-col]', (e, el) => sortTable(el));

  on(view, 'click', '[data-action="share"]', () => openShareDrawer(an, { onShared: (u) => { an.sharedWith = u.sharedWith; } }));
  if (query.share) setTimeout(() => $('.page-head [data-action="share"]', view)?.click(), 0);   // 相容舊連結 ?share=1
  on(view, 'click', '[data-action="download"]', async (e, el) => {
    el.disabled = true;
    $('#action-status', view).textContent = '正在產生資料檔…';
    const list = await getArticles();
    downloadCSV(`clue-poc-${an.id}-data.csv`, list);
    track('analysis_exported', { analysisId: an.id, target: 'local-csv' });
    el.disabled = false;
    $('#action-status', view).textContent = '';
    toast(`已在本機產生資料檔（${fmtN(list.length)} 篇主文，CSV）`);
  });
  on(view, 'click', '[data-action="download-cluster"]', async (e, el) => {
    const c = el.dataset.c ? Number(el.dataset.c) : null;
    const list = (await getArticles()).filter((a) => (c ? a.cluster === c : a.cluster));
    downloadCSV(`clue-poc-${an.id}-${c ? `cluster-${c}` : 'clusters'}.csv`, list);
    track('analysis_exported', { analysisId: an.id, target: c ? 'cluster-csv' : 'all-clusters-csv' });
    toast(`已下載${c ? `分群 ${c}` : '各分群'}原始資料（${fmtN(list.length)} 篇）`);
  });
  on(view, 'click', '[data-action="delete"]', (e, el) => {
    const box = $('#delete-confirm', view);
    box.hidden = false;
    el.setAttribute('aria-expanded', 'true');
    $('[data-action="cancel-delete"]', view).focus();
  });
  on(view, 'click', '[data-action="cancel-delete"]', () => {
    $('#delete-confirm', view).hidden = true;
    $('[data-action="delete"]', view).setAttribute('aria-expanded', 'false');
    $('[data-action="delete"]', view).focus();
  });
  let deleting = false;
  on(view, 'click', '[data-action="confirm-delete"]', async (e, el) => {
    if (deleting) return;
    deleting = true;
    el.disabled = true;
    el.textContent = '正在刪除…';
    try {
      await deleteAnalysis(an.id);
      store.dropRecentItem(an.id);
      track('analysis_deleted', { analysisId: an.id });
      toast(`已刪除「${an.name.slice(0, 30)}」`);
      navigate('/');
    } catch (err) {
      deleting = false;
      el.disabled = false;
      el.textContent = '確認刪除';
      $('#action-status', view).textContent = `刪除失敗：${err.message}`;
    }
  });
}

/** 自建表格排序（aria-sort） */
function sortTable(btn) {
  const table = btn.closest('table'); const th = btn.closest('th');
  const col = Number(btn.dataset.sortCol); const type = btn.dataset.type;
  const dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
  table.querySelectorAll('thead th[aria-sort]').forEach((h) => { h.setAttribute('aria-sort', 'none'); const a = h.querySelector('.th-sort__arrow'); if (a) a.textContent = '↕'; });
  th.setAttribute('aria-sort', dir); btn.querySelector('.th-sort__arrow').textContent = dir === 'ascending' ? '↑' : '↓';
  const tb = table.tBodies[0];
  const val = (tr) => { const cell = tr.children[col]; const v = cell.dataset.v ?? cell.textContent.trim(); return type === 'num' ? Number(v) : v; };
  [...tb.rows].sort((a, b) => { const x = val(a); const y = val(b); const r = type === 'num' ? x - y : String(x).localeCompare(String(y), 'zh-Hant'); return dir === 'ascending' ? r : -r; })
    .forEach((tr) => tb.append(tr));
}
const sortTh = (i, label, type = 'num', cls = '') => html`<th scope="col" class="${cls}" aria-sort="none"><button type="button" class="th-sort" data-sort-col="${i}" data-type="${type}">${label}<span class="th-sort__arrow" aria-hidden="true">↕</span></button></th>`;

// ───── Tab 1：話題洞察（版面參考 ai-result.html；「社群洞察總結」移到最上方） ─────
function insightTab(an, res) {
  const R = res.report; const k = R.kpis; const M = res.meta;
  const rows = R.clusterRows;
  const byCount = [...rows].sort((a, b) => b.count - a.count);
  const byEng = [...rows].sort((a, b) => b.avgEngagement - a.avgEngagement);
  const byPos = [...rows].sort((a, b) => b.posRate - a.posRate);
  const byNeg = [...rows].sort((a, b) => b.negRate - a.negRate);
  const C = (id) => res.clusters.find((c) => c.id === id);
  const kws = (id, n = 5) => C(id).keywords.slice(0, n).map((x) => x.k).join('、');
  const peakHour = R.hourly.indexOf(Math.max(...R.hourly));
  const WD = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
  const wdMax = R.weekday.indexOf(Math.max(...R.weekday)); const wdMin = R.weekday.indexOf(Math.min(...R.weekday));
  const topDay = [...R.daily].sort((a, b) => b.total - a.total)[0];
  const cLink = (id) => html`話題 ${id}`;
  const tone = (r) => (r.posRate >= r.negRate * 2 ? ['偏正面', 'completed'] : r.negRate > r.posRate ? ['偏負面', 'failed'] : ['中立', 'processing']);

  return html`
  <section class="report-sec" aria-labelledby="r1">
    <h3 id="r1" class="report-sec__title"><span class="report-sec__num">1</span>社群洞察總結</h3>
    <p class="muted report-note">以下文字由 POC 依上傳資料的統計結果以固定規則產生，並非 AI 模型撰寫；數字皆可在下方圖表與表格中查核。</p>
    <div class="core-findings">
      <h4 class="core-findings__title">核心發現</h4>
      <ul class="bullet-list">
        <li><strong>討論集中在 ${cLink(byCount[0].id)} 與 ${cLink(byCount[1].id)}</strong>：兩個話題合計 ${fmtN(byCount[0].count + byCount[1].count)} 篇，占話題文章 ${pct1(byCount[0].count + byCount[1].count, M.clusteredPosts)}。${firstSentence(C(byCount[0].id).summary)}</li>
        <li><strong>${cLink(byNeg[0].id)} 負面率最高（${byNeg[0].negRate}%）</strong>：高出整體 ${k.negRate}%，常見關鍵字為「${kws(byNeg[0].id)}」，建議優先查核來源文章。</li>
        <li><strong>${cLink(byEng[0].id)} 平均互動最高（${fmtN(byEng[0].avgEngagement)}）</strong>：為整體平均 ${fmtN(k.avgEngagement)} 的 ${(byEng[0].avgEngagement / k.avgEngagement).toFixed(1)} 倍；常見關鍵字為「${kws(byEng[0].id)}」。</li>
      </ul>
    </div>
    <div class="insight-grid">
      ${[['最高聲量話題', byCount[0], `${fmtN(byCount[0].count)} 篇`], ['最高互動話題', byEng[0], `平均互動 ${fmtN(byEng[0].avgEngagement)}`], ['正面率最高話題', byPos[0], `正面率 ${byPos[0].posRate}%`]].map(([t, r, stat]) => html`
        <article class="insight-card">
          <h4 class="insight-card__eyebrow">${t}</h4>
          <p class="insight-card__title">話題 ${r.id}<span class="insight-card__stat num">${stat}</span></p>
          <p class="insight-card__body">${C(r.id).oneLiner || firstSentence(C(r.id).summary)}</p>
          <p class="insight-card__kw">關鍵字：${kws(r.id)}</p>
        </article>`)}
    </div>
    <p class="data-line">資料來源：OpView 社群輿情（查詢主題 ${M.topic}）｜分析期間 2022/10/01–2022/12/31｜主文 ${fmtN(M.totalPosts)} 篇｜話題涵蓋率 ${k.clusterCoverage}%｜共 ${k.clusterCount} 個話題</p>
  </section>

  <section class="report-sec" aria-labelledby="r2">
    <h3 id="r2" class="report-sec__title"><span class="report-sec__num">2</span>社群聲量總覽</h3>
    <div class="kpi-grid">
      ${[['總主文數', fmtN(k.totalPosts)], ['平均互動', fmtN(k.avgEngagement)], ['正面情緒率', `${k.posRate}%`], ['話題涵蓋率', `${k.clusterCoverage}%`]].map(([l, v]) => html`<div class="kpi"><div class="kpi__body"><p class="kpi__label">${l}</p><p class="kpi__value num">${v}</p></div></div>`)}
    </div>
    <p class="muted">互動 = 按讚／觀看 ＋ 分享／轉貼 ＋ 顯示留言數（OpView 欄位加總）。</p>
    <div class="grid-2">
      <div><h4 class="report-sub">話題聲量排行（主文數）</h4>
        ${hBars(byCount.map((r) => ({ label: `話題 ${r.id}`, topic: r.id, value: r.count })), { label: '話題聲量排行' })}</div>
      <div><h4 class="report-sub">話題互動排行（平均互動）</h4>
        ${hBars(byEng.map((r) => ({ label: `話題 ${r.id}`, topic: r.id, value: r.avgEngagement })), { label: '話題互動排行' })}</div>
    </div>
    <h4 class="report-sub">話題情緒分析</h4>
    <div class="table-wrap"><table class="table" data-sort-table>
      <caption class="sr-only">話題情緒分析</caption>
      <thead><tr>${sortTh(0, '話題')}${sortTh(1, '主文數', 'num', 'num')}${sortTh(2, '平均互動', 'num', 'num')}${sortTh(3, '正面率', 'num', 'num')}${sortTh(4, '負面率', 'num', 'num')}<th scope="col">情緒傾向</th></tr></thead>
      <tbody>${rows.map((r) => { const [t, cls] = tone(r); return html`<tr>
        <th scope="row" data-v="${r.id}"><span class="topic-ref" data-topic="${r.id}" tabindex="0">話題 ${r.id}</span></th><td class="num" data-label="主文數" data-v="${r.count}">${fmtN(r.count)}</td>
        <td class="num" data-label="平均互動" data-v="${r.avgEngagement}">${fmtN(r.avgEngagement)}</td>
        <td class="num" data-label="正面率" data-v="${r.posRate}">${p1(r.posRate)}</td><td class="num" data-label="負面率" data-v="${r.negRate}">${p1(r.negRate)}</td>
        <td data-label="情緒傾向"><span class="status-tag status-tag--${cls}">${t}</span></td></tr>`; })}</tbody>
    </table></div>
    <p class="muted">情緒傾向規則：正面率 ≥ 負面率 × 2 為偏正面；負面率 > 正面率為偏負面；其餘為中立。情緒標記取自 OpView。</p>

    <h4 class="report-sub">每日聲量趨勢</h4>
    ${lineChart(R.daily.map((d) => d.date), [
      { label: '總聲量', values: R.daily.map((d) => d.total), cls: 'total' },
      { label: '正面', values: R.daily.map((d) => d.pos), cls: 'pos' },
      { label: '負面', values: R.daily.map((d) => d.neg), cls: 'neg' },
    ], { label: `每日主文數，2022/10/01 至 12/31。最高單日為 ${fmtDate(topDay.date)}，共 ${topDay.total} 篇。` })}
    <p class="muted">最高單日：${fmtDate(topDay.date)}（${topDay.total} 篇）；期間日平均 ${(k.totalPosts / R.daily.length).toFixed(1)} 篇。</p>

    <h4 class="report-sub">聲量高峰時間軸（前 5 日）</h4>
    <ol class="timeline">${R.peaks.map((p) => html`<li class="timeline__item">
      <p class="timeline__date"><span class="num">${fmtDate(p.date)}</span><span class="muted num">${p.total} 篇 · 正面 ${p.pos} · 負面 ${p.neg}</span></p>
      <p class="timeline__chips">${p.clusters.map(([l, n]) => html`<span class="tag">${String(l).replace('未分群', '未歸入話題').replace('分群', '話題')} ${n}</span>`)}</p>
      <p class="timeline__detail">當日互動最高：${p.topPost.title.slice(0, 60)}<span class="muted num">（互動 ${fmtN(p.topPost.engagement)}）</span></p>
    </li>`)}</ol>
  </section>

  <section class="report-sec" aria-labelledby="r3">
    <h3 id="r3" class="report-sec__title"><span class="report-sec__num">3</span>社群平台分析</h3>
    <div class="grid-2">
      <div><h4 class="report-sub">各平台聲量占比</h4>
        ${hBars(R.platforms.map((p) => ({ label: p.label, value: p.count, display: `${fmtN(p.count)} · ${pct1(p.count, k.totalPosts)}` })), { label: '各平台聲量占比' })}</div>
      <div><h4 class="report-sub">平台平均按讚／觀看</h4>
        ${hBars(R.platforms.map((p) => ({ label: p.label, value: p.avgLike })), { label: '平台平均按讚／觀看' })}</div>
    </div>
    <div class="table-wrap"><table class="table"><caption class="sr-only">平台明細</caption>
      <thead><tr><th scope="col">平台</th><th scope="col" class="num">主文數</th><th scope="col" class="num">平均按讚／觀看</th><th scope="col" class="num">平均留言</th><th scope="col" class="num">正面率</th></tr></thead>
      <tbody>${R.platforms.map((p) => html`<tr><th scope="row">${p.label}</th><td class="num" data-label="主文數">${fmtN(p.count)}</td><td class="num" data-label="平均按讚／觀看">${fmtN(p.avgLike)}</td><td class="num" data-label="平均留言">${p.avgComment}</td><td class="num" data-label="正面率">${p.posRate}%</td></tr>`)}</tbody>
    </table></div>
    <p class="highlight-line"><strong>平台觀察：</strong>${R.platforms[0].label} 貢獻 ${pct1(R.platforms[0].count, k.totalPosts)} 的主文，平均按讚／觀看 ${fmtN(R.platforms[0].avgLike)}；${R.platforms[1].label} 占 ${pct1(R.platforms[1].count, k.totalPosts)}，平均按讚／觀看 ${fmtN(R.platforms[1].avgLike)}。</p>
  </section>

  <section class="report-sec" aria-labelledby="r4">
    <h3 id="r4" class="report-sec__title"><span class="report-sec__num">4</span>發布時段分析</h3>
    <h4 class="report-sub">貼文熱力圖（星期 × 小時，台北時間）</h4>
    <div class="scroll-x" tabindex="0" role="region" aria-label="貼文熱力圖，可左右捲動">
      ${heatTable(R.heatmap, WD, Array.from({ length: 24 }, (_, h) => h), { caption: '各星期與小時的主文數' })}
    </div>
    <div class="grid-2">
      <div><h4 class="report-sub">每小時聲量</h4>${columnsPlain(R.hourly.map((v, h) => ({ label: `${h}`, value: v, strong: h === peakHour })), '每小時主文數')}</div>
      <div><h4 class="report-sub">星期聲量</h4>${columnsPlain(R.weekday.map((v, i) => ({ label: WD[i], value: v, strong: i === wdMax })), '各星期主文數')}</div>
    </div>
    <p class="highlight-line"><strong>時段觀察：</strong>發文高峰在 ${peakHour}:00（${R.hourly[peakHour]} 篇）；${WD[wdMax]}聲量最高（${R.weekday[wdMax]} 篇），${WD[wdMin]}最低（${R.weekday[wdMin]} 篇）。</p>
  </section>`;
}

function columnsPlain(rows, label) {
  const m = Math.max(...rows.map((r) => r.value), 1);
  return html`<div class="minicols" role="img" aria-label="${label}：${rows.map((r) => `${r.label} ${r.value}`).join('、')}">
    ${rows.map((r) => html`<span class="minicols__col ${r.strong ? 'is-strong' : ''}"><span class="minicols__bar" style="--h:${(r.value / m) * 100}%"></span><span class="minicols__label">${r.label}</span></span>`)}
  </div>`;
}

// ───── Tab 2：分群摘要（下拉選單平行切換分群） ─────
function clustersTab(an, res, cId) {
  const c = res.clusters.find((x) => x.id === cId);
  const m = c.matrix;
  return html`
  <div class="tab-toolbar">
    <div class="field">
      <label class="field__label" for="cluster-select">選擇分群</label>
      <select id="cluster-select" class="select select--wide">
        ${res.clusters.map((x) => html`<option value="${x.id}" ${x.id === cId ? 'selected' : ''}>分群 ${x.id}（${fmtN(x.count)} 篇）</option>`)}
      </select>
    </div>
    <a class="btn btn--secondary" href="${href(`/analysis/${an.id}/sources`, { cluster: cId })}">查看分群 ${cId} 的 ${fmtN(c.count)} 篇來源文章${raw(icon('chevronRight', { size: 14 }))}</a>
  </div>
  <div class="dash-grid">
    <section class="dash-card" aria-labelledby="d1">
      <h3 id="d1" class="dash-card__title">話題分群圖</h3>
      ${bubbles(res.clusters, cId)}
      <p class="muted">圓點大小＝文章數；位置為各分群關鍵字輪廓的 PCA 投影（POC 計算），距離越近代表用詞越相似。點圓點可切換分群。</p>
    </section>
    <section class="dash-card" aria-labelledby="d2">
      <h3 id="d2" class="dash-card__title">該分群最常出現關鍵字 Top 30</h3>
      <div class="scroll-y" tabindex="0" role="region" aria-label="分群 ${cId} 關鍵字 Top 30，可上下捲動">
        ${pairBars(c.keywords.map((k) => ({ label: k.k, a: k.overall, b: k.c })), { label: `分群 ${cId} 關鍵字` })}
      </div>
    </section>
    <section class="dash-card" aria-labelledby="d3">
      <h3 id="d3" class="dash-card__title">各分群文章數</h3>
      ${columns(res.clusters.map((x) => ({ key: x.id, label: `群${x.id}`, value: x.count, strong: x.id === cId })), { label: '各分群文章數，點選可切換分群' })}
    </section>
    <section class="dash-card" aria-labelledby="d4">
      <div class="dash-card__head"><h3 id="d4" class="dash-card__title">該分群重點摘要</h3>
        <button type="button" class="text-link text-link--btn" data-action="download-cluster" data-c="${cId}">${raw(icon('download', { size: 12 }))}分群 ${cId} 原始資料下載</button></div>
      <div class="scroll-y scroll-y--sm" tabindex="0" role="region" aria-label="分群 ${cId} 摘要">
        <p>${c.summary}</p>
        ${c.oneLiner ? html`<p class="muted">一句話摘要：${c.oneLiner}</p>` : ''}
      </div>
      <p class="muted">摘要文字取自既有模型輸出（各分群主題摘要），已移除格式符號。</p>
    </section>
    <section class="dash-card dash-card--wide" aria-labelledby="d5">
      <h3 id="d5" class="dash-card__title">該分群關鍵字矩陣圖</h3>
      <p class="muted">分群 ${cId} 前 ${m.keys.length} 個關鍵字在同一篇文章共同出現的程度（cosine，0–1；1 = 總是一起出現）。</p>
      <div class="scroll-x" tabindex="0" role="region" aria-label="分群 ${cId} 關鍵字矩陣，可捲動">
        ${heatTable(m.values, m.keys, m.keys, { caption: `分群 ${cId} 關鍵字共現矩陣`, max: 1, decimals: 2 })}
      </div>
    </section>
  </div>`;
}

// ───── Tab 3：關鍵字總表 ─────
function keywordsTab(res, kf) {
  const M = res.meta;
  const rows = res.clusters.filter((c) => kf === 'all' || String(c.id) === kf).flatMap((c) => c.keywords.map((k) => ({ cluster: c.id, k: k.k, n: k.c, overall: k.overall })));
  return html`
  <p class="muted">計算方式：以關鍵字詞庫比對每篇主文的標題與內文，計「出現的文章數」。詞庫已套用自訂關鍵字檔（新增 ${M.keywordAdd.length} 個、刪除 ${M.keywordDel.length} 個），共 ${M.vocabSize} 個詞。正式分詞方法待確認。</p>
  <div class="dash-grid dash-grid--kw">
    <section class="dash-card" aria-labelledby="k1">
      <h3 id="k1" class="dash-card__title">總關鍵字統計<span class="dash-card__en">Keyword Frequency</span></h3>
      <div class="scroll-y" tabindex="0" role="region" aria-label="總關鍵字統計，可捲動">
        <table class="table table--compact" data-sort-table>
          <caption class="sr-only">全部分群文章的關鍵字前 30 名</caption>
          <thead><tr>${sortTh(0, '排名')}${sortTh(1, '關鍵字', 'text')}${sortTh(2, '整體出現文章數', 'num', 'num')}</tr></thead>
          <tbody>${res.overallKeywords.map((k, i) => html`<tr><td class="num" data-label="排名" data-v="${i + 1}">${i + 1}</td><th scope="row" data-v="${k.k}">${k.k}</th><td class="num" data-label="整體出現" data-v="${k.c}">${fmtN(k.c)}</td></tr>`)}</tbody>
        </table>
      </div>
    </section>
    <section class="dash-card" aria-labelledby="k2">
      <div class="dash-card__head">
        <h3 id="k2" class="dash-card__title">各分群關鍵字統計<span class="dash-card__en">Keyword Frequency by Topic</span></h3>
        <div class="field field--inline">
          <label class="field__label" for="kw-filter">分群篩選</label>
          <select id="kw-filter" class="select">
            <option value="all" ${kf === 'all' ? 'selected' : ''}>全部</option>
            ${res.clusters.map((c) => html`<option value="${c.id}" ${String(c.id) === kf ? 'selected' : ''}>分群 ${c.id}</option>`)}
          </select>
        </div>
      </div>
      <p class="list-count" aria-live="polite">${fmtN(rows.length)} 筆（每個分群前 30 名）</p>
      <div class="scroll-y" tabindex="0" role="region" aria-label="各分群關鍵字統計，可捲動">
        <table class="table table--compact" data-sort-table>
          <caption class="sr-only">各分群關鍵字統計</caption>
          <thead><tr>${sortTh(0, '主題分群')}${sortTh(1, '關鍵字', 'text')}${sortTh(2, '該分群出現數', 'num', 'num')}${sortTh(3, '整體出現數', 'num', 'num')}</tr></thead>
          <tbody>${rows.map((r) => html`<tr><td class="num" data-label="分群" data-v="${r.cluster}">${r.cluster}</td><th scope="row" data-v="${r.k}">${r.k}</th><td class="num" data-label="該分群" data-v="${r.n}">${fmtN(r.n)}</td><td class="num" data-label="整體" data-v="${r.overall}">${fmtN(r.overall)}</td></tr>`)}</tbody>
        </table>
      </div>
    </section>
  </div>`;
}

// ───── Tab 4：摘要統整 ─────
function summaryTab(an, res) {
  return html`
  <div class="tab-toolbar">
    <h3 class="dash-card__title">各分群主題摘要內容<span class="dash-card__en">Summary of each Topic</span></h3>
    <button type="button" class="btn btn--secondary" data-action="download-cluster">${raw(icon('download', { size: 14 }))}<span>各分群原始資料下載</span></button>
  </div>
  <div class="table-wrap"><table class="table table--topics">
    <caption class="sr-only">各分群主題摘要</caption>
    <thead><tr><th scope="col">話題分群</th><th scope="col" class="num">文章數</th><th scope="col">摘要</th></tr></thead>
    <tbody>${res.clusters.map((c) => html`<tr>
      <th scope="row"><a class="text-link" href="${href(`/analysis/${an.id}`, { tab: 'clusters', c: c.id })}" data-goto-cluster="${c.id}">分群 ${c.id}</a></th>
      <td class="num" data-label="文章數">${fmtN(c.count)}</td>
      <td data-label="摘要"><p>${c.summary}</p>${c.oneLiner ? html`<p class="muted">一句話摘要：${c.oneLiner}</p>` : ''}</td>
    </tr>`)}</tbody>
  </table></div>
  <p class="muted">摘要文字取自既有模型輸出，已移除 Markdown 符號與模型開場語（如「最終綜合主題摘要：」）。</p>`;
}


const CSV_COLS = [['id', '文章ID'], ['cluster', '分群'], ['title', '標題'], ['body', '內容'], ['source', '來源'], ['site', '網站'], ['publishedAt', '發布時間'], ['author', '作者'], ['sentiment', '情緒標記'], ['likes', '按讚/觀看'], ['shares', '分享/轉貼'], ['comments', '顯示留言數'], ['engagement', '互動數'], ['url', '原始連結']];
function downloadCSV(name, list) {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [CSV_COLS.map(([, h]) => h).join(','), ...list.map((a) => CSV_COLS.map(([k]) => esc(k === 'cluster' ? (a.cluster ? `分群 ${a.cluster}` : '未分群') : a[k])).join(','))];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ───────────────────────── 來源查核（分群 → 文章 → 全文） ─────────────────────────

const PAGE = 20;

export async function renderSources(root, { params, query }) {
  const view = mount(root, 'view--sources');
  const an = await loadOr404(view, params.id);
  if (!an) return;
  if (an.status !== 'completed') { navigate(`/analysis/${an.id}`, {}, { replace: true }); return; }
  const res = await getResults(an.id);
  const c = res.clusters.find((x) => x.id === Number(query.cluster));
  const resultHref = href(`/analysis/${an.id}`, { tab: 'clusters', c: c?.id });
  if (!c) {
    view.innerHTML = html`${pageHead({ title: '找不到這個分群', desc: '分群可能不存在於這份分析。', crumbs: [{ label: '社群口碑分析', href: '#/' }, { label: an.name, href: resultHref }, { label: '來源文章' }] })}
      ${errorBlock({ title: '無法顯示來源文章', body: '請回到分析結果，從分群重新進入。', actions: html`<a class="btn btn--secondary" href="${resultHref}">回到分析結果</a>` })}`;
    focusTitle(view);
    return;
  }
  const articles = await getArticles({ cluster: c.id });
  if (!view.isConnected) return;
  const state = { src: query.src || 'all', sent: query.sent || 'all', q: query.q || '', sort: query.sort || 'date-desc', page: Number(query.page) || 1 };

  view.innerHTML = html`
    ${pageHead({
      title: `來源文章：分群 ${c.id}`,
      desc: `分群 ${c.id} 的 ${fmtN(articles.length)} 篇主文。${firstSentence(c.summary)}`,
      crumbs: [{ label: '社群口碑分析', href: '#/' }, { label: an.name, href: resultHref }, { label: `分群 ${c.id} 來源文章` }],
    })}
    <div class="back-row"><a class="text-link" href="${resultHref}">${raw(icon('arrowLeft', { size: 16 }))}返回分群摘要</a></div>
    <section class="zone zone--filters" aria-label="篩選來源文章">
      <div class="filters">
        <div class="field">
          <label class="field__label" for="s-cluster">切換分群</label>
          <select id="s-cluster" class="select">${res.clusters.map((x) => html`<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>分群 ${x.id}（${fmtN(x.count)}）</option>`)}</select>
        </div>
        <div class="field field--search">
          <label class="field__label" for="s-q">搜尋標題或內文</label>
          <div class="input-wrap">${raw(icon('search', { size: 16 }))}<input id="s-q" class="input" type="search" value="${state.q}" autocomplete="off"></div>
        </div>
        <div class="field">
          <label class="field__label" for="s-src">來源</label>
          <select id="s-src" class="select"><option value="all">全部來源</option>${[...new Set(articles.map((a) => a.source))].map((p) => html`<option value="${p}" ${state.src === p ? 'selected' : ''}>${p}</option>`)}</select>
        </div>
        <div class="field">
          <label class="field__label" for="s-sent">情緒</label>
          <select id="s-sent" class="select"><option value="all">全部情緒</option>${['正面', '中立', '負面'].map((p) => html`<option value="${p}" ${state.sent === p ? 'selected' : ''}>${p}</option>`)}</select>
        </div>
        <div class="field">
          <label class="field__label" for="s-sort">排序</label>
          <select id="s-sort" class="select">${[['date-desc', '發布時間：新到舊'], ['date-asc', '發布時間：舊到新'], ['eng-desc', '互動數：高到低']].map(([v, l]) => html`<option value="${v}" ${state.sort === v ? 'selected' : ''}>${l}</option>`)}</select>
        </div>
      </div>
    </section>
    <section class="zone zone--data" aria-label="文章清單" id="article-zone"></section>`;
  focusTitle(view);

  const keep = () => ({ cluster: c.id, src: state.src === 'all' ? '' : state.src, sent: state.sent === 'all' ? '' : state.sent, q: state.q, sort: state.sort === 'date-desc' ? '' : state.sort, page: state.page > 1 ? state.page : '' });
  const filtered = () => {
    const needle = state.q.trim().toLowerCase();
    const rows = articles.filter((a) => (state.src === 'all' || a.source === state.src) && (state.sent === 'all' || a.sentiment === state.sent)
      && (!needle || `${a.title} ${a.body}`.toLowerCase().includes(needle)));
    return rows.sort((x, y) => (state.sort === 'eng-desc' ? y.engagement - x.engagement
      : state.sort === 'date-asc' ? x.publishedAt.localeCompare(y.publishedAt) : y.publishedAt.localeCompare(x.publishedAt)));
  };
  const renderList = () => {
    const rows = filtered();
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    state.page = Math.min(state.page, pages);
    const slice = rows.slice((state.page - 1) * PAGE, state.page * PAGE);
    history.replaceState(null, '', href(`/analysis/${an.id}/sources`, keep()));
    $('#article-zone', view).innerHTML = rows.length ? html`
      <p class="list-count" aria-live="polite">顯示 ${fmtN(rows.length)} / ${fmtN(articles.length)} 篇 · 第 ${state.page} / ${pages} 頁</p>
      <ol class="article-list">${slice.map((a) => html`<li class="article-card">
        <div class="article-card__meta"><span class="num">${a.id}</span><span>${a.source} › ${a.site}</span><span class="num">${a.publishedAt}</span><span>${a.author}</span><span class="status-tag status-tag--${sentiTone(a.sentiment)}">${a.sentiment}</span><span class="num">互動 ${fmtN(a.engagement)}</span></div>
        <h3 class="article-card__title"><a href="${href(`/analysis/${an.id}/articles/${a.id}`, keep())}">${a.title || a.body.slice(0, 50)}</a></h3>
        <p class="article-card__excerpt">${a.body}</p>
      </li>`)}</ol>
      ${pages > 1 ? html`<nav class="pagination" aria-label="分頁">
        <button type="button" class="btn btn--ghost btn--sm" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>上一頁</button>
        <span class="muted num">${state.page} / ${pages}</span>
        <button type="button" class="btn btn--ghost btn--sm" data-page="${state.page + 1}" ${state.page === pages ? 'disabled' : ''}>下一頁</button>
      </nav>` : ''}`
      : html`<div class="empty-hero empty-hero--quiet"><h2 class="empty-hero__title">沒有符合條件的文章</h2>
          <p class="empty-hero__body">分群 ${c.id} 共有 ${fmtN(articles.length)} 篇文章，但沒有符合目前搜尋、來源或情緒條件的結果。</p>
          <button type="button" class="btn btn--secondary" data-action="clear">清除搜尋與篩選</button></div>`;
  };
  renderList();

  $('#s-q', view).addEventListener('input', debounce((e) => { state.q = e.target.value; state.page = 1; renderList(); }, 250));
  $('#s-src', view).addEventListener('change', (e) => { state.src = e.target.value; state.page = 1; renderList(); });
  $('#s-sent', view).addEventListener('change', (e) => { state.sent = e.target.value; state.page = 1; renderList(); });
  $('#s-sort', view).addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; renderList(); });
  $('#s-cluster', view).addEventListener('change', (e) => navigate(`/analysis/${an.id}/sources`, { cluster: e.target.value }));
  on(view, 'click', '[data-page]', (e, el) => { state.page = Number(el.dataset.page); renderList(); $('#article-zone', view).scrollIntoView({ block: 'start' }); });
  on(view, 'click', '[data-action="clear"]', () => {
    Object.assign(state, { q: '', src: 'all', sent: 'all', page: 1 });
    $('#s-q', view).value = ''; $('#s-src', view).value = 'all'; $('#s-sent', view).value = 'all';
    renderList();
    $('#s-q', view).focus();
  });
}

// ───────────────────────── 文章全文 ─────────────────────────

export async function renderArticle(root, { params, query }) {
  const view = mount(root, 'view--article');
  const an = await loadOr404(view, params.id);
  if (!an) return;
  if (an.status !== 'completed') { navigate(`/analysis/${an.id}`, {}, { replace: true }); return; }
  const res = await getResults(an.id);
  let a;
  try { a = await getArticle(params.aid); } catch {
    view.innerHTML = html`${pageHead({ title: '找不到這篇文章', crumbs: [{ label: '社群口碑分析', href: '#/' }, { label: an.name, href: `#/analysis/${an.id}` }, { label: '找不到文章' }] })}
      ${errorBlock({ title: `找不到文章 ${params.aid}`, body: '這篇文章不在這份分析的資料中。', actions: html`<a class="btn btn--secondary" href="#/analysis/${an.id}">回到分析結果</a>` })}`;
    focusTitle(view);
    return;
  }
  const ctxCluster = query.cluster ? Number(query.cluster) : null;
  const keep = { cluster: ctxCluster, src: query.src, sent: query.sent, q: query.q, sort: query.sort, page: query.page };
  const sourcesHref = ctxCluster ? href(`/analysis/${an.id}/sources`, keep) : null;
  const resultHref = query.from === 'insight' ? href(`/analysis/${an.id}`) : href(`/analysis/${an.id}`, { tab: 'clusters', c: a.cluster || '' });
  const c = a.cluster ? res.clusters.find((x) => x.id === a.cluster) : null;
  let prevId = null; let nextId = null; let pos = ''; let inCtx = false;
  if (ctxCluster) {
    const list = await getArticles({ cluster: ctxCluster });
    const i = list.findIndex((x) => x.id === a.id);
    inCtx = i >= 0;
    if (inCtx) { prevId = list[i - 1]?.id ?? null; nextId = list[i + 1]?.id ?? null; pos = `${i + 1} / ${list.length}`; }
  }
  track('source_article_opened', { analysisId: an.id, articleId: a.id, via: ctxCluster ? 'cluster' : query.from || 'direct' });
  const title = a.title || `${a.body.slice(0, 40)}…`;

  view.innerHTML = html`
    ${pageHead({
      title,
      crumbs: [
        { label: '社群口碑分析', href: '#/' },
        { label: an.name, href: resultHref },
        ...(ctxCluster ? [{ label: `分群 ${ctxCluster} 來源文章`, href: sourcesHref }] : []),
        { label: a.id },
      ],
      meta: html`<div class="meta-row">
        <span class="meta-item num">${a.id}</span><span class="meta-item">${a.source} › ${a.site}</span>
        <span class="meta-item">作者 ${a.author}</span><span class="meta-item num">${a.publishedAt}</span>
        <span class="status-tag status-tag--${sentiTone(a.sentiment)}">${a.sentiment}</span></div>`,
    })}
    <div class="back-row">
      ${sourcesHref ? html`<a class="text-link" href="${sourcesHref}">${raw(icon('arrowLeft', { size: 16 }))}返回分群 ${ctxCluster} 來源列表</a>` : ''}
      <a class="text-link" href="${resultHref}">${sourcesHref ? '' : raw(icon('arrowLeft', { size: 16 }))}回到分析結果</a>
    </div>
    <div class="article-layout">
      <article class="article-body" aria-label="文章全文">
        ${a.body.split(/\n+/).map((p) => html`<p>${p}</p>`)}
        ${a.body.length >= 199 ? html`<p class="muted">OpView 匯出的內文以約 200 字為上限，完整內容請開啟原始貼文。</p>` : ''}
        <p class="article-body__src muted">原始貼文：${a.url ? html`<a class="text-link" href="${a.url}" target="_blank" rel="noopener noreferrer">在新分頁開啟（外部網站）</a>` : '無連結'}</p>
      </article>
      <aside class="article-aside" aria-label="分析脈絡">
        <h2 class="subpanel__title">這篇文章在分析中的位置</h2>
        ${ctxCluster && !inCtx ? html`<p class="notice notice--warn">這篇文章不屬於分群 ${ctxCluster}。</p>` : ''}
        <dl class="summary__list summary__list--stack">
          <div><dt>所屬分群</dt><dd>${c ? html`<a class="text-link" href="${href(`/analysis/${an.id}/sources`, { cluster: c.id })}">分群 ${c.id}</a>` : '未歸入分群'}</dd></div>
          <div><dt>互動</dt><dd class="num">按讚／觀看 ${fmtN(a.likes)} · 分享 ${fmtN(a.shares)} · 留言 ${fmtN(a.comments)}</dd></div>
          <div><dt>討論串回文數</dt><dd class="num">${fmtN(a.replies)}</dd></div>
        </dl>
        ${pos ? html`<nav class="pager" aria-label="同一分群列表中的文章">
          ${prevId ? html`<a class="btn btn--ghost btn--sm" href="${href(`/analysis/${an.id}/articles/${prevId}`, keep)}">${raw(icon('arrowLeft', { size: 14 }))}上一篇</a>` : html`<span></span>`}
          <span class="muted num">${pos}</span>
          ${nextId ? html`<a class="btn btn--ghost btn--sm" href="${href(`/analysis/${an.id}/articles/${nextId}`, keep)}">下一篇${raw(icon('arrowRight', { size: 14 }))}</a>` : html`<span></span>`}
        </nav>` : ''}
      </aside>
    </div>`;
  focusTitle(view);
  window.scrollTo(0, 0);
}
