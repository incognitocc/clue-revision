// ds-sense 產出 — 專案基本資訊用的示範資料
// 產業分類與「既有客戶」清單皆為 POC 示範；正式分類沿用公司內部標準、客戶清單來自 CRM／主檔（待確認）。

export const INDUSTRIES = {
  '零售與通路': ['藥妝與生活用品', '超市與量販', '便利商店', '電商平台'],
  '食品飲料': ['乳品與植物飲', '零食點心', '即飲茶與咖啡', '酒類'],
  '美妝保養': ['彩妝', '保養品', '個人清潔', '香氛'],
  '金融保險': ['銀行', '保險', '證券投資', '支付與金融科技'],
  '科技與電信': ['消費性電子', '電信', '軟體與服務', '遊戲'],
  '汽車與交通': ['汽機車', '大眾運輸', '共享出行'],
  '其他': ['其他'],
};

/** POC 的「既有客戶」示範清單（供「AI 搜尋比對」模擬使用，不是真實客戶主檔） */
export const MOCK_CLIENTS = [
  { name: '屈臣氏', alias: ['Watsons', '小屈'], industry: '零售與通路', sub: '藥妝與生活用品' },
  { name: '晨光食品股份有限公司', alias: ['晨光燕麥飲'], industry: '食品飲料', sub: '乳品與植物飲' },
  { name: '示範美妝集團', alias: [], industry: '美妝保養', sub: '彩妝' },
  { name: '示範銀行', alias: [], industry: '金融保險', sub: '銀行' },
  { name: '示範電信股份有限公司', alias: [], industry: '科技與電信', sub: '電信' },
];

export function matchClients(text) {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  return MOCK_CLIENTS.filter((c) => [c.name, ...c.alias].some((n) => n.toLowerCase().includes(q) || q.includes(n.toLowerCase())));
}

// 專案命名規則（依設計稿提示）：中英文大小寫字母與數字，避免使用 - _ 以外的符號與空白
export const PROJECT_NAME_RE = /^[\p{Script=Han}A-Za-z0-9_-]+$/u;
export const sanitizeProjectName = (s) => s.replace(/[^\p{Script=Han}A-Za-z0-9_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60);
