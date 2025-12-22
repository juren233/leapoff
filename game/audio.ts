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
    
    // BGM 数据缓存（避免重复下载）
    bgmBuffer: AudioBuffer | null = null;
    
    // 加载状态锁
    isLoading: boolean = false;
    
    // 自动重试定时器
    autoResumeTimer: any = null;

    constructor() {
        this.init();
        this.bindGlobalUnlock();
    }

    // 初始化音频上下文
    init() {
        if (!this.ctx) {
            // 兼容性处理
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
            }
        }
    }

    // 公开的 resume 方法，供外部组件(LeapOrbitGame)调用
    async resume() {
        if (!this.ctx) this.init();
        if (this.ctx && this.ctx.state !== 'running') {
            try {
                await this.ctx.resume();
            } catch (e) {
                // 忽略恢复失败（可能是因为没有用户交互）
            }
        }
    }

    // 设置 BGM 静音状态
    setBgmMute(muted: boolean) {
        this.bgmMuted = muted;
        if (this.bgmGain && this.ctx) {
            // 平滑过渡音量
            const t = this.ctx.currentTime;
            // 恢复音量设为 1.0 (原需求)，静音设为 0
            this.bgmGain.gain.setTargetAtTime(muted ? 0 : 1.0, t, 0.1);
        } else if (!muted && !this.bgmSource) {
            // 如果取消静音且当前没有播放，尝试播放
            this.playBGM();
        }
    }

    // 设置 SFX 静音状态
    setSfxMute(muted: boolean) {
        this.sfxMuted = muted;
    }

    // 绑定全局解锁事件（最激进的解锁策略）
    bindGlobalUnlock() {
        if (typeof window === 'undefined') return;

        const unlock = () => {
            // 调用统一的 resume 方法
            this.resume().then(() => {
                // 恢复成功后，如果还没播放BGM且没有静音，再次尝试播放
                // 如果 bgmSource 不存在，但有缓存，说明可能之前被 stop 或者还没开始
                if (!this.bgmSource && this.bgmBuffer && !this.bgmMuted) {
                    this.playBGM();
                }
            });
        };

        // 监听所有可能的用户交互，只要碰到浏览器就解锁
        const events = ['click', 'touchstart', 'touchend', 'keydown', 'mousemove', 'scroll', 'resize'];
        events.forEach(event => {
            window.addEventListener(event, unlock, { capture: true, passive: true });
        });
    }

    // 启动自动重试机制（针对 BGM）
    startAutoResumeCheck() {
        if (this.autoResumeTimer) clearInterval(this.autoResumeTimer);
        
        this.autoResumeTimer = setInterval(() => {
            if (this.ctx) {
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(() => {});
                } else if (this.ctx.state === 'running') {
                    // 如果已经是 running 状态，清理定时器
                    clearInterval(this.autoResumeTimer);
                    this.autoResumeTimer = null;
                }
            }
        }, 500); // 每半秒尝试唤醒一次
    }

    // 播放背景音乐
    async playBGM() {
        this.init();
        if (!this.ctx) return;
        
        // 启动看门狗定时器
        this.startAutoResumeCheck();

        // 1. 如果已经在播放 (bgmSource 存在) 或者正在加载中，则不重新开始，直接返回
        if (this.bgmSource || this.isLoading) {
            // 确保 Context 是 running 的即可
            if (this.ctx.state !== 'running') {
                this.ctx.resume().catch(() => {});
            }
            return;
        }

        // 2. 如果已经有缓存的数据，直接播放
        if (this.bgmBuffer) {
            this.startSourceNode(this.bgmBuffer);
            return;
        }

        // 3. 开始下载
        this.isLoading = true;
        try {
            console.log("Starting BGM download...");
            // 使用正确的 CDN 链接
            const response = await fetch('https://raw.githubusercontent.com/juren233/leapoffthings/main/assets/bgm.mp3');
            
            if (!response.ok) {
                throw new Error(`Fetch error: ${response.status}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            // 解码音频数据
            this.bgmBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            
            console.log("BGM decoded successfully");
            this.startSourceNode(this.bgmBuffer);

        } catch (e) {
            console.warn("BGM load failed, retrying in 2s...", e);
            // 失败后 2 秒自动重试
            setTimeout(() => {
                this.playBGM();
            }, 2000);
        } finally {
            this.isLoading = false;
        }
    }

    // 创建并启动音频源节点
    startSourceNode(buffer: AudioBuffer) {
        if (!this.ctx) return;

        // 如果之前有在该播放的，先停掉，防止重音
        if (this.bgmSource) {
            try { this.bgmSource.stop(); } catch(e){}
            this.bgmSource.disconnect();
        }
        if (this.bgmGain) {
            this.bgmGain.disconnect();
        }

        // 创建新的节点链
        this.bgmGain = this.ctx.createGain();
        // 初始化音量：如果已静音则为0，否则为 1.0
        this.bgmGain.gain.value = this.bgmMuted ? 0 : 1.0; 
        this.bgmGain.connect(this.ctx.destination);

        this.bgmSource = this.ctx.createBufferSource();
        this.bgmSource.buffer = buffer;
        this.bgmSource.loop = true;
        this.bgmSource.connect(this.bgmGain);

        // 立即启动！
        this.bgmSource.start(0);
        console.log("BGM Source started (queued if suspended)");
    }

    stopBGM() {
        // 当前需求不主动停止BGM，留空或仅做标记
    }

    playScore() {
        // 检查 SFX 是否静音
        if (!this.ctx || this.sfxMuted) return;
        
        // SFX 播放时也顺便尝试唤醒
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

            // 音量设为 0.3
            gain.gain.setValueAtTime(0.3, t); 
            gain.gain.linearRampToValueAtTime(0, t + 0.15);

            osc.start(t);
            osc.stop(t + 0.15); 
        } catch (e) {}
    }
}

export const audioManager = new AudioManager();