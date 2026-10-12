# Raphael Compact Rubric

Raphael 20 條設計原則的精簡版。本文件回答「對不對」（結構與作法）；「像不像 Raphael」由 `raphael-taste-profile.md` 管，兩者互補。

> **數值一律以安裝的 DS tokens 為準。** 本文件出現的任何數字都是示意；DS token 有的值就是合法值。原則層永遠成立，數值層跟著 token 走。

## 動手前三問

- **Pain addressed**：這個畫面解決的是使用者真正卡住的問題，還是一個相關但不痛的問題？
- **User fit**：佈局密度、術語、資訊順序符不符合目標使用者與工作流程？
- **Market fit**：有沒有違背使用者已內化的同類產品慣例？

## 克制預設

- 同畫面不同時出現一個以上的高飽和 accent 色。
- 相異色調（含 tint/shade）落在 3–5 個以內。
- 每畫面「最吵」元素（色彩飽和度/字重/尺寸任一達到最大值）不超過 3 個。
- 留白與密度跟著使用者與使用頻率走：高頻操作工具可以密，低頻瀏覽頁要鬆。

## 第一層：硬規則

1. spacing 只走 token scale——用 `--ds-*` spacing token，不寫裸 px。
2. color 只走 semantic token，不寫 raw hex，不引用 primitive。**受控衍生色例外**：需要比現有 token 更多層次的視覺區分時，可用 `color-mix(in srgb, var(--ds-color-X) P%, var(--ds-color-Y))` 或 CSS relative color syntax 衍生新色值——條件是公式裡每一個顏色輸入都必須是合法 `--ds-*` semantic token，不能有任何裸 hex 或具名色（`white`/`#fff` 都不行）。只用在裝飾性/狀態分層（badge/tag 底色、強調邊框），不用在 primary CTA 或影響語意判讀的正文文字色；衍生值照樣算真實對比。**間距/圓角/字級/動效不適用此例外**，一律只能是既有 token 原值。
3. type 走 DS type token / style，不出現一次性字級。
4. **primary CTA 只有一個**。使用者學「這個顏色＝行動」，稀釋它就失去信任。
5. semantic color 不反轉：綠＝正向/成功，紅＝錯誤/負向，永遠。上升數字語意是壞的（如流失率）由標籤說明，顏色不說謊。**趨勢/漲跌顏色看這個 metric 對使用者是不是好消息，不是看數字的原始正負號**：Cost 下降對廣告主是好事該塗綠；Clicks/Conversions 下降是壞消息才塗紅。
6. shell / content 分離：shell 樣式不滲入 content，content 色不滲入 shell。
7. Angular 環境只用 manifest 內 component / props；其他環境的形似物照 manifest 宣告的角色模仿。
8. 必補 default / loading / empty / error / permission / long-content。**permission 狀態不等於 disabled**：唯讀（如 Viewer 角色）要有自己的視覺/語意表示——「這裡本來就不開放編輯」跟「暫時不能用」是不同訊息，用同一種灰階會讓使用者誤以為系統壞了。
9. 不重刻 DS 已有對應元件的 primitive（有 `ds-button` 卻手刻 `<button>`）。但用既有元件＋token 拼出 DS 沒有的新結構/新互動模式（toggle-button 群組、sticky 表格欄、badge+icon+tooltip 組合）不算——判準是「有沒有佔用既有元件的角色」。
10. 元件只用在 manifest `useWhen`/`description` 講的用途上，不借去扮演別的角色（如把 chat composer 送出鍵借去當頁面級 FAB）。

## 第二層：畫面組成規則

- **5 秒測試**：打開畫面 5 秒內知道主行動與主資訊是什麼。
- filter 區 / 資料展示區 / 分析區不混在一起，各有獨立 zone。
- 層級成階：primary、secondary、tertiary 看得出差別（size / weight / color 至少兩個維度有階差）。
- density 符合使用者與使用頻率：高頻操作工具可以密，低頻瀏覽頁要鬆。
- 導覽不產生孤島：每頁都有向上（回上層/首頁）與橫向（相關功能）的路。
- 內容順序照使用者 workflow 排，不照資料表結構排。
- **減法原則**：每個畫面元素都要能回答「拿掉這個，使用者會失去什麼」；答不出來就是候選刪除項。
- **Page Clarity**：每頁開場要有標題＋一句話說清楚這裡要做什麼，不存在「無聲頁面」。
- **比較內容不捲出視口**：需要對照/比較的內容（多筆資料、before/after）不該讓使用者捲出當前視口去對照。
- **互動模式限制**：次要內容優先用行內展開、專屬頁面、底部表單；避免燈箱、懸停依賴互動、浮動面板。
- **資料背後有人**：dashboard / table 類頁面至少一處呼應數字背後的真實使用者（標籤、文案、或視覺框架）。
- **圖表資料要有效利用畫布**：scatter/bubble/長條這類比較型圖表，domain 應以資料實際 min-max 取 padding，除非「跟 0 的距離」本身就是這個比較要傳達的意義（如達成率）。資料擠成一團是 domain 選錯，不是資料的問題。
- **浮動/絕對定位元素不能蓋住底層內容**：legend、badge、tooltip 錨點這類疊加元素，跟底下的內容（座標軸文字、資料本身）量實際 bounding box 確認無重疊。
- **破壞性/批次動作要有安全網**：不可逆或影響範圍大的操作，執行前有確認或執行後可復原——至少一種。
- **主要畫面能定位、返回記得住**：核心畫面能透過路由直接到達；從子畫面返回保留篩選/捲動/輸入狀態。
- **疊層要有規則**：drawer / modal / toast / sticky header 有一致的疊層順序規劃。
- **巢狀捲動不互相打架**：drawer 內捲動、頁面主捲動、sticky 欄捲動並存時確認彼此不衝突。
- **資料欄位用等寬數字**：KPI、表格數字用 tabular figures，數字變動時版面不跳動。
- **大量資料要有效能對策**：清單/表格超過 50 筆要虛擬化或分頁；篩選/搜尋要 debounce。
- **圖表要有非圖表的替代呈現**：圖表搭配表格資料或文字摘要，不能只有視覺化一種呈現。
- **自創資料表要能排序**：承載需要比較的資料時，支援排序並標 `aria-sort`。

