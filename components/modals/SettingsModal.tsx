import React from 'react';
import { X, Volume2, VolumeX, Music, Check, Palette, Smartphone } from 'lucide-react';
import { GameSettings, ThemeType } from '../../types';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClose
}) => {
  
  const toggleBGM = () => {
    onUpdateSettings({ ...settings, bgmEnabled: !settings.bgmEnabled });
  };

  const toggleSFX = () => {
    onUpdateSettings({ ...settings, sfxEnabled: !settings.sfxEnabled });
  };

  const toggleVibration = () => {
    onUpdateSettings({ ...settings, vibrationEnabled: !settings.vibrationEnabled });
  };

  const setTheme = (theme: ThemeType) => {
    onUpdateSettings({ ...settings, theme });
  };

  const themes: { id: ThemeType; name: string; color: string }[] = [
    { id: 'classic', name: '经典蓝', color: 'bg-cyan-500' },
    { id: 'neon', name: '赛博紫', color: 'bg-purple-500' },
    { id: 'retro', name: '复古橙', color: 'bg-orange-500' },
    { id: 'cyber', name: '黑客绿', color: 'bg-green-500' },
  ];

  return (
    // Responsive padding wrapper matched to GameOverModal
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 pt-[max(6rem,calc(env(safe-area-inset-top)+4rem))] pb-[max(6rem,calc(env(safe-area-inset-bottom)+4rem))] md:p-4 animate-in fade-in touch-pan-y overscroll-contain">
      
      {/* 
         Container Sizing: 
         - Mobile: w-full max-w-sm
         - Desktop: md:max-w-3xl (Wide window mode)
      */}
      <div className="w-full max-w-sm md:max-w-3xl bg-neutral-900 border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl relative max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-10">
          <h2 className="text-xl md:text-3xl font-bold text-white tracking-wider flex items-center gap-3">
            <span className="w-1.5 h-6 md:h-8 bg-cyan-500 rounded-full"></span>
            设置
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 -mr-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* 
           Responsive Layout Grid:
           - Mobile: flex-col (Stack)
           - Desktop: flex-row (Two columns side-by-side)
        */}
        <div className="flex flex-col md:flex-row gap-8 md:gap-12">
          
          {/* LEFT COLUMN: Audio & Haptics */}
          <div className="flex-1 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
              音频与震动
            </h3>
            
            {/* BGM Toggle */}
            <div className="flex items-center justify-between bg-black/40 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-full ${settings.bgmEnabled ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-500'}`}>
                  <Music size={18} />
                </div>
                <span className="text-sm font-bold text-white">背景音乐</span>
              </div>
              <button 
                onClick={toggleBGM}
                className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${settings.bgmEnabled ? 'bg-cyan-600' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${settings.bgmEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>

            {/* SFX Toggle */}
            <div className="flex items-center justify-between bg-black/40 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-full ${settings.sfxEnabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
                  {settings.sfxEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </div>
                <span className="text-sm font-bold text-white">游戏音效</span>
              </div>
              <button 
                onClick={toggleSFX}
                className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${settings.sfxEnabled ? 'bg-green-600' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${settings.sfxEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>

            {/* Vibration Toggle */}
            <div className="flex items-center justify-between bg-black/40 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-full ${settings.vibrationEnabled ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-500'}`}>
                  <Smartphone size={18} />
                </div>
                <span className="text-sm font-bold text-white">震动反馈</span>
              </div>
              <button 
                onClick={toggleVibration}
                className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${settings.vibrationEnabled ? 'bg-orange-600' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${settings.vibrationEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Theme Section */}
          <div className="flex-1 space-y-4">
             <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  主题风格（未实装）
                </h3>
             </div>
             
             {/* Use grid-cols-2 for mobile, but on desktop we can keep it 2 or make it block based on preference. 2 cols looks good in the split layout. */}
             <div className="grid grid-cols-2 gap-3 md:gap-4">
                {themes.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setTheme(theme.id)}
                    className={`relative p-3 md:p-4 rounded-xl border transition-all duration-200 flex flex-col md:flex-row items-center md:items-start gap-3 overflow-hidden group h-full
                      ${settings.theme === theme.id 
                        ? 'bg-white/10 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
                        : 'bg-black/40 border-white/5 hover:bg-white/5 hover:border-white/10'
                      }`}
                  >
                    <div className={`w-full md:w-10 h-12 md:h-10 rounded-lg ${theme.color} shadow-lg flex items-center justify-center shrink-0 mb-1 md:mb-0`}>
                       {settings.theme === theme.id && <Check size={20} className="text-white drop-shadow-md" />}
                    </div>
                    
                    <div className="flex flex-col items-center md:items-start">
                        <span className={`text-xs md:text-sm font-bold ${settings.theme === theme.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                          {theme.name}
                        </span>
                        <span className="text-[9px] text-slate-600 md:hidden">点击应用</span>
                    </div>
                    
                    {/* Active Indicator Corner */}
                    {settings.theme === theme.id && (
                      <div className="absolute top-0 right-0 w-3 h-3 md:w-4 md:h-4 bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}></div>
                    )}
                  </button>
                ))}
             </div>
             
             <div className="text-[10px] text-slate-600 mt-2 px-1 leading-relaxed hidden md:block">
                选择不同的主题将改变游戏界面的主色调与粒子特效氛围。
             </div>
          </div>

        </div>

      </div>
    </div>
  );
};