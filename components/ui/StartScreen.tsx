import React from 'react';
import { UserCircle, LogOut, Coins, Play, Trophy, ShoppingBag, Loader2, Cloud, CloudOff } from 'lucide-react';
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
    <div className="absolute inset-0 z-30 bg-black/40 backdrop-blur-sm animate-in fade-in duration-500 flex flex-col">
      {/* 1. Scrollable Content Layer */}
      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden pb-40 lg:pb-0 touch-pan-y overscroll-contain relative [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
        
        {/* --- Top Bar: Profile & Assets --- */}
        <div className="w-full flex justify-between items-center p-4 md:p-6 pb-2 safe-area-top sticky top-0 z-10">
          {/* Left: User Profile */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-cyan-900/40 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              <UserCircle size={18} className="md:w-5 md:h-5 text-cyan-400" />
            </div>
            <div className="flex flex-col">
              {session ? (
                <>
                  <span className="text-xs md:text-sm font-bold text-white tracking-wide">{session.user.user_metadata.username || '玩家'}</span>
                  <button onClick={onLogout} className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 uppercase tracking-wider">
                    <LogOut size={10} /> 退出登录
                  </button>
                </>
              ) : (
                <button onClick={onAuthOpen} className="text-xs text-cyan-400 font-bold hover:underline">
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
        <div className="flex flex-col items-center justify-center py-8 lg:py-16 w-full max-w-[95vw] mx-auto">
          <div className="relative z-10 text-center mb-8 md:mb-12 px-8 w-full">
            <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter bg-gradient-to-br from-cyan-300 via-blue-500 to-purple-600 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(34,211,238,0.4)] transform -rotate-2 py-2 px-2">
              跃迁轨道
            </h1>
            <div className="flex items-center justify-center gap-3 mt-2 opacity-80">
              <div className="h-[1px] w-8 md:w-12 bg-gradient-to-r from-transparent to-cyan-500"></div>
              <span className="text-[10px] md:text-xs font-mono text-cyan-500 tracking-[0.2em]">{GAME_VERSION}</span>
              <div className="h-[1px] w-8 md:w-12 bg-gradient-to-l from-transparent to-cyan-500"></div>
            </div>
          </div>

          <button
            onClick={onStart}
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
      </div>

      {/* 2. Fixed Dock Layer */}
      <div className="absolute bottom-6 left-6 right-6 z-40 lg:bottom-10 lg:left-1/2 lg:-translate-x-1/2 lg:w-auto lg:right-auto pointer-events-none">
        <div className="
            pointer-events-auto
            flex items-end justify-around w-full 
            lg:w-auto lg:items-center lg:gap-8 lg:px-8 lg:py-4
            bg-neutral-950/90 backdrop-blur-xl border-t border-white/10 lg:border lg:rounded-full lg:shadow-2xl lg:bg-neutral-900/80
            pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 lg:pb-4 rounded-3xl lg:rounded-full
            border-x border-b shadow-2xl border-neutral-800
        ">
          {/* Leaderboard */}
          <button onClick={onLeaderboardOpen} className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/5 transition-colors group w-16 lg:w-auto">
            <Trophy size={22} className="text-slate-400 group-hover:text-yellow-400 transition-colors" />
            <span className="text-[10px] text-slate-500 font-bold group-hover:text-slate-300 lg:hidden">排行榜</span>
          </button>

          {/* Shop (Center) */}
          <button onClick={onShopOpen} className="group relative -top-8 lg:top-0 lg:relative">
            <div className="w-16 h-16 md:w-14 md:h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(124,58,237,0.5)] border-4 border-black group-hover:scale-110 transition-transform">
              <ShoppingBag size={26} className="text-white" />
            </div>
            <span className="text-[10px] text-purple-400 font-bold absolute -bottom-5 left-1/2 -translate-x-1/2 lg:hidden bg-black/80 px-2 py-0.5 rounded-full border border-purple-500/30 whitespace-nowrap z-50">商店</span>
          </button>

          {/* Status */}
          <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl w-16 lg:w-auto opacity-80">
            {systemStatus.status === 'checking' && <Loader2 size={22} className="animate-spin text-slate-500" />}
            {systemStatus.status === 'ok' && <Cloud size={22} className="text-green-500" />}
            {systemStatus.status === 'error' && <CloudOff size={22} className="text-red-500" />}
            <span className="text-[10px] text-slate-500 font-bold lg:hidden">
              {systemStatus.status === 'checking' ? '上云中' : (systemStatus.status === 'ok' ? '云端数据' : '本地离线')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
