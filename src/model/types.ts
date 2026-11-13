// 資料模型（見 docs/PLAN.md §2.5）。Phase 1 只有主軌的影片/照片片段；
// 其他軌道與物件種類（文字、貼圖、繪畫、調整）在之後的 Phase 加進 Track.kind / Item 聯集。

export type Aspect = '9:16' | '16:9' | '1:1' | '3:4' | '4:3';

export type Asset = {
  id: string;
  kind: 'video' | 'image' | 'audio';
  name: string;
  mime: string;
  size: number; // bytes
  duration: number; // 秒；照片為 0
  width: number;
  height: number;
  hasAudio: boolean;
  /** 小縮圖（JPEG dataURL），沿著素材時間平均取樣，用於時間軸與專案封面 */
  thumbs: string[];
  generated?: { color: string };
  origin?: 'upload' | 'drawing' | 'giphy';
  attribution?: { title: string; url: string };
};

export type Transform = { x: number; y: number; scale: number; rotation: number; opacity: number };

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'add';
export type Outline = { color: string; width: number }; // width：以 1080 寬畫面為基準的 px
/** 裁切：各邊切掉的比例 0–0.9 */
export type Crop = { l: number; t: number; r: number; b: number };

export type ColorAdjustment = { brightness: number; saturation: number; temperature: number; tint: string };
export type AnimatedValues = Transform & ColorAdjustment;
export type Keyframe = { time: number; values: AnimatedValues };
export type TransitionPreset =
  | 'crossfade'
  | 'push-left'
  | 'push-right'
  | 'push-up'
  | 'push-down'
  | 'slide-left'
  | 'slide-right'
  | 'wipe-left'
  | 'wipe-right'
  | 'wipe-up'
  | 'wipe-down'
  | 'split-horizontal'
  | 'split-vertical'
  | 'grid4'
  | 'grid9'
  | 'zoom-in'
  | 'zoom-out'
  | 'spin'
  | 'page-turn'
  | 'blur'
  | 'glitch'
  | 'film-up'
  | 'film-left'
  | 'projector'
  | 'circle';
export type VideoEffectPreset =
  | 'shake'
  | 'pulse'
  | 'soft-blur'
  | 'grain'
  | 'mono'
  | 'warm-tone'
  | 'cool-tone'
  | 'glitch-video'
  | 'rgb-split'
  | 'vignette'
  | 'snow'
  | 'sparkle';

export type ItemBase = {
  id: string;
  name?: string;
  keyframes?: Keyframe[];
  adjustment?: ColorAdjustment;
  start: number; // 時間軸位置（秒）。主軌由 relayout 自動算出，首尾相接
  duration: number; // 時間軸上的長度（秒）
  /** x、y：中心點，佔畫面寬/高的比例；scale：乘上「填滿/完整」算出的基本大小；rotation：度，順時針 */
  transform: Transform;
  blend?: BlendMode;
  cornerRadius?: number; // 0–0.5，佔短邊的比例（畫中畫圓角）
  outline?: Outline;
  crop?: Crop;
};

export type MaskStroke = { tool: 'keep' | 'erase'; size: number; points: [number, number][] };
export type MediaMask = { points: [number, number][]; strokes?: MaskStroke[] };

export type VideoItem = ItemBase & {
  type: 'video' | 'image' | 'audio';
  assetId: string;
  trimIn: number; // 素材內的起點（秒）
  speed: number; // 0.25–4；照片固定 1
  volume: number; // 0–1
  audioEnabled?: boolean;
  mask?: MediaMask;
  /** Retained source-time audio intervals; omitted = all sound. Empty = silent. */
  audioRanges?: [number, number][];
  /** Retained source intervals for picture and its sound; omitted = continuous. */
  sourceRanges?: [number, number][];
  /** Source selection is independent from the common template frame interval. */
  cell?: { sourceEnd: number; offset: number; blanks: [number, number][]; background: '#000000' | '#ffffff' };
  fit: 'cover' | 'contain';
  /** 多格版型的固定視窗（畫面比例座標）；素材可在視窗內拖移/縮放。 */
  slot?: { x: number; y: number; w: number; h: number };
};

