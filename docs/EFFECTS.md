# 動畫、轉場、特效、調色、筆刷規格（Phase 4、5）

> 對應需求 R13–R17。使用者附的 4 段螢幕錄影拆解在 §7。

---

## 1. 字卡出現方式（TextAnim，R13）

```ts
type TextAnim = {
  preset: TextAnimPreset;
  duration: number;          // 秒
  unit?: 'char' | 'word' | 'line' | 'whole';   // 逐字/逐詞/逐行/整張
  stagger?: number;          // 每個單位間隔秒數（逐字預設 0.06）
  easing?: 'linear' | 'easeOut' | 'easeInOut' | 'back' | 'elastic' | 'bounce';
  order?: 'forward' | 'reverse' | 'center-out' | 'random';
};
```

實作：排版引擎輸出 `GlyphBox[]`，每個字（或詞/行）是獨立的小圖（字形 atlas）。動畫函式 `(progress 0–1, glyphIndex) => { dx, dy, scale, rotation, opacity, clipRect?, blur? }`。字塊與裝飾有自己的動畫軌道（例如字塊先展開，字再逐字跳出）。

### 進場（同一套反向就是出場）
| preset | 說明 |
|---|---|
| `none` | 直接顯示 |
| `fade` | 淡入（整張或逐字） |
| `typewriter` | 打字機：逐字出現＋閃爍游標（參考影片 7f2bbc94「今天來學習」） |
| `pop` | 逐字從 0 放大到 1.15 再回 1（back easing） |
| `bounce-in` | 逐字從上方掉下彈跳 |
| `slide-up` / `slide-down` / `slide-left` / `slide-right` | 逐字/逐行滑入＋淡入 |
| `rise-mask` | 字從底線下方「升起」（被遮罩裁切） |
| `blur-in` | 由模糊變清晰 |
| `wipe` | 由左往右擦出（軟邊遮罩） |
| `handwrite` | **手寫描繪**：英文用單線字（Hershey 單線字型，公有領域）逐筆畫出；中文用 `wipe`＋筆刷頭跟隨的近似效果（參考影片 d218cc71「VLOG」逐筆寫出） |
| `scale-in` | 整張從 0.3 放大 |
| `spin-in` | 旋轉＋放大進入 |
| `flip` | 逐字 3D 翻轉（scaleY 模擬） |
| `glitch-in` | 色差錯位閃幾下後定格 |
| `stamp` | 從 2 倍大重重蓋下＋輕微震動 |
| `box-then-text` | 字塊先從中間展開，字再逐字跳出 |
| `decor-draw` | 裝飾（圈圈、底線、圈住）用描線方式畫出 |

### 循環
`float`（上下飄）、`breathe`（呼吸縮放）、`wiggle`（左右搖擺）、`shake`、`blink`、`rainbow`（色相循環）、`shine`（光澤掃過）、`boil`（手繪抖動，每秒 8 次換一個微小變形，可愛手繪感）

## 2. 片段進出場動畫（影片/圖片/貼圖物件）
`fade`、`zoom-in`、`zoom-out`、`slide-*`、`pop`、`bounce`、`spin`、`blur`、`shake`、`flash`（閃白）、`swing`、`drop`。可設時長。

## 3. 主軌轉場（R14）

```ts
type Transition = { preset: TransitionPreset; duration: number; easing?: Easing; params?: Record<string, number | string> };
```
主軌兩片段之間點「|」設定。轉場會讓兩段重疊 `duration` 秒。每種轉場是一個 GLSL fragment shader（輸入 from、to、progress），放 `src/engine/transitions/`（可參考 gl-transitions 的 MIT 授權寫法，自己移植並保留授權註記）。

