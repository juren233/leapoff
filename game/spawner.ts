/*
 * 文件作用：负责生成游戏中的各种实体（敌人、金币、环境元素）
 * 注意：开头这段注释不得删除！！！
 */

import { GameRefs, EntityType, Entity } from '../types';
import { PLAYER_CONFIG, COLORS, MAX_ALTITUDE } from '../constants';
import { randomRange } from './utils';

export const spawnSafetyRing = (refs: GameRefs, orbitNum: number) => {
    if (refs.isBonusTimeRef.current) return;
    
    // Clean up old safety rings
    refs.entitiesRef.current = refs.entitiesRef.current.filter(e => e && !e.isSafety);
    
    let count = 40;
    if (orbitNum > 3) {
        const reduction = (orbitNum - 3) * 5;
        count = Math.max(0, 40 - reduction);
    }
    const ringRadius = PLAYER_CONFIG.baseRadius + 80;
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

export const spawnInnerAmbience = (refs: GameRefs) => {
    if (refs.isBonusTimeRef.current) return;
    if (refs.entitiesRef.current.length > 350) return;
    
    const SAFE_ZONE_RADIUS = PLAYER_CONFIG.baseRadius + 300;
    const currentInnerCount = refs.entitiesRef.current.filter(e => 
        e && e.type === 'score' && e.dist <= SAFE_ZONE_RADIUS && e.active
    ).length;

    if (refs.isFillingInnerZoneRef.current) {
        if (currentInnerCount >= 50) refs.isFillingInnerZoneRef.current = false;
    } else {
        if (currentInnerCount <= 20) refs.isFillingInnerZoneRef.current = true;
    }
    
    if (!refs.isFillingInnerZoneRef.current) return;
    if (Math.random() > 0.15) return;
    
    const dist = randomRange(PLAYER_CONFIG.baseRadius + 50, SAFE_ZONE_RADIUS);
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
};

export const spawnEntity = (refs: GameRefs) => {
    const maxEntities = 350; 
    if (refs.entitiesRef.current.length > maxEntities) return;
    
    const currentOrbit = refs.orbitRef.current;
    
    // Bonus Mode Spawning Logic
    if (refs.isBonusTimeRef.current) {
        if (Math.random() > 0.15) return; 
        const spawnDist = randomRange(PLAYER_CONFIG.baseRadius + 50, MAX_ALTITUDE - 200);
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
            isSafety: false
        });
        return;
    }

    // Normal Spawning Logic
    const spawnChance = Math.min(0.1, 0.0375 + (currentOrbit * 0.0025)); 
    if (Math.random() > spawnChance) return;

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

    const baseSpawn = Math.max(PLAYER_CONFIG.baseRadius + 50, playerRadius - 500);
    const ceilingSpawn = Math.min(playerRadius + 600, MAX_ALTITUDE - 200);
    if (baseSpawn > MAX_ALTITUDE) return;
    
    const spawnDist = randomRange(baseSpawn, ceilingSpawn);
    if (type === 'magnet' && spawnDist < PLAYER_CONFIG.baseRadius + 600) type = 'score';
    const ENEMY_SAFE_DIST = PLAYER_CONFIG.baseRadius + 300;
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
