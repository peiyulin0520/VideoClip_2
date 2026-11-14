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
- [Actions 43551904638](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43551904638)：驗收程式 7726486778f07ce4ea0dd6da44e05c802bfa7639 的343單元、145 Chromium e2e全過，另21項快速情境全過（為完整情境的子集）；lint/格式/TypeScript/build/Pages/39字體檢查成功。artifact 14096564736，ZIP SHA-256 `80c808f6180a5ebd287714f4c06844e17ba27868645557af40a6d6d6a3a4899d` 已核對；179張成功截圖，anchored-playback包含8張。最後文件/截圖提交不改已驗收的程式、測試或設定。PR #10仍由使用者自行Merge，Safari待真機。
- 七個新增情境涵蓋：匯入/追加/套版/返回及定位；同秒代表字；六主題表單；真實readyState閘、防自動播、0秒重播/速率/捲頁/popup與音訊能量；分離audio；540→720真proxy/快取/原檔細線匯出；121秒長片82秒及放大後縮圖覆蓋。其餘既有來源、模板、字級及匯出回歸均保留。
- 先前失敗run及8d27981的343/144成功屬過程；最終證據以7726486與43551904638為準。
- 參考VideoClip版本[0d6df7d](https://github.com/peiyulin0520/VideoClip/commit/0d6df7d0f133fa037fa868dfcc10ab718c87d529)。Safari長片/HEVC/HDR、低記憶體、背景返回及聲音仍需真機，不能以Chromium聲稱手機皆順暢。

## 2026-11-14 長片縮圖追加
使用者指定舊VideoClip只參考播放，指出1分鐘後縮圖空白但影片能繼續。本repo也發現固定120格搭固定寬會截斷顯示；120格只作DOM預算，現在按片段全寬分配格寬，來源取樣跨全段，寬格內自然比例repeat-x以免拉扁。影片播放/匯出不改。新增121秒小型自製素材，在82秒及300px/秒放大下檢查縮圖鋪滿且後半取樣藍色，格數不超過120；已隨完整145 e2e通過，新畫面為anchored-playback/long-filmstrip-after-minute.png。此低fps素材只驗縮圖覆蓋，不當作播放順暢度效能證據。
