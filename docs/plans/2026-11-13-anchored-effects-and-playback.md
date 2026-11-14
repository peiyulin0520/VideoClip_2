# 特效標記、固定單素材邊界、圓角表單與穩定播放

最新使用者更正優先於上一輪任意單素材時窗：
- 銜接在接點顯示代表字；單素材在實際特效起點標記，藍綠/棕色區分。收合分類也可見，點字開對應設定，小圓視覺/44px觸控。
- 單素材只能開頭B進場／結尾A退場。進場起固定0，只1迄，可調迄/時長；退場迄固定片尾，只1起，起=片長-時長。舊任意多組單素材依原duration靠邊界，空設定仍停用。一般畫面特效/兩片銜接/來源仍多組。
- 全站文字/數字/搜尋/下拉/textarea淺棕無黑框深字圓角膠囊，select棕色自訂下箭頭；range/checkbox/color/file不改。14px操作/11px註解及較小時間軸、44px觸控保留。

播放追加：未按播放卻自動播、0秒/捲頁/popup後頓、分離聲音略好但爆音；同意100%載入後編輯。使用者指定參考VideoClip main。
- 已讀VideoClip player/mediaPool/audio/proxy/proxyQueue/assetUrls/previewQuality：有本機960 proxy、獨立audio元素、iOS禁速率微調、按手勢lazy WebAudio及音訊會話。新版先前只縮畫布、仍解碼4K/HEVC，每幀重設速率及gain零→原值。
- 實作：背景worker逐支做proxy，尺寸跟540/720/1080/1920，H264優先VP9備援、HDR轉SDR、保留音訊。OPFS快取；urlFor一直原檔、previewUrlFor只預覽，所有匯出不能用proxy。不能跨repo搬使用者資料。
- 讀專案→素材→proxy→可畫首幀的真實進度，背景編輯inert，100%後啟用；不是把整支每幀解碼放記憶體。失敗有重試/略過/返回，離開取消worker。
- 每幀不重設相同playbackRate、iOS禁速率微調、seek中不重複seek/硬校正限頻；載入時停時鐘及聲音、訂閱立即同步按鈕；非播放意圖/晚到promise的pause guard。VideoClip式同步解鎖play/pause；meta prime最多350ms且檢查item/asset。
- 分離聲音audio pool；WebAudio按手勢lazy建立/只接有聲元素、gain有變才8ms漸變、limiter防混音削波、AudioSession=playback。主影片播放時停示意，原生來源試播前停主播放器，切背景暫停不自動續。

匯入時不重建主播放器：新增影片用獨立、可取消的proxy準備流程；完成後以當下播放頭prepare，不覆蓋匯入後定位。原player/compositor保持存活。比例或品質改變才重建；所有已destroy的player操作與晚到frame通知都忽略。訂閱通知走快照，避免同一emit因React重新訂閱而重複走訪。

參考來源：[VideoClip](https://github.com/peiyulin0520/VideoClip)，主要比對src/engine/player.ts、mediaPool.ts、audio.ts、proxy.ts、proxyQueue.ts、assetUrls.ts、previewQuality.ts；保留VideoClip_2獨立資料庫/OPFS命名。

## 驗證
- [Actions 43554041782](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43554041782)：驗收程式 `7f94416abd5d2889fe4c997b5cacd1590f1d070f` 的343單元、145 Chromium e2e全過，另25項快速情境全過（完整測試子集）；lint/格式/TypeScript/build/Pages/PWA及39字體檢查成功。artifact `14097094861`，ZIP SHA-256 `58ba0cc5f74d9d18a94e229fa74ca8ff477f0754366d1be56d952f6eb47540ac` 已核對；180張成功截圖，本次anchored-playback有9張。最後提交只更新文件/截圖，與驗收程式的產品、測試及設定完全一致。PR #10保持未合併，由使用者自行Merge後發布；Safari待真機。
- 25項快速情境與完整145情境均成功；在既有情境加強三款手機直向同頁不捲動、縮寬按鈕44px高度、無序號標籤與121秒素材82秒數字定位的主畫面及popup藍色像素。未移除原有播放/音訊/匯出或多組斷言。
- 已人工檢視載入返回、同秒效果選擇、單素材退場起標籤及長片82秒同頁配置4張；本機最終check及diff檢查成功。43551904638等之前run只作歷史，不能當本輪證據。
- 參考VideoClip版本[0d6df7d](https://github.com/peiyulin0520/VideoClip/commit/0d6df7d0f133fa037fa868dfcc10ab718c87d529)。Safari真機限制見PLAN §7，不能以Chromium聲稱所有手機皆順暢。

## 2026-11-14 長片縮圖追加
使用者指定舊VideoClip只參考播放，指出1分鐘後縮圖空白但影片能繼續。本repo也發現固定120格搭固定寬會截斷顯示；120格只作DOM預算，現在按片段全寬分配格寬，來源取樣跨全段，寬格內自然比例repeat-x以免拉扁。影片播放/匯出不改。新增121秒小型自製素材，在82秒及300px/秒放大下檢查縮圖鋪滿且後半取樣藍色，格數不超過120；已隨完整145 e2e通過，新畫面為anchored-playback/long-filmstrip-after-minute.png。此低fps素材只驗縮圖覆蓋，不當作播放順暢度效能證據。

## 2026-11-14 單素材同頁精調追加（已驗收）
單素材標籤及欄位只起/迄不編號，完整片長時間軸高度44px，預覽按直向可視高度調整，預覽/軸/秒數在同頁。填秒數與拖標籤同步實際預覽及時間讀值，長片仍可精調。載入返回與同秒特效選擇按鈕內容寬/44px高。既有瀏覽器情境加320×568、375×667、390×844布局與82秒藍色畫面驗證；本輪343單元/145瀏覽器/25快速驗收全過，最新畫面已保存；上一驗收只作歷史。

## 2026-11-14 左右並排更正（待驗收）
使用者再次明確更正前圖三popup的預覽和播放軸在左右兩側。單素材workspace分左預覽/右軸+欄位，左播放鈕在圖下；320px仍左右。右窄軸最多3刻度、最窄2刻度，其餘SourceRanges預設5不變。三尺寸加真正左右位置、預覽/軸垂直交集、右側欄位、刻度不重疊及320截圖斷言，保留播放/時長/取消復原/長片82秒回歸。前435540僅基線，待新25/145驗收。
