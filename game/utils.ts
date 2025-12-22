/*
 * 文件作用：存放游戏通用的工具函数和辅助逻辑（如随机数、特效创建）
 * 注意：开头这段注释不得删除！！！
 */

import { GameRefs, Star } from '../types';

// 全局震动开关状态（默认为开启）
let isVibrationEnabled = true;

// 设置震动开关的方法
export const setVibrationEnabled = (enabled: boolean) => {
    isVibrationEnabled = enabled;
};

export const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

export const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}分${s}秒`;
};

export const triggerHaptic = (pattern: number | number[]) => {
    // 检查全局开关
    if (!isVibrationEnabled) return;

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(pattern); } catch(e) {}
    }
};

export const calculateCurrentTotalScore = (
    endTime: number | null, 
    startTime: number, 
    orbit: number, 
    actionScore: number
) => {
  const eTime = endTime || Date.now();
  const sTime = startTime || eTime;
  const survivalSeconds = Math.max(0, (eTime - sTime) / 1000);
  const timeScore = Math.floor(survivalSeconds * 5);
  const orbitBonus = (orbit - 1) * 100;
  const multiplier = 1 + (orbit - 1) * 0.1;
  return Math.floor((actionScore + timeScore + orbitBonus) * multiplier);
};

export const initStars = (refs: GameRefs, width: number, height: number) => {
  const starCount = 150;
  const newStars: Star[] = [];
  for(let i=0; i<starCount; i++) {
      newStars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.8 + 0.2,
      });
  }
  refs.starsRef.current = newStars;
};

export const createExplosion = (refs: GameRefs, x: number, y: number, color: string, count = 12, speed = 15) => {
  for (let i = 0; i < count; i++) {
    refs.particlesRef.current.push({
      x,
      y,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
      life: 1.0,
      color,
      size: Math.random() * 4 + 2
    });
  }
};

export const createShockwave = (refs: GameRefs, x: number, y: number, color: string) => {
  refs.shockwavesRef.current.push({ x, y, radius: 10, maxRadius: 400, life: 1.0, color });
};

export const spawnFloatingText = (refs: GameRefs, x: number, y: number, text: string, color: string, size: number = 24) => {
    refs.floatingTextsRef.current.push({ x, y, text, color, life: 1.0, vy: -1.9, size });
};