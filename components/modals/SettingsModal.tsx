import React, { useEffect, useState } from 'react';
import { X, Volume2, VolumeX, Music, Check, Smartphone, Settings as SettingsIcon, Loader2 } from 'lucide-react';
import { GameSettings, ThemeType, ThemeData } from '../../types';
import { supabase } from '../../lib/supabase';
import { THEME_CACHE_KEY, DEFAULT_BGM_URL } from '../../constants';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
  onClose: () => void;
  onThemesUpdated: (themes: ThemeData[]) => void; // New Prop to sync parent
}

// 默认保底主题数据 (当数据库连接失败或未配置时使用)
const DEFAULT_THEMES: ThemeData[] = [
  { 
    id: 'classic', 
    name: '轨道星空', 
    color: 'bg-cyan-500', 
    description: '点击应用默认主题',
    sort_order: 1,
    is_default: true,
    bgm_url: DEFAULT_BGM_URL
  },
  { 
    id: 'christmas', 
    name: '圣诞限定', 
    color: 'bg-red-600', 
    description: '点击应用节日主题',
    sort_order: 2,
    is_default: false,
    // 如果这里不写，代码逻辑会自动回退到 Default
    bgm_url: 'https://raw.githubusercontent.com/juren233/leapoffthings/main/assets/XmasBgm.mp3'
  },
];

