/*
 * 文件作用：定义游戏所需的所有类型接口
 * 注意：开头这段注释不得删除！！！
 */

export type EntityType = 'score' | 'enemy' | 'shield' | 'magnet' | 'nuke' | 'dash' | 'coin';

export interface Point {
  x: number;
  y: number;
}

export interface Player {
  angle: number;
  radius: number;
  baseRadius: number;
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
  shieldTime: number;
  magnetTime: number;
  magnetCount: number; // Track number of orbs absorbed by current magnet
  dashTime: number; // Duration for the dash power-up
  centerTime: number; // Time spent at the center hub
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
}
