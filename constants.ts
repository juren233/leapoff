import { GameConfig } from "./types";

export const GAME_VERSION = "v9.0.1-MerryXmas";

// Shared Cache Key for Themes & Config
export const THEME_CACHE_KEY = 'leap_orbit_themes_list_v1';
export const CONFIG_CACHE_KEY = 'leap_orbit_game_config_v1';

// Default / Fallback BGM URL (Classic)
export const DEFAULT_BGM_URL = 'https://raw.githubusercontent.com/juren233/leapoffthings/main/assets/bgm.mp3';

// 颜色配置（纯视觉，通常不需要云控）
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

// --- DEFAULT CONFIGURATION (FALLBACK) ---
// 如果无法连接后端，使用此配置
export const DEFAULT_GAME_CONFIG: GameConfig = {
  player: {
    baseRadius: 100,
    accelOut: 0,    
    gravity: 0.2, 
    bonusGravity: 0.5, // 金币模式下的重力
    drag: 0.94,     
    rotSpeed: 0.04, 
    dashRotSpeed: 0.08, 
    size: 14,
    trailLength: 15,
  },
  buffs: {
    shieldDuration: 5,
    shieldMaxHits: 2,
    magnetDuration: 4,
    magnetMaxCount: 15,
    dashDuration: 3
  },
  gameParams: {
    maxAltitude: 1500,
    bonusDurationSeconds: 10,
    bonusScoreThreshold: 2000,
    centerSafeLimit: 0, // 进入中心即警告
    centerDeathLimit: 3 // 3秒后死亡
  }
};