| 類別 | preset |
|---|---|
| 基本 | `cut`、`fade`、`fade-black`、`fade-white`、`dissolve`（顆粒溶解） |
| 推移 | `push-left/right/up/down`（參考影片 7a671989：雲朵畫面被推走換成樹葉畫面，字卡保持不動）、`slide-*`、`whip-pan`（快速甩鏡＋動態模糊） |
| 擦除 | `wipe-*`、`clock-wipe`、`circle-open`、`circle-close`、`diamond`、`blinds`、`split-open`（水平/垂直開門） |
| 縮放 | `zoom-in`、`zoom-out`、`zoom-blur`、`spin-zoom` |
| 可愛形狀 | `heart-open`（愛心擴大）、`star-open`、`cloud-reveal`、`bubble`（泡泡） |
| 筆刷 | `brush-stroke`（一道粗筆刷掃過顯露下一段，筆刷紋理用程式產生的不規則邊緣）、`paint-splash`、`scribble-cover`（亂塗蓋滿再揭開） |
| 故障/風格 | `glitch`、`rgb-split`、`pixelize`、`film-burn`（底片燒焦光）、`light-leak`（漏光）、`flash` |
| 其他 | `page-turn`（簡化版）、`cube`（3D 方塊轉）、`ripple` |

## 4. 畫面特效（Effect 物件，放在特效軌任意時間）
`grain`（顆粒）、`vignette`、`chromatic`（色差）、`glitch`、`flash`、`camera-shake`、`soft-glow`（柔焦光暈）、`vhs`、`film-frame`（底片邊框）、`light-leak`、`sparkle-overlay`（閃光粒子）、`snow`、`rain`、`hearts-float`（愛心飄）、`bokeh`、`blur`、`mirror`、`split-screen-2/3/4`、`zoom-pulse`（隨拍子放大）、`black-bars`（電影黑邊）、`spotlight`（背景變暗、圓形露出主角，位置可移）。

## 5. 調色（R17）

```ts
type Grade = {
  exposure: number; brightness: number; contrast: number; saturation: number; vibrance: number;
  temperature: number; tint: number; highlights: number; shadows: number; whites: number; blacks: number;
  hue: number; fade: number; sharpen: number; vignette: number; grain: number;
  hsl?: Record<'red'|'orange'|'yellow'|'green'|'aqua'|'blue'|'purple'|'magenta', { h: number; s: number; l: number }>;
  preset?: string; presetStrength: number;   // 0–1
  skinProtect: boolean;                      // 膚色保護：色溫/飽和調整在膚色範圍內減弱
};
```
- 一個 GLSL shader 完成全部參數（順序：曝光 → 白平衡 → 對比/亮度 → 高光陰影 → HSL → 飽和/自然飽和 → 淡化 → 暗角 → 顆粒）。
- 濾鏡預設至少 12 款：清新、奶油、日系、膠片、復古暖、冷調、黑白、高對比黑白、粉嫩、森林綠、夕陽、HDR 校正（iPhone HDR 素材偏灰時用）。每款以「參數組合」實作（不需要 LUT 檔）；之後可加 `.cube` LUT 匯入。
- UI：滑桿＋前後對比（按住預覽看原圖）；可套用到「此片段 / 全部片段 / 調整圖層」。

## 6. 繪畫與筆刷（R15）

```ts
type BrushStroke = {
  brush: BrushId; color: string; size: number; opacity: number;
  points: Array<[x: number, y: number, pressure: number, t: number]>;  // 畫面比例座標＋時間戳（毫秒，相對筆畫開始）
  seed: number;
};
```
- 用 `perfect-freehand` 產生筆畫外形；PointerEvent 的 `pressure`（Apple Pencil 有值，手指時用速度模擬）。
- 繪畫物件是時間軸上的 `DrawingItem`：可設出現時間、持續時間、`reveal`：直接顯示 / **逐筆描繪**（依記錄的時間戳或平均分配重播），可接進場/出場/循環動畫。
- 筆刷列：

