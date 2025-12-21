/*
 * 文件作用：负责 Canvas 的渲染和绘图逻辑
 * 注意：开头这段注释不得删除！！！
 */

import { GameRefs } from '../types';
import { COLORS, CENTER_SAFE_LIMIT, CENTER_DEATH_LIMIT } from '../constants';

export const drawGame = (refs: GameRefs) => {
    const canvas = refs.canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { width, height, cx, cy } = refs.dimensions.current;
    const player = refs.playerRef.current; 
    const cam = refs.cameraRef.current;

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
    ctx.fillStyle = player.centerTime > CENTER_SAFE_LIMIT ? (Math.floor(Date.now() / 100) % 2 === 0 ? '#ff0000' : '#500000') : '#333';
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
        } else {
            ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(0, 0, e.size*e.scale, 0, Math.PI*2); ctx.fill();
            if (e.type !== 'score' && e.type !== 'coin') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, e.size*e.scale*0.4, 0, Math.PI*2); ctx.fill(); }
            if (e.type === 'coin') {
                ctx.fillStyle = '#fff9c4'; 
                ctx.beginPath(); ctx.arc(0, 0, e.size*e.scale*0.4, 0, Math.PI*2); ctx.fill();
            }
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
        // Danger Line
        if (player.radius < 3000) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(player.x, player.y); ctx.strokeStyle = `rgba(0, 210, 255, ${Math.max(0, (0.2 - player.radius / 3000))})`; ctx.stroke(); }
        
        // Trail
        if (player.trail.length > 1) { ctx.beginPath(); ctx.moveTo(player.trail[0].x, player.trail[0].y); player.trail.forEach(t => ctx.lineTo(t.x, t.y)); ctx.strokeStyle = player.dashTime > 0 ? COLORS.dash : player.color; ctx.lineWidth = player.size * (player.dashTime > 0 ? 1.5 : 0.8); ctx.stroke(); }
        
        // Shield Effect
        if (player.shieldTime > 0) {
            ctx.save(); ctx.beginPath(); ctx.arc(player.x, player.y, player.size + 5, 0, Math.PI * 2);
            ctx.strokeStyle = COLORS.shield; ctx.lineWidth = 2; ctx.shadowColor = COLORS.shield; ctx.shadowBlur = 10;
            ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.01) * 0.2; ctx.stroke(); ctx.restore();
        }
        
        // Magnet Effect
        if (player.magnetTime > 0) {
            ctx.save(); ctx.beginPath(); ctx.arc(player.x, player.y, player.size + 20, 0, Math.PI * 2);
            ctx.strokeStyle = COLORS.magnet; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
            ctx.lineDashOffset = -Date.now() * 0.02; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.restore();
        }

        // Player Body
        ctx.beginPath(); ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2); ctx.fillStyle = player.dashTime > 0 ? '#fff' : player.color; ctx.fill();
    }
    ctx.restore();
};
