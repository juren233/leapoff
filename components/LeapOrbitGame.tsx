/*
 * 文件作用：游戏主入口组件，负责组装各个游戏模块和UI状态管理
 * 注意：开头这段注释不得删除！！！
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Player, Entity, Particle, Shockwave, FloatingText, LeaderboardEntry, GameStateStatus, GameStats, GameRefs, Star } from '../types';
import { supabase } from '../lib/supabase';

// Modular Imports
import { PLAYER_CONFIG, COLORS, BONUS_DURATION_SECONDS } from '../constants';
import { GameHUD } from './ui/GameHUD';
import { StartScreen } from './ui/StartScreen';
import { GameOverModal } from './modals/GameOverModal';
import { AuthModal } from './modals/AuthModal';
import { LeaderboardModal } from './modals/LeaderboardModal';

import { useGameSync } from '../hooks/useGameSync';
import { updateGame, GameActions, UiSetters } from '../game/physics';
import { drawGame } from '../game/renderer';
import { spawnSafetyRing } from '../game/spawner';
import { randomRange, formatTime, triggerHaptic, calculateCurrentTotalScore, createExplosion, createShockwave, initStars } from '../game/utils';
import { audioManager } from '../game/audio';

export const LeapOrbitGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- React State for UI ---
  const [scoreDisplay, setScoreDisplay] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [uiGameState, setUiGameState] = useState<GameStateStatus>('START');
  const [buffs, setBuffs] = useState({ shield: 0, magnet: 0, dash: 0 });
  const [centerWarning, setCenterWarning] = useState(false);
  const [orbitCountDisplay, setOrbitCountDisplay] = useState(1);
  const [totalCoins, setTotalCoins] = useState(0);
  const [runCoins, setRunCoins] = useState(0);
  const [isBonusTimeUI, setIsBonusTimeUI] = useState(false);
  const [bonusTimeLeft, setBonusTimeLeft] = useState(0);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // --- Mutable Game State Refs ---
  const gameStateRef = useRef<GameStateStatus>('START');
  const actionScoreRef = useRef(0);
  const orbitRef = useRef(1);
  const gameStartTimeRef = useRef(0);
  const gameEndTimeRef = useRef<number | null>(null);
  const isFillingInnerZoneRef = useRef(true);
  const deathTimerRef = useRef(0);
  const maxDeathTimerRef = useRef(180);
  const coinsRef = useRef(0);
  const lastBonusThresholdRef = useRef(0);
  const isBonusTimeRef = useRef(false);
  const bonusTimerRef = useRef(0);
  const frameId = useRef<number>(0);
  const isPressing = useRef<boolean>(false);
  const shake = useRef<number>(0);
  const dimensions = useRef({ width: 0, height: 0, cx: 0, cy: 0 });
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
  const playerRef = useRef<Player>({
      angle: 0, radius: PLAYER_CONFIG.baseRadius, baseRadius: PLAYER_CONFIG.baseRadius, leapLimit: 999999,
      rVelocity: 0, accelOut: PLAYER_CONFIG.accelOut, gravity: PLAYER_CONFIG.gravity, drag: PLAYER_CONFIG.drag,
      rotSpeed: PLAYER_CONFIG.rotSpeed, size: PLAYER_CONFIG.size, color: COLORS.player, x: 0, y: 0,
      trail: [], shieldTime: 0, magnetTime: 0, magnetCount: 0, dashTime: 0, centerTime: 0, trailAccumulator: 0
  });
  const entitiesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const starsRef = useRef<Star[]>([]);
  const entityIdCounter = useRef(0);
  
  // Sync Refs
  const totalCoinsRef = useRef(0);
  const highScoreRef = useRef(0);
  const hasSyncedToServerRef = useRef(false);
  const isSyncingRef = useRef(false);

  const [gameStats, setGameStats] = useState<GameStats>({
      duration: 0, formattedDuration: '0分0秒', finalOrbit: 1, actionScore: 0,
      timeScore: 0, orbitBonus: 0, multiplier: 1.0, coinsCollected: 0
  });

  // Keep refs synced
  useEffect(() => { totalCoinsRef.current = totalCoins; highScoreRef.current = highScore; }, [totalCoins, highScore]);

  // --- Custom Hooks ---
  const {
      session, uploadStatus, systemStatus, setUploadStatus,
      showAuthModal, setShowAuthModal, authMode, setAuthMode,
      authEmail, setAuthEmail, authPassword, setAuthPassword,
      authUsername, setAuthUsername, authLoading, authError,
      fetchUserData, syncData, handleAuth, handleLogout
  } = useGameSync(totalCoins, setTotalCoins, setHighScore, setRunCoins, totalCoinsRef, hasSyncedToServerRef, isSyncingRef);

  // --- Game Refs Object (passed to modules) ---
  const refs: GameRefs = useMemo(() => ({
      canvasRef, containerRef, gameStateRef, actionScoreRef, orbitRef, gameStartTimeRef, gameEndTimeRef,
      isFillingInnerZoneRef, deathTimerRef, maxDeathTimerRef, coinsRef, lastBonusThresholdRef, isBonusTimeRef,
      bonusTimerRef, frameId, isPressing, shake, dimensions, cameraRef, playerRef, entitiesRef, particlesRef,
      shockwavesRef, floatingTextsRef, starsRef, entityIdCounter, totalCoinsRef, highScoreRef,
      hasSyncedToServerRef, isSyncingRef
  }), []);

  // --- Game Control Logic ---

  const initGame = useCallback(() => {
      playerRef.current = {
          ...playerRef.current,
          angle: 0, radius: PLAYER_CONFIG.baseRadius + 140, rVelocity: 0, gravity: PLAYER_CONFIG.gravity,
          shieldTime: 0, magnetTime: 0, magnetCount: 0, dashTime: 0, centerTime: 0, trail: [], x: 0, y: 0, trailAccumulator: 0
      };
      entitiesRef.current = [];
      particlesRef.current = [];
      shockwavesRef.current = [];
      floatingTextsRef.current = [];
      actionScoreRef.current = 0;
      orbitRef.current = 1;
      
      coinsRef.current = 0;
      setRunCoins(0);
      hasSyncedToServerRef.current = false;
      isSyncingRef.current = false;
      lastBonusThresholdRef.current = 0;
      isBonusTimeRef.current = false;
      bonusTimerRef.current = 0;
      setIsBonusTimeUI(false);

      gameStartTimeRef.current = Date.now();
      gameEndTimeRef.current = null;
      isFillingInnerZoneRef.current = true;
      cameraRef.current = { x: 0, y: 0, zoom: 1 };
      setScoreDisplay(0);
      setOrbitCountDisplay(1);
      setBuffs({ shield: 0, magnet: 0, dash: 0 });
      setCenterWarning(false);
      isPressing.current = false;
      spawnSafetyRing(refs, 1);
      setUploadStatus({status: 'idle', msg: ''});
  }, [refs, setUploadStatus]);

  const startGame = () => {
      // 即使 BGM 已经在播放，这里再调一次 resume 确保万无一失
      audioManager.resume();
      initGame();
      gameStateRef.current = 'PLAYING';
      setUiGameState('PLAYING');
  };

  const triggerBonusMode = useCallback(() => {
      isBonusTimeRef.current = true;
      // Initialize with SECONDS (10s) directly
      bonusTimerRef.current = BONUS_DURATION_SECONDS;
      setIsBonusTimeUI(true);
      
      // Use configured Bonus Gravity from constants
      playerRef.current.gravity = PLAYER_CONFIG.bonusGravity;
      
      shake.current = 10;
      triggerHaptic([50, 50, 50, 50, 200]);
      createShockwave(refs, 0, 0, COLORS.coin);
      
      entitiesRef.current.forEach(e => {
          if (e.isSafety) {
              e.active = false;
          } else if (e.active && e.type !== 'coin') {
              e.type = 'coin';
              e.color = COLORS.coin;
              e.size = 12;
              e.scale = 0; 
              createExplosion(refs, Math.cos(e.angle)*e.dist, Math.sin(e.angle)*e.dist, COLORS.coin, 5, 5);
          }
      });
  }, [refs]);

  const endBonusMode = useCallback(() => {
      if (!isBonusTimeRef.current) return;
      isBonusTimeRef.current = false;
      setIsBonusTimeUI(false);
      triggerHaptic(50);
      
      // Reset gravity to normal
      playerRef.current.gravity = PLAYER_CONFIG.gravity;
      
      entitiesRef.current = entitiesRef.current.filter(e => e.type !== 'coin');
      spawnSafetyRing(refs, orbitRef.current);
      isFillingInnerZoneRef.current = true;
  }, [refs]);

  const triggerDyingSequence = useCallback(() => {
      if (gameStateRef.current === 'DYING' || gameStateRef.current === 'GAMEOVER') return;
      gameEndTimeRef.current = Date.now();
      gameStateRef.current = 'DYING';
      setUiGameState('DYING');
      
      const finalScore = calculateCurrentTotalScore(gameEndTimeRef.current, gameStartTimeRef.current, orbitRef.current, actionScoreRef.current);
      setScoreDisplay(finalScore);
      syncData(finalScore, coinsRef.current);

      deathTimerRef.current = maxDeathTimerRef.current; 
      shake.current = 15; 
      triggerHaptic([40, 30, 80, 30, 500]);
      const player = playerRef.current;
      createExplosion(refs, player.x, player.y, COLORS.player, 40, 15);
      createShockwave(refs, player.x, player.y, COLORS.player);
  }, [syncData, refs]);

  const handleGameOver = useCallback(() => {
      gameStateRef.current = 'GAMEOVER';
      
      // 移除了 audioManager.stopBGM()，让BGM一直播放

      const finalTime = (gameEndTimeRef.current || Date.now()) - gameStartTimeRef.current;
      
      entitiesRef.current.forEach(e => {
          if (e && e.active) {
              const ex = Math.cos(e.angle) * e.dist;
              const ey = Math.sin(e.angle) * e.dist;
              createShockwave(refs, ex, ey, e.color);
              createExplosion(refs, ex, ey, e.color, 5, 8); 
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
          multiplier: 1 + (orbitRef.current - 1) * 0.1,
          coinsCollected: coinsRef.current
      });
      setTimeout(() => setUiGameState('GAMEOVER'), 1000);
  }, [refs]);

  // Actions & Setters Bundles
  const gameActions: GameActions = useMemo(() => ({
      triggerBonusMode, endBonusMode, triggerDyingSequence, handleGameOver
  }), [triggerBonusMode, endBonusMode, triggerDyingSequence, handleGameOver]);

  const uiSetters: UiSetters = useMemo(() => ({
      setScoreDisplay, setOrbitCountDisplay, setBuffs, setCenterWarning, setBonusTimeLeft, setRunCoins
  }), []);

  // --- Main Loop with Delta Time ---
  const lastFrameTime = useRef<number>(0);

  const loop = useCallback((timestamp: number) => {
      if (!lastFrameTime.current) lastFrameTime.current = timestamp;

      // Calculate elapsed time since last frame
      const delta = timestamp - lastFrameTime.current;
      lastFrameTime.current = timestamp;

      // Convert to "Delta Time" factor relative to 60 FPS
      let dt = delta / (1000 / 60);

      // Cap dt to prevent massive jumps
      if (dt > 4) dt = 4;

      // Update Game Logic with dt
      updateGame(refs, gameActions, uiSetters, dt);

      // Render
      drawGame(refs);
      
      frameId.current = requestAnimationFrame(loop);
  }, [refs, gameActions, uiSetters]);

  useEffect(() => {
      const handleResize = () => {
          if (containerRef.current && canvasRef.current) {
              const { clientWidth, clientHeight } = containerRef.current;
              canvasRef.current.width = clientWidth; 
              canvasRef.current.height = clientHeight;
              dimensions.current = { width: clientWidth, height: clientHeight, cx: clientWidth / 2, cy: clientHeight / 2 };
              initStars(refs, clientWidth, clientHeight);
          }
      };
      window.addEventListener('resize', handleResize); handleResize();
      
      lastFrameTime.current = 0;
      frameId.current = requestAnimationFrame(loop);

      return () => { window.removeEventListener('resize', handleResize); cancelAnimationFrame(frameId.current); };
  }, [loop, refs]);

  // --- Global Audio Starter & Unlocker ---
  useEffect(() => {
      // 1. 加载组件时，无论如何先调用 playBGM。
      // 它会开始下载和解码。如果浏览器允许自动播放，声音会直接出来。
      // 如果不允许，声音会在后台播放进度（无声），直到下面的交互事件触发 resume。
      audioManager.playBGM();

      // 2. 激进的“解锁”策略：监听所有微小的交互。
      // 只要用户动了鼠标、点了屏幕、或者按了键盘，就立即恢复 AudioContext。
      const unlockAudio = () => {
          audioManager.resume();
      };
      
      // 使用 capture: true 确保尽早捕获
      const opts = { capture: true, passive: true };

      window.addEventListener('click', unlockAudio, opts);
      window.addEventListener('touchstart', unlockAudio, opts);
      window.addEventListener('keydown', unlockAudio, opts);
      // 新增：鼠标移动也触发！这会让桌面端体验接近“自动播放”
      window.addEventListener('mousemove', unlockAudio, opts);

      return () => {
          window.removeEventListener('click', unlockAudio, opts);
          window.removeEventListener('touchstart', unlockAudio, opts);
          window.removeEventListener('keydown', unlockAudio, opts);
          window.removeEventListener('mousemove', unlockAudio, opts);
      };
  }, []);

  // --- Event Listeners ---
  useEffect(() => {
      const canvas = canvasRef.current;
      if(canvas) {
          const prevent = (e: any) => e.preventDefault();
          canvas.addEventListener('touchstart', (e) => { prevent(e); isPressing.current = true; }, { passive: false });
          canvas.addEventListener('touchend', () => isPressing.current = false);
          canvas.addEventListener('mousedown', () => isPressing.current = true);
          window.addEventListener('mouseup', () => isPressing.current = false);
      }
  }, []);

  // --- Session & Auto-Sync Effect ---
  useEffect(() => {
      if (session?.user) {
          if (uiGameState === 'GAMEOVER') {
              if (!hasSyncedToServerRef.current && !isSyncingRef.current) {
                  const timer = setTimeout(() => syncData(scoreDisplay, coinsRef.current), 200);
                  return () => clearTimeout(timer);
              }
          } else {
              fetchUserData(session.user.id);
          }
      }
  }, [session, uiGameState, scoreDisplay, fetchUserData, syncData, hasSyncedToServerRef, isSyncingRef, coinsRef]);

  // --- Auxiliary Logic ---
  const fetchLeaderboard = async () => {
      setLeaderboardLoading(true);
      try {
        const { data, error } = await supabase
          .from('high_scores').select('username, score, created_at').order('score', { ascending: false }).limit(10);
        if (error && error.code !== '42P01') throw error;
        setLeaderboardData(data || []);
      } catch (err: any) { setLeaderboardData([]); } finally { setLeaderboardLoading(false); }
  };
  const openLeaderboard = () => { setShowLeaderboard(true); fetchLeaderboard(); };
  const openShop = () => { alert("新建文件夹中…\n你别急😁"); };

  return (
    <div ref={containerRef} className="relative w-full h-full font-sans select-none overflow-hidden bg-black touch-none">
        <GameHUD
            uiGameState={uiGameState} buffs={buffs} totalCoins={totalCoins} runCoins={runCoins}
            orbitCountDisplay={orbitCountDisplay} scoreDisplay={scoreDisplay} isBonusTimeUI={isBonusTimeUI} bonusTimeLeft={bonusTimeLeft}
        />
        {uiGameState === 'START' && (
            <StartScreen
                session={session} totalCoins={totalCoins} systemStatus={systemStatus} onStart={startGame}
                onLogout={handleLogout} onAuthOpen={() => setShowAuthModal(true)} onLeaderboardOpen={openLeaderboard} onShopOpen={openShop}
            />
        )}
        {showAuthModal && (
            <AuthModal
                authMode={authMode} setAuthMode={setAuthMode} authUsername={authUsername} setAuthUsername={setAuthUsername}
                authEmail={authEmail} setAuthEmail={setAuthEmail} authPassword={authPassword} setAuthPassword={setAuthPassword}
                authLoading={authLoading} authError={authError} onSubmit={handleAuth} onClose={() => setShowAuthModal(false)}
            />
        )}
        {showLeaderboard && (
            <LeaderboardModal loading={leaderboardLoading} data={leaderboardData} onClose={() => setShowLeaderboard(false)} />
        )}
        {uiGameState === 'GAMEOVER' && (
            <GameOverModal
                scoreDisplay={scoreDisplay} highScore={highScore} gameStats={gameStats} uploadStatus={uploadStatus}
                session={session} onLeaderboardOpen={openLeaderboard} onRestart={startGame} onSync={() => syncData(scoreDisplay, runCoins)}
                onAuthOpen={() => setShowAuthModal(true)}
            />
        )}
        <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair active:cursor-grabbing" />
    </div>
  );
};