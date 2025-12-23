/*
 * 文件作用：游戏主入口组件，负责组装各个游戏模块和UI状态管理
 * 注意：开头这段注释不得删除！！！
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Player, Entity, Particle, Shockwave, FloatingText, LeaderboardEntry, GameStateStatus, GameStats, GameRefs, Star, GameSettings, SnowParticle, ThemeData, GameConfig } from '../types';
import { supabase } from '../lib/supabase';

// Modular Imports
import { COLORS, THEME_CACHE_KEY, DEFAULT_BGM_URL, DEFAULT_GAME_CONFIG, CONFIG_CACHE_KEY } from '../constants';
import { GameHUD } from './ui/GameHUD';
import { StartScreen } from './ui/StartScreen';
import { LoadingScreen } from './ui/LoadingScreen'; // New Import
import { GameOverModal } from './modals/GameOverModal';
import { AuthModal } from './modals/AuthModal';
import { LeaderboardModal } from './modals/LeaderboardModal';
import { SettingsModal } from './modals/SettingsModal';

import { useGameSync } from '../hooks/useGameSync';
import { updateGame, GameActions, UiSetters } from '../game/physics';
import { drawGame } from '../game/renderer';
import { spawnSafetyRing } from '../game/spawner';
import { randomRange, formatTime, triggerHaptic, calculateCurrentTotalScore, createExplosion, createShockwave, initStars, setVibrationEnabled } from '../game/utils';
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
  
  // Modals
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // [关键修复]: 使用 Ref 记录组件初始化瞬间是否有本地缓存。
  const hasSavedSettingsRef = useRef(!!localStorage.getItem('leap_orbit_settings'));
  
  // [New Feature]: 统一资源加载状态管理
  const [loadingState, setLoadingState] = useState<{ visible: boolean; type: 'initial' | 'refresh' }>(() => {
      // 初始化时，如果本地没有存档，认为是 Initial Mode，否则是 Refresh Mode
      // 无论哪种情况，Mount 时都默认显示 Loading
      return {
          visible: true,
          type: hasSavedSettingsRef.current ? 'refresh' : 'initial'
      };
  });

  // Settings State with LocalStorage
  const [settings, setSettings] = useState<GameSettings>(() => {
    const saved = localStorage.getItem('leap_orbit_settings');
    // 如果没有本地保存的设置，使用 'classic' 作为临时占位符
    return saved ? JSON.parse(saved) : { bgmEnabled: true, sfxEnabled: true, vibrationEnabled: true, theme: 'classic' };
  });

  // [New] State to hold available themes
  const [availableThemes, setAvailableThemes] = useState<ThemeData[]>([]);

  // [New] Cloud Config Ref
  // Level 3 Fallback: Hardcoded Default (Start with this to ensure non-null)
  const configRef = useRef<GameConfig>(DEFAULT_GAME_CONFIG);

  // Settings Ref for access in render loop
  const settingsRef = useRef<GameSettings>(settings);

  // [配置加载逻辑 1] 定义云端拉取函数
  const fetchGameConfig = useCallback(async () => {
      try {
          const { data: remoteConfig } = await supabase
              .from('game_configs')
              .select('version_name, config')
              .eq('is_active', true)
              .single();
          
          if (remoteConfig && remoteConfig.config) {
               const mergedConfig = {
                   player: { ...DEFAULT_GAME_CONFIG.player, ...(remoteConfig.config.player || {}) },
                   buffs: { ...DEFAULT_GAME_CONFIG.buffs, ...(remoteConfig.config.buffs || {}) },
                   gameParams: { ...DEFAULT_GAME_CONFIG.gameParams, ...(remoteConfig.config.gameParams || {}) }
               };
               
               configRef.current = mergedConfig;
               
               localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({
                   version_name: remoteConfig.version_name,
                   config: mergedConfig
               }));

               console.log(`%c[配置更新] 来源: 云端同步 | 版本: ${remoteConfig.version_name}`, 'color: #00d2ff; font-weight: bold; background: #222; padding: 2px 4px; border-radius: 2px;');
          }
      } catch (err) {
          console.warn("%c[配置更新] 云端同步失败或超时，维持当前配置", 'color: red');
      }
  }, []);

  // [主题加载逻辑] 定义云端拉取函数
  const fetchThemes = useCallback(async () => {
      try {
          const { data: themes } = await supabase
              .from('game_themes')
              .select('*')
              .eq('is_visible', true)
              .order('sort_order', { ascending: true });
          
          if (themes && themes.length > 0) {
              setAvailableThemes(themes);
              localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(themes));

              // 校验当前主题有效性 (使用 ref 获取最新设置)
              const currentThemeId = settingsRef.current.theme;
              const isValid = themes.some(t => t.id === currentThemeId);

              // 寻找数据库建议的默认主题
              const dbDefaultTheme = themes.find(t => t.is_default) || themes.find(t => t.id === 'classic') || themes[0];

              if (!isValid) {
                  // 如果当前主题无效（被删除），强制切回默认
                  setSettings(prev => ({ ...prev, theme: dbDefaultTheme.id }));
                  console.log(`%c[主题修正] 主题无效，重置为: ${dbDefaultTheme.name}`, 'color: yellow;');
              } else if (!hasSavedSettingsRef.current) {
                  // 如果是全新用户（无本地存档），强制使用云端配置的默认主题
                  // 这样运营可以在后台动态配置哪个是默认，新用户就看到哪个
                  if (dbDefaultTheme.id !== currentThemeId) {
                       setSettings(prev => ({ ...prev, theme: dbDefaultTheme.id }));
                  }
              }

              console.log(`%c[主题更新] 来源: 云端同步 | 数量: ${themes.length}`, 'color: #d946ef; font-weight: bold; background: #222; padding: 2px 4px; border-radius: 2px;');
          }
      } catch (err) {
          console.warn("%c[主题更新] 云端同步失败", 'color: red');
      }
  }, []);

  // [配置加载逻辑 2] 初始化：加载本地缓存 (只运行一次)
  useEffect(() => {
      // 1. 同步加载本地缓存 (Level 2 Fallback)
      try {
          const cachedConfigStr = localStorage.getItem(CONFIG_CACHE_KEY);
          if (cachedConfigStr) {
              const cachedData = JSON.parse(cachedConfigStr);
              const configData = cachedData.config || cachedData;
              const versionName = cachedData.version_name || '本地旧版';

              configRef.current = { 
                  player: { ...DEFAULT_GAME_CONFIG.player, ...(configData.player || {}) },
                  buffs: { ...DEFAULT_GAME_CONFIG.buffs, ...(configData.buffs || {}) },
                  gameParams: { ...DEFAULT_GAME_CONFIG.gameParams, ...(configData.gameParams || {}) }
              };
              console.log(`%c[配置加载] 来源: 本地缓存 | 版本: ${versionName}`, 'color: orange; font-weight: bold; background: #222; padding: 2px 4px; border-radius: 2px;');
          } else {
              console.log(`%c[配置加载] 来源: 内置备份 | 版本: 基础默认`, 'color: grey; font-weight: bold; background: #222; padding: 2px 4px; border-radius: 2px;');
          }

          // 加载本地主题缓存
          const cachedThemes = localStorage.getItem(THEME_CACHE_KEY);
          if (cachedThemes) setAvailableThemes(JSON.parse(cachedThemes));

      } catch(e) {
          console.warn("Local storage parse error, strictly using defaults.");
      }

      // 2. 首次加载 (Initial Load or Refresh) - 拉取云端数据
      const performStartupFetch = async () => {
           // 无论是否首次，只要进入页面，都进行一次云端拉取
           // 配合 LoadingScreen 显示
           await Promise.all([
               fetchGameConfig(), 
               fetchThemes(),
               new Promise(r => setTimeout(r, 1200)) // 至少展示1.2秒，避免闪烁
           ]);
           
           // 加载完成，淡出Loading
           setLoadingState(prev => ({ ...prev, visible: false }));
      };

      performStartupFetch();
  }, []); 

  // Apply Settings to Audio Manager & Vibration Utility
  useEffect(() => {
    settingsRef.current = settings; // Keep ref synced
    
    // Audio Settings
    audioManager.setBgmMute(!settings.bgmEnabled);
    audioManager.setSfxMute(!settings.sfxEnabled);
    
    // [Dynamic BGM Logic]
    let targetBgm = DEFAULT_BGM_URL;
    const themesToSearch = availableThemes.length > 0 
        ? availableThemes 
        : (() => {
            const c = localStorage.getItem(THEME_CACHE_KEY);
            return c ? JSON.parse(c) : [];
          })();

    const currentThemeData = themesToSearch.find((t: any) => t.id === settings.theme);
    if (currentThemeData && currentThemeData.bgm_url) {
        targetBgm = currentThemeData.bgm_url;
    }
    
    // [关键修复]：确保在加载结束后正确切换或恢复音乐
    if (settings.bgmEnabled && !loadingState.visible) {
        // 如果当前正在播放的已经是目标曲目
        if (audioManager.currentBgmUrl === targetBgm) {
             // 渐入恢复音量 (可能是从 loading 的 fadeOut 状态恢复)
             // 这里的 1.5s 确保淡入非常平滑
             audioManager.fadeIn(1.5);
        } else {
             // 否则，切换新曲目 (playBGM 内部会处理播放)
             audioManager.playBGM(targetBgm);
        }
    }
    
    setVibrationEnabled(settings.vibrationEnabled !== undefined ? settings.vibrationEnabled : true);
    localStorage.setItem('leap_orbit_settings', JSON.stringify(settings));
  }, [settings, availableThemes, loadingState.visible]); 

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
      angle: 0, 
      radius: DEFAULT_GAME_CONFIG.player.baseRadius, 
      baseRadius: DEFAULT_GAME_CONFIG.player.baseRadius, 
      leapLimit: 999999,
      rVelocity: 0, 
      accelOut: DEFAULT_GAME_CONFIG.player.accelOut, 
      gravity: DEFAULT_GAME_CONFIG.player.gravity, 
      drag: DEFAULT_GAME_CONFIG.player.drag, 
      rotSpeed: DEFAULT_GAME_CONFIG.player.rotSpeed, 
      size: DEFAULT_GAME_CONFIG.player.size, 
      color: COLORS.player, x: 0, y: 0,
      trail: [], shieldTime: 0, shieldHits: 0, magnetTime: 0, magnetCount: 0, dashTime: 0, centerTime: 0, trailAccumulator: 0
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

  // Spawn Timer Refs
  const spawnTimerRef = useRef(0);
  const ambienceTimerRef = useRef(0);

  // Ambient Refs
  const snowParticlesRef = useRef<SnowParticle[]>([]);

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
      hasSyncedToServerRef, isSyncingRef, settingsRef, configRef, spawnTimerRef, ambienceTimerRef,
      snowParticlesRef
  }), []);

  // Initialize Snow Particles
  const initSnow = useCallback((width: number, height: number) => {
      const count = 100; // Number of snowflakes
      const snow: SnowParticle[] = [];
      for (let i = 0; i < count; i++) {
          snow.push({
              x: Math.random() * width,
              y: Math.random() * height,
              radius: Math.random() * 2 + 1,
              speed: Math.random() * 1.5 + 0.5,
              opacity: Math.random() * 0.5 + 0.2,
              swayOffset: Math.random() * Math.PI * 2
          });
      }
      snowParticlesRef.current = snow;
  }, []);

  // --- Game Control Logic ---

  const initGame = useCallback(() => {
      // Use latest config for initialization
      // At this point, configRef.current holds either Default, Local, or Cloud (if fetch finished)
      // This satisfies the "Timeout condition" naturally.
      const cfg = configRef.current;
      
      playerRef.current = {
          ...playerRef.current,
          angle: 0, 
          radius: cfg.player.baseRadius + 140, 
          baseRadius: cfg.player.baseRadius,
          rVelocity: 0, 
          gravity: cfg.player.gravity,
          shieldTime: 0, shieldHits: 0, magnetTime: 0, magnetCount: 0, dashTime: 0, centerTime: 0, trail: [], x: 0, y: 0, trailAccumulator: 0
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
      
      // Reset spawn timers
      spawnTimerRef.current = 0;
      ambienceTimerRef.current = 0;
      
      // Init Ambience
      if (settingsRef.current.theme === 'christmas' && containerRef.current) {
         initSnow(containerRef.current.clientWidth, containerRef.current.clientHeight);
      } else {
         snowParticlesRef.current = [];
      }

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
  }, [refs, setUploadStatus, initSnow]);

  // Re-init ambience when theme changes
  useEffect(() => {
      if (containerRef.current) {
        if (settings.theme === 'christmas') {
            initSnow(containerRef.current.clientWidth, containerRef.current.clientHeight);
        } else {
            snowParticlesRef.current = [];
        }
      }
  }, [settings.theme, initSnow]);

  const startGame = () => {
      audioManager.resume();
      if (settings.bgmEnabled) {
          let targetBgm = DEFAULT_BGM_URL;
          const themesToSearch = availableThemes.length > 0 ? availableThemes : [];
          if (themesToSearch.length === 0) {
               try {
                   const c = localStorage.getItem(THEME_CACHE_KEY);
                   if(c) {
                       const parsed = JSON.parse(c);
                       const t = parsed.find((item: any) => item.id === settings.theme);
                       if (t && t.bgm_url) targetBgm = t.bgm_url;
                   }
               } catch(e) {}
          } else {
               const t = themesToSearch.find(t => t.id === settings.theme);
               if (t && t.bgm_url) targetBgm = t.bgm_url;
          }
          
          audioManager.playBGM(targetBgm);
      }

      initGame();
      gameStateRef.current = 'PLAYING';
      setUiGameState('PLAYING');
  };

  // [修改]: 返回首页逻辑，增加 Loading 状态、BGM渐出和数据拉取
  const goHome = async () => {
      // 0. BGM 渐出 (Fade Out) - 放在第一步调用，确保立即响应
      // 使用 0.8s 渐出，setTargetAtTime 算法
      if (settings.bgmEnabled) {
          audioManager.fadeOut(0.8);
      }

      // 1. 显示加载页面 (Type: Refresh)
      setLoadingState({ visible: true, type: 'refresh' });
      
      // 2. 等待数据拉取和最少展示时间
      await Promise.all([
          fetchGameConfig(), 
          fetchThemes(),
          new Promise(r => setTimeout(r, 1000)) // 至少展示1秒
      ]);
      
      // 3. 切换状态
      gameStateRef.current = 'START';
      setUiGameState('START');
      setScoreDisplay(0);
      
      // 4. 淡出加载页面 (audioManager 会在 useEffect 中根据 loadingState 恢复/切换音乐)
      setLoadingState(prev => ({ ...prev, visible: false }));
  };

  const triggerBonusMode = useCallback(() => {
      const cfg = configRef.current;
      isBonusTimeRef.current = true;
      // Use config for bonus duration
      bonusTimerRef.current = cfg.gameParams.bonusDurationSeconds;
      setIsBonusTimeUI(true);
      
      // Use config for bonus gravity
      playerRef.current.gravity = cfg.player.bonusGravity;
      
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
              e.styleVariant = Math.floor(Math.random() * 4);
              createExplosion(refs, Math.cos(e.angle)*e.dist, Math.sin(e.angle)*e.dist, COLORS.coin, 5, 5);
          }
      });
  }, [refs]);

  const endBonusMode = useCallback(() => {
      if (!isBonusTimeRef.current) return;
      isBonusTimeRef.current = false;
      setIsBonusTimeUI(false);
      triggerHaptic(50);
      
      // Reset gravity to normal using config
      playerRef.current.gravity = configRef.current.player.gravity;
      
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

  const gameActions: GameActions = useMemo(() => ({
      triggerBonusMode, endBonusMode, triggerDyingSequence, handleGameOver
  }), [triggerBonusMode, endBonusMode, triggerDyingSequence, handleGameOver]);

  const uiSetters: UiSetters = useMemo(() => ({
      setScoreDisplay, setOrbitCountDisplay, setBuffs, setCenterWarning, setBonusTimeLeft, setRunCoins
  }), []);

  const lastFrameTime = useRef<number>(0);

  const loop = useCallback((timestamp: number) => {
      if (!lastFrameTime.current) lastFrameTime.current = timestamp;

      const delta = timestamp - lastFrameTime.current;
      lastFrameTime.current = timestamp;

      let dt = delta / (1000 / 60);
      if (dt > 4) dt = 4;

      updateGame(refs, gameActions, uiSetters, dt);

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
              
              if (settingsRef.current.theme === 'christmas') {
                  initSnow(clientWidth, clientHeight);
              }
          }
      };
      window.addEventListener('resize', handleResize); handleResize();
      
      lastFrameTime.current = 0;
      frameId.current = requestAnimationFrame(loop);

      return () => { window.removeEventListener('resize', handleResize); cancelAnimationFrame(frameId.current); };
  }, [loop, refs, initSnow]);

  useEffect(() => {
      // Audio setup is now handled in the previous useEffect and startGame
      const unlockAudio = () => {
          // [关键修复] 如果还在首次加载资源，不要恢复上下文或播放音乐
          if (loadingState.visible) return;
          audioManager.resume();
      };
      
      const opts = { capture: true, passive: true };
      window.addEventListener('click', unlockAudio, opts);
      window.addEventListener('touchstart', unlockAudio, opts);
      window.addEventListener('keydown', unlockAudio, opts);
      window.addEventListener('mousemove', unlockAudio, opts);

      return () => {
          window.removeEventListener('click', unlockAudio, opts);
          window.removeEventListener('touchstart', unlockAudio, opts);
          window.removeEventListener('keydown', unlockAudio, opts);
          window.removeEventListener('mousemove', unlockAudio, opts);
      };
  }, [loadingState.visible]);

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
        
        {/* Loading Overlay - Render conditional on loadingState.visible */}
        <div className={`absolute inset-0 z-[100] transition-opacity duration-1000 pointer-events-none ${loadingState.visible ? 'opacity-100' : 'opacity-0'}`}>
             {/* 
                始终渲染 LoadingScreen，通过透明度控制显隐，实现渐变效果。
                透传 type 以显示不同文案。
             */}
             <LoadingScreen type={loadingState.type} onFinished={() => {}} />
        </div>

        {/* Start Screen (only visible if NOT loading, or underneath loading) */}
        {uiGameState === 'START' && (
            <div className={`absolute inset-0 z-30 transition-opacity duration-700 ${loadingState.visible ? 'opacity-0' : 'opacity-100'}`}>
                <StartScreen
                    session={session} 
                    totalCoins={totalCoins} 
                    systemStatus={systemStatus} 
                    theme={settings.theme}
                    onStart={startGame}
                    onLogout={handleLogout} 
                    onAuthOpen={() => setShowAuthModal(true)} 
                    onLeaderboardOpen={openLeaderboard} 
                    onShopOpen={openShop}
                    onSettingsOpen={() => setShowSettings(true)}
                />
            </div>
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
        {showSettings && (
            <SettingsModal 
                settings={settings} 
                onUpdateSettings={setSettings} 
                onClose={() => setShowSettings(false)} 
                onThemesUpdated={(themes) => setAvailableThemes(themes)} // 关键修复：子组件数据更新反向同步给父组件
            />
        )}
        {uiGameState === 'GAMEOVER' && (
            <GameOverModal
                scoreDisplay={scoreDisplay} highScore={highScore} gameStats={gameStats} uploadStatus={uploadStatus}
                session={session} onLeaderboardOpen={openLeaderboard} onRestart={startGame} onSync={() => syncData(scoreDisplay, runCoins)}
                onAuthOpen={() => setShowAuthModal(true)}
                onHome={goHome}
            />
        )}
        <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair active:cursor-grabbing" />
    </div>
  );
};