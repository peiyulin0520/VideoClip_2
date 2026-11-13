# AGENTS.md — 給任何 AI／工程師的接手說明（Claude、ChatGPT/Codex、Gemini、人都適用）

這個 repo 是一個**手機瀏覽器用的影片剪輯網頁 App**（公開網址、免登入、資料只存在各自的裝置）。
使用者是繁體中文使用者，用 iPhone，只負責**審核**（看截圖、實測），不寫程式。

> **接手的第一件事（照順序）**
> 1. 讀 `docs/PROGRESS.md` 最上面的「交接快照」：現在做到哪、下一步是什麼、在等使用者什麼。
> 2. 讀 `docs/HANDOFF.md`：架構地圖、決策與原因、踩過的坑、下一步的具體做法。
> 3. 要做哪個功能，再讀 `docs/PLAN.md`（總規劃與驗收）＋對應的規格：字卡 `docs/TEXT_CARDS.md`、動畫/轉場/調色/筆刷/遮罩 `docs/EFFECTS.md`、字體 `docs/FONTS.md`。
> 4. `npm ci && npm run check && npm run e2e -- --trace off` 確認一開始是綠的，再動手。

## 指令
| 指令 | 用途 |
|---|---|
| `npm ci` | 安裝（Node 22） |
| `npm run dev` | 開發伺服器（`--host`） |
| `npm run check` | lint ＋ 單元測試 ＋ build（每次提交前必跑） |
| `npm test` | Vitest 單元測試 |
| `npm run e2e -- --trace off` | Playwright（iPhone 13 尺寸、Chromium；會先 build 再開 preview） |
| `npm run fonts:setup` / `npm run fonts` | 字體管線（一次性建 `.venv`／下載＋裁切＋產生目錄）。一般改程式**不用**重跑，成品已 commit |

## 一定要遵守的規則
1. **進度要記在檔案裡，不能只留在對話裡**（見下一節「紀錄規則」）。這是使用者明確要求的，目的是讓別的 AI 可以無縫接手。
2. **一次只做一個階段（Phase）或一個明確的子任務**；每個階段：實作 → `npm run check` → e2e＋截圖 → 更新紀錄 → commit → push → 用中文簡短回報。
3. **誠實回報**：✅ 已驗證（附截圖/測試）／🟡 寫好但只在 Chromium 驗證／🔴 做不到或沒做。**iPhone Safari 的行為沒有人能在沙盒測**（沒有 WebKit），一律列進 `docs/PLAN.md` §7「待真機驗證」，不要說成已驗證。
4. 回覆使用者用**繁體中文，短、白話、一次一件事**，結尾只留一個問題並給 A/B/C 選項。給**看得到的東西**（截圖、對照圖），不要只用文字描述。不確定就問一句，同一個視覺效果試 2–3 次不對就停下來請使用者給參考圖。
5. **使用者資料永遠只在使用者的裝置或他自己的 Google Drive**；不加任何會上傳影片的後端或分析服務。AI 音樂推薦（Phase 7）要使用者自己填 API key、明確同意才送影格。
6. **字體授權要讀字型檔本身**（name table 的 nameID 0/13/14），不要只信「都是開源」。公開 repo 只放可再散布的字體（OFL 等）＋授權檔；不允許散布的只能讓使用者自己「匯入字體」。細節與目前名單見 `docs/FONTS.md`。
7. 不放第三方創作者的截圖/錄影進 repo；測試素材用 ffmpeg 產生，不用真人臉。
8. **觸控優先**：可點元素 ≥ 44px、用 Pointer Events、每個按鈕都要有 e2e 點擊測試（使用者回報過「icon 沒有反應」）。
9. 尾端圈圈（字卡裝飾）照 `docs/TEXT_CARDS.md §3.1` 的路徑做；使用者的參考圖只是**示意圖**，形狀神韻對即可，不必疊圖到逐像素重合。
10. **之後所有變更都要建立 PR，提供可點擊的 PR 連結，由使用者自行按 Merge pull request。**先在功能分支完成修改與適當測試，再推送並開 PR 指向 `main`；不要替使用者合併、啟用 auto-merge，或直接推送 `main`（包含文件更新）。VideoClip_2 目前功能分支為 `codex/establish-little-moments`。使用者合併到 `main` 後，GitHub Actions 才發布 Pages；這是 2026-11-12 最新明確指示，優先於舊日誌的直接發布流程。

11. **選項層級與按鈕回饋**：不同層級的主類/次類需用區塊、色彩或底線清楚區分，沿用 option-primary/option-secondary；選取型按鈕保留可見 active/aria-pressed。可操作的新增按鈕使用清楚的主題色，不能看起來像停用。這是 2026-11-13 使用者對之後所有同類介面的要求。

