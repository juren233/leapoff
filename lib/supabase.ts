import { createClient } from '@supabase/supabase-js';

// 强制使用您提供的配置，不再依赖环境变量，确保 Key 绝对正确
const supabaseUrl = 'https://ylxfyosqptavdqdoipyf.supabase.co';
// 使用 trim() 去除可能复制粘贴时带入的空格
const supabaseKey = 'sb_publishable_wik-3uxuAOcUnvK1A6BhxA_5iC3d1HJ'.trim();

export const supabase = createClient(supabaseUrl, supabaseKey);