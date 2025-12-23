/*
 * 文件作用：负责生成游戏中的各种实体（敌人、金币、环境元素）
 * 注意：开头这段注释不得删除！！！
 */

import { GameRefs, EntityType, Entity } from '../types';
import { COLORS } from '../constants';
import { randomRange } from './utils';

export const spawnSafetyRing = (refs: GameRefs, orbitNum: number) => {
    const cfg = refs.configRef.current;
    if (refs.isBonusTimeRef.current) return;
    
    // Clean up old safety rings
    refs.entitiesRef.current = refs.entitiesRef.current.filter(e => e && !e.isSafety);
    
    let count = 40;
    if (orbitNum > 3) {
        const reduction = (orbitNum - 3) * 5;
        count = Math.max(0, 40 - reduction);
    }
    const ringRadius = cfg.player.baseRadius + 80;
    for(let i=0; i<count; i++) {
        refs.entitiesRef.current.push({
            id: refs.entityIdCounter.current++,
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

export const spawnInnerAmbience = (refs: GameRefs, dt: number) => {
    const cfg = refs.configRef.current;
    if (refs.isBonusTimeRef.current) return;
    if (refs.entitiesRef.current.length > 350) return;
    
    const SAFE_ZONE_RADIUS = cfg.player.baseRadius + 300;
    const currentInnerCount = refs.entitiesRef.current.filter(e => 
        e && e.type === 'score' && e.dist <= SAFE_ZONE_RADIUS && e.active
    ).length;

    if (refs.isFillingInnerZoneRef.current) {
        if (currentInnerCount >= 50) refs.isFillingInnerZoneRef.current = false;
    } else {
        if (currentInnerCount <= 20) refs.isFillingInnerZoneRef.current = true;
    }
    
    if (!refs.isFillingInnerZoneRef.current) return;
    
    // --- TIME-BASED SPAWNING LOGIC ---
    // dt=1.0 at 60fps. dt/60 is approx seconds elapsed.
    refs.ambienceTimerRef.current += dt / 60;

    // Target Rate: 40 per second (Very fast fill) -> Interval = 0.025s
    const INTERVAL = 0.025; 

    // Use while loop to handle lag spikes or high rates, ensuring we spawn exact count
    while (refs.ambienceTimerRef.current >= INTERVAL) {
        refs.ambienceTimerRef.current -= INTERVAL;

        // Perform Spawn
        const dist = randomRange(cfg.player.baseRadius + 50, SAFE_ZONE_RADIUS);
        let type: EntityType = 'score';
        if (Math.random() < 0.02) {
            const r = Math.random();
            if (r < 0.33) type = 'shield';
            else if (r < 0.66) type = 'magnet';
            else type = 'dash';
            if (type === 'magnet') type = 'score';
        }

        const entity: Entity = {
            id: refs.entityIdCounter.current++,
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
        refs.entitiesRef.current.push(entity);
    }
};

export const spawnEntity = (refs: GameRefs, dt: number) => {
    const cfg = refs.configRef.current;
    // Hard limit on entities to prevent memory issues
    if (refs.entitiesRef.current.length > 350) return;
    
    // --- TIME-BASED ACCUMULATOR ---
    refs.spawnTimerRef.current += dt / 60; // Accumulate seconds

    let interval = 0.1; // Default fallback

    if (refs.isBonusTimeRef.current) {
        // 金币模式：极速生成 (约每秒 66 个)
        interval = 0.015;
    } else {
        // 普通模式平衡调整：
        // 目标：初始很快(爽感)，随分数和圈数增加逐渐变慢(防止过于混乱，增加博弈难度)
        
        const currentOrbit = refs.orbitRef.current;
        const currentScore = refs.actionScoreRef.current;

        // 基础间隔：0.06秒 (约每秒 16.6 个) - 起始非常快
        const baseInterval = 0.06;

        // 减速逻辑：
        // 1. 分数影响：每 2000 分，间隔增加 0.01秒
        const scoreSlowdown = (currentScore / 2000) * 0.01;
        
        // 2. 圈数影响：每增加 1 圈，间隔增加 0.015秒
        // (后期玩家移动速度快，生成太密容易必死)
        const orbitSlowdown = (currentOrbit * 0.015);

        interval = baseInterval + scoreSlowdown + orbitSlowdown;

        // 设定生成间隔上限（最慢 0.45秒生成一个，保证不会完全停止）
        // 约每秒 2.2 个保底
        interval = Math.min(0.45, interval);
    }

    // Process all due spawns
    while (refs.spawnTimerRef.current >= interval) {
        refs.spawnTimerRef.current -= interval;
        spawnSingleEntity(refs);
    }
};

// Extracted single spawn logic for cleaner loop
const spawnSingleEntity = (refs: GameRefs) => {
    const cfg = refs.configRef.current;
    const currentOrbit = refs.orbitRef.current;
    
    // Bonus Mode Logic
    if (refs.isBonusTimeRef.current) {
        const spawnDist = randomRange(cfg.player.baseRadius + 50, cfg.gameParams.maxAltitude - 200);
        refs.entitiesRef.current.push({
            id: refs.entityIdCounter.current++,
            type: 'coin',
            angle: randomRange(0, Math.PI * 2),
            dist: spawnDist,
            active: true,
            scale: 0,
            maxScale: 1,
            rotation: 0,
            moveSpeed: randomRange(0.001, 0.003) * (Math.random() > 0.5 ? 1 : -1),
            size: 12,
            color: COLORS.coin,
            isSafety: false,
            styleVariant: Math.floor(Math.random() * 4) // Random gift color 0-3
        });
        return;
    }

    // Normal Mode Type Selection
    const playerRadius = refs.playerRef.current.radius;
    let type: EntityType = 'score';

    if (currentOrbit >= 3) {
        if (Math.random() < 0.3) type = 'enemy';
        else {
            if (Math.random() < 0.25) {
                const rProp = Math.random();
                if (rProp < 0.1) type = 'magnet';      
                else if (rProp < 0.3) type = 'dash';   
                else if (rProp < 0.6) type = 'shield'; 
                else type = 'nuke';                    
            } else type = 'score';
        }
    } else {
        const difficultyFactor = refs.actionScoreRef.current / 5000;
        const enemyChance = Math.min(0.01 + difficultyFactor, 0.1);
        if (Math.random() < enemyChance) type = 'enemy';
        else {
            if (Math.random() < 0.15) { 
                const rProp = Math.random();
                if (rProp < 0.1) type = 'nuke';        
                else if (rProp < 0.3) type = 'dash';   
                else if (rProp < 0.5) type = 'magnet'; 
                else type = 'shield';                  
            } else type = 'score';
        }
    }

    const baseSpawn = Math.max(cfg.player.baseRadius + 50, playerRadius - 500);
    const ceilingSpawn = Math.min(playerRadius + 600, cfg.gameParams.maxAltitude - 200);
    if (baseSpawn > cfg.gameParams.maxAltitude) return;
    
    const spawnDist = randomRange(baseSpawn, ceilingSpawn);
    if (type === 'magnet' && spawnDist < cfg.player.baseRadius + 600) type = 'score';
    const ENEMY_SAFE_DIST = cfg.player.baseRadius + 300;
    if (type === 'enemy' && spawnDist < ENEMY_SAFE_DIST) type = 'score';

    const spawnAngle = randomRange(0, Math.PI * 2);
    if (type === 'enemy') {
        const ex = Math.cos(spawnAngle) * spawnDist;
        const ey = Math.sin(spawnAngle) * spawnDist;
        const dx = refs.playerRef.current.x - ex;
        const dy = refs.playerRef.current.y - ey;
        // Avoid spawning enemies too close to player
        if ((dx * dx + dy * dy) < 360000) return; 
    }

    refs.entitiesRef.current.push({
        id: refs.entityIdCounter.current++,
        type,
        angle: spawnAngle,
        dist: spawnDist,
        active: true,
        scale: 0,
        maxScale: 1,
        rotation: 0,
        moveSpeed: randomRange(0.0012, 0.0031) * (Math.random() > 0.5 ? 1 : -1),
        size: type === 'score' ? 12 : (type === 'enemy' ? 18 : 16),
        color: COLORS[type],
        isSafety: false
    });
};