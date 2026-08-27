import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabaseClient.js";

/* ============ 視覺設定（水果攤 · 木箱與牛皮紙的暖色調） ============ */
const THEME = {
  paper: "#FBF5E9",       // 牛皮紙/淺色背景
  paperDeep: "#F3E9D4",   // 卡片底色
  crate: "#7A4E2D",       // 木箱深棕（標題、主要文字）
  crateSoft: "#A8763F",   // 木箱淺棕（次要文字）
  ink: "#3B2A1A",         // 最深文字色
  income: "#4C8C4A",      // 柔和綠 - 營業額
  incomeBg: "#E7F1E3",
  expense: "#C9622C",     // 柔和橘紅 - 支出
  expenseBg: "#FBE9DD",
  purchase: "#9C6B2E",    // 進貨 - 琥珀棕
  purchaseBg: "#F3E4C9",
  leftover: "#6C7A56",    // 剩貨 - 橄欖綠
  leftoverBg: "#EDF0E4",
  line: "#E4D5B7",
  danger: "#B33A2E",
  white: "#FFFFFF",
};

const FRUIT_ICONS = ["🍎","🍐","🍌","🍇","🍊","🥭","🍉","🍈","🥝","🍑","🍋","🍒","🍍","🥥","🧺"];

const DEFAULT_FRUITS = [
  { id: "apple", emoji: "🍎", name: "蘋果" },
  { id: "pear", emoji: "🍐", name: "梨子" },
  { id: "banana", emoji: "🍌", name: "香蕉" },
  { id: "grape", emoji: "🍇", name: "葡萄" },
  { id: "orange", emoji: "🍊", name: "柳丁" },
  { id: "mango", emoji: "🥭", name: "芒果" },
  { id: "watermelon", emoji: "🍉", name: "西瓜" },
  { id: "melon", emoji: "🍈", name: "哈密瓜" },
  { id: "kiwi", emoji: "🥝", name: "奇異果" },
  { id: "peach", emoji: "🍑", name: "桃子" },
  { id: "other", emoji: "🧺", name: "其他" },
];

const EXPENSE_CATS = [
  { id: "shipping", emoji: "🚚", name: "運費" },
  { id: "bags", emoji: "🛍️", name: "袋子／包材" },
  { id: "stall", emoji: "🏪", name: "攤位費" },
  { id: "meal", emoji: "🍱", name: "吃飯" },
  { id: "fuel", emoji: "⛽", name: "油錢" },
  { id: "other", emoji: "📦", name: "其他" },
];

/* ============ 工具函式 ============ */
const pad2 = (n) => String(n).padStart(2, "0");
const toDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const toTimeStr = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const todayStr = () => toDateStr(new Date());
const fmtMoney = (n) => {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString("zh-TW");
};
const weekdayZh = (d) => ["星期日","星期一","星期二","星期三","星期四","星期五","星期六"][d.getDay()];
const fmtDateZh = (d) => `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 ${weekdayZh(d)}`;
const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function addDays(dateStr, delta) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return toDateStr(d);
}
function startOfWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return toDateStr(d);
}
function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}

/* ============ 資料儲存 ============ *
 * 資料存在 Supabase 雲端資料庫（表格：fruitstand_state）。
 * 換手機、關掉 App、重開機都不會消失；只要用同一個網址打開就能看到同一份資料。
 * 如果之後想做「家人查看模式」，也是靠這個雲端資料庫來實現多裝置查看。
 */
const TABLE = "fruitstand_state";

async function loadEntries() {
  try {
    const { data, error } = await supabase.from(TABLE).select("value").eq("key", "entries").maybeSingle();
    if (error || !data) return [];
    return data.value || [];
  } catch (e) {
    return [];
  }
}
async function saveEntriesToCloud(entries) {
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ key: "entries", value: entries, updated_at: new Date().toISOString() });
    return !error;
  } catch (e) {
    return false;
  }
}
async function loadSettings() {
  try {
    const { data, error } = await supabase.from(TABLE).select("value").eq("key", "settings").maybeSingle();
    if (error || !data) return { fruits: DEFAULT_FRUITS, fontScale: 1 };
    return data.value || { fruits: DEFAULT_FRUITS, fontScale: 1 };
  } catch (e) {
    return { fruits: DEFAULT_FRUITS, fontScale: 1 };
  }
}
async function saveSettingsToCloud(settings) {
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ key: "settings", value: settings, updated_at: new Date().toISOString() });
    return !error;
  } catch (e) {
    return false;
  }
}

/* ============ 共用元件 ============ */

function TopBar({ title, onBack, onSettings }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-3">
      {onBack ? (
        <button
          onClick={onBack}
          className="flex items-center rounded-full active:opacity-70"
          style={{ height: 48, minWidth: 48, paddingLeft: 14, paddingRight: 16, backgroundColor: THEME.paperDeep, color: THEME.crate, fontSize: 17, fontWeight: 800, gap: 4 }}
        >
          <span style={{ fontSize: 24 }}>←</span>
          <span>回首頁</span>
        </button>
      ) : (
        <div style={{ width: 48 }} />
      )}
      <div style={{ color: THEME.ink, fontSize: 22, fontWeight: 800 }}>{title}</div>
      {onSettings ? (
        <button
          onClick={onSettings}
          className="flex items-center justify-center rounded-full"
          style={{ width: 48, height: 48, backgroundColor: THEME.paperDeep, color: THEME.crate, fontSize: 22 }}
          aria-label="設定"
        >
          ⚙️
        </button>
      ) : (
        <div style={{ width: 48 }} />
      )}
    </div>
  );
}

