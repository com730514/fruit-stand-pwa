import { createClient } from "@supabase/supabase-js";

// 這兩組是「水果攤記帳」專案的雲端資料庫連線資訊。
// Project URL 一般公開沒關係；Publishable key 本來就是設計給前端／瀏覽器使用的公開金鑰。
const supabaseUrl = "https://ctljiipkiduhedyvojml.supabase.co";
const supabaseKey = "sb_publishable_nVVMSnY2zC5x7Vgj9XZVnw_zhxAswda";

export const supabase = createClient(supabaseUrl, supabaseKey);
