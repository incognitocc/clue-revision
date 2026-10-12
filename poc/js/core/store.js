import { sanitizeProjectName } from '../data/industries.js';
// ds-sense 產出 — 介面狀態（非分析資料）
// - 工作台條件：tab / 搜尋 / 狀態 / 排序 / 分頁 / 捲動位置 → localStorage
// - 建立分析草稿：文字與設定 → localStorage；File 物件只存在記憶體，刷新後需重新選檔
// - 最近開啟：側欄捷徑

const UI_KEY = 'clue-poc:ui:v1';
const DRAFT_KEY = 'clue-poc:draft:v1';

export const DEFAULT_LIST = { tab: 'mine', q: '', status: 'all', sort: 'updated-desc', page: 1, scrollY: 0 };

const readJSON = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };

const ui = readJSON(UI_KEY, { list: { ...DEFAULT_LIST }, recent: [] });

export const store = {
  get list() { return ui.list; },
  setList(patch) { Object.assign(ui.list, patch); persistUi(); },
  resetListFilters() { Object.assign(ui.list, { q: '', status: 'all', page: 1, scrollY: 0 }); persistUi(); },

  get recent() { return ui.recent; },
  pushRecent(an) {
    ui.recent = [{ id: an.id, name: an.name }, ...ui.recent.filter((r) => r.id !== an.id)].slice(0, 5);
    persistUi();
  },
  dropRecent() { ui.recent = []; persistUi(); },
  dropRecentItem(id) { ui.recent = ui.recent.filter((r) => r.id !== id); persistUi(); document.dispatchEvent(new CustomEvent('recent-changed')); },
};
function persistUi() { localStorage.setItem(UI_KEY, JSON.stringify(ui)); }

// ───────── 建立分析草稿 ─────────

export const DEFAULT_SETTINGS = {
  cluster: { clusterCount: 6, minArticles: 3 },
  ai: { language: 'zh-TW' },
};

function newDraft() {
  return {
    key: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, // 冪等鍵：防重複建立
    step: 1,
    name: '',                // 專案命名
    clientType: 'existing',  // existing｜new
    clientName: '',          // 客戶公司名稱
    taxId: '',               // 統一編號（創建新客戶時必填，8 碼）
    industry: '',            // 客戶產業大類
    subIndustry: '',         // 客戶產業子類
    matchNote: '',           // 「AI 搜尋比對」結果說明（POC 模擬）
    mode: 'cluster',         // 分析模式已不在畫面上選擇，新專案固定為話題分群（4 個結果分頁）
    researchQuestion: '',
    client: '',
    brand: '',
    platform: 'opview',      // 資料來源平台：opview｜keypo｜qsearch
    source: 'demo',          // 檔案來源：demo（範本）｜local（本機上傳）
    fileMeta: [],         // 刷新後用來提示「曾選過哪些檔案」
    keywordMeta: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    submittedId: null,
  };
}

let files = [];            // File[]（只在記憶體）
let keywordFiles = [];     // File[]（與文章檔相同：只在記憶體）
let draft = readJSON(DRAFT_KEY, null);
if (draft) draft = { ...newDraft(), ...draft, key: draft.key || newDraft().key, mode: draft.mode || 'cluster' };
// 刷新後 File 物件消失：保留中繼資料讓畫面明確要求重新選檔
const metaList = (m) => (Array.isArray(m) ? m : m ? [m] : []);
if (draft) draft.keywordMeta = metaList(draft.keywordMeta);
const lostFilesOnLoad = !!(draft && (draft.fileMeta?.length || draft.keywordMeta?.length));

export const wizard = {
  get draft() { if (!draft) { draft = newDraft(); persistDraft(); } return draft; },
  get files() { return files; },
  get keywordFiles() { return keywordFiles; },
  get lostFiles() { return lostFilesOnLoad && files.length === 0 && !!draft?.fileMeta?.length; },
  get lostKeyword() { return lostFilesOnLoad && keywordFiles.length === 0 && !!draft?.keywordMeta?.length; },
  update(patch) { Object.assign(this.draft, patch); persistDraft(); },
  setFiles(next) {
    files = next;
    this.draft.fileMeta = next.map((f) => ({ name: f.name, size: f.size }));
    persistDraft();
  },
  setKeywordFiles(next) {
    keywordFiles = next;
    this.draft.keywordMeta = next.map((f) => ({ name: f.name, size: f.size }));
    persistDraft();
  },
  clearLostFileHints() { this.draft.fileMeta = files.map((f) => ({ name: f.name, size: f.size })); this.draft.keywordMeta = keywordFiles.map((f) => ({ name: f.name, size: f.size })); persistDraft(); },
  reset() { draft = newDraft(); files = []; keywordFiles = []; persistDraft(); },
  /** 由失敗分析「修改後重新建立」：帶入文字與設定，檔案需重選 */
  prefillFrom(an) {
    this.reset();
    Object.assign(draft, {
      name: `${sanitizeProjectName(an.name).slice(0, 50)}-重新建立`,
      clientName: an.client,
      industry: an.industry || '',
      subIndustry: an.subIndustry || '',
      mode: an.mode || 'cluster',
      source: an.dataset.source === 'demo' ? 'demo' : 'local',
      settings: { ...structuredClone(DEFAULT_SETTINGS), [an.mode]: structuredClone(an.settings) },
    });
    persistDraft();
  },
};
function persistDraft() { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); }