function BigButton({ emoji, label, sub, color, bg, onClick, height = 76, fontSize = 20 }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl flex items-center px-5 mb-4 active:opacity-70"
      style={{
        height,
        backgroundColor: bg || THEME.white,
        border: `2px solid ${THEME.line}`,
        boxShadow: "0 2px 0 rgba(122,78,45,0.08)",
      }}
    >
      {emoji && <span style={{ fontSize: fontSize + 14, marginRight: 16 }}>{emoji}</span>}
      <div className="flex-1 text-left">
        <div style={{ fontSize, fontWeight: 800, color: color || THEME.ink }}>{label}</div>
        {sub && <div style={{ fontSize: 15, color: THEME.crateSoft, marginTop: 2 }}>{sub}</div>}
      </div>
    </button>
  );
}

function GridPickButton({ emoji, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl flex flex-col items-center justify-center active:opacity-70"
      style={{ height: 96, backgroundColor: THEME.white, border: `2px solid ${THEME.line}` }}
    >
      <span style={{ fontSize: 34 }}>{emoji}</span>
      <span style={{ fontSize: 17, fontWeight: 700, color: THEME.ink, marginTop: 6 }}>{label}</span>
    </button>
  );
}

function AmountEntry({ title, hint, value, onChange, onSave, onCancel, accentColor, alreadyMsg }) {
  return (
    <div className="px-5">
      <div style={{ fontSize: 20, fontWeight: 800, color: THEME.ink, marginBottom: 6 }}>{title}</div>
      {hint && <div style={{ fontSize: 15, color: THEME.crateSoft, marginBottom: 18 }}>{hint}</div>}
      {alreadyMsg && (
        <div
          className="rounded-xl px-4 py-3 mb-4"
          style={{ backgroundColor: THEME.expenseBg, color: THEME.expense, fontSize: 15, fontWeight: 700 }}
        >
          {alreadyMsg}
        </div>
      )}
      <div
        className="rounded-2xl flex items-center justify-center mb-6"
        style={{ height: 110, backgroundColor: THEME.white, border: `2px solid ${THEME.line}` }}
      >
        <span style={{ fontSize: 34, fontWeight: 800, color: THEME.crateSoft, marginRight: 4 }}>$</span>
        <input
          autoFocus
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9]/g, "");
            onChange(v);
          }}
          placeholder="0"
          className="text-center bg-transparent outline-none"
          style={{ fontSize: 48, fontWeight: 800, color: accentColor || THEME.ink, width: "70%" }}
        />
      </div>
      <button
        onClick={onSave}
        className="w-full rounded-2xl mb-3 active:opacity-80"
        style={{ height: 68, backgroundColor: accentColor || THEME.crate, color: THEME.white, fontSize: 22, fontWeight: 800 }}
      >
        儲存
      </button>
      <button
        onClick={onCancel}
        className="w-full rounded-2xl active:opacity-70"
        style={{ height: 56, backgroundColor: "transparent", color: THEME.crateSoft, fontSize: 17, fontWeight: 700 }}
      >
        取消
      </button>
    </div>
  );
}

