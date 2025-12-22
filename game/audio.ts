/*
 * 文件作用：音频管理器，使用 Web Audio API 实时合成游戏音效及BGM
 * 注意：开头这段注释不得删除！！！
 */

class AudioManager {
    ctx: AudioContext | null = null;
    isMuted: boolean = false;
    
    // BGM 状态
    bgmGain: GainNode | null = null;
    bgmSource: AudioBufferSourceNode | null = null;
    isBgmPlaying: boolean = false;

    // 初始化音频上下文
    init() {
        if (!this.ctx) {
            // 兼容性处理：标准 API 或 Webkit 前缀
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
            }
        }
        
        if (this.ctx) {
            // 如果上下文处于挂起状态，尝试恢复
            if (this.ctx.state === 'suspended') {
                this.ctx.resume().catch(e => {});
            }
        }
    }

    // 播放背景音乐：只负责播放 bgm.mp3，且循环
    async playBGM() {
        // 1. 检查状态：如果正在播放（或正在加载中），直接返回，防止重叠
        if (!this.ctx || this.isMuted || this.isBgmPlaying) return;
        
        // 2. 关键修复：在异步操作开始前，立即标记为 true。
        // 这能阻挡在 MP3 加载期间后续触发的调用（例如 React 重复渲染或用户狂点屏幕）。
        this.isBgmPlaying = true;
        
        // 尝试唤醒 AudioContext
        if (this.ctx.state === 'suspended') {
            try { await this.ctx.resume(); } catch(e) { 
                // 如果唤醒失败（极其罕见），重置标记允许重试
                // 但通常保持 true 防止报错刷屏
            }
        }

        // 创建 BGM 音量节点
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = 0.3; // BGM 背景音量
        this.bgmGain.connect(this.ctx.destination);

        try {
            // 修改路径：加载 assets 目录下的 bgm.mp3
            const response = await fetch('assets/bgm.mp3');
            if (!response.ok) throw new Error("BGM File not found");
            
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            
            // 双重检查：如果加载期间被外部强制停止（虽然目前逻辑没有停止），防止僵尸音轨
            if (!this.isBgmPlaying) return;

            this.bgmSource = this.ctx.createBufferSource();
            this.bgmSource.buffer = audioBuffer;
            this.bgmSource.loop = true; // 强制循环
            this.bgmSource.connect(this.bgmGain);
            this.bgmSource.start(0);
            
            console.log("BGM started");
            
        } catch (e) {
            console.warn("BGM load failed", e);
            // 只有在真正失败报错时，才重置标记，允许下次尝试
            this.isBgmPlaying = false; 
        }
    }

    // 停止背景音乐 (保留接口，防止报错，但在当前需求下不主动调用)
    stopBGM() {
        if (this.bgmSource) {
            try { this.bgmSource.stop(); } catch(e){}
            this.bgmSource.disconnect();
            this.bgmSource = null;
        }
        if (this.bgmGain) {
            this.bgmGain.disconnect();
            this.bgmGain = null;
        }
        this.isBgmPlaying = false;
    }

    // 播放吃到分数的音效
    playScore() {
        if (!this.ctx || this.isMuted) return;

        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }

        try {
            const t = this.ctx.currentTime;
            
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            /* 
             * 按要求：
             * 波形：triangle
             * 音量：0.4
             */
            osc.type = 'triangle';
            
            osc.frequency.setValueAtTime(440, t); 
            osc.frequency.linearRampToValueAtTime(880, t + 0.15);

            // 保持 0.4 音量
            gain.gain.setValueAtTime(0.4, t); 
            gain.gain.linearRampToValueAtTime(0, t + 0.15);

            osc.start(t);
            osc.stop(t + 0.15); 

        } catch (e) {
            console.error("Audio play error", e);
        }
    }
}

// 导出单例
export const audioManager = new AudioManager();