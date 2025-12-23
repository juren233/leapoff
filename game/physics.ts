/*
 * 文件作用：游戏的核心物理循环逻辑（位置更新、碰撞检测、状态管理）
 * 注意：开头这段注释不得删除！！！
 */

import { GameRefs } from '../types';
import { COLORS } from '../constants';
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
    const cfg = refs.configRef.current;
    
    // --- AMBIENT UPDATES (Christmas Theme) ---
    // Only update visuals if theme is christmas and we have dimensions
    if (refs.settingsRef.current.theme === 'christmas') {
        const { width, height } = refs.dimensions.current;
        const time = Date.now() / 1000;
        
        // 1. Snow
        refs.snowParticlesRef.current.forEach(snow => {
            // Apply zoom factor inversely so snow looks like background
            // Or just keep it simple screen space
            snow.y += snow.speed * dt;
            // Sway motion
            snow.x += Math.sin(time + snow.swayOffset) * 0.5 * dt;

            // Loop
            if (snow.y > height + 10) {
                snow.y = -10;
                snow.x = Math.random() * width;
            }
            if (snow.x > width + 10) snow.x = -10;
            if (snow.x < -10) snow.x = width + 10;
        });
    }

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
        refs.bonusTimerRef.current -= dt / 60;
        ui.setBonusTimeLeft(refs.bonusTimerRef.current);
        
        if (refs.bonusTimerRef.current <= 0) {
            actions.endBonusMode();
        }
    } else {
        ui.setScoreDisplay(currentTotalScore);
        
        const nextThreshold = refs.lastBonusThresholdRef.current + cfg.gameParams.bonusScoreThreshold;
        if (currentTotalScore >= nextThreshold) {
            refs.lastBonusThresholdRef.current += cfg.gameParams.bonusScoreThreshold;
            actions.triggerBonusMode();
        }
    }

    // --- Buff Logic (Time-based now) ---
    const deltaSeconds = dt / 60;

    if (player.shieldTime > 0) {
        // Warning haptics when running low (at 1.0s and 0.0s)
        if (player.shieldTime > 1.0 && (player.shieldTime - deltaSeconds) <= 1.0) triggerHaptic([20, 20]);
        player.shieldTime -= deltaSeconds;
    }
    if (player.magnetTime > 0) player.magnetTime -= deltaSeconds;
    if (player.dashTime > 0) player.dashTime -= deltaSeconds;
    
    const hasShield = player.shieldTime > 0;
    const hasMagnet = player.magnetTime > 0;
    const hasDash = player.dashTime > 0;

    // Movement Physics
    // Calculate dynamic rotation speed:
    // Base Speed * Sqrt(BaseRadius / CurrentRadius)
    // This creates a smooth falloff where higher altitude = slower rotation
    const altitudeDamping = Math.sqrt(cfg.player.baseRadius / Math.max(cfg.player.baseRadius, player.radius));
    
    if (hasDash) {
        // Dash maintains high speed but still feels the altitude slightly
        const dashSpeed = cfg.player.dashRotSpeed * altitudeDamping;
        player.angle += dashSpeed * dt;
        player.rVelocity *= Math.pow(0.5, dt); 
    } else {
        if (refs.isPressing.current) {
             const currentRotSpeed = cfg.player.rotSpeed * altitudeDamping;
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

        // Use seconds instead of frame factor
        player.centerTime += deltaSeconds;
        
        if (player.centerTime > cfg.gameParams.centerSafeLimit) {
            ui.setCenterWarning(true);
            // Shake increases over 3 seconds to max ~9
            refs.shake.current = (player.centerTime - cfg.gameParams.centerSafeLimit) * 3; 
            if (player.centerTime > cfg.gameParams.centerDeathLimit) actions.triggerDyingSequence();
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
        if (player.trail.length > cfg.player.trailLength) player.trail.shift();
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

    // Fix: Pass dt to spawners to ensure consistent spawn rates
    spawnEntity(refs, dt);
    spawnInnerAmbience(refs, dt);

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

      // Magnet Logic
      const preEx = Math.cos(e.angle) * e.dist;
      const preEy = Math.sin(e.angle) * e.dist;
      const preDistSq = (player.x - preEx)**2 + (player.y - preEy)**2;
      const hitRadiusSq = (player.size + e.size * e.scale)**2;
      const wasHitNatural = preDistSq < hitRadiusSq;

      let magnetSucked = false;
      // Magnet affects Score AND Coins
      if ((e.type === 'score' || e.type === 'coin') && hasMagnet) {
        const dx = player.x - Math.cos(e.angle) * e.dist;
        const dy = player.y - Math.sin(e.angle) * e.dist;
        if ((dx * dx + dy * dy) < 100000) {
            // Apply dt to magnet pulling force
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
      const isDirectHit = distSq < hitRadiusSq;

      if (isDirectHit || magnetSucked) {
        if (e.type === 'coin') {
             // Coin Collection
             refs.coinsRef.current += 1;
             ui.setRunCoins(refs.coinsRef.current);
             createExplosion(refs, ex, ey, COLORS.coin, 8, 8); 
             spawnFloatingText(refs, ex, ey, "+1 金币", COLORS.coin, 16);
             // Use wasHitNatural to prevent magnet from launching the player
             if (wasHitNatural) { const boost = 15.0 + player.radius / 300; player.rVelocity = Math.max(player.rVelocity + boost, boost); }
             refs.entitiesRef.current.splice(i, 1);
        } else if (e.type === 'score') {
          refs.actionScoreRef.current += 10; createExplosion(refs, ex, ey, 'white', 8, 8); spawnFloatingText(refs, ex, ey, "+10", "#ffffff"); 
          
          audioManager.playScore();

          if (hasMagnet) {
              player.magnetCount = (player.magnetCount || 0) + 1;
              // Magnet Limitation Logic using Config
              if (player.magnetCount >= cfg.buffs.magnetMaxCount) { 
                  player.magnetTime = 0; // End magnet
                  ui.setBuffs({ ...{ shield: player.shieldTime, magnet: 0, dash: player.dashTime } }); 
              }
          }
          if (wasHitNatural) { const boost = 15.0 + player.radius / 300; player.rVelocity = Math.max(player.rVelocity + boost, boost); }
          if (e.isSafety) e.active = false; else refs.entitiesRef.current.splice(i, 1);
        } else if (e.type === 'shield') {
          // Shield Pickup
          player.shieldTime = cfg.buffs.shieldDuration; 
          player.shieldHits = cfg.buffs.shieldMaxHits;
          triggerHaptic(8); 
          createExplosion(refs, ex, ey, COLORS.shield, 15); refs.entitiesRef.current.splice(i, 1);
        } else if (e.type === 'magnet') {
          // Magnet Pickup
          player.magnetTime = cfg.buffs.magnetDuration; 
          player.magnetCount = 0; 
          triggerHaptic(8); 
          createExplosion(refs, ex, ey, COLORS.magnet, 15); refs.entitiesRef.current.splice(i, 1);
        } else if (e.type === 'dash') {
          // Dash Pickup
          player.dashTime = cfg.buffs.dashDuration; 
          triggerHaptic(8); 
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
                // Determine collision outcome
                let absorbHit = false;
                
                if (hasShield) {
                    player.shieldHits -= 1;
                    absorbHit = true;
                    if (player.shieldHits <= 0) {
                        player.shieldTime = 0; // Shield breaks
                        createShockwave(refs, player.x, player.y, COLORS.shield);
                        triggerHaptic([50, 100]); // Heavy hit feedback
                    } else {
                        triggerHaptic(30);
                    }
                } else if (hasDash) {
                    absorbHit = true; // Dash is invincible
                } else if (player.rVelocity > 0) {
                    absorbHit = true; // Jumping up kills enemies
                }

                if (absorbHit) {
                    createExplosion(refs, ex, ey, COLORS.enemy, 20); createShockwave(refs, ex, ey, COLORS.enemy);
                    if (!hasShield) triggerHaptic([12, 8, 25]); 
                    spawnFloatingText(refs, ex, ey, "+50", COLORS.enemy, 32); refs.shake.current = 10; refs.entitiesRef.current.splice(i, 1); refs.actionScoreRef.current += 50; 
                } else {
                    actions.triggerDyingSequence();
                }
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