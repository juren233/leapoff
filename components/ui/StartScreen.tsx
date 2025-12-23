import React, { useMemo } from 'react';
import { User, LogOut, Coins, Play, Trophy, ShoppingBag, Activity, Wifi, ShieldAlert, Zap, Hexagon, Settings } from 'lucide-react';
import { GAME_VERSION } from '../../constants';
import { SystemStatus, ThemeType } from '../../types';

interface StartScreenProps {
  session: any;
  totalCoins: number;
  systemStatus: SystemStatus;
  theme: ThemeType; // Added theme prop
  onStart: () => void;
  onLogout: () => void;
  onAuthOpen: () => void;
  onLeaderboardOpen: () => void;
  onShopOpen: () => void;
  onSettingsOpen: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  session,
  totalCoins,
  systemStatus,
  theme,
  onStart,
  onLogout,
  onAuthOpen,
  onLeaderboardOpen,
  onShopOpen,
  onSettingsOpen
}) => {
  const isChristmas = theme === 'christmas';
  
  // Theme-based colors
  const primaryColor = isChristmas ? 'text-red-500' : 'text-cyan-500';
  const primaryColorBg = isChristmas ? 'bg-red-500' : 'bg-cyan-500';
  const primaryColorBorder = isChristmas ? 'border-red-500' : 'border-cyan-500';
  const accentColor = isChristmas ? 'text-green-400' : 'text-cyan-400';

  // Generate Snow Particles (Memoized to prevent re-calc on every render)
  const snowParticles = useMemo(() => {
    if (!isChristmas) return [];
    
    const particles = [];
    // 大幅增加数量到 150，营造大雪纷飞的感觉
    const count = 150; 
    
    for (let i = 0; i < count; i++) {
        const layer = Math.random(); // 0-1 用于决定层次
        
        let size, duration, opacity, blur;

        // 20% 近景大雪花 (模糊，快速，非常大)
        if (layer > 0.8) {
            size = Math.random() * 8 + 8; // 8px - 16px (很大!)
            duration = Math.random() * 3 + 3; // 3-6s (较快)
            opacity = Math.random() * 0.3 + 0.7; // 0.7 - 1.0 (非常亮)
            blur = '2px'; // 动感模糊
        } 
        // 50% 中景雪花 (清晰，明亮，中等大小)
        else if (layer > 0.3) {
            size = Math.random() * 4 + 4; // 4px - 8px (肉眼清晰可见)
            duration = Math.random() * 5 + 5; // 5-10s
            opacity = Math.random() * 0.3 + 0.6; // 0.6 - 0.9 (很亮)
            blur = '0px'; // 清晰
        } 
        // 30% 远景雪花 (作为氛围点缀)
        else {
            size = Math.random() * 2 + 2; // 2px - 4px
            duration = Math.random() * 8 + 8; // 8-16s (慢)
            opacity = Math.random() * 0.4 + 0.2; // 0.2 - 0.6
            blur = '0px';
        }

        particles.push({
            id: i,
            left: Math.random() * 100,
            size,
            duration,
            delay: Math.random() * -20, // 负延迟，保证一开始满屏都是雪
            opacity,
            blur
        });
    }
    return particles;
  }, [isChristmas]);

  return (
    // Changed background to opaque dark theme to separate from game view
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden bg-[#050505] text-white font-sans selection:bg-cyan-500/30 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:pt-0 md:pb-0">
      
      {/* --- CSS for Custom Animations --- */}
      <style>{`
        @keyframes grid-move {
          0% { transform: perspective(500px) rotateX(60deg) translateY(0); }
          100% { transform: perspective(500px) rotateX(60deg) translateY(40px); }
        }
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-20px) scale(1.2); opacity: 0.8; }
        }
        
        @keyframes snowfall {
            0% { 
                transform: translateY(-20vh); 
                opacity: 0; 
            }
            10% { opacity: var(--target-opacity); }
            100% { 
                transform: translateY(110vh); 
                opacity: 0; 
            }
        }
        
        /* Gentle Pendulum Swing for the Bauble */
        @keyframes bauble-sway {
          0%, 100% { transform: rotate(3deg); }
          50% { transform: rotate(-3deg); }
        }

        .animate-grid {
          animation: grid-move 2s linear infinite;
        }
        .animate-float-1 { animation: float-particle 4s ease-in-out infinite; }
        .animate-float-2 { animation: float-particle 5s ease-in-out infinite 1s; }
        .animate-float-3 { animation: float-particle 6s ease-in-out infinite 2s; }
        
        .snow-particle {
            position: absolute;
            /* 增强的径向渐变，中心极亮 */
            background: radial-gradient(circle at 35% 35%, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 40%, rgba(255,255,255,0) 100%);
            border-radius: 50%;
            animation: snowfall linear infinite;
            /* 强力辉光，让雪花在暗背景下发光 */
            box-shadow: 0 0 6px 1px rgba(255, 255, 255, 0.6);
            pointer-events: none;
            will-change: transform, opacity;
        }

        /* Silver Metal Gradient */
        .metal-silver {
            background: linear-gradient(90deg, #cbd5e1 0%, #f1f5f9 50%, #94a3b8 100%);
        }

        .clip-corner-br {
          clip-path: polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%);
        }
        .clip-corner-bl {
          clip-path: polygon(0 0, 100% 0, 100% 100%, 12px 100%, 0 calc(100% - 12px));
        }
        /* Background decorative elements */
        .bg-tech-pattern {
            background-image: radial-gradient(${isChristmas ? 'rgba(239,68,68,0.1)' : 'rgba(6,182,212,0.1)'} 1px, transparent 1px);
            background-size: 30px 30px;
        }
      `}</style>

      {/* --- SEPARATE BACKGROUND DESIGN --- */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
        
        {/* 1. Deep Space Base (Christmas uses deep red/green hint) */}
        {isChristmas ? (
             // Christmas Gradient: Elegant Deep Red/Black
             <div className="absolute inset-0 bg-gradient-to-b from-[#1a0505] via-[#2a0a0a] to-[#0f0505]"></div>
        ) : (
             <div className="absolute inset-0 bg-gradient-to-b from-[#020617] via-[#050505] to-[#0a0a0a]"></div>
        )}
        
        {/* 2. Top Spotlight / Sun effect */}
        <div className={`absolute top-[-20%] left-1/2 -translate-x-1/2 w-[80%] h-[50%] blur-[100px] rounded-full ${isChristmas ? 'bg-red-600/10' : 'bg-cyan-900/20'}`}></div>

        {/* 3. Tech Dots Pattern */}
        <div className="absolute inset-0 bg-tech-pattern opacity-30"></div>

        {/* 4. Retro-wave Grid Floor (Enhanced visibility) */}
        <div className="absolute bottom-[-25%] left-[-50%] w-[200%] h-[80%] opacity-40 animate-grid origin-bottom">
           <div className={`w-full h-full bg-[size:50px_50px] [mask-image:linear-gradient(to_top,black_60%,transparent_100%)] ${isChristmas ? 
             'bg-[linear-gradient(to_right,rgba(239,68,68,0.2)_1px,transparent_1px),linear-gradient(to_bottom,rgba(239,68,68,0.2)_1px,transparent_1px)]' : 
             'bg-[linear-gradient(to_right,rgba(34,211,238,0.2)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,211,238,0.2)_1px,transparent_1px)]'
           }`}></div>
        </div>
        
        {/* 5. Decorative Floating Particles (CSS Only) */}
        {isChristmas ? (
            <>
               {/* Enhanced Snowfall Effect - Rendered Here */}
               {snowParticles.map((p) => (
                   <div 
                     key={p.id} 
                     className="snow-particle"
                     style={{
                        left: `${p.left}%`,
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        animationDuration: `${p.duration}s`,
                        animationDelay: `${p.delay}s`,
                        filter: `blur(${p.blur})`, // Drop shadow moved to CSS class for performance
                        opacity: p.opacity,
                        // Pass opacity to CSS variable if needed, but direct style works better for simplicity here
                        ['--target-opacity' as any]: p.opacity,
                     }}
                   ></div>
               ))}
               
               {/* Subtle "Northern Lights" Glow at bottom */}
               <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-green-500/10 via-red-500/5 to-transparent blur-3xl opacity-40"></div>
            </>
        ) : (
            <>
                <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-cyan-500 rounded-full blur-[2px] animate-float-1"></div>
                <div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 bg-purple-500 rounded-full blur-[1px] animate-float-2"></div>
                <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-white rounded-full blur-[0px] animate-float-3"></div>
            </>
        )}


        {/* 6. Vignette & Border Lines */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]"></div>
        <div className={`absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-transparent to-transparent ${isChristmas ? 'via-red-500/30' : 'via-cyan-500/30'}`}></div>
        <div className={`absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-transparent to-transparent ${isChristmas ? 'via-red-500/30' : 'via-cyan-500/30'}`}></div>
      </div>

      {/* --- HUD: TOP LEFT (Profile / Settings) --- */}
      {/* Mobile: Smaller padding (p-4), Desktop: p-10 */}
      <div className="absolute top-0 left-0 p-4 md:p-10 z-20 flex flex-col items-start gap-3 md:gap-4 animate-in slide-in-from-left duration-700 mt-[env(safe-area-inset-top)] ml-[env(safe-area-inset-left)] md:mt-0 md:ml-0">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative group cursor-pointer" onClick={onSettingsOpen}>
            {/* Mobile: w-9 h-9, Desktop: w-12 h-12 */}
            <div className={`w-9 h-9 md:w-12 md:h-12 border ${isChristmas ? 'border-red-500/30 bg-red-950/30 group-hover:bg-red-500/20 group-hover:border-red-400' : 'border-cyan-500/30 bg-cyan-950/30 group-hover:bg-cyan-500/20 group-hover:border-cyan-400'} flex items-center justify-center clip-corner-br transition-all duration-300 group-active:scale-95`}>
               <User size={16} className={`${isChristmas ? 'text-red-400' : 'text-cyan-400'} md:w-5 md:h-5`} />
            </div>
            {/* Tech Decoration */}
            <div className={`absolute -bottom-1 -right-1 w-1.5 h-1.5 md:w-2 md:h-2 transition-all ${isChristmas ? 'bg-red-500 group-hover:bg-red-300' : 'bg-cyan-500 group-hover:bg-cyan-300'}`}></div>
            
            {/* Settings Hint Tooltip (Desktop) */}
            <div className="hidden md:block absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/80 border border-white/10 rounded text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              设置
            </div>
          </div>
          
          <div className="flex flex-col">
            {/* Hide '玩家' label if logged in */}
            {!session && <span className={`text-[9px] md:text-[10px] ${isChristmas ? 'text-red-500/60' : 'text-cyan-500/60'} font-mono tracking-widest uppercase mb-0.5`}>玩家</span>}
            {session ? (
              <div className="flex flex-col">
                <span className="text-xs md:text-lg font-bold text-white tracking-wide uppercase">{session.user.user_metadata.username || '玩家'}</span>
                <div 
                  onClick={onLogout}
                  className="text-[9px] md:text-[10px] text-red-400 hover:bg-red-500/10 cursor-pointer w-max px-1 py-0.5 mt-1 border border-red-500/20 hover:border-red-500 transition-colors"
                >
                  退出登录
                </div>
              </div>
            ) : (
              <button onClick={onAuthOpen} className={`text-xs md:text-sm font-bold hover:text-black transition-colors px-2 py-0.5 border ${isChristmas ? 'text-red-400 hover:bg-red-400 border-red-400/50' : 'text-cyan-400 hover:bg-cyan-400 border-cyan-400/50'}`}>
                点击登录
              </button>
            )}
          </div>
        </div>
      </div>

      {/* --- HUD: TOP RIGHT (Resources) --- */}
      <div className="absolute top-0 right-0 p-4 md:p-10 z-20 flex flex-col items-end gap-1 animate-in slide-in-from-right duration-700 mt-[env(safe-area-inset-top)] mr-[env(safe-area-inset-right)] md:mt-0 md:mr-0">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex flex-col items-end">
             <span className="text-[9px] md:text-[10px] text-yellow-500/60 font-mono tracking-widest uppercase">我的金币</span>
             {/* Mobile: text-lg, Desktop: text-3xl */}
             <span className="text-lg md:text-3xl font-black text-yellow-400 font-mono tracking-tighter drop-shadow-[0_0_10px_rgba(250,204,21,0.4)]">
               {totalCoins.toLocaleString().padStart(6, '0')}
             </span>
          </div>
          <Coins size={20} className="text-yellow-500 opacity-80 md:w-6 md:h-6" />
        </div>
        <div className="w-24 md:w-32 h-[1px] md:h-[2px] bg-gradient-to-l from-yellow-500/50 to-transparent mt-1"></div>
      </div>

      {/* --- HUD: CENTER (Title & Start) --- */}
      <div className="relative z-20 flex flex-col items-center justify-center w-full">
        
        {/* Title Block */}
        <div className="relative text-center mb-10 md:mb-16 group cursor-default">
           {/* Glitch Effect Duplicate */}
           {/* Mobile: text-5xl, Desktop: text-9xl */}
           <h1 className={`absolute inset-0 text-5xl md:text-9xl font-black italic tracking-tighter blur-sm translate-x-1 translate-y-1 animate-pulse select-none ${isChristmas ? 'text-red-500/30' : 'text-cyan-500/20'}`}>
             LEAP OFF
           </h1>
           <h1 className={`relative text-5xl md:text-9xl font-black italic tracking-tighter text-white mix-blend-screen select-none ${isChristmas ? 'drop-shadow-[0_0_30px_rgba(239,68,68,0.6)]' : 'drop-shadow-[0_0_30px_rgba(6,182,212,0.6)]'}`}>
             LEAP <span className={isChristmas ? 'text-red-500' : 'text-cyan-400'}>OFF</span>
           </h1>
           
           <div className="flex items-center justify-between w-full mt-2 md:mt-4 px-2 opacity-60">
             <span className={`text-[8px] md:text-[10px] font-mono ${isChristmas ? 'text-green-500' : 'text-cyan-500'}`}>{GAME_VERSION}</span>
             <div className="flex gap-1">
                <span className={`w-6 md:w-8 h-[2px] ${isChristmas ? 'bg-red-500' : 'bg-cyan-500'}`}></span>
                <span className={`w-1.5 md:w-2 h-[2px] ${isChristmas ? 'bg-green-500' : 'bg-cyan-500/50'}`}></span>
                <span className={`w-1.5 md:w-2 h-[2px] ${isChristmas ? 'bg-white' : 'bg-cyan-500/20'}`}></span>
             </div>
             <span className={`text-[8px] md:text-[10px] font-mono uppercase ${isChristmas ? 'text-red-400' : 'text-cyan-500'}`}>{systemStatus.status === 'ok' ? '云端数据' : '离线模式'}</span>
           </div>
        </div>

        {/* The Core Trigger Button - SWAYING CONTAINER */}
        {/* 
            CRITICAL FIX: 
            origin-[50%_-8rem] sets the rotation pivot 8rem (approx 128px) ABOVE the center of the element.
            Since the string is h-32 (8rem) and positioned -top-32, this sets the pivot exactly at the top of the string.
        */}
        <div className={`relative ${isChristmas ? 'animate-[bauble-sway_4s_ease-in-out_infinite] origin-[50%_-8rem]' : ''}`}>
        
            {isChristmas && (
                <>
                    {/* The String (Hanging Thread) - RESTORED ORIGINAL */}
                    <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[1px] h-32 bg-gradient-to-b from-transparent via-yellow-200 to-yellow-500 shadow-[0_0_2px_rgba(250,204,21,0.5)]"></div>
                    
                    {/* The Metal Cap (Ornamet Top) - RESTORED ORIGINAL */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-4 metal-silver rounded-sm z-0 shadow-sm border-b border-black/20">
                         {/* Ridges on cap */}
                         <div className="w-full h-full flex justify-center gap-0.5 opacity-30">
                            <div className="w-[1px] h-full bg-black"></div>
                            <div className="w-[1px] h-full bg-black"></div>
                            <div className="w-[1px] h-full bg-black"></div>
                         </div>
                         {/* Hook Loop */}
                         <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-slate-300"></div>
                    </div>
                </>
            )}

            <button 
              onClick={onStart}
              // Mobile: w-24 h-24, Desktop: w-36 h-36
              className={`group relative w-24 h-24 md:w-36 md:h-36 flex items-center justify-center outline-none transition-transform duration-300 ${isChristmas ? 'hover:scale-105 active:scale-95 z-10' : 'hover:scale-105'}`}
            >
               {isChristmas ? (
                 <>
                   {/* --- GREEN BAUBLE CONTAINER + NEW DUOLINGO-STYLE ART --- */}
                   
                   {/* 1. Ambient Glow (Soft Green) */}
                   <div className="absolute -inset-6 rounded-full bg-green-500/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

                   {/* 2. The Sphere (Glazed GREEN Ceramic/Metal) */}
                   <div className="relative z-10 w-full h-full rounded-full overflow-hidden shadow-[inset_0_-8px_20px_rgba(0,0,0,0.6),0_15px_30px_rgba(0,0,0,0.4)]">
                      
                      {/* Base: Deep Metallic Green Gradient */}
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#16a34a,#15803d,#052e16)]"></div>
                      
                      {/* 3. Decoration: Subtle Background Snowflake */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-10 mix-blend-overlay scale-125 pointer-events-none">
                         <svg viewBox="0 0 100 100" className="w-full h-full fill-white">
                             <path d="M50 0 L55 35 L90 20 L65 50 L90 80 L55 65 L50 100 L45 65 L10 80 L35 50 L10 20 L45 35 Z" />
                         </svg>
                      </div>
                      
                      {/* 4. Glossy Highlight */}
                      <div className="absolute top-2 left-3 w-1/2 h-1/3 bg-gradient-to-br from-white/40 to-transparent rounded-full blur-[2px]"></div>

                      {/* 5. Center Icon: DUOLINGO STYLE FLAT VECTOR SANTA */}
                      <div className="absolute inset-0 flex items-center justify-center pt-2">
                          <svg viewBox="0 0 100 100" className="w-[70%] h-[70%] drop-shadow-md">
                              
                              {/* 1. Face/Beard Base (Squishy Cloud Shape) */}
                              <path d="M15,50 Q15,90 50,90 Q85,90 85,50 Q85,30 50,30 Q15,30 15,50" fill="white" />
                              
                              {/* Skin Face Area */}
                              <rect x="25" y="35" width="50" height="35" rx="15" fill="#ffcea5" />

                              {/* 2. Hat (Floppy Red Bag - Red contrasts with Green ball) */}
                              <path d="M15,35 Q15,-10 50,-5 Q85,-10 85,35" fill="#ef4444" />
                              
                              {/* Hat Brim */}
                              <rect x="12" y="28" width="76" height="14" rx="7" fill="white" />
                              
                              {/* 3. Facial Features */}
                              {/* Eyes */}
                              <circle cx="38" cy="48" r="4" fill="#1a1a1a" />
                              <circle cx="62" cy="48" r="4" fill="#1a1a1a" />
                              
                              {/* Nose */}
                              <ellipse cx="50" cy="54" rx="6" ry="5" fill="#fca5a5" />

                              {/* Mustache (Clouds) */}
                              <path d="M50,60 Q30,60 25,70 Q35,80 50,70" fill="white" />
                              <path d="M50,60 Q70,60 75,70 Q65,80 50,70" fill="white" />
                              
                              {/* Pompom */}
                              <circle cx="85" cy="20" r="8" fill="white" />
                          </svg>
                      </div>

                   </div>
                   
                   {/* Bottom Label (Floating separately) */}
                   <div className="absolute top-full mt-6 flex flex-col items-center pointer-events-none">
                     <span className="text-[10px] md:text-xs font-bold tracking-[0.3em] text-yellow-500/80 uppercase shadow-black drop-shadow-md">圣诞快乐</span>
                   </div>

                 </>
               ) : (
                 <>
                   {/* --- Classic Tech Design --- */}
                   <div className="absolute inset-0 border border-cyan-500/30 rounded-full animate-[spin_10s_linear_infinite]"></div>
                   <div className="absolute inset-2 border border-dotted border-cyan-400/30 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
                   <div className="absolute -inset-4 border border-cyan-900/50 rounded-full opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500"></div>

                   <div className="relative z-10 w-full h-full backdrop-blur-sm border-2 border-cyan-400/60 rounded-full flex items-center justify-center transition-all duration-300 group-active:scale-95 bg-cyan-950/20 shadow-[0_0_30px_rgba(6,182,212,0.2)] group-hover:bg-cyan-500/20 group-hover:shadow-[0_0_50px_rgba(6,182,212,0.6)] group-hover:border-cyan-300">
                      <Play className="w-8 h-8 md:w-14 md:h-14 ml-1 md:ml-1.5 transition-colors fill-cyan-400 text-cyan-400 group-hover:text-white group-hover:fill-white" />
                   </div>
                   
                   {/* Label */}
                   <div className="absolute top-full mt-4 md:mt-6 flex flex-col items-center">
                     <div className="w-[1px] h-3 md:h-4 bg-gradient-to-b from-cyan-500 to-transparent mb-1 md:mb-2"></div>
                     <span className="text-[10px] md:text-xs font-bold tracking-[0.3em] group-hover:text-white transition-colors uppercase text-cyan-400">开始游戏</span>
                   </div>
                 </>
               )}
            </button>
        </div>

      </div>

      {/* --- HUD: BOTTOM (Tactical Modules) --- */}
      {/* Mobile: px-4, Desktop: px-10 */}
      {/* Reduced bottom padding: pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.5rem))] */}
      <div className="absolute bottom-0 w-full px-4 md:px-10 z-20 flex justify-between items-end pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.5rem))] md:pb-10">
         
         {/* Left: Leaderboard Module */}
         <button 
           onClick={onLeaderboardOpen}
           className={`group flex items-end gap-2 md:gap-3 hover:bg-white/5 p-2 md:p-3 pr-4 md:pr-6 transition-all clip-corner-bl border-b border-l border-white/10 ${isChristmas ? 'hover:border-red-500/50' : 'hover:border-cyan-500/50'}`}
         >
           <div className="hidden md:flex flex-col items-center justify-center w-10 h-10 border border-white/10 bg-black/40">
              <Trophy size={18} className="text-slate-400 group-hover:text-yellow-400 transition-colors" />
           </div>
           <div className="flex flex-col items-start">
             <div className="flex items-center gap-1.5 md:gap-2">
                <Trophy size={14} className="md:hidden text-slate-400 group-hover:text-yellow-400" />
                {/* Mobile: text-xl, Desktop: text-4xl */}
                <span className="text-xl md:text-4xl font-black text-slate-500 group-hover:text-white transition-colors leading-none italic">TOP</span>
             </div>
             <span className={`text-[8px] md:text-[9px] font-mono uppercase tracking-widest ${isChristmas ? 'text-red-500/60 group-hover:text-red-400' : 'text-cyan-500/60 group-hover:text-cyan-400'}`}>排行榜</span>
           </div>
         </button>

         {/* Center Bottom Decoration (Minimal) */}
         <div className="hidden md:flex flex-col items-center opacity-30 gap-1 pb-2">
            <div className="w-32 h-1 bg-white/10 mt-1 relative overflow-hidden">
               <div className={`absolute inset-0 w-full animate-[shimmer_2s_infinite] ${isChristmas ? 'bg-red-500/50' : 'bg-cyan-500/50'}`}></div>
            </div>
         </div>

         {/* Right: Shop Module */}
         <button 
           onClick={onShopOpen}
           className="group flex flex-row-reverse items-end gap-2 md:gap-3 hover:bg-white/5 p-2 md:p-3 pl-4 md:pl-6 transition-all clip-corner-br border-b border-r border-white/10 hover:border-purple-500/50 text-right"
         >
           <div className="hidden md:flex flex-col items-center justify-center w-10 h-10 border border-white/10 bg-black/40">
              <ShoppingBag size={18} className="text-slate-400 group-hover:text-purple-400 transition-colors" />
           </div>
           <div className="flex flex-col items-end">
             <div className="flex items-center gap-1.5 md:gap-2 flex-row-reverse">
                <ShoppingBag size={14} className="md:hidden text-slate-400 group-hover:text-purple-400" />
                <span className="text-xl md:text-4xl font-black text-slate-500 group-hover:text-white transition-colors leading-none italic">SHOP</span>
             </div>
             <span className="text-[8px] md:text-[9px] font-mono text-purple-500/60 uppercase tracking-widest group-hover:text-purple-400">商店</span>
           </div>
         </button>

      </div>

    </div>
  );
};