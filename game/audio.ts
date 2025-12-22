/*
 * 文件作用：音频管理器，使用 Web Audio API 实时合成游戏音效
 * 注意：开头这段注释不得删除！！！
 */

class AudioManager {
    ctx: AudioContext | null = null;
    isMuted: boolean = false;

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
            // 如果上下文处于挂起状态（常见于自动播放策略限制），尝试恢复
            if (this.ctx.state === 'suspended') {
                this.ctx.resume().catch(e => console.warn("Audio resume failed", e));
            }
        }
    }

    // 播放吃到分数的音效：街机风格
    playScore() {
        if (!this.ctx || this.isMuted) return;

        // 再次检查状态，确保在播放前处于运行状态
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
             * --- 核心调优：更清脆响亮的街机音效 ---
             * 1. 波形：维持 triangle (三角波)，穿透力强
             * 2. 频率：440Hz -> 880Hz (标准 A4 到 A5)，上扬音
             * 3. 音量：大幅提升至 0.4 (原 0.15)，确保听得见
             * 4. 时长：延长至 0.15s，增加一点余韵
             */
            osc.type = 'triangle';
            
            // 频率变化
            osc.frequency.setValueAtTime(440, t); 
            osc.frequency.linearRampToValueAtTime(880, t + 0.15);

            // 音量变化：大幅增强
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