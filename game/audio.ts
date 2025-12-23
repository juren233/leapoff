/*
 * 文件作用：音频管理器，使用 Web Audio API 实时合成游戏音效及BGM
 * 注意：开头这段注释不得删除！！！
 */

class AudioManager {
    ctx: AudioContext | null = null;
    
    // 独立控制
    bgmMuted: boolean = false;
    sfxMuted: boolean = false;
    
    // BGM 节点引用
    bgmGain: GainNode | null = null;
    bgmSource: AudioBufferSourceNode | null = null;
    
    // BGM 数据缓存 (URL -> AudioBuffer)
    bgmBuffers: Map<string, AudioBuffer> = new Map();
    // 当前正在播放（或计划播放）的URL
    currentBgmUrl: string | null = null;
    
    // 正在加载的 URL 集合
    loadingUrls: Set<string> = new Set();
    
    // 自动重试定时器
    autoResumeTimer: any = null;

    constructor() {
        this.init();
        this.bindGlobalUnlock();
    }

    init() {
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
            }
        }
    }

    async resume() {
        if (!this.ctx) this.init();
        if (this.ctx && this.ctx.state !== 'running') {
            try { await this.ctx.resume(); } catch (e) {}
        }
    }

    // 设置 BGM 静音状态 (带平滑过渡)
    setBgmMute(muted: boolean) {
        // [关键修复] 状态防抖：
        // 如果请求的状态和当前一致，直接返回。
        // 这防止了 React 组件重绘时重复调用此方法，从而打断正在进行的 fadeOut/fadeIn 动画。
        if (this.bgmMuted === muted) return;

        this.bgmMuted = muted;
        
        if (this.bgmGain && this.ctx) {
            const t = this.ctx.currentTime;
            // 取消之前的计划，防止冲突
            this.bgmGain.gain.cancelScheduledValues(t);
            // 锁定当前音量作为起点，防止突变
            this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, t);

            if (muted) {
                // 设置中关闭音乐：使用 0.5秒 平滑渐出，不再瞬间静音
                this.bgmGain.gain.linearRampToValueAtTime(0, t + 0.5);
            } else {
                // 设置中开启音乐：使用 0.5秒 平滑渐入
                this.bgmGain.gain.linearRampToValueAtTime(1.0, t + 0.5);
            }
        } else if (!muted && !this.bgmSource && this.currentBgmUrl) {
            // 如果取消静音且当前没在播放，尝试启动
            this.playBGM(this.currentBgmUrl);
        }
    }

    setSfxMute(muted: boolean) {
        this.sfxMuted = muted;
    }

    // [New] 渐出效果 (Fade Out)
    // 用于场景切换（如返回首页），将音量平滑降为 0，但不改变 muted 状态
    fadeOut(duration: number = 1.0) {
        if (!this.ctx || !this.bgmGain || this.bgmMuted) return;
        try {
            const t = this.ctx.currentTime;
            this.bgmGain.gain.cancelScheduledValues(t);
            this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, t);
            // 使用 LinearRamp 确保在 duration 结束时音量严格为 0
            this.bgmGain.gain.linearRampToValueAtTime(0, t + duration);
        } catch(e) {}
    }

    // [New] 渐入效果 (Fade In)
    // 用于场景加载完成，恢复音量
    fadeIn(duration: number = 1.0) {
        if (!this.ctx || !this.bgmGain || this.bgmMuted) return;
        try {
            const t = this.ctx.currentTime;
            this.bgmGain.gain.cancelScheduledValues(t);
            this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, t);
            this.bgmGain.gain.linearRampToValueAtTime(1.0, t + duration);
        } catch(e) {}
    }

    bindGlobalUnlock() {
        if (typeof window === 'undefined') return;
        const unlock = () => {
            this.resume().then(() => {
                if (!this.bgmSource && this.currentBgmUrl && this.bgmBuffers.has(this.currentBgmUrl) && !this.bgmMuted) {
                    this.playBGM(this.currentBgmUrl);
                }
            });
        };
        const events = ['click', 'touchstart', 'touchend', 'keydown', 'mousemove', 'scroll', 'resize'];
        events.forEach(event => {
            window.addEventListener(event, unlock, { capture: true, passive: true });
        });
    }

    startAutoResumeCheck() {
        if (this.autoResumeTimer) clearInterval(this.autoResumeTimer);
        this.autoResumeTimer = setInterval(() => {
            if (this.ctx) {
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(() => {});
                } else if (this.ctx.state === 'running') {
                    clearInterval(this.autoResumeTimer);
                    this.autoResumeTimer = null;
                }
            }
        }, 500);
    }

    async playBGM(url?: string) {
        this.init();
        if (!this.ctx) return;
        
        const targetUrl = url || this.currentBgmUrl;
        if (!targetUrl) return;

        this.startAutoResumeCheck();

        // 1. 如果是同一首歌
        if (this.currentBgmUrl === targetUrl && this.bgmSource) {
            if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
            
            // 如果虽然是同一首歌，但音量被 fadeOut 了（例如 fadeOut 后取消跳转），需要恢复
            if (!this.bgmMuted && this.bgmGain && this.bgmGain.gain.value < 0.1) {
                 const t = this.ctx.currentTime;
                 this.bgmGain.gain.cancelScheduledValues(t);
                 this.bgmGain.gain.linearRampToValueAtTime(1.0, t + 0.5);
            }
            return;
        }

        // 2. 切歌：停止当前
        if (this.bgmSource) {
            try { this.bgmSource.stop(); } catch(e){}
            this.bgmSource.disconnect();
            this.bgmSource = null;
        }
        if (this.bgmGain) {
            this.bgmGain.disconnect();
        }

        this.currentBgmUrl = targetUrl;

        // 3. 检查缓存
        if (this.bgmBuffers.has(targetUrl)) {
            this.startSourceNode(this.bgmBuffers.get(targetUrl)!);
            return;
        }

        // 4. 下载
        if (this.loadingUrls.has(targetUrl)) return;
        this.loadingUrls.add(targetUrl);
        
        try {
            console.log(`Starting BGM download: ${targetUrl}`);
            const response = await fetch(targetUrl);
            if (!response.ok) throw new Error(`Fetch error: ${response.status}`);
            
            const arrayBuffer = await response.arrayBuffer();
            const buffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.bgmBuffers.set(targetUrl, buffer);
            
            console.log("BGM decoded successfully");
            if (this.currentBgmUrl === targetUrl) {
                this.startSourceNode(buffer);
            }
        } catch (e) {
            console.warn("BGM load failed, retrying in 2s...", e);
            setTimeout(() => {
                if (this.currentBgmUrl === targetUrl) {
                     this.loadingUrls.delete(targetUrl);
                     this.playBGM(targetUrl);
                }
            }, 2000);
        } finally {
            this.loadingUrls.delete(targetUrl);
        }
    }

    startSourceNode(buffer: AudioBuffer) {
        if (!this.ctx) return;

        if (this.bgmSource) {
            try { this.bgmSource.stop(); } catch(e){}
            this.bgmSource.disconnect();
        }

        this.bgmGain = this.ctx.createGain();
        // 初始化音量：如果是切歌，先设为0，然后快速渐入，避免爆音
        this.bgmGain.gain.value = 0; 
        this.bgmGain.connect(this.ctx.destination);

        this.bgmSource = this.ctx.createBufferSource();
        this.bgmSource.buffer = buffer;
        this.bgmSource.loop = true;
        this.bgmSource.connect(this.bgmGain);

        this.bgmSource.start(0);

        // 如果未静音，执行切歌渐入
        const t = this.ctx.currentTime;
        if (!this.bgmMuted) {
             this.bgmGain.gain.linearRampToValueAtTime(1.0, t + 0.3);
        }
    }

    stopBGM() {
        // Reserved
    }

    playScore() {
        if (!this.ctx || this.sfxMuted) return;
        if (this.ctx.state !== 'running') this.ctx.resume().catch(()=>{});
        try {
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, t); 
            osc.frequency.linearRampToValueAtTime(880, t + 0.15);
            gain.gain.setValueAtTime(0.3, t); 
            gain.gain.linearRampToValueAtTime(0, t + 0.15);
            osc.start(t);
            osc.stop(t + 0.15); 
        } catch (e) {}
    }
}

export const audioManager = new AudioManager();