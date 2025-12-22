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
    }

    // 新增：尝试恢复音频上下文（由外部交互触发）
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            // 捕获错误，防止控制台报红
            this.ctx.resume().catch(() => {});
        }
    }

    // 播放背景音乐：只负责播放 bgm.mp3，且循环
    async playBGM() {
        this.init(); // 确保已初始化

        // 1. 检查状态：如果已有 source 正在播放或加载中，直接返回
        if (!this.ctx || this.isMuted || this.isBgmPlaying) return;
        
        // 立即标记为正在处理，防止重复调用
        this.isBgmPlaying = true;
        
        // 关键修改：不要在这里 await this.ctx.resume()！
        // 因为如果没有用户交互，resume 会挂起 Promise，导致后面的 fetch 永远不执行。
        // 我们直接往下走，先加载数据。等用户动了鼠标，声音自然会出来。
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {}); // 尝试唤醒，但不等待
        }

        // 创建 BGM 音量节点
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = 1.0; // BGM 背景音量
        this.bgmGain.connect(this.ctx.destination);

        try {
            // 修改路径：使用 raw.githubusercontent.com 域名以解决跨域(CORS)问题
            const response = await fetch('https://raw.githubusercontent.com/juren233/leapoffthings/main/assets/bgm.mp3');
            
            if (!response.ok) {
                throw new Error(`BGM Fetch failed with status: ${response.status}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            // 注意：decodeAudioData 在某些浏览器也是异步的
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            
            // 再次检查标记（防止加载过程中被静音）
            // if (!this.isBgmPlaying) return; 

            // 如果之前有残留的 source，先停止
            if (this.bgmSource) {
                try { this.bgmSource.stop(); } catch(e){}
                this.bgmSource.disconnect();
            }

            this.bgmSource = this.ctx.createBufferSource();
            this.bgmSource.buffer = audioBuffer;
            this.bgmSource.loop = true; // 强制循环
            this.bgmSource.connect(this.bgmGain);
            
            // 立即开始播放时间轴
            // 如果 ctx 是 suspended，它会在后台“播放”，一旦 resume 就会立刻听到声音
            this.bgmSource.start(0);
            
            console.log("BGM loaded and scheduled");
            
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

        // 每次播放音效都尝试唤醒一下，增加保险
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

            gain.gain.setValueAtTime(0.3, t); 
            gain.gain.linearRampToValueAtTime(0, t + 0.15);

            osc.start(t);
            osc.stop(t + 0.15); 

        } catch (e) {
            // console.error("Audio play error", e); // 忽略频繁的报错
        }
    }
}

// 导出单例
export const audioManager = new AudioManager();