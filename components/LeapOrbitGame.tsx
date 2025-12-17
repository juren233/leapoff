import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Player, Entity, Particle, Shockwave, EntityType } from '../types';
import { Shield, Zap, Skull, Trophy, Play, RefreshCw, Bomb } from 'lucide-react';

const GAME_VERSION = "v4.3-BalanceFix";

// --- Game Constants ---
const PLAYER_CONFIG = {
  baseRadius: 60,
  leapLimit: 280,
  accelOut: 1.3, 
  gravity: 0.6, 
  drag: 0.94,
  rotSpeed: 0.04, 
  size: 14,
  trailLength: 20,
};

const COLORS = {
  player: '#00d2ff',
  enemy: '#ff3333',
  score: '#ffffff',
  shield: '#00ff00',
  magnet: '#bf00ff',
  nuke: '#facc15', // Yellow
  background: '#1a1a1a',
  grid: '#333333'
};

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
}

export const LeapOrbitGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- React State for UI ---
  const [scoreDisplay, setScoreDisplay] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [uiGameState, setUiGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [buffs, setBuffs] = useState({ shield: false, magnet: false });

  // --- Mutable Game State (Refs for performance) ---
  const gameStateRef = useRef<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const scoreRef = useRef(0);
  
  const frameId = useRef<number>(0);
  const isPressing = useRef<boolean>(false);
  const shake = useRef<number>(0);
  const dimensions = useRef({ width: 0, height: 0, cx: 0, cy: 0 });

  const playerRef = useRef<Player>({
    angle: 0,
    radius: PLAYER_CONFIG.baseRadius,
    baseRadius: PLAYER_CONFIG.baseRadius,
    leapLimit: PLAYER_CONFIG.leapLimit,
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
    magnetTime: 0
  });

  const entitiesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]); // New visual effect
  const starsRef = useRef<Star[]>([]);
  const entityIdCounter = useRef(0);

  // --- Helper Functions ---
  const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

  const initStars = (width: number, height: number) => {
    const starCount = 100;
    const newStars: Star[] = [];
    for(let i=0; i<starCount; i++) {
        newStars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() * 2 + 0.5,
            opacity: Math.random(),
            speed: Math.random() * 0.2 + 0.05
        });
    }
    starsRef.current = newStars;
  };

  const createExplosion = (x: number, y: number, color: string, count = 12) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
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
        maxRadius: 300,
        life: 1.0,
        color
    });
  };

  // --- 重构的生成逻辑：解决后期无光点的问题 ---
  const spawnEntity = () => {
    // 稍微提高总实体上限
    if (entitiesRef.current.length > 25) return;

    // 每帧有 18% 概率尝试生成 (约每秒 10-12 个)
    if (Math.random() > 0.18) return;

    const currentScore = scoreRef.current;
    const r = Math.random();
    let type: EntityType = 'score';

    // 1. 特殊道具 (独立概率，合计约 6%)
    if (r < 0.02) type = 'shield';
    else if (r < 0.04) type = 'magnet';
    else if (r < 0.06) type = 'nuke'; // 新道具：概率 2%
    else {
        // 2. 敌人 vs 分数 (动态平衡)
        // 随着分数提高，生成敌人的概率增加，但封顶 50%，保证至少 50% 概率是分数
        // 初始 10%，每 100 分增加 10%，最高 50%
        const enemyRatio = Math.min(0.1 + (currentScore * 0.001), 0.5);
        
        // 限制同屏最大敌人数，防止过于变态
        const currentEnemies = entitiesRef.current.filter(e => e.type === 'enemy').length;
        // 基础允许 4 个敌人，每 50 分允许多 1 个，上限 15 个
        const maxEnemies = Math.min(4 + Math.floor(currentScore / 50), 15);

        if (Math.random() < enemyRatio && currentEnemies < maxEnemies) {
            type = 'enemy';
        } else {
            type = 'score';
        }
    }

    const entity: Entity = {
      id: entityIdCounter.current++,
      type,
      angle: randomRange(0, Math.PI * 2),
      dist: randomRange(PLAYER_CONFIG.baseRadius + 50, PLAYER_CONFIG.leapLimit - 20),
      active: true,
      scale: 0,
      maxScale: 1,
      rotation: 0,
      moveSpeed: type === 'enemy' ? randomRange(-0.02, 0.02) : 0, // 敌人稍微变快一点点让动态感更强
      size: type === 'score' ? 10 : (type === 'enemy' ? 16 : 14),
      color: COLORS[type]
    };

    entitiesRef.current.push(entity);
  };

  const initGame = () => {
    const { cx, cy } = dimensions.current;
    playerRef.current = {
      ...playerRef.current,
      angle: 0,
      radius: PLAYER_CONFIG.baseRadius,
      rVelocity: 0,
      shieldTime: 0,
      magnetTime: 0,
      trail: [],
      x: cx + PLAYER_CONFIG.baseRadius,
      y: cy
    };
    entitiesRef.current = [];
    particlesRef.current = [];
    shockwavesRef.current = [];
    scoreRef.current = 0;
    setScoreDisplay(0);
    setBuffs({ shield: false, magnet: false });
    isPressing.current = false;
    
    // Initial spawn
    for(let i=0; i<8; i++) {
        entitiesRef.current.push({
            id: entityIdCounter.current++,
            type: 'score',
            angle: (Math.PI * 2 / 8) * i,
            dist: 150,
            active: true,
            scale: 1,
            maxScale: 1,
            rotation: 0,
            moveSpeed: 0,
            size: 10,
            color: COLORS.score
        });
    }
  };

  const startGame = () => {
    initGame();
    gameStateRef.current = 'PLAYING';
    setUiGameState('PLAYING');
  };

  // --- Main Game Loop ---
  const update = () => {
    if (gameStateRef.current !== 'PLAYING') return;

    const player = playerRef.current;
    const { cx, cy } = dimensions.current;

    // 1. Player Physics
    player.angle += player.rotSpeed;

    if (isPressing.current) {
      const forceFactor = 1 - (player.radius / (player.leapLimit + 100));
      player.rVelocity += player.accelOut * forceFactor;
    } else {
      player.rVelocity -= player.gravity;
    }

    player.rVelocity *= player.drag;
    player.radius += player.rVelocity;

    if (player.radius < player.baseRadius) {
      player.radius = player.baseRadius;
      if (player.rVelocity < -1) {
        player.rVelocity = -player.rVelocity * 0.4;
        shake.current = Math.min(Math.abs(player.rVelocity) * 2, 5);
        createExplosion(player.x, player.y, 'rgba(255,255,255,0.3)', 3);
      } else {
        player.rVelocity = 0;
      }
    }
    
    if (player.radius > player.leapLimit) {
      player.rVelocity -= 0.8;
    }

    player.x = cx + Math.cos(player.angle) * player.radius;
    player.y = cy + Math.sin(player.angle) * player.radius;

    player.trail.push({ x: player.x, y: player.y });
    if (player.trail.length > PLAYER_CONFIG.trailLength) {
      player.trail.shift();
    }

    // Buff timers
    if (player.shieldTime > 0) player.shieldTime--;
    if (player.magnetTime > 0) player.magnetTime--;

    // Sync Buff state (Check periodically or just let React batch it)
    const hasShield = player.shieldTime > 0;
    const hasMagnet = player.magnetTime > 0;
    
    // 2. Entities Logic
    spawnEntity();

    for (let i = entitiesRef.current.length - 1; i >= 0; i--) {
      const e = entitiesRef.current[i];
      if (!e.active) continue;
      
      // Spawn animation
      if (e.scale < e.maxScale) e.scale += 0.1;
      
      // Enemy movement
      if (e.type === 'enemy') {
        e.angle += e.moveSpeed;
        e.rotation += 0.05;
      }

      // Magnet Effect
      let magnetSucked = false;
      if (e.type === 'score' && player.magnetTime > 0) {
        const dx = player.x - (cx + Math.cos(e.angle) * e.dist);
        const dy = player.y - (cy + Math.sin(e.angle) * e.dist);
        const distSq = dx * dx + dy * dy;

        if (distSq < 80000) {
          e.dist += (player.radius - e.dist) * 0.18;
          let diffAngle = player.angle - e.angle;
          while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
          while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
          e.angle += diffAngle * 0.12;
          if (distSq < 2500) magnetSucked = true;
        }
      }

      // Collision Detection
      const ex = cx + Math.cos(e.angle) * e.dist;
      const ey = cy + Math.sin(e.angle) * e.dist;
      const dx = player.x - ex;
      const dy = player.y - ey;
      const distSq = dx*dx + dy*dy;
      const radiusSum = player.size + e.size * e.scale;

      if (distSq < radiusSum * radiusSum || magnetSucked) {
        // Collision!
        if (e.type === 'score') {
          scoreRef.current += 1;
          createExplosion(ex, ey, 'white', 8);
          entitiesRef.current.splice(i, 1);
        } else if (e.type === 'shield') {
          player.shieldTime = 400;
          createExplosion(ex, ey, COLORS.shield, 15);
          entitiesRef.current.splice(i, 1);
        } else if (e.type === 'magnet') {
          player.magnetTime = 600;
          createExplosion(ex, ey, COLORS.magnet, 15);
          entitiesRef.current.splice(i, 1);
        } else if (e.type === 'nuke') {
          // --- NUKE LOGIC ---
          createExplosion(ex, ey, COLORS.nuke, 20);
          createShockwave(player.x, player.y, COLORS.nuke);
          shake.current = 15;
          
          // Kill enemies nearby
          const killRadiusSq = 300 * 300;
          // Loop through entities again to find enemies
          // Note: iterating backwards to splice safely
          for (let j = entitiesRef.current.length - 1; j >= 0; j--) {
              const target = entitiesRef.current[j];
              // Skip if it's the nuke itself (handled by outer loop logic removal)
              if (target.id === e.id) continue;

              if (target.type === 'enemy') {
                  const tx = cx + Math.cos(target.angle) * target.dist;
                  const ty = cy + Math.sin(target.angle) * target.dist;
                  const tdx = player.x - tx;
                  const tdy = player.y - ty;
                  
                  if ((tdx*tdx + tdy*tdy) < killRadiusSq) {
                      createExplosion(tx, ty, COLORS.enemy, 15);
                      entitiesRef.current.splice(j, 1);
                      scoreRef.current += 5;
                      
                      // Critical: If we removed an item with index < i, we must adjust i
                      if (j < i) {
                          i--;
                      }
                  }
              }
          }
          // Remove the Nuke
          entitiesRef.current.splice(i, 1);

        } else if (e.type === 'enemy') {
          if (player.shieldTime > 0) {
            createExplosion(ex, ey, COLORS.enemy, 20);
            shake.current = 10;
            entitiesRef.current.splice(i, 1);
            scoreRef.current += 5;
          } else {
            createExplosion(player.x, player.y, COLORS.player, 30);
            setHighScore(prev => Math.max(prev, scoreRef.current));
            gameStateRef.current = 'GAMEOVER';
            setUiGameState('GAMEOVER');
            shake.current = 20;
          }
        }
      }
    }

    // 3. Particles Logic
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.03;
      if (p.life <= 0) particlesRef.current.splice(i, 1);
    }
    
    // 4. Shockwaves Logic
    for (let i = shockwavesRef.current.length - 1; i >= 0; i--) {
        const sw = shockwavesRef.current[i];
        sw.radius += 10;
        sw.life -= 0.04;
        if(sw.life <= 0) shockwavesRef.current.splice(i, 1);
    }

    if (shake.current > 0) shake.current *= 0.9;
    if (shake.current < 0.5) shake.current = 0;

    if (scoreRef.current !== scoreDisplay) {
        setScoreDisplay(scoreRef.current);
    }
    
    setBuffs(prev => {
        if (prev.shield !== hasShield || prev.magnet !== hasMagnet) {
            return { shield: hasShield, magnet: hasMagnet };
        }
        return prev;
    });
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height, cx, cy } = dimensions.current;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    
    if (shake.current > 0) {
      const dx = (Math.random() - 0.5) * shake.current;
      const dy = (Math.random() - 0.5) * shake.current;
      ctx.translate(dx, dy);
    }

    // Stars
    starsRef.current.forEach(star => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // Grid
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let r=100; r < Math.max(width, height); r+=100) {
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
    ctx.stroke();

    // Hub
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#333';
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.stroke();

    const pulse = Math.sin(Date.now() / 200) * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 30 + pulse, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 210, 255, 0.3)`;
    ctx.stroke();

    // Rings
    ctx.beginPath();
    ctx.arc(cx, cy, PLAYER_CONFIG.baseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.setLineDash([5, 5]);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, PLAYER_CONFIG.leapLimit, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.stroke();
    ctx.setLineDash([]);

    if (gameStateRef.current !== 'PLAYING' && gameStateRef.current !== 'GAMEOVER') {
      ctx.restore();
      return;
    }

    const player = playerRef.current;

    // Draw Shockwaves
    shockwavesRef.current.forEach(sw => {
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 4 * sw.life;
        ctx.globalAlpha = sw.life;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    });

    // Draw Entities
    entitiesRef.current.forEach(e => {
        if (!e.active) return;
        const x = cx + Math.cos(e.angle) * e.dist;
        const y = cy + Math.sin(e.angle) * e.dist;
        const s = e.size * e.scale;

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
            ctx.fillStyle = e.color;
            ctx.shadowColor = e.color;
            ctx.shadowBlur = e.type === 'score' ? 5 : 15;
            
            ctx.beginPath();
            ctx.arc(0, 0, s, 0, Math.PI * 2);
            ctx.fill();

            if (e.type === 'shield' || e.type === 'magnet' || e.type === 'nuke') {
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    });

    // Draw Particles
    particlesRef.current.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });

    // Draw Player
    if (gameStateRef.current !== 'GAMEOVER') {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(player.x, player.y);
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (player.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(player.trail[0].x, player.trail[0].y);
            for (let i = 1; i < player.trail.length; i++) {
                ctx.lineTo(player.trail[i].x, player.trail[i].y);
            }
            ctx.strokeStyle = player.color;
            ctx.lineWidth = player.size * 0.8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.4;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }

        ctx.beginPath();
        ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
        ctx.fillStyle = player.color;
        ctx.shadowColor = player.color;
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Buff Visuals
        if (player.shieldTime > 0) {
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.size + 8, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 255, 0, ${0.4 + Math.sin(Date.now() / 100) * 0.4})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        if (player.magnetTime > 0) {
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.size + 16, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(191, 0, 255, 0.2)`;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
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
            <div className={`flex items-center gap-2 transition-all duration-300 ${buffs.shield ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500 shadow-[0_0_10px_#00ff00]">
                    <Shield size={16} className="text-green-400" />
                </div>
                <span className="text-green-400 font-bold tracking-wider text-sm shadow-black drop-shadow-md">护盾已激活</span>
            </div>
            <div className={`flex items-center gap-2 transition-all duration-300 ${buffs.magnet ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500 shadow-[0_0_10px_#bf00ff]">
                    <Zap size={16} className="text-purple-400" />
                </div>
                <span className="text-purple-400 font-bold tracking-wider text-sm shadow-black drop-shadow-md">磁吸已激活</span>
            </div>
        </div>

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
                        <p><span className="text-cyan-400 font-bold">按住屏幕</span> 向外跃迁</p>
                        <p><span className="text-white/60">松开手指</span> 引力回落</p>
                        <p>收集 <span className="text-white font-bold">光点</span>，躲避 <span className="text-red-500 font-bold">红色尖刺</span></p>
                    </div>

                    <button 
                        onClick={startGame}
                        className="group relative px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(8,145,178,0.5)] flex items-center gap-2 mx-auto"
                    >
                        <Play size={20} className="fill-current" />
                        开始任务
                    </button>
                    
                    <div className="mt-8 flex justify-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#00ff00]"></div> 护盾</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_5px_#bf00ff]"></div> 磁吸</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_5px_#facc15]"></div> 冲击波</div>
                    </div>
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
                    <h2 className="text-3xl font-black text-white mb-2">任务失败</h2>
                    
                    <div className="grid grid-cols-2 gap-4 my-6">
                        <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                            <div className="text-xs text-slate-400 uppercase mb-1">本次得分</div>
                            <div className="text-2xl font-mono font-bold text-white">{scoreDisplay}</div>
                        </div>
                        <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                            <div className="text-xs text-slate-400 uppercase mb-1 flex items-center justify-center gap-1">
                                <Trophy size={10} className="text-yellow-500" /> 历史最高
                            </div>
                            <div className="text-2xl font-mono font-bold text-yellow-500">{highScore}</div>
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