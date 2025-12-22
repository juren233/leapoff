/*
 * 文件作用：游戏的核心物理循环逻辑（位置更新、碰撞检测、状态管理）
 * 注意：开头这段注释不得删除！！！
 */

import { GameRefs } from '../types';
import { PLAYER_CONFIG, COLORS, BONUS_SCORE_THRESHOLD, CENTER_SAFE_LIMIT, CENTER_DEATH_LIMIT } from '../constants';
import { calculateCurrentTotalScore, createExplosion, createShockwave, spawnFloatingText, triggerHaptic } from './utils';
import { spawnEntity, spawnInnerAmbience, spawnSafetyRing } from './spawner';
import { audioManager } from './audio';

// Callbacks interface for actions that need to trigger UI/React changes or specific logic defined in main
export interface GameActions {
    triggerBonusMode: () => void;
    endBonusMode: () => void;
    triggerDyingSequence: () => void;
    handleGameOver: () => void;
}

// Interface for UI Setters needed in the loop
export interface UiSetters {
    setScoreDisplay: (val: number) => void;
    setOrbitCountDisplay: (val: number) => void;
    setBuffs: (val: { shield: number; magnet: number; dash: number }) => void;
    setCenterWarning: (val: boolean) => void;
    setBonusTimeLeft: (val: number) => void;
    setRunCoins: (val: number) => void;
}

