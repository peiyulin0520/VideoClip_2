# 定格、裁切與版型驗收（2026-11-14）

本輪 PR：[#12](https://github.com/peiyulin0520/VideoClip_2/pull/12)。原始使用者錄影只在工作環境暫存，所有公開截圖與測試影片均為合成素材。

## 驗收來源

產品程式：`14f70bcf5174a7b59d67f59b54d0cc8ea4045ffe`。本機 `npm run check` 成功：381 單元、38 測試檔、lint/格式/TypeScript/build/Pages/PWA、39 字體與授權檢查。

[Actions 43626948329](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43626948329) 167 項完整 Chromium 全過，快速29編輯/5色調動作/3音訊/30生命週期全過。主artifact14126748541 SHA-256 `bfacd6b90bfa48b4f7be9621ae6035d3511575a6892dbf013f92144964f2f563` 已核對。11/15追加圖示分區與直線頁籤的新版待Actions，不以此圖冒充追加後驗收。

## 需求對照

| 使用者要求 | 實作及驗收依據 |
| --- | --- |
| 定位改定格、暫停菱形白底橘框、編輯所選不新增、明確近鄰新增/刪除 | keyframes、Timeline、KeyframeControl；editing-refinements 定格 case、editingRefinements 單元 |
| 震/彈/晃/跳、時間與力道、所有視覺素材 | keyframeMotion 解析 transform，scene 預覽/匯出共用；tone-grading 播放及 template-editing Pop 資源測試 |
| 全頁用自訂素材名、原音繼承/分離另命名 | itemName、Timeline/Toolbar/AudioPanel/來源popup；refinement 與 template-editing、單元 |
| 固定預覽基地、框內比例、自訂四邊/角 | Preview、ProjectPreview；editing-refinements 自訂比例與 X 草稿 |
| 四個獨立裁切工具同列、不閃爍、縮放仍保留來源位置 | CropEditor stable canvas、MediaMask.base；裁切舊回歸及 CDP 雙指/匯出像素 |
| undo/redo、播放右側操作、X 不保存、無多餘取消/reset | useDraftHistory、Sheet、Crop/Trim/AudioRange/TemplateCellEditor；各來源popup草稿測試 |
| 真正灰色文字placeholder、上下居中/左右留白 | TextPanel、createTextItem、scene；refinement、uniform-type |
| 圓角統一、表單無黑框棕箭頭、標籤間隔與左對齊 | canonical表單12px、colour-field/effect-name；anchored-playback 六主題、contrast 測試 |
| 小示意同步調色與透明 | 靜態96px ToneThumbnail及RGBA框架；template-editing 黑白/透明像素驗收 |
| 點格子開有聲選段、起點依長度連終點、局部名稱/速度/補色與文字 | TemplateCellEditor、SourceRanges.linkedDuration、templateTiming；template-editing source popup |
| 移除重複整組預覽與inline進階區 | TemplatePanel/TemplateCells只留compact來源入口，進階放局部popup；refinement回歸 |
| 輪序播完停最後幀、群組預設收合/展開、同時分列/輪序同列、順序/長度/色塊 | templatePlayback、visibleLayers、scene、mediaSegments、Timeline；template-editing native frame/像素/匯出 |
| 音訊片段範圍、有聲找素材、未選秒數也能聽 | AudioRangeEditor 原音預設、selectionOnly選項、同列秒數；editing-refinements audition test |
| 多版型互不覆寫、選既有編輯或另新增 | TemplatePanel不fallback第一組、carryTemplateEdits保留ID；template-editing 多組及重新開啟回歸 |
| 下方頁籤再次點擊不關閉 | Toolbar switchTab；compact/tone/refinement |
| A/B/C刪B接A/C後調轉場不回復B | stable item/source binding、seek mapping防舊回呼；editing-refinements 資料與native C來源秒數 |
| 特效流暢度及原音爆音回歸 | 既有audio-continuity波形門檻維持；tone+shake零貼圖/濾鏡配置，模板Pop固定取樣尺寸 |

## 真機界線

Chromium 回歸可驗證操作、來源秒數、像素/匯出一致、音訊能量與資源配置，不代表 iPhone Safari 真實 FPS 或硬體爆音已測。Safari 原音解鎖、長片多模板、觸控縮放/筆刷、seek 後播放與背景切回仍在 PLAN §7 待真機。
