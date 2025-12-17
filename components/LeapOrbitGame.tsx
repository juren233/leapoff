import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Player, Entity, Particle, Shockwave, EntityType, FloatingText } from '../types';
import { Shield, Zap, Skull, Trophy, Play, RefreshCw, AlertTriangle, RotateCw, Flame, Clock, Hash } from 'lucide-react';

const GAME_VERSION = "v6.9.10-Turbo";

// --- Game Constants ---
const PLAYER_CONFIG = {
  baseRadius: 100,
  accelOut: 0,    // 移除主动推力
  gravity: 0.125, // 保持原版引力
  drag: 0.94,     // 空气阻力
  rotSpeed: 0.01, // 基础转速调整为 0.01 (用户指定)
  dashRotSpeed: 0.03, // 冲刺转速适配调整，保持冲刺感
  size: 14,
  trailLength: 25,
};

// 游戏边界设定
const MAX_ALTITUDE = 1500; 

const COLORS = {
  player: '#00d2ff',
  enemy: '#ff3333',
  score: '#ffffff',
  shield: '#00ff00',   // Green
  magnet: '#bf00ff',   // Purple
  nuke: '#facc15',     // Yellow
  dash: '#f97316',     // Orange
  background: '#111111',
  grid: '#333333'
};

// 中心死亡倒计时设定 (60fps) - 保持不变
const CENTER_SAFE_LIMIT = 300; // 5秒
const CENTER_DEATH_LIMIT = 480; // 8秒

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
}