function ConfirmModal({ open, title, message, confirmText = "確定", cancelText = "取消", danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-6"
      style={{ backgroundColor: "rgba(59,42,26,0.45)", zIndex: 60 }}
    >
      <div className="w-full rounded-2xl p-5" style={{ backgroundColor: THEME.white, maxWidth: 360 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: THEME.ink, marginBottom: 8 }}>{title}</div>
        {message && <div style={{ fontSize: 15, color: THEME.crateSoft, marginBottom: 20 }}>{message}</div>}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl active:opacity-70"
            style={{ height: 54, backgroundColor: THEME.paperDeep, color: THEME.ink, fontSize: 17, fontWeight: 700 }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl active:opacity-80"
            style={{ height: 54, backgroundColor: danger ? THEME.danger : THEME.crate, color: THEME.white, fontSize: 17, fontWeight: 700 }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      className="fixed left-1/2 flex items-center justify-center px-6"
      style={{ bottom: 40, transform: "translateX(-50%)", zIndex: 60 }}
    >
      <div
        className="rounded-full px-6 py-3"
        style={{ backgroundColor: THEME.ink, color: THEME.white, fontSize: 16, fontWeight: 700, boxShadow: "0 6px 16px rgba(0,0,0,0.2)" }}
      >
        {message}
      </div>
    </div>
  );
}

/* ============ 主程式 ============ */
export default function FruitStandApp() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [settings, setSettings] = useState({ fruits: DEFAULT_FRUITS, fontScale: 1 });
  const [view, setView] = useState("home");
  const [toast, setToast] = useState("");
  const [confirmModal, setConfirmModal] = useState(null);

  // 暫存輸入狀態
  const [pickedFruit, setPickedFruit] = useState(null);
  const [pickedCat, setPickedCat] = useState(null);
  const [amount, setAmount] = useState("");
  const [splitEntries, setSplitEntries] = useState([]); // {fruit, amount}
  const [splitFruit, setSplitFruit] = useState(null);

  const [historyTab, setHistoryTab] = useState("today");
  const [historyDate, setHistoryDate] = useState(todayStr());
  const [editRecord, setEditRecord] = useState(null);
  const [editAmount, setEditAmount] = useState("");

  const [monthCursor, setMonthCursor] = useState(monthKey(todayStr()));
  const [newFruitName, setNewFruitName] = useState("");
  const [newFruitEmoji, setNewFruitEmoji] = useState("🍎");

  useEffect(() => {
    (async () => {
      const [e, s] = await Promise.all([loadEntries(), loadSettings()]);
      setEntries(e);
      setSettings(s);
      setLoading(false);
    })();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1600);
  };

  const persistEntries = useCallback(async (next) => {
    setEntries(next);
    await saveEntriesToCloud(next);
  }, []);

  const persistSettings = useCallback(async (next) => {
    setSettings(next);
    await saveSettingsToCloud(next);
  }, []);

  const goHome = () => {
    setView("home");
    setPickedFruit(null);
    setPickedCat(null);
    setAmount("");
    setSplitEntries([]);
    setSplitFruit(null);
  };

  /* ---------- 今日彙總 ---------- */
  const today = todayStr();
  const todayEntries = useMemo(() => entries.filter((e) => e.date === today), [entries, today]);
  const todaySummary = useMemo(() => {
    let revenue = 0, purchase = 0, expense = 0, leftoverVal = 0;
    todayEntries.forEach((e) => {
      if (e.type === "營業額") revenue += e.amount;
      else if (e.type === "進貨") purchase += e.amount;
      else if (e.type === "支出") expense += e.amount;
      else if (e.type === "剩貨") leftoverVal = e.amount;
    });
    return { revenue, purchase, expense, leftoverVal, diff: revenue - purchase - expense };
  }, [todayEntries]);
  const hasTodayRevenue = todayEntries.some((e) => e.type === "營業額");
  const hasTodayLeftover = todayEntries.some((e) => e.type === "剩貨");

  /* ---------- 新增紀錄 ---------- */
  const addEntry = async (partial) => {
    const now = new Date();
    const entry = {
      id: genId(),
      date: today,
      time: toTimeStr(now),
      note: "",
      ...partial,
    };
    const next = [...entries, entry];
    await persistEntries(next);
    return entry;
  };

  const handleSaveBuy = async () => {
    const v = Number(amount);
    if (!v || v <= 0) { showToast("請輸入金額"); return; }
    await addEntry({ type: "進貨", fruit: pickedFruit.name, emoji: pickedFruit.emoji, amount: v });
    showToast(`已記下${pickedFruit.name}進貨 ${fmtMoney(v)} 元`);
    goHome();
  };

  const handleSaveExpense = async () => {
    const v = Number(amount);
    if (!v || v <= 0) { showToast("請輸入金額"); return; }
    await addEntry({ type: "支出", fruit: pickedCat.name, emoji: pickedCat.emoji, amount: v });
    showToast(`已記下${pickedCat.name} ${fmtMoney(v)} 元`);
    goHome();
  };

  const doSaveSellTotal = async (replaceId) => {
    const v = Number(amount);
    if (!v || v <= 0) { showToast("請輸入金額"); return; }
    if (replaceId) {
      const next = entries.map((e) => (e.id === replaceId ? { ...e, amount: v, time: toTimeStr(new Date()) } : e));
      await persistEntries(next);
    } else {
      await addEntry({ type: "營業額", fruit: "全部", emoji: "💰", amount: v });
    }
    showToast(`已記下今日營業額 ${fmtMoney(v)} 元`);
    goHome();
  };

  const handleSaveSellTotal = () => {
    const v = Number(amount);
    if (!v || v <= 0) { showToast("請輸入金額"); return; }
    if (hasTodayRevenue) {
      const existing = todayEntries.find((e) => e.type === "營業額");
      setConfirmModal({
        title: `今天已經記過 ${fmtMoney(existing.amount)} 元`,
        message: "要修改原本的紀錄，還是新增一筆？",
        confirmText: "新增一筆",
        cancelText: "修改原本紀錄",
        onConfirm: () => { setConfirmModal(null); doSaveSellTotal(null); },
        onCancel: () => { setConfirmModal(null); doSaveSellTotal(existing.id); },
      });
    } else {
      doSaveSellTotal(null);
    }
  };

  const handleAddSplitLine = () => {
    const v = Number(amount);
    if (!v || v <= 0) { showToast("請輸入金額"); return; }
    setSplitEntries((prev) => [...prev, { fruit: splitFruit.name, emoji: splitFruit.emoji, amount: v }]);
    setAmount("");
    setSplitFruit(null);
  };

  const handleSaveSplitAll = async () => {
    if (splitEntries.length === 0) { showToast("請至少輸入一項"); return; }
    const total = splitEntries.reduce((s, l) => s + l.amount, 0);
    for (const line of splitEntries) {
      await addEntry({ type: "營業額", fruit: line.fruit, emoji: line.emoji, amount: line.amount, note: "分項" });
    }
    showToast(`已記下今日營業額共 ${fmtMoney(total)} 元`);
    goHome();
  };

  const handleSaveLeftover = async (val) => {
    const next = entries.filter((e) => !(e.date === today && e.type === "剩貨"));
    if (val > 0) {
      next.push({ id: genId(), date: today, time: toTimeStr(new Date()), type: "剩貨", fruit: "剩貨估值", emoji: "🧺", amount: val, note: "" });
    }
    await persistEntries(next);
    showToast("已記錄剩貨");
    goHome();
  };

  /* ---------- 刪除／修改 ---------- */
  const askDelete = (record) => {
    setConfirmModal({
      title: "確定要刪除這筆紀錄嗎？",
      message: `${record.emoji} ${record.fruit}｜${fmtMoney(record.amount)} 元`,
      confirmText: "確定刪除",
      cancelText: "取消",
      danger: true,
      onConfirm: async () => {
        const next = entries.filter((e) => e.id !== record.id);
        await persistEntries(next);
        setConfirmModal(null);
        setEditRecord(null);
        showToast("已刪除");
      },
      onCancel: () => setConfirmModal(null),
    });
  };

  const saveEdit = async () => {
    const v = Number(editAmount);
    if (!v || v <= 0) { showToast("請輸入金額"); return; }
    const next = entries.map((e) => (e.id === editRecord.id ? { ...e, amount: v } : e));
    await persistEntries(next);
    setEditRecord(null);
    showToast("已更新");
  };

  /* ---------- 歷史紀錄範圍 ---------- */
  const historyList = useMemo(() => {
    let from, to;
    if (historyTab === "today") { from = today; to = today; }
    else if (historyTab === "yesterday") { from = addDays(today, -1); to = addDays(today, -1); }
    else if (historyTab === "week") { from = startOfWeek(today); to = today; }
    else if (historyTab === "month") { from = today.slice(0, 8) + "01"; to = today; }
    else { from = historyDate; to = historyDate; }
    return entries
      .filter((e) => e.date >= from && e.date <= to)
      .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
  }, [entries, historyTab, historyDate, today]);

  const historyGrouped = useMemo(() => {
    const map = {};
    historyList.forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [historyList]);

  const dayTotals = (list) => {
    let revenue = 0, purchase = 0, expense = 0, leftoverVal = 0;
    list.forEach((e) => {
      if (e.type === "營業額") revenue += e.amount;
      else if (e.type === "進貨") purchase += e.amount;
      else if (e.type === "支出") expense += e.amount;
      else if (e.type === "剩貨") leftoverVal += e.amount;
    });
    return { revenue, purchase, expense, leftoverVal };
  };

  /* ---------- 月報表 ---------- */
  const monthEntries = useMemo(() => entries.filter((e) => monthKey(e.date) === monthCursor), [entries, monthCursor]);
  const monthTotals = useMemo(() => {
    const t = dayTotals(monthEntries);
    const days = new Set(monthEntries.map((e) => e.date)).size;
    return { ...t, days, avg: days ? Math.round(t.revenue / days) : 0 };
  }, [monthEntries]);
  const dailyRevenueMap = useMemo(() => {
    const m = {};
    monthEntries.forEach((e) => {
      if (e.type === "營業額") m[e.date] = (m[e.date] || 0) + e.amount;
    });
    return m;
  }, [monthEntries]);
  const maxDailyRevenue = Math.max(1, ...Object.values(dailyRevenueMap));

  const fruitPurchaseStats = useMemo(() => {
    const m = {};
    monthEntries.forEach((e) => {
      if (e.type === "進貨") m[e.fruit] = (m[e.fruit] || 0) + e.amount;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [monthEntries]);

  /* ---------- CSV 匯出 ---------- */
  const exportCsv = () => {
    const rows = [["日期", "時間", "類型", "水果／項目", "金額", "備註"]];
    [...entries]
      .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))
      .forEach((e) => rows.push([e.date, e.time, e.type, e.fruit, e.amount, e.note || ""]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `水果攤記帳_${todayStr()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("已匯出 CSV");
  };

  /* ---------- 水果／類別管理 ---------- */
  const addFruit = async () => {
    if (!newFruitName.trim()) { showToast("請輸入名稱"); return; }
    const next = { ...settings, fruits: [...settings.fruits, { id: genId(), emoji: newFruitEmoji, name: newFruitName.trim() }] };
    await persistSettings(next);
    setNewFruitName("");
  };
  const removeFruit = async (id) => {
    const next = { ...settings, fruits: settings.fruits.filter((f) => f.id !== id) };
    await persistSettings(next);
  };

  const scale = settings.fontScale || 1;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: THEME.paper }}>
        <div style={{ color: THEME.crate, fontSize: 20, fontWeight: 700 }}>讀取中…</div>
      </div>
    );
  }

  /* ============ 畫面：首頁 ============ */
  const HomeView = () => (
    <div>
      <div className="px-5 pt-6 pb-2">
        <div style={{ fontSize: 26 * scale, fontWeight: 900, color: THEME.crate }}>水果攤記帳</div>
        <div style={{ fontSize: 15 * scale, color: THEME.crateSoft, marginTop: 4 }}>{fmtDateZh(new Date())}</div>
      </div>
      <div className="px-5 mt-4">
        <BigButton emoji="➕" label="今天進貨" color={THEME.purchase} bg={THEME.purchaseBg} onClick={() => setView("buyFruit")} />
        <BigButton emoji="💰" label="今天賣多少" color={THEME.income} bg={THEME.incomeBg} onClick={() => setView("sellTotal")} />
        <BigButton emoji="➖" label="其他支出" color={THEME.expense} bg={THEME.expenseBg} onClick={() => setView("expenseCat")} />
        <BigButton emoji="📖" label="查以前紀錄" color={THEME.crate} bg={THEME.white} onClick={() => setView("history")} />
      </div>

      <div className="px-5 mt-2">
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: THEME.paperDeep, border: `2px solid ${THEME.line}` }}
        >
          <div style={{ fontSize: 17 * scale, fontWeight: 800, color: THEME.ink, marginBottom: 12 }}>今天</div>
          <SummaryRow label="營業額" value={todaySummary.revenue} color={THEME.income} />
          <SummaryRow label="進貨" value={todaySummary.purchase} color={THEME.purchase} />
          <SummaryRow label="其他支出" value={todaySummary.expense} color={THEME.expense} />
          <div style={{ height: 1, backgroundColor: THEME.line, margin: "10px 0" }} />
          <SummaryRow label="今天現金差額" value={todaySummary.diff} color={THEME.ink} bold />
        </div>
        {!hasTodayLeftover && (
          <button
            onClick={() => setView("leftover")}
            className="w-full text-center mt-3"
            style={{ color: THEME.crateSoft, fontSize: 15 * scale, fontWeight: 700, textDecoration: "underline", marginBottom: 48 }}
          >
            今天還有剩貨嗎？（選填）
          </button>
        )}
      </div>
    </div>
  );

  const SummaryRow = ({ label, value, color, bold }) => (
    <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 16 * scale, color: THEME.crateSoft, fontWeight: bold ? 800 : 600 }}>{label}</div>
      <div style={{ fontSize: bold ? 22 * scale : 18 * scale, color, fontWeight: 800 }}>{fmtMoney(value)} 元</div>
    </div>
  );

  /* ============ 畫面：今天進貨 - 選水果 ============ */
  const BuyFruitView = () => (
    <div>
      <TopBar title="今天進貨" onBack={goHome} />
      <div className="px-5">
        <div style={{ fontSize: 17 * scale, color: THEME.crateSoft, marginBottom: 14, fontWeight: 700 }}>先選水果</div>
        <div className="grid grid-cols-3 gap-3">
          {settings.fruits.map((f) => (
            <GridPickButton key={f.id} emoji={f.emoji} label={f.name} onClick={() => { setPickedFruit(f); setAmount(""); setView("buyAmount"); }} />
          ))}
        </div>
      </div>
    </div>
  );

  const BuyAmountView = () => (
    <div>
      <TopBar title={`${pickedFruit.emoji} ${pickedFruit.name}`} onBack={() => setView("buyFruit")} />
      <AmountEntry
        title="今天這批買多少錢？"
        value={amount}
        onChange={setAmount}
        onSave={handleSaveBuy}
        onCancel={() => setView("buyFruit")}
        accentColor={THEME.purchase}
      />
    </div>
  );

  /* ============ 畫面：今天賣多少 ============ */
  const SellTotalView = () => (
    <div>
      <TopBar title="今天賣多少" onBack={goHome} />
      <AmountEntry
        title="今天總共賣多少錢？"
        value={amount}
        onChange={setAmount}
        onSave={handleSaveSellTotal}
        onCancel={goHome}
        accentColor={THEME.income}
      />
      <div className="px-5 mt-2">
        <button
          onClick={() => { setSplitEntries([]); setAmount(""); setView("sellSplit"); }}
          className="w-full text-center"
          style={{ color: THEME.crateSoft, fontSize: 15 * scale, fontWeight: 700, textDecoration: "underline" }}
        >
          我要分水果記（選填）
        </button>
      </div>
    </div>
  );

  const SellSplitView = () => {
    const total = splitEntries.reduce((s, l) => s + l.amount, 0);
    return (
      <div>
        <TopBar title="分水果記" onBack={() => setView("sellTotal")} />
        <div className="px-5">
          {splitEntries.length > 0 && (
            <div className="rounded-2xl mb-4 p-4" style={{ backgroundColor: THEME.incomeBg, border: `2px solid ${THEME.line}` }}>
              {splitEntries.map((l, i) => (
                <div key={i} className="flex justify-between" style={{ fontSize: 16 * scale, marginBottom: 6 }}>
                  <span>{l.emoji} {l.fruit}</span>
                  <span style={{ fontWeight: 800, color: THEME.income }}>{fmtMoney(l.amount)} 元</span>
                </div>
              ))}
              <div style={{ height: 1, backgroundColor: THEME.line, margin: "8px 0" }} />
              <div className="flex justify-between" style={{ fontSize: 18 * scale, fontWeight: 800 }}>
                <span>合計</span>
                <span style={{ color: THEME.income }}>{fmtMoney(total)} 元</span>
              </div>
            </div>
          )}
          <div style={{ fontSize: 16 * scale, color: THEME.crateSoft, marginBottom: 10, fontWeight: 700 }}>選水果加一筆</div>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {settings.fruits.map((f) => (
              <GridPickButton key={f.id} emoji={f.emoji} label={f.name} onClick={() => { setSplitFruit(f); setAmount(""); setView("sellSplitAmount"); }} />
            ))}
          </div>
          <button
            onClick={handleSaveSplitAll}
            className="w-full rounded-2xl mb-3 active:opacity-80"
            style={{ height: 68, backgroundColor: THEME.income, color: THEME.white, fontSize: 22, fontWeight: 800 }}
          >
            全部儲存
          </button>
        </div>
      </div>
    );
  };

  const SellSplitAmountView = () => (
    <div>
      <TopBar title={`${splitFruit.emoji} ${splitFruit.name}`} onBack={() => setView("sellSplit")} />
      <AmountEntry
        title="這個水果賣多少錢？"
        value={amount}
        onChange={setAmount}
        onSave={handleAddSplitLine}
        onCancel={() => setView("sellSplit")}
        accentColor={THEME.income}
      />
    </div>
  );

  /* ============ 畫面：其他支出 ============ */
  const ExpenseCatView = () => (
    <div>
      <TopBar title="其他支出" onBack={goHome} />
      <div className="px-5">
        <div className="grid grid-cols-2 gap-3">
          {EXPENSE_CATS.map((c) => (
            <GridPickButton key={c.id} emoji={c.emoji} label={c.name} onClick={() => { setPickedCat(c); setAmount(""); setView("expenseAmount"); }} />
          ))}
        </div>
      </div>
    </div>
  );

  const ExpenseAmountView = () => (
    <div>
      <TopBar title={`${pickedCat.emoji} ${pickedCat.name}`} onBack={() => setView("expenseCat")} />
      <AmountEntry
        title="花了多少錢？"
        value={amount}
        onChange={setAmount}
        onSave={handleSaveExpense}
        onCancel={() => setView("expenseCat")}
        accentColor={THEME.expense}
      />
    </div>
  );

  /* ============ 畫面：剩貨 ============ */
  const LeftoverView = () => (
    <div>
      <TopBar title="今天還有剩貨嗎？" onBack={goHome} />
      <div className="px-5">
        <BigButton label="沒剩" color={THEME.ink} bg={THEME.white} onClick={() => handleSaveLeftover(0)} />
        <BigButton label="剩一點" color={THEME.leftover} bg={THEME.leftoverBg} onClick={() => handleSaveLeftover(500)} />
        <BigButton label="剩很多" color={THEME.leftover} bg={THEME.leftoverBg} onClick={() => handleSaveLeftover(2000)} />
        <BigButton label="自己輸入金額" color={THEME.crate} bg={THEME.white} onClick={() => setView("leftoverAmount")} />
        <button onClick={goHome} className="w-full text-center mt-2" style={{ color: THEME.crateSoft, fontSize: 15 * scale, fontWeight: 700 }}>
          先不填，回首頁
        </button>
      </div>
    </div>
  );

  const LeftoverAmountView = () => (
    <div>
      <TopBar title="剩貨估值" onBack={() => setView("leftover")} />
      <AmountEntry
        title="剩下的水果大約值多少錢？"
        value={amount}
        onChange={setAmount}
        onSave={() => handleSaveLeftover(Number(amount) || 0)}
        onCancel={() => setView("leftover")}
        accentColor={THEME.leftover}
      />
    </div>
  );

  /* ============ 畫面：歷史紀錄 ============ */
  const TABS = [
    { id: "today", label: "今天" },
    { id: "yesterday", label: "昨天" },
    { id: "week", label: "本週" },
    { id: "month", label: "本月" },
    { id: "date", label: "選擇日期" },
  ];

  const HistoryView = () => (
    <div>
      <TopBar title="查以前紀錄" onBack={goHome} />
      <div className="px-5">
        <div className="flex gap-2 mb-4 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setHistoryTab(t.id)}
              className="rounded-full px-4 py-2"
              style={{
                backgroundColor: historyTab === t.id ? THEME.crate : THEME.paperDeep,
                color: historyTab === t.id ? THEME.white : THEME.ink,
                fontSize: 15 * scale,
                fontWeight: 700,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {historyTab === "date" && (
          <input
            type="date"
            value={historyDate}
            onChange={(e) => setHistoryDate(e.target.value)}
            className="w-full rounded-xl px-4 mb-4"
            style={{ height: 52, border: `2px solid ${THEME.line}`, fontSize: 16 * scale, backgroundColor: THEME.white, color: THEME.ink }}
          />
        )}

        {historyGrouped.length === 0 && (
          <div className="text-center" style={{ color: THEME.crateSoft, fontSize: 16 * scale, marginTop: 40 }}>
            這段時間還沒有紀錄
          </div>
        )}

        {historyGrouped.map(([date, list]) => {
          const t = dayTotals(list);
          return (
            <div key={date} className="mb-5">
              <div style={{ fontSize: 16 * scale, fontWeight: 800, color: THEME.crate, marginBottom: 6 }}>{date}</div>
              <div className="rounded-xl p-3 mb-2" style={{ backgroundColor: THEME.paperDeep }}>
                <div className="flex justify-between" style={{ fontSize: 14 * scale, color: THEME.crateSoft }}>
                  <span>營業 {fmtMoney(t.revenue)}</span>
                  <span>進貨 {fmtMoney(t.purchase)}</span>
                  <span>支出 {fmtMoney(t.expense)}</span>
                </div>
              </div>
              {list.map((e) => (
                <button
                  key={e.id}
                  onClick={() => { setEditRecord(e); setEditAmount(String(e.amount)); }}
                  className="w-full flex items-center justify-between rounded-xl px-4 py-3 mb-2 active:opacity-70"
                  style={{ backgroundColor: THEME.white, border: `1px solid ${THEME.line}` }}
                >
                  <div className="flex items-center">
                    <span style={{ fontSize: 22, marginRight: 10 }}>{e.emoji}</span>
                    <div className="text-left">
                      <div style={{ fontSize: 16 * scale, fontWeight: 700, color: THEME.ink }}>{e.fruit}</div>
                      <div style={{ fontSize: 13 * scale, color: THEME.crateSoft }}>{e.time}｜{e.type}</div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 17 * scale,
                      fontWeight: 800,
                      color: e.type === "營業額" ? THEME.income : e.type === "進貨" ? THEME.purchase : e.type === "支出" ? THEME.expense : THEME.leftover,
                    }}
                  >
                    {fmtMoney(e.amount)} 元
                  </div>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ============ 畫面：月報表 ============ */
  const shiftMonth = (delta) => {
    const [y, m] = monthCursor.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonthCursor(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
  };

  const MonthReportView = () => (
    <div>
      <TopBar title="本月報表" onBack={goHome} />
      <div className="px-5">
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => shiftMonth(-1)} style={{ fontSize: 26, color: THEME.crate, width: 44, height: 44 }}>‹</button>
          <div style={{ fontSize: 20 * scale, fontWeight: 800, color: THEME.ink }}>
            {monthCursor.split("-")[0]} 年 {Number(monthCursor.split("-")[1])} 月
          </div>
          <button onClick={() => shiftMonth(1)} style={{ fontSize: 26, color: THEME.crate, width: 44, height: 44 }}>›</button>
        </div>

        <div className="rounded-2xl p-5 mb-5" style={{ backgroundColor: THEME.paperDeep, border: `2px solid ${THEME.line}` }}>
          <SummaryRow label="本月營業額" value={monthTotals.revenue} color={THEME.income} />
          <SummaryRow label="本月進貨" value={monthTotals.purchase} color={THEME.purchase} />
          <SummaryRow label="其他支出" value={monthTotals.expense} color={THEME.expense} />
          <div style={{ height: 1, backgroundColor: THEME.line, margin: "10px 0" }} />
          <SummaryRow label="營業額－進貨－支出" value={monthTotals.revenue - monthTotals.purchase - monthTotals.expense} color={THEME.ink} bold />
          <div className="flex justify-between mt-3" style={{ fontSize: 15 * scale, color: THEME.crateSoft }}>
            <span>營業天數 {monthTotals.days} 天</span>
            <span>平均每天 {fmtMoney(monthTotals.avg)} 元</span>
          </div>
        </div>

        {Object.keys(dailyRevenueMap).length > 0 && (
          <div className="rounded-2xl p-4 mb-5" style={{ backgroundColor: THEME.white, border: `2px solid ${THEME.line}` }}>
            <div style={{ fontSize: 15 * scale, fontWeight: 700, color: THEME.crateSoft, marginBottom: 10 }}>每天營業額</div>
            <div className="flex items-end gap-1" style={{ height: 90 }}>
              {Object.entries(dailyRevenueMap).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([d, v]) => (
                <div
                  key={d}
                  title={`${d}: ${fmtMoney(v)}`}
                  style={{
                    flex: 1,
                    height: `${Math.max(6, (v / maxDailyRevenue) * 100)}%`,
                    backgroundColor: THEME.income,
                    borderRadius: 3,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => setView("fruitStats")}
          className="w-full rounded-2xl active:opacity-80"
          style={{ height: 60, backgroundColor: THEME.purchaseBg, color: THEME.purchase, fontSize: 17 * scale, fontWeight: 800 }}
        >
          🍇 查看本月水果進貨統計
        </button>
      </div>
    </div>
  );

  const FruitStatsView = () => (
    <div>
      <TopBar title="本月水果進貨統計" onBack={() => setView("monthReport")} />
      <div className="px-5">
        {fruitPurchaseStats.length === 0 && (
          <div className="text-center" style={{ color: THEME.crateSoft, fontSize: 16 * scale, marginTop: 30 }}>本月還沒有進貨紀錄</div>
        )}
        {fruitPurchaseStats.map(([name, val]) => (
          <div key={name} className="flex justify-between items-center rounded-xl px-4 py-3 mb-2" style={{ backgroundColor: THEME.white, border: `1px solid ${THEME.line}` }}>
            <span style={{ fontSize: 17 * scale, fontWeight: 700, color: THEME.ink }}>{name}</span>
            <span style={{ fontSize: 17 * scale, fontWeight: 800, color: THEME.purchase }}>{fmtMoney(val)} 元</span>
          </div>
        ))}
      </div>
    </div>
  );

  /* ============ 畫面：設定 ============ */
  const SettingsView = () => (
    <div>
      <TopBar title="設定" onBack={goHome} />
      <div className="px-5">
        <div style={{ fontSize: 16 * scale, fontWeight: 800, color: THEME.ink, marginBottom: 10 }}>字體大小</div>
        <div className="flex gap-2 mb-6">
          {[{ v: 1, l: "標準" }, { v: 1.15, l: "大" }, { v: 1.3, l: "特大" }].map((o) => (
            <button
              key={o.v}
              onClick={() => persistSettings({ ...settings, fontScale: o.v })}
              className="flex-1 rounded-xl py-3"
              style={{ backgroundColor: scale === o.v ? THEME.crate : THEME.paperDeep, color: scale === o.v ? THEME.white : THEME.ink, fontSize: 16, fontWeight: 700 }}
            >
              {o.l}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 16 * scale, fontWeight: 800, color: THEME.ink, marginBottom: 10 }}>水果品項管理</div>
        <div className="mb-3">
          {settings.fruits.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-xl px-4 py-3 mb-2" style={{ backgroundColor: THEME.white, border: `1px solid ${THEME.line}` }}>
              <span style={{ fontSize: 17 }}>{f.emoji} {f.name}</span>
              <button onClick={() => removeFruit(f.id)} style={{ color: THEME.danger, fontSize: 15, fontWeight: 700 }}>刪除</button>
            </div>
          ))}
        </div>
        <div className="rounded-xl p-3 mb-6" style={{ backgroundColor: THEME.paperDeep }}>
          <div className="flex gap-2 mb-2 flex-wrap">
            {FRUIT_ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setNewFruitEmoji(ic)}
                className="rounded-lg"
                style={{ width: 40, height: 40, fontSize: 20, backgroundColor: newFruitEmoji === ic ? THEME.crate : THEME.white, border: `1px solid ${THEME.line}` }}
              >
                {ic}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newFruitName}
              onChange={(e) => setNewFruitName(e.target.value)}
              placeholder="新增水果名稱"
              className="flex-1 rounded-lg px-3"
              style={{ height: 44, border: `1px solid ${THEME.line}`, fontSize: 16, backgroundColor: THEME.white }}
            />
            <button onClick={addFruit} className="rounded-lg px-4" style={{ backgroundColor: THEME.crate, color: THEME.white, fontWeight: 700 }}>新增</button>
          </div>
        </div>

        <div style={{ fontSize: 16 * scale, fontWeight: 800, color: THEME.ink, marginBottom: 10 }}>備份資料</div>
        <BigButton emoji="📤" label="匯出 CSV" height={60} fontSize={17} bg={THEME.white} onClick={exportCsv} />

        <div style={{ fontSize: 16 * scale, fontWeight: 800, color: THEME.ink, marginTop: 14, marginBottom: 10 }}>家人查看模式</div>
        <div className="rounded-xl px-4 py-3 mb-6" style={{ backgroundColor: THEME.paperDeep, color: THEME.crateSoft, fontSize: 15 }}>
          即將推出：讓女兒可以用自己的手機查看營業額與紀錄。
        </div>

        <div style={{ fontSize: 13, color: THEME.crateSoft, textAlign: "center", marginTop: 10 }}>
          資料自動存在雲端資料庫，不需要每天登入，換手機也找得回來。
        </div>
      </div>
    </div>
  );

  /* ============ 編輯紀錄 Modal ============ */
  const EditModal = () => {
    if (!editRecord) return null;
    return (
      <div
        className="fixed inset-0 flex items-center justify-center px-6"
        style={{ backgroundColor: "rgba(59,42,26,0.45)", zIndex: 50 }}
        onClick={() => setEditRecord(null)}
      >
        <div className="w-full rounded-2xl p-5" style={{ backgroundColor: THEME.white, maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 19, fontWeight: 800, color: THEME.ink, marginBottom: 4 }}>
            {editRecord.emoji} {editRecord.fruit}
          </div>
          <div style={{ fontSize: 14, color: THEME.crateSoft, marginBottom: 16 }}>{editRecord.date}｜{editRecord.time}｜{editRecord.type}</div>
          <div className="rounded-xl flex items-center justify-center mb-5" style={{ height: 80, backgroundColor: THEME.paperDeep }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: THEME.crateSoft, marginRight: 4 }}>$</span>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value.replace(/[^0-9]/g, ""))}
              className="text-center bg-transparent outline-none"
              style={{ fontSize: 32, fontWeight: 800, color: THEME.ink, width: "60%" }}
            />
          </div>
          <button onClick={saveEdit} className="w-full rounded-xl mb-3" style={{ height: 54, backgroundColor: THEME.crate, color: THEME.white, fontSize: 17, fontWeight: 800 }}>
            儲存修改
          </button>
          <div className="flex gap-3">
            <button onClick={() => setEditRecord(null)} className="flex-1 rounded-xl" style={{ height: 50, backgroundColor: THEME.paperDeep, color: THEME.ink, fontSize: 16, fontWeight: 700 }}>
              取消
            </button>
            <button onClick={() => askDelete(editRecord)} className="flex-1 rounded-xl" style={{ height: 50, backgroundColor: THEME.expenseBg, color: THEME.danger, fontSize: 16, fontWeight: 700 }}>
              刪除
            </button>
          </div>
        </div>
      </div>
    );
  };

  const views = {
    home: HomeView,
    buyFruit: BuyFruitView,
    buyAmount: BuyAmountView,
    sellTotal: SellTotalView,
    sellSplit: SellSplitView,
    sellSplitAmount: SellSplitAmountView,
    expenseCat: ExpenseCatView,
    expenseAmount: ExpenseAmountView,
    leftover: LeftoverView,
    leftoverAmount: LeftoverAmountView,
    history: HistoryView,
    monthReport: MonthReportView,
    fruitStats: FruitStatsView,
    settings: SettingsView,
  };
  const CurrentView = views[view] || HomeView;

  return (
    <div className="min-h-screen w-full flex justify-center" style={{ backgroundColor: THEME.paper }}>
      <div className="w-full relative" style={{ maxWidth: 440, minHeight: "100vh" }}>
        {view === "home" && (
          <div className="absolute" style={{ top: 20, right: 18, zIndex: 10 }}>
            <button
              onClick={() => setView("settings")}
              className="flex items-center justify-center rounded-full"
              style={{ width: 44, height: 44, backgroundColor: THEME.paperDeep, color: THEME.crate, fontSize: 20 }}
              aria-label="設定"
            >
              ⚙️
            </button>
          </div>
        )}
        {view === "history" && (
          <div className="px-5 pt-2">
            <button
              onClick={() => setView("monthReport")}
              className="w-full rounded-2xl mb-4 active:opacity-80"
              style={{ height: 54, backgroundColor: THEME.crate, color: THEME.white, fontSize: 16, fontWeight: 800 }}
            >
              📊 查看本月報表
            </button>
          </div>
        )}
        <CurrentView />
        <div style={{ height: 40 }} />
        <EditModal />
        <ConfirmModal
          open={!!confirmModal}
          title={confirmModal?.title}
          message={confirmModal?.message}
          confirmText={confirmModal?.confirmText}
          cancelText={confirmModal?.cancelText}
          danger={confirmModal?.danger}
          onConfirm={confirmModal?.onConfirm}
          onCancel={confirmModal?.onCancel}
        />
        <Toast message={toast} />
      </div>
    </div>
  );
}
