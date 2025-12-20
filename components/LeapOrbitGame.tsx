import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Player, Entity, Particle, Shockwave, EntityType, FloatingText, LeaderboardEntry, GameStateStatus, GameStats, UploadStatus, SystemStatus } from '../types';
import { supabase } from '../lib/supabase';

// New Imports
import { PLAYER_CONFIG, COLORS, MAX_ALTITUDE, BONUS_DURATION_FRAMES, BONUS_SCORE_THRESHOLD, CENTER_SAFE_LIMIT, CENTER_DEATH_LIMIT } from '../constants';
import { GameHUD } from './ui/GameHUD';
import { StartScreen } from './ui/StartScreen';
import { GameOverModal } from './modals/GameOverModal';
import { AuthModal } from './modals/AuthModal';
import { LeaderboardModal } from './modals/LeaderboardModal';

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
  const [uiGameState, setUiGameState] = useState<GameStateStatus>('START');
  const [buffs, setBuffs] = useState({ shield: 0, magnet: 0, dash: 0 });
  const [centerWarning, setCenterWarning] = useState(false);
  const [orbitCountDisplay, setOrbitCountDisplay] = useState(1);
  const [totalCoins, setTotalCoins] = useState(0); // 账号总金币
  const [runCoins, setRunCoins] = useState(0);     // 本局获得金币
  const [isBonusTimeUI, setIsBonusTimeUI] = useState(false);
  const [bonusTimeLeft, setBonusTimeLeft] = useState(0);

  // --- Refs for Stale Closure Prevention ---
  const totalCoinsRef = useRef(0);
  const highScoreRef = useRef(0); // NEW: Track high score for syncData without stale closure
  const hasSyncedToServerRef = useRef(false); // Prevent double coin submission
  const isSyncingRef = useRef(false); // Prevent concurrent sync requests

  const [gameStats, setGameStats] = useState<GameStats>({ 
    duration: 0, 
    formattedDuration: '0分0秒',
    finalOrbit: 1,
    actionScore: 0,
    timeScore: 0,
    orbitBonus: 0,
    multiplier: 1.0,
    coinsCollected: 0
  });

  // --- Supabase / Auth / System State ---
  const [session, setSession] = useState<any>(null);
  const sessionRef = useRef<any>(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({status: 'checking', msg: '正在连接服务器...'});
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({status: 'idle', msg: ''});

  // --- Mutable Game State ---
  const gameStateRef = useRef<GameStateStatus>('START');
  const actionScoreRef = useRef(0); 
  const orbitRef = useRef(1);      
  const gameStartTimeRef = useRef(0);
  const gameEndTimeRef = useRef<number | null>(null);
  const isFillingInnerZoneRef = useRef(true); 
  const deathTimerRef = useRef(0);
  const maxDeathTimerRef = useRef(180);
  
  // Coin & Bonus State Refs
  const coinsRef = useRef(0); // Current run coins (Logic source of truth)
  const lastBonusThresholdRef = useRef(0); // Tracks 2000, 4000, 6000...
  const isBonusTimeRef = useRef(false);
  const bonusTimerRef = useRef(0);

  const frameId = useRef<number>(0);
  const isPressing = useRef<boolean>(false);
  const shake = useRef<number>(0);
  const dimensions = useRef({ width: 0, height: 0, cx: 0, cy: 0 });

  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });

  const playerRef = useRef<Player>({
    angle: 0,
    radius: PLAYER_CONFIG.baseRadius,
    baseRadius: PLAYER_CONFIG.baseRadius,
    leapLimit: 999999,
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
    magnetTime: 0,
    magnetCount: 0,
    dashTime: 0, 
    centerTime: 0
  });

  const entitiesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]); 
  const starsRef = useRef<Star[]>([]);
  const entityIdCounter = useRef(0);

  // --- Initialization & Persistance ---

  useEffect(() => {
    // Keep refs in sync with state for access inside callbacks
    totalCoinsRef.current = totalCoins;
    highScoreRef.current = highScore;
  }, [totalCoins, highScore]);
  
  // Fetch User Data from Cloud (Source of Truth)
  const fetchUserData = useCallback(async (userId: string) => {
      try {
          const { data, error } = await supabase
            .from('high_scores')
            .select('score, coins')
            .eq('user_id', userId)
            .single();
          
          if (data) {
              setTotalCoins(data.coins || 0);
              setHighScore(data.score || 0);
              localStorage.setItem('leap_orbit_coins', (data.coins || 0).toString());
          } else if (error && error.code === 'PGRST116') {
              setTotalCoins(0);
              setHighScore(0);
          }
      } catch (e) {
          console.error("Failed to fetch user data", e);
      }
  }, []);

  const syncData = useCallback(async (score: number, currentRunCoins: number) => {
    const currentSession = sessionRef.current;
    
    // 1. Guest Mode: Simple Local Storage
    if (!currentSession || !currentSession.user) {
        const currentTotal = totalCoinsRef.current;
        const newTotal = currentTotal + currentRunCoins;
        setTotalCoins(newTotal);
        setRunCoins(0); 
        localStorage.setItem('leap_orbit_coins', newTotal.toString());
        setUploadStatus({status: 'idle', msg: '未登录，仅保存本地'});
        return;
    }

    // 2. Auth Mode: Secure Server Sync
    if (hasSyncedToServerRef.current) {
        setUploadStatus({status: 'success', msg: '数据已同步'});
        return;
    }

    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    
    setUploadStatus({status: 'uploading', msg: '正在同步数据...'});

    try {
        // --- OPTIMIZATION: ATOMIC INCREMENT (RPC) ---
        // We use a database function (RPC) to perform "coins = coins + gained" on the server.
        // This solves:
        // 1. Race Conditions: Multiple devices won't overwrite each other.
        // 2. Speed: Only 1 request needed (no SELECT required).
        // 3. Consistency: Returns the TRUE authoritative total from server immediately.
        
        const username = currentSession.user.user_metadata.username || currentSession.user.email?.split('@')[0] || 'Unknown';

        const { data, error } = await supabase.rpc('sync_game_data', {
            p_username: username,
            p_score: score,
            p_coins_gained: currentRunCoins
        });

        if (error) throw error;

        // Data contains { coins: number, score: number } from the server
        if (data) {
            hasSyncedToServerRef.current = true; // Mark as synced
            
            // Update local state to match server's Truth
            setHighScore(data.score);
            setTotalCoins(data.coins);
            setRunCoins(0); // Clear run buffer
            
            localStorage.setItem('leap_orbit_coins', data.coins.toString()); 
            
            let msg = '数据已同步';
            // RESTORED: Check difference between current run score and the server's ALL TIME high score
            if (score >= data.score && score > 0) {
                 msg = '新纪录已保存！';
            } else if (data.score > score) {
                 const diff = data.score - score + 1;
                 msg = `再接再厉！还差 ${diff} 分就破记录了！`;
            }
            
            setUploadStatus({status: 'success', msg: msg});
        }
    } catch (err: any) {
        console.error("Sync Error:", err);
        
        // Handle Missing Column Error (42703)
        if (err.code === '42703') {
             setUploadStatus({status: 'error', msg: '数据库缺updated_at字段'});
        }
        // Handle Missing Function Error
        else if (err.message && (err.message.includes('function') || err.message.includes('RPC'))) {
             setUploadStatus({status: 'error', msg: '需更新数据库函数'});
        } else {
             setUploadStatus({status: 'error', msg: '同步失败'});
        }
    } finally {
        isSyncingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // 1. Initial Local Load (Guest Mode)
    const localCoins = localStorage.getItem('leap_orbit_coins');
    if (localCoins) {
        const val = parseInt(localCoins, 10);
        setTotalCoins(val);
    }

    // 2. Check Connection
    const checkConnection = async () => {
        try {
            const { error } = await supabase.from('high_scores').select('count', { count: 'exact', head: true });
            if (error) {
                if (error.code === '42P01') {
                     setSystemStatus({status: 'error', msg: '数据库配置错误'});
                } else {
                     setSystemStatus({status: 'error', msg: '离线模式'});
                }
            } else {
                setSystemStatus({status: 'ok', msg: '已连接云端'});
            }
        } catch (err: any) {
            setSystemStatus({status: 'error', msg: '网络异常'});
        }
    };
    checkConnection();

    // 3. Auth Listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      sessionRef.current = session;
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      sessionRef.current = session;
    });

    return () => subscription.unsubscribe();
  }, []);

  // New Effect: Handle Session Changes & Auto-Sync
  useEffect(() => {
    if (session?.user) {
        if (uiGameState === 'GAMEOVER') {
             // Only auto-retry sync if not already synced or currently syncing
             if (!hasSyncedToServerRef.current && !isSyncingRef.current) {
                 const timer = setTimeout(() => {
                     syncData(scoreDisplay, coinsRef.current);
                 }, 200);
                 return () => clearTimeout(timer);
             }
        } else {
             fetchUserData(session.user.id);
        }
    }
  }, [session, uiGameState, scoreDisplay, fetchUserData, syncData]);


  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { data: { username: authUsername } },
        });
        if (error) throw error;
        alert("注册成功。请先验证邮箱再登录！");
        setAuthMode('login'); 
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        setShowAuthModal(false);
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setTotalCoins(0);
    setHighScore(0);
    const localCoins = localStorage.getItem('leap_orbit_coins');
    if (localCoins) setTotalCoins(parseInt(localCoins, 10));
    setUploadStatus({status: 'idle', msg: ''});
  };

  const fetchLeaderboard = async () => {
    setLeaderboardLoading(true);
    try {
      const { data, error } = await supabase
        .from('high_scores')
        .select('username, score, created_at')
        .order('score', { ascending: false })
        .limit(10);
      
      if (error && error.code !== '42P01') throw error;
      setLeaderboardData(data || []);
    } catch (err: any) {
      console.error("Error fetching leaderboard:", err);
      setLeaderboardData([]); 
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const openLeaderboard = () => {
      setShowLeaderboard(true);
      fetchLeaderboard();
  };

  const openShop = () => {
      alert("新建文件夹中…\n你别急😁");
  };

  // --- Bonus & Coin Logic ---

  const triggerBonusMode = () => {
      isBonusTimeRef.current = true;
      bonusTimerRef.current = BONUS_DURATION_FRAMES;
      setIsBonusTimeUI(true);
      
      // Heavier gravity for bonus mode
      playerRef.current.gravity = 0.25;

      // Visual flair
      shake.current = 10;
      triggerHaptic([50, 50, 50, 50, 200]); // Bonus notification
      createShockwave(0, 0, COLORS.coin);
      
      // Transform all valid entities to Coins
      entitiesRef.current.forEach(e => {
          if (e.isSafety) {
              e.active = false; // Hide safety ring
          } else if (e.active && e.type !== 'coin') {
              e.type = 'coin';
              e.color = COLORS.coin;
              e.size = 12;
              // Reset scale for pop-in effect
              e.scale = 0; 
              createExplosion(Math.cos(e.angle)*e.dist, Math.sin(e.angle)*e.dist, COLORS.coin, 5, 5);
          }
      });
  };

  const endBonusMode = () => {
      if (!isBonusTimeRef.current) return;
      
      isBonusTimeRef.current = false;
      setIsBonusTimeUI(false);
      triggerHaptic(50);
      
      // Restore normal gravity
      playerRef.current.gravity = PLAYER_CONFIG.gravity;
      
      // Restore Scene
      entitiesRef.current = entitiesRef.current.filter(e => e.type !== 'coin');
      spawnSafetyRing(orbitRef.current);
      isFillingInnerZoneRef.current = true;
  };

  // --- Helper Functions ---
  const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}分${s}秒`;
  };

  const triggerHaptic = (pattern: number | number[]) => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(pattern); } catch(e) {}
      }
  };

  const calculateCurrentTotalScore = () => {
    const endTime = gameEndTimeRef.current || Date.now();
    const startTime = gameStartTimeRef.current || endTime;
    const survivalSeconds = Math.max(0, (endTime - startTime) / 1000);
    const timeScore = Math.floor(survivalSeconds * 5);
    const orbitBonus = (orbitRef.current - 1) * 100;
    const multiplier = 1 + (orbitRef.current - 1) * 0.1;
    return Math.floor((actionScoreRef.current + timeScore + orbitBonus) * multiplier);
  };

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

  const createExplosion = (x: number, y: number, color: string, count = 12, speed = 15) => {
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
    shockwavesRef.current.push({ x, y, radius: 10, maxRadius: 400, life: 1.0, color });
  };

  const spawnFloatingText = (x: number, y: number, text: string, color: string, size: number = 24) => {
      floatingTextsRef.current.push({ x, y, text, color, life: 1.0, vy: -1.9, size });
  };

  const spawnSafetyRing = (orbitNum: number) => {
      if (isBonusTimeRef.current) return;
      entitiesRef.current = entitiesRef.current.filter(e => e && !e.isSafety);
      let count = 40;
      if (orbitNum > 3) {
          const reduction = (orbitNum - 3) * 5;
          count = Math.max(0, 40 - reduction);
      }
      const ringRadius = PLAYER_CONFIG.baseRadius + 80;
      for(let i=0; i<count; i++) {
          entitiesRef.current.push({
              id: entityIdCounter.current++,
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

  const spawnInnerAmbience = () => {
    if (isBonusTimeRef.current) return;
    if (entitiesRef.current.length > 350) return;
    const SAFE_ZONE_RADIUS = PLAYER_CONFIG.baseRadius + 300;
    const currentInnerCount = entitiesRef.current.filter(e => 
        e && e.type === 'score' && e.dist <= SAFE_ZONE_RADIUS && e.active
    ).length;
    if (isFillingInnerZoneRef.current) {
        if (currentInnerCount >= 50) isFillingInnerZoneRef.current = false;
    } else {
        if (currentInnerCount <= 20) isFillingInnerZoneRef.current = true;
    }
    if (!isFillingInnerZoneRef.current) return;
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
        id: entityIdCounter.current++,
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
    entitiesRef.current.push(entity);
  };

  const spawnEntity = () => {
    const maxEntities = 350; 
    if (entitiesRef.current.length > maxEntities) return;
    const currentOrbit = orbitRef.current;
    
    // Bonus Mode Spawning Logic
    if (isBonusTimeRef.current) {
        if (Math.random() > 0.15) return; 
        const spawnDist = randomRange(PLAYER_CONFIG.baseRadius + 50, MAX_ALTITUDE - 200);
        entitiesRef.current.push({
            id: entityIdCounter.current++,
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

    const playerRadius = playerRef.current.radius;
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
        const difficultyFactor = actionScoreRef.current / 5000;
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
        const dx = playerRef.current.x - ex;
        const dy = playerRef.current.y - ey;
        if ((dx * dx + dy * dy) < 360000) return; 
    }

    entitiesRef.current.push({
      id: entityIdCounter.current++,
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

  const initGame = () => {
    playerRef.current = {
      ...playerRef.current,
      angle: 0,
      radius: PLAYER_CONFIG.baseRadius + 140, 
      rVelocity: 0,
      gravity: PLAYER_CONFIG.gravity, 
      shieldTime: 0,
      magnetTime: 0,
      magnetCount: 0, 
      dashTime: 0, 
      centerTime: 0, 
      trail: [],
      x: 0,
      y: 0
    };
    entitiesRef.current = [];
    particlesRef.current = [];
    shockwavesRef.current = [];
    floatingTextsRef.current = [];
    actionScoreRef.current = 0;
    orbitRef.current = 1; 
    
    // Reset Bonus State
    coinsRef.current = 0;
    setRunCoins(0);
    hasSyncedToServerRef.current = false; // Reset sync flag for new game
    isSyncingRef.current = false; // Reset sync lock
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
    spawnSafetyRing(1);
    setUploadStatus({status: 'idle', msg: ''});
  };

  const startGame = () => {
    initGame();
    gameStateRef.current = 'PLAYING';
    setUiGameState('PLAYING');
  };

  const triggerDyingSequence = () => {
    if (gameStateRef.current === 'DYING' || gameStateRef.current === 'GAMEOVER') return;
    
    gameEndTimeRef.current = Date.now(); // Stop clock immediately
    gameStateRef.current = 'DYING';
    setUiGameState('DYING');
    
    // --- OPTIMIZATION: Trigger Upload IMMEDIATELY ---
    // Instead of waiting for the animation to finish and the modal to open,
    // we sync data right here. By the time the 3s animation is done, 
    // the upload is likely finished.
    const finalScore = calculateCurrentTotalScore();
    const finalCoins = coinsRef.current;
    
    // Set these visual states immediately so there's no jump later
    setScoreDisplay(finalScore);
    // Note: We do NOT optimistically update highScore/totalCoins here anymore for the UI 
    // because we want the authoritative response from the RPC.
    // However, for the "Game Over" modal's immediate display, we can show what we have, 
    // but the final "Total Coins" will be updated when the RPC returns.
    
    // Execute Sync
    syncData(finalScore, finalCoins);
    // ------------------------------------------------

    deathTimerRef.current = maxDeathTimerRef.current; 
    shake.current = 15; 
    triggerHaptic([40, 30, 80, 30, 500]);
    const player = playerRef.current;
    createExplosion(player.x, player.y, COLORS.player, 40, 15);
    createShockwave(player.x, player.y, COLORS.player);
  };

  const handleGameOver = () => {
    gameStateRef.current = 'GAMEOVER';
    
    const finalTime = (gameEndTimeRef.current || Date.now()) - gameStartTimeRef.current;
    
    // We already calculated total score in triggerDyingSequence, 
    // but calculating again for stats breakdown is safe and fast.
    
    entitiesRef.current.forEach(e => {
        if (e && e.active) {
            const ex = Math.cos(e.angle) * e.dist;
            const ey = Math.sin(e.angle) * e.dist;
            createShockwave(ex, ey, e.color);
            createExplosion(ex, ey, e.color, 5, 8); 
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
    
    setTimeout(() => {
        setUiGameState('GAMEOVER');
    }, 1000);
  };

  const update = () => {
    if (gameStateRef.current === 'START') return;

    if (gameStateRef.current === 'DYING') {
        deathTimerRef.current--;
        const player = playerRef.current;
        cameraRef.current.x += (player.x - cameraRef.current.x) * 0.03;
        cameraRef.current.y += (player.y - cameraRef.current.y) * 0.03;
        cameraRef.current.zoom += (3.8 - cameraRef.current.zoom) * 0.015;
        particlesRef.current.forEach((p, i) => { p.x += p.vx * 0.25; p.y += p.vy * 0.25; p.life -= 0.005; if (p.life <= 0) particlesRef.current.splice(i, 1); });
        shockwavesRef.current.forEach((sw, i) => { sw.radius += 2.5; sw.life -= 0.006; if (sw.life <= 0) shockwavesRef.current.splice(i, 1); });
        if (shake.current > 0) shake.current *= 0.98;
        if (deathTimerRef.current <= 0) handleGameOver();
        return;
    }

    if (gameStateRef.current === 'GAMEOVER') {
        particlesRef.current.forEach((p, i) => { p.x += p.vx * 0.5; p.y += p.vy * 0.5; p.life -= 0.01; if (p.life <= 0) particlesRef.current.splice(i, 1); });
        shockwavesRef.current.forEach((sw, i) => { sw.radius += 2; sw.life -= 0.01; if (sw.life <= 0) shockwavesRef.current.splice(i, 1); });
        floatingTextsRef.current.forEach((ft, i) => { ft.y += ft.vy * 0.5; ft.life -= 0.01; if (ft.life <= 0) floatingTextsRef.current.splice(i, 1); });
        return;
    }

    const player = playerRef.current;
    
    // --- Bonus Time Logic ---
    const currentTotalScore = calculateCurrentTotalScore();
    
    if (isBonusTimeRef.current) {
        bonusTimerRef.current--;
        if (bonusTimerRef.current % 10 === 0) setBonusTimeLeft(bonusTimerRef.current);
        
        if (bonusTimerRef.current <= 0) {
            endBonusMode();
        }
    } else {
        if (currentTotalScore !== scoreDisplay) setScoreDisplay(currentTotalScore);
        const nextThreshold = lastBonusThresholdRef.current + BONUS_SCORE_THRESHOLD;
        if (currentTotalScore >= nextThreshold) {
            lastBonusThresholdRef.current += BONUS_SCORE_THRESHOLD;
            triggerBonusMode();
        }
    }

    // Buffs
    if (player.shieldTime > 0) {
        if (player.shieldTime === 1) triggerHaptic([40, 30, 15]); 
        player.shieldTime--;
    }
    if (player.magnetTime > 0) player.magnetTime--;
    if (player.dashTime > 0) player.dashTime--;
    const hasShield = player.shieldTime > 0;
    const hasMagnet = player.magnetTime > 0;
    const hasDash = player.dashTime > 0;

    // Movement
    if (hasDash) {
        player.angle += PLAYER_CONFIG.dashRotSpeed;
        player.rVelocity *= 0.5; 
    } else {
        if (isPressing.current) player.angle += player.rotSpeed; 
        player.rVelocity -= player.gravity; 
    }
    player.rVelocity *= player.drag; 
    player.radius += player.rVelocity;

    // Orbit & Hub Logic
    const currentOrbitNum = Math.floor(player.angle / (Math.PI * 2)) + 1; 
    if (currentOrbitNum > orbitRef.current) {
        orbitRef.current = currentOrbitNum;
        setOrbitCountDisplay(currentOrbitNum);
        shake.current = 5;
        createShockwave(0, 0, '#00d2ff');
        if (!isBonusTimeRef.current) spawnSafetyRing(currentOrbitNum);
    }

    if (player.radius < player.baseRadius) {
      player.radius = player.baseRadius;
      if (player.rVelocity < -1) {
        player.rVelocity = -player.rVelocity * 0.4; 
        shake.current = Math.min(Math.abs(player.rVelocity) * 2, 5);
      } else player.rVelocity = 0;
    }

    const DANGER_ZONE = player.baseRadius + 10;
    if (player.radius <= DANGER_ZONE) {
        if (isBonusTimeRef.current) {
            endBonusMode();
        }

        player.centerTime++;
        if (player.centerTime > CENTER_SAFE_LIMIT) {
            setCenterWarning(true);
            shake.current = (player.centerTime - CENTER_SAFE_LIMIT) / 20; 
            if (player.centerTime > CENTER_DEATH_LIMIT) triggerDyingSequence();
        }
    } else {
        if (player.centerTime > 0) { player.centerTime = 0; setCenterWarning(false); }
    }
    
    player.x = Math.cos(player.angle) * player.radius;
    player.y = Math.sin(player.angle) * player.radius;
    player.trail.push({ x: player.x, y: player.y });
    if (player.trail.length > PLAYER_CONFIG.trailLength) player.trail.shift();

    // --- IMPROVED CAMERA LOGIC FOR MOBILE ---
    const { width, height } = dimensions.current;
    
    const fitDimension = Math.min(width, height);
    const requiredViewDiameter = (player.radius * 2) + (hasDash ? 400 : 300);
    const targetZoom = Math.max(
        width < 600 ? 0.25 : 0.35,
        Math.min(1.2, fitDimension / requiredViewDiameter)
    );

    cameraRef.current.x += (player.x * 0.5 - cameraRef.current.x) * 0.08;
    cameraRef.current.y += (player.y * 0.5 - cameraRef.current.y) * 0.08;
    cameraRef.current.zoom += (targetZoom - cameraRef.current.zoom) * 0.05;

    spawnEntity();
    spawnInnerAmbience();

    const now = Date.now();
    for (let i = entitiesRef.current.length - 1; i >= 0; i--) {
      const e = entitiesRef.current[i];
      if (!e || !e.active) continue;
      if (e.isSafety && orbitRef.current >= 2) {
          e.dist = (e.baseDist || e.dist) + Math.sin(now * 0.002 + (e.wobblePhase || 0)) * Math.min(50, 15 + (orbitRef.current - 2) * 5);
      }
      if (e.scale < e.maxScale) e.scale += 0.125; 
      e.angle += e.moveSpeed;
      if (e.type === 'enemy') e.rotation += 0.06;

      let magnetSucked = false;
      // Magnet affects Score AND Coins
      if ((e.type === 'score' || e.type === 'coin') && hasMagnet) {
        const dx = player.x - Math.cos(e.angle) * e.dist;
        const dy = player.y - Math.sin(e.angle) * e.dist;
        if ((dx * dx + dy * dy) < 100000) {
            e.dist += (player.radius - e.dist) * (e.isSafety ? 0.05 : 0.2);
            let diffAngle = player.angle - e.angle;
            while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
            while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
            e.angle += diffAngle * (e.isSafety ? 0.05 : 0.15);
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
             coinsRef.current += 1;
             setRunCoins(coinsRef.current);
             createExplosion(ex, ey, COLORS.coin, 8, 8); 
             spawnFloatingText(ex, ey, "+1 金币", COLORS.coin, 16);
             if (isDirectHit) { const boost = 15.0 + player.radius / 300; player.rVelocity = Math.max(player.rVelocity + boost, boost); }
             entitiesRef.current.splice(i, 1);
        } else if (e.type === 'score') {
          actionScoreRef.current += 10; createExplosion(ex, ey, 'white', 8, 8); spawnFloatingText(ex, ey, "+10", "#ffffff"); 
          if (hasMagnet) {
              player.magnetCount = (player.magnetCount || 0) + 1;
              if (player.magnetCount >= 15) { player.magnetTime = 0; setBuffs(prev => ({ ...prev, magnet: 0 })); }
          }
          if (isDirectHit) { const boost = 15.0 + player.radius / 300; player.rVelocity = Math.max(player.rVelocity + boost, boost); }
          if (e.isSafety) e.active = false; else entitiesRef.current.splice(i, 1);
        } else if (e.type === 'shield') {
          player.shieldTime = 400; triggerHaptic(8); 
          createExplosion(ex, ey, COLORS.shield, 15); entitiesRef.current.splice(i, 1);
        } else if (e.type === 'magnet') {
          player.magnetTime = 600; player.magnetCount = 0; triggerHaptic(8); 
          createExplosion(ex, ey, COLORS.magnet, 15); entitiesRef.current.splice(i, 1);
        } else if (e.type === 'dash') {
          player.dashTime = 150; triggerHaptic(8); 
          createExplosion(ex, ey, COLORS.dash, 20); createShockwave(ex, ey, COLORS.dash); entitiesRef.current.splice(i, 1);
        } else if (e.type === 'nuke') {
          createExplosion(ex, ey, COLORS.nuke, 20); createShockwave(ex, ey, COLORS.nuke); shake.current = 20;
          triggerHaptic([10, 10, 10, 10, 50, 20, 100]); 
          for (let j = entitiesRef.current.length - 1; j >= 0; j--) {
              const t = entitiesRef.current[j];
              if (t && t.type === 'enemy') {
                  const tx = Math.cos(t.angle) * t.dist; const ty = Math.sin(t.angle) * t.dist;
                  if (((ex - tx)**2 + (ey - ty)**2) < 500**2) {
                      createExplosion(tx, ty, COLORS.enemy, 15); createShockwave(tx, ty, COLORS.enemy);
                      spawnFloatingText(tx, ty, "+50", COLORS.enemy, 32);
                      entitiesRef.current.splice(j, 1); actionScoreRef.current += 50; if (j < i) i--;
                  }
              }
          }
          entitiesRef.current.splice(i, 1);
        } else if (e.type === 'enemy' && isDirectHit) {
            if (hasShield || hasDash || player.rVelocity > 0) {
                createExplosion(ex, ey, COLORS.enemy, 20); createShockwave(ex, ey, COLORS.enemy);
                triggerHaptic([12, 8, 25]); 
                spawnFloatingText(ex, ey, "+50", COLORS.enemy, 32); shake.current = 10; entitiesRef.current.splice(i, 1); actionScoreRef.current += 50; 
            } else triggerDyingSequence();
        }
      }
    }

    particlesRef.current.forEach((p, i) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.038;
      if (p.life <= 0) particlesRef.current.splice(i, 1);
    });
    shockwavesRef.current.forEach((sw, i) => { sw.radius += 15; sw.life -= 0.038; if (sw.life <= 0) shockwavesRef.current.splice(i, 1); });
    floatingTextsRef.current.forEach((ft, i) => { ft.y += ft.vy; ft.life -= 0.025; if (ft.life <= 0) floatingTextsRef.current.splice(i, 1); });
    if (shake.current > 0) shake.current *= 0.9;
    
    setBuffs({ shield: player.shieldTime, magnet: player.magnetTime, dash: player.dashTime });
  };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { width, height, cx, cy } = dimensions.current;
    const player = playerRef.current; const cam = cameraRef.current;

    ctx.fillStyle = COLORS.background; ctx.fillRect(0, 0, width, height);
    
    if (gameStateRef.current === 'DYING') {
        const prog = 1 - deathTimerRef.current / maxDeathTimerRef.current;
        const pulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
        const gradient = ctx.createRadialGradient(cx, cy, 100 * cam.zoom, cx, cy, Math.max(width, height) * 0.9);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, `rgba(180, 0, 0, ${prog * pulse * 0.5})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    ctx.save();
    ctx.translate(cx, cy);
    if (shake.current > 0) ctx.translate((Math.random() - 0.5) * shake.current, (Math.random() - 0.5) * shake.current);
    ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.x, -cam.y);

    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); 
    starsRef.current.forEach(star => {
        let px = (star.x - cam.x * 0.2 * cam.zoom) % width; let py = (star.y - cam.y * 0.2 * cam.zoom) % height;
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * (gameStateRef.current === 'DYING' ? (deathTimerRef.current/maxDeathTimerRef.current) : 1)})`; 
        ctx.beginPath(); ctx.arc(px < 0 ? px + width : px, py < 0 ? py + height : py, star.size * (0.5 + cam.zoom * 0.5), 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();

    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1 / cam.zoom; ctx.beginPath();
    const viewR = Math.max(width, height) / cam.zoom;
    for(let r = Math.floor(Math.max(100, player.radius - viewR) / 200) * 200; r < player.radius + viewR; r += 200) {
        ctx.moveTo(r, 0); ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    ctx.stroke();

    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fillStyle = player.centerTime > CENTER_SAFE_LIMIT ? (Math.floor(Date.now() / 100) % 2 === 0 ? '#ff0000' : '#500000') : '#333';
    ctx.fill(); ctx.stroke();

    if (gameStateRef.current === 'START') { ctx.restore(); return; }

    shockwavesRef.current.forEach(sw => { ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2); ctx.strokeStyle = sw.color; ctx.lineWidth = (4 * sw.life) / cam.zoom; ctx.globalAlpha = sw.life; ctx.stroke(); ctx.globalAlpha = 1.0; });
    entitiesRef.current.forEach(e => {
        if (!e || !e.active) return;
        const x = Math.cos(e.angle) * e.dist; const y = Math.sin(e.angle) * e.dist;
        if (Math.abs((x - cam.x) * cam.zoom) > width/2 + 200 || Math.abs((y - cam.y) * cam.zoom) > height/2 + 200) return;
        ctx.save(); ctx.translate(x, y);
        ctx.globalAlpha = (gameStateRef.current === 'DYING' ? (deathTimerRef.current/maxDeathTimerRef.current) : 1);
        
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

    particlesRef.current.forEach((p, i) => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1.0; });
    floatingTextsRef.current.forEach(ft => { ctx.globalAlpha = Math.max(0, ft.life); ctx.fillStyle = ft.color; ctx.font = `bold ${ft.size}px monospace`; ctx.textAlign = 'center'; ctx.fillText(ft.text, ft.x, ft.y); });
    ctx.globalAlpha = 1.0;

    if (gameStateRef.current !== 'GAMEOVER' && gameStateRef.current !== 'DYING') {
        if (player.radius < 3000) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(player.x, player.y); ctx.strokeStyle = `rgba(0, 210, 255, ${Math.max(0, (0.2 - player.radius / 3000))})`; ctx.stroke(); }
        if (player.trail.length > 1) { ctx.beginPath(); ctx.moveTo(player.trail[0].x, player.trail[0].y); player.trail.forEach(t => ctx.lineTo(t.x, t.y)); ctx.strokeStyle = player.dashTime > 0 ? COLORS.dash : player.color; ctx.lineWidth = player.size * (player.dashTime > 0 ? 1.5 : 0.8); ctx.stroke(); }
        
        if (player.shieldTime > 0) {
            ctx.save(); ctx.beginPath(); ctx.arc(player.x, player.y, player.size + 5, 0, Math.PI * 2);
            ctx.strokeStyle = COLORS.shield; ctx.lineWidth = 2; ctx.shadowColor = COLORS.shield; ctx.shadowBlur = 10;
            ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.01) * 0.2; ctx.stroke(); ctx.restore();
        }
        if (player.magnetTime > 0) {
            ctx.save(); ctx.beginPath(); ctx.arc(player.x, player.y, player.size + 20, 0, Math.PI * 2);
            ctx.strokeStyle = COLORS.magnet; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
            ctx.lineDashOffset = -Date.now() * 0.02; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.restore();
        }

        ctx.beginPath(); ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2); ctx.fillStyle = player.dashTime > 0 ? '#fff' : player.color; ctx.fill();
    }
    ctx.restore();
  };

  const loop = useCallback(() => { update(); draw(); frameId.current = requestAnimationFrame(loop); }, []);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        canvasRef.current.width = clientWidth; 
        canvasRef.current.height = clientHeight;
        dimensions.current = { width: clientWidth, height: clientHeight, cx: clientWidth / 2, cy: clientHeight / 2 };
        initStars(clientWidth, clientHeight);
      }
    };
    window.addEventListener('resize', handleResize); handleResize();
    frameId.current = requestAnimationFrame(loop);
    return () => { window.removeEventListener('resize', handleResize); cancelAnimationFrame(frameId.current); };
  }, [loop]);

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

  return (
    <div ref={containerRef} className="relative w-full h-full font-sans select-none overflow-hidden bg-black touch-none">
        <GameHUD
            uiGameState={uiGameState}
            buffs={buffs}
            totalCoins={totalCoins}
            runCoins={runCoins}
            orbitCountDisplay={orbitCountDisplay}
            scoreDisplay={scoreDisplay}
            isBonusTimeUI={isBonusTimeUI}
            bonusTimeLeft={bonusTimeLeft}
        />

        {uiGameState === 'START' && (
            <StartScreen
                session={session}
                totalCoins={totalCoins}
                systemStatus={systemStatus}
                onStart={startGame}
                onLogout={handleLogout}
                onAuthOpen={() => setShowAuthModal(true)}
                onLeaderboardOpen={openLeaderboard}
                onShopOpen={openShop}
            />
        )}

        {showAuthModal && (
            <AuthModal
                authMode={authMode}
                setAuthMode={setAuthMode}
                authUsername={authUsername}
                setAuthUsername={setAuthUsername}
                authEmail={authEmail}
                setAuthEmail={setAuthEmail}
                authPassword={authPassword}
                setAuthPassword={setAuthPassword}
                authLoading={authLoading}
                authError={authError}
                onSubmit={handleAuth}
                onClose={() => setShowAuthModal(false)}
            />
        )}

        {showLeaderboard && (
            <LeaderboardModal
                loading={leaderboardLoading}
                data={leaderboardData}
                onClose={() => setShowLeaderboard(false)}
            />
        )}

        {uiGameState === 'GAMEOVER' && (
            <GameOverModal
                scoreDisplay={scoreDisplay}
                highScore={highScore}
                gameStats={gameStats}
                uploadStatus={uploadStatus}
                session={session}
                onLeaderboardOpen={openLeaderboard}
                onRestart={startGame}
                onSync={() => syncData(scoreDisplay, runCoins)}
                onAuthOpen={() => setShowAuthModal(true)}
            />
        )}

        <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair active:cursor-grabbing" />
    </div>
  );
};