| 筆刷 | 說明 |
|---|---|
| 鋼筆 | 實心、粗細隨壓力 |
| 麥克筆 | 等粗、圓頭（參考影片 7f2bbc94 的白色描邊塗鴉） |
| 螢光筆 | 平頭、半透明、multiply，疊加不會越來越深（整筆一次合成） |
| 鉛筆/蠟筆 | 有紋理顆粒（用雜訊遮罩） |
| 毛筆 | 起筆收筆尖、隨速度變細 |
| 霓虹 | 白芯＋彩色外光暈（可與「發光脈動」特效結合） |
| 虛線 | 可調虛線間距 |
| 點點 | 沿路徑撒圓點 |
| 星星/愛心印章 | 沿路徑撒 ✦ ♥ |
| 彩虹 | 沿路徑色相漸變 |
| 雙線描邊 | 白外框＋彩色內線（貼紙塗鴉感） |
| 噴槍 | 柔邊粒子 |
| 塗鴉抖動 | 畫完後加 `boil` 循環抖動（手繪動畫感） |
| 橡皮擦 | 擦除繪畫物件上的筆畫（用 `destination-out`），可調大小 |

- 控制項：顏色（色票＋自訂）、粗細 1–80px、透明度 5–100%、平滑度、壓力感應開關；復原/重做；清除全部。
- **與特效結合**：任何筆畫都能套：逐筆描繪、霓虹脈動、閃光拖尾（描繪時筆尖撒小星星）、彩虹流動、抖動。

## 7. 自由剪裁遮罩（R16）—— 「VLOG 人頭 O」做法

使用者明確說明：**不是自動去背**。流程：
1. 底層：完整影片（主軌）。
2. 中層：文字「V L G」（O 的位置空出來）。
3. 上層：在疊加軌放一份影片（同一支或另一支），進入「剪裁」模式：
   - **套索**：手指沿人頭描一圈 → 只保留圈內。
   - **圓形/方形**：拖出選取範圍。
   - **橡皮擦**：把多餘部分擦掉（像剪紙丟掉）；**還原筆**：擦錯了補回。
   - 羽化、反轉、白邊（貼紙感，參考影片 8a645cc7 的人物貼紙）。
   - 遮罩跟著素材一起縮放/移動；放到 O 的位置。
   - 人頭在影片裡會移動時：遮罩可加關鍵影格手動對位，或改用「凍結畫面」（把某一格變成圖片）。
4. 技術：遮罩畫成灰階 mask texture（套索/形狀用 Path2D 填白，橡皮擦用 `destination-out`，還原筆再畫白），羽化用模糊；Pixi 用 sprite mask。白邊：mask 膨脹（dilate，用多次偏移疊畫或距離場）後填白，放在素材下面。
- 一鍵模板「VLOG 人頭 O」會自動建立上面 3 層並引導使用者描人頭。

## 8. 使用者附的參考影片拆解（我只看了抽出來的靜止畫面）

| 檔案 | 看到的效果 | 對應功能 |
|---|---|---|
| `7a671989`（Summer Breathability） | 藍天白雲畫面，中間細襯線白字「SUMMER BREATHABILITY」；畫面被**推移轉場**換成另一段（雲朵 → 樹葉），字卡保持不動在上層 | `push-left` 轉場；字卡放在主軌之上的文字軌，時間跨越兩段；細襯線字＋大字距模板 |
| `7f2bbc94`（手繪塗鴉旅行 vlog 片頭） | 風景照上用**白色麥克筆沿著物體（公車、道路、山）描輪廓的塗鴉**，加上小兔子、喇叭等**手繪貼圖**；字卡「今天來學習」**打字機逐字出現** | 繪畫功能（麥克筆＋逐筆描繪＋抖動）、手繪風貼圖、`typewriter` 動畫 |
| `8a645cc7`（摳像和文字動畫） | 漢堡餐點照片上，**人物摳像成貼紙（白邊）**疊在上面，左上手寫英文「hamburger」，背景換上別的畫面 | 自由剪裁遮罩＋白邊、手寫英文字體、`handwrite` 動畫 |
| `d218cc71`（讓 vlog 飛一會兒） | 地面上白色手寫「VLOG」**逐筆寫出**（V → VL → VLO → VLOG），接著**畫一個橢圓把字圈起來** | `handwrite` 進場、`scribble-circle` 裝飾＋`decor-draw` 描線動畫 |