12. **緊湊操作介面**：全部操作介面（首頁、設定、頂部、播放列、時間軸、下方功能、選項與 popup）共用 --ui-font-size（14px）；只有明確註解 11px，不能把 small 標籤當作註解。專案內文字素材大小由使用者設定，CSS 不改成品。文字框與選項左右內距 6px、輸入框上下 4px，觸控目標維持 44px。圖像/間距縮小，維持觸控目標。特效卡只動畫/名稱，整軸開啟先分類摘要，版型來源選單在預覽右側。這是 2026-11-13 最新長期介面偏好。

13. **全頁可讀性與字距**：所有文字卡片以同主題的底色/fg/說明色成組設定，不能固定深底卻繼承淺色主題深字；首次設定的備份/字體包也必須驗。操作字級14px使用 -0.02em 字距/詞距、1.25行高，註解11px用 -0.01em 字距、1.3行高，時間軸/播放時間的固定小列用更緊行高。僅限介面，不改影片文字。新增介面應通過六主題純色操作文字對比驗收，已停用控制與素材示意圖另看實際用途。

## 紀錄規則（每次都做）
**每完成一個有意義的步驟（不是只有每個 Phase 結束），在同一個 commit 裡更新：**
- `docs/PROGRESS.md`
  - 最上面的「交接快照」（分支、最後 commit、測試數量、現在做到哪、下一步、等使用者的事）→ **覆寫**成最新狀態。
  - 「日誌」→ **在最上面新增**一筆（格式見該檔「日誌格式」）：做了什麼、動了哪些檔、怎麼驗證、哪些沒驗證、下一步、踩到的坑。
  - 使用者說的決定、偏好、更正 → 原話或精準摘要，記進「使用者已確認的偏好」或「使用者的修正紀錄」（附日期）。
- 規格或決策改了 → 同步改 `docs/PLAN.md` / `TEXT_CARDS.md` / `EFFECTS.md` / `FONTS.md`，並在 `docs/HANDOFF.md` 的「決策與原因」補一行。
- 新的坑 → 記進 `docs/HANDOFF.md` 的「踩過的坑」。
- 結束前確認：已 `git push`、工作目錄乾淨、紀錄和程式一致。**交接時別的 AI 只會看到檔案，看不到你的對話。**

## 技術棧（一句話版）
Vite 8 · React 18 · TypeScript 5.9（別升 7：typescript-eslint 不支援）· Zustand + immer · PixiJS 8（WebGL 合成，預覽與匯出共用）· idb（IndexedDB）· OPFS（素材檔）· Cache Storage（字體）· Mediabunny（讀影片資訊；之後做匯出）· vite-plugin-pwa · Vitest 5 · Playwright 1.63（要與沙盒 Chromium 版本一致）。部署：GitHub Pages（`/VideoClip_2/`，HashRouter）。

## 測試用旗標（localStorage）
- `lm2-skip-onboarding=1`：不顯示首次使用精靈（`e2e/helpers.ts` 的 `createProjectWith` 會設）。
- `lm2-debug=1`：掛出 `window.__videoclip`（讀專案 JSON、取樣預覽顏色、算畫面雜湊、匯出單格）。一般使用者看不到。

## VideoClip_2 接手補充
- 這個儲存庫來源是 VideoClip `78b178343409c46c7ba353ef3a6db6f279a7bde6`（main 已包含 PR #3），對外名稱 **Little Moments**。舊分支／PR 記錄只屬於來源 repo；本 repo 後續依最新指示建立 PR，由使用者自行合併。
- 網址路徑 `/VideoClip_2/`；IndexedDB、OPFS、字體快取、localStorage 均使用獨立命名，避免同一個 github.io 網域的 `/VideoClip/` 被改動。不要刪除或自動搬移舊資料。
- 現有 Sites 的 Little Moments 是另一套資料模型；未實作轉換，不能把 JSON 或素材庫 ZIP 當成這個版本可還原的檔案。
- `npm run check` 仍須完成。此 Codex managed 環境缺少 Sites 指定的 `cua_repl.js`；Sites skill 明定不可另開 preview server／改用其他瀏覽器路徑，因此本機只列出 e2e。瀏覽器驗收已改由 GitHub Actions 執行：最新 313 單元/121 e2e 結果、run 及 152 張可讀繁中截圖來源見 PROGRESS.md。不要把來源 repo 或先前缺字的截圖當成最終驗收。
