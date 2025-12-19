export const GAME_VERSION = "v8.5.5-Refactor";

export const PLAYER_CONFIG = {
  baseRadius: 100,
  accelOut: 0,    
  gravity: 0.125, 
  drag: 0.94,     
  rotSpeed: 0.01, 
  dashRotSpeed: 0.03, 
  size: 14,
  trailLength: 25,
};

export const MAX_ALTITUDE = 1500; 
export const BONUS_DURATION_FRAMES = 60 * 10; // 10 seconds at 60fps
export const BONUS_SCORE_THRESHOLD = 2000;

export const COLORS = {
  player: '#00d2ff',
  enemy: '#ff3333',
  score: '#ffffff',
  shield: '#00ff00',   
  magnet: '#bf00ff',   
  nuke: '#facc15',     
  dash: '#f97316',
  coin: '#fbbf24',     
  background: '#111111',
  grid: '#333333'
};

export const CENTER_SAFE_LIMIT = 300; 
export const CENTER_DEATH_LIMIT = 480; 