> 這些是第三方創作者的作品，**只參考效果做法**，不要複製其素材、文字或角色。原始錄影沒有放進 repo；若要再看，請使用者重新上傳。

## 本次已接入的多格動態版型
拍貼三格、直式膠卷、四格相紙；每格獨立素材、固定視窗裁切、共用時間軸。動態選項為固定/右滑入左滑出/向上滑過，預覽與單格匯出同源。這只完成本次多格滑動需求，不代表完整 Phase 4 字卡動畫與轉場已完成。

2026-11-12 本次實作：靜態套索遮罩/四邊 crop（無自動追蹤）、手繪圓筆/螢光/點筆/橡皮擦與透明 PNG 收藏。AnimatedGif 依專案秒數選擇影格，預覽與匯出相同。完整逐格與相容即時輸出及原音/配樂混音已實作，瀏覽器成功狀態看 PROGRESS；不是完整 Phase 4/5 全部效果已完成。

2026-11-12：手動去背增加依序 keep/erase 筆刷，來源 UV 儲存並同時作用於預覽/匯出/點選。手繪增加毛筆及鉛筆。聲音支援多組來源保留區間，小倒三角起迄、灰色靜音區及畫面試聽；不改影片時序。


2026-11-12 UTC：最新故事模板：單片中心上下展開，二/三格由上往下依序進入，三個字體輪播與可關閉的結尾暖光；共享 buildScene 與預覽/匯出。新增獨立閃光、暖光、經黑/經白特效，支援時間/長度/強度。模板 cell 空白區以黑/白補時並暫停來源，不是凍結末格。


本次四種轉場是獨立 Project.effects 的視覺疊色（閃光/暖光/經黑/經白），由共享場景合成。故事為可編輯二/三格模板，系統/實際字體輪播；原規格中的完整 shader 轉場目錄仍為後續規劃。


2026-11-13：新增 25 種 A/B 真轉場與 12 種影片特效，保留原四種視覺轉場；同源 A/B 動畫預覽、雙來源交接解碼、Pixi 色彩/模糊與遮罩/變形/粒子。新增 local 秒數線性關鍵幀（位置、大小、旋轉、透明度、亮度/飽和/色溫/色彩），模板整組曲線、修剪/分割取樣邊界；並非完整 Insta360/CapCut 目錄複製。驗收以 PROGRESS 最新快照為準。


2026-11-13 實測修正：使用者可見名稱改定格，播放列直接記錄，細部設定另開；不代表凍結影片時間，兩點之間仍線性變化。交接 + 直接進正確 A/B，已用效果/移除在選項上方，每種/每交接一次、不同種可混搭。播放與轉場期間不顯示編輯框。新增感壓筆（變動壓力優先，手指/滑鼠無壓力變化則以速度與頭尾收筆），鉛筆增加石墨核心與顆粒密度。


2026-11-13 最新 10 點：控制字級以功能列為上限、特效三欄只動畫/名稱；鉛筆改紙紋空隙無實心底線，毛筆與感壓合併保留感壓。自由保留/擦除/描邊用 56 CSS px 預設偏移的目標圈，可調 0–120；存的是目標來源 UV。控制圈僅編輯提示，不進輸出。


2026-11-13：版型文字/底色/文字色/框架透明度可調並保存。Item.animations與layout.animations各有enter/exit（preset/duration），共用25種transitionPair；單一A對透明側，整組版型的frame/blank/cell/title同步，其他層不動。預覽和匯出共享buildScene。詳見plans/2026-11-13-template-controls.md，Safari待真機。


追加：版型寬高獨立於Project.width/height，拍貼/膠卷/故事預設長型、四格相紙預設方形，自訂長寬儲存在layout.size。groupFrame等比容納預設、相對預設尺寸調寬高，來源slot與框架採相同投影；改影片比例只改外部畫布。


