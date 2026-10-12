// ds-sense 產出 — Mock service：UI 與資料的唯一邊界。
// 未來接 API 時，只要以相同的 async 介面替換本檔即可；UI 不直接碰 localStorage 的分析資料。
// 所有「分析」都是模擬：不呼叫任何模型、不送出任何網路請求、不保存使用者檔案內容。

import { DEMO_DATASET, USERS, CURRENT_USER, DIRECTORY, buildSeedAnalyses } from '../data/seed.js';
import { WATSONS } from '../data/watsons.js';

const KEY = 'clue-poc:db:v3';   // v2：改用屈臣氏範本資料，舊的合成資料不沿用
const LATENCY = 280;           // 模擬網路延遲（ms）
const PROCESS_MS = 5000;       // 模擬處理時間（ms）；畫面不顯示百分比或剩餘時間

export class ServiceError extends Error {
  constructor(code, message, detail = {}) { super(message); this.code = code; this.detail = detail; }
}

const wait = (ms = LATENCY) => new Promise((r) => setTimeout(r, ms));
const clone = (o) => structuredClone(o);

function load() {
  try {
    const db = JSON.parse(localStorage.getItem(KEY));
    if (db?.analyses) return db;
  } catch { /* fallthrough */ }
  return freshDb();
}
function freshDb() {
  return { analyses: buildSeedAnalyses(), seq: 3000, usedKeys: {}, flags: { failNext: false } };
}
let db = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(db));
save();

/** 讓到期的模擬處理轉為完成／失敗（刷新後也成立，因為以時間戳判斷）。 */
function settle() {
  const now = Date.now();
  let changed = false;
  for (const an of db.analyses) {
    if (an.status === 'processing' && an.completeAt && an.completeAt <= now) {
      if (an.willFail) {
        an.status = 'failed';
        an.failure = { code: 'SIMULATED_FAILURE', message: '模擬分析在處理時失敗（由 POC 情境面板觸發）。' };
      } else {
        an.status = 'completed';
        delete an.failure;
      }
      an.updatedAt = new Date(an.completeAt).toISOString();
      delete an.completeAt;
      delete an.willFail;
      changed = true;
    }
  }
  if (changed) save();
}

const visible = (an) => an.access !== 'none';

export const ownerName = (an) => USERS[an.ownerId]?.name ?? '未知使用者';

// ───────────────────────── Analyses ─────────────────────────

export async function listAnalyses({ tab = 'mine', q = '', status = 'all', sort = 'updated-desc' } = {}) {
  await wait();
  settle();
  const needle = q.trim().toLowerCase();
  let rows = db.analyses.filter(visible).filter((an) =>
    tab === 'mine' ? an.ownerId === CURRENT_USER.id : an.ownerId !== CURRENT_USER.id);
  const totalInTab = rows.length;
  if (status !== 'all') rows = rows.filter((an) => an.status === status);
  if (needle) rows = rows.filter((an) => `${an.name} ${an.brand} ${an.client}`.toLowerCase().includes(needle));
  const [field, dir] = sort.split('-');
  rows.sort((x, y) => {
    const v = field === 'name' ? x.name.localeCompare(y.name, 'zh-Hant') : x.updatedAt.localeCompare(y.updatedAt);
    return dir === 'asc' ? v : -v;
  });
  // 置頂專案固定在最上方（各自維持原排序）
  rows = [...rows.filter((an) => an.pinned), ...rows.filter((an) => !an.pinned)];
  return { rows: clone(rows), totalInTab };
}

/** 置頂：每位使用者各自的偏好；POC 只存在於本機示範資料 */
export async function setPinned(id, pinned) {
  await wait(120);
  const an = db.analyses.find((x) => x.id === id && visible(x));
  if (!an) throw new ServiceError('NOT_FOUND', `找不到專案 ${id}`);
  an.pinned = !!pinned;
  save();
  return an.pinned;
}

export async function getAnalysis(id) {
  await wait();
  settle();
  const an = db.analyses.find((x) => x.id === id);
  if (!an) throw new ServiceError('NOT_FOUND', `找不到分析 ${id}`);
  if (an.access === 'none') throw new ServiceError('FORBIDDEN', '沒有這份分析的存取權限', { ownerName: ownerName(an) });
  return clone(an);
}

/** 只回傳狀態（處理中頁面輪詢用；不含進度百分比，因為後端沒有提供） */
export async function getStatus(id) {
  settle();
  const an = db.analyses.find((x) => x.id === id);
  return an ? an.status : 'missing';
}

/**
 * 建立分析。idempotencyKey 由 wizard 產生；同一把 key 重複送出只會得到同一筆分析。
 * draft 不含檔案內容，只含檔名/大小等中繼資料。
 */
