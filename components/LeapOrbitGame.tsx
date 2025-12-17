import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Player, Entity, Particle, Shockwave, EntityType, FloatingText } from '../types';
import { Shield, Zap, Skull, Trophy, Play, RefreshCw, AlertTriangle, RotateCw, Flame, Clock, Hash, Target } from 'lucide-react';

const GAME_VERSION = "v7.0.1-FinalPolish";

// --- Game Constants ---
const PLAYER_CONFIG = {
  baseRadius: 100,
  accelOut: 0,    
  gravity: 0.125, 
  drag: 0.94,     
  rotSpeed: 0.01, 
  dashRotSpeed: 0.03, 
  size: 14,
  trailLength: 25,
};

const MAX_ALTITUDE = 1500; 

const COLORS = {
  player: '#00d2ff',
  enemy: '#ff3333',
  score: '#ffffff',
  shield: '#00ff00',   
  magnet: '#bf00ff',   
  nuke: '#facc15',     
  dash: '#f97316',     
  background: '#111111',
  grid: '#333333'
};

const CENTER_SAFE_LIMIT = 300; 
const CENTER_DEATH_LIMIT = 480; 

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
  const [buffs, setBuffs] = useState({ shield: 0, magnet: 0, dash: 0 });
  const [centerWarning, setCenterWarning] = useState(false);
  const [orbitCountDisplay, setOrbitCountDisplay] = useState(1);
  const [gameStats, setGameStats] = useState({ 
    duration: 0, 
    formattedDuration: '0分0秒',
    finalOrbit: 1,
    actionScore: 0,
    timeScore: 0,
    orbitBonus: 0,
    multiplier: 1.0
  });

  // --- Mutable Game State ---
  const gameStateRef = useRef<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const actionScoreRef = useRef(0); 
  const orbitRef = useRef(1);      
  const gameStartTimeRef = useRef(0);
  const isFillingInnerZoneRef = useRef(true); 
  
  const frameId = useRef<number>(0);
  const isPressing = useRef<boolean>(false);
  const shake = useRef<number>(0);
  const dimensions = useRef({ width: 0, height: 0, cx: 0, cy: 0 });

  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });

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
    dashTime: 0, 
    centerTime: 0
  });

  const entitiesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]); 
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

  const calculateCurrentTotalScore = () => {
    const survivalSeconds = (Date.now() - gameStartTimeRef.current) / 1000;
    const timeScore = Math.floor(survivalSeconds * 5);
    const orbitBonus = (orbitRef.current - 1) * 100;
    const multiplier = 1 + (orbitRef.current - 1) * 0.1;
    return Math.floor((actionScoreRef.current + timeScore + orbitBonus) * multiplier);
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

  const createExplosion = (x: number, y: number, color: string, count = 12, speed = 15) => {
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
          vy: -1.9, 
          size
      });
  };

  const spawnSafetyRing = (orbitNum: number) => {
      entitiesRef.current = entitiesRef.current.filter(e => e && !e.isSafety);
      let count = 40;
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
              moveSpeed: 0.0019, 
              size: 14,
              color: COLORS.score,
              isSafety: true, 
              wobblePhase: Math.random() * Math.PI * 2
          });
      }
  };

  const spawnInnerAmbience = () => {
    if (entitiesRef.current.length > 350) return;
    const SAFE_ZONE_RADIUS = PLAYER_CONFIG.baseRadius + 300;
    const currentInnerCount = entitiesRef.current.filter(e => 
        e && e.type === 'score' && e.dist <= SAFE_ZONE_RADIUS && e.active
    ).length;
    const UPPER_LIMIT = 50; 
    const LOWER_LIMIT = 20; 
    if (isFillingInnerZoneRef.current) {
        if (currentInnerCount >= UPPER_LIMIT) isFillingInnerZoneRef.current = false;
    } else {
        if (currentInnerCount <= LOWER_LIMIT) isFillingInnerZoneRef.current = true;
    }
    if (!isFillingInnerZoneRef.current) return;
    if (Math.random() > 0.15) return;
    const dist = randomRange(PLAYER_CONFIG.baseRadius + 50, SAFE_ZONE_RADIUS);
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
        moveSpeed: randomRange(0.0012, 0.0025) * (Math.random() > 0.5 ? 1 : -1),
        size: type === 'score' ? 12 : 16,
        color: COLORS[type],
        isSafety: false
    };
    entitiesRef.current.push(entity);
  };

  const spawnEntity = () => {
    const maxEntities = 350; 
    if (entitiesRef.current.length > maxEntities) return;
    const currentOrbit = orbitRef.current;
    const spawnChance = Math.min(0.1, 0.0375 + (currentOrbit * 0.0025)); 
    if (Math.random() > spawnChance) return;

    const playerRadius = playerRef.current.radius;
    let type: EntityType = 'score';
    if (currentOrbit >= 3) {
        if (Math.random() < 0.3) {
            type = 'enemy';
        } else {
            if (Math.random() < 0.25) {
                const rProp = Math.random();
                if (rProp < 0.1) type = 'magnet';      
                else if (rProp < 0.3) type = 'dash';   
                else if (rProp < 0.6) type = 'shield'; 
                else type = 'nuke';                    
            } else {
                type = 'score';
            }
        }
    } else {
        const difficultyFactor = actionScoreRef.current / 5000;
        const enemyChance = Math.min(0.01 + difficultyFactor, 0.1);
        if (Math.random() < enemyChance) {
            type = 'enemy';
        } else {
            if (Math.random() < 0.15) { 
                const rProp = Math.random();
                if (rProp < 0.1) type = 'nuke';        
                else if (rProp < 0.3) type = 'dash';   
                else if (rProp < 0.5) type = 'magnet'; 
                else type = 'shield';                  
            } else {
                type = 'score';
            }
        }
    }

    const baseSpawn = Math.max(PLAYER_CONFIG.baseRadius + 50, playerRadius - 500);
    const ceilingSpawn = Math.min(playerRadius + 600, MAX_ALTITUDE - 200);
    if (baseSpawn > MAX_ALTITUDE) return;
    const spawnDist = randomRange(baseSpawn, ceilingSpawn);
    
    // 【强化禁区】磁铁不能生成在中心附近，防止吸走保命圈
    if (type === 'magnet' && spawnDist < PLAYER_CONFIG.baseRadius + 500) type = 'score';
    
    const ENEMY_SAFE_DIST = PLAYER_CONFIG.baseRadius + 300;
    if (type === 'enemy' && spawnDist < ENEMY_SAFE_DIST) type = 'score';

    const spawnAngle = randomRange(0, Math.PI * 2);
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
      magnetCount: 0, 
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
    actionScoreRef.current = 0;
    
    orbitRef.current = 1; 
    gameStartTimeRef.current = Date.now();
    isFillingInnerZoneRef.current = true; 
    
    cameraRef.current = { x: 0, y: 0, zoom: 1 };

    setScoreDisplay(0);
    setOrbitCountDisplay(1);
    setBuffs({ shield: 0, magnet: 0, dash: 0 });
    setCenterWarning(false);
    isPressing.current = false;
    spawnSafetyRing(1);
  };

  const startGame = () => {
    initGame();
    gameStateRef.current = 'PLAYING';
    setUiGameState('PLAYING');
  };

  const handleGameOver = () => {
    gameStateRef.current = 'GAMEOVER';
    const finalTime = Date.now() - gameStartTimeRef.current;
    const finalTotalScore = calculateCurrentTotalScore();
    
    entitiesRef.current.forEach(e => {
        if (e && e.active) {
            const ex = Math.cos(e.angle) * e.dist;
            const ey = Math.sin(e.angle) * e.dist;
            createShockwave(ex, ey, e.color);
            createExplosion(ex, ey, e.color, 5, 8); 
        }
    });
    entitiesRef.current = [];

    setGameStats({
        duration: finalTime,
        formattedDuration: formatTime(finalTime),
        finalOrbit: orbitRef.current,
        actionScore: actionScoreRef.current,
        timeScore: Math.floor((finalTime / 1000) * 5),
        orbitBonus: (orbitRef.current - 1) * 100,
        multiplier: 1 + (orbitRef.current - 1) * 0.1
    });
    setHighScore(prev => Math.max(prev, finalTotalScore));
    setUiGameState('GAMEOVER');
  };

  const update = () => {
    if (gameStateRef.current !== 'PLAYING') return;
    const player = playerRef.current;
    
    if (player.shieldTime > 0) player.shieldTime--;
    if (player.magnetTime > 0) player.magnetTime--;
    if (player.dashTime > 0) player.dashTime--;
    const hasShield = player.shieldTime > 0;
    const hasMagnet = player.magnetTime > 0;
    const hasDash = player.dashTime > 0;

    if (hasDash) {
        player.angle += PLAYER_CONFIG.dashRotSpeed;
        player.rVelocity *= 0.5; 
    } else {
        if (isPressing.current) player.angle += player.rotSpeed; 
        player.rVelocity -= player.gravity; 
    }
    player.rVelocity *= player.drag; 
    player.radius += player.rVelocity;

    const currentOrbitNum = Math.floor(player.angle / (Math.PI * 2)) + 1; 
    if (currentOrbitNum > orbitRef.current) {
        orbitRef.current = currentOrbitNum;
        setOrbitCountDisplay(currentOrbitNum);
        shake.current = 5;
        createShockwave(0, 0, '#00d2ff');
        spawnSafetyRing(currentOrbitNum);
    }

    if (player.radius < player.baseRadius) {
      player.radius = player.baseRadius;
      if (player.rVelocity < -1) {
        player.rVelocity = -player.rVelocity * 0.4; 
        shake.current = Math.min(Math.abs(player.rVelocity) * 2, 5);
      } else {
        player.rVelocity = 0;
      }
    }

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
    if (player.trail.length > PLAYER_CONFIG.trailLength) player.trail.shift();

    const { width, height } = dimensions.current;
    const targetZoom = Math.max(0.35, Math.min(1.0, Math.min(width, height) / ((player.radius * 2) + (hasDash ? 350 : 200))));
    cameraRef.current.x += (player.x * 0.5 - cameraRef.current.x) * 0.08;
    cameraRef.current.y += (player.y * 0.5 - cameraRef.current.y) * 0.08;
    cameraRef.current.zoom += (targetZoom - cameraRef.current.zoom) * 0.05;

    spawnEntity();
    spawnInnerAmbience();

    const now = Date.now();
    for (let i = entitiesRef.current.length - 1; i >= 0; i--) {
      const e = entitiesRef.current[i];
      if (!e || !e.active) continue;
      if (e.isSafety) {
          if (orbitRef.current >= 2) {
              e.dist = (e.baseDist || e.dist) + Math.sin(now * 0.002 + (e.wobblePhase || 0)) * Math.min(50, 15 + (orbitRef.current - 2) * 5);
          }
      }
      if (e.scale < e.maxScale) e.scale += 0.125; 
      e.angle += e.moveSpeed;
      if (e.type === 'enemy') e.rotation += 0.06;

      let magnetSucked = false;
      if (e.type === 'score' && hasMagnet) {
        const dx = player.x - Math.cos(e.angle) * e.dist;
        const dy = player.y - Math.sin(e.angle) * e.dist;
        if ((dx * dx + dy * dy) < 100000) {
            e.dist += (player.radius - e.dist) * (e.isSafety ? 0.05 : 0.2);
            let diffAngle = player.angle - e.angle;
            while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
            while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
            e.angle += diffAngle * (e.isSafety ? 0.05 : 0.15);
            if ((dx * dx + dy * dy) < 3000) magnetSucked = true;
        }
      }

      const ex = Math.cos(e.angle) * e.dist;
      const ey = Math.sin(e.angle) * e.dist;
      const distSq = (player.x - ex)**2 + (player.y - ey)**2;
      const isDirectHit = distSq < (player.size + e.size * e.scale)**2;

      if (isDirectHit || magnetSucked) {
        if (e.type === 'score') {
          actionScoreRef.current += 10; 
          createExplosion(ex, ey, 'white', 8, 8);
          spawnFloatingText(ex, ey, "+10", "#ffffff"); 
          if (hasMagnet) {
              player.magnetCount = (player.magnetCount || 0) + 1;
              if (player.magnetCount >= 15) {
                  player.magnetTime = 0;
                  setBuffs(prev => ({ ...prev, magnet: 0 }));
              }
          }
          if (isDirectHit) {
              const boost = 15.0 + player.radius / 300;
              player.rVelocity = Math.max(player.rVelocity + boost, boost);
          }
          if (e.isSafety) e.active = false;
          else entitiesRef.current.splice(i, 1);
        } else if (e.type === 'shield') {
          player.shieldTime = 400; createExplosion(ex, ey, COLORS.shield, 15); entitiesRef.current.splice(i, 1);
        } else if (e.type === 'magnet') {
          player.magnetTime = 600; player.magnetCount = 0; createExplosion(ex, ey, COLORS.magnet, 15); entitiesRef.current.splice(i, 1);
        } else if (e.type === 'dash') {
          player.dashTime = 150; createExplosion(ex, ey, COLORS.dash, 20); createShockwave(ex, ey, COLORS.dash); entitiesRef.current.splice(i, 1);
        } else if (e.type === 'nuke') {
          createExplosion(ex, ey, COLORS.nuke, 20); createShockwave(ex, ey, COLORS.nuke); shake.current = 20;
          for (let j = entitiesRef.current.length - 1; j >= 0; j--) {
              const t = entitiesRef.current[j];
              if (t && t.type === 'enemy') {
                  const tx = Math.cos(t.angle) * t.dist; const ty = Math.sin(t.angle) * t.dist;
                  if (((ex - tx)**2 + (ey - ty)**2) < 500**2) {
                      createExplosion(tx, ty, COLORS.enemy, 15); createShockwave(tx, ty, COLORS.enemy);
                      spawnFloatingText(tx, ty, "+50", COLORS.enemy, 32);
                      entitiesRef.current.splice(j, 1);
                      actionScoreRef.current += 50; 
                      if (j < i) i--;
                  }
              }
          }
          entitiesRef.current.splice(i, 1);
        } else if (e.type === 'enemy' && isDirectHit) {
            if (hasShield || hasDash) {
                createExplosion(ex, ey, COLORS.enemy, 20); createShockwave(ex, ey, COLORS.enemy);
                spawnFloatingText(ex, ey, "+50", COLORS.enemy, 32);
                shake.current = 10; entitiesRef.current.splice(i, 1);
                actionScoreRef.current += 50; 
            } else {
                createExplosion(player.x, player.y, COLORS.player, 30); handleGameOver();
            }
        }
      }
    }

    particlesRef.current.forEach((p, i) => { p.x += p.vx; p.y += p.vy; p.life -= 0.038; if (p.life <= 0) particlesRef.current.splice(i, 1); });
    shockwavesRef.current.forEach((sw, i) => { sw.radius += 15; sw.life -= 0.038; if (sw.life <= 0) shockwavesRef.current.splice(i, 1); });
    floatingTextsRef.current.forEach((ft, i) => { ft.y += ft.vy; ft.life -= 0.025; if (ft.life <= 0) floatingTextsRef.current.splice(i, 1); });
    if (shake.current > 0) shake.current *= 0.9;
    
    const total = calculateCurrentTotalScore();
    if (total !== scoreDisplay) setScoreDisplay(total);
    setBuffs({ shield: player.shieldTime, magnet: player.magnetTime, dash: player.dashTime });
  };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { width, height, cx, cy } = dimensions.current;
    const player = playerRef.current; const cam = cameraRef.current;

    ctx.fillStyle = COLORS.background; ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(cx, cy);
    if (shake.current > 0) ctx.translate((Math.random() - 0.5) * shake.current, (Math.random() - 0.5) * shake.current);
    ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.x, -cam.y);

    // 星星
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); 
    starsRef.current.forEach(star => {
        let px = (star.x - cam.x * 0.2 * cam.zoom) % width; let py = (star.y - cam.y * 0.2 * cam.zoom) % height;
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`; ctx.beginPath(); ctx.arc(px < 0 ? px + width : px, py < 0 ? py + height : py, star.size * (0.5 + cam.zoom * 0.5), 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();

    // 网格
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1 / cam.zoom; ctx.beginPath();
    const viewR = Math.max(width, height) / cam.zoom;
    for(let r = Math.floor(Math.max(100, player.radius - viewR) / 200) * 200; r < player.radius + viewR; r += 200) {
        ctx.moveTo(r, 0); ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    ctx.stroke();

    // 中心
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fillStyle = player.centerTime > CENTER_SAFE_LIMIT ? (Math.floor(Date.now() / 100) % 2 === 0 ? '#ff0000' : '#500000') : '#333';
    ctx.fill(); ctx.stroke();
    if (player.centerTime > CENTER_SAFE_LIMIT) {
        ctx.beginPath(); ctx.arc(0, 0, 45, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * (player.centerTime - CENTER_SAFE_LIMIT) / (CENTER_DEATH_LIMIT - CENTER_SAFE_LIMIT)));
        ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 4 / cam.zoom; ctx.stroke();
    }

    if (gameStateRef.current !== 'PLAYING' && gameStateRef.current !== 'GAMEOVER') { ctx.restore(); return; }

    shockwavesRef.current.forEach(sw => { ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2); ctx.strokeStyle = sw.color; ctx.lineWidth = (4 * sw.life) / cam.zoom; ctx.globalAlpha = sw.life; ctx.stroke(); ctx.globalAlpha = 1.0; });
    entitiesRef.current.forEach(e => {
        if (!e || !e.active) return;
        const x = Math.cos(e.angle) * e.dist; const y = Math.sin(e.angle) * e.dist;
        if (Math.abs((x - cam.x) * cam.zoom) > width/2 + 100 || Math.abs((y - cam.y) * cam.zoom) > height/2 + 100) return;
        ctx.save(); ctx.translate(x, y);
        if (e.type === 'enemy') {
            ctx.rotate(e.rotation); ctx.fillStyle = e.color; ctx.beginPath();
            for(let i=0; i<8; i++) { let rot = Math.PI/4*i; ctx.lineTo(Math.cos(rot)*e.size*e.scale, Math.sin(rot)*e.size*e.scale); ctx.lineTo(Math.cos(rot+Math.PI/8)*e.size*e.scale*0.5, Math.sin(rot+Math.PI/8)*e.size*e.scale*0.5); }
            ctx.fill();
        } else {
            ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(0, 0, e.size*e.scale, 0, Math.PI*2); ctx.fill();
            if (e.type !== 'score') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, e.size*e.scale*0.4, 0, Math.PI*2); ctx.fill(); }
        }
        ctx.restore();
    });
    particlesRef.current.forEach(p => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1.0; });
    floatingTextsRef.current.forEach(ft => { ctx.globalAlpha = Math.max(0, ft.life); ctx.fillStyle = ft.color; ctx.font = `bold ${ft.size}px monospace`; ctx.textAlign = 'center'; ctx.fillText(ft.text, ft.x, ft.y); });

    if (gameStateRef.current !== 'GAMEOVER') {
        if (player.radius < 3000) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(player.x, player.y); ctx.strokeStyle = `rgba(0, 210, 255, ${Math.max(0, (0.2 - player.radius / 3000))})`; ctx.stroke(); }
        if (player.trail.length > 1) { ctx.beginPath(); ctx.moveTo(player.trail[0].x, player.trail[0].y); player.trail.forEach(t => ctx.lineTo(t.x, t.y)); ctx.strokeStyle = player.dashTime > 0 ? COLORS.dash : player.color; ctx.lineWidth = player.size * (player.dashTime > 0 ? 1.5 : 0.8); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2); ctx.fillStyle = player.dashTime > 0 ? '#fff' : player.color; ctx.fill();
        if (player.shieldTime > 0) { ctx.beginPath(); ctx.arc(player.x, player.y, player.size + 8, 0, Math.PI * 2); ctx.strokeStyle = `rgba(0, 255, 0, ${0.4 + Math.sin(Date.now() / 100) * 0.4})`; ctx.stroke(); }
        if (player.dashTime > 0) { ctx.beginPath(); ctx.arc(player.x, player.y, player.size + 12, 0, Math.PI * 2); ctx.strokeStyle = `rgba(249, 115, 22, 0.8)`; ctx.stroke(); }
    }
    ctx.restore();
  };

  const loop = useCallback(() => { update(); draw(); frameId.current = requestAnimationFrame(loop); }, []);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        canvasRef.current.width = clientWidth; canvasRef.current.height = clientHeight;
        dimensions.current = { width: clientWidth, height: clientHeight, cx: clientWidth / 2, cy: clientHeight / 2 };
        initStars(clientWidth, clientHeight);
      }
    };
    window.addEventListener('resize', handleResize); handleResize();
    frameId.current = requestAnimationFrame(loop);
    return () => { window.removeEventListener('resize', handleResize); cancelAnimationFrame(frameId.current); };
  }, [loop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if(canvas) {
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); isPressing.current = true; }, { passive: false });
        canvas.addEventListener('touchend', () => isPressing.current = false);
        canvas.addEventListener('mousedown', () => isPressing.current = true);
        window.addEventListener('mouseup', () => isPressing.current = false);
    }
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full font-sans select-none overflow-hidden">
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
                    {playerRef.current.magnetTime > 0 && (
                         <span className="text-purple-300 text-[10px] leading-none opacity-80">
                            剩余: {Math.max(0, 15 - playerRef.current.magnetCount)}
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

        {/* Score HUD */}
        {uiGameState === 'PLAYING' && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 pointer-events-none z-10 flex flex-col items-center">
                <span className="text-6xl font-black text-white tracking-tighter" style={{ textShadow: '0 0 20px rgba(0,210,255,0.6)'}}>
                    {scoreDisplay.toLocaleString()}
                </span>
                <span className="text-xs text-cyan-400/60 font-mono tracking-widest uppercase">Score</span>
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
                        <p><span className="text-cyan-400 font-bold">综合计分</span>：光点 + 生存 + 圈数奖励</p>
                        <p><span className="text-white font-bold">撞击光点</span>：获得动力弹射并提升得分</p>
                        <p><span className="text-orange-400 font-bold">高圈数</span>：获得强力的全局分数倍率加成</p>
                    </div>
                    <button onClick={startGame} className="group relative px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(8,145,178,0.5)] flex items-center gap-2 mx-auto">
                        <Play size={20} className="fill-current" /> 开始游戏
                    </button>
                </div>
            </div>
        )}

        {/* Game Over Screen */}
        {uiGameState === 'GAMEOVER' && (
            <div className="absolute inset-0 flex items-center justify-center z-30 bg-red-900/20 backdrop-blur-sm">
                <div className="text-center p-6 border border-red-500/30 rounded-2xl bg-black/90 shadow-2xl w-80 mx-4 transform transition-all animate-in fade-in zoom-in duration-300">
                    <div className="inline-block p-3 rounded-full bg-red-500/20 mb-4 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                        <Skull size={32} className="text-red-500" />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-6">游戏结束</h2>
                    
                    <div className="space-y-2 mb-6 text-left">
                        <div className="flex justify-between items-center text-sm p-2 bg-white/5 rounded border border-white/5">
                            <span className="text-slate-400 flex items-center gap-2"><Target size={14} className="text-cyan-400"/> 游戏得分</span>
                            <span className="font-mono text-cyan-400">+{gameStats.actionScore}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm p-2 bg-white/5 rounded border border-white/5">
                            <span className="text-slate-400 flex items-center gap-2"><Clock size={14} className="text-green-400"/> 生存得分 ({gameStats.formattedDuration})</span>
                            <span className="font-mono text-green-400">+{gameStats.timeScore}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm p-2 bg-white/5 rounded border border-white/5">
                            <span className="text-slate-400 flex items-center gap-2"><Hash size={14} className="text-yellow-400"/> 圈数得分 ({gameStats.finalOrbit} 圈)</span>
                            <span className="font-mono text-yellow-400">+{gameStats.orbitBonus}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs px-2 pt-2 text-slate-500 italic">
                            <span>全局倍率加成</span>
                            <span>x{gameStats.multiplier.toFixed(1)}</span>
                        </div>
                        <div className="border-t border-white/20 pt-4 mt-2">
                             <div className="flex justify-between items-end">
                                <span className="text-xs text-slate-400 uppercase font-bold">最终总成绩</span>
                                <span className="text-4xl font-black text-white shadow-cyan-500 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
                                    {scoreDisplay.toLocaleString()}
                                </span>
                             </div>
                        </div>
                    </div>

                    <div className="bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20 mb-6 flex items-center justify-center gap-2">
                        <Trophy size={16} className="text-yellow-500" /> 
                        <span className="text-xs text-slate-400 uppercase font-bold">历史记录</span>
                        <span className="font-mono font-bold text-yellow-500">{highScore.toLocaleString()}</span>
                    </div>

                    <button onClick={startGame} className="w-full py-3 bg-white hover:bg-slate-200 text-black font-bold rounded-full transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2">
                        <RefreshCw size={18} /> 再次跃迁
                    </button>
                </div>
            </div>
        )}

        <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair active:cursor-grabbing" />
    </div>
  );
};