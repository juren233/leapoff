import React from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface AuthModalProps {
  authMode: 'login' | 'signup';
  setAuthMode: (mode: 'login' | 'signup') => void;
  authUsername: string;
  setAuthUsername: (val: string) => void;
  authEmail: string;
  setAuthEmail: (val: string) => void;
  authPassword: string;
  setAuthPassword: (val: string) => void;
  authLoading: boolean;
  authError: string;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  authMode,
  setAuthMode,
  authUsername,
  setAuthUsername,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  authLoading,
  authError,
  onSubmit,
  onClose
}) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in overflow-y-auto touch-pan-y overscroll-contain">
      <div className="w-full max-w-xs bg-neutral-900 border border-cyan-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(6,182,212,0.15)] relative my-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20}/></button>
        <h2 className="text-xl font-bold text-white mb-6 text-center">{authMode === 'login' ? '登录' : '注册'}</h2>
        
        {authError && (
          <div className="mb-4 p-2 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-200 flex items-center gap-2">
             <AlertTriangle size={12}/> {authError}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
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
  );
};
