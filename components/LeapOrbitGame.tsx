import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Player, Entity, Particle, Shockwave, EntityType, FloatingText, LeaderboardEntry } from '../types';
import { Shield, Zap, Skull, Trophy, Play, RefreshCw, AlertTriangle, RotateCw, Flame, Clock, Hash, Target, User, LogIn, Award, X, Loader2, CheckCircle, UploadCloud, Cloud, CloudOff, Coins, ShoppingBag, LogOut, UserCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const GAME_VERSION = "v8.3.3-MobileScroll";

// --- Game Constants ---
const PLAYER_CONFIG = {
  baseRadius: 100,
  accelOut: 0,    
  gravity: 0.125, 
  drag: 0.94,     
  rotSpeed: 0.01, 
  dashRotSpeed: 0.03, 
  size: 14,
  trailLength: 25,
};

const MAX_ALTITUDE = 1500; 
const BONUS_DURATION_FRAMES = 60 * 10; // 10 seconds at 60fps
const BONUS_SCORE_THRESHOLD = 2000;

const COLORS = {
  player: '#00d2ff',
  enemy: '#ff3333',
  score: '#ffffff',
  shield: '#00ff00',   
  magnet: '#bf00ff',   
  nuke: '#facc15',     
  dash: '#f97316',
  coin: '#fbbf24',     
  background: '#111111',
  grid: '#333333'
};

const CENTER_SAFE_LIMIT = 300; 
const CENTER_DEATH_LIMIT = 480; 

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
}

