import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Player, Entity, Particle, Shockwave, EntityType } from '../types';
import { Shield, Zap, Skull, Trophy, Play, RefreshCw } from 'lucide-react';

const GAME_VERSION = "v5.0-Infinite";

// --- Game Constants ---
const PLAYER_CONFIG = {
  baseRadius: 100, // 稍微增大基础安全区
  accelOut: 0.8,   // 主动按压时的加速度
  gravity: 0.5,    // 引力
  drag: 0.96,      // 空气阻力
  rotSpeed: 0.035, // 角速度
  size: 14,
  trailLength: 25,
};

const COLORS = {
  player: '#00d2ff',
  enemy: '#ff3333',
  score: '#ffffff',
  shield: '#00ff00',
  magnet: '#bf00ff',
  nuke: '#facc15',
  background: '#111111',
  grid: '#333333'
};

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
  const [buffs, setBuffs] = useState({ shield: false, magnet: false });

  // --- Mutable Game State ---
  const gameStateRef = useRef<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const scoreRef = useRef(0);
  
  const frameId = useRef<number>(0);
  const isPressing = useRef<boolean>(false);
  const shake = useRef<number>(0);
  const dimensions = useRef({ width: 0, height: 0, cx: 0, cy: 0 });

  // 玩家状态
  const playerRef = useRef<Player>({
    angle: 0,
    radius: PLAYER_CONFIG.baseRadius,
    baseRadius: PLAYER_CONFIG.baseRadius,
    leapLimit: 999999, // 无限模式，实际上不再限制
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
  const shockwavesRef = useRef<Shockwave[]>([]);
  const starsRef = useRef<Star[]>([]);
  const entityIdCounter = useRef(0);

  // --- Helper Functions ---
  const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

  // 初始化星星 (固定在屏幕坐标系上，模拟深空背景)
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

  const createExplosion = (x: number, y: number, color: string, count = 12, speed = 12) => {
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

  // --- 无限地图生成逻辑 ---
  const spawnEntity = () => {
    if (entitiesRef.current.length > 30) return; // 保持适量实体
    
    // 生成逻辑：始终在玩家当前半径的“外侧”生成，引导玩家向外跳
    // 同时也保留少量内侧生成，以防玩家掉落时太无聊
    
    if (Math.random() > 0.15) return; // 限制生成频率

    const currentScore = scoreRef.current;
    const playerRadius = playerRef.current.radius;
    const r = Math.random();
    let type: EntityType = 'score';

    // 道具生成概率
    if (r < 0.02) type = 'shield';
    else if (r < 0.04) type = 'magnet';
    else if (r < 0.06) type = 'nuke';
    else {
        // 敌人生成逻辑
        const enemyRatio = Math.min(0.1 + (currentScore * 0.001), 0.4);
        const currentEnemies = entitiesRef.current.filter(e => e.type === 'enemy').length;
        // 允许同屏敌人随分数增加
        const maxEnemies = Math.min(5 + Math.floor(currentScore / 40), 20);

        if (Math.random() < enemyRatio && currentEnemies < maxEnemies) {
            type = 'enemy';
        } else {
            type = 'score';
        }
    }

    // 关键改动：基于玩家当前的 Radius 生成
    // 大部分生成在前方 (100 ~ 600 像素远)，少量生成在附近
    const spawnRadiusOffset = randomRange(100, 700);
    const spawnDist = Math.max(PLAYER_CONFIG.baseRadius + 50, playerRadius + spawnRadiusOffset);
    
    // 角度生成在玩家前方一定范围内，或者全随机
    // 全随机比较好，因为玩家在旋转
    const spawnAngle = randomRange(0, Math.PI * 2);

    const entity: Entity = {
      id: entityIdCounter.current++,
      type,
      angle: spawnAngle,
      dist: spawnDist,
      active: true,
      scale: 0,
      maxScale: 1,
      rotation: 0,
      moveSpeed: type === 'enemy' ? randomRange(-0.02, 0.02) : 0,
      size: type === 'score' ? 12 : (type === 'enemy' ? 18 : 16), // 稍微加大尺寸
      color: COLORS[type]
    };

    entitiesRef.current.push(entity);
  };

  const initGame = () => {
    playerRef.current = {
      ...playerRef.current,
      angle: 0,
      radius: PLAYER_CONFIG.baseRadius,
      rVelocity: 0,
      shieldTime: 0,
      magnetTime: 0,
      trail: [],
      x: 0, // 这些坐标现在是相对于世界中心的
      y: 0
    };
    entitiesRef.current = [];
    particlesRef.current = [];
    shockwavesRef.current = [];
    scoreRef.current = 0;
    setScoreDisplay(0);
    setBuffs({ shield: false, magnet: false });
    isPressing.current = false;
    
    // 初始生成一圈，让玩家有东西吃
    for(let i=0; i<10; i++) {
        entitiesRef.current.push({
            id: entityIdCounter.current++,
            type: 'score',
            angle: (Math.PI * 2 / 10) * i,
            dist: PLAYER_CONFIG.baseRadius + 150,
            active: true,
            scale: 1,
            maxScale: 1,
            rotation: 0,
            moveSpeed: 0,
            size: 12,
            color: COLORS.score
        });
    }
  };

  const startGame = () => {
    initGame();
    gameStateRef.current = 'PLAYING';
    setUiGameState('PLAYING');
  };

  // --- Main Update Loop ---
  const update = () => {
    if (gameStateRef.current !== 'PLAYING') return;

    const player = playerRef.current;
    
    // 1. 玩家物理
    player.angle += player.rotSpeed;

    if (isPressing.current) {
      player.rVelocity += 0.6; // 按住时持续加速，但较缓
    } else {
      player.rVelocity -= player.gravity; // 没按住时受到引力
    }

    player.rVelocity *= player.drag;
    player.radius += player.rVelocity;

    // 下界限制（掉回中心）
    if (player.radius < player.baseRadius) {
      player.radius = player.baseRadius;
      if (player.rVelocity < -1) {
        // 撞击核心的反弹
        player.rVelocity = -player.rVelocity * 0.5;
        shake.current = Math.min(Math.abs(player.rVelocity) * 2, 8);
        createExplosion(
            Math.cos(player.angle) * player.radius, 
            Math.sin(player.angle) * player.radius, 
            'rgba(255,255,255,0.3)', 
            5
        );
      } else {
        player.rVelocity = 0;
      }
    }
    
    // 计算玩家的世界坐标 (相对于宇宙中心 0,0)
    player.x = Math.cos(player.angle) * player.radius;
    player.y = Math.sin(player.angle) * player.radius;

    // 拖尾
    player.trail.push({ x: player.x, y: player.y });
    if (player.trail.length > PLAYER_CONFIG.trailLength) {
      player.trail.shift();
    }

    // Buff 计时
    if (player.shieldTime > 0) player.shieldTime--;
    if (player.magnetTime > 0) player.magnetTime--;
    const hasShield = player.shieldTime > 0;
    const hasMagnet = player.magnetTime > 0;

    // 2. 实体逻辑 & 清理过远实体
    spawnEntity();

    for (let i = entitiesRef.current.length - 1; i >= 0; i--) {
      const e = entitiesRef.current[i];
      
      // 清理逻辑：如果实体距离玩家太远（比如落后太多），就移除，节省性能
      // 简单判断距离差
      if (Math.abs(e.dist - player.radius) > 1500) {
          entitiesRef.current.splice(i, 1);
          continue;
      }
      
      if (!e.active) continue;
      
      if (e.scale < e.maxScale) e.scale += 0.1;
      
      if (e.type === 'enemy') {
        e.angle += e.moveSpeed;
        e.rotation += 0.05;
      }

      // 磁铁逻辑
      let magnetSucked = false;
      if (e.type === 'score' && player.magnetTime > 0) {
        // 计算两点距离（极坐标转笛卡尔算距离比较准）
        const ex = Math.cos(e.angle) * e.dist;
        const ey = Math.sin(e.angle) * e.dist;
        const dx = player.x - ex;
        const dy = player.y - ey;
        const distSq = dx * dx + dy * dy;

        if (distSq < 100000) { // 磁吸范围
          e.dist += (player.radius - e.dist) * 0.2;
          let diffAngle = player.angle - e.angle;
          while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
          while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
          e.angle += diffAngle * 0.15;
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

      if (distSq < radiusSum * radiusSum || magnetSucked) {
        // --- 吃到东西了 ---
        
        if (e.type === 'score') {
          scoreRef.current += 1;
          createExplosion(ex, ey, 'white', 8, 8);
          
          // *** 核心修改：吃到光点，向外弹射！ ***
          // 给予一个向外的速度冲量。如果当前速度很低，给大一点；如果已经很快，给小一点
          const boost = 3.5; 
          player.rVelocity = Math.max(player.rVelocity + boost, boost);
          
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
          createExplosion(ex, ey, COLORS.nuke, 20);
          createShockwave(ex, ey, COLORS.nuke); // 冲击波在道具位置产生
          shake.current = 20;
          
          // Nuke Logic
          const killRadiusSq = 400 * 400; // 范围更大
          for (let j = entitiesRef.current.length - 1; j >= 0; j--) {
              const target = entitiesRef.current[j];
              if (target.id === e.id) continue;
              if (target.type === 'enemy') {
                  const tx = Math.cos(target.angle) * target.dist;
                  const ty = Math.sin(target.angle) * target.dist;
                  const tdx = ex - tx; // 相对于核弹位置
                  const tdy = ey - ty;
                  if ((tdx*tdx + tdy*tdy) < killRadiusSq) {
                      createExplosion(tx, ty, COLORS.enemy, 15);
                      entitiesRef.current.splice(j, 1);
                      scoreRef.current += 5;
                      if (j < i) i--;
                  }
              }
          }
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
            shake.current = 25;
          }
        }
      }
    }

    // 3. 粒子更新
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.03;
      if (p.life <= 0) particlesRef.current.splice(i, 1);
    }
    
    // 4. 冲击波更新
    for (let i = shockwavesRef.current.length - 1; i >= 0; i--) {
        const sw = shockwavesRef.current[i];
        sw.radius += 12;
        sw.life -= 0.03;
        if(sw.life <= 0) shockwavesRef.current.splice(i, 1);
    }

    if (shake.current > 0) shake.current *= 0.9;
    
    // UI同步
    if (scoreRef.current !== scoreDisplay) setScoreDisplay(scoreRef.current);
    setBuffs(prev => {
        if (prev.shield !== hasShield || prev.magnet !== hasMagnet) return { shield: hasShield, magnet: hasMagnet };
        return prev;
    });
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height, cx, cy } = dimensions.current;
    const player = playerRef.current;

    // 清空画布
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    ctx.save();

    // --- 摄像机变换的核心 ---
    // 1. 移动到屏幕中心
    ctx.translate(cx, cy);
    // 2. 加上震动偏移
    if (shake.current > 0) {
      ctx.translate((Math.random() - 0.5) * shake.current, (Math.random() - 0.5) * shake.current);
    }
    // 3. 反向移动玩家的世界坐标，使玩家始终处于 (cx, cy)
    // 玩家世界坐标:
    const px = Math.cos(player.angle) * player.radius;
    const py = Math.sin(player.angle) * player.radius;
    ctx.translate(-px, -py);

    // --- 现在我们在“世界坐标系”下绘图 (0,0 是宇宙大爆炸的中心) ---

    // 绘制星星 (视差背景)
    // 技巧：星星是基于屏幕坐标的，但我们在这里把它画在世界里，
    // 或者我们直接在 transform 之前画星星？
    // 为了性能和效果，我们在 restore 之后单独画星星，或者在这里反算。
    // 这里我们用一种简单的平铺逻辑来模拟无限背景。
    ctx.save();
    // 临时取消之前的 translate，回到屏幕坐标系绘制背景，模拟视差
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    starsRef.current.forEach(star => {
        // 简单的视差位移
        const parallaxX = (star.x - px * 0.1) % width;
        const parallaxY = (star.y - py * 0.1) % height;
        // 处理负数取模
        const finalX = parallaxX < 0 ? parallaxX + width : parallaxX;
        const finalY = parallaxY < 0 ? parallaxY + height : parallaxY;
        
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.beginPath();
        ctx.arc(finalX, finalY, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore(); // 恢复到世界坐标系

    // 绘制轨道网格 (无限延伸)
    // 只绘制视野范围内的圆圈
    // 视野范围大约是 player.radius +/- 半个屏幕宽
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    const minRenderRadius = Math.max(100, player.radius - Math.max(width, height));
    const maxRenderRadius = player.radius + Math.max(width, height);
    // 向下取整到最近的 100
    const startGrid = Math.floor(minRenderRadius / 200) * 200;
    
    for(let r = startGrid; r < maxRenderRadius; r += 200) {
        ctx.moveTo(r + r, 0); // 避免 canvas context 路径闭合问题
        ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    ctx.stroke();

    // 绘制中心枢纽 (如果离得近)
    if (player.radius < Math.max(width, height)) {
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fillStyle = '#333';
        ctx.fill();
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        ctx.stroke();

        const pulse = Math.sin(Date.now() / 200) * 2;
        ctx.beginPath();
        ctx.arc(0, 0, 30 + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 210, 255, 0.3)`;
        ctx.stroke();
    }
    
    // 安全区边界线 (Start Line)
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_CONFIG.baseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (gameStateRef.current !== 'PLAYING' && gameStateRef.current !== 'GAMEOVER') {
      ctx.restore();
      return;
    }

    // 绘制冲击波
    shockwavesRef.current.forEach(sw => {
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 4 * sw.life;
        ctx.globalAlpha = sw.life;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    });

    // 绘制实体
    entitiesRef.current.forEach(e => {
        if (!e.active) return;
        const x = Math.cos(e.angle) * e.dist;
        const y = Math.sin(e.angle) * e.dist;
        const s = e.size * e.scale;

        // 简单的视锥剔除 (Culling)
        if (Math.abs(x - px) > width && Math.abs(y - py) > height) return;

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
            
            if (e.type !== 'score') {
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    });

    // 绘制粒子
    particlesRef.current.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });

    // 绘制玩家
    if (gameStateRef.current !== 'GAMEOVER') {
        // 连线 (连接到圆心，为了视觉参考)
        // 在无限模式下，如果距离太远，连线会很丑，所以我们可以只画一小段或者淡出
        if (player.radius < 2000) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(px, py);
            ctx.strokeStyle = `rgba(0, 210, 255, ${Math.max(0, 0.2 - player.radius / 2000)})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // 拖尾
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

        // 玩家本体
        ctx.beginPath();
        ctx.arc(px, py, player.size, 0, Math.PI * 2);
        ctx.fillStyle = player.color;
        ctx.shadowColor = player.color;
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Buff 视觉效果
        if (player.shieldTime > 0) {
            ctx.beginPath();
            ctx.arc(px, py, player.size + 8, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 255, 0, ${0.4 + Math.sin(Date.now() / 100) * 0.4})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        if (player.magnetTime > 0) {
            ctx.beginPath();
            ctx.arc(px, py, player.size + 16, 0, Math.PI * 2);
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
                        <p><span className="text-cyan-400 font-bold">吃到光点</span> 获得加速脉冲</p>
                        <p><span className="text-white font-bold">不断向外跃迁</span> 探索深空</p>
                        <p>掉回核心则 <span className="text-red-500 font-bold">任务失败</span></p>
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