2026-11-13最新時長決策（優先於上方舊規劃/九點規格）：單素材進B/退A，可指定任意多組起迄，取消半片長限制。使用者選A10+B10維持20秒，3秒特效在交接前後分配，預設A尾1.5/B頭1.5；不採縮成17秒的重疊，不借靜止邊緣影格。影片/聲音原時間繼續。SourceRanges白線新增一組必成對，所有來源/音訊/模板/特效共用；popup草稿可預覽暫停/復原/取消，套用才保存。詳見plans/2026-11-13-effect-timing.md。


最新更正：單素材僅開頭B進/結尾A退，不再任意多組；單一可動迄/起標籤，固定端不顯示控制，時長連動。時間軸代表字/色別與全站膠囊表單見plans/2026-11-13-anchored-effects-and-playback.md；一般畫面特效/銜接及來源配對不受此限制。

2026-11-14更正：單素材特效起迄popup必須左側預覽、右側完整時間軸，秒數欄位在右側軸下方；不是上下排列。320px直向仍維持左右與44px觸控，窄軸減少刻度數但保留完整時間/單一可調起或迄與聯動時長。


## 2026-11-14 音訊與特效預覽連續性

真正音訊區間（片頭片尾、來源空隙、留聲範圍）用 AudioContext 預先排 12ms 淡入淡出；原生 pause/seek 等音訊時鐘確認淡出完成再做，避免繞過增益包絡。每次重排先 cancelScheduledValues 並 setValueAtTime 明確錨定目前包絡，不在同一 audio quantum 重複 cancelAndHold 而丟失保持事件；同一次淡出不重排。已接管 WebAudio 的元素不以 native muted 切音，有聲素材不反覆微調播放速率。停止與跳轉回呼須驗證目前意圖和素材，跳回同一留聲區也須重排包絡。原生 play 確認前不開聲，從靜音恢復先保持24ms再12ms淡入，讓首個解碼音訊 block 到位；很短的區間會等比例縮短保持及淡入，不延長片段。混音保留餘裕與削峰保護；音量與留聲範圍仍由使用者設定。

逐格匯出只在真正剪輯邊界漸變，不能在每個解碼 buffer 或輸出 chunk 淡出。每個 GainNode 的 intrinsic 初值也須等於起始包絡值，避免 source.start 與 AudioParam 對小數樣本取整不同，漏出預設 gain=1；200% 音量測試曾在 2.730666 秒抓到這個單樣本突波。匯出混音後使用連續 soft knee 限幅。

Compositor 的同來源/crop/mask/尺寸共享 FrameResource，RGB 重影與故障切片共用影格貼圖與上傳，但各 sprite 的位置、色調、濾鏡和遮罩獨立；refcount 歸零才釋放。依真正呈現 frameStamp 更新，固定濾鏡與粒子 canvas 重用。最高邊長≤720的預覽降低柔焦運算量；高清預覽、逐格與即時匯出保留完整柔焦品質。Chromium 資源計數及波形不等於 iPhone 真實 FPS／硬體聲音驗收，見 PLAN §7。


## 2026-11-14 色調本輪實作（優先於§5遠期規劃）
獨立頁籤「色調」，10參數（亮度、飽和度、曝光EV、高光、對比、黑點、鮮艷度、陰影、色溫、淡化）與13參數組合預設。舊brightness/saturation/temperature/tint保留，新增欄位可缺省中性；所有參數與既有菱形一起數值插值，Preset本身不是跳切屬性。逐格／即時匯出、預覽共享同一GradeFilter；中性跳過，非中性一個GPU pass／uniform更新，不逐幀建立貼圖或示意圖預覽。alpha不變。

未有定格改整段，有定格改當前秒數；還原只重設目前色調，不動transform或其他定格。版型沿用整組定格與色調。10新單元與5新瀏覽器／資源計數驗證待成功CI，Safari待真機。詳細plans/2026-11-14-tone-grading.md。§5中的HSL／LUT／skinProtect／調整圖層等仍為遠期，不能當本輪已完成。
