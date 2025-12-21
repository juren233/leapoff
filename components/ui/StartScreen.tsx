import React from 'react';
import { User, LogOut, Coins, Play, Trophy, ShoppingBag, Activity, Wifi, ShieldAlert, Zap, Hexagon } from 'lucide-react';
import { GAME_VERSION } from '../../constants';
import { SystemStatus } from '../../types';

interface StartScreenProps {
  session: any;
  totalCoins: number;
  systemStatus: SystemStatus;
  onStart: () => void;
  onLogout: () => void;
  onAuthOpen: () => void;
  onLeaderboardOpen: () => void;
  onShopOpen: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  session,
  totalCoins,
  systemStatus,
  onStart,
  onLogout,
  onAuthOpen,
  onLeaderboardOpen,
  onShopOpen
}) => {
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
        .animate-grid {
          animation: grid-move 2s linear infinite;
        }
        .animate-float-1 { animation: float-particle 4s ease-in-out infinite; }
        .animate-float-2 { animation: float-particle 5s ease-in-out infinite 1s; }
        .animate-float-3 { animation: float-particle 6s ease-in-out infinite 2s; }
        
        .clip-corner-br {
          clip-path: polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%);
        }
        .clip-corner-bl {
          clip-path: polygon(0 0, 100% 0, 100% 100%, 12px 100%, 0 calc(100% - 12px));
        }
        .text-stroke-cyan {
          -webkit-text-stroke: 1px rgba(34, 211, 238, 0.5);
          color: transparent;
        }
        /* Background decorative elements */
        .bg-tech-pattern {
            background-image: radial-gradient(rgba(6,182,212,0.1) 1px, transparent 1px);
            background-size: 30px 30px;
        }
      `}</style>

      {/* --- SEPARATE BACKGROUND DESIGN --- */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
        
        {/* 1. Deep Space Base */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#020617] via-[#050505] to-[#0a0a0a]"></div>
        
        {/* 2. Top Spotlight / Sun effect */}
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[80%] h-[50%] bg-cyan-900/20 blur-[100px] rounded-full"></div>

        {/* 3. Tech Dots Pattern */}
        <div className="absolute inset-0 bg-tech-pattern opacity-30"></div>

        {/* 4. Retro-wave Grid Floor (Enhanced visibility) */}
        <div className="absolute bottom-[-25%] left-[-50%] w-[200%] h-[80%] opacity-40 animate-grid origin-bottom">
           <div className="w-full h-full bg-[linear-gradient(to_right,rgba(34,211,238,0.2)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,211,238,0.2)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:linear-gradient(to_top,black_60%,transparent_100%)]"></div>
        </div>
        
        {/* 5. Decorative Floating Particles (CSS Only) */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-cyan-500 rounded-full blur-[2px] animate-float-1"></div>
        <div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 bg-purple-500 rounded-full blur-[1px] animate-float-2"></div>
        <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-white rounded-full blur-[0px] animate-float-3"></div>

        {/* 6. Vignette & Border Lines */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]"></div>
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"></div>
      </div>

      {/* --- HUD: TOP LEFT (Profile) --- */}
      {/* Mobile: Smaller padding (p-4), Desktop: p-10 */}
      <div className="absolute top-0 left-0 p-4 md:p-10 z-20 flex flex-col items-start gap-3 md:gap-4 animate-in slide-in-from-left duration-700 mt-[env(safe-area-inset-top)] ml-[env(safe-area-inset-left)] md:mt-0 md:ml-0">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative">
            {/* Mobile: w-9 h-9, Desktop: w-12 h-12 */}
            <div className="w-9 h-9 md:w-12 md:h-12 border border-cyan-500/30 bg-cyan-950/30 flex items-center justify-center clip-corner-br">
               <User size={16} className="text-cyan-400 md:w-5 md:h-5" />
            </div>
            {/* Tech Decoration */}
            <div className="absolute -bottom-1 -right-1 w-1.5 h-1.5 md:w-2 md:h-2 bg-cyan-500"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] md:text-[10px] text-cyan-500/60 font-mono tracking-widest uppercase mb-0.5">玩家</span>
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
              <button onClick={onAuthOpen} className="text-xs md:text-sm font-bold text-cyan-400 hover:bg-cyan-400 hover:text-black transition-colors px-2 py-0.5 border border-cyan-400/50">
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
        <div className="relative text-center mb-10 md:mb-24 group cursor-default">
           {/* Glitch Effect Duplicate */}
           {/* Mobile: text-5xl, Desktop: text-9xl */}
           <h1 className="absolute inset-0 text-5xl md:text-9xl font-black italic tracking-tighter text-cyan-500/20 blur-sm translate-x-1 translate-y-1 animate-pulse select-none">
             LEAP OFF
           </h1>
           <h1 className="relative text-5xl md:text-9xl font-black italic tracking-tighter text-white mix-blend-screen drop-shadow-[0_0_30px_rgba(6,182,212,0.6)] select-none">
             LEAP <span className="text-cyan-400">OFF</span>
           </h1>
           
           <div className="flex items-center justify-between w-full mt-2 md:mt-4 px-2 opacity-60">
             <span className="text-[8px] md:text-[10px] font-mono text-cyan-500">{GAME_VERSION}</span>
             <div className="flex gap-1">
                <span className="w-6 md:w-8 h-[2px] bg-cyan-500"></span>
                <span className="w-1.5 md:w-2 h-[2px] bg-cyan-500/50"></span>
                <span className="w-1.5 md:w-2 h-[2px] bg-cyan-500/20"></span>
             </div>
             <span className="text-[8px] md:text-[10px] font-mono text-cyan-500 uppercase">{systemStatus.status === 'ok' ? '云端数据' : '离线模式'}</span>
           </div>
        </div>

        {/* The Core Trigger */}
        <button 
          onClick={onStart}
          // Mobile: w-20 h-20, Desktop: w-32 h-32
          className="group relative w-20 h-20 md:w-32 md:h-32 flex items-center justify-center outline-none"
        >
           {/* Rotating Rings */}
           <div className="absolute inset-0 border border-cyan-500/30 rounded-full animate-[spin_10s_linear_infinite]"></div>
           <div className="absolute inset-2 border border-dotted border-cyan-400/30 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
           <div className="absolute -inset-4 border border-cyan-900/50 rounded-full opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500"></div>

           {/* Core */}
           <div className="relative z-10 w-full h-full bg-cyan-950/20 backdrop-blur-sm border-2 border-cyan-400/60 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.2)] group-hover:bg-cyan-500/20 group-hover:shadow-[0_0_50px_rgba(6,182,212,0.6)] group-hover:border-cyan-300 transition-all duration-300 group-active:scale-95">
              <Play className="fill-cyan-400 text-cyan-400 w-8 h-8 md:w-14 md:h-14 ml-1 md:ml-1.5 group-hover:text-white group-hover:fill-white transition-colors" />
           </div>
           
           {/* Label */}
           <div className="absolute top-full mt-4 md:mt-6 flex flex-col items-center">
             <div className="w-[1px] h-3 md:h-4 bg-gradient-to-b from-cyan-500 to-transparent mb-1 md:mb-2"></div>
             <span className="text-[10px] md:text-xs font-bold tracking-[0.3em] text-cyan-400 group-hover:text-white transition-colors uppercase">开始游戏</span>
           </div>
        </button>

      </div>

      {/* --- HUD: BOTTOM (Tactical Modules) --- */}
      {/* Mobile: px-4, Desktop: px-10 */}
      {/* Reduced bottom padding: pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.5rem))] */}
      <div className="absolute bottom-0 w-full px-4 md:px-10 z-20 flex justify-between items-end pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.5rem))] md:pb-10">
         
         {/* Left: Leaderboard Module */}
         <button 
           onClick={onLeaderboardOpen}
           className="group flex items-end gap-2 md:gap-3 hover:bg-white/5 p-2 md:p-3 pr-4 md:pr-6 transition-all clip-corner-bl border-b border-l border-white/10 hover:border-cyan-500/50"
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
             <span className="text-[8px] md:text-[9px] font-mono text-cyan-500/60 uppercase tracking-widest group-hover:text-cyan-400">排行榜</span>
           </div>
         </button>

         {/* Center Bottom Decoration (Minimal) */}
         <div className="hidden md:flex flex-col items-center opacity-30 gap-1 pb-2">
            <div className="w-32 h-1 bg-white/10 mt-1 relative overflow-hidden">
               <div className="absolute inset-0 bg-cyan-500/50 w-full animate-[shimmer_2s_infinite]"></div>
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
