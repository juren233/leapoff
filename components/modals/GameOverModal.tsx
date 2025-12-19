import React from 'react';
import { Skull, Trophy, Award, RefreshCw, Target, Clock, Hash, Coins, Loader2, CheckCircle, AlertTriangle, UploadCloud, LogIn } from 'lucide-react';
import { GameStats, UploadStatus } from '../../types';

interface GameOverModalProps {
  scoreDisplay: number;
  highScore: number;
  gameStats: GameStats;
  uploadStatus: UploadStatus;
  session: any;
  onLeaderboardOpen: () => void;
  onRestart: () => void;
  onSync: () => void;
  onAuthOpen: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  scoreDisplay,
  highScore,
  gameStats,
  uploadStatus,
  session,
  onLeaderboardOpen,
  onRestart,
  onSync,
  onAuthOpen
}) => {
  return (
    // Mobile: Padding top/bottom for safe areas. Desktop: md:p-4 (standard centering).
    <div className="absolute inset-0 z-30 bg-red-900/20 backdrop-blur-sm flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(3rem,calc(env(safe-area-inset-bottom)+2rem))] md:p-4">
      {/* Mobile: p-5, Desktop: p-10 */}
      <div className="w-full max-w-sm md:max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar bg-black/90 border border-red-500/30 rounded-3xl shadow-2xl p-5 md:p-10 text-center md:text-left transform transition-all animate-in fade-in zoom-in duration-300 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
        
        <div className="flex flex-col md:flex-row md:gap-12">
          {/* LEFT COLUMN: Identity, Score & Main Actions */}
          <div className="flex flex-col items-center md:items-start md:flex-1">
            
            {/* Header Icon */}
            {/* Mobile: p-3 mb-4, Desktop: p-4 mb-8 */}
            <div className="inline-block p-3 md:p-4 rounded-full bg-red-500/10 mb-4 md:mb-8 border border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              <Skull size={32} className="text-red-500 md:w-10 md:h-10" />
            </div>

            {/* Mobile: text-2xl, Desktop: text-4xl */}
            <h2 className="text-2xl md:text-4xl font-black text-white mb-2 tracking-tight">游戏结束</h2>
            <p className="text-slate-500 text-xs mb-6 md:mb-8 font-mono uppercase tracking-[0.2em]">GAME OVER</p>

            {/* Main Score Display */}
            <div className="mb-6 md:mb-8 w-full">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1 tracking-widest md:hidden">最终得分</div>
              {/* Mobile: text-5xl, Desktop: text-7xl */}
              <div className="text-5xl md:text-7xl font-black text-white shadow-cyan-500 drop-shadow-[0_0_25px_rgba(34,211,238,0.4)] tracking-tighter leading-none">
                {scoreDisplay.toLocaleString()}
              </div>
              <div className="text-xs text-cyan-500/60 font-mono font-bold uppercase mt-2 tracking-widest hidden md:block">最终得分</div>
            </div>

            {/* High Score Badge */}
            <div className="bg-yellow-500/5 px-3 py-2 md:px-4 md:py-2.5 rounded-xl border border-yellow-500/20 mb-6 flex items-center justify-center md:justify-start gap-2 md:gap-3 w-full md:w-auto hover:bg-yellow-500/10 transition-colors">
              <Trophy size={14} className="text-yellow-500 md:w-4 md:h-4" /> 
              <span className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-wider">历史最佳</span>
              <span className="font-mono font-bold text-yellow-400 text-base md:text-lg">{highScore.toLocaleString()}</span>
            </div>

            {/* Desktop Buttons Placeholders (Visible only on md+) */}
            <div className="hidden md:flex flex-col w-full gap-3 mt-auto">
              <div className="flex gap-3 w-full">
                <button onClick={onLeaderboardOpen} className="flex-1 py-3.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm border border-white/5 hover:border-white/20">
                  <Award size={18} className="text-slate-300" /> 排行榜
                </button>
                <button onClick={onRestart} className="flex-[2] py-3.5 bg-white hover:bg-slate-200 text-black font-bold rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                  <RefreshCw size={18} /> 再来一次
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Stats Breakdown & Sync */}
          <div className="flex flex-col md:flex-1 w-full mt-2 md:mt-0">
            
            {/* Stats Card */}
            {/* Mobile: p-4, Desktop: p-5 */}
            <div className="bg-white/5 rounded-2xl p-4 md:p-5 border border-white/10 space-y-2.5 md:space-y-3.5 backdrop-blur-sm">
              <h3 className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2 md:mb-3 pb-2 border-b border-white/5 text-center md:text-left">
                游戏总结
              </h3>
              
              <div className="flex justify-between items-center text-xs md:text-sm group">
                <span className="text-slate-400 flex items-center gap-2 group-hover:text-cyan-200 transition-colors"><Target size={13} className="text-cyan-500 md:w-[15px]"/> 基础得分</span>
                <span className="font-mono text-cyan-400 font-medium">+{gameStats.actionScore}</span>
              </div>
              <div className="flex justify-between items-center text-xs md:text-sm group">
                <span className="text-slate-400 flex items-center gap-2 group-hover:text-green-200 transition-colors"><Clock size={13} className="text-green-500 md:w-[15px]"/> 生存得分 ({gameStats.formattedDuration})</span>
                <span className="font-mono text-green-400 font-medium">+{gameStats.timeScore}</span>
              </div>
              <div className="flex justify-between items-center text-xs md:text-sm group">
                <span className="text-slate-400 flex items-center gap-2 group-hover:text-yellow-200 transition-colors"><Hash size={13} className="text-yellow-500 md:w-[15px]"/> 圈数得分 ({gameStats.finalOrbit}圈)</span>
                <span className="font-mono text-yellow-400 font-medium">+{gameStats.orbitBonus}</span>
              </div>
              <div className="flex justify-between items-center text-xs md:text-sm group">
                <span className="text-slate-400 flex items-center gap-2 group-hover:text-amber-200 transition-colors"><Coins size={13} className="text-amber-400 md:w-[15px]"/> 获得金币</span>
                <span className="font-mono text-amber-400 font-medium">+{gameStats.coinsCollected}</span>
              </div>
              
              <div className="border-t border-white/5 my-2"></div>
              
              <div className="flex justify-between items-center text-[10px] md:text-xs text-slate-500">
                <span className="uppercase tracking-wider">难度加成</span>
                <span className="font-mono text-white/60">x{gameStats.multiplier.toFixed(1)}</span>
              </div>
            </div>

              {/* Upload/Sync Status */}
              <div className="mt-4 md:mt-auto">
                {session ? (
                  <div className="flex flex-col gap-2">
                    <div className={`text-center md:text-left text-[10px] md:text-xs py-2 md:py-2.5 px-3 md:px-4 rounded-xl flex items-center justify-center md:justify-start gap-2 md:gap-2.5 transition-colors border ${
                      uploadStatus.status === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                      uploadStatus.status === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                      'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    }`}>
                      {(uploadStatus.status === 'uploading' || uploadStatus.status === 'idle') && <Loader2 size={12} className="animate-spin md:w-[13px]"/>}
                      {uploadStatus.status === 'success' && <CheckCircle size={12} className="md:w-[13px]" />}
                      {uploadStatus.status === 'error' && <AlertTriangle size={12} className="md:w-[13px]" />}
                      <span className="font-medium tracking-wide">{uploadStatus.msg || (uploadStatus.status === 'idle' ? '准备上传...' : '')}</span>
                    </div>
                    {/* Retry Button */}
                    {(uploadStatus.status === 'error' || uploadStatus.status === 'idle') && (
                      <button onClick={onSync} className="text-[10px] md:text-xs bg-white/5 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5 text-slate-400 hover:text-white w-full border border-white/5">
                        <UploadCloud size={12} className="md:w-[14px]" /> 重试上传
                      </button>
                    )}
                  </div>
                ) : (
                  <button onClick={onAuthOpen} className="group w-full text-center text-[10px] md:text-xs text-cyan-400 bg-cyan-950/30 py-2.5 md:py-3 rounded-xl hover:bg-cyan-900/50 transition-all border border-cyan-500/20 hover:border-cyan-400/40 flex items-center justify-center gap-2">
                    <LogIn size={12} className="group-hover:scale-110 transition-transform md:w-[14px]" /> 点我登录以同步云端并参与排行榜
                  </button>
                )}
              </div>
          </div>
        </div>

        {/* Mobile Buttons (Visible only on small screens) */}
        <div className="flex md:hidden gap-2 w-full mt-6">
          <button onClick={onLeaderboardOpen} className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-full transition-all flex items-center justify-center gap-2 text-xs border border-white/10">
            <Award size={16} /> 排行榜
          </button>
          <button onClick={onRestart} className="flex-[2] py-2.5 bg-white hover:bg-slate-200 text-black font-bold rounded-full transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-white/10 text-xs">
            <RefreshCw size={16} /> 再来一次
          </button>
        </div>

      </div>
    </div>
  );
};