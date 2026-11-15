# 專案載入模組錯誤修復

使用者截圖：80%素材尚未就緒、Safari TypeError: Importing a module script failed，重試無效。PR12已Merge，另開修復PR。

- 主程式/渲染器一起bundle並precache，避免80%才fetch被部署替換的lazy chunks。
- PWA不強制接管使用中的文件；新程式waiting，首頁明確更新或模組失敗時啟用更新。
- 模組錯誤和素材錯誤分開。前者完整重開document清failed ESM map，保存當前專案、原hash，更新只限本app scope。不可刪專案/OPFS/字體/其他快取；沒有Player不提供無效的略過。
- build驗main無相對JS chunk import、precache包含完整main、worker沒有auto skipWaiting/clientsClaim。
- 12單元分類/worker啟用/foreign scope/offline/權限/timeout；2瀏覽器阻斷lazy chunks及錯誤重開、名稱/素材/OPFS/cache保留，回歸全部舊流程。

最終source19291ae / Actions43668024373：399單元/check、169完整、快速2/29/5/9/30全過；無WebGPU、模組失敗資料保留與首頁更新均已驗。3張成功圖核SHA/人工看過，PR13交使用者Merge。Safari仍待真機。