// 样式映射表：根据 color (如 bg-cyan-500) 自动匹配对应的边框和阴影
const THEME_STYLE_MAP: Record<string, { active_border: string; active_shadow: string }> = {
    'bg-cyan-500': {
        active_border: 'border-cyan-500',
        active_shadow: 'shadow-[0_0_15px_rgba(6,182,212,0.2)]'
    },
    'bg-red-600': {
        active_border: 'border-red-600',
        active_shadow: 'shadow-[0_0_15px_rgba(220,38,38,0.2)]'
    },
    'bg-purple-500': {
        active_border: 'border-purple-500',
        active_shadow: 'shadow-[0_0_15px_rgba(168,85,247,0.2)]'
    },
    'bg-yellow-500': {
        active_border: 'border-yellow-500',
        active_shadow: 'shadow-[0_0_15px_rgba(234,179,8,0.2)]'
    },
    'bg-green-500': {
        active_border: 'border-green-500',
        active_shadow: 'shadow-[0_0_15px_rgba(34,197,94,0.2)]'
    }
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClose,
  onThemesUpdated
}) => {
  const [themes, setThemes] = useState<ThemeData[]>(DEFAULT_THEMES);
  const [loadingThemes, setLoadingThemes] = useState(false);
  
  // 辅助函数：根据背景色获取对应的激活样式
  const getThemeStyles = (bgClass: string) => {
      const styles = THEME_STYLE_MAP[bgClass];
      if (styles) return styles;
      return {
          active_border: 'border-white',
          active_shadow: 'shadow-[0_0_15px_rgba(255,255,255,0.2)]'
      };
  };
  
  // 初始化与同步数据
  useEffect(() => {
    // 1. 缓存优先策略 (Stale-While-Revalidate)
    const loadFromCache = () => {
        const cached = localStorage.getItem(THEME_CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setThemes(parsed);
                    // [Fix Bug] 即使是缓存，也同步给父组件，确保父组件数据不是空的
                    onThemesUpdated(parsed);
                }
            } catch (e) {
                console.warn('Theme cache parse failed', e);
            }
        } else {
            // 无缓存时显示加载中状态
            setLoadingThemes(true);
        }
    };

    // 2. 从后端拉取最新数据
    const fetchLatest = async () => {
        try {
            const { data, error } = await supabase
                .from('game_themes')
                .select('*')
                .eq('is_visible', true)
                .order('sort_order', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                setThemes(data);
                // 更新缓存
                localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(data));
                
                // [Fix Bug] 核心修复：将拉取到的最新主题列表反向同步给父组件(LeapOrbitGame)
                // 这样当用户点击切换主题时，父组件能从 availableThemes 中找到包含正确 bgm_url 的数据
                onThemesUpdated(data);
            }
        } catch (err) {
            console.warn('Failed to fetch themes from backend, relying on cache/defaults.', err);
        } finally {
            setLoadingThemes(false);
        }
    };

    loadFromCache();
    fetchLatest();
  }, [onThemesUpdated]); // Dependency added

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

  return (
    // Responsive padding wrapper matched to GameOverModal
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 pt-[max(8rem,calc(env(safe-area-inset-top)+6rem))] pb-[max(8rem,calc(env(safe-area-inset-bottom)+6rem))] md:p-4 animate-in fade-in touch-pan-y overscroll-contain">
      
      {/* 
         Container Sizing: 
         - Mobile: w-full max-w-sm
         - Desktop: md:max-w-3xl
      */}
      <div className="w-full max-w-sm md:max-w-3xl bg-neutral-900 border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl relative max-h-[80vh] md:max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] text-center md:text-left">
        
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-colors z-10"
        >
          <X size={24} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center md:items-start mb-6 md:mb-10">
            <div className="inline-block p-3 md:p-4 rounded-full bg-cyan-500/10 mb-4 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
              <SettingsIcon size={32} className="text-cyan-500 md:w-10 md:h-10" />
            </div>
            
            <h2 className="text-2xl md:text-4xl font-black text-white mb-1 tracking-tight">系统设置</h2>
            <p className="text-slate-500 text-xs font-mono uppercase tracking-[0.2em]">SETTINGS</p>
        </div>

        {/* Layout Grid */}
        <div className="flex flex-col md:flex-row gap-8 md:gap-12">
          
          {/* LEFT COLUMN: Theme Section */}
          <div className="flex-1 space-y-4">
             <div className="flex items-center justify-center md:justify-start mb-3 gap-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  主题风格
                </h3>
                {loadingThemes && <Loader2 size={12} className="animate-spin text-cyan-500" />}
             </div>
             
             {/* Theme Grid */}
             <div className="grid grid-cols-2 gap-3 md:gap-4">
                {themes.map((theme) => {
                  const styles = getThemeStyles(theme.color);
                  const isActive = settings.theme === theme.id;
                  
                  return (
                    <button
                        key={theme.id}
                        onClick={() => setTheme(theme.id)}
                        className={`relative p-3 md:p-4 rounded-xl border transition-all duration-200 flex flex-col md:flex-row items-center md:items-start gap-3 overflow-hidden group h-full
                        ${isActive 
                            ? `bg-white/10 ${styles.active_border} ${styles.active_shadow}` 
                            : 'bg-black/40 border-white/5 hover:bg-white/5 hover:border-white/10'
                        }`}
                    >
                        <div className={`w-full md:w-10 h-12 md:h-10 rounded-lg ${theme.color} shadow-lg flex items-center justify-center shrink-0 mb-1 md:mb-0`}>
                        {isActive && <Check size={20} className="text-white drop-shadow-md" />}
                        </div>
                        
                        {/* 名称: md:ml-[1px] 偏移 */}
                        <div className="flex flex-col items-center md:items-start w-full">
                            <span className={`text-xs md:text-sm font-bold md:ml-[1px] ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                              {theme.name}
                            </span>
                            
                            {/* 描述文字放大: text-[10px] md:text-xs (原先是 text-[9px]) */}
                            <span className="text-[10px] md:text-xs text-slate-600 mt-0.5 w-full text-center md:text-left leading-tight">
                              {theme.description}
                            </span>
                        </div>
                    </button>
                  );
                })}
             </div>
             
             {/* 底部说明 */}
             <div className="text-[10px] text-slate-600 mt-2 px-1 leading-relaxed">
                部分主题可能包含专属的背景音乐与环境特效。
             </div>
          </div>

          {/* RIGHT COLUMN: Audio & Haptics */}
          <div className="flex-1 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 text-center md:text-left">
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

        </div>

      </div>
    </div>
  );
};