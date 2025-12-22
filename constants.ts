
export const GAME_VERSION = "v8.8.1-music";

export const PLAYER_CONFIG = {
  baseRadius: 100,
  accelOut: 0,    
  gravity: 0.2, 
  bonusGravity: 0.5, // 金币模式下的重力，比普通模式(0.2)重，增加下落速度感
  drag: 0.94,     
  rotSpeed: 0.04, 
  dashRotSpeed: 0.08, 
  size: 14,
  trailLength: 15,
};

export const MAX_ALTITUDE = 1500; 
export const BONUS_DURATION_SECONDS = 10; // Explicitly 10 seconds
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