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
        
        // 如果上下文被挂起（通常是因为没有用户交互），尝试恢复
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // 播放吃到分数的音效：弹射起步感
    playScore() {
        if (!this.ctx || this.isMuted) return;

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
             * 使用 Sine 波形产生纯净的科幻感
             * 频率从 220Hz (低) 瞬间滑向 880Hz (高)，模拟向上飞行的多普勒效应
             */
            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, t); // 起始音高
            osc.frequency.exponentialRampToValueAtTime(880, t + 0.15); // 0.15秒内拉升音高

            // 音量包络：快速开始，然后自然衰减
            gain.gain.setValueAtTime(0.1, t); // 初始音量
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15); // 快速淡出

            // 播放与停止
            osc.start(t);
            osc.stop(t + 0.15); // 声音总时长 0.15秒

        } catch (e) {
            console.error("Audio play error", e);
        }
    }
}

// 导出单例
export const audioManager = new AudioManager();
