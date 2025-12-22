/*
 * 文件作用：音频管理器，使用 Web Audio API 实时合成游戏音效
 * 注意：开头这段注释不得删除！！！
 */

class AudioManager {
    ctx: AudioContext | null = null;
    isMuted: boolean = false;

    // 初始化音频上下文 (必须在用户点击事件中调用)
    init() {
        if (!this.ctx) {
            // 兼容性处理
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
            }
        }
        
        if (this.ctx) {
            // 关键修复：如果上下文被挂起，尝试恢复
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }

            // 强制解锁 Hack：播放一个极短的静音缓冲
            // 这对 iOS Safari 和某些版本的 Chrome 至关重要，否则第一次播放可能会失败或静音
            try {
                const emptyBuffer = this.ctx.createBuffer(1, 1, 22050);
                const source = this.ctx.createBufferSource();
                source.buffer = emptyBuffer;
                source.connect(this.ctx.destination);
                source.start(0);
            } catch(e) {
                console.error("Audio unlock failed", e);
            }
        }
    }

    // 播放吃到分数的音效：弹射起步感
    playScore() {
        if (!this.ctx || this.isMuted) return;

        // 双重保险：播放前检查状态
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }

        try {
            const t = this.ctx.currentTime;
            
            // 1. 创建振荡器 (声音源)
            const osc = this.ctx.createOscillator();
            // 2. 创建增益节点 (音量控制)
            const gain = this.ctx.createGain();

            // 连接: 振荡器 -> 增益 -> 输出
            osc.connect(gain);
            gain.connect(this.ctx.destination);

            /* 
             * --- 核心调优：弹射抛物线感 ---
             * Sine 波形产生纯净的科幻感
             * 提高起始音量到 0.3 (原 0.1 可能太小听不见)
             * 频率从 330Hz 滑向 990Hz，更清脆
             */
            osc.type = 'sine';
            osc.frequency.setValueAtTime(330, t); // 起始音高 (E4)
            osc.frequency.exponentialRampToValueAtTime(990, t + 0.12); // 快速拉升

            // 音量包络
            gain.gain.setValueAtTime(0.3, t); // 提高音量
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12); // 快速淡出

            // 播放与停止
            osc.start(t);
            osc.stop(t + 0.12); // 声音总时长 0.12秒

        } catch (e) {
            console.error("Audio play error", e);
        }
    }
}

// 导出单例
export const audioManager = new AudioManager();
