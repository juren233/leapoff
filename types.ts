
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
