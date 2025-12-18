import { createClient } from '@supabase/supabase-js';

// 获取环境变量，同时兼容可能没有定义 process 的环境
const env = typeof process !== 'undefined' && process.env ? process.env : {};

// 使用您提供的真实 Supabase 配置
// URL: https://ylxfyosqptavdqdoipyf.supabase.co
// Key: sb_publishable_wik-3uxuAOcUnvK1A6BhxA_5iC3d1HJ
const supabaseUrl = env.REACT_APP_SUPABASE_URL || 'https://ylxfyosqptavdqdoipyf.supabase.co';
const supabaseKey = env.REACT_APP_SUPABASE_ANON_KEY || 'sb_publishable_wik-3uxuAOcUnvK1A6BhxA_5iC3d1HJ';

export const supabase = createClient(supabaseUrl, supabaseKey);