type GameStateStatus = 'START' | 'PLAYING' | 'DYING' | 'GAMEOVER';

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

  const [gameStats, setGameStats] = useState({ 
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
  
  const [systemStatus, setSystemStatus] = useState<{status: 'checking' | 'ok' | 'error', msg: string}>({status: 'checking', msg: '正在连接服务器...'});
  const [uploadStatus, setUploadStatus] = useState<{status: 'idle' | 'uploading' | 'success' | 'error', msg: string}>({status: 'idle', msg: ''});

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
  const coinsRef = useRef(0); // Current run coins
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
    // Keep ref in sync with state
    totalCoinsRef.current = totalCoins;
  }, [totalCoins]);
  
  // --- Mobile Scroll Fix Logic ---
  // When in 'START' or 'GAMEOVER', we explicitly ALLOW default touch actions on the body.
  // This is crucial because index.html sets touch-action: none globally.
  // We override it here when needed.
  useEffect(() => {
      const body = document.body;
      if (uiGameState === 'START' || uiGameState === 'GAMEOVER') {
          // Allow scrolling in menus
          body.style.touchAction = 'auto';
          body.style.overflow = 'hidden'; // Keep body hidden, let the overlay scroll
      } else {
          // Disable scrolling during game
          body.style.touchAction = 'none';
          body.style.overflow = 'hidden';
      }
      
      return () => {
          body.style.touchAction = 'none'; // Revert to safe default on unmount
      };
  }, [uiGameState]);

  // Fetch User Data from Cloud (Source of Truth)
  // Wrapped in useCallback to be safe for dependency arrays if needed
  const fetchUserData = useCallback(async (userId: string) => {
      try {
          const { data, error } = await supabase
            .from('high_scores')
            .select('score, coins')
            .eq('user_id', userId)
            .single();
          
          if (data) {
              // 覆盖本地数据，防止篡改本地存储作弊
              setTotalCoins(data.coins || 0);
              setHighScore(data.score || 0);
              // 同步到本地备份，以备离线查看
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
        // Use ref to get latest total (guest)
        const currentTotal = totalCoinsRef.current;
        const newTotal = currentTotal + currentRunCoins;
        setTotalCoins(newTotal);
        setRunCoins(0); 
        localStorage.setItem('leap_orbit_coins', newTotal.toString());
        setUploadStatus({status: 'idle', msg: '未登录，仅保存本地'});
        return;
    }
    
    // 2. Auth Mode: Secure Server Sync
    // Important: We ignore 'totalCoins' from frontend state for the calculation 
    // to prevent local memory tampering. We fetch server state, add run coins, then save.
    
    setUploadStatus({status: 'uploading', msg: '正在同步数据...'});

    try {
        // Step A: Fetch current server state (Truth)
        const { data: serverData, error: fetchError } = await supabase
            .from('high_scores')
            .select('score, coins')
            .eq('user_id', currentSession.user.id)
            .single();

        let serverCoins = 0;
        let serverScore = 0;

        if (serverData) {
            serverCoins = serverData.coins || 0;
            serverScore = serverData.score || 0;
        } else if (fetchError && fetchError.code !== 'PGRST116') {
             throw fetchError; // Real error, not just "not found"
        }

        // Step B: Calculate New Truth
        const newTotalCoins = serverCoins + currentRunCoins;
        const newHighScore = Math.max(serverScore, score);

        let msg = '数据已同步';
        if (score > serverScore) {
             msg = '新纪录已保存！';
        } else if (serverScore > score) {
             const diff = serverScore - score + 1;
             msg = `再接再厉！还差 ${diff} 分就破记录了！`;
        }

        // Step C: Upsert to Database
        const { error: upsertError } = await supabase
        .from('high_scores')
        .upsert({
            user_id: currentSession.user.id,
            username: currentSession.user.user_metadata.username || currentSession.user.email?.split('@')[0] || 'Unknown',
            score: newHighScore,
            coins: newTotalCoins // SAVE THE COINS
        }, { onConflict: 'user_id' });
        
        if (upsertError) {
             if (upsertError.code === '42P01') setUploadStatus({status: 'error', msg: '云端表缺失'});
             else setUploadStatus({status: 'error', msg: '同步失败'});
        } else {
            // Step D: Update Frontend State to match Server (Success)
            setHighScore(newHighScore);
            setTotalCoins(newTotalCoins);
            setRunCoins(0); // Clear visual run coins
            localStorage.setItem('leap_orbit_coins', newTotalCoins.toString()); // Backup
            setUploadStatus({status: 'success', msg: msg});
        }
    } catch (err: any) {
        console.error(err);
        setUploadStatus({status: 'error', msg: '网络错误'});
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
    // Note: We moved fetchUserData out of here to handle it more granularly
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
             // If the user logs in while on the Game Over screen, 
             // automatically attempt to sync the result of the just-finished game.
             // We check uploadStatus to prevent infinite loops or double uploads if already successful.
             // 'idle' status here means it was processed as a Guest run locally, so we need to upgrade it to Cloud.
             if (uploadStatus.status === 'idle' || uploadStatus.status === 'error') {
                 // Use gameStats.coinsCollected because runCoins state might have been reset by the guest sync
                 syncData(scoreDisplay, gameStats.coinsCollected);
             }
        } else {
             // Normal login (e.g. Start Screen), just fetch the latest data
             fetchUserData(session.user.id);
        }
    }
  }, [session, uiGameState, fetchUserData, syncData, scoreDisplay, gameStats.coinsCollected, uploadStatus.status]);


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
    // Clear sensitive data on logout
    setTotalCoins(0);
    setHighScore(0);
    // Optionally re-read local guest data
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
      // 1. Remove remaining coins (or let them fade, but "restore" implies back to normal)
      // We will remove them to prevent easy farming after time ends
      entitiesRef.current = entitiesRef.current.filter(e => e.type !== 'coin');
      
      // 2. Respawn Safety Ring immediately
      spawnSafetyRing(orbitRef.current);
      
      // 3. Reset internal filling logic to allow normal spawning again
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
      // Don't spawn if in bonus mode
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
    if (isBonusTimeRef.current) return; // No ambience during bonus
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
        if (Math.random() > 0.15) return; // High spawn rate for coins
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

    // --- Fix: Safe Spawn Check for Enemies ---
    const spawnAngle = randomRange(0, Math.PI * 2);
    // Determine spawn position before creating entity
    if (type === 'enemy') {
        const ex = Math.cos(spawnAngle) * spawnDist;
        const ey = Math.sin(spawnAngle) * spawnDist;
        const dx = playerRef.current.x - ex;
        const dy = playerRef.current.y - ey;
        // Don't spawn enemy if it is too close to player (600px safe radius squared = 360000)
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
      gravity: PLAYER_CONFIG.gravity, // 重置重力，防止因奖励时间死亡导致的重力异常
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
    gameEndTimeRef.current = Date.now();
    gameStateRef.current = 'DYING';
    setUiGameState('DYING');
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
    const finalTotalScore = calculateCurrentTotalScore();
    setScoreDisplay(finalTotalScore);

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
    setHighScore(prev => Math.max(prev, finalTotalScore));

    // Sync Data (Score + Coins)
    syncData(finalTotalScore, coinsRef.current);
    
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
    
    // --- Bonus Time Logic (FIXED) ---
    // Calculate total score every frame to determine bonus trigger
    const currentTotalScore = calculateCurrentTotalScore();
    
    if (isBonusTimeRef.current) {
        bonusTimerRef.current--;
        // Update UI every 10 frames roughly
        if (bonusTimerRef.current % 10 === 0) setBonusTimeLeft(bonusTimerRef.current);
        
        if (bonusTimerRef.current <= 0) {
            endBonusMode();
        }
    } else {
        if (currentTotalScore !== scoreDisplay) setScoreDisplay(currentTotalScore);
        
        // Trigger check: when total score surpasses the next threshold (2000, 4000, etc.)
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
        // If in bonus time and hit hub -> immediate end
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
    
    // Determine the viewport dimension that restricts the view the most
    const fitDimension = Math.min(width, height);
    
    // Calculate how much space we need to show the player and a bit of margin
    // We want to ensure we see the player, and enough context around them
    // Base safety distance is roughly the player radius * 2 (diameter) + extra padding
    const requiredViewDiameter = (player.radius * 2) + (hasDash ? 400 : 300);
    
    // Calculate zoom based on fitting that diameter into the smallest screen dimension
    // We clamp it: 
    // - Max 1.2 (Don't zoom in too close)
    // - Min 0.3 (or 0.25 on very small screens) to allow seeing far out
    const targetZoom = Math.max(
        width < 600 ? 0.25 : 0.35, // Allow slightly more zoom out on mobile portrait
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

    particlesRef.current.forEach((p, i) => { p.x += p.vx; p.y += p.vy; p.life -= 0.038; if (p.life <= 0) particlesRef.current.splice(i, 1); });
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
            // 恢复道具的白色内芯 (coin 除外，金币是金色的)
            if (e.type !== 'score' && e.type !== 'coin') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, e.size*e.scale*0.4, 0, Math.PI*2); ctx.fill(); }
            // Coin details
            if (e.type === 'coin') {
                ctx.fillStyle = '#fff9c4'; 
                ctx.beginPath(); ctx.arc(0, 0, e.size*e.scale*0.4, 0, Math.PI*2); ctx.fill();
            }
        }
        ctx.restore();
    });
    ctx.globalAlpha = 1.0;

    particlesRef.current.forEach(p => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1.0; });
    floatingTextsRef.current.forEach(ft => { ctx.globalAlpha = Math.max(0, ft.life); ctx.fillStyle = ft.color; ctx.font = `bold ${ft.size}px monospace`; ctx.textAlign = 'center'; ctx.fillText(ft.text, ft.x, ft.y); });
    ctx.globalAlpha = 1.0;

    if (gameStateRef.current !== 'GAMEOVER' && gameStateRef.current !== 'DYING') {
        if (player.radius < 3000) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(player.x, player.y); ctx.strokeStyle = `rgba(0, 210, 255, ${Math.max(0, (0.2 - player.radius / 3000))})`; ctx.stroke(); }
        if (player.trail.length > 1) { ctx.beginPath(); ctx.moveTo(player.trail[0].x, player.trail[0].y); player.trail.forEach(t => ctx.lineTo(t.x, t.y)); ctx.strokeStyle = player.dashTime > 0 ? COLORS.dash : player.color; ctx.lineWidth = player.size * (player.dashTime > 0 ? 1.5 : 0.8); ctx.stroke(); }
        
        // 视觉特效：护盾
        if (player.shieldTime > 0) {
            ctx.save(); ctx.beginPath(); ctx.arc(player.x, player.y, player.size + 5, 0, Math.PI * 2);
            ctx.strokeStyle = COLORS.shield; ctx.lineWidth = 2; ctx.shadowColor = COLORS.shield; ctx.shadowBlur = 10;
            ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.01) * 0.2; ctx.stroke(); ctx.restore();
        }
        // 视觉特效：磁吸
        if (player.magnetTime > 0) {
            ctx.save(); ctx.beginPath(); ctx.arc(player.x, player.y, player.size + 20, 0, Math.PI * 2);
            ctx.strokeStyle = COLORS.magnet; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
            ctx.lineDashOffset = -Date.now() * 0.02; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.restore();
        }

        ctx.beginPath(); ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2); ctx.fillStyle = player.dashTime > 0 ? '#fff' : player.color; ctx.fill();
    }
    ctx.restore();

    if (gameStateRef.current === 'DYING') {
        const barHeight = height * 0.12;
        const progress = 1 - Math.pow(deathTimerRef.current / maxDeathTimerRef.current, 2);
        const currentBarHeight = barHeight * progress;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, currentBarHeight);
        ctx.fillRect(0, height - currentBarHeight, width, currentBarHeight);
        if (deathTimerRef.current < 25) {
            ctx.fillStyle = `rgba(0, 0, 0, ${1 - deathTimerRef.current / 25})`;
            ctx.fillRect(0, 0, width, height);
        }
    }
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
    <div ref={containerRef} className="relative w-full h-full font-sans select-none overflow-hidden bg-black">
        {/* Buff HUD - MOVED DOWN to avoid coin overlap */}
        <div className={`absolute top-14 left-4 flex flex-col gap-3 pointer-events-none z-20 transition-opacity duration-1000 ${uiGameState !== 'PLAYING' ? 'opacity-0' : 'opacity-100'}`}>
            <div className={`flex items-center gap-2 transition-all duration-300 ${buffs.shield > 0 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500 shadow-[0_0_10px_#00ff00]">
                    <Shield size={16} className="text-green-400" />
                </div>
                <span className="text-green-400 font-bold tracking-wider text-sm shadow-black drop-shadow-md">护盾 {Math.ceil(buffs.shield / 60)}s</span>
            </div>
            <div className={`flex items-center gap-2 transition-all duration-300 ${buffs.magnet > 0 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500 shadow-[0_0_10px_#bf00ff]">
                    <Zap size={16} className="text-purple-400" />
                </div>
                <span className="text-purple-400 font-bold tracking-wider text-sm shadow-black drop-shadow-md">磁吸 {Math.ceil(buffs.magnet / 60)}s</span>
            </div>
             <div className={`flex items-center gap-2 transition-all duration-300 ${buffs.dash > 0 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center border border-orange-500 shadow-[0_0_10px_#f97316]">
                    <Flame size={16} className="text-orange-400" />
                </div>
                <span className="text-orange-400 font-bold tracking-wider text-sm shadow-black drop-shadow-md">冲刺 {Math.ceil(buffs.dash / 60)}s</span>
            </div>
        </div>

        {/* Coin HUD (Left Top) */}
        <div className="absolute top-4 left-4 z-30 pointer-events-none">
             <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5 border border-yellow-500/30 mb-2">
                <Coins size={16} className="text-yellow-400" />
                <span className="text-yellow-100 font-mono font-bold text-sm">{(totalCoins + runCoins).toLocaleString()}</span>
             </div>
        </div>

        {/* Orbit Counter HUD */}
        {(uiGameState === 'PLAYING') && (
             <div className="absolute top-4 right-4 flex items-center gap-2 pointer-events-none z-20">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500 shadow-[0_0_10px_#00d2ff]">
                    <RotateCw size={16} className="text-blue-400" />
                </div>
                <span className="text-blue-400 font-bold tracking-wider text-sm shadow-black drop-shadow-md">第 {orbitCountDisplay} 圈</span>
            </div>
        )}

        {/* Score HUD */}
        {uiGameState === 'PLAYING' && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 pointer-events-none z-10 flex flex-col items-center animate-in fade-in duration-1000">
                <span className="text-6xl font-black text-white tracking-tighter" style={{ textShadow: '0 0 20px rgba(0,210,255,0.6)'}}>{scoreDisplay.toLocaleString()}</span>
                <span className="text-xs text-cyan-400/60 font-mono tracking-widest uppercase">Score</span>
                
                {/* Bonus Time Indicator */}
                <div className={`mt-2 transition-all duration-300 ${isBonusTimeUI ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                    <div className="bg-yellow-500/20 border border-yellow-400/50 rounded-full px-4 py-1 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />
                        <span className="text-yellow-300 font-bold font-mono tracking-widest text-sm">奖励时间 {(bonusTimeLeft/60).toFixed(1)}s</span>
                    </div>
                </div>
            </div>
        )}

        {/* Start Screen (Dashboard Redesign) */}
        {uiGameState === 'START' && (
            <div className="absolute inset-0 z-30 flex flex-col bg-black/40 backdrop-blur-sm animate-in fade-in duration-500 overflow-y-auto touch-pan-y overscroll-contain">
                <div className="min-h-full flex flex-col">
                    {/* --- Top Bar: Profile & Assets --- */}
                    <div className="w-full flex justify-between items-center p-4 md:p-6 pb-2 safe-area-top">
                        {/* Left: User Profile */}
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-cyan-900/40 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                                <UserCircle size={18} className="md:w-5 md:h-5 text-cyan-400" />
                            </div>
                            <div className="flex flex-col">
                                {session ? (
                                    <>
                                        <span className="text-xs md:text-sm font-bold text-white tracking-wide">{session.user.user_metadata.username || '玩家'}</span>
                                        <button onClick={handleLogout} className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 uppercase tracking-wider">
                                            <LogOut size={10} /> 退出登录
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={() => setShowAuthModal(true)} className="text-xs text-cyan-400 font-bold hover:underline">
                                        点击登录
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Right: Coins */}
                        <div className="flex flex-col items-end">
                            <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full border border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.1)]">
                                <Coins size={14} className="text-yellow-400" />
                                <span className="text-yellow-400 font-mono font-bold text-sm tracking-widest">{totalCoins.toLocaleString()}</span>
                            </div>
                            <span className="text-[10px] text-yellow-500/50 uppercase tracking-widest mt-1 mr-2">金币</span>
                        </div>
                    </div>

                    {/* --- Center Stage: Title & Play --- */}
                    <div className="flex-1 flex flex-col items-center justify-center relative py-8">
                        <div className="relative z-10 text-center mb-8 md:mb-12 px-4">
                            <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter bg-gradient-to-br from-cyan-300 via-blue-500 to-purple-600 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(34,211,238,0.4)] transform -rotate-2">
                                跃迁轨道
                            </h1>
                            <div className="flex items-center justify-center gap-3 mt-2 opacity-80">
                                <div className="h-[1px] w-8 md:w-12 bg-gradient-to-r from-transparent to-cyan-500"></div>
                                <span className="text-[10px] md:text-xs font-mono text-cyan-500 tracking-[0.2em]">{GAME_VERSION}</span>
                                <div className="h-[1px] w-8 md:w-12 bg-gradient-to-l from-transparent to-cyan-500"></div>
                            </div>
                        </div>

                        <button 
                            onClick={startGame} 
                            className="group relative w-20 h-20 md:w-24 md:h-24 rounded-full bg-cyan-500/10 border border-cyan-400/50 flex items-center justify-center transition-all hover:scale-110 active:scale-95 hover:bg-cyan-500/20"
                        >
                            {/* Pulse Ring 1 */}
                            <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-ping opacity-20"></div>
                            {/* Pulse Ring 2 */}
                            <div className="absolute -inset-2 rounded-full border border-cyan-500/10 animate-pulse"></div>
                            
                            <Play size={28} className="md:w-8 md:h-8 fill-cyan-400 text-cyan-400 ml-1 group-hover:drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] transition-all" />
                        </button>
                        <span className="mt-4 text-xs text-cyan-400/60 font-mono tracking-widest uppercase animate-pulse">开始游戏</span>
                        
                        <div className="mt-6 md:mt-8 text-xs text-slate-500 flex flex-col items-center gap-1 opacity-60">
                            <p>长按旋转前进</p>
                            <p>躲避红刺 · 收集光点</p>
                        </div>
                    </div>

                    {/* --- Bottom Dock: Navigation --- */}
                    <div className="w-full px-4 md:px-6 pb-6 md:pb-8 safe-area-bottom">
                        <div className="flex items-center justify-around bg-neutral-900/80 backdrop-blur-xl border border-white/5 rounded-2xl p-2 shadow-2xl mx-auto max-w-sm md:max-w-md">
                            {/* Leaderboard */}
                            <button onClick={openLeaderboard} className="flex flex-col items-center gap-1 p-2 md:p-3 rounded-xl hover:bg-white/5 transition-colors group w-16 md:w-20">
                                <Trophy size={18} className="md:w-5 md:h-5 text-slate-400 group-hover:text-yellow-400 transition-colors" />
                                <span className="text-[9px] md:text-[10px] text-slate-500 font-bold group-hover:text-slate-300">排行榜</span>
                            </button>

                            {/* Shop (Center Highlight) */}
                            <button onClick={openShop} className="flex flex-col items-center gap-1 p-2 md:p-3 rounded-xl hover:bg-white/5 transition-colors group w-16 md:w-20 relative -top-5 md:-top-6">
                                <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-[0_5px_15px_rgba(124,58,237,0.4)] border border-white/10 group-hover:scale-110 transition-transform">
                                    <ShoppingBag size={20} className="md:w-[22px] md:h-[22px] text-white" />
                                </div>
                                <span className="text-[9px] md:text-[10px] text-purple-400 font-bold mt-1">商店</span>
                            </button>

                            {/* Status (Cloud Connection Indicator) */}
                            <div className="flex flex-col items-center gap-1 p-2 md:p-3 rounded-xl w-16 md:w-20 opacity-50">
                                {systemStatus.status === 'checking' && <Loader2 size={18} className="md:w-5 md:h-5 animate-spin text-slate-500" />}
                                {systemStatus.status === 'ok' && <Cloud size={18} className="md:w-5 md:h-5 text-green-500" />}
                                {systemStatus.status === 'error' && <CloudOff size={18} className="md:w-5 md:h-5 text-red-500" />}
                                <span className="text-[9px] md:text-[10px] text-slate-500 font-bold">
                                    {systemStatus.status === 'checking' ? '上云中…' : (systemStatus.status === 'ok' ? '已连接云' : '本地离线')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Auth Modal */}
        {showAuthModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in overflow-y-auto touch-pan-y overscroll-contain">
                <div className="w-full max-w-xs bg-neutral-900 border border-cyan-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(6,182,212,0.15)] relative my-auto">
                    <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20}/></button>
                    {/* Updated Title */}
                    <h2 className="text-xl font-bold text-white mb-6 text-center">{authMode === 'login' ? '登录' : '注册'}</h2>
                    
                    {authError && (
                        <div className="mb-4 p-2 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-200 flex items-center gap-2">
                           <AlertTriangle size={12}/> {authError}
                        </div>
                    )}

                    <form onSubmit={handleAuth} className="space-y-4">
                        {authMode === 'signup' && (
                             <div>
                                <label className="block text-xs text-slate-400 mb-1">用户名</label>
                                <input type="text" required value={authUsername} onChange={e => setAuthUsername(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none transition-colors" />
                            </div>
                        )}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">电子邮箱</label>
                            <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none transition-colors" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">密码</label>
                            <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none transition-colors" />
                        </div>
                        <button type="submit" disabled={authLoading} className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 mt-2">
                            {authLoading ? <Loader2 size={16} className="animate-spin"/> : (authMode === 'login' ? '登录游戏' : '注册账号')}
                        </button>
                    </form>
                    
                    <div className="mt-4 text-center text-xs text-slate-500">
                        {authMode === 'login' ? '没有账号? ' : '已有账号? '}
                        <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-cyan-400 hover:underline">
                            {authMode === 'login' ? '立即注册' : '点我登录'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Leaderboard Modal */}
        {showLeaderboard && (
             <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in touch-pan-y overscroll-contain">
                <div className="w-full max-w-sm bg-neutral-900 border border-yellow-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(234,179,8,0.15)] relative h-[70vh] max-h-[600px] flex flex-col">
                    <button onClick={() => setShowLeaderboard(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20}/></button>
                    <div className="flex items-center justify-center gap-2 mb-6">
                        <Trophy className="text-yellow-500" size={24} />
                        {/* Updated Title */}
                        <h2 className="text-xl font-bold text-white tracking-wider">排行榜</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar touch-pan-y">
                        {leaderboardLoading ? (
                            <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-2">
                                <Loader2 size={24} className="animate-spin"/>
                                <span className="text-xs">加速载入中...</span>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="grid grid-cols-12 text-xs text-slate-500 pb-2 border-b border-white/10 px-2">
                                    <div className="col-span-2 text-center">排名</div>
                                    {/* Updated Header */}
                                    <div className="col-span-6">玩家</div>
                                    <div className="col-span-4 text-right">分数</div>
                                </div>
                                {leaderboardData.map((entry, index) => {
                                    let rankColor = "text-slate-400";
                                    let rankBg = "bg-white/5";
                                    if(index === 0) { rankColor = "text-yellow-400"; rankBg = "bg-yellow-500/10 border border-yellow-500/30"; }
                                    else if(index === 1) { rankColor = "text-slate-300"; rankBg = "bg-slate-400/10 border border-slate-400/30"; }
                                    else if(index === 2) { rankColor = "text-orange-400"; rankBg = "bg-orange-600/10 border border-orange-600/30"; }

                                    return (
                                        <div key={index} className={`grid grid-cols-12 items-center p-3 rounded-lg ${rankBg} text-sm`}>
                                            <div className={`col-span-2 text-center font-bold ${rankColor}`}>#{index + 1}</div>
                                            <div className="col-span-6 font-mono text-white truncate pr-2">{entry.username}</div>
                                            <div className={`col-span-4 text-right font-mono font-bold ${rankColor}`}>{entry.score.toLocaleString()}</div>
                                        </div>
                                    )
                                })}
                                {leaderboardData.length === 0 && (
                                    <div className="text-center py-8 text-slate-600 text-sm">暂无记录，虚位以待</div>
                                )}
                            </div>
                        )}
                    </div>
                     <div className="mt-4 pt-4 border-t border-white/10 text-center text-xs text-slate-500">
                        {/* Updated Footer */}
                        仅展示全球前10名玩家分数
                    </div>
                </div>
             </div>
        )}

        {/* Game Over Screen */}
        {uiGameState === 'GAMEOVER' && (
            <div className="absolute inset-0 flex items-center justify-center z-30 bg-red-900/20 backdrop-blur-sm p-4 overflow-y-auto touch-pan-y overscroll-contain">
                <div className="text-center p-6 border border-red-500/30 rounded-2xl bg-black/90 shadow-2xl w-full max-w-sm mx-auto transform transition-all animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar touch-pan-y">
                    <div className="inline-block p-3 rounded-full bg-red-500/20 mb-4 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                        <Skull size={32} className="text-red-500" />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-6">游戏结束</h2>
                    
                    <div className="space-y-2 mb-6 text-left">
                        <div className="flex justify-between items-center text-sm p-2 bg-white/5 rounded border border-white/5">
                            <span className="text-slate-400 flex items-center gap-2"><Target size={14} className="text-cyan-400"/> 游戏得分</span>
                            <span className="font-mono text-cyan-400">+{gameStats.actionScore}</span>
                        </div>
                        {/* Restore Survival Score */}
                        <div className="flex justify-between items-center text-sm p-2 bg-white/5 rounded border border-white/5">
                            <span className="text-slate-400 flex items-center gap-2"><Clock size={14} className="text-green-400"/> 生存得分 ({gameStats.formattedDuration})</span>
                            <span className="font-mono text-green-400">+{gameStats.timeScore}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm p-2 bg-white/5 rounded border border-white/5">
                            <span className="text-slate-400 flex items-center gap-2"><Hash size={14} className="text-yellow-400"/> 圈数得分 ({gameStats.finalOrbit} 圈)</span>
                            <span className="font-mono text-yellow-400">+{gameStats.orbitBonus}</span>
                        </div>
                         {/* Coins moved here */}
                        <div className="flex justify-between items-center text-sm p-2 bg-white/5 rounded border border-white/5">
                            <span className="text-slate-400 flex items-center gap-2"><Coins size={14} className="text-yellow-400"/> 获得金币</span>
                            <span className="font-mono text-yellow-400">+{gameStats.coinsCollected}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs px-2 pt-2 text-slate-500 italic">
                            <span>全局倍率加成</span>
                            <span>x{gameStats.multiplier.toFixed(1)}</span>
                        </div>
                        <div className="border-t border-white/20 pt-4 mt-2">
                             <div className="flex justify-between items-end">
                                <span className="text-xs text-slate-400 uppercase font-bold">最终总分</span>
                                <span className="text-4xl font-black text-white shadow-cyan-500 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
                                    {scoreDisplay.toLocaleString()}
                                </span>
                             </div>
                        </div>

                        {/* Upload Status Feedback with Retry Button */}
                        {session ? (
                            <div className="flex flex-col gap-2 mt-3">
                                <div className={`text-center text-xs py-2 rounded flex items-center justify-center gap-2 transition-colors ${
                                    uploadStatus.status === 'success' ? 'bg-green-900/30 text-green-400' :
                                    uploadStatus.status === 'error' ? 'bg-red-900/30 text-red-400' :
                                    'bg-blue-900/30 text-blue-400'
                                }`}>
                                    {(uploadStatus.status === 'uploading' || uploadStatus.status === 'idle') && <Loader2 size={12} className="animate-spin" />}
                                    {uploadStatus.status === 'success' && <CheckCircle size={12} />}
                                    {uploadStatus.status === 'error' && <AlertTriangle size={12} />}
                                    <span>{uploadStatus.msg || (uploadStatus.status === 'idle' ? '准备上传...' : '')}</span>
                                </div>
                                {/* Retry Button */}
                                {(uploadStatus.status === 'error' || uploadStatus.status === 'idle') && (
                                    <button onClick={() => syncData(scoreDisplay, runCoins)} className="text-xs bg-white/10 py-1.5 rounded hover:bg-white/20 transition-colors flex items-center justify-center gap-1 text-slate-300">
                                        <UploadCloud size={12} /> 重试上传
                                    </button>
                                )}
                            </div>
                        ) : (
                            <button onClick={() => setShowAuthModal(true)} className="w-full text-center text-xs text-cyan-400/80 mt-2 bg-cyan-900/20 py-2 rounded hover:bg-cyan-900/40 transition-colors border border-cyan-500/20">
                                点我登录以同步分数至云端，与全球玩家PK霸榜
                            </button>
                        )}
                    </div>

                    <div className="bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20 mb-6 flex items-center justify-center gap-2">
                        <Trophy size={16} className="text-yellow-500" /> 
                        <span className="text-xs text-slate-400 uppercase font-bold">历史最高记录</span>
                        <span className="font-mono font-bold text-yellow-500">{highScore.toLocaleString()}</span>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={openLeaderboard} className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-full transition-all flex items-center justify-center gap-2 text-sm border border-white/10">
                            <Award size={16} /> 排行榜
                        </button>
                        <button onClick={startGame} className="flex-[2] py-3 bg-white hover:bg-slate-200 text-black font-bold rounded-full transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2">
                            <RefreshCw size={18} /> 再来一次
                        </button>
                    </div>
                </div>
            </div>
        )}

        <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair active:cursor-grabbing" />
    </div>
  );
};