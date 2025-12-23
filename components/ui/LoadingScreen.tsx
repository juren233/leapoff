import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  type: 'initial' | 'refresh'; // New prop to control text
  onFinished: () => void; // Callback when fade-out animation is done
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ type, onFinished }) => {
  // Generate rows
  // 减少行数到 12，配合 gap-4，给每一行足够的呼吸空间，防止重叠
  const rows = Array.from({ length: 12 }); 
  // Items per row
  const items = Array.from({ length: 8 }); 

  return (
    <div className="absolute inset-0 z-[100] bg-[#050505] overflow-hidden flex flex-col items-center justify-center select-none cursor-wait">
      <style>{`
        @keyframes scroll-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .text-stroke {
          -webkit-text-stroke: 1.5px #222; 
          color: transparent;
        }
        .bg-text-solid {
            color: #1a1a1a;
        }
        .scrolling-row {
           display: flex;
           width: fit-content;
           animation-name: scroll-left;
           animation-timing-function: linear;
           animation-iteration-count: infinite;
           will-change: transform;
           /* 增加横向内边距 */
           padding-left: 2rem;
           padding-right: 2rem;
           align-items: center; /* 确保垂直居中 */
        }
        /* 
           错位效果实现：
           奇数行：慢速 (60s)
           偶数行：较快速 (40s)
        */
        .row-wrapper:nth-child(odd) .scrolling-row {
            animation-duration: 60s;
        }
        .row-wrapper:nth-child(even) .scrolling-row {
            animation-duration: 40s; 
            margin-left: -5vw; 
        }
      `}</style>

      {/* Background Pattern Layer */}
      {/* 关键调整：gap-4 增加行间距，防止重叠 */}
      <div className="absolute inset-0 flex flex-col justify-center gap-4 opacity-100 pointer-events-none">
        {rows.map((_, rIdx) => (
          /* 
             关键修复：
             1. 移除了 'overflow-hidden'：允许斜体字超出容器边界渲染，彻底解决裁切。
             2. 移除了所有负 margin：确保行与行之间物理分离。
             3. relative: 保持定位上下文。
          */
          <div key={rIdx} className="row-wrapper w-full relative flex items-center">
            {/* Double the content for seamless loop logic */}
            <div className="scrolling-row flex gap-6 md:gap-12"> 
              {[...items, ...items].map((_, cIdx) => (
                /* 
                   text-6xl / text-8xl: 字体大小微调
                   leading-tight: 紧凑行高，但因为没有 overflow-hidden，不会裁切
                   py-2: 给文字自身一点垂直余量
                */
                <div key={cIdx} className="text-6xl md:text-8xl font-black italic tracking-tighter flex gap-3 md:gap-6 shrink-0 leading-tight py-2">
                  <span className="text-stroke">LEAP</span>
                  <span className="bg-text-solid">OFF</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Vignette Overlay - Lighter Side Gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60 z-10 pointer-events-none"></div>
      {/* Light center vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.3)_100%)] z-10 pointer-events-none"></div>

      {/* Center Content - Square Frosted Glass Style */}
      <div className="relative z-20 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
         <div className="bg-black/40 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 md:p-12 flex flex-col items-center justify-center gap-6 shadow-[0_0_60px_rgba(0,0,0,0.6)] min-w-[200px] md:min-w-[280px]">
            
            {/* Icon */}
            <div className="relative">
                <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full animate-pulse"></div>
                <Loader2 className="w-12 h-12 md:w-16 md:h-16 text-cyan-400 animate-spin relative z-10" />
            </div>
            
            {/* Text Logic based on Type */}
            <div className="flex flex-col items-center gap-1">
                {type === 'initial' ? (
                  <p className="text-[10px] md:text-xs text-cyan-500/80 font-mono tracking-[0.2em] uppercase text-center whitespace-nowrap">
                     首次进入游戏，加载资源中<br />请耐心等待片刻
                  </p>
                ) : (
                  <p className="text-[10px] md:text-xs text-cyan-500/80 font-mono tracking-[0.2em] uppercase text-center whitespace-nowrap">
                     加载资源中
                  </p>
                )}
            </div>

         </div>
      </div>
    </div>
  );
};