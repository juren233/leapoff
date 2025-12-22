import React from 'react';
import { Shield, Zap, Flame, Coins, Clock } from 'lucide-react';
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
  
  // Helper for Circular Progress Ring
  const CircularProgress = ({ progress, colorClass, children }: { progress: number, colorClass: string, children?: React.ReactNode }) => {
    // 保持与金币图标容器完全一致的尺寸体系
    const size = 32; 
    const strokeWidth = 3;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
      <div className="relative flex items-center justify-center shrink-0 w-8 h-8 md:w-11 md:h-11">
        <svg className="absolute inset-0 transform -rotate-90 w-full h-full drop-shadow-sm" viewBox={`0 0 ${size} ${size}`}>
           <circle
             cx={size/2} cy={size/2} r={radius}
             stroke="currentColor" strokeWidth={strokeWidth} fill="transparent"
             className="text-black/40"
           />
           <circle
             cx={size/2} cy={size/2} r={radius}
             stroke="currentColor" strokeWidth={strokeWidth} fill="transparent"
             className={`${colorClass} transition-all duration-100 ease-linear`}
             strokeDasharray={circumference}
             strokeDashoffset={offset}
             strokeLinecap="round"
           />
        </svg>
        <div className="relative z-10 flex items-center justify-center scale-90 md:scale-100">
            {children}
        </div>
      </div>
    );
  };

  // Helper to render individual buff cards
  const renderBuff = (type: 'shield' | 'magnet' | 'dash', value: number) => {
    if (value <= 0) return null;

    let config = {
      label: '防御护盾',
      colorText: 'text-green-400',
      colorRing: 'text-green-500',
      colorBorder: 'border-green-500/30',
      icon: Shield,
      max: 400
    };

    if (type === 'magnet') {
      config = { label: '磁力吸附', colorText: 'text-purple-400', colorRing: 'text-purple-500', colorBorder: 'border-purple-500/30', icon: Zap, max: 600 };
    } else if (type === 'dash') {
      config = { label: '极速冲刺', colorText: 'text-orange-400', colorRing: 'text-orange-500', colorBorder: 'border-orange-500/30', icon: Flame, max: 150 };
    }

    const seconds = (value / 60).toFixed(1);
    const progress = Math.min(100, Math.max(0, (value / config.max) * 100));

    return (
      // 严格匹配金币栏的 padding: pl-1.5 pr-3 py-1.5
      <div className={`flex items-center gap-2 md:gap-3 bg-neutral-900/90 border ${config.colorBorder} pl-1.5 pr-3 py-1.5 md:pl-2 md:pr-6 md:py-2 rounded-xl md:rounded-2xl backdrop-blur-md animate-in slide-in-from-left duration-300 shadow-lg shadow-black/20`}>
        
        <CircularProgress progress={progress} colorClass={config.colorRing}>
           <config.icon className={`${config.colorText} drop-shadow-[0_0_8px_currentColor] w-4 h-4 md:w-5 md:h-5`} />
        </CircularProgress>
        
        {/* 移除 min-w，让宽度自然适应，与金币栏行为一致 */}
        <div className="flex flex-col">
          <span className={`text-[9px] md:text-[10px] font-bold tracking-wider ${config.colorText} opacity-90 leading-tight`}>
            {config.label}
          </span>
          {/* 字体大小调整为 text-sm 以匹配修正后的金币栏 */}
          <span className="text-white font-mono text-sm md:text-xl font-bold leading-none shadow-black/50 drop-shadow-sm mt-0.5">
            {seconds}<span className="text-[9px] md:text-[10px] opacity-60 ml-0.5 font-sans font-normal">s</span>
          </span>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* LEFT COLUMN: Coins & Buffs */}
      <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-[max(0.75rem,env(safe-area-inset-left))] md:top-6 md:left-6 flex flex-col items-start gap-2 md:gap-3 z-30 pointer-events-none">
        
        {/* Coin HUD */}
        {/* Padding 调整为 pl-1.5 pr-3 py-1.5 以完全匹配道具卡片 */}
        <div className="flex items-center gap-2 md:gap-3 bg-neutral-900/80 backdrop-blur-xl rounded-full pl-1.5 pr-3 py-1.5 md:pl-2 md:pr-6 md:py-2 border border-yellow-500/30 shadow-lg">
          <div className="w-8 h-8 md:w-11 md:h-11 rounded-full bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 flex items-center justify-center border border-yellow-500/50">
             <Coins className="text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)] w-4 h-4 md:w-6 md:h-6" />
          </div>
          <div className="flex flex-col">
             <span className="text-[9px] md:text-[10px] text-yellow-500/80 font-bold uppercase tracking-wider leading-none mb-0.5">我的金币</span>
             {/* 字体从 text-base 缩小到 text-sm，与道具卡片数值一致 */}
             <span className="text-yellow-100 font-mono font-bold text-sm md:text-xl leading-none tracking-wide text-shadow">
               {(totalCoins + runCoins).toLocaleString()}
             </span>
          </div>
        </div>

        {/* Buff Stack */}
        <div className={`flex flex-col gap-2 transition-all duration-500 origin-left ${uiGameState === 'PLAYING' ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
          {renderBuff('shield', buffs.shield)}
          {renderBuff('magnet', buffs.magnet)}
          {renderBuff('dash', buffs.dash)}
        </div>
      </div>

      {/* RIGHT TOP: Orbit Counter */}
      <div className={`absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] md:top-6 md:right-6 z-20 pointer-events-none flex flex-col items-end gap-1 ${uiGameState === 'PLAYING' ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}>
          <div className="flex items-center gap-2 md:gap-3 bg-black/60 backdrop-blur-md px-3 py-1.5 md:px-5 md:py-3 rounded-xl border border-blue-500/30 shadow-xl">
              <span className="text-blue-400 font-bold tracking-wider text-[10px] md:text-xs">当前圈数</span>
              <div className="w-px h-3 md:h-5 bg-blue-500/40"></div>
              <span className="text-white font-mono font-bold text-xl md:text-3xl leading-none shadow-blue-500 drop-shadow-[0_0_10px_rgba(59,130,246,0.6)]">
                  {orbitCountDisplay}
              </span>
          </div>
           {/* Decorative line */}
          <div className="w-16 md:w-24 h-0.5 bg-gradient-to-r from-transparent via-blue-500/60 to-transparent"></div>
      </div>

      {/* CENTER TOP: Score & Bonus */}
      {uiGameState === 'PLAYING' && (
        <div className="absolute top-[max(4rem,calc(env(safe-area-inset-top)+1.5rem))] md:top-16 left-1/2 -translate-x-1/2 pointer-events-none z-10 flex flex-col items-center w-full animate-in fade-in duration-700">
          
          {/* Main Score Display */}
          <div className="relative group cursor-default">
             <span className="absolute inset-0 text-5xl md:text-8xl font-black italic tracking-tighter text-cyan-400 blur-lg opacity-20 select-none">
                {scoreDisplay.toLocaleString()}
             </span>
             <span className="relative text-5xl md:text-8xl font-black italic tracking-tighter text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] select-none"
                   style={{ WebkitTextStroke: '1px rgba(255,255,255,0.1)' }}>
                {scoreDisplay.toLocaleString()}
             </span>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4 mt-1 md:mt-2 opacity-80">
             <div className="h-[1px] w-4 md:w-8 bg-gradient-to-r from-transparent to-cyan-500"></div>
             <span className="text-[10px] md:text-xs text-cyan-400 font-mono tracking-[0.3em] uppercase font-bold">当前得分</span>
             <div className="h-[1px] w-4 md:w-8 bg-gradient-to-l from-transparent to-cyan-500"></div>
          </div>

          {/* Bonus Time Indicator */}
          <div className={`mt-3 md:mt-4 transition-all duration-500 ease-out transform ${isBonusTimeUI ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-90'}`}>
            <div className="bg-yellow-950/70 border border-yellow-500/50 rounded-full pl-1.5 pr-4 py-1 md:pl-2 md:pr-6 md:py-1.5 flex items-center gap-2 md:gap-3 backdrop-blur-md shadow-[0_0_20px_rgba(234,179,8,0.4)]">
              <div className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-gradient-to-t from-yellow-600 to-yellow-400 flex items-center justify-center animate-spin-slow shadow-lg border border-yellow-300">
                 <Clock className="w-4 h-4 md:w-5 md:h-5 text-black fill-yellow-100" />
              </div>
              <div className="flex flex-col items-start">
                 <span className="text-[9px] md:text-[10px] text-yellow-400 font-black tracking-widest leading-none mb-0.5">金币时间</span>
                 <span className="text-white font-mono font-bold text-base md:text-xl leading-none drop-shadow-md">
                    {/* Fixed: Display seconds directly without division */}
                    {bonusTimeLeft.toFixed(1)}<span className="text-[9px] md:text-[10px] ml-0.5 opacity-70 font-sans font-normal">s</span>
                 </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};