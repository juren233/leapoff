import React from 'react';

/*
 * 文件作用：定义游戏所需的所有类型接口
 * 注意：开头这段注释不得删除！！！
 */

export type EntityType = 'score' | 'enemy' | 'shield' | 'magnet' | 'nuke' | 'dash' | 'coin';

export interface Point {
  x: number;
  y: number;
}

// 对应后端的 JSON 结构
export interface GameConfig {
  player: {
    baseRadius: number;
    accelOut: number;
    gravity: number;
    bonusGravity: number;
    drag: number;
    rotSpeed: number;
    dashRotSpeed: number;
    size: number;
    trailLength: number;
  };
  buffs: {
    shieldDuration: number;
    shieldMaxHits: number;
    magnetDuration: number;
    magnetMaxCount: number;
    dashDuration: number;
  };
  gameParams: {
    maxAltitude: number;
    bonusDurationSeconds: number;
    bonusScoreThreshold: number;
    centerSafeLimit: number;
    centerDeathLimit: number;
  };
}

export interface Player {
  angle: number;
  radius: number;
  baseRadius: number; // Keep this on player for easy access, but init from config
  leapLimit: number;
  rVelocity: number;
  accelOut: number;
  gravity: number;
  drag: number;
  rotSpeed: number;
  size: number;
  color: string;
  x: number;
  y: number;
  trail: Point[];
  shieldTime: number; // Unit: Seconds
  shieldHits: number; // New: Remaining hits the shield can take
  magnetTime: number; // Unit: Seconds
  magnetCount: number; // Track number of orbs absorbed by current magnet
  dashTime: number; // Unit: Seconds
  centerTime: number; // Time spent at the center hub
  trailAccumulator: number; // Accumulator for consistent trail length across refresh rates
}

export interface Entity {
  id: number; // Unique ID for keying if needed, though mostly used in refs
  type: EntityType;
  angle: number;
  dist: number;
  active: boolean;
  scale: number;
  maxScale: number;
  size: number;
  color: string;
  rotation: number;
  moveSpeed: number;
  // New properties for Safety Ring logic
  isSafety?: boolean;       // If true, this orb respawns and belongs to the inner ring
  baseDist?: number;        // Original distance for wobble calculation
  respawnTimer?: number;    // Frames until respawn
  wobblePhase?: number;     // Random offset for movement
  styleVariant?: number;    // Visual variant index (e.g., for different gift box colors)
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number; // 1.0 to 0.0
  color: string;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  vy: number;
  size: number;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
}

// --- New Ambient Types for Christmas Theme ---
export interface SnowParticle {
  x: number;
  y: number;
  radius: number;
  speed: number;
  opacity: number;
  swayOffset: number; // For sine wave movement
}

export interface GameState {
  score: number;
  highScore: number;
  isGameOver: boolean;
  isPlaying: boolean;
  shieldActive: boolean;
  magnetActive: boolean;
}

export interface LeaderboardEntry {
  username: string;
  score: number;
  created_at: string;
}

// --- New Shared Types for UI Components ---

export type GameStateStatus = 'START' | 'PLAYING' | 'DYING' | 'GAMEOVER';

export interface UploadStatus {
  status: 'idle' | 'uploading' | 'success' | 'error';
  msg: string;
}

export interface SystemStatus {
  status: 'checking' | 'ok' | 'error';
  msg: string;
}

export interface GameStats {
  duration: number;
  formattedDuration: string;
  finalOrbit: number;
  actionScore: number;
  timeScore: number;
  orbitBonus: number;
  multiplier: number;
  coinsCollected: number;
}

// Settings Types
// 修改为 string 以支持从数据库动态加载更多主题
export type ThemeType = string;

// 定义从数据库获取的主题数据结构 (snake_case 对应 DB 列名)
export interface ThemeData {
  id: string;
  name: string;
  description: string;
  color: string;           // Tailwind class (e.g., bg-cyan-500)
  // 移除了 active_border 和 active_shadow，改为前端自动计算
  is_visible?: boolean;
  is_default?: boolean;    // 新增：是否为后端指定的默认主题
  sort_order?: number;
  bgm_url?: string;        // 新增：该主题专属的 BGM 链接
}

export interface GameSettings {
  bgmEnabled: boolean;
  sfxEnabled: boolean;
  vibrationEnabled: boolean; // 新增震动开关
  theme: ThemeType;
}

// Key Mapping for Game Refs used across modules
export interface GameRefs {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  gameStateRef: React.MutableRefObject<GameStateStatus>;
  actionScoreRef: React.MutableRefObject<number>;
  orbitRef: React.MutableRefObject<number>;
  gameStartTimeRef: React.MutableRefObject<number>;
  gameEndTimeRef: React.MutableRefObject<number | null>;
  isFillingInnerZoneRef: React.MutableRefObject<boolean>;
  deathTimerRef: React.MutableRefObject<number>;
  maxDeathTimerRef: React.MutableRefObject<number>;
  coinsRef: React.MutableRefObject<number>;
  lastBonusThresholdRef: React.MutableRefObject<number>;
  isBonusTimeRef: React.MutableRefObject<boolean>;
  bonusTimerRef: React.MutableRefObject<number>;
  frameId: React.MutableRefObject<number>;
  isPressing: React.MutableRefObject<boolean>;
  shake: React.MutableRefObject<number>;
  dimensions: React.MutableRefObject<{ width: number; height: number; cx: number; cy: number }>;
  cameraRef: React.MutableRefObject<{ x: number; y: number; zoom: number }>;
  playerRef: React.MutableRefObject<Player>;
  entitiesRef: React.MutableRefObject<Entity[]>;
  particlesRef: React.MutableRefObject<Particle[]>;
  shockwavesRef: React.MutableRefObject<Shockwave[]>;
  floatingTextsRef: React.MutableRefObject<FloatingText[]>;
  starsRef: React.MutableRefObject<Star[]>;
  entityIdCounter: React.MutableRefObject<number>;
  totalCoinsRef: React.MutableRefObject<number>;
  highScoreRef: React.MutableRefObject<number>;
  hasSyncedToServerRef: React.MutableRefObject<boolean>;
  isSyncingRef: React.MutableRefObject<boolean>;
  // 新增 settingsRef 以便在渲染循环中访问主题
  settingsRef: React.MutableRefObject<GameSettings>;
  // 新增 configRef 以便在物理循环中访问动态云参数
  configRef: React.MutableRefObject<GameConfig>;
  // 新增：精确的时间生成累积器 (Time Accumulators for Spawning)
  spawnTimerRef: React.MutableRefObject<number>;
  ambienceTimerRef: React.MutableRefObject<number>;
  // 新增：圣诞氛围 Ref (Removed Reindeer)
  snowParticlesRef: React.MutableRefObject<SnowParticle[]>;
}