export async function createAnalysis(draft, idempotencyKey) {
  await wait(600);
  if (db.usedKeys[idempotencyKey]) return clone(db.analyses.find((x) => x.id === db.usedKeys[idempotencyKey]));
  const now = Date.now();
  const an = {
    id: `AN-${++db.seq}`,
    name: draft.name.trim(),
    client: draft.clientName.trim(),
    brand: '',
    clientType: draft.clientType,
    taxId: draft.taxId || '',
    industry: draft.industry,
    subIndustry: draft.subIndustry,
    mode: draft.mode,
    status: 'processing',
    ownerId: CURRENT_USER.id,
    access: 'owner',
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    researchQuestion: draft.researchQuestion?.trim() ?? '',
    dataset: {
      source: draft.source,
      platform: draft.platform || 'opview',
      datasetId: draft.source === 'demo' ? DEMO_DATASET.id : null,
      files: draft.files.map(({ name, size }) => ({ name, size, kind: 'article' })),
      keywordFile: draft.keywordFiles?.[0] ? { ...draft.keywordFiles[0] } : null,
      keywordFiles: (draft.keywordFiles || []).map(({ name, size }) => ({ name, size })),
    },
    settings: clone(draft.settings),
    sharedWith: [],
    completeAt: now + PROCESS_MS,
    willFail: db.flags.failNext,
  };
  db.flags.failNext = false;
  db.analyses.unshift(an);
  db.usedKeys[idempotencyKey] = an.id;
  save();
  return clone(an);
}

/** POC 決策：重試沿用同一筆分析並覆蓋結果（正式行為：新增工作 / 覆蓋 / 成本 待確認） */
export async function retryAnalysis(id) {
  await wait(500);
  const an = db.analyses.find((x) => x.id === id);
  if (!an || an.access !== 'owner') throw new ServiceError('FORBIDDEN', '只有擁有者可以重試');
  if (an.status !== 'failed') return clone(an);
  an.status = 'processing';
  an.completeAt = Date.now() + PROCESS_MS;
  an.willFail = db.flags.failNext;
  db.flags.failNext = false;
  delete an.failure;
  an.updatedAt = new Date().toISOString();
  save();
  return clone(an);
}

// ───────────────────────── Results ─────────────────────────
// POC 範本：所有已完成的分析，都以屈臣氏 2022Q4 測試資料（真實上傳檔＋既有分群輸出）呈現。
// 統計、關鍵字、矩陣都由 scripts/build-watsons-data.cjs 從原始檔實算；文章 ID 與分群一一對應。

export async function getResults(id) {
  const an = await getAnalysis(id);
  if (an.status !== 'completed') throw new ServiceError('NOT_READY', '分析尚未完成');
  return { analysisId: an.id, ...clone(WATSONS) };
}

// ───────────────────────── Articles（文章檔較大，第一次需要時才載入） ─────────────────────────

let articleCache;
async function allArticles() {
  if (!articleCache) articleCache = (await import('../data/watsons-articles.js')).WATSONS_ARTICLES;
  return articleCache;
}

/** 取某分群的文章（cluster 為 null 時取全部主文） */
export async function getArticles({ cluster = null } = {}) {
  await wait(150);
  const list = await allArticles();
  return cluster == null ? list : list.filter((a) => a.cluster === Number(cluster));
}

export async function getArticle(id) {
  await wait(150);
  const a = (await allArticles()).find((x) => x.id === id);
  if (!a) throw new ServiceError('NOT_FOUND', `找不到文章 ${id}`);
  return clone(a);
}

// ───────────────────────── 刪除（只有擁有者；POC 只從本機示範資料移除） ─────────────────────────

export async function deleteAnalysis(id) {
  await wait(400);
  const an = db.analyses.find((x) => x.id === id);
  if (!an) throw new ServiceError('NOT_FOUND', `找不到分析 ${id}`);
  if (an.access !== 'owner') throw new ServiceError('FORBIDDEN', '只有擁有者可以刪除專案');
  db.analyses = db.analyses.filter((x) => x.id !== id);
  save();
}

// ───────────────────────── Sharing（只示範可見對象，不改權限、不發通知） ─────────────────────────

export const shareDirectory = () => clone(DIRECTORY);

/** 分享：只有擁有者；新增「檢視者」。POC 不寄信、不改正式權限。 */
export async function shareAnalysis(id, userIds) {
  await wait(500);
  const an = db.analyses.find((x) => x.id === id);
  if (!an) throw new ServiceError('NOT_FOUND', `找不到專案 ${id}`);
  if (an.access !== 'owner') throw new ServiceError('FORBIDDEN', '只有擁有者可以分享');
  for (const uid of userIds) {
    if (uid !== an.ownerId && USERS[uid] && !an.sharedWith.some((s) => s.userId === uid)) an.sharedWith.push({ userId: uid, role: 'viewer' });
  }
  save();
  return clone(an);
}

export function shareInfo(an) {
  return {
    owner: { ...USERS[an.ownerId], role: 'owner' },
    members: an.sharedWith.map((s) => ({ ...USERS[s.userId], role: s.role })),
  };
}

// ───────────────────────── POC 情境控制（只給情境面板用） ─────────────────────────

export const scenario = {
  reset() { db = freshDb(); save(); },
  empty() { db.analyses = db.analyses.filter((an) => an.ownerId !== CURRENT_USER.id); save(); },
  setFailNext(v) { db.flags.failNext = !!v; save(); },
  get failNext() { return db.flags.failNext; },
  completeProcessing() {
    db.analyses.forEach((an) => { if (an.status === 'processing') an.completeAt = Date.now() - 1; });
    settle();
  },
  counts() {
    const mine = db.analyses.filter((an) => an.ownerId === CURRENT_USER.id);
    return { mine: mine.length, processing: mine.filter((x) => x.status === 'processing').length };
  },
};