export const LeapOrbitGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- React State for UI ---
  const [scoreDisplay, setScoreDisplay] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [uiGameState, setUiGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  // Changed buffs state to store remaining frames instead of boolean
  const [buffs, setBuffs] = useState({ shield: 0, magnet: 0, dash: 0 });
  const [centerWarning, setCenterWarning] = useState(false);
  const [orbitCountDisplay, setOrbitCountDisplay] = useState(1);
  const [gameStats, setGameStats] = useState({ duration: 0, finalOrbit: 1 });

  // --- Mutable Game State ---
  const gameStateRef = useRef<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const scoreRef = useRef(0);
  const orbitRef = useRef(1);      // 当前是第几圈 (从1开始)
  const lastAngleRef = useRef(0);
  const gameStartTimeRef = useRef(0);
  const isFillingInnerZoneRef = useRef(true); // 控制内圈是否处于填充状态
  
  const frameId = useRef<number>(0);
  const isPressing = useRef<boolean>(false);
  const shake = useRef<number>(0);
  const dimensions = useRef({ width: 0, height: 0, cx: 0, cy: 0 });

  // 摄像机状态
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });

  // 玩家状态
  const playerRef = useRef<Player>({
    angle: 0,
    radius: PLAYER_CONFIG.baseRadius,
    baseRadius: PLAYER_CONFIG.baseRadius,
    leapLimit: 999999,
    rVelocity: 0,
    accelOut: PLAYER_CONFIG.accelOut,
    gravity: PLAYER_CONFIG.gravity,
    drag: PLAYER_CONFIG.drag,
    rotSpeed: PLAYER_CONFIG.rotSpeed,
    size: PLAYER_CONFIG.size,
    color: COLORS.player,
    x: 0,
    y: 0,
    trail: [],
    shieldTime: 0,
    magnetTime: 0,
    magnetCount: 0,
    dashTime: 0, // 冲刺剩余时间
    centerTime: 0
  });

  const entitiesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]); // New Ref for floating text
  const starsRef = useRef<Star[]>([]);
  const entityIdCounter = useRef(0);

  // --- Helper Functions ---
  const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}分${s}秒`;
  };

  const initStars = (width: number, height: number) => {
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
    starsRef.current = newStars;
  };

  const createExplosion = (x: number, y: number, color: string, count = 12, speed = 15) => { // Speed 12 -> 15
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
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
  
  const createShockwave = (x: number, y: number, color: string) => {
    shockwavesRef.current.push({
        x, 
        y,
        radius: 10,
        maxRadius: 400,
        life: 1.0,
        color
    });
  };

  const spawnFloatingText = (x: number, y: number, text: string, color: string, size: number = 24) => {
      floatingTextsRef.current.push({
          x,
          y,
          text,
          color,
          life: 1.0,
          vy: -1.9, // Speed up float (-1.5 -> -1.9)
          size
      });
  };

  // 生成内圈光点 (安全圈)
  // 规则：前3圈固定40个，之后每圈减少5个
  const spawnSafetyRing = (orbitNum: number) => {
      // 先移除旧的内圈光点 - Added check for e
      entitiesRef.current = entitiesRef.current.filter(e => e && !e.isSafety);

      let count = 40;
      // 从第4圈开始衰减 (orbitNum > 3)
      if (orbitNum > 3) {
          const reduction = (orbitNum - 3) * 5;
          count = Math.max(0, 40 - reduction);
      }

      const ringRadius = PLAYER_CONFIG.baseRadius + 80;
      for(let i=0; i<count; i++) {
          entitiesRef.current.push({
              id: entityIdCounter.current++,
              type: 'score',
              angle: (Math.PI * 2 / count) * i,
              dist: ringRadius, 
              baseDist: ringRadius, 
              active: true,
              scale: 1,
              maxScale: 1,
              rotation: 0,
              moveSpeed: 0.0019, // 内圈速度微调 (0.0015 -> 0.0019)
              size: 14,
              color: COLORS.score,
              isSafety: true, 
              wobblePhase: Math.random() * Math.PI * 2
          });
      }
  };

  // 专属内圈生成器 (用于增加中心区域光点密度)
  const spawnInnerAmbience = () => {
    // 限制总实体数
    if (entitiesRef.current.length > 350) return;

    // 定义安全区半径 (与禁止生成红刺区域一致)
    const SAFE_ZONE_RADIUS = PLAYER_CONFIG.baseRadius + 300;
    
    // 智能填充逻辑 (Hysteresis Loop)
    // 1. 统计当前区域内有效光点数量 - Added check for e
    const currentInnerCount = entitiesRef.current.filter(e => 
        e && e.type === 'score' && e.dist <= SAFE_ZONE_RADIUS && e.active
    ).length;

    const UPPER_LIMIT = 50; // 达到50个停止生成
    const LOWER_LIMIT = 20; // 降到20个重新开始生成

    if (isFillingInnerZoneRef.current) {
        if (currentInnerCount >= UPPER_LIMIT) {
            isFillingInnerZoneRef.current = false;
        }
    } else {
        if (currentInnerCount <= LOWER_LIMIT) {
            isFillingInnerZoneRef.current = true;
        }
    }

    // 如果未处于填充状态，直接返回
    if (!isFillingInnerZoneRef.current) return;

    // 加快生成速度：在填充状态下，使用较高概率 (15%)
    if (Math.random() > 0.15) return;

    // 安全区范围：Base + 50 ~ Base + 300
    const dist = randomRange(PLAYER_CONFIG.baseRadius + 50, SAFE_ZONE_RADIUS);
    
    // 几乎全是光点，极低概率出辅助道具
    let type: EntityType = 'score';
    if (Math.random() < 0.02) {
        const r = Math.random();
        if (r < 0.33) type = 'shield';
        else if (r < 0.66) type = 'magnet';
        else type = 'dash';
    }

    const entity: Entity = {
        id: entityIdCounter.current++,
        type,
        angle: randomRange(0, Math.PI * 2),
        dist,
        active: true,
        scale: 0,
        maxScale: 1,
        rotation: 0,
        // 内圈杂物速度加快
        moveSpeed: randomRange(0.0012, 0.0025) * (Math.random() > 0.5 ? 1 : -1),
        size: type === 'score' ? 12 : 16,
        color: COLORS[type],
        isSafety: false
    };

    entitiesRef.current.push(entity);
  };

  // --- 实体生成逻辑 (主生成器) ---
  const spawnEntity = () => {
    const maxEntities = 350; 
    if (entitiesRef.current.length > maxEntities) return;

    const currentOrbit = orbitRef.current;
    
    // 生成频率：随速度增加适当提高，保持密度 (0.08 -> 0.1, 0.03 -> 0.0375)
    const spawnChance = Math.min(0.1, 0.0375 + (currentOrbit * 0.0025)); 
    
    if (Math.random() > spawnChance) return;

    const playerRadius = playerRef.current.radius;
    let type: EntityType = 'score';

    // 随机数用于决定是 敌人 还是 道具
    
    // --- 概率分配逻辑 ---
    if (currentOrbit >= 3) {
        // === 第三圈及以后 ===
        // 30% 敌人
        if (Math.random() < 0.3) {
            type = 'enemy';
        } else {
            // 70% 道具池 (含光点)
            if (Math.random() < 0.25) { // 25% 概率出特殊道具
                const rProp = Math.random();
                if (rProp < 0.1) type = 'magnet';      // 10% 紫
                else if (rProp < 0.3) type = 'dash';   // 20% 橙
                else if (rProp < 0.6) type = 'shield'; // 30% 绿
                else type = 'nuke';                    // 40% 黄
            } else {
                type = 'score';
            }
        }
    } else {
        // === 第三圈之前 (新手/发育期) ===
        const enemyChance = Math.min(0.01 + (scoreRef.current * 0.0002), 0.1);
        
        if (Math.random() < enemyChance) {
            type = 'enemy';
        } else {
            if (Math.random() < 0.15) { // 15% 概率出特殊道具
                const rProp = Math.random();
                if (rProp < 0.1) type = 'nuke';        // 10% 黄
                else if (rProp < 0.3) type = 'dash';   // 20% 橙
                else if (rProp < 0.5) type = 'magnet'; // 20% 紫
                else type = 'shield';                  // 50% 绿
            } else {
                type = 'score';
            }
        }
    }

    // 生成范围
    const baseSpawn = Math.max(PLAYER_CONFIG.baseRadius + 50, playerRadius - 500);
    const ceilingSpawn = Math.min(playerRadius + 600, MAX_ALTITUDE - 200);
    
    if (baseSpawn > MAX_ALTITUDE) return;

    const spawnDist = randomRange(baseSpawn, ceilingSpawn);

    // 1. 防止磁铁生成在中心附近 (避免吸走保命圈)
    if (type === 'magnet' && spawnDist < PLAYER_CONFIG.baseRadius + 450) {
        type = 'score';
    }

    // 2. 禁止红刺在中心安全区生成 (New Fix)
    // 设定安全区半径为 Base + 300 (约 400 距离)
    const ENEMY_SAFE_DIST = PLAYER_CONFIG.baseRadius + 300;
    if (type === 'enemy' && spawnDist < ENEMY_SAFE_DIST) {
        type = 'score';
    }

    const spawnAngle = randomRange(0, Math.PI * 2);

    // 实体移动速度全局加快
    const moveSpeed = randomRange(0.0012, 0.0031) * (Math.random() > 0.5 ? 1 : -1);

    const entity: Entity = {
      id: entityIdCounter.current++,
      type,
      angle: spawnAngle,
      dist: spawnDist,
      active: true,
      scale: 0,
      maxScale: 1,
      rotation: 0,
      moveSpeed: moveSpeed,
      size: type === 'score' ? 12 : (type === 'enemy' ? 18 : 16),
      color: COLORS[type],
      isSafety: false
    };

    entitiesRef.current.push(entity);
  };

  const initGame = () => {
    playerRef.current = {
      ...playerRef.current,
      angle: 0,
      radius: PLAYER_CONFIG.baseRadius + 140, 
      rVelocity: 0,
      shieldTime: 0,
      magnetTime: 0,
      magnetCount: 0, // Reset magnet count
      dashTime: 0, 
      centerTime: 0, 
      trail: [],
      x: 0,
      y: 0
    };
    entitiesRef.current = [];
    particlesRef.current = [];
    shockwavesRef.current = [];
    floatingTextsRef.current = [];
    scoreRef.current = 0;
    
    orbitRef.current = 1; 
    lastAngleRef.current = 0;
    gameStartTimeRef.current = Date.now();
    isFillingInnerZoneRef.current = true; // Reset fill state
    
    cameraRef.current = { x: 0, y: 0, zoom: 1 };

    setScoreDisplay(0);
    setOrbitCountDisplay(1);
    setBuffs({ shield: 0, magnet: 0, dash: 0 });
    setCenterWarning(false);
    isPressing.current = false;
    
    // 生成初始光点圈 (Safety Ring)
    spawnSafetyRing(1);
  };

  const startGame = () => {
    initGame();
    gameStateRef.current = 'PLAYING';
    setUiGameState('PLAYING');
  };

  const handleGameOver = () => {
    gameStateRef.current = 'GAMEOVER';
    const duration = Date.now() - gameStartTimeRef.current;
    
    // Explode all active entities on game over
    entitiesRef.current.forEach(e => {
        if (e && e.active) {
            const ex = Math.cos(e.angle) * e.dist;
            const ey = Math.sin(e.angle) * e.dist;
            createShockwave(ex, ey, e.color);
            createExplosion(ex, ey, e.color, 5, 8); // Minor explosion for visual flair
        }
    });
    // Clear entities after explosion
    entitiesRef.current = [];

    setGameStats({
        duration: duration,
        finalOrbit: orbitRef.current
    });
    setHighScore(prev => Math.max(prev, scoreRef.current));
    setUiGameState('GAMEOVER');
  };

  // --- Main Update Loop ---
  const update = () => {
    if (gameStateRef.current !== 'PLAYING') return;

    const player = playerRef.current;
    
    // 状态检测
    if (player.shieldTime > 0) player.shieldTime--;
    if (player.magnetTime > 0) player.magnetTime--;
    if (player.dashTime > 0) player.dashTime--;

    const hasShield = player.shieldTime > 0;
    const hasMagnet = player.magnetTime > 0;
    const hasDash = player.dashTime > 0;

    // --- 操作逻辑与物理 ---
    if (hasDash) {
        // === 冲刺状态逻辑 ===
        player.angle += PLAYER_CONFIG.dashRotSpeed;
        player.rVelocity *= 0.5; 
    } else {
        // === 正常状态逻辑 ===
        if (isPressing.current) {
            player.angle += player.rotSpeed; 
        }
        player.rVelocity -= player.gravity; 
    }

    // 阻力
    player.rVelocity *= player.drag; 
    player.radius += player.rVelocity;

    // --- 圈数检测逻辑 ---
    const rawOrbits = player.angle / (Math.PI * 2);
    const currentOrbitNum = Math.floor(rawOrbits) + 1; 

    if (currentOrbitNum > orbitRef.current) {
        orbitRef.current = currentOrbitNum;
        setOrbitCountDisplay(currentOrbitNum);
        
        shake.current = 5;
        createShockwave(0, 0, '#00d2ff');

        spawnSafetyRing(currentOrbitNum);
    }

    // 下界限制与反弹
    if (player.radius < player.baseRadius) {
      player.radius = player.baseRadius;
      if (player.rVelocity < -1) {
        player.rVelocity = -player.rVelocity * 0.4; 
        shake.current = Math.min(Math.abs(player.rVelocity) * 2, 5);
      } else {
        player.rVelocity = 0;
      }
    }

    // 中心停留死亡机制
    const DANGER_ZONE = player.baseRadius + 10;
    if (player.radius <= DANGER_ZONE) {
        player.centerTime++;
        if (player.centerTime > CENTER_SAFE_LIMIT) {
            setCenterWarning(true);
            shake.current = (player.centerTime - CENTER_SAFE_LIMIT) / 20; 
            if (player.centerTime > CENTER_DEATH_LIMIT) {
                createExplosion(player.x, player.y, COLORS.enemy, 30, 20); 
                createShockwave(0, 0, COLORS.enemy);
                shake.current = 40;
                handleGameOver();
            }
        }
    } else {
        if (player.centerTime > 0) {
             player.centerTime = 0;
             setCenterWarning(false);
        }
    }
    
    player.x = Math.cos(player.angle) * player.radius;
    player.y = Math.sin(player.angle) * player.radius;

    player.trail.push({ x: player.x, y: player.y });
    if (player.trail.length > PLAYER_CONFIG.trailLength) {
      player.trail.shift();
    }

    // --- 相机逻辑 ---
    const { width, height } = dimensions.current;
    const targetCamX = player.x * 0.5;
    const targetCamY = player.y * 0.5;
    const margin = hasDash ? 350 : 200; 
    const requiredCoverage = (player.radius * 2) + margin; 
    const minScreenDim = Math.min(width, height);
    let targetZoom = minScreenDim / requiredCoverage;
    targetZoom = Math.max(0.35, Math.min(1.0, targetZoom));
    const camLerp = 0.08; 
    const zoomLerp = 0.05;
    cameraRef.current.x += (targetCamX - cameraRef.current.x) * camLerp;
    cameraRef.current.y += (targetCamY - cameraRef.current.y) * camLerp;
    cameraRef.current.zoom += (targetZoom - cameraRef.current.zoom) * zoomLerp;

    // 实体逻辑 (主 + 辅助)
    spawnEntity();
    spawnInnerAmbience();

    const now = Date.now();
    const currentOrbit = orbitRef.current;

    for (let i = entitiesRef.current.length - 1; i >= 0; i--) {
      const e = entitiesRef.current[i];
      if (!e) continue; // Check for undefined entity

      // Safety Ring Logic
      if (e.isSafety && e.active) {
          if (currentOrbit >= 2) {
              const intensity = Math.min(50, 15 + (currentOrbit - 2) * 5);
              const wobble = Math.sin(now * 0.002 + (e.wobblePhase || 0)) * intensity;
              e.dist = (e.baseDist || e.dist) + wobble;
          } else {
              if (e.baseDist) e.dist = e.baseDist;
          }
      }

      if (!e.active) continue;
      
      if (e.scale < e.maxScale) e.scale += 0.125; // Appear faster (0.1 -> 0.125)
      
      e.angle += e.moveSpeed;
      if (e.type === 'enemy') e.rotation += 0.06; // Rotate faster (0.05 -> 0.06)

      // 磁铁逻辑
      let magnetSucked = false;
      if (e.type === 'score' && hasMagnet) {
        const ex = Math.cos(e.angle) * e.dist;
        const ey = Math.sin(e.angle) * e.dist;
        const dx = player.x - ex;
        const dy = player.y - ey;
        const distSq = dx * dx + dy * dy;

        if (distSq < 100000) {
            const pullFactor = e.isSafety ? 0.05 : 0.2;
            e.dist += (player.radius - e.dist) * pullFactor;
            let diffAngle = player.angle - e.angle;
            while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
            while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
            e.angle += diffAngle * (e.isSafety ? 0.05 : 0.15);
            if (distSq < 3000) magnetSucked = true;
        }
      }

      // 碰撞检测
      const ex = Math.cos(e.angle) * e.dist;
      const ey = Math.sin(e.angle) * e.dist;
      const dx = player.x - ex;
      const dy = player.y - ey;
      const distSq = dx*dx + dy*dy;
      const radiusSum = player.size + e.size * e.scale;
      const isDirectHit = distSq < radiusSum * radiusSum;

      if (isDirectHit || magnetSucked) {
        if (e.type === 'score') {
          scoreRef.current += 1;
          createExplosion(ex, ey, 'white', 8, 8);
          spawnFloatingText(ex, ey, "+1", "#ffffff"); // Floating Text for score
          
          // 4. 磁铁吸取计数逻辑
          if (hasMagnet) {
              player.magnetCount = (player.magnetCount || 0) + 1;
              // 如果吸取达到15个，立刻移除磁铁状态
              if (player.magnetCount >= 15) {
                  player.magnetTime = 0;
                  setBuffs(prev => ({ ...prev, magnet: 0 })); // Update UI immediately
              }
          }

          if (isDirectHit) {
              if (player.radius > MAX_ALTITUDE) {
                  player.rVelocity = Math.max(player.rVelocity, 2); 
              } else {
                  // 【修正】恢复为原版弹射力度，保持手感
                  const baseBoost = 15.0; 
                  const distanceBoost = player.radius / 300; 
                  const totalBoost = baseBoost + distanceBoost;
                  player.rVelocity = Math.max(player.rVelocity + totalBoost, totalBoost);
              }
          }
          
          if (e.isSafety) {
              e.active = false;
          } else {
              entitiesRef.current.splice(i, 1);
          }
          
        } else if (e.type === 'shield') {
          player.shieldTime = 400;
          createExplosion(ex, ey, COLORS.shield, 15);
          entitiesRef.current.splice(i, 1);
        } else if (e.type === 'magnet') {
          player.magnetTime = 600;
          player.magnetCount = 0; // 重置吸取计数
          createExplosion(ex, ey, COLORS.magnet, 15);
          entitiesRef.current.splice(i, 1);
        } else if (e.type === 'dash') {
          player.dashTime = 150; 
          createExplosion(ex, ey, COLORS.dash, 20);
          createShockwave(ex, ey, COLORS.dash);
          entitiesRef.current.splice(i, 1);
        } else if (e.type === 'nuke') {
          createExplosion(ex, ey, COLORS.nuke, 20);
          createShockwave(ex, ey, COLORS.nuke);
          shake.current = 20;
          
          const killRadiusSq = 500 * 500;
          for (let j = entitiesRef.current.length - 1; j >= 0; j--) {
              const target = entitiesRef.current[j];
              if (!target) continue; // Safety check inside nested loop
              if (target.id === e.id) continue;
              if (target.type === 'enemy') {
                  const tx = Math.cos(target.angle) * target.dist;
                  const ty = Math.sin(target.angle) * target.dist;
                  const tdx = ex - tx;
                  const tdy = ey - ty;
                  if ((tdx*tdx + tdy*tdy) < killRadiusSq) {
                      createExplosion(tx, ty, COLORS.enemy, 15);
                      createShockwave(tx, ty, COLORS.enemy); // Shockwave for nuke kill
                      spawnFloatingText(tx, ty, "+3", COLORS.enemy, 32); // Text for nuke kill
                      entitiesRef.current.splice(j, 1);
                      scoreRef.current += 3; // Nuke 摧毁红刺 +3分
                      if (j < i) i--;
                  }
              }
          }
          entitiesRef.current.splice(i, 1);

        } else if (e.type === 'enemy') {
          if (isDirectHit) {
              if (hasShield || hasDash) {
                createExplosion(ex, ey, COLORS.enemy, 20);
                createShockwave(ex, ey, hasDash ? COLORS.dash : COLORS.shield);
                // Also add red shockwave for enemy death
                createShockwave(ex, ey, COLORS.enemy); 
                spawnFloatingText(ex, ey, "+3", COLORS.enemy, 32); // Text for dash/shield kill

                shake.current = 10;
                entitiesRef.current.splice(i, 1);
                scoreRef.current += 3; // 冲刺/护盾撞毁红刺 +3分
              } else {
                createExplosion(player.x, player.y, COLORS.player, 30);
                shake.current = 25;
                handleGameOver();
              }
          }
        }
      }
    }

    // 粒子
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.038; // Faster fade (0.03 -> 0.038)
      if (p.life <= 0) particlesRef.current.splice(i, 1);
    }
    
    // 冲击波
    for (let i = shockwavesRef.current.length - 1; i >= 0; i--) {
        const sw = shockwavesRef.current[i];
        sw.radius += 15; // Faster expansion (12 -> 15)
        sw.life -= 0.038; // Faster fade (0.03 -> 0.038)
        if(sw.life <= 0) shockwavesRef.current.splice(i, 1);
    }

    // 浮动文字
    for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
        const ft = floatingTextsRef.current[i];
        ft.y += ft.vy;
        ft.life -= 0.025; // Faster fade (0.02 -> 0.025)
        if (ft.life <= 0) floatingTextsRef.current.splice(i, 1);
    }

    if (shake.current > 0) shake.current *= 0.9;
    
    if (scoreRef.current !== scoreDisplay) setScoreDisplay(scoreRef.current);
    
    // Update buffs state with remaining time
    setBuffs({ 
        shield: player.shieldTime, 
        magnet: player.magnetTime, 
        dash: player.dashTime 
    });
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height, cx, cy } = dimensions.current;
    const player = playerRef.current;
    const cam = cameraRef.current;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    ctx.save();

    // 摄像机
    ctx.translate(cx, cy);
    if (shake.current > 0) {
      ctx.translate((Math.random() - 0.5) * shake.current, (Math.random() - 0.5) * shake.current);
    }
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    // 绘制星星
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    starsRef.current.forEach(star => {
        const parallaxX = (star.x - cam.x * 0.2 * cam.zoom) % width;
        const parallaxY = (star.y - cam.y * 0.2 * cam.zoom) % height;
        const finalX = parallaxX < 0 ? parallaxX + width : parallaxX;
        const finalY = parallaxY < 0 ? parallaxY + height : parallaxY;
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.beginPath();
        ctx.arc(finalX, finalY, star.size * (0.5 + cam.zoom * 0.5), 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();

    // 轨道网格
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1 / cam.zoom;
    ctx.beginPath();
    const viewWorldRadius = Math.max(width, height) / cam.zoom;
    const minRenderRadius = Math.max(100, player.radius - viewWorldRadius);
    const maxRenderRadius = player.radius + viewWorldRadius;
    const startGrid = Math.floor(minRenderRadius / 200) * 200;
    for(let r = startGrid; r < maxRenderRadius; r += 200) {
        ctx.moveTo(r + r, 0); 
        ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    ctx.stroke();

    // 中心枢纽绘制
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    
    // 如果处于警告状态，中心变红并闪烁
    if (player.centerTime > CENTER_SAFE_LIMIT) {
        const flash = Math.floor(Date.now() / 100) % 2 === 0;
        ctx.fillStyle = flash ? '#ff0000' : '#500000';
        ctx.strokeStyle = '#ff3333';
    } else {
        ctx.fillStyle = '#333';
        ctx.strokeStyle = '#444';
    }
    ctx.fill();
    ctx.lineWidth = 2 / cam.zoom;
    ctx.stroke();

    const pulse = Math.sin(Date.now() / 200) * 2;
    ctx.beginPath();
    ctx.arc(0, 0, 30 + pulse, 0, Math.PI * 2);
    ctx.strokeStyle = player.centerTime > CENTER_SAFE_LIMIT ? `rgba(255, 0, 0, 0.5)` : `rgba(0, 210, 255, 0.3)`;
    ctx.stroke();
    
    // 安全区边界线 (Start Line) - 0度线指示
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(PLAYER_CONFIG.baseRadius + 50, 0); // 简单的0度指示线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2 / cam.zoom;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_CONFIG.baseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = player.centerTime > CENTER_SAFE_LIMIT ? 'rgba(255, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)';
    ctx.setLineDash([10, 10]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 绘制中心警告倒计时环
    if (player.centerTime > CENTER_SAFE_LIMIT) {
        const progress = (player.centerTime - CENTER_SAFE_LIMIT) / (CENTER_DEATH_LIMIT - CENTER_SAFE_LIMIT);
        ctx.beginPath();
        ctx.arc(0, 0, 45, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * progress));
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 4 / cam.zoom;
        ctx.stroke();
    }

    if (gameStateRef.current !== 'PLAYING' && gameStateRef.current !== 'GAMEOVER') {
      ctx.restore();
      return;
    }

    // 冲击波
    shockwavesRef.current.forEach(sw => {
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = (4 * sw.life) / cam.zoom;
        ctx.globalAlpha = sw.life;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    });

    // 实体
    entitiesRef.current.forEach(e => {
        if (!e || !e.active) return; // Checked e

        const x = Math.cos(e.angle) * e.dist;
        const y = Math.sin(e.angle) * e.dist;
        const s = e.size * e.scale;
        const screenX = (x - cam.x) * cam.zoom;
        const screenY = (y - cam.y) * cam.zoom;
        if (Math.abs(screenX) > width/2 + 100 || Math.abs(screenY) > height/2 + 100) return;

        ctx.save();
        ctx.translate(x, y);
        if (e.type === 'enemy') {
            ctx.rotate(e.rotation);
            ctx.fillStyle = e.color;
            ctx.shadowColor = e.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            for(let i=0; i<8; i++) {
                let rot = Math.PI / 4 * i;
                ctx.lineTo(Math.cos(rot)*s, Math.sin(rot)*s);
                ctx.lineTo(Math.cos(rot + Math.PI/8)*(s*0.5), Math.sin(rot + Math.PI/8)*(s*0.5));
            }
            ctx.closePath();
            ctx.fill();
        } else {
            // Unified prop drawing style (including Dash)
            ctx.fillStyle = e.color;
            ctx.shadowColor = e.color;
            ctx.shadowBlur = e.type === 'score' ? 5 : 15;
            ctx.beginPath();
            ctx.arc(0, 0, s, 0, Math.PI * 2);
            ctx.fill();
            if (e.type !== 'score') {
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    });

    // 粒子
    particlesRef.current.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });

    // 浮动文字绘制
    ctx.save();
    floatingTextsRef.current.forEach(ft => {
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.fillStyle = ft.color;
        ctx.font = `bold ${ft.size}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Draw text stroke for readability
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 3;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillText(ft.text, ft.x, ft.y);
    });
    ctx.restore();

    // 玩家
    if (gameStateRef.current !== 'GAMEOVER') {
        const px = player.x;
        const py = player.y;

        // 连线
        if (player.radius < 3000) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(px, py);
            ctx.strokeStyle = `rgba(0, 210, 255, ${Math.max(0, (0.2 - player.radius / 3000))})`;
            ctx.lineWidth = 2 / cam.zoom;
            ctx.stroke();
        }

        // 拖尾
        if (player.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(player.trail[0].x, player.trail[0].y);
            for (let i = 1; i < player.trail.length; i++) {
                ctx.lineTo(player.trail[i].x, player.trail[i].y);
            }
            ctx.strokeStyle = player.dashTime > 0 ? COLORS.dash : player.color;
            ctx.lineWidth = player.size * (player.dashTime > 0 ? 1.5 : 0.8);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = player.dashTime > 0 ? 0.8 : 0.4;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }

        // 玩家本体
        ctx.beginPath();
        ctx.arc(px, py, player.size, 0, Math.PI * 2);
        ctx.fillStyle = player.dashTime > 0 ? '#fff' : player.color;
        ctx.shadowColor = player.dashTime > 0 ? COLORS.dash : player.color;
        ctx.shadowBlur = player.dashTime > 0 ? 25 : 15;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Buff 视觉
        if (player.shieldTime > 0) {
            ctx.beginPath();
            ctx.arc(px, py, player.size + 8, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 255, 0, ${0.4 + Math.sin(Date.now() / 100) * 0.4})`;
            ctx.lineWidth = 3 / cam.zoom;
            ctx.stroke();
        }
        if (player.magnetTime > 0) {
            // 显示吸取计数进度 (可选)
            ctx.beginPath();
            ctx.arc(px, py, player.size + 16, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(191, 0, 255, 0.2)`;
            ctx.lineWidth = 2 / cam.zoom;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        if (player.dashTime > 0) {
            // 冲刺特效环
             ctx.beginPath();
            ctx.arc(px, py, player.size + 12, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(249, 115, 22, ${0.6 + Math.sin(Date.now() / 50) * 0.4})`;
            ctx.lineWidth = 4 / cam.zoom;
            ctx.stroke();
        }
    }

    ctx.restore();
  };

  const loop = useCallback(() => {
    update();
    draw();
    frameId.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        canvasRef.current.width = clientWidth;
        canvasRef.current.height = clientHeight;
        dimensions.current = {
            width: clientWidth,
            height: clientHeight,
            cx: clientWidth / 2,
            cy: clientHeight / 2
        };
        initStars(clientWidth, clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    frameId.current = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId.current);
    };
  }, [loop]);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => { e.preventDefault(); isPressing.current = true; };
    const handleTouchEnd = (e: TouchEvent) => { isPressing.current = false; };
    
    const canvas = canvasRef.current;
    if(canvas) {
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd);
        canvas.addEventListener('mousedown', () => isPressing.current = true);
        window.addEventListener('mouseup', () => isPressing.current = false);
    }
    return () => {
        if(canvas) {
            canvas.removeEventListener('touchstart', handleTouchStart);
            canvas.removeEventListener('touchend', handleTouchEnd);
        }
        window.removeEventListener('mouseup', () => isPressing.current = false);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full font-sans select-none">
        {/* Buff HUD */}
        <div className="absolute top-4 left-4 flex flex-col gap-3 pointer-events-none z-20">
            <div className={`flex items-center gap-2 transition-all duration-300 ${buffs.shield > 0 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500 shadow-[0_0_10px_#00ff00]">
                    <Shield size={16} className="text-green-400" />
                </div>
                <span className="text-green-400 font-bold tracking-wider text-sm shadow-black drop-shadow-md">
                    护盾 {Math.ceil(buffs.shield / 60)}s
                </span>
            </div>
            <div className={`flex items-center gap-2 transition-all duration-300 ${buffs.magnet > 0 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500 shadow-[0_0_10px_#bf00ff]">
                    <Zap size={16} className="text-purple-400" />
                </div>
                <div className="flex flex-col">
                    <span className="text-purple-400 font-bold tracking-wider text-sm shadow-black drop-shadow-md">
                        磁吸 {Math.ceil(buffs.magnet / 60)}s
                    </span>
                    {/* 显示剩余吸取次数 */}
                    {playerRef.current.magnetTime > 0 && (
                         <span className="text-purple-300 text-[10px] leading-none opacity-80">
                            剩余吸取: {Math.max(0, 15 - playerRef.current.magnetCount)}
                        </span>
                    )}
                </div>
            </div>
             <div className={`flex items-center gap-2 transition-all duration-300 ${buffs.dash > 0 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center border border-orange-500 shadow-[0_0_10px_#f97316]">
                    <Flame size={16} className="text-orange-400" />
                </div>
                <span className="text-orange-400 font-bold tracking-wider text-sm shadow-black drop-shadow-md">
                    冲刺 {Math.ceil(buffs.dash / 60)}s
                </span>
            </div>
        </div>

        {/* Orbit Counter HUD */}
        {uiGameState === 'PLAYING' && (
             <div className="absolute top-4 right-4 flex items-center gap-2 pointer-events-none z-20">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500 shadow-[0_0_10px_#00d2ff]">
                    <RotateCw size={16} className="text-blue-400" />
                </div>
                <span className="text-blue-400 font-bold tracking-wider text-sm shadow-black drop-shadow-md">第 {orbitCountDisplay} 圈</span>
            </div>
        )}

        {/* Center Danger Warning */}
        {centerWarning && uiGameState === 'PLAYING' && (
             <div className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-none z-20 animate-pulse">
                <div className="flex items-center gap-2 text-red-500 bg-black/50 px-4 py-2 rounded-full border border-red-500/50">
                    <AlertTriangle size={20} />
                    <span className="font-bold tracking-widest text-sm uppercase">核心过载警报</span>
                </div>
            </div>
        )}

        {/* Score HUD */}
        {uiGameState === 'PLAYING' && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 pointer-events-none z-10 flex flex-col items-center">
                <span className="text-6xl font-black text-white/20 tracking-tighter" style={{ textShadow: '0 0 20px rgba(255,255,255,0.2)'}}>
                    {scoreDisplay}
                </span>
            </div>
        )}

        {/* Start Screen */}
        {uiGameState === 'START' && (
            <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/60 backdrop-blur-sm">
                <div className="text-center p-8 border border-white/10 rounded-2xl bg-black/40 shadow-2xl max-w-sm mx-4 transform transition-all animate-in fade-in zoom-in duration-300">
                    <h1 className="text-4xl font-black mb-1 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                        跃迁轨道
                    </h1>
                    <span className="text-xs text-slate-500 font-mono mb-8 block">{GAME_VERSION}</span>
                    
                    <div className="space-y-4 mb-8 text-sm text-slate-300">
                        <p><span className="text-cyan-400 font-bold">按住屏幕</span> 仅调整角度</p>
                        <p><span className="text-white font-bold">撞击光点</span> 获得动力弹射</p>
                        <p><span className="text-orange-400 font-bold">橙色道具</span> 可冲刺并撞毁敌人</p>
                        <p className="mt-2 text-xs text-yellow-500 border-t border-white/10 pt-2">
                             每完成一圈，内圈光点将重生
                        </p>
                    </div>

                    <button 
                        onClick={startGame}
                        className="group relative px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(8,145,178,0.5)] flex items-center gap-2 mx-auto"
                    >
                        <Play size={20} className="fill-current" />
                        开始游戏
                    </button>
                </div>
            </div>
        )}

        {/* Game Over Screen */}
        {uiGameState === 'GAMEOVER' && (
            <div className="absolute inset-0 flex items-center justify-center z-30 bg-red-900/20 backdrop-blur-sm">
                <div className="text-center p-8 border border-red-500/30 rounded-2xl bg-black/80 shadow-2xl max-w-sm mx-4 transform transition-all animate-in fade-in zoom-in duration-300">
                    <div className="inline-block p-3 rounded-full bg-red-500/20 mb-4 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                        <Skull size={32} className="text-red-500" />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-2">游戏结束</h2>
                    
                    <div className="grid grid-cols-2 gap-4 my-6">
                        <div className="bg-white/5 p-3 rounded-lg border border-white/10 col-span-2">
                            <div className="text-xs text-slate-400 uppercase mb-1">本次得分</div>
                            <div className="text-4xl font-mono font-bold text-white">{scoreDisplay}</div>
                        </div>
                        <div className="bg-white/5 p-3 rounded-lg border border-white/10 flex flex-col items-center">
                            <div className="text-xs text-slate-400 uppercase mb-1 flex items-center gap-1">
                                <Clock size={12} className="text-slate-400" /> 存活时间
                            </div>
                            <div className="text-lg font-mono font-bold text-slate-200">{formatTime(gameStats.duration)}</div>
                        </div>
                        <div className="bg-white/5 p-3 rounded-lg border border-white/10 flex flex-col items-center">
                            <div className="text-xs text-slate-400 uppercase mb-1 flex items-center gap-1">
                                <Hash size={12} className="text-slate-400" /> 完成圈数
                            </div>
                            <div className="text-lg font-mono font-bold text-slate-200">{gameStats.finalOrbit}</div>
                        </div>
                         <div className="bg-white/5 p-3 rounded-lg border border-white/10 col-span-2 flex items-center justify-center gap-2">
                            <Trophy size={14} className="text-yellow-500" /> 
                            <span className="text-xs text-slate-400 uppercase">历史最高</span>
                            <span className="font-mono font-bold text-yellow-500">{highScore}</span>
                        </div>
                    </div>

                    <button 
                        onClick={startGame}
                        className="w-full py-3 bg-white hover:bg-slate-200 text-black font-bold rounded-full transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={18} />
                        重试
                    </button>
                </div>
            </div>
        )}

        <canvas 
            ref={canvasRef} 
            className="block w-full h-full cursor-crosshair active:cursor-grabbing"
        />
    </div>
  );
};