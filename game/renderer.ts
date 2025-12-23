/*
 * 文件作用：负责 Canvas 的渲染和绘图逻辑
 * 注意：开头这段注释不得删除！！！
 */

import { GameRefs } from '../types';
import { COLORS } from '../constants';

// Helper for blinking/fading effects when buffs are expiring
// Input: timeLeft in Seconds
const getBuffVisualState = (timeLeft: number) => {
    // Stable if > 1.5 seconds
    if (timeLeft > 1.5) return { opacity: 1.0, pulse: 1.0 };
    
    // Fast blinking when < 1.0s, slower blinking when < 1.5s
    const speed = timeLeft < 1.0 ? 0.04 : 0.015; // Adjusted primarily for visual feel, speed is ms-based factor
    const wave = Math.sin(Date.now() * speed);
    
    // Opacity oscillates to indicate instability
    // Range: 0.3 to 1.0
    const opacity = 0.3 + 0.7 * (0.5 + 0.5 * wave);
    
    // Slight scale pulse to make it look unstable
    // Range: 0.95 to 1.05
    const pulse = 1.0 + 0.05 * wave;
    
    return { opacity, pulse };
};

export const drawGame = (refs: GameRefs) => {
    const canvas = refs.canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { width, height, cx, cy } = refs.dimensions.current;
    const player = refs.playerRef.current; 
    const cam = refs.cameraRef.current;
    const cfg = refs.configRef.current;
    
    // Check current theme
    const theme = refs.settingsRef.current.theme;
    const isChristmas = theme === 'christmas';

    // --- STEP 1: CLEAR CANVAS ---
    ctx.fillStyle = COLORS.background; 
    ctx.fillRect(0, 0, width, height);
    
    // Dying effect overlay
    if (refs.gameStateRef.current === 'DYING') {
        const prog = 1 - refs.deathTimerRef.current / refs.maxDeathTimerRef.current;
        const pulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
        const gradient = ctx.createRadialGradient(cx, cy, 100 * cam.zoom, cx, cy, Math.max(width, height) * 0.9);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, `rgba(180, 0, 0, ${prog * pulse * 0.5})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }
    
    // --- Christmas Ambience: Snow (Background Layer) ---
    if (isChristmas && refs.snowParticlesRef.current.length > 0) {
        // Draw in screen space (not affected by camera zoom, simulating distant background)
        ctx.fillStyle = 'white';
        refs.snowParticlesRef.current.forEach(snow => {
            ctx.globalAlpha = snow.opacity * 0.7;
            ctx.beginPath();
            ctx.arc(snow.x, snow.y, snow.radius, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1.0;
    }

    // --- STEP 2: WORLD TRANSFORM & ENTITIES ---
    ctx.save();
    ctx.translate(cx, cy);
    if (refs.shake.current > 0) ctx.translate((Math.random() - 0.5) * refs.shake.current, (Math.random() - 0.5) * refs.shake.current);
    ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.x, -cam.y);

    // Stars (Parallax handled here via inverse cam logic logic from original)
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); 
    refs.starsRef.current.forEach(star => {
        let px = (star.x - cam.x * 0.2 * cam.zoom) % width; let py = (star.y - cam.y * 0.2 * cam.zoom) % height;
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * (refs.gameStateRef.current === 'DYING' ? (refs.deathTimerRef.current/refs.maxDeathTimerRef.current) : 1)})`; 
        ctx.beginPath(); ctx.arc(px < 0 ? px + width : px, py < 0 ? py + height : py, star.size * (0.5 + cam.zoom * 0.5), 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();

    // Grid
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1 / cam.zoom; ctx.beginPath();
    const viewR = Math.max(width, height) / cam.zoom;
    for(let r = Math.floor(Math.max(100, player.radius - viewR) / 200) * 200; r < player.radius + viewR; r += 200) {
        ctx.moveTo(r, 0); ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    ctx.stroke();

    // Center Hub
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2);
    // 只有在非 GAMEOVER 状态下才显示红色警告闪烁
    const showWarning = player.centerTime > cfg.gameParams.centerSafeLimit && refs.gameStateRef.current !== 'GAMEOVER';
    ctx.fillStyle = showWarning ? (Math.floor(Date.now() / 100) % 2 === 0 ? '#ff0000' : '#500000') : '#333';
    ctx.fill(); ctx.stroke();

    if (refs.gameStateRef.current === 'START') { ctx.restore(); return; }

    // Shockwaves
    refs.shockwavesRef.current.forEach(sw => { ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2); ctx.strokeStyle = sw.color; ctx.lineWidth = (4 * sw.life) / cam.zoom; ctx.globalAlpha = sw.life; ctx.stroke(); ctx.globalAlpha = 1.0; });
    
    // Entities
    refs.entitiesRef.current.forEach(e => {
        if (!e || !e.active) return;
        const x = Math.cos(e.angle) * e.dist; const y = Math.sin(e.angle) * e.dist;
        // Optimization: Don't draw if out of camera view
        if (Math.abs((x - cam.x) * cam.zoom) > width/2 + 200 || Math.abs((y - cam.y) * cam.zoom) > height/2 + 200) return;
        
        ctx.save(); ctx.translate(x, y);
        ctx.globalAlpha = (refs.gameStateRef.current === 'DYING' ? (refs.deathTimerRef.current/refs.maxDeathTimerRef.current) : 1);
        
        ctx.shadowColor = e.color;
        ctx.shadowBlur = (e.type === 'score' || e.type === 'coin') ? 10 : 20;

        if (e.type === 'enemy') {
            ctx.rotate(e.rotation); ctx.fillStyle = e.color; ctx.beginPath();
            for(let i=0; i<8; i++) { let rot = Math.PI/4*i; ctx.lineTo(Math.cos(rot)*e.size*e.scale, Math.sin(rot)*e.size*e.scale); ctx.lineTo(Math.cos(rot+Math.PI/8)*e.size*e.scale*0.5, Math.sin(rot+Math.PI/8)*e.size*e.scale*0.5); }
            ctx.fill();
        } else if (e.type === 'coin') {
            if (isChristmas) {
                // --- Christmas Gift Box Logic ---
                const variant = e.styleVariant ?? 0;
                // Palette: Box Color + Ribbon Color
                const colors = [
                    { body: '#ef4444', ribbon: '#ffffff' }, // Red Box / White Ribbon (Classic)
                    { body: '#16a34a', ribbon: '#ef4444' }, // Green Box / Red Ribbon
                    { body: '#3b82f6', ribbon: '#fcd34d' }, // Blue Box / Gold Ribbon
                    { body: '#a855f7', ribbon: '#ffffff' }  // Purple Box / White Ribbon
                ];
                const themeColor = colors[variant % colors.length];
                
                // Override shadow color for colorful glow
                ctx.shadowColor = themeColor.body;
                ctx.shadowBlur = 15;

                // Increased size factor from 0.9 to 1.3 for even bigger gifts
                const sz = e.size * e.scale * 1.3; 

                // Box Body
                ctx.fillStyle = themeColor.body;
                ctx.beginPath();
                ctx.roundRect(-sz, -sz, sz * 2, sz * 2, 2);
                ctx.fill();

                // Ribbon Vertical
                ctx.fillStyle = themeColor.ribbon;
                ctx.fillRect(-sz * 0.3, -sz, sz * 0.6, sz * 2);

                // Ribbon Horizontal
                ctx.fillRect(-sz, -sz * 0.3, sz * 2, sz * 0.6);
                
                // Small Bow on Top (Simplified)
                ctx.fillStyle = themeColor.ribbon;
                ctx.beginPath();
                ctx.roundRect(-sz * 0.4, -sz * 1.3, sz * 0.8, sz * 0.4, 1);
                ctx.fill();

            } else {
                // --- Classic Coin Logic ---
                // 1. Draw Outer Coin Body (Gold) - Restored size
                ctx.fillStyle = e.color; // COLORS.coin
                ctx.beginPath(); 
                ctx.arc(0, 0, e.size * e.scale, 0, Math.PI * 2); 
                ctx.fill();

                // 2. Draw Inner Shine (Light Yellow)
                ctx.fillStyle = '#fff9c4'; 
                ctx.beginPath(); 
                ctx.arc(0, 0, e.size * e.scale * 0.5, 0, Math.PI * 2); 
                ctx.fill();
            }
        } else {
            // All other entities (score, buffs, etc.)
            ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(0, 0, e.size*e.scale, 0, Math.PI*2); ctx.fill();
            if (e.type !== 'score') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, e.size*e.scale*0.4, 0, Math.PI*2); ctx.fill(); }
        }
        ctx.restore();
    });
    ctx.globalAlpha = 1.0;

    // Particles
    refs.particlesRef.current.forEach((p, i) => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1.0; });
    
    // Floating Text
    refs.floatingTextsRef.current.forEach(ft => { ctx.globalAlpha = Math.max(0, ft.life); ctx.fillStyle = ft.color; ctx.font = `bold ${ft.size}px monospace`; ctx.textAlign = 'center'; ctx.fillText(ft.text, ft.x, ft.y); });
    ctx.globalAlpha = 1.0;

    // Player and Effects
    if (refs.gameStateRef.current !== 'GAMEOVER' && refs.gameStateRef.current !== 'DYING') {
        const time = Date.now();
        
        // Get visual states for buffs (blinking/pulsing)
        let { opacity: shieldOp, pulse: shieldPulse } = getBuffVisualState(player.shieldTime);
        
        // If shield has only 1 hit left, force instability regardless of time
        if (player.shieldHits === 1) {
            const warningPulse = Math.sin(time * 0.02);
            shieldOp = 0.4 + 0.6 * (0.5 + 0.5 * warningPulse); // Heavy blinking
            shieldPulse = 1.0 + 0.1 * warningPulse;
        }

        const { opacity: magnetOp, pulse: magnetPulse } = getBuffVisualState(player.magnetTime);

        // Danger Line
        if (player.radius < 3000) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(player.x, player.y); ctx.strokeStyle = `rgba(0, 210, 255, ${Math.max(0, (0.2 - player.radius / 3000))})`; ctx.stroke(); }
        
        // Trail Logic
        if (player.trail.length > 1) { 
            if (isChristmas) {
                // --- CHRISTMAS SCARF TRAIL ---
                const trail = player.trail;
                if (trail.length > 1) {
                    ctx.beginPath();
                    ctx.moveTo(trail[0].x, trail[0].y);
                    for (let i = 1; i < trail.length; i++) {
                        ctx.lineTo(trail[i].x, trail[i].y);
                    }
                    ctx.lineJoin = 'round';
                    ctx.lineCap = 'butt'; 
                    ctx.lineWidth = 12; 
                    ctx.strokeStyle = '#dc2626'; 
                    ctx.stroke();
                }
                const pTail = trail[0];
                const pNext = trail[1]; 
                if (pTail && pNext) {
                    const dx = pTail.x - pNext.x;
                    const dy = pTail.y - pNext.y;
                    const angle = Math.atan2(dy, dx);
                    ctx.save();
                    ctx.translate(pTail.x, pTail.y);
                    ctx.rotate(angle);
                    ctx.strokeStyle = '#dc2626';
                    ctx.lineWidth = 3; 
                    ctx.lineCap = 'round';
                    const fringeLen = 22; 
                    const fAngles = [-0.5, -0.2, 0.2, 0.5]; 
                    fAngles.forEach((a, idx) => {
                        const sway = Math.sin(time * 0.01 + idx) * 0.2;
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(Math.cos(a + sway) * fringeLen, Math.sin(a + sway) * fringeLen);
                        ctx.stroke();
                    });
                    ctx.restore();
                }
            } else {
                // --- CLASSIC NEON TRAIL ---
                ctx.beginPath(); 
                ctx.moveTo(player.trail[0].x, player.trail[0].y); 
                player.trail.forEach(t => ctx.lineTo(t.x, t.y)); 
                ctx.strokeStyle = player.color; 
                ctx.lineWidth = player.size * 0.8; 
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.stroke(); 
            }
            
            // 2. Draw Dash Trail Overlay (Shared)
            if (player.dashTime > 0) {
                const maxDashTime = cfg.buffs.dashDuration; // Use config duration for visual ratio
                const ratio = Math.max(0, Math.min(1, player.dashTime / maxDashTime));
                const visiblePoints = Math.ceil(player.trail.length * ratio);
                
                if (visiblePoints >= 2) {
                    const startIndex = player.trail.length - visiblePoints;
                    const dashTrail = player.trail.slice(startIndex);

                    ctx.beginPath();
                    ctx.moveTo(dashTrail[0].x, dashTrail[0].y);
                    dashTrail.forEach(t => ctx.lineTo(t.x, t.y));
                    
                    ctx.strokeStyle = COLORS.dash; 
                    ctx.lineWidth = player.size;
                    ctx.shadowColor = COLORS.dash;
                    ctx.shadowBlur = 15;
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }
            }
        }
        
        ctx.save();
        ctx.translate(player.x, player.y);

        // 1. MAGNET EFFECT (Gravity Well)
        if (player.magnetTime > 0) {
            ctx.save();
            ctx.scale(magnetPulse, magnetPulse);
            
            // Effect A: Inward sucking ripples
            const numRings = 3;
            const maxR = player.size + 60;
            ctx.strokeStyle = COLORS.magnet;
            ctx.lineWidth = 1.5;
            
            for(let i=0; i<numRings; i++) {
                const phase = (time / 500 + i / numRings) % 1; 
                const r = maxR * (1 - phase);
                const ringOp = Math.sin(phase * Math.PI); 
                
                ctx.beginPath();
                ctx.arc(0, 0, Math.max(0, r), 0, Math.PI*2);
                ctx.globalAlpha = magnetOp * ringOp * 0.8;
                ctx.stroke();
            }

            // Effect B: Outer Dashed Border
            ctx.beginPath();
            ctx.arc(0, 0, maxR, 0, Math.PI * 2);
            ctx.strokeStyle = COLORS.magnet;
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 10]);
            ctx.lineDashOffset = time * 0.05;
            ctx.globalAlpha = magnetOp;
            ctx.stroke();

            // Effect C: Core tint
            ctx.beginPath();
            ctx.arc(0, 0, maxR, 0, Math.PI * 2);
            ctx.fillStyle = COLORS.magnet;
            ctx.globalAlpha = magnetOp * 0.1;
            ctx.fill();

            ctx.restore();
        }

        // 2. DASH EFFECT (Solid Ring, No Flashing)
        if (player.dashTime > 0) {
            ctx.save();
            // No pulse scaling for stability
            
            // Simple Rotating Dashed Ring
            const ringSize = player.size + 10;
            ctx.beginPath();
            ctx.arc(0, 0, ringSize, 0, Math.PI * 2);
            ctx.strokeStyle = COLORS.dash;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([12, 12]);
            ctx.lineDashOffset = -time * 0.15; // Fast rotation for speed feel
            
            // Solid opacity for stability
            ctx.globalAlpha = 0.8;
            ctx.stroke();

            // Subtle fill
            ctx.beginPath();
            ctx.arc(0, 0, player.size + 5, 0, Math.PI * 2);
            ctx.fillStyle = COLORS.dash;
            ctx.globalAlpha = 0.1;
            ctx.fill();

            ctx.restore();
        }

        // 3. SHIELD EFFECT (Tech Hexagon Field)
        if (player.shieldTime > 0) {
            ctx.save();
            ctx.scale(shieldPulse, shieldPulse);
            
            const r = player.size + 18;
            
            // Hexagon Shape
            const sides = 6;
            ctx.beginPath();
            const angleOffset = time * 0.01;
            for (let i = 0; i <= sides; i++) {
                const theta = (i / sides) * 2 * Math.PI + angleOffset;
                const x = r * Math.cos(theta);
                const y = r * Math.sin(theta);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath();
            
            // Fill
            ctx.fillStyle = COLORS.shield;
            ctx.globalAlpha = shieldOp * 0.15;
            ctx.fill();
            
            // Outer Border
            ctx.lineWidth = 3;
            ctx.strokeStyle = COLORS.shield;
            ctx.globalAlpha = shieldOp * 0.8;
            ctx.stroke();
            
            // Inner Circle Accent
            ctx.beginPath();
            ctx.arc(0, 0, r - 5, 0, Math.PI * 2);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#ffffff';
            ctx.globalAlpha = shieldOp * 0.4;
            ctx.stroke();

            ctx.restore();
        }

        // 4. PLAYER BODY
        if (isChristmas) {
            // Christmas Theme: Side View Profile (Facing Forward)
            ctx.save();
            ctx.rotate(player.angle + Math.PI / 2);

            const scale = player.dashTime > 0 ? 1.4 : 1.2;
            ctx.scale(scale, scale);

            // 1. RUNNERS (Gold Skids) - Bottom of sleigh (+Y direction)
            ctx.fillStyle = '#fbbf24'; // Amber-400
            ctx.strokeStyle = '#d97706'; // Amber-600
            ctx.lineWidth = 1;

            // Main runner
            ctx.beginPath();
            ctx.moveTo(-12, 10); // Back
            ctx.lineTo(12, 10);  // Front
            ctx.bezierCurveTo(18, 10, 18, 0, 14, 0); // Curled tip
            // Thickness
            ctx.lineTo(13, 1);
            ctx.bezierCurveTo(16, 1, 16, 8, 12, 8); 
            ctx.lineTo(-12, 8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Legs
            ctx.fillRect(-8, 6, 2, 4);
            ctx.fillRect(6, 6, 2, 4);

            // 2. SLEIGH BODY (Red Carriage)
            ctx.fillStyle = '#dc2626'; // Red-600
            ctx.strokeStyle = '#fcd34d'; // Gold trim
            ctx.lineWidth = 1.5;

            ctx.beginPath();
            ctx.moveTo(-10, 6); 
            ctx.lineTo(8, 6);   
            ctx.quadraticCurveTo(14, 6, 14, 0); // Front nose
            ctx.lineTo(10, 0);  
            ctx.quadraticCurveTo(8, 4, 4, 4); // Cabin cutout
            ctx.lineTo(-10, 4); 
            ctx.quadraticCurveTo(-14, 4, -14, -2); // Backrest
            ctx.lineTo(-12, 6); 
            ctx.fill();
            
            // Gold Trim
            ctx.beginPath();
            ctx.moveTo(-10, 2);
            ctx.lineTo(10, 2);
            ctx.stroke();

            // 3. GIFT BAG (Green Sack)
            // Removed grey engine glow behind it
            ctx.fillStyle = '#16a34a'; // Green-600
            ctx.beginPath();
            ctx.arc(-8, -2, 5, 0, Math.PI * 2);
            ctx.fill();

            // 4. SANTA (Side Profile)
            // Body
            ctx.fillStyle = '#ef4444'; 
            ctx.beginPath();
            ctx.ellipse(0, 0, 5, 6, 0, 0, Math.PI*2);
            ctx.fill();

            // Head
            ctx.fillStyle = '#fdba74'; 
            ctx.beginPath();
            ctx.arc(2, -6, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Beard (Flowing back -X)
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath();
            ctx.moveTo(3, -5); 
            ctx.quadraticCurveTo(6, -2, 2, 0); 
            ctx.quadraticCurveTo(-2, -1, -5, -4); // Tip
            ctx.quadraticCurveTo(-2, -6, 0, -6); 
            ctx.fill();

            // Hat
            ctx.fillStyle = '#dc2626';
            ctx.beginPath();
            ctx.moveTo(0, -8); 
            ctx.lineTo(5, -8); 
            ctx.lineTo(-4, -12); // Tip blowing back
            ctx.lineTo(-2, -8);  
            ctx.fill();

            // Pompom
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(-4, -12, 1.5, 0, Math.PI*2);
            ctx.fill();
            
            // Brim
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.roundRect(-1, -9, 6, 2, 1);
            ctx.fill();

            // 5. NOSE LIGHT (Red Blinking)
            const blink = Math.sin(time * 0.02) > 0 ? 1 : 0.4;
            ctx.fillStyle = `rgba(255, 50, 50, ${blink})`;
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 8 * blink;
            ctx.beginPath();
            ctx.arc(14, 0, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.restore();
        } else {
            // Classic Theme: Circle
            ctx.beginPath(); 
            ctx.arc(0, 0, player.size, 0, Math.PI * 2); 
            
            // Simple body
            if (player.dashTime > 0) {
                ctx.fillStyle = '#ffffff'; 
                ctx.shadowColor = COLORS.dash;
                ctx.shadowBlur = 10; 
            } else {
                ctx.fillStyle = player.color;
                ctx.shadowBlur = 0;
            }
            ctx.fill();
        }
        
        ctx.restore();
    }
    ctx.restore();
};