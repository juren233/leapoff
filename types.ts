export type EntityType = 'score' | 'enemy' | 'shield' | 'magnet' | 'nuke';

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

export interface GameState {
  score: number;
  highScore: number;
  isGameOver: boolean;
  isPlaying: boolean;
  shieldActive: boolean;
  magnetActive: boolean;
}