// ds-sense 產出 — POC 情境面板（評審／開發用，與正式產品操作分開，只能從 POC 標示列與頁尾進入）
import { html, raw, on, $, MB, toast, fmtDateTime } from '../core/dom.js';
import { navigate } from '../core/router.js';
import { store, wizard } from '../core/store.js';
import { scenario } from '../services/mock-service.js';
import { read as readEvents, clear as clearEvents } from '../core/telemetry.js';
import { pageHead } from './ui.js';
import { icon } from './icons.js';

export function renderPocPanel(root) {
  const view = document.createElement('div');
  view.className = 'view view--poc';
  const c = scenario.counts();
  view.innerHTML = html`
    ${pageHead({
      title: 'POC 情境面板',
      desc: '給評審重現各種狀態。這裡的控制只存在於 POC，不屬於正式產品操作。',
      crumbs: [{ label: '社群口碑分析', href: '#/' }, { label: 'POC 情境面板' }],
    })}
    <div class="scenario-grid">
      ${card('正常', '重設為初始示範資料（12 筆我的分析、2 筆與我分享）；也會還原已刪除的專案。也會清除建立分析草稿與清單篩選條件。', html`
        <button type="button" class="btn btn--secondary btn--sm" data-act="reset">重設示範資料</button>`)}
      ${card('空資料', `清空「我的分析」，查看尚未建立分析時的清單頁。目前有 ${c.mine} 筆。`, html`
        <button type="button" class="btn btn--secondary btn--sm" data-act="empty">清空我的分析</button>`)}
      ${card('搜尋無結果', '以不存在的關鍵字搜尋分析清單，查看篩選無結果的下一步。', html`
        <button type="button" class="btn btn--secondary btn--sm" data-act="no-result">前往搜尋無結果</button>`)}
      ${card('處理中', `開啟處理中的分析。目前有 ${c.processing} 筆處理中；示範用的「秋季促銷聲量追蹤」不會自動完成。`, html`
        <a class="btn btn--secondary btn--sm" href="#/analysis/AN-1003">開啟處理中分析</a>
        <button type="button" class="btn btn--ghost btn--sm" data-act="complete">讓處理中分析完成</button>`)}
      ${card('格式／大小錯誤', '帶入預填的建立流程，並載入三個錯誤示範檔：PDF 格式、16 MB 超過上限、0 bytes 空檔。', html`
        <button type="button" class="btn btn--secondary btn--sm" data-act="bad-files">載入錯誤檔案</button>`)}
      ${card('分析失敗與重試', '開啟失敗分析並測試重試。開啟下方開關後，下一次送出或重試的分析會失敗。', html`
        <a class="btn btn--secondary btn--sm" href="#/analysis/AN-1004">開啟失敗分析</a>
        <label class="switch">
          <input type="checkbox" role="switch" data-act="fail-next" ${scenario.failNext ? 'checked' : ''}>
          <span class="switch__track" aria-hidden="true"><span class="switch__knob"></span></span>
          <span>下一次執行失敗</span>
        </label>`)}
      ${card('唯讀／無權限', '同事分享的分析是唯讀；無權限的分析不會顯示任何內容；不存在的 ID 會提供返回路徑。', html`
        <a class="btn btn--secondary btn--sm" href="#/analysis/AN-2001">唯讀分析</a>
        <a class="btn btn--ghost btn--sm" href="#/analysis/AN-2003">無權限</a>
        <a class="btn btn--ghost btn--sm" href="#/analysis/AN-9999">不存在的 ID</a>`)}
      ${card('長標題／長文章', '名稱超長的分析，以及標題超長、內文達匯出上限的真實文章。', html`
        <a class="btn btn--secondary btn--sm" href="#/analysis/AN-1005">長標題分析</a>
        <a class="btn btn--ghost btn--sm" href="#/analysis/AN-1005/articles/W-1693?cluster=5">長標題文章</a>`)}
    </div>

    <section class="result-section" aria-labelledby="ev-title">
      <div class="section-head">
        <h2 id="ev-title" class="section-title">本機事件紀錄</h2>
        <button type="button" class="btn btn--ghost btn--sm" data-act="clear-events">清除紀錄</button>
      </div>
      <p class="section-desc">事件只寫入這個瀏覽器的 localStorage，不傳送到 GA 或任何服務，也不包含文章全文或個資。</p>
      <div id="ev-table"></div>
    </section>`;
  root.replaceChildren(view);
  renderEvents(view);

  on(view, 'click', '[data-act="reset"]', () => {
    scenario.reset(); wizard.reset(); store.resetListFilters(); store.setList({ tab: 'mine', sort: 'updated-desc' }); store.dropRecent();
    document.dispatchEvent(new CustomEvent('recent-changed'));
    toast('已重設為初始示範資料');
    navigate('/');
  });
  on(view, 'click', '[data-act="empty"]', () => {
    scenario.empty(); store.resetListFilters(); store.setList({ tab: 'mine' }); store.dropRecent();
    document.dispatchEvent(new CustomEvent('recent-changed'));
    navigate('/');
  });
  on(view, 'click', '[data-act="no-result"]', () => {
    store.setList({ tab: 'mine', q: '不存在的分析名稱', status: 'all', page: 1, scrollY: 0 });
    navigate('/');
  });
  on(view, 'click', '[data-act="complete"]', () => {
    scenario.completeProcessing();
    toast('處理中的分析已完成');
    renderPocPanel(root);
  });
  on(view, 'change', '[data-act="fail-next"]', (e, el) => {
    scenario.setFailNext(el.checked);
    toast(el.checked ? '下一次執行會失敗' : '已關閉失敗模擬');
  });
  on(view, 'click', '[data-act="bad-files"]', () => {
    wizard.reset();
    wizard.update({ name: '錯誤檔案示範', clientName: '屈臣氏', industry: '零售與通路', subIndustry: '藥妝與生活用品', mode: 'cluster', source: 'local' });
    // 合成 File 物件（只在記憶體）；內容是空白位元組，不含任何真實資料
    wizard.setFiles([
      new File(['%PDF-demo'], 'brief_report.pdf', { type: 'application/pdf' }),
      new File([new Uint8Array(16 * MB)], 'big_export.csv', { type: 'text/csv' }),
      new File([], 'empty.csv', { type: 'text/csv' }),
    ]);
    navigate('/create/2');
  });
  on(view, 'click', '[data-act="clear-events"]', () => { clearEvents(); renderEvents(view); });
}

function card(title, body, actions) {
  return html`<section class="scenario-card">
    <h2 class="scenario-card__title">${title}</h2>
    <p class="scenario-card__body">${body}</p>
    <div class="scenario-card__actions">${actions}</div>
  </section>`;
}

function renderEvents(view) {
  const evs = readEvents().slice(0, 20);
  $('#ev-table', view).innerHTML = evs.length ? html`<div class="table-wrap"><table class="table">
    <caption class="sr-only">最近 20 筆本機事件</caption>
    <thead><tr><th scope="col">時間</th><th scope="col">事件</th><th scope="col">屬性</th></tr></thead>
    <tbody>${evs.map((e) => html`<tr><td class="num" data-label="時間">${fmtDateTime(e.at)}</td><td data-label="事件"><code>${e.name}</code></td><td data-label="屬性"><code class="break">${JSON.stringify(e.props)}</code></td></tr>`)}</tbody>
  </table></div>` : html`<p class="muted">${raw(icon('clock', { size: 14 }))} 尚無事件。操作建立分析、查看結果或開啟來源後會出現在這裡。</p>`;
}
