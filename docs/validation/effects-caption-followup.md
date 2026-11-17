# 特效歸屬、選項層級與版型文字驗收

PR：https://github.com/peiyulin0520/VideoClip_2/pull/14

驗收 source：`942895a3c6e898d83861c501c19dd66bfa77892f`；[GitHub Actions 43693750451](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43693750451)。最後版另外修正ownerId只管理刪除生命週期，不誤改screen效果分類；保留原同秒選單測試。

## 行為與證據

| 需求 | 實作／保留的斷言 |
| --- | --- |
| 刪素材後特效留在原秒 | 新效果記ownerId；中央專案交易比較被刪ID，同時清所屬畫面效果及銜接，undo/redo一起回復。單元涵蓋刪片、整層、批次與不相干效果保留；瀏覽器實際點刪除、復原、重做 |
| 舊特效找不到標記 | 沒有完整來源關聯的舊效果仍在時間軸顯示可點badge；實際植入dangling來源ID後點標記、開起迄、關閉及移除，基本overlay回正確特效面板 |
| 不同層級相似 | 主層文字底線、次層淺底與下線、第三層輪廓。測computed style確實不同，320/390/430不溢出、觸控≥44px；文字/素材/動畫等巢狀導航沿用 |
| 音訊三按鈕移名稱左側 | 片段／分離／移除圖示和短標籤同列，完整aria/title仍保留；三尺寸驗左右幾何與觸控，實際打開片段、移除、恢復、分離及刪音軌 |
| 版型文字比例與文字軌 | 拍貼／膠卷／相紙caption為真正TextItem，獨立於媒體格數；示意靜態縮圖使用相同文字raster。選字體／大小，展開文字列，再從文字頁改內容／大小，回版型及重開後值一致 |
| 預覽與匯出 | 實際匯出單格有caption像素；群組縮放定格0–1.5秒，實際播放0.3–1.2秒期間新增貼圖配置0，沒有改音訊/GPU門檻 |

## 測試結果

- 本機及CI：418單元／42檔，lint、格式、TypeScript、build、Pages/PWA與39字體授權檢查全過。
- 完整181個Chromium瀏覽器測試成功（9.8分鐘）；快速14＋33＋2＋29＋5＋9（三輪音訊）＋23全部成功，共115次執行（完整測試的子集及重複音訊輪次）。
- 三輪live maxJump：0.003898978、0.003886402、0.004180849；完整0.004078627，原門檻0.08不變。完整原始事件及PCM摘要見[effects-caption-audio.json](effects-caption-audio.json)。
- fast artifact14154206234／5,150,019 bytes，下載並核對ZIP SHA-256：`61b2b3651016a96dfd6f37b82dd720e9a7bdbb5736d837798f026f052b26df7d`。5張新成功PNG人工檢視，僅複製effects-caption資料夾，不批次替換舊基線畫面。
- 完整artifact14154206620／32,342,806 bytes、refinement14153633319為同source遠端產物，未另下載核對；沒有冒充本機已核。
- 最後提交只包含文件、量測與成功PNG；產品、測試與workflow和驗收source完全一致。

## 成功截圖

以下均為本輪Actions使用自行生成素材的截圖，不含使用者影片或第三方創作者畫面。

- [刪除素材後特效清除](../screenshots/effects-caption/deleted-effects-cleaned.png)
- [三層特效選項](../screenshots/effects-caption/effect-levels.png)
- [音訊操作位於名稱左側](../screenshots/effects-caption/audio-actions-left.png)
- [群組展開文字軌](../screenshots/effects-caption/caption-timeline.png)
- [版型文字比例示意](../screenshots/effects-caption/caption-proportion.png)

## 限制與過程

舊無owner效果依原套用時間推定；已失去來源且無法確定歸屬者不在載入時任意刪資料，提供可點標記管理。ownerId只管理刪除生命週期，不改既有全畫面效果的合成範圍。Story既有中央動態標題保留，本輪文字軌對應拍貼／膠卷／相紙的footer。

首版39e919c / Actions43691474481新增7瀏覽器通過，check在純geometry單元誤用CI不存在的jsdom Canvas失敗；該測試注入固定text bounds，保留原幾何斷言，真正raster/匯出仍由瀏覽器測。77ca098 / Actions43691920624 check與7新瀏覽器通過，因補取景啟新版而取消；不當作最終完整通過證據。17d406b / Actions43692408338完整180/181、快速末組29/30；同秒選單把ownerId誤當targetId，將screen效果標成單素材。已改只有targetId才single，補單元斷言；快速入口把原anchored7移到首組與新7同跑，沒有刪任何測試。最終未放寬音訊<0.08、媒體列數、像素或GPU配置斷言。

iPhone Safari實際音效聽感、長片FPS、字體呈現與手勢仍待真機（PLAN §7）。Chromium手機尺寸不等於Safari驗收。由使用者Merge PR14後Pages才發布，未代合併。