## 第三層：條件式規則（只在適用場景啟用，不硬套）

| 規則 | 適用 | 不適用 |
|---|---|---|
| Hero ritual（大標＋副標＋箭頭 CTA） | entry / product home | 內頁、admin |
| Wizard grammar（卡片＋圓點分頁＋灰上一步/主色下一步） | multi-step creation flow | 單頁表單 |
| Gradient 背景 | creation / onboarding / wizard | dashboard / table / analytics（一律白底） |
| 主行動固定底部 | form / review / step flow | dense admin list |

## 5-Pass 自查（畫面完成後過一遍）

依序五道，命中就修：

1. **AI 味檢查**：gradient soup、emoji 當圖示、假插圖、純 `#FFF/#000` 對比、off-scale 間距。命中就重做該區塊。
   - **over-rounded + left-border card**：`border-radius:12px` 級＋`border-left:4px solid` 同時出現且被當**預設**卡片樣式套用全畫面——只有真的是 callout/alert/狀態指示的語意強調才保留左邊框。
   - **editorial-warm 套版**：cream/暖白底＋serif display 標題＋焦糖/琥珀點綴——DS 沒有這個方向就不要用。
2. **層級 / 節奏檢查**：size / weight / color / spacing 是否成階、有沒有兩個元素搶 primary；套用減法原則判斷裝飾性/冗餘元素。
   - **位置**：主要內容（logo、主標題、primary CTA）在左上到中上的視覺起點區，不是被擠到右下角。
   - **色盤紀律**：即使每個色都是合法 token，同畫面相異色調（含 tint/shade）也該落在 3–5 個以內；超過是節奏失控的訊號。
   - **Section 結構 / 策略性變化**：長頁面要在某處刻意打斷節奏（換背景、放大某區、置中某個 CTA）；完全單調和完全混亂都算沒有節奏。
3. **互動狀態檢查**：hover / active / disabled / focus / loading 五態齊不齊（DS 元件自帶就檢查有沒有被覆蓋壞）。
   - hover 不能只用降低透明度（會被誤讀成 disabled）；disabled 要有「為什麼」的提示；loading 立即 disable 防重複送出，結束後恢復原標籤。
   - **進行式語態不限按鈕標籤**：「正在分析…」這類狀態性文字，在對應狀態結束後必須轉為完成語態——殘留的進行式等於狀態對使用者說謊。
   - transition：狀態變化 0.15–0.3s；進出場 0.3–0.5s；0s 跳變或超過 0.5s 都算問題；動效包 `prefers-reduced-motion` 降級。
   - **完成動作要有確認**：「套用」「儲存」完成後有簡短視覺確認（打勾、toast、顏色閃爍）。
   - **錯誤要給復原路徑**：錯誤訊息講清楚原因＋給明確下一步（重試、編輯、求助連結），不能只寫「發生錯誤」。
4. **A11y 檢查**：對比達標（一般文字 ≥4.5:1，大字/UI 元件 ≥3:1，實際算色值比例不憑眼睛）、semantic HTML（`<button>` 不用 `<div onclick>`、剛好一個 `<h1>`、`<label>` 對應 `<input>`、能用語意標籤就不加 ARIA）、鍵盤可達（Tab 走得到每個互動元素，順序符合視覺順序）、focus 可見（`:focus-visible`，`outline:none` 必須有替代）、觸控目標 ≥44×44px（FAB、icon-only 按鈕、面板啟動器都要量）。
   - **圖表資料的對比與色盲友善**：資料線/柱對背景 ≥3:1、資料文字標籤 ≥4.5:1；資料狀態不能只靠顏色分辨，要搭配圖案/形狀/文字標籤。
5. **Polish 收尾**：對齊、截斷處理、空狀態文案、loading 佔位不跳動；浮動/絕對定位元素跟底層內容確認無重疊。
