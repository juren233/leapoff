import React from 'react';
import { X, Trophy, Loader2 } from 'lucide-react';
import { LeaderboardEntry } from '../../types';

interface LeaderboardModalProps {
  loading: boolean;
  data: LeaderboardEntry[];
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  loading,
  data,
  onClose
}) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in touch-pan-y overscroll-contain">
      <div className="w-full max-w-sm bg-neutral-900 border border-yellow-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(234,179,8,0.15)] relative h-[70vh] max-h-[600px] flex flex-col">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20}/></button>
        <div className="flex items-center justify-center gap-2 mb-6">
          <Trophy className="text-yellow-500" size={24} />
          <h2 className="text-xl font-bold text-white tracking-wider">排行榜</h2>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar touch-pan-y">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-2">
              <Loader2 size={24} className="animate-spin"/>
              <span className="text-xs">加速载入中...</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 text-xs text-slate-500 pb-2 border-b border-white/10 px-2">
                <div className="col-span-2 text-center">排名</div>
                <div className="col-span-6">玩家</div>
                <div className="col-span-4 text-right">分数</div>
              </div>
              {data.map((entry, index) => {
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
              {data.length === 0 && (
                <div className="text-center py-8 text-slate-600 text-sm">暂无记录，虚位以待</div>
              )}
            </div>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-white/10 text-center text-xs text-slate-500">
          仅展示全球前10名玩家分数
        </div>
      </div>
    </div>
  );
};
