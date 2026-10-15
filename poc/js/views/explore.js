import { $, html } from '../core/dom.js';

const templates = [
  ['熱門議題尋找', '品類的討論趨勢與熱門話題，依平台列出代表文章', '前期提案'],
  ['貼文發想', '依切角整理高互動文章，建議怎麼帶起討論', '前期提案'],
  ['市場調查', '歸納消費者常提到的未滿足需求或痛點', '前期提案'],
  ['切角尋找', '盤點競品溝通主軸，找出可以切入的空白點', '前期提案'],
  ['本競品調查', '比較品牌與競品的聲量、情緒與重要事件', '前期提案'],
  ['Brief 發想', '根據前面的市場與競品摘要整理 Brief', '前期提案'],
  ['品牌健康監測', '追蹤品牌聲量與情緒變化，掌握討論焦點', '執行與監測'],
  ['活動成效回顧', '整理活動討論與受眾回饋，作為下次規劃參考', '結案與規劃'],
];
// Session-only demonstration history; replace the response boundary when the Agent API is available.
const sessions = [];
let activeId = null;

export function renderExplore(root) {
  let category = '前期提案';
  root.innerHTML = html`<section class="explore" aria-label="OpView 即時探索">
    <aside class="explore__history" aria-label="探索紀錄">
      <h2>探索紀錄</h2>
      <button class="btn btn--primary" id="explore-new" type="button">＋ 新探索</button>
      <div id="explore-history"></div>
      <p class="field__hint">紀錄保留於本次瀏覽期間</p>
    </aside>
    <div class="explore__workspace">
      <div class="explore__scroll" id="explore-scroll">
        <header class="explore__head"><p class="explore__eyebrow">OpView 即時探索</p>
          <h1 class="page-title" tabindex="-1" data-doc-title="OpView 即時探索">今天想從社群找什麼答案？</h1>
          <p>選一個探索模板填入品牌與期間，或直接在下方輸入問題。</p>
        </header>
        <section id="explore-templates" aria-label="探索模板">
          <div class="explore__categories" aria-label="模板分類">${['常用', '前期提案', '執行與監測', '結案與規劃', '全部'].map(c => html`<button class="btn btn--secondary btn--sm" type="button" data-category="${c}" aria-pressed="${c === category}">${c}</button>`)}</div>
          <h2 class="explore__category-title" id="explore-category">前期提案</h2>
          <div class="explore__cards" id="explore-cards"></div>
        </section>
        <div id="explore-messages" role="log" aria-label="探索對話" aria-live="polite"></div>
      </div>
      <form class="explore__composer" id="explore-form">
        <label class="field__label" for="explore-input">你的問題</label>
        <div class="explore__input-row"><textarea class="textarea" id="explore-input" rows="3" maxlength="4000" placeholder="輸入品牌、想探索的問題與查詢期間…" required></textarea>
          <button class="btn btn--primary explore__send" type="submit" aria-label="送出" title="送出"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5m-7 7 7-7 7 7"/></svg></button></div>
        <p class="field__hint">示範模式 · 尚未連接 OpView Agent，回覆不含即時社群資料。Enter 送出，Shift + Enter 換行。</p>
      </form>
    </div>
  </section>`;
  const input = $('#explore-input', root);
  function drawCards() {
    $('#explore-category', root).textContent = category;
    $('#explore-cards', root).innerHTML = html`${templates.map((t, i) => ({ t, i })).filter(({ t, i }) => category === '全部' || (category === '常用' ? [0, 2, 6].includes(i) : t[2] === category)).map(({ t, i }) => html`<button class="explore__card" type="button" data-template="${i}"><strong>${t[0]}</strong><span>${t[1]}</span>${i === 5 ? html`<small>接續前一題</small>` : ''}</button>`)}`;
  }
  function drawConversation() {
    const active = sessions.find(s => s.id === activeId);
    $('#explore-templates', root).hidden = Boolean(active);
    $('#explore-history', root).innerHTML = sessions.length ? html`${sessions.map(s => html`<button type="button" class="explore__record" data-session="${s.id}" aria-pressed="${s.id === activeId}">${s.title}</button>`)}` : html`<p class="field__hint">尚無探索紀錄，從一個問題開始。</p>`;
    $('#explore-messages', root).innerHTML = html`${(active?.messages || []).map(m => html`<article class="explore__message explore__message--${m.role}"><strong>${m.role === 'user' ? '你' : 'OpView 助理 · 示範'}</strong><p>${m.text}</p></article>`)}`;
  }
  $('#explore-new', root).addEventListener('click', () => { activeId = null; input.value = ''; drawConversation(); input.focus(); });
  $('.explore__categories', root).addEventListener('click', e => {
    const button = e.target.closest('[data-category]');
    if (!button) return;
    category = button.dataset.category;
    $('.explore__categories', root).querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    drawCards();
  });
  $('#explore-cards', root).addEventListener('click', e => {
    const button = e.target.closest('[data-template]');
    if (!button) return;
    const t = templates[Number(button.dataset.template)];
    input.value = `我想進行「${t[0]}」。品牌／品類：請填入；查詢期間：請填入。${t[1]}。`;
    input.focus();
  });
  $('#explore-history', root).addEventListener('click', e => {
    const button = e.target.closest('[data-session]');
    if (!button) return;
    activeId = button.dataset.session; input.value = ''; drawConversation();
  });
  $('#explore-form', root).addEventListener('submit', e => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question) { input.focus(); return; }
    let active = sessions.find(s => s.id === activeId);
    if (!active) {
      active = { id: crypto.randomUUID(), title: question.slice(0, 32), messages: [] };
      sessions.unshift(active); activeId = active.id;
    }
    active.messages.push({ role: 'user', text: question });
    active.messages.push({ role: 'assistant', text: '已記錄你的探索問題。這是對話流程示範，目前尚未查詢 OpView 資料。\n\n你可以繼續補充品牌、競品、查詢期間與關注的平台；正式串接後，助理將依這些條件探索社群討論並提供來源。' });
    input.value = ''; drawConversation();
    const scroll = $('#explore-scroll', root); scroll.scrollTop = scroll.scrollHeight;
    input.focus();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#explore-form', root).requestSubmit(); }
  });
  drawCards(); drawConversation();
}
