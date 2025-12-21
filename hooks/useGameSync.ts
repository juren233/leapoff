/*
 * 文件作用：自定义 Hook，封装游戏数据同步、用户鉴权和 Supabase 交互逻辑
 * 注意：开头这段注释不得删除！！！
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { SystemStatus, UploadStatus } from '../types';

export const useGameSync = (
    totalCoins: number,
    setTotalCoins: (val: number) => void,
    setHighScore: (val: number) => void,
    setRunCoins: (val: number) => void,
    totalCoinsRef: React.MutableRefObject<number>,
    hasSyncedToServerRef: React.MutableRefObject<boolean>,
    isSyncingRef: React.MutableRefObject<boolean>
) => {
    // Auth & System State
    const [session, setSession] = useState<any>(null);
    const sessionRef = useRef<any>(null);
    const [systemStatus, setSystemStatus] = useState<SystemStatus>({status: 'checking', msg: '正在连接服务器...'});
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>({status: 'idle', msg: ''});

    // Auth Modal State
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authUsername, setAuthUsername] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState('');

    // Fetch User Data
    const fetchUserData = useCallback(async (userId: string) => {
        try {
            const { data, error } = await supabase
              .from('high_scores')
              .select('score, coins')
              .eq('user_id', userId)
              .single();
            
            if (data) {
                setTotalCoins(data.coins || 0);
                setHighScore(data.score || 0);
                localStorage.setItem('leap_orbit_coins', (data.coins || 0).toString());
                // Also backup score locally
                localStorage.setItem('leap_orbit_highscore', (data.score || 0).toString());
            } else if (error && error.code === 'PGRST116') {
                setTotalCoins(0);
                setHighScore(0);
            }
        } catch (e) {
            console.error("Failed to fetch user data", e);
        }
    }, [setTotalCoins, setHighScore]);

    // Sync Data Logic
    const syncData = useCallback(async (score: number, currentRunCoins: number) => {
        const currentSession = sessionRef.current;
        
        // 1. Guest Mode: Simple Local Storage
        if (!currentSession || !currentSession.user) {
            // Update Coins
            const currentTotal = totalCoinsRef.current;
            const newTotal = currentTotal + currentRunCoins;
            setTotalCoins(newTotal);
            setRunCoins(0); 
            localStorage.setItem('leap_orbit_coins', newTotal.toString());

            // Update High Score (Restored Logic)
            const localHighScoreStr = localStorage.getItem('leap_orbit_highscore');
            const currentLocalHighScore = localHighScoreStr ? parseInt(localHighScoreStr, 10) : 0;

            if (score > currentLocalHighScore) {
                setHighScore(score);
                localStorage.setItem('leap_orbit_highscore', score.toString());
                setUploadStatus({status: 'idle', msg: '新纪录 (本地已保存)'});
            } else {
                setUploadStatus({status: 'idle', msg: '未登录，仅保存本地'});
            }

            return;
        }
    
        // 2. Auth Mode: Secure Server Sync
        if (hasSyncedToServerRef.current) {
            setUploadStatus({status: 'success', msg: '数据已同步'});
            return;
        }
    
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;
        
        setUploadStatus({status: 'uploading', msg: '正在同步数据...'});
    
        try {
            const username = currentSession.user.user_metadata.username || currentSession.user.email?.split('@')[0] || 'Unknown';
    
            const { data, error } = await supabase.rpc('sync_game_data', {
                p_username: username,
                p_score: score,
                p_coins_gained: currentRunCoins
            });
    
            if (error) throw error;
    
            if (data) {
                hasSyncedToServerRef.current = true; // Mark as synced
                
                // Update local state to match server's Truth
                setHighScore(data.score);
                setTotalCoins(data.coins);
                setRunCoins(0); // Clear run buffer
                
                localStorage.setItem('leap_orbit_coins', data.coins.toString());
                localStorage.setItem('leap_orbit_highscore', data.score.toString());
                
                let msg = '数据已同步';
                if (score >= data.score && score > 0) {
                     msg = '新纪录已保存！';
                } else if (data.score > score) {
                     const diff = data.score - score + 1;
                     msg = `再接再厉！还差 ${diff} 分就破记录了！`;
                }
                
                setUploadStatus({status: 'success', msg: msg});
            }
        } catch (err: any) {
            console.error("Sync Error:", err);
            
            if (err.code === '42703') {
                 setUploadStatus({status: 'error', msg: '数据库缺updated_at字段'});
            }
            else if (err.message && (err.message.includes('function') || err.message.includes('RPC'))) {
                 setUploadStatus({status: 'error', msg: '需更新数据库函数'});
            } else {
                 setUploadStatus({status: 'error', msg: '同步失败'});
            }
        } finally {
            isSyncingRef.current = false;
        }
    }, [setTotalCoins, setHighScore, setRunCoins, totalCoinsRef, hasSyncedToServerRef, isSyncingRef]);

    // Handle Auth Actions
    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError('');
        try {
          if (authMode === 'signup') {
            const { error } = await supabase.auth.signUp({
              email: authEmail,
              password: authPassword,
              options: { data: { username: authUsername } },
            });
            if (error) throw error;
            alert("注册成功。请先验证邮箱再登录！");
            setAuthMode('login'); 
          } else {
            const { error } = await supabase.auth.signInWithPassword({
              email: authEmail,
              password: authPassword,
            });
            if (error) throw error;
            setShowAuthModal(false);
          }
        } catch (err: any) {
          setAuthError(err.message);
        } finally {
          setAuthLoading(false);
        }
    };
    
    const handleLogout = async () => {
        await supabase.auth.signOut();
        // Clear state but reload from local if exists
        setTotalCoins(0);
        setHighScore(0);
        
        const localCoins = localStorage.getItem('leap_orbit_coins');
        const localScore = localStorage.getItem('leap_orbit_highscore');
        
        if (localCoins) setTotalCoins(parseInt(localCoins, 10));
        if (localScore) setHighScore(parseInt(localScore, 10));
        
        setUploadStatus({status: 'idle', msg: ''});
    };

    // Initial Setup Effect
    useEffect(() => {
        // 1. Initial Local Load (Guest Mode)
        const localCoins = localStorage.getItem('leap_orbit_coins');
        const localScore = localStorage.getItem('leap_orbit_highscore');
        
        if (localCoins) {
            const val = parseInt(localCoins, 10);
            setTotalCoins(val);
        }
        if (localScore) {
            const val = parseInt(localScore, 10);
            setHighScore(val);
        }
    
        // 2. Check Connection
        const checkConnection = async () => {
            try {
                const { error } = await supabase.from('high_scores').select('count', { count: 'exact', head: true });
                if (error) {
                    if (error.code === '42P01') {
                         setSystemStatus({status: 'error', msg: '数据库配置错误'});
                    } else {
                         setSystemStatus({status: 'error', msg: '离线模式'});
                    }
                } else {
                    setSystemStatus({status: 'ok', msg: '已连接云端'});
                }
            } catch (err: any) {
                setSystemStatus({status: 'error', msg: '网络异常'});
            }
        };
        checkConnection();
    
        // 3. Auth Listener
        supabase.auth.getSession().then(({ data: { session } }) => {
          setSession(session);
          sessionRef.current = session;
        });
    
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          setSession(session);
          sessionRef.current = session;
        });
    
        return () => subscription.unsubscribe();
    }, [setTotalCoins, setHighScore]);

    return {
        session,
        sessionRef,
        uploadStatus,
        setUploadStatus,
        systemStatus,
        showAuthModal,
        setShowAuthModal,
        authMode,
        setAuthMode,
        authEmail,
        setAuthEmail,
        authPassword,
        setAuthPassword,
        authUsername,
        setAuthUsername,
        authLoading,
        authError,
        fetchUserData,
        syncData,
        handleAuth,
        handleLogout
    };
};
