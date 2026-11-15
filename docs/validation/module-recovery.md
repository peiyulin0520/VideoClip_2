# 專案程式模組載入失敗恢復

使用者回報進專案停在80%，顯示Safari `TypeError: Importing a module script failed.`，按原本的重試仍不能進入。

舊按鈕只重建播放器，仍在相同文件使用已失敗的ESM載入；Pixi的Renderer原本會在初始化時另抓分割檔。更新時也可能有舊文件與新版worker/程式檔混用。這是程式元件錯誤，不能當成影片損壞而直接略過。無Safari真機堆疊，未宣稱已確認使用者當下失敗URL或唯一網路原因。

## 修正

- 主程式與渲染器合為一個約1.77MB JS（gzip約506KB）；worker仍獨立。進專案不再另抓Renderer chunk，不改預覽解析度、播放時鐘或匯出設定。
- PWA完整程式預快取；新worker等待明確更新，不強制接管正在編輯的文件。首頁有「更新程式」入口。
- 模組錯誤改顯示「更新程式並重新開啟」；先保存當前路由的專案，只更新本app scope worker，需要時啟用waiting，再完整重新開啟同一專案網址。
- 不刪IndexedDB、OPFS、字體或其他快取。媒體/解碼錯誤仍使用原重試，沒有播放器的錯誤不提供無效的略過。
- 更新檢查與worker啟用都有時間上限，離線/受限worker存取仍可清除文件的失敗模組狀態重新開啟；不自動無限重整。

## 驗收

source `19291aeb4efd413e085a2b16c686734040535462` / [Actions43668024373](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43668024373)。399單元/39檔、lint/格式/TypeScript/build/Pages/PWA/39字體通過。完整169項Chromium全過（9.4分鐘）；另2載入恢復＋29編輯＋5色調＋9音訊（三輪）＋30生命週期全過。最後提交只文件和3張新截圖，產品、測試、build設定與上述source相同。

1. 刪除WebGPU能力，並攔截非main/worker的舊JS chunks；匯入影像仍可開預覽，沒有Renderer chunk請求。這能確認合併bundle不要求WebGPU。
2. 模擬Safari模組錯誤，新按鈕完整重開document；專案ID、名稱、素材ID與tracks相同，實際來源預覽正常。另在OPFS和Cache Storage放保留標記，重開後內容仍完整；播放維持暫停。首頁更新入口另以installer已安裝事件觸發通知，再點實際「更新程式」並確認重新開啟；這是通知與操作驗證，沒有冒充兩個實際部署版本或Safari的worker切換。

單元測試涵蓋Safari/Chrome/Firefox/CSS錯誤分類、媒體錯誤分流、保留query/hash、明確啟用waiting worker、不更新其他scope、離線/權限受限/啟用失敗/超時。build檢查單一非worker bundle、沒有相對lazy chunk imports、precache包含main及worker只接受明確SKIP_WAITING訊息。Router未使用的generic `import(e.module)`不等同本專案的渲染器chunk。

- [程式載入失敗的恢復畫面](../screenshots/module-recovery/code-recovery-dialog.png)
- [原專案重新開啟](../screenshots/module-recovery/project-reopened.png)
- [首頁明確更新入口](../screenshots/module-recovery/home-update-ready.png)

Safari實機的舊PWA更新切換、離線狀態與80%載入錯誤仍列PLAN §7。Chromium驗證流程和資料保留，不冒充已在同一支iPhone重現或測通。

## 截圖來源

三張新圖均取自快速成功artifact14142943701（2318200 bytes），SHA-256 `eb4031eccbdecd84dd7b41529d97b949fb9a89d535b4c1408b72b3095196ae14` 已下載核對，三張已人工檢視；只取module-recovery PNG，不混用舊圖或failure context。其他截圖保留PR12基線，不宣稱都是這次重新下載。完整成功報告在同run的browser-checks artifact14143032750。