export const updateGame = (
    refs: GameRefs,
    actions: GameActions,
    ui: UiSetters,
    dt: number // Delta Time factor (1.0 = 60fps)
) => {
    if (refs.gameStateRef.current === 'START') return;

    // --- DYING STATE ---
    if (refs.gameStateRef.current === 'DYING') {
        refs.deathTimerRef.current -= 1 * dt;
        const player = refs.playerRef.current;
        refs.cameraRef.current.x += (player.x - refs.cameraRef.current.x) * 0.03 * dt;
        refs.cameraRef.current.y += (player.y - refs.cameraRef.current.y) * 0.03 * dt;
        refs.cameraRef.current.zoom += (3.8 - refs.cameraRef.current.zoom) * 0.015 * dt;
        refs.particlesRef.current.forEach((p, i) => { 
            p.x += p.vx * 0.25 * dt; 
            p.y += p.vy * 0.25 * dt; 
            p.life -= 0.005 * dt; 
            if (p.life <= 0) refs.particlesRef.current.splice(i, 1); 
        });
        refs.shockwavesRef.current.forEach((sw, i) => { 
            sw.radius += 2.5 * dt; 
            sw.life -= 0.006 * dt; 
            if (sw.life <= 0) refs.shockwavesRef.current.splice(i, 1); 
        });
        if (refs.shake.current > 0) refs.shake.current *= Math.pow(0.98, dt);
        if (refs.deathTimerRef.current <= 0) actions.handleGameOver();
        return;
    }

    // --- GAMEOVER STATE ---
    if (refs.gameStateRef.current === 'GAMEOVER') {
        refs.particlesRef.current.forEach((p, i) => { 
            p.x += p.vx * 0.5 * dt; 
            p.y += p.vy * 0.5 * dt; 
            p.life -= 0.01 * dt; 
            if (p.life <= 0) refs.particlesRef.current.splice(i, 1); 
        });
        refs.shockwavesRef.current.forEach((sw, i) => { 
            sw.radius += 2 * dt; 
            sw.life -= 0.01 * dt; 
            if (sw.life <= 0) refs.shockwavesRef.current.splice(i, 1); 
        });
        refs.floatingTextsRef.current.forEach((ft, i) => { 
            ft.y += ft.vy * 0.5 * dt; 
            ft.life -= 0.01 * dt; 
            if (ft.life <= 0) refs.floatingTextsRef.current.splice(i, 1); 
        });
        return;
    }

    const player = refs.playerRef.current;
    
    // --- Bonus Time Logic ---
    const currentTotalScore = calculateCurrentTotalScore(refs.gameEndTimeRef.current, refs.gameStartTimeRef.current, refs.orbitRef.current, refs.actionScoreRef.current);
    
    if (refs.isBonusTimeRef.current) {
        // dt = delta / 16.666 ms
        // To subtract seconds: refs.bonusTimerRef.current (seconds) -= dt / 60
        // (because dt=1 means 1/60th of a second passed)
        refs.bonusTimerRef.current -= dt / 60;
        ui.setBonusTimeLeft(refs.bonusTimerRef.current);
        
        if (refs.bonusTimerRef.current <= 0) {
            actions.endBonusMode();
        }
    } else {
        ui.setScoreDisplay(currentTotalScore);
        
        const nextThreshold = refs.lastBonusThresholdRef.current + BONUS_SCORE_THRESHOLD;
        if (currentTotalScore >= nextThreshold) {
            refs.lastBonusThresholdRef.current += BONUS_SCORE_THRESHOLD;
            actions.triggerBonusMode();
        }
    }

    // Buffs
    if (player.shieldTime > 0) {
        if (Math.ceil(player.shieldTime) === 1 && Math.ceil(player.shieldTime - dt) <= 0) triggerHaptic([40, 30, 15]); 
        player.shieldTime -= 1 * dt;
    }
    if (player.magnetTime > 0) player.magnetTime -= 1 * dt;
    if (player.dashTime > 0) player.dashTime -= 1 * dt;
    const hasShield = player.shieldTime > 0;
    const hasMagnet = player.magnetTime > 0;
    const hasDash = player.dashTime > 0;

    // Movement Physics
    // Calculate dynamic rotation speed:
    // Base Speed * Sqrt(BaseRadius / CurrentRadius)
    // This creates a smooth falloff where higher altitude = slower rotation
    const altitudeDamping = Math.sqrt(player.baseRadius / Math.max(player.baseRadius, player.radius));
    
    if (hasDash) {
        // Dash maintains high speed but still feels the altitude slightly
        const dashSpeed = PLAYER_CONFIG.dashRotSpeed * altitudeDamping;
        player.angle += dashSpeed * dt;
        player.rVelocity *= Math.pow(0.5, dt); 
    } else {
        if (refs.isPressing.current) {
             const currentRotSpeed = PLAYER_CONFIG.rotSpeed * altitudeDamping;
             player.angle += currentRotSpeed * dt; 
        }
        player.rVelocity -= player.gravity * dt; 
    }
    player.rVelocity *= Math.pow(player.drag, dt); 
    player.radius += player.rVelocity * dt;

    // Orbit & Hub Logic
    const currentOrbitNum = Math.floor(player.angle / (Math.PI * 2)) + 1; 
    if (currentOrbitNum > refs.orbitRef.current) {
        refs.orbitRef.current = currentOrbitNum;
        ui.setOrbitCountDisplay(currentOrbitNum);
        refs.shake.current = 5;
        createShockwave(refs, 0, 0, '#00d2ff');
        if (!refs.isBonusTimeRef.current) spawnSafetyRing(refs, currentOrbitNum);
    }

    if (player.radius < player.baseRadius) {
      player.radius = player.baseRadius;
      if (player.rVelocity < -1) {
        player.rVelocity = -player.rVelocity * 0.4; 
        refs.shake.current = Math.min(Math.abs(player.rVelocity) * 2, 5);
      } else player.rVelocity = 0;
    }

    const DANGER_ZONE = player.baseRadius + 10;
    if (player.radius <= DANGER_ZONE) {
        if (refs.isBonusTimeRef.current) {
            actions.endBonusMode();
        }

        player.centerTime += 1 * dt;
        if (player.centerTime > CENTER_SAFE_LIMIT) {
            ui.setCenterWarning(true);
            refs.shake.current = (player.centerTime - CENTER_SAFE_LIMIT) / 20; 
            if (player.centerTime > CENTER_DEATH_LIMIT) actions.triggerDyingSequence();
        }
    } else {
        if (player.centerTime > 0) { player.centerTime = 0; ui.setCenterWarning(false); }
    }
    
    player.x = Math.cos(player.angle) * player.radius;
    player.y = Math.sin(player.angle) * player.radius;

    // --- Trail Logic Update for Framerate Independence ---
    player.trailAccumulator += dt;
    if (player.trailAccumulator >= 1.0) {
        player.trail.push({ x: player.x, y: player.y });
        if (player.trail.length > PLAYER_CONFIG.trailLength) player.trail.shift();
        player.trailAccumulator -= 1.0;
        // Cap accumulator to prevent runaway loops on huge lag spikes
        if (player.trailAccumulator > 1.0) player.trailAccumulator = 0;
    }

    // --- CAMERA LOGIC ---
    const { width, height } = refs.dimensions.current;
    
    const fitDimension = Math.min(width, height);
    const requiredViewDiameter = (player.radius * 2) + (hasDash ? 400 : 300);
    const targetZoom = Math.max(
        width < 600 ? 0.25 : 0.35,
        Math.min(1.2, fitDimension / requiredViewDiameter)
    );

    refs.cameraRef.current.x += (player.x * 0.5 - refs.cameraRef.current.x) * 0.08 * dt;
    refs.cameraRef.current.y += (player.y * 0.5 - refs.cameraRef.current.y) * 0.08 * dt;
    refs.cameraRef.current.zoom += (targetZoom - refs.cameraRef.current.zoom) * 0.05 * dt;

    spawnEntity(refs);
    spawnInnerAmbience(refs);

    const now = Date.now();
    for (let i = refs.entitiesRef.current.length - 1; i >= 0; i--) {
      const e = refs.entitiesRef.current[i];
      if (!e || !e.active) continue;
      if (e.isSafety && refs.orbitRef.current >= 2) {
          e.dist = (e.baseDist || e.dist) + Math.sin(now * 0.002 + (e.wobblePhase || 0)) * Math.min(50, 15 + (refs.orbitRef.current - 2) * 5);
      }
      if (e.scale < e.maxScale) e.scale += 0.125 * dt; 
      e.angle += e.moveSpeed * dt;
      if (e.type === 'enemy') e.rotation += 0.06 * dt;

      let magnetSucked = false;
      // Magnet affects Score AND Coins
      if ((e.type === 'score' || e.type === 'coin') && hasMagnet) {
        const dx = player.x - Math.cos(e.angle) * e.dist;
        const dy = player.y - Math.sin(e.angle) * e.dist;
        if ((dx * dx + dy * dy) < 100000) {
            // Apply dt to magnet pulling force
            // 修复：大幅提高吸附速度，防止光点在玩家身后追赶（Trailing Issue）
            // dist: 0.2 -> 0.35, angle: 0.15 -> 0.45
            const isSafe = e.isSafety;
            const distFactor = isSafe ? 0.1 : 0.35; 
            const angleFactor = isSafe ? 0.1 : 0.45;

            e.dist += (player.radius - e.dist) * distFactor * dt;
            
            let diffAngle = player.angle - e.angle;
            while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
            while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
            
            e.angle += diffAngle * angleFactor * dt;
            
            if ((dx * dx + dy * dy) < 3000) magnetSucked = true;
        }
      }

      const ex = Math.cos(e.angle) * e.dist;
      const ey = Math.sin(e.angle) * e.dist;
      const distSq = (player.x - ex)**2 + (player.y - ey)**2;
      const isDirectHit = distSq < (player.size + e.size * e.scale)**2;

      if (isDirectHit || magnetSucked) {
        if (e.type === 'coin') {
             // Coin Collection
             refs.coinsRef.current += 1;
             ui.setRunCoins(refs.coinsRef.current);
             createExplosion(refs, ex, ey, COLORS.coin, 8, 8); 
             spawnFloatingText(refs, ex, ey, "+1 金币", COLORS.coin, 16);
             if (isDirectHit) { const boost = 15.0 + player.radius / 300; player.rVelocity = Math.max(player.rVelocity + boost, boost); }
             refs.entitiesRef.current.splice(i, 1);
        } else if (e.type === 'score') {
          refs.actionScoreRef.current += 10; createExplosion(refs, ex, ey, 'white', 8, 8); spawnFloatingText(refs, ex, ey, "+10", "#ffffff"); 
          
          // --- PLAY SOUND HERE ---
          audioManager.playScore();

          if (hasMagnet) {
              player.magnetCount = (player.magnetCount || 0) + 1;
              if (player.magnetCount >= 15) { player.magnetTime = 0; ui.setBuffs({ ...{ shield: player.shieldTime, magnet: 0, dash: player.dashTime } }); }
          }
          if (isDirectHit) { const boost = 15.0 + player.radius / 300; player.rVelocity = Math.max(player.rVelocity + boost, boost); }
          if (e.isSafety) e.active = false; else refs.entitiesRef.current.splice(i, 1);
        } else if (e.type === 'shield') {
          player.shieldTime = 400; triggerHaptic(8); 
          createExplosion(refs, ex, ey, COLORS.shield, 15); refs.entitiesRef.current.splice(i, 1);
        } else if (e.type === 'magnet') {
          player.magnetTime = 600; player.magnetCount = 0; triggerHaptic(8); 
          createExplosion(refs, ex, ey, COLORS.magnet, 15); refs.entitiesRef.current.splice(i, 1);
        } else if (e.type === 'dash') {
          player.dashTime = 150; triggerHaptic(8); 
          createExplosion(refs, ex, ey, COLORS.dash, 20); createShockwave(refs, ex, ey, COLORS.dash); refs.entitiesRef.current.splice(i, 1);
        } else if (e.type === 'nuke') {
          createExplosion(refs, ex, ey, COLORS.nuke, 20); createShockwave(refs, ex, ey, COLORS.nuke); refs.shake.current = 20;
          triggerHaptic([10, 10, 10, 10, 50, 20, 100]); 
          for (let j = refs.entitiesRef.current.length - 1; j >= 0; j--) {
              const t = refs.entitiesRef.current[j];
              if (t && t.type === 'enemy') {
                  const tx = Math.cos(t.angle) * t.dist; const ty = Math.sin(t.angle) * t.dist;
                  if (((ex - tx)**2 + (ey - ty)**2) < 500**2) {
                      createExplosion(refs, tx, ty, COLORS.enemy, 15); createShockwave(refs, tx, ty, COLORS.enemy);
                      spawnFloatingText(refs, tx, ty, "+50", COLORS.enemy, 32);
                      refs.entitiesRef.current.splice(j, 1); refs.actionScoreRef.current += 50; if (j < i) i--;
                  }
              }
          }
          refs.entitiesRef.current.splice(i, 1);
        } else if (e.type === 'enemy' && isDirectHit) {
            if (hasShield || hasDash || player.rVelocity > 0) {
                createExplosion(refs, ex, ey, COLORS.enemy, 20); createShockwave(refs, ex, ey, COLORS.enemy);
                triggerHaptic([12, 8, 25]); 
                spawnFloatingText(refs, ex, ey, "+50", COLORS.enemy, 32); refs.shake.current = 10; refs.entitiesRef.current.splice(i, 1); refs.actionScoreRef.current += 50; 
            } else actions.triggerDyingSequence();
        }
      }
    }

    refs.particlesRef.current.forEach((p, i) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= 0.038 * dt;
      if (p.life <= 0) refs.particlesRef.current.splice(i, 1);
    });
    refs.shockwavesRef.current.forEach((sw, i) => { 
        sw.radius += 15 * dt; 
        sw.life -= 0.038 * dt; 
        if (sw.life <= 0) refs.shockwavesRef.current.splice(i, 1); 
    });
    refs.floatingTextsRef.current.forEach((ft, i) => { 
        ft.y += ft.vy * dt; 
        ft.life -= 0.025 * dt; 
        if (ft.life <= 0) refs.floatingTextsRef.current.splice(i, 1); 
    });
    if (refs.shake.current > 0) refs.shake.current *= Math.pow(0.9, dt);
    
    ui.setBuffs({ shield: player.shieldTime, magnet: player.magnetTime, dash: player.dashTime });
};