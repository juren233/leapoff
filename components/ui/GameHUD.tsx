import React from 'react';
import { Shield, Zap, Flame, Coins, RotateCw, Clock } from 'lucide-react';
import { GameStateStatus } from '../../types';

interface GameHUDProps {
  uiGameState: GameStateStatus;
  buffs: { shield: number; magnet: number; dash: number };
  totalCoins: number;
  runCoins: number;
  orbitCountDisplay: number;
  scoreDisplay: number;
  isBonusTimeUI: boolean;
  bonusTimeLeft: number;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  uiGameState,
  buffs,
  totalCoins,
  runCoins,
  orbitCountDisplay,
  scoreDisplay,
  isBonusTimeUI,
  bonusTimeLeft
}) => {
  return (
    <>
      {/* Buff HUD */}
      {/* Mobile: Pushed down for safe area. Desktop (md): Standard top-14 left-10. */}
      {/* Mobile: gap-2, Desktop: gap-3 */}
      <div className={`absolute top-[max(4rem,calc(env(safe-area-inset-top)+3.5rem))] md:top-14 left-4 md:left-10 flex flex-col gap-2 md:gap-3 pointer-events-none z-20 transition-opacity duration-1000 ${uiGameState !== 'PLAYING' ? 'opacity-0' : 'opacity-100'}`}>
        <div className={`flex items-center gap-2 transition-all duration-300 ${buffs.shield > 0 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
          {/* Mobile: w-7 h-7, Desktop: w-8 h-8 */}
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500 shadow-[0_0_10px_#00ff00]">
            <Shield size={14} className="text-green-400 md:w-4 md:h-4" />
          </div>
          {/* Mobile: text-xs, Desktop: text-sm */}
          <span className="text-green-400 font-bold tracking-wider text-xs md:text-sm shadow-black drop-shadow-md">护盾 {Math.ceil(buffs.shield / 60)}s</span>
        </div>
        <div className={`flex items-center gap-2 transition-all duration-300 ${buffs.magnet > 0 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500 shadow-[0_0_10px_#bf00ff]">
            <Zap size={14} className="text-purple-400 md:w-4 md:h-4" />
          </div>
          <span className="text-purple-400 font-bold tracking-wider text-xs md:text-sm shadow-black drop-shadow-md">磁吸 {Math.ceil(buffs.magnet / 60)}s</span>
        </div>
        <div className={`flex items-center gap-2 transition-all duration-300 ${buffs.dash > 0 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-orange-500/20 flex items-center justify-center border border-orange-500 shadow-[0_0_10px_#f97316]">
            <Flame size={14} className="text-orange-400 md:w-4 md:h-4" />
          </div>
          <span className="text-orange-400 font-bold tracking-wider text-xs md:text-sm shadow-black drop-shadow-md">冲刺 {Math.ceil(buffs.dash / 60)}s</span>
        </div>
      </div>

      {/* Coin HUD (Left Top) */}
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] md:top-6 left-[max(1rem,env(safe-area-inset-left))] md:left-10 z-30 pointer-events-none">
        {/* Mobile: text-xs px-2.5 py-1, Desktop: text-sm px-3 py-1.5 */}
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full px-2.5 py-1 md:px-3 md:py-1.5 border border-yellow-500/30 mb-2">
          <Coins size={14} className="text-yellow-400 md:w-4 md:h-4" />
          <span className="text-yellow-100 font-mono font-bold text-xs md:text-sm">{(totalCoins + runCoins).toLocaleString()}</span>
        </div>
      </div>

      {/* Orbit Counter HUD */}
      {(uiGameState === 'PLAYING') && (
        <div className="absolute top-[max(1rem,env(safe-area-inset-top))] md:top-6 right-[max(1rem,env(safe-area-inset-right))] md:right-10 flex items-center gap-2 pointer-events-none z-20">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500 shadow-[0_0_10px_#00d2ff]">
            <RotateCw size={14} className="text-blue-400 md:w-4 md:h-4" />
          </div>
          <span className="text-blue-400 font-bold tracking-wider text-xs md:text-sm shadow-black drop-shadow-md">第 {orbitCountDisplay} 圈</span>
        </div>
      )}

      {/* Score HUD */}
      {uiGameState === 'PLAYING' && (
        <div className="absolute top-[max(3.5rem,calc(env(safe-area-inset-top)+2rem))] md:top-24 left-1/2 -translate-x-1/2 pointer-events-none z-10 flex flex-col items-center animate-in fade-in duration-1000">
          {/* Mobile: text-5xl, Desktop: text-6xl */}
          <span className="text-5xl md:text-6xl font-black text-white tracking-tighter" style={{ textShadow: '0 0 20px rgba(0,210,255,0.6)' }}>{scoreDisplay.toLocaleString()}</span>
          <span className="text-[10px] md:text-xs text-cyan-400/60 font-mono tracking-widest uppercase">当前得分</span>

          {/* Bonus Time Indicator */}
          <div className={`mt-2 transition-all duration-300 ${isBonusTimeUI ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
            <div className="bg-yellow-500/20 border border-yellow-400/50 rounded-full px-3 py-0.5 md:px-4 md:py-1 flex items-center gap-2">
              <Clock className="w-3 h-3 md:w-4 md:h-4 text-yellow-400 animate-pulse" />
              <span className="text-yellow-300 font-bold font-mono tracking-widest text-xs md:text-sm">奖励时间 {(bonusTimeLeft / 60).toFixed(1)}s</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};