// 字卡（規格見 docs/TEXT_CARDS.md）。新欄位都是選填，Phase 2 存的舊字卡不用轉換。
export type Stroke = { color: string; width: number }; // width：從字緣往外的厚度，px（1080 基準）
export type TextShadow = { color: string; blur: number; x: number; y: number };
export type TextRun = {
  text: string;
  fontId: string;
  size: number; // px，以 1080（畫面短邊）為基準
  color: string;
  letterSpacing: number; // em，-0.2 ~ 1.0
  lineHeight: number; // 倍數，0.8 ~ 2.5
  weight: 'normal' | 'bold';
  italic?: boolean; // 字型沒有斜體就斜切 -12°
  /** 多層描邊（由外到內，畫的時候依厚度由大到小）。例：白 12 + 粉 6 */
  strokes?: Stroke[];
  shadow?: TextShadow;
};
export type DecorationKind =
  | 'tail-loop'
  | 'wave-underline'
  | 'dashed-underline'
  | 'dotted-underline'
  | 'double-line'
  | 'marker'
  | 'scribble-circle'
  | 'arrow-curve'
  | 'sparkles'
  | 'hearts'
  | 'slashes'
  | 'check'
  | 'corner-brackets';
/** 字卡裝飾。width：線寬，佔文字墨跡高度的比例（星星、愛心、螢光筆不用） */
export type Decoration = {
  kind: DecorationKind;
  color: string;
  width: number;
  offset?: number;
  length?: number;
  opacity?: number;
};
export type BoxShape =
  | 'rect'
  | 'roundRect'
  | 'pill'
  | 'ellipse'
  | 'triangle'
  | 'diamond'
  | 'parallelogram'
  | 'trapezoid'
  | 'pentagon'
  | 'hexagon'
  | 'octagon'
  | 'cross'
  | 'snip'
  | 'heart'
  | 'cloud'
  | 'cylinder'
  | 'speech-rect'
  | 'speech-round'
  | 'speech-oval'
  | 'thought'
  | 'burst-bubble'
  | 'star4'
  | 'star5'
  | 'star6'
  | 'star8'
  | 'burst'
  | 'badge'
  | 'banner'
  | 'tag'
  | 'arrow-right'
  | 'chevron'
  | 'step'
  | 'doc';
/** 字塊（字卡的底色塊）。尺寸＝文字墨跡 + 四邊內距，所以上下左右分開調才會準 */
export type CardBox = {
  shape: BoxShape;
  fill: string;
  opacity: number; // 0–1
  padding: { top: number; right: number; bottom: number; left: number }; // px（1080 基準）
  nudgeY: number; // 文字在字塊內的垂直微調 px
  radius?: number; // roundRect / speech-round 的圓角 px；pill 固定半圓
  stroke?: Stroke & { opacity?: number }; // 字塊外框（畫在圖形邊緣）
  tailDir?: 'bottom-left' | 'bottom-right'; // 對話框尾巴方向（預設左下）
  softness?: number; // 0–1，輪廓轉角柔和程度
  depth?: number; // 0–1，凹槽深度；舊資料預設 1
};
export type TextCard = {
  runs: TextRun[];
  align: 'left' | 'center' | 'right';
  /** 文字區寬度 px（1080 基準），超過自動換行；沒有＝依文字長度 */
  width?: number;
  box?: CardBox;
  decorations?: Decoration[];
};
export type TextItem = ItemBase & { type: 'text'; card: TextCard };

export type Item = VideoItem | TextItem;

/** 軌道由下往上排列；main 僅保留作為舊存檔/匯入相容錨點，層次不固定 */
export type TrackKind = 'main' | 'overlay' | 'text' | 'audio';

export type Track = {
  id: string;
  kind: TrackKind;
  name: string;
  hidden: boolean;
  locked: boolean;
  muted?: boolean;
  template?: boolean;
  layout?: Project['layout']; // A grouped template carries its own frame and timing.
  items: Item[];
};

export type Project = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  aspect: Aspect;
  /** true = 比例跟著第一個素材自動決定（使用者手動改過比例就變 false）；舊專案沒有這個欄位＝false */
  aspectAuto?: boolean;
  width: number;
  height: number;
  fps: number;
  mainOffset?: number;
  freeMain?: boolean;
  flexibleLayers?: boolean; // Main/overlay share editable image/video lanes.
  background?: string;
  layout?: {
    style: 'photobooth' | 'filmstrip' | 'polaroid' | 'story';
    motion: 'none' | 'slide' | 'drift';
    transform?: Pick<Transform, 'x' | 'y' | 'scale'>;
    keyframes?: Keyframe[];
    adjustment?: ColorAdjustment;
    opacity?: number;
    count?: number;
    story?: {
      title: string;
      fontIds: string[];
      fontInterval: number;
      opening: number;
      step: number;
      flash: boolean;
    };
    start: number;
    duration: number;
  };
  effects?: {
    id: string;
    preset: 'flash' | 'fade-black' | 'fade-white' | 'light-leak' | VideoEffectPreset;
    start: number;
    duration: number;
    strength: number;
    targetId?: string;
  }[];
  transitions?: { id: string; preset: TransitionPreset; fromId: string; toId: string; duration: number }[];
  assets: Asset[];
  tracks: Track[];
  thumbnail?: string;
  version: 1;
};
