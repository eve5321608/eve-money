import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, Legend, ReferenceLine,
  ScatterChart, Scatter
} from 'recharts';
import {
  Plus, Trash2, Save, X, RefreshCw, AlertTriangle, Users, UserPlus,
  Cloud, CheckCircle2, Zap, Search, ChevronDown, ChevronUp, Mail, LogOut, Wallet, Wand2, Eye, Target, Bell, Download, Copy
} from 'lucide-react';

// --- Firebase Setup ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

let app, auth, db, appId;
try {
  let firebaseConfig;
  try {
    firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
      apiKey: "AIzaSyACwAj7n2SzBYLyLuu2AYR5aj2ba0XyTBQ",
      authDomain: "eve-fish.firebaseapp.com",
      projectId: "eve-fish",
      storageBucket: "eve-fish.firebasestorage.app",
      messagingSenderId: "44805669387",
      appId: "1:44805669387:web:873d6fcfe19f0c3a137d0e"
    };
  } catch (e) {
    firebaseConfig = {
      apiKey: "AIzaSyACwAj7n2SzBYLyLuu2AYR5aj2ba0XyTBQ",
      authDomain: "eve-fish.firebaseapp.com",
      projectId: "eve-fish",
      storageBucket: "eve-fish.firebasestorage.app",
      messagingSenderId: "44805669387",
      appId: "1:44805669387:web:873d6fcfe19f0c3a137d0e"
    };
  }
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // 🔐 永久記憶登入狀態
  setPersistence(auth, browserLocalPersistence).catch(console.error);
  
  db = getFirestore(app);
  const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  appId = rawAppId.replace(/\//g, '_');
} catch (error) {
  console.error("Firebase init error", error);
}

const PALETTE = ['#C9A227', '#4C7EA8', '#9B6FB0', '#D98E3B', '#5FB3B3', '#B0555F', '#7C9473', '#8D6CAB'];
const DEFAULT_SECTORS = ['半導體', '電腦及週邊設備', '電子零組件', '光電', '通信網路', '電子通路', '資訊服務', '反分割/其他', '金融保險', '航運', '生技醫療', '傳統產業', '民生消費', '能源', 'ETF', '美股', '其他'];
const DEFAULT_STRATEGIES = ['長期存股', '中短線交易', '波段操作', '當沖', '退休金', '美股投資'];
// 產業鏈階段：半導體採用細分階段，其他產業預設用上/中/下游概略分類
const SEMI_CHAIN_STAGES = ['IC設計', '晶圓代工', '封測', 'IP/設備材料', '記憶體'];
const GENERIC_CHAIN_STAGES = ['上游', '中游', '下游'];
// 各產業別的產業鏈細分階段；沒有特別定義的產業，就用通用的上/中/下游
const CHAIN_STAGE_BY_SECTOR = {
  '半導體': SEMI_CHAIN_STAGES,
  '電腦及週邊設備': ['系統組裝/ODM代工', '伺服器/機殼', '散熱模組', '電源供應器', '周邊零組件'],
  '電子零組件': ['被動元件', '連接器', 'PCB/載板', '電源管理IC', 'EMS/系統整合'],
  '光電': ['面板', 'LED', '光學鏡頭/元件'],
  '通信網路': ['網通設備', '網路晶片', '衛星通訊'],
  '航運': ['貨櫃航運', '散裝航運', '油輪航運'],
};
function chainStageOptionsForSector(sector) { return CHAIN_STAGE_BY_SECTOR[sector] || GENERIC_CHAIN_STAGES; }
const ALL_CHAIN_STAGE_OPTIONS = [...new Set(Object.values(CHAIN_STAGE_BY_SECTOR).flat())];
// 已知個股的產業鏈階段自動對照（新增交易時若尚未設定會自動帶入）
const DEFAULT_CHAIN_MAP = {
  '2330': '晶圓代工', '2303': '晶圓代工', '2454': 'IC設計', '3711': '封測', '2449': '封測',
  '2317': '系統組裝/ODM代工', '2382': '系統組裝/ODM代工', '3231': '系統組裝/ODM代工', '2356': '系統組裝/ODM代工',
};
const NEAR_PCT = 0.03;
// 幣別判斷：純英文字母代號視為美股(USD)，其餘（數字開頭，如台股代號）視為台幣(TWD)
const isUSDSymbol = (symbol) => /^[A-Za-z]+$/.test(symbol || '');

const DEFAULT_STOCK_MAP = {
  "2330": { name: "台積電", sector: "半導體" }, "2317": { name: "鴻海", sector: "電腦及週邊設備" },
  "2454": { name: "聯發科", sector: "半導體" }, "2308": { name: "台達電", sector: "電子零組件" },
  "2382": { name: "廣達", sector: "電腦及週邊設備" }, "2881": { name: "富邦金", sector: "金融保險" },
  "2882": { name: "國泰金", sector: "金融保險" }, "2891": { name: "中信金", sector: "金融保險" },
  "2886": { name: "兆豐金", sector: "金融保險" }, "2002": { name: "中鋼", sector: "傳統產業" },
  "2603": { name: "長榮", sector: "航運" }, "2609": { name: "陽明", sector: "航運" },
  "2615": { name: "萬海", sector: "航運" }, "3231": { name: "緯創", sector: "電腦及週邊設備" },
  "2356": { name: "英業達", sector: "電腦及週邊設備" }, "2449": { name: "京元電子", sector: "半導體" },
  "2327": { name: "國巨", sector: "電子零組件" }, "2303": { name: "聯電", sector: "半導體" },
  "3711": { name: "日月光投控", sector: "半導體" }, "1216": { name: "統一", sector: "民生消費" },
  "0050": { name: "元大台灣50", sector: "ETF" }, "0056": { name: "元大高股息", sector: "ETF" }, 
  "00878": { name: "國泰永續高股息", sector: "ETF" }, "00929": { name: "復華台灣科技優息", sector: "ETF" }, 
  "00919": { name: "群益台灣精選高息", sector: "ETF" },
  "AAPL": { name: "Apple", sector: "美股" }, "TSLA": { name: "Tesla", sector: "美股" },
  "NVDA": { name: "NVIDIA", sector: "美股" }, "MSFT": { name: "Microsoft", sector: "美股" },
  "GOOGL": { name: "Alphabet", sector: "美股" }
};
const DEFAULT_NAME_MAP = Object.fromEntries(Object.entries(DEFAULT_STOCK_MAP).map(([k, v]) => [v.name, { symbol: k, sector: v.sector }]));

const todayStr = () => new Date().toISOString().slice(0, 10);

// 🎯 全域安全轉換過濾器
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return val.name || val.symbol || val.label || val.value || JSON.stringify(val);
  return String(val);
};
const safeNameStr = safeString;
const Tooltip = RechartsTooltip;

const cleanNum = (n) => {
  if (n === null || n === undefined || n === '' || isNaN(Number(n))) return 0;
  return Number(Number(n).toFixed(4));
};

const fmtInt = (n) => new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
const fmtPrice = (n) => new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(Number(n) || 0);
const fmt2 = (n) => new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(Number(n) || 0);
const money = (n) => 'NT$ ' + fmtInt(n);
const pct = (n) => (n > 0 ? '+' : '') + fmt2(n) + '%';
const changeCls = (n) => (n > 0 ? 'tsp-up' : n < 0 ? 'tsp-down' : 'tsp-flat');

function copyToClipboard(text) {
  const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
}

function getColorHash(str) {
  const safeStr = safeString(str);
  if (!safeStr || safeStr === '未分類') return { bg: 'transparent', text: 'var(--muted)', border: 'var(--border)' };
  const colors = [
    { bg: '#fee2e2', text: '#ef4444', border: '#fca5a5' }, { bg: '#d1fae5', text: '#059669', border: '#6ee7b7' },
    { bg: '#e0e7ff', text: '#4f46e5', border: '#a5b4fc' }, { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' },
    { bg: '#fae8ff', text: '#c026d3', border: '#f0abfc' }, { bg: '#ccfbf1', text: '#0d9488', border: '#5eead4' },
    { bg: '#e2e8f0', text: '#475569', border: '#cbd5e1' }, { bg: '#ffedd5', text: '#ea580c', border: '#fdba74' },
  ];
  let hash = 0;
  for (let i = 0; i < safeStr.length; i++) hash = safeStr.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function BackToTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!visible) return null;
  return (
    <button className="tsp-back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} title="回到頂部">
      <ChevronUp size={22} />
    </button>
  );
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: 16 }}>
      <button className="tsp-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>← 上一頁</button>
      <span className="tsp-muted" style={{ fontSize: 13 }}>第 {page} / {totalPages} 頁</span>
      <button className="tsp-btn" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>下一頁 →</button>
    </div>
  );
}

function ModalPortal({ children }) {
  return createPortal(children, document.body);
}

function Tag({ text }) {
  if (!text) return null;
  const safeText = safeString(text);
  const { bg, text: c, border } = getColorHash(safeText);
  return (
    <span style={{ backgroundColor: bg, color: c, border: `1px solid ${border}`, padding: '2px 6px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', display: 'inline-block' }}>{safeText}</span>
  );
}

function MetaInput({ val, options, placeholder, onSave }) {
  const [isCustom, setIsCustom] = useState(false);
  const [v, setV] = useState(safeString(val) || '');
  useEffect(() => { if (!isCustom) setV(safeString(val) || ''); }, [val, isCustom]);

  if (isCustom) {
    return (
      <input className="tsp-input tsp-input-sm" autoFocus placeholder={`輸入${placeholder}...`} value={v} 
        onChange={e => setV(e.target.value)} onBlur={() => { onSave(v); setIsCustom(false); }} onKeyDown={e => { if(e.key === 'Enter') e.target.blur(); }}
      />
    );
  }

  return (
    <select className="tsp-input tsp-input-sm tsp-select" value={options.includes(v) ? v : (v ? 'custom_hidden' : '')} 
      onChange={e => {
        if (e.target.value === '___custom___') { setIsCustom(true); setV(''); } 
        else if (e.target.value !== 'custom_hidden') { setV(e.target.value); onSave(e.target.value); }
      }}>
      <option value="">選擇{placeholder}...</option>
      {options.map(o => <option key={safeString(o)} value={safeString(o)}>{safeString(o)}</option>)}
      {v && !options.includes(v) && <option value="custom_hidden">{v}</option>}
      <option value="___custom___">✏️ 自行輸入...</option>
    </select>
  );
}

function BlurInput({ val, placeholder, onSave }) {
  const [v, setV] = useState(val || '');
  const [isFocused, setIsFocused] = useState(false);
  useEffect(() => { if (!isFocused) setV(val || ''); }, [val, isFocused]);

  return (
    <input className="tsp-input tsp-input-sm tsp-mono" placeholder={placeholder} type="number" step="any" value={v}
      onFocus={() => setIsFocused(true)} onChange={e => setV(e.target.value)} onWheel={e => e.target.blur()}
      onBlur={() => { setIsFocused(false); const numVal = v ? cleanNum(Number(v)) : null; if (numVal !== val) onSave(numVal); }}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
    />
  );
}

// 🎯 將 computePortfolio 與 buildHoldings 等輔助函數宣告在最上層，確保編譯與使用無誤
function computePortfolio(transactions, stockDividends = []) {
  // 股票股利（無償配股）：增加股數但不影響總成本，會自動拉低平均成本
  const stockEvents = (stockDividends || [])
    .filter(d => Number(d.stockPerShare) > 0)
    .map(d => ({ date: d.date, id: d.id, symbol: d.symbol, name: d.name, kind: 'stockDividend', addedShares: cleanNum(Number(d.shares) * Number(d.stockPerShare)) }));
  const tradeEvents = transactions.map(t => ({ ...t, kind: 'trade' }));
  const sorted = [...tradeEvents, ...stockEvents].sort((a, b) => new Date(a.date) - new Date(b.date) || (a.id || 0) - (b.id || 0));
  const state = {};
  const realizedEvents = [];

  for (const t of sorted) {
    if (!state[t.symbol]) state[t.symbol] = { shares: 0, totalCost: 0, name: safeString(t.name) };
    const s = state[t.symbol];
    if (t.name) s.name = safeString(t.name);

    if (t.kind === 'stockDividend') {
      s.shares += t.addedShares;
      s.avgCost = s.shares > 0 ? s.totalCost / s.shares : 0;
      continue;
    }

    const fee = Number(t.fee) || 0;
    const tax = Number(t.tax) || 0;
    const shares = Number(t.shares) || 0;
    const price = Number(t.price) || 0;
    
    if (t.type === 'buy') {
      const cost = (shares * price) + fee + tax;
      s.totalCost += cost;
      s.shares += shares;
    } else {
      const qty = Math.min(shares, s.shares);
      const avgCost = s.shares > 0 ? s.totalCost / s.shares : 0;
      const proceeds = (qty * price) - fee - tax;
      const costBasis = qty * avgCost;
      const pl = proceeds - costBasis;
      
      realizedEvents.push({ date: t.date, symbol: t.symbol, name: s.name, qty, pl, month: t.date.slice(0, 7) });
      s.totalCost -= costBasis;
      s.shares -= qty;
      
      if (s.shares <= 0.0001) { s.shares = 0; s.totalCost = 0; }
    }
    s.avgCost = s.shares > 0 ? s.totalCost / s.shares : 0;
  }
  return { state, realizedEvents };
}

function buildHoldings(state, prices, meta, dividendBySymbol, exchangeRate = 1) {
  return Object.entries(state)
    .filter(([, h]) => h.shares > 0)
    .map(([symbol, h]) => {
      const current = prices[symbol]?.current ?? h.avgCost;
      const marketValue = cleanNum(current * h.shares);
      const cost = cleanNum(h.totalCost); 
      const upl = cleanNum(marketValue - cost);
      const uplPct = cost > 0 ? cleanNum((upl / cost) * 100) : 0;
      const m = meta[symbol] || {};
      const currency = isUSDSymbol(symbol) ? 'USD' : 'TWD';
      const fx = currency === 'USD' ? (Number(exchangeRate) || 1) : 1;
      const marketValueTWD = cleanNum(marketValue * fx);
      const costTWD = cleanNum(cost * fx);
      const uplTWD = cleanNum(marketValueTWD - costTWD);
      const stopLoss = m.stopLoss ?? null;
      const targetPrice = m.targetPrice ?? null;
      const isStopHit = stopLoss != null && current <= Number(stopLoss);
      const isStopNear = !isStopHit && stopLoss != null && current <= Number(stopLoss) * (1 + NEAR_PCT);
      const isTargetHit = targetPrice != null && current >= Number(targetPrice);
      const isTargetNear = !isTargetHit && targetPrice != null && current >= Number(targetPrice) * (1 - NEAR_PCT);
      const dividendTotal = (dividendBySymbol && dividendBySymbol[symbol]) || 0;
      const dividendYieldPct = costTWD > 0 ? (dividendTotal / costTWD) * 100 : 0;
      
      return {
        symbol, name: safeString(h.name), shares: h.shares, avgCost: h.avgCost, current, marketValue, cost, upl, uplPct,
        currency, exchangeRate: fx, marketValueTWD, costTWD, uplTWD,
        sector: safeString(m.sector) || '', strategy: safeString(m.strategy) || '', chainStage: safeString(m.chainStage) || '', stopLoss, targetPrice, note: m.note || '',
        currentPE: m.currentPE ?? null, peLow: m.peLow ?? null, peHigh: m.peHigh ?? null, epsGrowth: m.epsGrowth ?? null,
        isStopHit, isStopNear, isTargetHit, isTargetNear, isWarning: isStopHit,
        dividendTotal, dividendYieldPct
      };
    })
    .sort((a, b) => b.marketValue - a.marketValue);
}

function groupPnL(holdings, meta, mode) {
  if (mode === 'symbol') return holdings.map(h => ({ name: `${h.symbol} ${safeString(h.name)}`, value: h.uplTWD ?? h.upl }));
  const map = {};
  holdings.forEach(h => {
    let key;
    if (mode === 'sector') key = safeString(meta[h.symbol]?.sector) || '未分類';
    else if (mode === 'chain') key = safeString(meta[h.symbol]?.chainStage) || '未分類';
    else key = safeString(meta[h.symbol]?.strategy) || '未分類';
    map[key] = (map[key] || 0) + (h.uplTWD ?? h.upl);
  });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

function groupHoldings(holdings, meta, mode) {
  if (mode === 'symbol') return holdings.map(h => ({ name: `${h.symbol} ${safeString(h.name)}`, value: h.marketValueTWD ?? h.marketValue }));
  const map = {};
  holdings.forEach(h => {
    let key;
    if (mode === 'sector') key = safeString(meta[h.symbol]?.sector) || '未分類';
    else if (mode === 'chain') key = safeString(meta[h.symbol]?.chainStage) || '未分類';
    else key = safeString(meta[h.symbol]?.strategy) || '未分類';
    map[key] = (map[key] || 0) + (h.marketValueTWD ?? h.marketValue);
  });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

function dividendsBySymbol(dividends, exchangeRate = 1) {
  const map = {};
  for (const d of dividends) {
    const amt = isUSDSymbol(d.symbol) ? Number(d.totalCash || 0) * (Number(exchangeRate) || 1) : Number(d.totalCash || 0);
    map[d.symbol] = (map[d.symbol] || 0) + amt;
  }
  return map;
}

function fetchWithTimeout(url, options = {}, ms = 3500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (e) {
    throw e;
  }
}

async function safeFetchJSON(url) {
  try { const res = await fetchWithTimeout(url); if (res.ok) return await res.json(); } catch (e) {}
  try { const res = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`); if (res.ok) { const data = await res.json(); return JSON.parse(data.contents); } } catch (e) {}
  try { const res = await fetchWithTimeout(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`); if (res.ok) return await res.json(); } catch (e) {}
  return null;
}

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [isCloudReady, setIsCloudReady] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [transactions, setTransactions] = useState([]);
  const [cashTransactions, setCashTransactions] = useState([]);
  const [prices, setPrices] = useState({});
  const [meta, setMeta] = useState({});
  const [dividends, setDividends] = useState([]);
  const [owners, setOwners] = useState(['我']);
  const [watchlists, setWatchlists] = useState([]);

  const [selectedOwner, setSelectedOwner] = useState('all');
  const [showOwnerForm, setShowOwnerForm] = useState(false);
  const [showOwnerManage, setShowOwnerManage] = useState(false);
  const [ownerInput, setOwnerInput] = useState('');
  const [tab, setTab] = useState('dashboard');
  
  const [showForm, setShowForm] = useState(false);
  const [showCashForm, setShowCashForm] = useState(false);
  const [showDividendForm, setShowDividendForm] = useState(false);
  const [showWatchlistForm, setShowWatchlistForm] = useState(false);
  
  const [chartSymbol, setChartSymbol] = useState(null);
  const [priceDraft, setPriceDraft] = useState({});
  
  const [editingTxnId, setEditingTxnId] = useState(null);
  const [editingDivId, setEditingDivId] = useState(null);
  const [editingCashId, setEditingCashId] = useState(null);
  const [editingWatchId, setEditingWatchId] = useState(null);

  const [groupMode, setGroupMode] = useState('symbol');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [chainStageFilter, setChainStageFilter] = useState('all');
  const [exchangeRate, setExchangeRate] = useState(32.5); // 美元兌台幣匯率，供混合幣別加總換算用，可手動調整
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({ date: todayStr(), symbol: '', name: '', type: 'buy', shares: '', price: '', fee: '', tax: '', owner: '我', note: '' });
  const [divForm, setDivForm] = useState({ date: todayStr(), symbol: '', name: '', shares: '', cashPerShare: '', stockPerShare: '', owner: '我', note: '' });
  const [cashForm, setCashForm] = useState({ date: todayStr(), type: 'deposit', amount: '', owner: '我', note: '' });
  const [watchForm, setWatchForm] = useState({ symbol: '', name: '', targetPrice: '', note: '', currentPE: '', peLow: '', peHigh: '', epsGrowth: '' });

  const [toastMsg, setToastMsg] = useState('');
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  const [isLookingUpName, setIsLookingUpName] = useState(false);
  
  const [cloudModal, setCloudModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);

  const [officialMapCache, setOfficialMapCache] = useState({}); 
  const [touchStartPos, setTouchStartPos] = useState(null);

  const activeTabsList = useMemo(() => {
    const list = [
      { id: 'dashboard', label: '總覽' }, { id: 'holdings', label: '持股庫存' },
      { id: 'watchlist', label: '預想觀察' }, { id: 'txns', label: '交易紀錄' }, 
      { id: 'dividends', label: '股利' }, { id: 'cash', label: '現金明細' }, 
      { id: 'charts', label: '圖表' }, { id: 'monthly', label: '月度統整' },
    ];
    if (owners.length > 1) list.push({ id: 'compare', label: '持有者比較' });
    return list;
  }, [owners.length]);

  function showToast(msg) { setToastMsg(msg); setTimeout(() => setToastMsg(''), 4000); }

  useEffect(() => {
    const fetchOfficialData = async () => {
      try {
        const res = await safeFetchJSON('https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo');
        if (res && res.data) {
          const map = {};
          res.data.forEach(item => { map[item.stock_id] = { name: item.stock_name, sector: item.industry_category }; });
          setOfficialMapCache(map);
        }
      } catch (e) {}
    };
    fetchOfficialData();

    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch(e) {}
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, u => {
      setUser(u);
      setIsCloudReady(!!u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    setLoading(true);

    const docRef = roomCode
      ? doc(db, 'artifacts', appId, 'public', 'data', 'portfolios', roomCode)
      : doc(db, 'artifacts', appId, 'users', user.uid, 'portfolios', 'default');

    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const sanitizeData = (items) => {
          if (!Array.isArray(items)) return [];
          return items.map(item => {
            let sanitized = { ...item };
            if (sanitized.name) sanitized.name = safeString(sanitized.name);
            if (sanitized.owner) sanitized.owner = safeString(sanitized.owner);
            if (sanitized.sector) sanitized.sector = safeString(sanitized.sector);
            if (sanitized.strategy) sanitized.strategy = safeString(sanitized.strategy);
            return sanitized;
          });
        };

        setTransactions(sanitizeData(data.transactions));
        setCashTransactions(data.cashTransactions || []); 
        setPrices(data.prices || {});
        setMeta(data.meta || {});
        setDividends(sanitizeData(data.dividends));
        setOwners(Array.isArray(data.owners) ? data.owners.map(o => safeString(o)) : ['我']);
        setWatchlists(sanitizeData(data.watchlists));
      } else {
        setTransactions([]); setCashTransactions([]); setPrices({});
        setMeta({}); setDividends([]); setOwners(['我']); setWatchlists([]);
      }
      setLoading(false);
    }, (err) => {
      showToast('雲端同步發生錯誤');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, roomCode]);

  // 🎯 嚴格依序宣告計算依賴
  const filteredTxns = useMemo(() => {
    if (selectedOwner === 'all') return transactions;
    return transactions.filter(t => (t.owner || owners[0]) === selectedOwner);
  }, [transactions, selectedOwner, owners]);

  const filteredCashTxns = useMemo(() => {
    if (selectedOwner === 'all') return cashTransactions;
    return cashTransactions.filter(c => (c.owner || owners[0]) === selectedOwner);
  }, [cashTransactions, selectedOwner, owners]);

  const filteredDividends = useMemo(() => {
    if (selectedOwner === 'all') return dividends;
    return dividends.filter(d => (d.owner || owners[0]) === selectedOwner);
  }, [dividends, selectedOwner, owners]);

  const { state: holdingsState, realizedEvents } = useMemo(() => computePortfolio(filteredTxns, filteredDividends), [filteredTxns, filteredDividends]);
  const divBySymbol = useMemo(() => dividendsBySymbol(filteredDividends, exchangeRate), [filteredDividends, exchangeRate]);
  const holdingsAll = useMemo(() => buildHoldings(holdingsState, prices, meta, divBySymbol, exchangeRate), [holdingsState, prices, meta, divBySymbol, exchangeRate]);
  const toTWD = (amount, symbol) => isUSDSymbol(symbol) ? (Number(amount) || 0) * (Number(exchangeRate) || 1) : (Number(amount) || 0);

  const totalCashBalance = useMemo(() => {
    let bal = 0;
    filteredCashTxns.forEach(c => bal += c.type === 'deposit' ? Number(c.amount) : -Number(c.amount));
    filteredTxns.forEach(t => {
      const cost = toTWD((Number(t.shares) * Number(t.price)), t.symbol);
      const fee = toTWD(Number(t.fee) || 0, t.symbol);
      const tax = toTWD(Number(t.tax) || 0, t.symbol);
      if (t.type === 'buy') bal -= (cost + fee + tax);
      else bal += (cost - fee - tax);
    });
    filteredDividends.forEach(d => bal += toTWD(Number(d.totalCash || 0), d.symbol));
    return cleanNum(bal);
  }, [filteredCashTxns, filteredTxns, filteredDividends, exchangeRate]);

  const totals = useMemo(() => {
    const totalMarketValue = holdingsAll.reduce((s, h) => s + h.marketValueTWD, 0);
    const totalCost = holdingsAll.reduce((s, h) => s + h.costTWD, 0);
    const totalUPL = totalMarketValue - totalCost;
    const totalRealized = realizedEvents.reduce((s, e) => s + toTWD(e.pl, e.symbol), 0);
    const totalDividend = filteredDividends.reduce((s, d) => s + toTWD(Number(d.totalCash || 0), d.symbol), 0);
    return { totalMarketValue, totalCost, totalUPL, totalUPLPct: totalCost > 0 ? (totalUPL / totalCost) * 100 : 0, totalRealized, totalDividend, totalCashBalance };
  }, [holdingsAll, realizedEvents, filteredDividends, totalCashBalance, exchangeRate]);

  // 投資績效：簡化版年化報酬率（假設資金一次性投入，未精確處理每筆資金進出的時間點，僅供參考）
  const performance = useMemo(() => {
    const allDates = [...filteredTxns.map(t => t.date), ...filteredCashTxns.map(c => c.date)];
    const startDate = allDates.length ? allDates.reduce((min, d) => d < min ? d : min, allDates[0]) : null;
    const netInvested = filteredCashTxns.reduce((s, c) => s + (c.type === 'deposit' ? Number(c.amount) : -Number(c.amount)), 0);
    const currentTotalValue = totals.totalMarketValue + totals.totalCashBalance;
    const totalReturnPct = netInvested > 0 ? ((currentTotalValue - netInvested) / netInvested) * 100 : null;
    let yearsElapsed = null, annualizedReturnPct = null;
    if (startDate) yearsElapsed = (Date.now() - new Date(startDate).getTime()) / (365.25 * 24 * 3600 * 1000);
    if (netInvested > 0 && currentTotalValue > 0 && yearsElapsed && yearsElapsed >= (1 / 365.25)) {
      annualizedReturnPct = (Math.pow(currentTotalValue / netInvested, 1 / yearsElapsed) - 1) * 100;
    }
    return { startDate, netInvested, currentTotalValue, totalReturnPct, yearsElapsed, annualizedReturnPct };
  }, [filteredTxns, filteredCashTxns, totals.totalMarketValue, totals.totalCashBalance]);

  // 大盤/ETF對照（選填）：預設帶入 0050 的歷史價格區間，可自行修改成任何你想比較的指數或ETF價位
  const [benchmarkStart, setBenchmarkStart] = useState('');
  const [benchmarkEnd, setBenchmarkEnd] = useState('');
  useEffect(() => {
    if (prices['0050'] && prices['0050'].history && prices['0050'].history.length > 0) {
      const sortedHist = [...prices['0050'].history].sort((a, b) => new Date(a.date) - new Date(b.date));
      setBenchmarkStart(prev => prev || String(sortedHist[0].price));
    }
    if (prices['0050'] && prices['0050'].current) {
      setBenchmarkEnd(prev => prev || String(prices['0050'].current));
    }
  }, [prices]);
  const benchmarkReturnPct = (benchmarkStart && benchmarkEnd && Number(benchmarkStart) > 0)
    ? ((Number(benchmarkEnd) - Number(benchmarkStart)) / Number(benchmarkStart)) * 100
    : null;

  const holdings = useMemo(() => {
    return holdingsAll.filter(h => {
      if (strategyFilter !== 'all' && (h.strategy || '未分類') !== strategyFilter) return false;
      if (sectorFilter !== 'all' && (h.sector || '未分類') !== sectorFilter) return false;
      if (chainStageFilter !== 'all' && (h.chainStage || '未分類') !== chainStageFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const safeName = safeNameStr(h.name);
        if (!h.symbol.toLowerCase().includes(q) && !safeName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [holdingsAll, strategyFilter, sectorFilter, chainStageFilter, searchQuery]);

  const allSymbols = useMemo(() => {
    const set = new Set([...Object.keys(holdingsState), ...Object.keys(prices), ...watchlists.map(w => w.symbol)]);
    return [...set].sort();
  }, [holdingsState, prices, watchlists]);

  const sectorOptions = useMemo(() => [...new Set([...DEFAULT_SECTORS, ...holdingsAll.map(h => h.sector).filter(Boolean)])], [holdingsAll]);
  const strategyOptions = useMemo(() => [...new Set([...DEFAULT_STRATEGIES, ...holdingsAll.map(h => h.strategy).filter(Boolean)])], [holdingsAll]);
  const chainStageOptions = useMemo(() => [...new Set([...ALL_CHAIN_STAGE_OPTIONS, ...GENERIC_CHAIN_STAGES, ...holdingsAll.map(h => h.chainStage).filter(Boolean)])], [holdingsAll]);

  const alerts = useMemo(() => {
    const list = [];
    if (totals.totalCashBalance < 0) {
      list.push({ tone: 'warn', icon: AlertTriangle, text: `戶頭可用餘額為負（${money(totals.totalCashBalance)}），可能是資金增減記錄有缺漏，建議檢查一下` });
    }
    for (const h of holdingsAll) {
      const safeHName = safeNameStr(h.name);
      if (totals.totalMarketValue > 0 && (h.marketValueTWD / totals.totalMarketValue) > 0.3) {
        list.push({ tone: 'warn', icon: AlertTriangle, text: `曝險警告：${h.symbol} 佔總市值達 ${fmt2((h.marketValueTWD/totals.totalMarketValue)*100)}%，請留意風險` });
      }
      if (h.isStopHit) list.push({ tone: 'down', icon: AlertTriangle, text: `${h.symbol} ${safeHName} 已跌破防守價 ${fmtPrice(h.stopLoss)}` });
      else if (h.isStopNear) list.push({ tone: 'down', icon: Bell, text: `${h.symbol} ${safeHName} 接近防守價 ${fmtPrice(h.stopLoss)}` });
      if (h.isTargetHit) list.push({ tone: 'up', icon: CheckCircle2, text: `${h.symbol} ${safeHName} 已達目標價 ${fmtPrice(h.targetPrice)}` });
      else if (h.isTargetNear) list.push({ tone: 'up', icon: Bell, text: `${h.symbol} ${safeHName} 接近目標價 ${fmtPrice(h.targetPrice)}` });
    }

    const sectorTotals = {};
    holdingsAll.forEach(h => { const key = h.sector || '未分類'; sectorTotals[key] = (sectorTotals[key] || 0) + h.marketValueTWD; });
    Object.entries(sectorTotals).forEach(([sector, val]) => {
      if (sector !== '未分類' && totals.totalMarketValue > 0 && (val / totals.totalMarketValue) > 0.5) {
        list.push({ tone: 'warn', icon: AlertTriangle, text: `產業集中警告：「${sector}」合計佔總市值達 ${fmt2((val/totals.totalMarketValue)*100)}%，較為集中，請留意單一產業風險` });
      }
    });

    for (const w of watchlists) {
      const current = prices[w.symbol]?.current;
      const safeWName = safeNameStr(w.name);
      if (current && w.targetPrice && current <= Number(w.targetPrice)) {
        list.push({ tone: 'up', icon: Target, text: `觀察進場：${w.symbol} ${safeWName} 已跌至目標價 ${fmtPrice(w.targetPrice)} (現價 ${fmtPrice(current)})` });
      }
    }
    return list;
  }, [holdingsAll, totals.totalMarketValue, totals.totalCashBalance, watchlists, prices]);

  const monthly = useMemo(() => {
    const map = {};
    for (const t of filteredTxns) {
      const m = t.date.slice(0, 7);
      if (!map[m]) map[m] = { month: m, buyAmt: 0, sellAmt: 0, realizedPL: 0, dividend: 0, count: 0, events: [] };
      const cost = toTWD((Number(t.shares) || 0) * (Number(t.price) || 0), t.symbol);
      const fee = toTWD(Number(t.fee) || 0, t.symbol); const tax = toTWD(Number(t.tax) || 0, t.symbol);
      if (t.type === 'buy') map[m].buyAmt += cost + fee + tax; 
      else map[m].sellAmt += cost - fee - tax;
      map[m].count += 1;
      map[m].events.push({ ...t, isDiv: false, isCash: false });
    }
    for (const e of realizedEvents) {
      const m = e.month;
      if (!map[m]) map[m] = { month: m, buyAmt: 0, sellAmt: 0, realizedPL: 0, dividend: 0, count: 0, events: [] };
      map[m].realizedPL = cleanNum(map[m].realizedPL + toTWD(e.pl, e.symbol));
    }
    for (const d of filteredDividends) {
      const m = d.date.slice(0, 7);
      if (!map[m]) map[m] = { month: m, buyAmt: 0, sellAmt: 0, realizedPL: 0, dividend: 0, count: 0, events: [] };
      map[m].dividend = cleanNum(map[m].dividend + toTWD(Number(d.totalCash || 0), d.symbol));
      map[m].events.push({ ...d, isDiv: true, isCash: false });
    }
    for (const c of filteredCashTxns) {
      const m = c.date.slice(0, 7);
      if (!map[m]) map[m] = { month: m, buyAmt: 0, sellAmt: 0, realizedPL: 0, dividend: 0, count: 0, events: [] };
      map[m].events.push({ ...c, isCash: true });
    }
    Object.values(map).forEach(m => m.events.sort((a,b) => new Date(b.date) - new Date(a.date)));
    return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
  }, [filteredTxns, realizedEvents, filteredDividends, filteredCashTxns, exchangeRate]);

  const yearlyDividends = useMemo(() => {
    const map = {};
    for (const d of filteredDividends) {
      const y = d.date.slice(0, 4);
      map[y] = (map[y] || 0) + toTWD(Number(d.totalCash || 0), d.symbol);
    }
    return Object.entries(map).map(([year, total]) => ({ year, total })).sort((a, b) => b.year.localeCompare(a.year));
  }, [filteredDividends]);

  const ownerComparison = useMemo(() => {
    if (owners.length <= 1) return [];
    return owners.map(o => {
      const oTxns = transactions.filter(t => (t.owner || owners[0]) === o);
      const oDivs = dividends.filter(d => (d.owner || owners[0]) === o);
      const oCash = cashTransactions.filter(c => (c.owner || owners[0]) === o);
      const { state, realizedEvents: oRealized } = computePortfolio(oTxns, oDivs);
      const oDivBySymbol = dividendsBySymbol(oDivs);
      const oHoldings = buildHoldings(state, prices, meta, oDivBySymbol, exchangeRate);
      
      const marketValue = oHoldings.reduce((s, h) => s + h.marketValueTWD, 0);
      const cost = oHoldings.reduce((s, h) => s + h.costTWD, 0);
      const upl = marketValue - cost;
      const realized = oRealized.reduce((s, e) => s + toTWD(e.pl, e.symbol), 0);
      const dividendTotal = oDivs.reduce((s, d) => s + toTWD(Number(d.totalCash || 0), d.symbol), 0);
      
      let bal = 0;
      oCash.forEach(c => bal += c.type === 'deposit' ? Number(c.amount) : -Number(c.amount));
      oTxns.forEach(t => {
        const cost = toTWD((Number(t.shares) * Number(t.price)), t.symbol);
        if (t.type === 'buy') bal -= (cost + toTWD(Number(t.fee)||0, t.symbol) + toTWD(Number(t.tax)||0, t.symbol));
        else bal += (cost - toTWD(Number(t.fee)||0, t.symbol) - toTWD(Number(t.tax)||0, t.symbol));
      });
      oDivs.forEach(d => bal += toTWD(Number(d.totalCash || 0), d.symbol));

      return { owner: o, marketValue, cost, upl, realized, dividendTotal, holdingCount: oHoldings.length, cash: cleanNum(bal) };
    });
  }, [owners, transactions, dividends, prices, meta, cashTransactions, exchangeRate]);

  const handleTouchStart = (e) => {
    if (e.target.closest('.tsp-table-wrap') || e.target.closest('.recharts-wrapper') || e.target.closest('.tsp-modal') || e.target.closest('input') || e.target.closest('select')) {
      setTouchStartPos(null); return;
    }
    setTouchStartPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchEnd = (e) => {
    if (!touchStartPos) return;
    const touchEndPos = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const dx = touchStartPos.x - touchEndPos.x;
    const dy = touchStartPos.y - touchEndPos.y;

    if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 30) {
      const currentIndex = activeTabsList.findIndex(t => t.id === tab);
      if (dx > 0 && currentIndex < activeTabsList.length - 1) setTab(activeTabsList[currentIndex + 1].id);
      else if (dx < 0 && currentIndex > 0) setTab(activeTabsList[currentIndex - 1].id);
    }
    setTouchStartPos(null);
  };

  async function syncToCloud(payload) {
    if (!user || !db) return;
    const docRef = roomCode
      ? doc(db, 'artifacts', appId, 'public', 'data', 'portfolios', roomCode)
      : doc(db, 'artifacts', appId, 'users', user.uid, 'portfolios', 'default');
    try { await setDoc(docRef, payload, { merge: true }); } catch (e) {}
  }

  function persistTxns(next) { setTransactions(next); syncToCloud({ transactions: next }); }
  function persistCash(next) { setCashTransactions(next); syncToCloud({ cashTransactions: next }); }
  function persistPrices(next) { setPrices(next); syncToCloud({ prices: next }); }
  function persistMeta(next) { setMeta(next); syncToCloud({ meta: next }); }
  function persistOwners(next) { setOwners(next); syncToCloud({ owners: next }); }
  function persistDividends(next) { setDividends(next); syncToCloud({ dividends: next }); }
  function persistWatchlists(next) { setWatchlists(next); syncToCloud({ watchlists: next }); }

  function downloadFile(filename, content, mime) {
    try {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { showToast('❌ 匯出失敗，請稍後再試'); }
  }

  function handleExportBackup() {
    const payload = { exportedAt: new Date().toISOString(), transactions, cashTransactions, prices, meta, dividends, owners, watchlists, exchangeRate };
    downloadFile(`持股備份_${todayStr()}.json`, JSON.stringify(payload, null, 2), 'application/json');
    showToast('✅ 已匯出完整備份 (JSON)');
  }

  function csvEscape(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

  function handleExportTxnsCSV() {
    const header = ['日期','類型','股票代號','股票名稱','股數','成交價','手續費','交易稅','持有者','備註'];
    const rows = [...transactions].sort((a,b) => new Date(a.date) - new Date(b.date)).map(t => [
      t.date, t.type === 'buy' ? '買進' : '賣出', t.symbol, safeNameStr(t.name), t.shares, t.price, t.fee || 0, t.tax || 0, safeNameStr(t.owner) || owners[0] || '我', t.note || ''
    ]);
    const csv = '\uFEFF' + [header, ...rows].map(r => r.map(csvEscape).join(',')).join('\n');
    downloadFile(`交易紀錄_${todayStr()}.csv`, csv, 'text/csv;charset=utf-8');
    showToast('✅ 已匯出交易紀錄 (CSV)');
  }


  async function handleEmailAuth(e) {
    e.preventDefault();
    if (!auth || !emailInput || !passwordInput) return;
    setLoading(true);
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, emailInput, passwordInput);
        showToast(`✅ 成功登入：${emailInput}`);
        setRoomCode(''); 
      } else {
        const cred = await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
        const newDocRef = doc(db, 'artifacts', appId, 'users', cred.user.uid, 'portfolios', 'default');
        await setDoc(newDocRef, { transactions, cashTransactions, prices, meta, dividends, owners, watchlists }, { merge: true });
        showToast(`✅ 註冊成功！資料已綁定至：${emailInput}`);
        setRoomCode('');
      }
      setCloudModal(false);
    } catch (err) { showToast('❌ 認證失敗，請檢查信箱或密碼'); }
    setLoading(false);
  }

  async function handleLogout() {
    if (!auth) return;
    try { await signOut(auth); setRoomCode(''); showToast('已登出'); setCloudModal(false); } catch(e) {}
  }

  async function createSharedRoom() {
    if (!user || !db) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const publicRef = doc(db, 'artifacts', appId, 'public', 'data', 'portfolios', code);
    try { await setDoc(publicRef, { transactions, cashTransactions, prices, meta, dividends, owners }); setRoomCode(code); showToast(`已建立共用：${code}`); setCloudModal(false); } catch(e) {}
  }

  async function joinSharedRoom(e) {
    e.preventDefault();
    if (!user || !db || !joinCodeInput.trim()) return;
    const code = joinCodeInput.trim().toUpperCase();
    const publicRef = doc(db, 'artifacts', appId, 'public', 'data', 'portfolios', code);
    try {
      const snap = await getDoc(publicRef);
      if (snap.exists()) { setRoomCode(code); showToast(`加入群組：${code}`); setCloudModal(false); setJoinCodeInput(''); } 
      else { showToast('找不到代碼！'); }
    } catch(err) {}
  }

  const userStockMap = useMemo(() => {
    const symToName = {}; const nameToSym = {};
    Object.entries(DEFAULT_STOCK_MAP).forEach(([k, v]) => { symToName[k] = v.name; });
    Object.entries(DEFAULT_NAME_MAP).forEach(([k, v]) => { nameToSym[k] = v.symbol; });
    transactions.forEach(t => { if (t.symbol && t.name) { const n = safeString(t.name); symToName[t.symbol] = n; nameToSym[n] = t.symbol; } });
    watchlists.forEach(w => { if (w.symbol && w.name) { const n = safeString(w.name); symToName[w.symbol] = n; nameToSym[n] = w.symbol; } });
    return { symToName, nameToSym };
  }, [transactions, watchlists]);

  function handleSymbolChange(val, formType = 'txn') {
    const symbol = val.toUpperCase().trim();
    const setter = formType === 'watch' ? setWatchForm : (formType === 'div' ? setDivForm : setForm);
    setter(f => {
      let nextName = f.name;
      if (symbol === '') nextName = ''; 
      else if (userStockMap.symToName[symbol]) nextName = userStockMap.symToName[symbol];
      else if (officialMapCache[symbol]) nextName = officialMapCache[symbol].name;
      return { ...f, symbol: val.toUpperCase(), name: nextName };
    });
  }

  function handleNameChange(val, formType = 'txn') {
    const name = val; const clean = name.trim();
    const setter = formType === 'watch' ? setWatchForm : (formType === 'div' ? setDivForm : setForm);
    setter(f => {
      let nextSymbol = f.symbol;
      if (clean === '') nextSymbol = ''; 
      else if (userStockMap.nameToSym[clean]) nextSymbol = userStockMap.nameToSym[clean];
      else if (clean.length >= 2) {
        let offMatch = Object.entries(officialMapCache).find(([k, v]) => v && v.name === clean);
        if (!offMatch) offMatch = Object.entries(officialMapCache).find(([k, v]) => v && v.name.includes(clean));
        if (offMatch) nextSymbol = offMatch[0];
      }
      return { ...f, name, symbol: nextSymbol };
    });
  }

  async function handleSymbolBlur(inputValue, formType = 'txn') {
    const cleanSym = inputValue ? inputValue.trim().toUpperCase() : '';
    if (cleanSym.length < 2) return;
    const isDiv = formType === 'div'; const isWatch = formType === 'watch';
    const currentName = isWatch ? watchForm.name : (isDiv ? divForm.name : form.name);
    
    if (!currentName) {
      setIsLookingUpName(true);
      try {
        let fetchedName = '';
        if (DEFAULT_STOCK_MAP[cleanSym]) fetchedName = DEFAULT_STOCK_MAP[cleanSym].name;
        if (!fetchedName && officialMapCache[cleanSym]) fetchedName = officialMapCache[cleanSym].name;

        if (!fetchedName) {
          const data = await safeFetchJSON(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${cleanSym}`);
          if (data?.quoteResponse?.result?.length > 0) fetchedName = data.quoteResponse.result[0].shortName || data.quoteResponse.result[0].longName;
        }
        if (fetchedName) {
          const setter = isWatch ? setWatchForm : (isDiv ? setDivForm : setForm);
          setter(f => { if (!f.name) return { ...f, name: fetchedName }; return f; });
        }
      } finally { setIsLookingUpName(false); }
    }
  }

  async function handleNameBlur(inputValue, formType = 'txn') {
    const cleanName = inputValue ? inputValue.trim() : '';
    if (cleanName.length < 2) return;
    const isDiv = formType === 'div'; const isWatch = formType === 'watch';
    const currentSymbol = isWatch ? watchForm.symbol : (isDiv ? divForm.symbol : form.symbol);
    
    if (!currentSymbol) {
      setIsLookingUpName(true);
      try {
        let fetchedSymbol = '';
        const defaultMatch = Object.entries(DEFAULT_STOCK_MAP).find(([sym, d]) => d.name.includes(cleanName) || cleanName.includes(d.name));
        if (defaultMatch) fetchedSymbol = defaultMatch[0];

        if (!fetchedSymbol && officialMapCache) {
          const cacheMatch = Object.entries(officialMapCache).find(([sym, d]) => d && d.name && (d.name.includes(cleanName) || cleanName.includes(d.name)));
          if (cacheMatch) fetchedSymbol = cacheMatch[0];
        }

        if (!fetchedSymbol) {
          const data = await safeFetchJSON(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(cleanName)}&quotesCount=1`);
          if (data && data.quotes && data.quotes.length > 0) {
            let rawSymbol = data.quotes[0].symbol;
            fetchedSymbol = (rawSymbol.includes('.TW') || rawSymbol.includes('.TWO')) ? rawSymbol.split('.')[0] : rawSymbol;
          }
        }
        if (fetchedSymbol) {
          const setter = isWatch ? setWatchForm : (isDiv ? setDivForm : setForm);
          setter(f => { if (!f.symbol) return { ...f, symbol: fetchedSymbol }; return f; });
        }
      } catch (e) {} finally { setIsLookingUpName(false); }
    }
  }

  async function autoFetchPrices() {
    if (!allSymbols.length) { showToast('請先新增交易紀錄或觀察名單。'); return; }
    setIsFetchingPrices(true);
    showToast('🚀 啟動多市場極速報價更新...');
    
    const nextPrices = { ...prices };
    const today = todayStr();
    let realtimeCount = 0;

    const fetchPromises = allSymbols.map(async (sym) => {
      let finalPrice = null;
      try {
        const isUS = /^[A-Za-z]+$/.test(sym);
        let qUrl = isUS ? `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1d` : `https://query1.finance.yahoo.com/v8/finance/chart/${sym}.TW?range=1d`;
        let data = await safeFetchJSON(qUrl);
        if (!data?.chart?.result && !isUS) data = await safeFetchJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}.TWO?range=1d`);
        finalPrice = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      } catch (e) {}

      if (!finalPrice && !/^[A-Za-z]+$/.test(sym)) {
        try {
          const d = new Date(); d.setDate(d.getDate() - 7);
          const res = await safeFetchJSON(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${sym}&start_date=${d.toISOString().slice(0,10)}`);
          if (res && res.data && res.data.length > 0) finalPrice = res.data[res.data.length - 1].close;
        } catch(e) {}
      }

      if (finalPrice) {
        realtimeCount++;
        const entry = nextPrices[sym] || { current: finalPrice, history: [] };
        entry.current = finalPrice;
        if (entry.history.length > 0 && entry.history[entry.history.length - 1].date === today) {
          entry.history[entry.history.length - 1].price = finalPrice;
        } else {
          entry.history.push({ date: todayStr(), price: finalPrice });
        }
        nextPrices[sym] = entry;
      }
    });

    await Promise.allSettled(fetchPromises);
    
    if (realtimeCount > 0) { 
      persistPrices(nextPrices); 
      showToast(`✅ 報價更新成功！完美同步 ${realtimeCount} 檔標的。`); 
    } else { 
      showToast('❌ 更新失敗，請檢查網路連線。'); 
    }
    setIsFetchingPrices(false);
  }

  const resetForm = () => { setEditingTxnId(null); setForm({ date: todayStr(), symbol: '', name: '', type: 'buy', shares: '', price: '', fee: '', tax: '', owner: (selectedOwner !== 'all' ? selectedOwner : owners[0]) || '我', note: '' }); }
  const resetDivForm = () => { setEditingDivId(null); setDivForm({ date: todayStr(), symbol: '', name: '', shares: '', cashPerShare: '', stockPerShare: '', owner: (selectedOwner !== 'all' ? selectedOwner : owners[0]) || '我', note: '' }); }
  const resetCashForm = () => { setEditingCashId(null); setCashForm({ date: todayStr(), type: 'deposit', amount: '', owner: (selectedOwner !== 'all' ? selectedOwner : owners[0]) || '我', note: '' }); }
  const resetWatchForm = () => { setEditingWatchId(null); setWatchForm({ symbol: '', name: '', targetPrice: '', note: '', currentPE: '', peLow: '', peHigh: '', epsGrowth: '' }); }

  function autoCalculateTax() {
    const shares = Number(form.shares) || 0;
    const price = Number(form.price) || 0;
    const total = shares * price;
    const fee = Math.floor(total * 0.001425);
    const tax = form.type === 'sell' ? Math.floor(total * 0.003) : 0;
    setForm(f => ({ ...f, fee: String(fee), tax: String(tax) }));
    showToast('已自動帶入公定手續費與交易稅，可手動微調。');
  }

  function handleEditTxn(t) { setForm({ date: t.date, symbol: t.symbol, name: safeNameStr(t.name), type: t.type, shares: t.shares, price: t.price, fee: t.fee || 0, tax: t.tax || 0, owner: safeNameStr(t.owner) || owners[0] || '我', note: t.note || '' }); setEditingTxnId(t.id); setShowForm(true); }
  function handleCopyTxn(t) { setForm({ date: todayStr(), symbol: t.symbol, name: safeNameStr(t.name), type: t.type, shares: t.shares, price: t.price, fee: t.fee || 0, tax: t.tax || 0, owner: safeNameStr(t.owner) || owners[0] || '我', note: t.note || '' }); setEditingTxnId(null); setShowForm(true); }
  function handleEditDividend(d) { setDivForm({ date: d.date, symbol: d.symbol, name: safeNameStr(d.name), shares: d.shares, cashPerShare: d.cashPerShare, stockPerShare: d.stockPerShare || 0, owner: safeNameStr(d.owner) || owners[0] || '我', note: d.note || '' }); setEditingDivId(d.id); setShowDividendForm(true); }
  function handleEditCash(c) { setCashForm({ date: c.date, type: c.type, amount: c.amount, owner: safeNameStr(c.owner) || owners[0] || '我', note: c.note || '' }); setEditingCashId(c.id); setShowCashForm(true); }
  function handleEditWatchlist(w) { setWatchForm({ symbol: w.symbol, name: safeNameStr(w.name), targetPrice: w.targetPrice, note: w.note || '', currentPE: w.currentPE ?? '', peLow: w.peLow ?? '', peHigh: w.peHigh ?? '', epsGrowth: w.epsGrowth ?? '' }); setEditingWatchId(w.id); setShowWatchlistForm(true); }

  function submitTxn(e) {
    e.preventDefault();
    if (!form.symbol.trim() || !form.shares || (!form.price && form.price !== '0')) return;
    const symbol = form.symbol.trim().toUpperCase();
    const ownerForTxn = form.owner || owners[0] || '我';

    if (form.type === 'sell') {
      // 賣出前檢查：以「本次送出前」該持有者在此股票的庫存為準，超賣時提醒（不阻擋送出，系統仍會以實際庫存為上限自動調整）
      const otherOwnerTxns = transactions.filter(tx => tx.id !== editingTxnId && (tx.owner || owners[0]) === ownerForTxn);
      const otherOwnerDivs = dividends.filter(d => (d.owner || owners[0]) === ownerForTxn);
      const { state: ownerState } = computePortfolio(otherOwnerTxns, otherOwnerDivs);
      const availableShares = ownerState[symbol]?.shares || 0;
      const sellShares = cleanNum(Number(form.shares));
      if (sellShares > availableShares) {
        showToast(`⚠️ 提醒：${ownerForTxn} 目前 ${symbol} 僅持有 ${fmtInt(availableShares)} 股，超過部分系統會自動以實際庫存為準，請確認股數是否正確。`);
      }
    }

    const t = {
      id: editingTxnId || (Date.now() + Math.random()), date: form.date, symbol: symbol,
      name: form.name.trim() || symbol, type: form.type,
      shares: cleanNum(Number(form.shares)), price: cleanNum(Number(form.price)), 
      fee: cleanNum(Number(form.fee) || 0), tax: cleanNum(Number(form.tax) || 0),
      owner: ownerForTxn, note: (form.note || '').trim()
    };
    let next = editingTxnId ? transactions.map(item => item.id === editingTxnId ? t : item) : [...transactions, t];
    persistTxns(next);
    if (!prices[symbol]) persistPrices({ ...prices, [symbol]: { current: t.price, history: [{ date: t.date, price: t.price }] } });
    
    if (!meta[symbol] || !meta[symbol].sector || meta[symbol].sector === '未分類') {
      const discoveredSector = DEFAULT_STOCK_MAP[symbol]?.sector || officialMapCache[symbol]?.sector;
      if (discoveredSector) updateMeta(symbol, { sector: discoveredSector });
    }
    if (!meta[symbol] || !meta[symbol].chainStage) {
      const discoveredChainStage = DEFAULT_CHAIN_MAP[symbol];
      if (discoveredChainStage) updateMeta(symbol, { chainStage: discoveredChainStage });
    }

    resetForm(); setShowForm(false);
  }

  function submitDividend(e) {
    e.preventDefault();
    if (!divForm.symbol.trim() || !divForm.shares) return;
    const shares = cleanNum(Number(divForm.shares));
    const cashPerShare = cleanNum(Number(divForm.cashPerShare) || 0);
    const stockPerShare = cleanNum(Number(divForm.stockPerShare) || 0);
    const d = {
      id: editingDivId || (Date.now() + Math.random()), date: divForm.date, symbol: divForm.symbol.trim().toUpperCase(),
      name: divForm.name.trim() || divForm.symbol.trim().toUpperCase(), shares, cashPerShare, stockPerShare,
      totalCash: cleanNum(shares * cashPerShare), totalStockShares: cleanNum(shares * stockPerShare),
      owner: divForm.owner || owners[0] || '我', note: divForm.note.trim(),
    };
    let next = editingDivId ? dividends.map(item => item.id === editingDivId ? d : item) : [...dividends, d];
    persistDividends(next); resetDivForm(); setShowDividendForm(false);
  }

  function submitCash(e) {
    e.preventDefault();
    if (!cashForm.amount) return;
    const c = {
      id: editingCashId || (Date.now() + Math.random()), date: cashForm.date, type: cashForm.type,
      amount: cleanNum(Number(cashForm.amount)), owner: cashForm.owner || owners[0] || '我', note: cashForm.note.trim(),
    };
    let next = editingCashId ? cashTransactions.map(item => item.id === editingCashId ? c : item) : [...cashTransactions, c];
    persistCash(next); resetCashForm(); setShowCashForm(false);
  }

  function submitWatchlist(e) {
    e.preventDefault();
    if (!watchForm.symbol.trim()) return;
    const w = {
      id: editingWatchId || (Date.now() + Math.random()),
      symbol: watchForm.symbol.trim().toUpperCase(),
      name: watchForm.name.trim() || watchForm.symbol.trim().toUpperCase(),
      targetPrice: watchForm.targetPrice,
      note: watchForm.note.trim(),
      currentPE: watchForm.currentPE === '' ? null : cleanNum(Number(watchForm.currentPE)),
      peLow: watchForm.peLow === '' ? null : cleanNum(Number(watchForm.peLow)),
      peHigh: watchForm.peHigh === '' ? null : cleanNum(Number(watchForm.peHigh)),
      epsGrowth: watchForm.epsGrowth === '' ? null : cleanNum(Number(watchForm.epsGrowth)),
    };
    let next = editingWatchId ? watchlists.map(item => item.id === editingWatchId ? w : item) : [...watchlists, w];
    persistWatchlists(next); resetWatchForm(); setShowWatchlistForm(false);
  }

  function deleteTxn(id) { persistTxns(transactions.filter(t => t.id !== id)); }
  function deleteDividend(id) { persistDividends(dividends.filter(d => d.id !== id)); }
  function deleteCash(id) { persistCash(cashTransactions.filter(c => c.id !== id)); }
  function deleteWatchlist(id) { persistWatchlists(watchlists.filter(w => w.id !== id)); }

  function updatePrice(symbol) {
    const val = cleanNum(Number(priceDraft[symbol]));
    if (!val || val <= 0) return;
    const entry = prices[symbol] || { current: val, history: [] };
    const hist = [...(entry.history || [])];
    const today = todayStr();
    if (hist.length && hist[hist.length - 1].date === today) hist[hist.length - 1] = { date: today, price: val };
    else hist.push({ date: today, price: val });
    persistPrices({ ...prices, [symbol]: { current: val, history: hist } });
    setPriceDraft(d => ({ ...d, [symbol]: '' }));
  }

  function updateMeta(symbol, patch) { 
    persistMeta({ ...meta, [symbol]: { ...(meta[symbol] || {}), ...patch } }); 
  }

  function addOwner() {
    const name = ownerInput.trim();
    if (!name || owners.includes(name)) { setOwnerInput(''); setShowOwnerForm(false); return; }
    const next = [...owners, name];
    persistOwners(next); setSelectedOwner(name); setForm(f => ({ ...f, owner: name })); setDivForm(f => ({ ...f, owner: name })); setCashForm(f => ({ ...f, owner: name }));
    setOwnerInput(''); setShowOwnerForm(false);
  }

  function renameOwner(oldName, newName) {
    const trimmed = (newName || '').trim();
    if (!trimmed || trimmed === oldName) return;
    if (owners.includes(trimmed)) { showToast('⚠️ 已經有相同名稱的持有者了'); return; }
    persistOwners(owners.map(o => o === oldName ? trimmed : o));
    persistTxns(transactions.map(t => (t.owner || owners[0]) === oldName ? { ...t, owner: trimmed } : t));
    persistCash(cashTransactions.map(c => (c.owner || owners[0]) === oldName ? { ...c, owner: trimmed } : c));
    persistDividends(dividends.map(d => (d.owner || owners[0]) === oldName ? { ...d, owner: trimmed } : d));
    if (selectedOwner === oldName) setSelectedOwner(trimmed);
    showToast(`✅ 已將「${oldName}」改名為「${trimmed}」`);
  }

  function deleteOwnerHandler(name) {
    if (owners.length <= 1) { showToast('⚠️ 至少要保留一位持有者'); return; }
    const hasData = transactions.some(t => (t.owner || owners[0]) === name) || dividends.some(d => (d.owner || owners[0]) === name) || cashTransactions.some(c => (c.owner || owners[0]) === name);
    const msg = hasData
      ? `「${name}」名下還有交易/股利/現金紀錄，刪除後這個名字會從清單消失，但舊資料不會被刪除（用「全部持有者」還是看得到），確定要刪除嗎？`
      : `確定要刪除持有者「${name}」嗎？`;
    if (!window.confirm(msg)) return;
    persistOwners(owners.filter(o => o !== name));
    if (selectedOwner === name) setSelectedOwner('all');
    showToast(`已刪除持有者「${name}」`);
  }

  async function handleAtrCalculation(symbol, currentPrice) {
    if (!currentPrice) { showToast('請先確保已有現價，才能計算 ATR。'); return; }
    showToast(`${symbol} 歷史資料抓取與 ATR 計算中...`);
    let highs = [], lows = [], closes = [];
    try {
      const d = new Date(); d.setDate(d.getDate() - 40);
      const res = await safeFetchJSON(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${symbol}&start_date=${d.toISOString().slice(0,10)}`);
      if (res && res.data && res.data.length > 0) {
        highs = res.data.map(i => i.max); lows = res.data.map(i => i.min); closes = res.data.map(i => i.close);
      }
    } catch(e) {}

    if (closes.length === 0) {
      try {
        const data = await safeFetchJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.TW?range=1mo&interval=1d`);
        if (data?.chart?.result?.[0]?.indicators?.quote?.[0]) {
           const quote = data.chart.result[0].indicators.quote[0];
           highs = quote.high; lows = quote.low; closes = quote.close;
        }
      } catch (e) {}
    }

    if (!highs || closes.length < 15) { showToast(`${symbol} 歷史資料不足，無法計算 ATR。`); return; }

    let trs = [];
    for(let i = 1; i < closes.length; i++) {
      if(highs[i] == null || lows[i] == null || closes[i-1] == null) continue;
      trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])));
    }
    const last14 = trs.slice(-14);
    if(last14.length === 0) return;
    const atr = last14.reduce((a, b) => a + b, 0) / last14.length;
    const stopLossFormatted = cleanNum(Number((Math.max(0, currentPrice - (2.0 * atr))).toFixed(2)));
    updateMeta(symbol, { stopLoss: stopLossFormatted });
    showToast(`✅ ${symbol} ATR(14) 約為 ${atr.toFixed(2)}，防守價已自動設為 ${stopLossFormatted}`);
  }

  if (!isCloudReady || loading) {
    return (
      <div className="tsp-app tsp-loading">
        <style>{CSS}</style>
        <RefreshCw className="tsp-spin" size={24} />
        <span style={{ marginTop: 8 }}>{isCloudReady ? '同步資料中…' : '連線雲端服務中…'}</span>
      </div>
    );
  }

  return (
    <div className="tsp-app" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <style>{CSS}</style>

      <header className="tsp-header">
        <div className="tsp-brand">
          <span className="tsp-brand-mark">股</span>
          <div><h1>台股持股簿</h1><p>終極穩定版 - 核心記帳與瞬間連動</p></div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, marginLeft: 'auto' }} title="美元兌台幣匯率，用於加總美股與台股資產時換算">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="tsp-muted" style={{ fontSize: 12, fontWeight: 'bold', whiteSpace: 'nowrap' }}>USD/TWD</span>
              <input type="number" min="0" step="0.01" className="tsp-input tsp-input-sm tsp-mono" style={{ width: 64 }} value={exchangeRate} onChange={e => setExchangeRate(e.target.value === '' ? '' : Number(e.target.value))} onBlur={() => setExchangeRate(v => Number(v) > 0 ? Number(v) : 32.5)} onWheel={e => e.target.blur()} />
            </div>
            <span className="tsp-hint" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>匯率需自行輸入，不會自動更新</span>
          </div>
        </div>
        <div className="tsp-header-actions">
          <div className="tsp-owner-select">
            <Users size={14} className="tsp-muted" />
            <select className="tsp-input tsp-select" value={selectedOwner} onChange={e => setSelectedOwner(e.target.value)}>
              <option value="all">全部持有者</option>
              {owners.map(o => <option key={safeNameStr(o)} value={safeNameStr(o)}>{safeNameStr(o)}</option>)}
            </select>
            <button className="tsp-icon-btn" title="新增持有者" onClick={() => { setShowOwnerForm(v => !v); setShowOwnerManage(false); }}><UserPlus size={14} /></button>
            <button className="tsp-icon-btn" title="管理持有者（改名/刪除）" onClick={() => { setShowOwnerManage(v => !v); setShowOwnerForm(false); }}><Users size={14} /></button>
            {showOwnerForm && (
              <div className="tsp-owner-form">
                <input className="tsp-input tsp-input-sm" placeholder="輸入姓名" value={ownerInput}
                  onChange={e => setOwnerInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addOwner()} autoFocus />
                <button className="tsp-icon-btn" onClick={addOwner}><Save size={14} /></button>
              </div>
            )}
            {showOwnerManage && (
              <div className="tsp-owner-form" style={{ flexDirection: 'column', minWidth: 220, alignItems: 'stretch' }}>
                <p className="tsp-hint" style={{ margin: '0 0 4px' }}>管理持有者（改名請直接修改後按 Enter 或點掉）</p>
                {owners.map(o => (
                  <div key={o} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input className="tsp-input tsp-input-sm" defaultValue={o}
                      onBlur={e => { const v = e.target.value.trim(); if (v && v !== o) renameOwner(o, v); }}
                      onKeyDown={e => e.key === 'Enter' && e.target.blur()} />
                    <button className="tsp-icon-btn tsp-danger" title="刪除此持有者" onClick={() => deleteOwnerHandler(o)}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className={`tsp-btn ${user && user.email ? 'tsp-up-bg' : (roomCode ? 'tsp-warn-bg' : '')}`} onClick={() => setCloudModal(true)} title="雲端帳號與共用">
            <Cloud size={16} className={user && user.email ? 'tsp-up' : (roomCode ? 'tsp-warn' : '')} />
            {user && user.email ? 'Email已綁定' : (roomCode ? `共用中 (${roomCode})` : '未綁定雲端')}
          </button>
          
          <button className="tsp-btn" onClick={autoFetchPrices} disabled={isFetchingPrices} title="一次自動抓取台美股最新報價">
            {isFetchingPrices ? <RefreshCw className="tsp-spin" size={16} /> : <Zap size={16} />}
            {isFetchingPrices ? '閃電更新中...' : '自動報價'}
          </button>
          <button className="tsp-btn" onClick={handleExportBackup} title="匯出完整資料備份 (JSON)，可用於還原或搬家"><Download size={16} /> 匯出備份</button>
          <button className="tsp-btn" onClick={handleExportTxnsCSV} title="匯出交易紀錄 (CSV)，方便報稅或匯入試算表"><Download size={16} /> 交易CSV</button>
          <button className="tsp-btn" onClick={() => { resetCashForm(); setShowCashForm(true); }}><Wallet size={16} /> 資金增減</button>
          <button className="tsp-btn tsp-btn-primary" onClick={() => { resetForm(); setShowForm(true); }}><Plus size={16} /> 新增交易</button>
        </div>
      </header>

      <nav className="tsp-tabs">
        {activeTabsList.map((t) => (
          <button key={t.id} className={`tsp-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>

      <main className="tsp-main" key={tab} style={{ animation: 'tspFadeIn 0.25s ease-out forwards' }}>
        {tab === 'dashboard' && <Dashboard totals={totals} holdings={holdingsAll} meta={meta} groupMode={groupMode} setGroupMode={setGroupMode} alerts={alerts} performance={performance} benchmarkStart={benchmarkStart} setBenchmarkStart={setBenchmarkStart} benchmarkEnd={benchmarkEnd} setBenchmarkEnd={setBenchmarkEnd} benchmarkReturnPct={benchmarkReturnPct} />}
        {tab === 'holdings' && <Holdings holdings={holdings} priceDraft={priceDraft} setPriceDraft={setPriceDraft} updatePrice={updatePrice} updateMeta={updateMeta} strategyFilter={strategyFilter} setStrategyFilter={setStrategyFilter} sectorFilter={sectorFilter} setSectorFilter={setSectorFilter} sectorOptions={sectorOptions} strategyOptions={strategyOptions} chainStageFilter={chainStageFilter} setChainStageFilter={setChainStageFilter} chainStageOptions={chainStageOptions} searchQuery={searchQuery} setSearchQuery={setSearchQuery} onAtrCalculate={handleAtrCalculation} safeNameStr={safeNameStr} />}
        {tab === 'txns' && <Transactions transactions={selectedOwner === 'all' ? transactions : filteredTxns} onEdit={handleEditTxn} onCopy={handleCopyTxn} onDelete={deleteTxn} showOwner={owners.length > 1} safeNameStr={safeNameStr} />}
        {tab === 'dividends' && <Dividends dividends={selectedOwner === 'all' ? dividends : filteredDividends} onEdit={handleEditDividend} onDelete={deleteDividend} showOwner={owners.length > 1} yearlyDividends={yearlyDividends} onAdd={() => { resetDivForm(); setShowDividendForm(true); }} totalDividend={totals.totalDividend} safeNameStr={safeNameStr} />}
        {tab === 'cash' && <CashAccount cashTransactions={filteredCashTxns} onEdit={handleEditCash} onDelete={deleteCash} showOwner={owners.length > 1} totalCashBalance={totals.totalCashBalance} onAdd={() => { resetCashForm(); setShowCashForm(true); }} safeNameStr={safeNameStr} />}
        {tab === 'watchlist' && <WatchlistPanel watchlists={watchlists} prices={prices} onEdit={handleEditWatchlist} onDelete={deleteWatchlist} onAdd={() => { resetWatchForm(); setShowWatchlistForm(true); }} safeNameStr={safeNameStr} />}
        {tab === 'charts' && <Charts holdings={holdingsAll} prices={prices} meta={meta} symbols={allSymbols} chartSymbol={chartSymbol} setChartSymbol={setChartSymbol} groupMode={groupMode} setGroupMode={setGroupMode} safeNameStr={safeNameStr} />}
        {tab === 'monthly' && <Monthly monthly={monthly} safeNameStr={safeNameStr} />}
        {tab === 'compare' && <Compare data={ownerComparison} safeNameStr={safeNameStr} />}
      </main>

      {toastMsg && <div className="tsp-toast">{toastMsg}</div>}
      <BackToTopButton />

      {cloudModal && (
      <ModalPortal>
        <div className="tsp-modal-backdrop" onClick={() => setCloudModal(false)}>
          <div className="tsp-modal" onClick={e => e.stopPropagation()}>
            <div className="tsp-modal-head">
              <h3>☁️ 雲端同步與帳號綁定</h3>
              <button type="button" className="tsp-icon-btn" onClick={() => setCloudModal(false)}><X size={18} /></button>
            </div>
            <div className="tsp-form" style={{ gap: '24px' }}>
               <div style={{ background: 'var(--panel-2)', padding: '16px', borderRadius: '8px' }}>
                 {user && user.email ? (
                   <div style={{ textAlign: 'center' }}>
                     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--up)', fontWeight: 'bold', marginBottom: 12 }}><CheckCircle2 size={20} /> 已綁定雲端帳號</div>
                     <p className="tsp-mono" style={{ margin: '0 0 16px 0' }}>{user.email}</p>
                     <p className="tsp-hint" style={{ marginBottom: 16 }}>您在任何裝置使用此信箱登入，即可無縫共用與同步您的持股簿資料。</p>
                     <button className="tsp-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={handleLogout}><LogOut size={16} /> 登出帳號</button>
                   </div>
                 ) : (
                   <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                     <h4 style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={16} /> 信箱帳號綁定</h4>
                     <p className="tsp-hint">註冊一組專屬信箱，可在不同裝置無縫共用資料。</p>
                     <div className="tsp-type-toggle" style={{ margin: '4px 0' }}>
                        <button type="button" className={isLoginMode ? 'active' : ''} onClick={() => setIsLoginMode(true)}>登入現有帳號</button>
                        <button type="button" className={!isLoginMode ? 'active' : ''} onClick={() => setIsLoginMode(false)}>註冊並備份資料</button>
                     </div>
                     <input type="email" className="tsp-input" placeholder="信箱 Email" value={emailInput} onChange={e => setEmailInput(e.target.value)} required />
                     <input type="password" className="tsp-input" placeholder="密碼 (至少 6 字元)" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} required minLength={6} />
                     <button type="submit" className="tsp-btn tsp-btn-primary" style={{ justifyContent: 'center' }}>{isLoginMode ? '登入帳號' : '註冊並將目前資料存入雲端'}</button>
                   </form>
                 )}
               </div>
               {(!user || !user.email) && (
                 <>
                   <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, fontWeight: 'bold' }}>— 或 —</div>
                   <div>
                     {roomCode ? (
                       <div>
                         <p className="tsp-hint" style={{ marginBottom: 12 }}>您目前正在使用【免註冊隨機代碼】共用群組中。</p>
                         <StatCard label="目前共用需求碼" value={roomCode} tone="tsp-warn" />
                         <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                           <button className="tsp-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { copyToClipboard(roomCode); showToast('已複製代碼！'); }}>複製代碼</button>
                           <button className="tsp-btn tsp-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setRoomCode(''); setCloudModal(false); showToast('已退出共用，返回個人雲端'); }}>退出共用</button>
                         </div>
                       </div>
                     ) : (
                       <>
                         <div style={{ marginBottom: 16 }}>
                           <h4 style={{ margin: '0 0 8px 0', fontSize: 15 }}>免註冊快速分享</h4>
                           <p className="tsp-hint" style={{ marginBottom: 12 }}>產生一組隨機代碼，並將資料轉移到共用空間，方便與他人即時協作觀看。</p>
                           <button className="tsp-btn" style={{ width: '100%', justifyContent: 'center', borderColor: 'var(--primary)', color: 'var(--primary)' }} onClick={createSharedRoom}>產生共用代碼</button>
                         </div>
                         <form onSubmit={joinSharedRoom} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                           <input className="tsp-input tsp-mono" placeholder="輸入別人分享的 6 碼英數代碼" value={joinCodeInput} onChange={e => setJoinCodeInput(e.target.value)} required />
                           <button type="submit" className="tsp-btn" style={{ width: '100%', justifyContent: 'center' }}>加入群組</button>
                         </form>
                       </>
                     )}
                   </div>
                 </>
               )}
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* 交易表單 */}
      {showForm && (
      <ModalPortal>
        <div className="tsp-modal-backdrop" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="tsp-modal" onClick={e => e.stopPropagation()}>
            <div className="tsp-modal-head">
              <h3>{editingTxnId ? '✏️ 編輯交易紀錄' : '➕ 新增交易紀錄'}</h3>
              <button type="button" className="tsp-icon-btn" onClick={() => { setShowForm(false); resetForm(); }}><X size={18} /></button>
            </div>
            <form onSubmit={submitTxn} className="tsp-form">
              {!editingTxnId && <p className="tsp-hint">全新雙向連動：輸入名稱或代號，零延遲自動補齊！</p>}
              <div className="tsp-type-toggle">
                <button type="button" className={form.type === 'buy' ? 'active tsp-up-bg' : ''} onClick={() => setForm(f => ({ ...f, type: 'buy', tax: '0' }))}>買進 / 匯入</button>
                <button type="button" className={form.type === 'sell' ? 'active tsp-down-bg' : ''} onClick={() => setForm(f => ({ ...f, type: 'sell' }))}>賣出</button>
              </div>
              <div className="tsp-form-row">
                <label>日期<input type="date" className="tsp-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required /></label>
                <label>持有者
                  <select className="tsp-input" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}>
                    {owners.map(o => <option key={safeNameStr(o)} value={safeNameStr(o)}>{safeNameStr(o)}</option>)}
                  </select>
                </label>
              </div>
              <div className="tsp-form-row">
                <label>股票代號
                  <div style={{position: 'relative'}}>
                    <input className="tsp-input" autoComplete="off" placeholder="2330 / AAPL" value={form.symbol} onChange={e => handleSymbolChange(e.target.value, 'txn')} onBlur={e => handleSymbolBlur(e.target.value, 'txn')} required />
                    {isLookingUpName && <RefreshCw size={14} className="tsp-spin tsp-muted" style={{position: 'absolute', right: 10, top: 12}} />}
                  </div>
                </label>
                <label>股票名稱<input className="tsp-input" autoComplete="off" placeholder="台積電" value={form.name} onChange={e => handleNameChange(e.target.value, 'txn')} onBlur={e => handleNameBlur(e.target.value, 'txn')} required/></label>
              </div>
              <div className="tsp-form-row">
                <label>股數<input type="number" min="0" step="any" className="tsp-input tsp-mono" placeholder="1000" value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} onWheel={e => e.target.blur()} required /></label>
                <label>成交價<input type="number" min="0" step="any" className="tsp-input tsp-mono" placeholder="600.5" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} onWheel={e => e.target.blur()} required /></label>
              </div>
              <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold' }}>券商手續費與交易稅金</span>
                  <button type="button" className="tsp-btn" style={{ padding: '4px 8px', fontSize: '12px', minHeight: '28px' }} onClick={autoCalculateTax}><Wand2 size={12} /> 台股自動試算</button>
                </div>
                <div className="tsp-form-row">
                  <label>手續費<input type="number" min="0" step="any" className="tsp-input tsp-mono" placeholder="0" value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} onWheel={e => e.target.blur()} /></label>
                  <label>交易稅(證交稅)<input type="number" min="0" step="any" className="tsp-input tsp-mono" placeholder="0" value={form.tax} onChange={e => setForm(f => ({ ...f, tax: e.target.value }))} onWheel={e => e.target.blur()} disabled={form.type==='buy'} title={form.type==='buy'?"買進無須交易稅":""} /></label>
                </div>
              </div>
              <label>交易筆記（買進/賣出理由）<input type="text" autoComplete="off" className="tsp-input" placeholder="例如：看好Q3法說會展望 / 停損換股..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} /></label>
              
              <div style={{ background: 'var(--panel-2)', padding: '12px', borderRadius: '8px', fontSize: '13px', color: 'var(--text)', display: 'flex', justifyContent: 'space-between' }}>
                <span className="tsp-muted">此筆預估收付總額：</span>
                <b className="tsp-mono">{form.type === 'buy' ? '-' : '+'}{money(cleanNum((Number(form.shares||0) * Number(form.price||0)) + (form.type === 'buy' ? (Number(form.fee||0) + Number(form.tax||0)) : -(Number(form.fee||0) + Number(form.tax||0)))))}</b>
              </div>
              <button type="submit" className="tsp-btn tsp-btn-primary tsp-form-submit"><Save size={16} /> 儲存交易</button>
            </form>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* 股利表單 */}
      {showDividendForm && (
      <ModalPortal>
        <div className="tsp-modal-backdrop" onClick={() => { setShowDividendForm(false); resetDivForm(); }}>
          <div className="tsp-modal" onClick={e => e.stopPropagation()}>
            <div className="tsp-modal-head">
              <h3>{editingDivId ? '✏️ 編輯股利紀錄' : '💰 新增股利紀錄'}</h3>
              <button type="button" className="tsp-icon-btn" onClick={() => { setShowDividendForm(false); resetDivForm(); }}><X size={18} /></button>
            </div>
            <form onSubmit={submitDividend} className="tsp-form">
              <div className="tsp-form-row">
                <label>發放日期<input type="date" className="tsp-input" value={divForm.date} onChange={e => setDivForm(f => ({ ...f, date: e.target.value }))} required /></label>
                <label>持有者
                  <select className="tsp-input" value={divForm.owner} onChange={e => setDivForm(f => ({ ...f, owner: e.target.value }))}>
                    {owners.map(o => <option key={safeNameStr(o)} value={safeNameStr(o)}>{safeNameStr(o)}</option>)}
                  </select>
                </label>
              </div>
              <div className="tsp-form-row">
                <label>股票代號
                  <div style={{position: 'relative'}}>
                    <input className="tsp-input" autoComplete="off" placeholder="2330" value={divForm.symbol} onChange={e => handleSymbolChange(e.target.value, 'div')} onBlur={e => handleSymbolBlur(e.target.value, 'div')} required />
                    {isLookingUpName && <RefreshCw size={14} className="tsp-spin tsp-muted" style={{position: 'absolute', right: 10, top: 12}} />}
                  </div>
                </label>
                <label>股票名稱<input className="tsp-input" autoComplete="off" placeholder="台積電" value={divForm.name} onChange={e => handleNameChange(e.target.value, 'div')} onBlur={e => handleNameBlur(e.target.value, 'div')} required /></label>
              </div>
              <div className="tsp-form-row">
                <label>參與配息股數<input type="number" min="0" step="any" className="tsp-input tsp-mono" placeholder="1000" value={divForm.shares} onChange={e => setDivForm(f => ({ ...f, shares: e.target.value }))} onWheel={e => e.target.blur()} required /></label>
                <label>現金股利／股<input type="number" min="0" step="any" className="tsp-input tsp-mono" placeholder="2.5" value={divForm.cashPerShare} onChange={e => setDivForm(f => ({ ...f, cashPerShare: e.target.value }))} onWheel={e => e.target.blur()} /></label>
              </div>
              <label>股票股利／股（選填）<input type="number" min="0" step="any" className="tsp-input tsp-mono" placeholder="0" value={divForm.stockPerShare} onChange={e => setDivForm(f => ({ ...f, stockPerShare: e.target.value }))} onWheel={e => e.target.blur()} /></label>
              <label>備註（選填）<input className="tsp-input" autoComplete="off" value={divForm.note} onChange={e => setDivForm(f => ({ ...f, note: e.target.value }))} /></label>
              <button type="submit" className="tsp-btn tsp-btn-primary tsp-form-submit"><Save size={16} /> 儲存股利紀錄</button>
            </form>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* 現金明細表單 */}
      {showCashForm && (
      <ModalPortal>
        <div className="tsp-modal-backdrop" onClick={() => { setShowCashForm(false); resetCashForm(); }}>
          <div className="tsp-modal" onClick={e => e.stopPropagation()}>
            <div className="tsp-modal-head">
              <h3>{editingCashId ? '✏️ 編輯現金明細' : '💳 新增入金 / 出金'}</h3>
              <button type="button" className="tsp-icon-btn" onClick={() => { setShowCashForm(false); resetCashForm(); }}><X size={18} /></button>
            </div>
            <form onSubmit={submitCash} className="tsp-form">
              <div className="tsp-type-toggle">
                <button type="button" className={cashForm.type === 'deposit' ? 'active tsp-up-bg' : ''} onClick={() => setCashForm(f => ({ ...f, type: 'deposit' }))}>入金 (匯入帳戶)</button>
                <button type="button" className={cashForm.type === 'withdraw' ? 'active tsp-down-bg' : ''} onClick={() => setCashForm(f => ({ ...f, type: 'withdraw' }))}>出金 (匯出帳戶)</button>
              </div>
              <div className="tsp-form-row">
                <label>日期<input type="date" className="tsp-input" value={cashForm.date} onChange={e => setCashForm(f => ({ ...f, date: e.target.value }))} required /></label>
                <label>帳戶所有者
                  <select className="tsp-input" value={cashForm.owner} onChange={e => setCashForm(f => ({ ...f, owner: e.target.value }))}>
                    {owners.map(o => <option key={safeString(o)} value={safeString(o)}>{safeString(o)}</option>)}
                  </select>
                </label>
              </div>
              <label>金額 (台幣)<input type="number" min="1" step="any" className="tsp-input tsp-mono" placeholder="50000" value={cashForm.amount} onChange={e => setCashForm(f => ({ ...f, amount: e.target.value }))} onWheel={e => e.target.blur()} required autoFocus /></label>
              <label>備註（選填）<input className="tsp-input" autoComplete="off" value={cashForm.note} onChange={e => setCashForm(f => ({ ...f, note: e.target.value }))} /></label>
              <button type="submit" className="tsp-btn tsp-btn-primary tsp-form-submit"><Save size={16} /> 儲存資金紀錄</button>
            </form>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* 觀察名單表單 */}
      {showWatchlistForm && (
      <ModalPortal>
        <div className="tsp-modal-backdrop" onClick={() => { setShowWatchlistForm(false); resetWatchForm(); }}>
          <div className="tsp-modal" onClick={e => e.stopPropagation()}>
            <div className="tsp-modal-head">
              <h3>{editingWatchId ? '✏️ 編輯觀察名單' : '👀 新增觀察名單'}</h3>
              <button type="button" className="tsp-icon-btn" onClick={() => { setShowWatchlistForm(false); resetWatchForm(); }}><X size={18} /></button>
            </div>
            <form onSubmit={submitWatchlist} className="tsp-form">
              <div className="tsp-form-row">
                <label>股票代號
                  <div style={{position: 'relative'}}>
                    <input className="tsp-input" autoComplete="off" placeholder="2330 / TSLA" value={watchForm.symbol} onChange={e => handleSymbolChange(e.target.value, 'watch')} onBlur={e => handleSymbolBlur(e.target.value, 'watch')} required />
                    {isLookingUpName && <RefreshCw size={14} className="tsp-spin tsp-muted" style={{position: 'absolute', right: 10, top: 12}} />}
                  </div>
                </label>
                <label>股票名稱<input className="tsp-input" autoComplete="off" placeholder="台積電" value={watchForm.name} onChange={e => handleNameChange(e.target.value, 'watch')} onBlur={e => handleNameBlur(e.target.value, 'watch')} required /></label>
              </div>
              <label>目標進場價<input type="number" min="0" step="any" className="tsp-input tsp-mono" placeholder="輸入跌至多少發出通知" value={watchForm.targetPrice} onChange={e => setWatchForm(f => ({ ...f, targetPrice: e.target.value }))} onWheel={e => e.target.blur()} /></label>

              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 12, marginTop: 4 }}>
                <p className="tsp-hint" style={{ marginBottom: 8 }}>📈 戴維斯雙擊觀察（選填）：搭配估值與獲利成長，輔助判斷是否為「雙擊」或「雙殺」訊號。</p>
                <div className="tsp-form-row">
                  <label>目前本益比 (PE)<input type="number" min="0" step="any" className="tsp-input tsp-mono" placeholder="例如 18.5" value={watchForm.currentPE} onChange={e => setWatchForm(f => ({ ...f, currentPE: e.target.value }))} onWheel={e => e.target.blur()} /></label>
                  <label>預估EPS成長率 %<input type="number" step="any" className="tsp-input tsp-mono" placeholder="例如 15（可負值）" value={watchForm.epsGrowth} onChange={e => setWatchForm(f => ({ ...f, epsGrowth: e.target.value }))} onWheel={e => e.target.blur()} /></label>
                </div>
                <div className="tsp-form-row">
                  <label>歷史本益比區間下緣<input type="number" min="0" step="any" className="tsp-input tsp-mono" placeholder="例如 12" value={watchForm.peLow} onChange={e => setWatchForm(f => ({ ...f, peLow: e.target.value }))} onWheel={e => e.target.blur()} /></label>
                  <label>歷史本益比區間上緣<input type="number" min="0" step="any" className="tsp-input tsp-mono" placeholder="例如 25" value={watchForm.peHigh} onChange={e => setWatchForm(f => ({ ...f, peHigh: e.target.value }))} onWheel={e => e.target.blur()} /></label>
                </div>
              </div>

              <label>觀察筆記（選填）<input className="tsp-input" autoComplete="off" placeholder="例如：等季報發布後再買..." value={watchForm.note} onChange={e => setWatchForm(f => ({ ...f, note: e.target.value }))} /></label>
              <button type="submit" className="tsp-btn tsp-btn-primary tsp-form-submit"><Save size={16} /> 儲存至觀察名單</button>
            </form>
          </div>
        </div>
      </ModalPortal>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// 子元件定義
// -------------------------------------------------------------
function StatCard({ label, value, sub, tone }) {
  return (
    <div className="tsp-card tsp-stat">
      <span className="tsp-stat-label">{label}</span>
      <span className={`tsp-stat-value tsp-mono ${tone || ''}`}>{value}</span>
      {sub && <span className={`tsp-stat-sub tsp-mono ${tone || ''}`}>{sub}</span>}
    </div>
  );
}

function GroupToggle({ groupMode, setGroupMode }) {
  return (
    <div className="tsp-toggle-group">
      {[['symbol', '股票'], ['sector', '產業'], ['chain', '產業鏈'], ['strategy', '策略']].map(([k, l]) => (
        <button key={k} className={groupMode === k ? 'active' : ''} onClick={() => setGroupMode(k)}>{l}</button>
      ))}
    </div>
  );
}

function Empty({ text }) { return <div className="tsp-empty">{text}</div>; }

function AllocationPie({ holdings, meta, groupMode, totalMarketValue }) {
  const data = groupHoldings(holdings, meta, groupMode).sort((a,b) => b.value - a.value);
  if (!data.length) return <Empty text="尚無持股資料" />;
  return (
    <div className="tsp-pie-wrap">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="var(--panel)" strokeWidth={2} />)}
          </Pie>
          <Tooltip formatter={(v) => money(v)} contentStyle={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="tsp-legend">
        {data.map((p, i) => (
          <div key={i} className="tsp-legend-item">
            <span className="tsp-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span>{p.name}</span>
            <span className="tsp-mono tsp-muted">{fmt2((p.value / (totalMarketValue || 1)) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard({ totals, holdings, meta, groupMode, setGroupMode, alerts, performance, benchmarkStart, setBenchmarkStart, benchmarkEnd, setBenchmarkEnd, benchmarkReturnPct }) {
  const dividendYieldPct = totals.totalCost > 0 ? (totals.totalDividend / totals.totalCost) * 100 : 0;
  const diffVsBenchmark = (performance.annualizedReturnPct != null && benchmarkReturnPct != null) ? performance.annualizedReturnPct - benchmarkReturnPct : null;
  return (
    <div className="tsp-dashboard">
      <div className="tsp-stats-grid">
        <StatCard label="總資產 (市值 + 餘額，已換算台幣)" value={money(totals.totalMarketValue + totals.totalCashBalance)} />
        <StatCard label="持股總市值 (已換算台幣)" value={money(totals.totalMarketValue)} />
        <StatCard label="戶頭可用餘額" value={money(totals.totalCashBalance)} tone={totals.totalCashBalance < 0 ? 'tsp-down' : ''} />
        <StatCard label="未實現損益" value={(totals.totalUPL > 0 ? '+' : '') + money(totals.totalUPL)} sub={pct(totals.totalUPLPct)} tone={changeCls(totals.totalUPL)} />
        <StatCard label="已實現損益" value={(totals.totalRealized > 0 ? '+' : '') + money(totals.totalRealized)} tone={changeCls(totals.totalRealized)} />
        <StatCard label="累計股利" value={money(totals.totalDividend)} sub={totals.totalCost > 0 ? `殖利率 ${pct(dividendYieldPct)}` : null} tone="tsp-up" />
      </div>
      <div className="tsp-dashboard-bottom">
        <div className="tsp-card tsp-panel">
          <div className="tsp-panel-head"><h3>資產配置</h3><GroupToggle groupMode={groupMode} setGroupMode={setGroupMode} /></div>
          <AllocationPie holdings={holdings} meta={meta} groupMode={groupMode} totalMarketValue={totals.totalMarketValue} />
        </div>
        <div className="tsp-card tsp-panel">
          <div className="tsp-panel-head"><h3>股價提醒與風險通知</h3></div>
          <div className="tsp-alerts-list">
            {alerts.length === 0 ? <Empty text="目前沒有觸發任何通知" /> : alerts.map((a, i) => { const Icon = a.icon; return <div key={i} className={`tsp-alert-item tsp-${a.tone}-bg`}><Icon size={18} className={`tsp-${a.tone}`} /><span>{a.text}</span></div>; })}
          </div>
        </div>
      </div>

      <div className="tsp-card tsp-panel" style={{ marginTop: 16 }}>
        <div className="tsp-panel-head"><h3>投資績效與大盤對照</h3></div>
        <p className="tsp-hint" style={{ margin: '0 0 12px' }}>
          年化報酬率是簡化估算：假設所有資金在期初一次投入（起始日：{performance.startDate || '尚無資料'}），沒有精確處理每一筆資金進出的時間點，僅供大致參考，不是精確的 XIRR 計算。
        </p>
        <div className="tsp-stats-grid">
          <StatCard label="累計淨投入本金" value={money(performance.netInvested)} />
          <StatCard label="總報酬率" value={performance.totalReturnPct != null ? pct(performance.totalReturnPct) : '尚無資料'} tone={performance.totalReturnPct != null ? changeCls(performance.totalReturnPct) : ''} />
          <StatCard label="簡化年化報酬率" value={performance.annualizedReturnPct != null ? pct(performance.annualizedReturnPct) : '未滿一年或資料不足'} tone={performance.annualizedReturnPct != null ? changeCls(performance.annualizedReturnPct) : ''} />
        </div>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--border)' }}>
          <p className="tsp-hint" style={{ margin: '0 0 8px' }}>大盤/ETF 對照（選填，預設帶入 0050 價格，也可自行換成你想比較的指數或ETF；填的是「大盤本身」的價格，不是你的買進成本）</p>
          <div className="tsp-form-row" style={{ marginBottom: 12 }}>
            <label>期初參考價<br /><span className="tsp-hint" style={{ fontWeight: 'normal' }}>你投資起始日當天的收盤價</span><input type="number" step="any" className="tsp-input tsp-mono" value={benchmarkStart} onChange={e => setBenchmarkStart(e.target.value)} onWheel={e => e.target.blur()} /></label>
            <label>目前參考價<br /><span className="tsp-hint" style={{ fontWeight: 'normal' }}>今天的最新收盤價</span><input type="number" step="any" className="tsp-input tsp-mono" value={benchmarkEnd} onChange={e => setBenchmarkEnd(e.target.value)} onWheel={e => e.target.blur()} /></label>
          </div>
          {benchmarkReturnPct != null ? (
            <div className="tsp-stats-grid">
              <StatCard label="同期大盤/ETF報酬率" value={pct(benchmarkReturnPct)} tone={changeCls(benchmarkReturnPct)} />
              <StatCard label="你 vs 大盤" value={diffVsBenchmark != null ? `${diffVsBenchmark > 0 ? '+' : ''}${pct(diffVsBenchmark)}` : '尚無資料'} sub={diffVsBenchmark != null ? (diffVsBenchmark > 0 ? '跑贏大盤' : diffVsBenchmark < 0 ? '跑輸大盤' : '打平大盤') : null} tone={diffVsBenchmark != null ? changeCls(diffVsBenchmark) : ''} />
            </div>
          ) : <Empty text="填入期初/目前參考價後，會顯示同期報酬率比較" />}
        </div>
      </div>
    </div>
  );
}

function Holdings({ holdings, priceDraft, setPriceDraft, updatePrice, updateMeta, strategyFilter, setStrategyFilter, sectorFilter, setSectorFilter, sectorOptions, strategyOptions, chainStageFilter, setChainStageFilter, chainStageOptions, searchQuery, setSearchQuery, onAtrCalculate, safeNameStr }) {
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [detailSymbol, setDetailSymbol] = useState(null);
  useEffect(() => { setPage(1); }, [searchQuery, sectorFilter, chainStageFilter, strategyFilter]);
  const totalPages = Math.max(1, Math.ceil(holdings.length / PAGE_SIZE));
  const visibleHoldings = holdings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const h = detailSymbol ? holdings.find(x => x.symbol === detailSymbol) : null;
  const detailSignal = h ? computeDavisSignal(h) : null;
  return (
    <div>
      <DavisQuadrantChart items={holdings} title="持股 戴維斯雙擊象限總覽" />
      <div className="tsp-card">
      <div className="tsp-filters" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '150px' }}>
          <Search size={14} className="tsp-muted" style={{ position: 'absolute', left: 10, top: 12 }} />
          <input className="tsp-input" placeholder="搜尋代號或名稱..." style={{ paddingLeft: 32 }} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <select className="tsp-input tsp-select" style={{ flex: 1, minWidth: '120px' }} value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}><option value="all">所有產業</option>{sectorOptions.map(o => <option key={o} value={o}>{o}</option>)}</select>
        <select className="tsp-input tsp-select" style={{ flex: 1, minWidth: '120px' }} value={chainStageFilter} onChange={e => setChainStageFilter(e.target.value)}><option value="all">所有產業鏈階段</option>{chainStageOptions.map(o => <option key={o} value={o}>{o}</option>)}</select>
        <select className="tsp-input tsp-select" style={{ flex: 1, minWidth: '120px' }} value={strategyFilter} onChange={e => setStrategyFilter(e.target.value)}><option value="all">所有策略</option>{strategyOptions.map(o => <option key={o} value={o}>{o}</option>)}</select>
      </div>
      <p className="tsp-hint" style={{ padding: '0 16px', margin: '8px 0 0' }}>💱 美股（USD）以美元原幣顯示均價/市值；總覽與圖表的加總數字，會依右上角設定的匯率換算為台幣。</p>
      <p className="tsp-hint" style={{ padding: '0 16px', margin: '4px 0 0' }}>📱 手機上不方便左右滑動看完整欄位的話，可以點股票代號旁的<span style={{ whiteSpace: 'nowrap' }}>&nbsp;<Eye size={12} style={{ verticalAlign: 'middle' }} />&nbsp;圖示</span>，用彈出卡片查看/編輯完整資訊。</p>
      <DavisLegend />
      <div className="tsp-table-wrap">
        <table className="tsp-table">
          <thead>
            <tr>
              <th>股票</th><th className="tsp-right">股數</th><th className="tsp-right">均價(含稅費)</th><th className="tsp-right">現價</th><th className="tsp-right">市值</th><th className="tsp-right">未實現損益</th><th className="th-category">分類設定</th><th style={{ minWidth: 150 }}>戴維斯雙擊觀察</th><th className="th-alerts">停損/獲利提醒</th><th>備註</th>
            </tr>
          </thead>
          <tbody>
            {visibleHoldings.map(h => (
              <tr key={h.symbol} className={h.isWarning ? 'tsp-row-warn' : ''}>
                <td style={{ whiteSpace: 'normal', wordBreak: 'break-word', minWidth: '100px' }}>
                  <div className="tsp-symbol" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {h.symbol} {h.currency === 'USD' && <span className="tsp-badge tsp-warn-bg tsp-warn" style={{ fontSize: 10 }}>USD</span>}
                    <button className="tsp-icon-btn" title="查看/編輯完整卡片" onClick={() => setDetailSymbol(h.symbol)}><Eye size={14} /></button>
                  </div>
                  <div className="tsp-name tsp-muted">{safeNameStr(h.name)}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', alignItems: 'flex-start' }}><Tag text={h.sector} /><Tag text={h.chainStage} /><Tag text={h.strategy} /></div>
                </td>
                <td className="tsp-right tsp-mono">{fmtInt(h.shares)}</td>
                <td className="tsp-right tsp-mono"><div title="均價包含您輸入的手續費">{fmtPrice(h.avgCost)}</div></td>
                <td className="tsp-right">
                  <div className="tsp-price-input">
                    <input className="tsp-input tsp-input-sm tsp-mono" placeholder={fmtPrice(h.current)} value={priceDraft[h.symbol] ?? ''} onChange={e => setPriceDraft(d => ({...d, [h.symbol]: e.target.value}))} onWheel={e => e.target.blur()} onKeyDown={e => e.key === 'Enter' && updatePrice(h.symbol)} />
                    {(priceDraft[h.symbol] && Number(priceDraft[h.symbol]) > 0) && <button className="tsp-icon-btn" onClick={() => updatePrice(h.symbol)}><Save size={14} /></button>}
                  </div>
                </td>
                <td className="tsp-right tsp-mono">{fmtInt(h.marketValue)}</td>
                <td className={`tsp-right tsp-mono ${changeCls(h.upl)}`}><div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end'}}><div>{h.upl > 0 ? '+' : ''}{fmtInt(h.upl)}</div><div style={{ fontSize: 12 }}>{pct(h.uplPct)}</div></div></td>
                <td style={{ minWidth: '130px' }}>
                  <div className="tsp-meta-inputs" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <MetaInput options={sectorOptions} placeholder="選擇產業" val={h.sector} onSave={(v) => updateMeta(h.symbol, { sector: v })} />
                    <MetaInput options={chainStageOptionsForSector(h.sector)} placeholder="選擇產業鏈階段" val={h.chainStage} onSave={(v) => updateMeta(h.symbol, { chainStage: v })} />
                    <MetaInput options={strategyOptions} placeholder="選擇策略" val={h.strategy} onSave={(v) => updateMeta(h.symbol, { strategy: v })} />
                  </div>
                </td>
                <td style={{ minWidth: '150px' }}>
                  {(() => { const signal = computeDavisSignal(h); return (
                    <div className="tsp-meta-inputs" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span className="tsp-muted" style={{ fontSize: '11px', minWidth: '30px' }}>PE</span><BlurInput val={h.currentPE} placeholder="本益比" onSave={(v) => updateMeta(h.symbol, { currentPE: v })} /></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span className="tsp-muted" style={{ fontSize: '11px', minWidth: '30px' }}>區間</span><BlurInput val={h.peLow} placeholder="下緣" onSave={(v) => updateMeta(h.symbol, { peLow: v })} /><BlurInput val={h.peHigh} placeholder="上緣" onSave={(v) => updateMeta(h.symbol, { peHigh: v })} /></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span className="tsp-muted" style={{ fontSize: '11px', minWidth: '30px' }}>EPS%</span><BlurInput val={h.epsGrowth} placeholder="成長率%" onSave={(v) => updateMeta(h.symbol, { epsGrowth: v })} /></div>
                      {signal.pos != null && <PEGauge low={h.peLow} high={h.peHigh} current={h.currentPE} />}
                      {signal.label && <span className={`tsp-badge ${signal.tone}`} style={{ fontSize: 10 }}>{signal.label}</span>}
                    </div>
                  ); })()}
                </td>
                <td style={{ minWidth: '160px' }}>
                  <div className="tsp-meta-inputs" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span className="tsp-muted" style={{ fontSize: '12px', fontWeight: 'bold', minWidth: '32px' }}>防守</span><BlurInput val={h.stopLoss} placeholder="輸入防守價" onSave={(v) => updateMeta(h.symbol, { stopLoss: v })} /></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span className="tsp-muted" style={{ fontSize: '12px', fontWeight: 'bold', minWidth: '32px' }}>目標</span><BlurInput val={h.targetPrice} placeholder="輸入目標價" onSave={(v) => updateMeta(h.symbol, { targetPrice: v })} /></div>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                      <button type="button" className="tsp-btn" style={{ flex: 1, padding: '2px 4px', fontSize: '11px', justifyContent: 'center' }} onClick={() => updateMeta(h.symbol, { stopLoss: cleanNum(h.avgCost * 0.9), targetPrice: cleanNum(h.avgCost * 1.2) })} title="防守設為成本-10% / 目標設為成本+20%">±10/20%</button>
                      <button type="button" className="tsp-btn" style={{ flex: 1, padding: '2px 4px', fontSize: '11px', justifyContent: 'center' }} onClick={() => onAtrCalculate(h.symbol, h.current)} title="根據最近 14 天資料計算 ATR">ATR</button>
                    </div>
                  </div>
                </td>
                <td style={{ minWidth: '150px' }}>
                  <input className="tsp-input tsp-input-sm" placeholder="持股筆記..." value={h.note || ''} onChange={e => updateMeta(h.symbol, { note: e.target.value })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>

      {h && (
      <ModalPortal>
        <div className="tsp-modal-backdrop" onClick={() => setDetailSymbol(null)}>
          <div className="tsp-modal" onClick={e => e.stopPropagation()}>
            <div className="tsp-modal-head">
              <h3>{h.symbol} {safeNameStr(h.name)} {h.currency === 'USD' && <span className="tsp-badge tsp-warn-bg tsp-warn" style={{ fontSize: 10 }}>USD</span>}</h3>
              <button type="button" className="tsp-icon-btn" onClick={() => setDetailSymbol(null)}><X size={18} /></button>
            </div>
            <div style={{ padding: 20, maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}><Tag text={h.sector} /><Tag text={h.chainStage} /><Tag text={h.strategy} /></div>

              <div className="tsp-data-card" style={{ marginBottom: 16 }}>
                <div className="tsp-data-card-row"><span>股數</span><span>{fmtInt(h.shares)}</span></div>
                <div className="tsp-data-card-row"><span>均價(含稅費)</span><span>{fmtPrice(h.avgCost)}</span></div>
                <div className="tsp-data-card-row"><span>現價</span><span>{fmtPrice(h.current)}</span></div>
                <div className="tsp-data-card-row"><span>市值</span><span>{fmtInt(h.marketValue)}</span></div>
                <div className="tsp-data-card-row"><span>未實現損益</span><span className={changeCls(h.upl)}>{h.upl > 0 ? '+' : ''}{fmtInt(h.upl)}（{pct(h.uplPct)}）</span></div>
                {h.dividendTotal > 0 && <div className="tsp-data-card-row"><span>累計股利</span><span className="tsp-up">{fmtInt(h.dividendTotal)}（殖利率 {pct(h.dividendYieldPct)}）</span></div>}
              </div>

              <p className="tsp-hint" style={{ margin: '0 0 6px' }}>更新現價</p>
              <div className="tsp-price-input" style={{ marginBottom: 16 }}>
                <input className="tsp-input tsp-mono" style={{ flex: 1 }} placeholder={fmtPrice(h.current)} value={priceDraft[h.symbol] ?? ''} onChange={e => setPriceDraft(d => ({...d, [h.symbol]: e.target.value}))} onWheel={e => e.target.blur()} onKeyDown={e => e.key === 'Enter' && updatePrice(h.symbol)} />
                {(priceDraft[h.symbol] && Number(priceDraft[h.symbol]) > 0) && <button className="tsp-icon-btn" onClick={() => updatePrice(h.symbol)}><Save size={16} /></button>}
              </div>

              <p className="tsp-hint" style={{ margin: '0 0 6px' }}>分類設定</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <MetaInput options={sectorOptions} placeholder="選擇產業" val={h.sector} onSave={(v) => updateMeta(h.symbol, { sector: v })} />
                <MetaInput options={chainStageOptionsForSector(h.sector)} placeholder="選擇產業鏈階段" val={h.chainStage} onSave={(v) => updateMeta(h.symbol, { chainStage: v })} />
                <MetaInput options={strategyOptions} placeholder="選擇策略" val={h.strategy} onSave={(v) => updateMeta(h.symbol, { strategy: v })} />
              </div>

              <p className="tsp-hint" style={{ margin: '0 0 6px' }}>戴維斯雙擊觀察</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="tsp-muted" style={{ fontSize: 13, minWidth: 50 }}>本益比</span><BlurInput val={h.currentPE} placeholder="本益比" onSave={(v) => updateMeta(h.symbol, { currentPE: v })} /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="tsp-muted" style={{ fontSize: 13, minWidth: 50 }}>河流區間</span><BlurInput val={h.peLow} placeholder="下緣" onSave={(v) => updateMeta(h.symbol, { peLow: v })} /><BlurInput val={h.peHigh} placeholder="上緣" onSave={(v) => updateMeta(h.symbol, { peHigh: v })} /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="tsp-muted" style={{ fontSize: 13, minWidth: 50 }}>EPS成長%</span><BlurInput val={h.epsGrowth} placeholder="成長率%" onSave={(v) => updateMeta(h.symbol, { epsGrowth: v })} /></div>
                {detailSignal && detailSignal.pos != null && <PEGauge low={h.peLow} high={h.peHigh} current={h.currentPE} />}
                {detailSignal && detailSignal.label && <span className={`tsp-badge ${detailSignal.tone}`} style={{ fontSize: 11 }}>{detailSignal.label}</span>}
              </div>

              <p className="tsp-hint" style={{ margin: '0 0 6px' }}>停損/獲利提醒</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="tsp-muted" style={{ fontSize: 13, fontWeight: 'bold', minWidth: 40 }}>防守</span><BlurInput val={h.stopLoss} placeholder="輸入防守價" onSave={(v) => updateMeta(h.symbol, { stopLoss: v })} /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="tsp-muted" style={{ fontSize: 13, fontWeight: 'bold', minWidth: 40 }}>目標</span><BlurInput val={h.targetPrice} placeholder="輸入目標價" onSave={(v) => updateMeta(h.symbol, { targetPrice: v })} /></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="tsp-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => updateMeta(h.symbol, { stopLoss: cleanNum(h.avgCost * 0.9), targetPrice: cleanNum(h.avgCost * 1.2) })} title="防守設為成本-10% / 目標設為成本+20%">±10/20%</button>
                  <button type="button" className="tsp-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onAtrCalculate(h.symbol, h.current)} title="根據最近 14 天資料計算 ATR">ATR</button>
                </div>
              </div>

              <p className="tsp-hint" style={{ margin: '0 0 6px' }}>持股筆記</p>
              <input className="tsp-input" placeholder="持股筆記..." value={h.note || ''} onChange={e => updateMeta(h.symbol, { note: e.target.value })} />
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </div>
  );
}

function Transactions({ transactions, onEdit, onDelete, onCopy, showOwner, safeNameStr }) {
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  if (!transactions.length) return <Empty text="尚無交易紀錄，點擊右上角「新增交易」開始記錄" />;
  const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
  const filtered = searchQuery
    ? sorted.filter(t => t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || safeNameStr(t.name).toLowerCase().includes(searchQuery.toLowerCase()) || (t.note || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : sorted;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <div className="tsp-card tsp-table-wrap">
      <div style={{ position: 'relative', margin: '0 0 12px', maxWidth: 280 }}>
        <Search size={14} className="tsp-muted" style={{ position: 'absolute', left: 10, top: 12 }} />
        <input className="tsp-input" placeholder="搜尋代號、名稱或筆記..." style={{ paddingLeft: 32 }} value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }} />
      </div>
      <table className="tsp-table">
        <thead>
          <tr>
            <th>日期</th><th>類型</th><th>股票</th><th className="tsp-right">股數</th><th className="tsp-right">成交價</th><th className="tsp-right">手續費</th><th className="tsp-right">交易稅</th><th className="tsp-right">總收付金額</th><th>交易筆記</th>{showOwner && <th>持有者</th>}<th>操作</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && <tr><td colSpan={showOwner ? 10 : 9}><Empty text="找不到符合的交易紀錄" /></td></tr>}
          {visible.map(t => {
            const cost = cleanNum((Number(t.shares) || 0) * (Number(t.price) || 0));
            const fee = Number(t.fee) || 0; const tax = Number(t.tax) || 0;
            const total = t.type === 'buy' ? (cost + fee + tax) : (cost - fee - tax);
            return (
              <tr key={t.id} className="tsp-clickable-row" onClick={() => onEdit(t)}>
                <td className="tsp-mono">{t.date}</td><td><span className={`tsp-badge ${t.type === 'buy' ? 'tsp-up-bg tsp-up' : 'tsp-down-bg tsp-down'}`}>{t.type === 'buy' ? '買進' : '賣出'}</span></td>
                <td>{t.symbol} {safeNameStr(t.name)}</td><td className="tsp-right tsp-mono">{fmtInt(t.shares)}</td><td className="tsp-right tsp-mono">{fmtPrice(t.price)}</td><td className="tsp-right tsp-mono">{fmtInt(fee)}</td><td className="tsp-right tsp-mono">{fmtInt(tax)}</td>
                <td className={`tsp-right tsp-mono ${t.type === 'buy' ? 'tsp-down' : 'tsp-up'}`}>{t.type === 'buy' ? '-' : '+'}{fmtInt(total)}</td>
                <td className="tsp-muted" style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.note || '-'}</td>{showOwner && <td><Tag text={t.owner || '我'} /></td>}
                <td onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <button className="tsp-icon-btn" title="複製這筆交易（帶入今天日期）" onClick={() => onCopy(t)}><Copy size={16} /></button>
                  <button className="tsp-icon-btn tsp-danger" onClick={() => { if(window.confirm('確定刪除此交易？')) onDelete(t.id); }}><Trash2 size={16} /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}

function CashAccount({ cashTransactions, onEdit, onDelete, showOwner, totalCashBalance, onAdd, safeNameStr }) {
  const sorted = [...cashTransactions].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
  return (
    <div className="tsp-cash-view">
      <div className="tsp-stats-grid" style={{ marginBottom: 16 }}>
        <StatCard label="目前戶頭可用餘額" value={money(totalCashBalance)} tone={totalCashBalance < 0 ? 'tsp-down' : ''} />
        <div className="tsp-card tsp-stat" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={onAdd}><Wallet size={24} className="tsp-primary" style={{ marginBottom: 8 }} /><span className="tsp-stat-label">新增入金 / 出金紀錄</span></div>
      </div>
      <div className="tsp-card tsp-table-wrap">
        <table className="tsp-table">
          <thead><tr><th>日期</th><th>類型</th><th className="tsp-right">金額 (台幣)</th>{showOwner && <th>帳戶所有者</th>}<th>備註</th><th>操作</th></tr></thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={6}><Empty text="尚無資金紀錄。" /></td></tr>}
            {sorted.map(c => (
              <tr key={c.id} className="tsp-clickable-row" onClick={() => onEdit(c)}>
                <td className="tsp-mono">{c.date}</td><td><span className={`tsp-badge ${c.type === 'deposit' ? 'tsp-up-bg tsp-up' : 'tsp-down-bg tsp-down'}`}>{c.type === 'deposit' ? '入金' : '出金'}</span></td>
                <td className={`tsp-right tsp-mono ${c.type === 'deposit' ? 'tsp-up' : 'tsp-down'}`}>{c.type === 'deposit' ? '+' : '-'}{fmtInt(c.amount)}</td>
                {showOwner && <td><Tag text={c.owner || '我'} /></td>}<td className="tsp-muted">{c.note || '-'}</td>
                <td onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'flex-end' }}><button className="tsp-icon-btn tsp-danger" onClick={() => { if(window.confirm('確定刪除此紀錄？')) onDelete(c.id); }}><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Dividends({ dividends, onEdit, onDelete, showOwner, yearlyDividends, onAdd, totalDividend, safeNameStr }) {
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const sorted = [...dividends].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
  const filtered = searchQuery
    ? sorted.filter(d => d.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || safeNameStr(d.name).toLowerCase().includes(searchQuery.toLowerCase()) || (d.note || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : sorted;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <div className="tsp-dividends-view">
      <div className="tsp-stats-grid" style={{ marginBottom: 16 }}>
        <StatCard label="累計領取股利" value={money(totalDividend)} tone="tsp-up" />
        {yearlyDividends.slice(-3).map(y => (<StatCard key={y.year} label={`${y.year}年 股利`} value={money(y.total)} tone="tsp-up" />))}
        <div className="tsp-card tsp-stat" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={onAdd}><Plus size={24} className="tsp-primary" style={{ marginBottom: 8 }} /><span className="tsp-stat-label">新增股利紀錄</span></div>
      </div>
      <div className="tsp-card tsp-table-wrap">
        <div style={{ position: 'relative', margin: '0 0 12px', maxWidth: 280 }}>
          <Search size={14} className="tsp-muted" style={{ position: 'absolute', left: 10, top: 12 }} />
          <input className="tsp-input" placeholder="搜尋代號、名稱或備註..." style={{ paddingLeft: 32 }} value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }} />
        </div>
        <table className="tsp-table">
          <thead><tr><th>日期</th><th>股票</th><th className="tsp-right">配息股數</th><th className="tsp-right">現金股利/股</th><th className="tsp-right">股票股利/股</th><th className="tsp-right">總現金股利</th>{showOwner && <th>持有者</th>}<th>備註</th><th>操作</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={9}><Empty text="找不到符合的股利紀錄" /></td></tr>}
            {visible.map(d => (
              <tr key={d.id} className="tsp-clickable-row" onClick={() => onEdit(d)}>
                <td className="tsp-mono">{d.date}</td><td>{d.symbol} {safeNameStr(d.name)}</td><td className="tsp-right tsp-mono">{fmtInt(d.shares)}</td><td className="tsp-right tsp-mono">{fmtPrice(d.cashPerShare)}</td><td className="tsp-right tsp-mono">{fmtPrice(d.stockPerShare)}</td><td className="tsp-right tsp-mono tsp-up">+{fmtInt(d.totalCash)}</td>
                {showOwner && <td><Tag text={d.owner || '我'} /></td>}<td className="tsp-muted">{d.note}</td>
                <td onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'flex-end' }}><button className="tsp-icon-btn tsp-danger" onClick={() => { if(window.confirm('確定刪除？')) onDelete(d.id); }}><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}

function Charts({ holdings, prices, meta, symbols, chartSymbol, setChartSymbol, groupMode, setGroupMode, safeNameStr }) {
  const [section, setSection] = useState('ranking');
  const currentSymbol = chartSymbol || (symbols.length > 0 ? symbols[0] : null);
  const historyData = useMemo(() => {
    if (!currentSymbol || !prices[currentSymbol] || !prices[currentSymbol].history) return [];
    return [...prices[currentSymbol].history].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [currentSymbol, prices]);
  const barData = groupHoldings(holdings, meta, groupMode).sort((a,b) => b.value - a.value);
  const pnlByGroupData = useMemo(() => groupPnL(holdings, meta, groupMode).sort((a, b) => b.value - a.value), [holdings, meta, groupMode]);
  const pnlData = useMemo(() => holdings.map(h => ({ name: `${h.symbol} ${safeNameStr(h.name)}`, fullName: safeNameStr(h.name), pnl: h.uplTWD ?? h.upl })).sort((a, b) => b.pnl - a.pnl), [holdings, safeNameStr]);
  const currentHoldingAvgCost = useMemo(() => { const h = holdings.find(x => x.symbol === currentSymbol); return h ? h.avgCost : null; }, [currentSymbol, holdings]);

  const SECTIONS = [
    ['ranking', '損益排行'],
    ['allocation', '資產分佈'],
    ['pnlByGroup', '分類損益'],
    ['history', '個股走勢'],
  ];

  return (
    <div className="tsp-charts-view">
      <div className="tsp-tabs" style={{ padding: '0 0 12px' }}>
        {SECTIONS.map(([k, l]) => (
          <button key={k} className={`tsp-tab ${section === k ? 'active' : ''}`} onClick={() => setSection(k)}>{l}</button>
        ))}
      </div>

      {section === 'ranking' && (
        <div className="tsp-card tsp-panel">
          <div className="tsp-panel-head"><h3>各股未實現損益排行榜</h3></div>
          {pnlData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(240, pnlData.length * 34 + 40)}>
              <BarChart data={pnlData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="var(--muted)" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={v => fmtInt(v / 10000) + '萬'} />
                <YAxis type="category" dataKey="name" stroke="var(--muted)" tick={{ fill: 'var(--muted)', fontSize: 11 }} width={100} />
                <Tooltip formatter={v => money(v)} cursor={{ fill: 'var(--panel-2)' }} contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>{pnlData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.pnl > 0 ? 'var(--up)' : 'var(--down)'} />))}</Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text="尚無持股" />}
        </div>
      )}

      {section === 'allocation' && (
        <div className="tsp-card tsp-panel">
          <div className="tsp-panel-head"><h3>資產分佈長條圖</h3><GroupToggle groupMode={groupMode} setGroupMode={setGroupMode} /></div>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(240, barData.length * 34 + 40)}>
              <BarChart data={barData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="var(--muted)" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={v => fmtInt(v / 10000) + '萬'} />
                <YAxis type="category" dataKey="name" stroke="var(--muted)" tick={{ fill: 'var(--muted)', fontSize: 11 }} width={100} />
                <Tooltip formatter={v => money(v)} cursor={{ fill: 'var(--panel-2)' }} contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text="尚無持股" />}
        </div>
      )}

      {section === 'pnlByGroup' && (
        <div className="tsp-card tsp-panel">
          <div className="tsp-panel-head"><h3>依分類損益長條圖</h3><GroupToggle groupMode={groupMode} setGroupMode={setGroupMode} /></div>
          <p className="tsp-hint" style={{ margin: '0 0 8px' }}>跟「資產分佈」用同一組分類切換，看的是每個分類目前的未實現損益（已換算台幣）加總。</p>
          {pnlByGroupData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(240, pnlByGroupData.length * 34 + 40)}>
              <BarChart data={pnlByGroupData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="var(--muted)" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={v => fmtInt(v / 10000) + '萬'} />
                <YAxis type="category" dataKey="name" stroke="var(--muted)" tick={{ fill: 'var(--muted)', fontSize: 11 }} width={100} />
                <Tooltip formatter={v => money(v)} cursor={{ fill: 'var(--panel-2)' }} contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>{pnlByGroupData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.value > 0 ? 'var(--up)' : 'var(--down)'} />))}</Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text="尚無持股" />}
        </div>
      )}

      {section === 'history' && (
        <div className="tsp-card tsp-panel">
          <div className="tsp-panel-head">
            <h3>個股歷史股價紀錄</h3>
            <select className="tsp-input tsp-select" style={{ width: 'auto' }} value={currentSymbol || ''} onChange={e => setChartSymbol(e.target.value)}>
              {symbols.map(s => { const holding = holdings.find(h => h.symbol === s); return <option key={s} value={s}>{s}{holding ? ` ${safeNameStr(holding.name)}` : ''}</option>; })}
            </select>
          </div>
          {historyData.length > 1 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historyData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--muted)" tick={{ fill: 'var(--muted)' }} />
                <YAxis domain={['auto', 'auto']} stroke="var(--muted)" tick={{ fill: 'var(--muted)' }} />
                <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                <Line type="monotone" dataKey="price" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--primary)' }} activeDot={{ r: 6 }} name="收盤價" />
                {currentHoldingAvgCost && <ReferenceLine y={currentHoldingAvgCost} stroke="var(--up)" strokeDasharray="5 5" label={{ position: 'top', value: '平均成本', fill: 'var(--up)', fontSize: 12 }} />}
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty text="此股票無足夠的歷史股價紀錄 (需有兩筆以上)。" />}
        </div>
      )}
    </div>
  );
}

function DavisLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ margin: '8px 16px 0' }}>
      <button type="button" className="tsp-btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setOpen(o => !o)}>
        {open ? '收合說明 ▲' : 'ⓘ 這些訊號名稱是什麼意思？ ▼'}
      </button>
      {open && (
        <div className="tsp-card" style={{ marginTop: 8, padding: '10px 14px', fontSize: 12, lineHeight: 1.7 }}>
          <p style={{ margin: '4px 0' }}><span className="tsp-badge tsp-up-bg tsp-up" style={{ fontSize: 10 }}>潛在雙擊</span> 獲利在成長，本益比也還在偏低的位置，市場可能還沒注意到，機會相對較大。</p>
          <p style={{ margin: '4px 0' }}><span className="tsp-badge tsp-up-bg tsp-up" style={{ fontSize: 10 }}>獲利成長，評價已回升</span> 獲利確實在成長，但本益比已經漲上去了，代表好消息大致已經反映在股價裡，之後要再漲得靠獲利持續成長。</p>
          <p style={{ margin: '4px 0' }}><span className="tsp-badge tsp-warn-bg tsp-warn" style={{ fontSize: 10 }}>留意雙殺</span> 獲利正在轉弱，但本益比還沒跌下來，代表壞消息還沒完全反映，風險相對較大。</p>
          <p style={{ margin: '4px 0' }}><span className="tsp-badge tsp-down-bg tsp-down" style={{ fontSize: 10 }}>獲利轉弱，評價已修正</span> 獲利正在轉弱，本益比也已經跌到偏低，代表壞消息大致已經反映完，下跌風險相對較小（但不代表會漲）。</p>
          <p className="tsp-muted" style={{ margin: '8px 0 0' }}>這些都只是輔助參考的簡化邏輯，不是投資建議。</p>
        </div>
      )}
    </div>
  );
}

function DavisDot(props) {
  const { cx, cy, payload, showLabels } = props;
  const above = payload.idx % 2 === 0;
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill={payload.color} stroke="var(--panel)" strokeWidth={1.5} />
      {showLabels && (
        <text x={cx} y={above ? cy - 11 : cy + 19} textAnchor="middle" fontSize={11} fontWeight="bold" fill="var(--text)">{payload.name}</text>
      )}
    </g>
  );
}

function DavisQuadrantChart({ items, title }) {
  const points = (items || [])
    .filter(it => it.currentPE != null && it.peLow != null && it.peHigh != null && it.epsGrowth != null && Number(it.peHigh) > Number(it.peLow))
    .map((it, idx) => {
      const pos = cleanNum(Math.max(0, Math.min(100, ((Number(it.currentPE) - Number(it.peLow)) / (Number(it.peHigh) - Number(it.peLow))) * 100)));
      const growth = cleanNum(Number(it.epsGrowth));
      const signal = computeDavisSignal(it);
      const color = signal.tone.includes('up') ? 'var(--up)' : signal.tone.includes('warn') ? 'var(--warn)' : signal.tone.includes('down') ? 'var(--down)' : 'var(--muted)';
      return { symbol: it.symbol, name: safeString(it.name) || it.symbol, pos, growth, color, idx };
    });
  if (points.length === 0) return null;
  const maxAbsGrowth = Math.max(20, ...points.map(p => Math.abs(p.growth))) * 1.2;
  const showLabels = points.length <= 8;

  return (
    <div className="tsp-card" style={{ padding: 16, marginBottom: 16 }}>
      <p style={{ fontWeight: 'bold', marginBottom: 4 }}>{title || '戴維斯雙擊象限總覽'}</p>
      <p className="tsp-hint" style={{ margin: '0 0 8px' }}>橫軸：本益比在歷史區間的位置（越右越貴）／縱軸：預估EPS成長率（越上越高）</p>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 15, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis type="number" dataKey="pos" domain={[0, 100]} tickFormatter={v => `${fmt2(v)}%`} tick={{ fontSize: 11 }} />
          <YAxis type="number" dataKey="growth" domain={[-maxAbsGrowth, maxAbsGrowth]} tickFormatter={v => `${fmt2(v)}%`} tick={{ fontSize: 11 }} width={46} />
          <ReferenceLine x={50} stroke="var(--border)" strokeDasharray="4 4" />
          <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 4" />
          <Tooltip content={({ active, payload }) => {
            if (!active || !payload || !payload.length) return null;
            const p = payload[0].payload;
            return (
              <div className="tsp-card" style={{ padding: '6px 10px', fontSize: 12 }}>
                <b>{p.name} <span className="tsp-muted" style={{ fontWeight: 'normal' }}>{p.symbol}</span></b>
                <div>本益比位置：{fmt2(p.pos)}%</div>
                <div>EPS成長：{p.growth > 0 ? '+' : ''}{fmt2(p.growth)}%</div>
              </div>
            );
          }} />
          <Scatter data={points} shape={(props) => <DavisDot {...props} showLabels={showLabels} />} />
        </ScatterChart>
      </ResponsiveContainer>
      {!showLabels && <p className="tsp-hint" style={{ marginTop: 4 }}>💡 股票較多時已先隱藏名稱標籤，把游標移到點上（手機請點一下）即可看是哪一檔。</p>}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span className="tsp-up">↖ 左上：潛在雙擊</span>
        <span className="tsp-warn">留意雙殺：右下 ↘</span>
      </div>
    </div>
  );
}

function computeDavisSignal(w) {
  const hasBand = w.peLow != null && w.peHigh != null && w.currentPE != null && Number(w.peHigh) > Number(w.peLow);
  const pos = hasBand ? Math.max(0, Math.min(100, ((Number(w.currentPE) - Number(w.peLow)) / (Number(w.peHigh) - Number(w.peLow))) * 100)) : null;
  const growth = w.epsGrowth != null ? Number(w.epsGrowth) : null;

  let label = null, tone = '';
  if (growth != null) {
    if (growth > 0 && (pos == null || pos < 50)) { label = '潛在雙擊：獲利成長＋評價偏低'; tone = 'tsp-up-bg tsp-up'; }
    else if (growth > 0 && pos >= 50) { label = '獲利成長，評價已回升'; tone = 'tsp-up-bg tsp-up'; }
    else if (growth < 0 && (pos == null || pos >= 50)) { label = '留意雙殺：獲利轉弱但評價仍高'; tone = 'tsp-warn-bg tsp-warn'; }
    else if (growth < 0 && pos < 50) { label = '獲利轉弱，評價已修正'; tone = 'tsp-down-bg tsp-down'; }
  }
  return { pos, growth, label, tone };
}

function PEGauge({ low, high, current }) {
  const pos = Math.max(0, Math.min(100, ((Number(current) - Number(low)) / (Number(high) - Number(low))) * 100));
  return (
    <div style={{ width: 90 }}>
      <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'linear-gradient(90deg, var(--down-bg), var(--warn-bg), var(--up-bg))' }}>
        <div style={{ position: 'absolute', top: -3, left: `calc(${pos}% - 4px)`, width: 8, height: 12, borderRadius: 2, background: 'var(--text)' }} />
      </div>
      <div className="tsp-hint" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 10 }}>
        <span>{fmt2(low)}</span><span className="tsp-mono">{fmt2(current)}x</span><span>{fmt2(high)}</span>
      </div>
    </div>
  );
}

function WatchlistPanel({ watchlists, prices, onEdit, onDelete, onAdd, safeNameStr }) {
  return (
    <div className="tsp-watchlist-view">
      <DavisQuadrantChart items={watchlists} title="觀察名單 戴維斯雙擊象限總覽" />
      <div className="tsp-stats-grid" style={{ marginBottom: 16 }}>
        <div className="tsp-card tsp-stat" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={onAdd}>
          <Eye size={24} className="tsp-primary" style={{ marginBottom: 8 }} />
          <span className="tsp-stat-label">新增預想觀察股票</span>
        </div>
      </div>
      <div className="tsp-card tsp-table-wrap">
        <table className="tsp-table">
          <thead>
            <tr>
              <th>標的</th><th className="tsp-right">最新現價</th><th className="tsp-right">目標進場價</th><th>狀態</th><th>本益比河流 / 戴維斯訊號</th><th>觀察筆記</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            {watchlists.length === 0 && <tr><td colSpan={7}><Empty text="尚無觀察名單。加入想買的股票，系統會自動追蹤報價與進場時機！" /></td></tr>}
            {watchlists.map(w => {
              const current = prices[w.symbol]?.current;
              const isHit = current && w.targetPrice && current <= Number(w.targetPrice);
              const signal = computeDavisSignal(w);
              return (
                <tr key={w.id} className="tsp-clickable-row" onClick={() => onEdit(w)}>
                  <td><b>{w.symbol}</b> <span className="tsp-muted">{safeNameStr(w.name)}</span></td>
                  <td className="tsp-right tsp-mono">{current ? fmtPrice(current) : '-'}</td>
                  <td className="tsp-right tsp-mono">{w.targetPrice ? fmtPrice(w.targetPrice) : '-'}</td>
                  <td>
                    {isHit ? <span className="tsp-badge tsp-up-bg tsp-up">✅ 可進場</span> : (current ? <span className="tsp-badge" style={{background:'var(--panel-2)', color:'var(--muted)'}}>觀望中</span> : '-')}
                  </td>
                  <td>
                    {signal.pos != null ? <PEGauge low={w.peLow} high={w.peHigh} current={w.currentPE} /> : <span className="tsp-muted">-</span>}
                    {signal.growth != null && <div className="tsp-hint" style={{ marginTop: 2 }}>預估EPS成長 {signal.growth > 0 ? '+' : ''}{fmt2(signal.growth)}%</div>}
                    {signal.label && <span className={`tsp-badge ${signal.tone}`} style={{ marginTop: 4, display: 'inline-block' }}>{signal.label}</span>}
                  </td>
                  <td className="tsp-muted">{w.note || '-'}</td>
                  <td onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <button className="tsp-icon-btn tsp-danger" onClick={() => { if(window.confirm('確定刪除此觀察名單？')) onDelete(w.id); }}><Trash2 size={16} /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {watchlists.some(w => w.currentPE != null || w.epsGrowth != null) && (
        <>
          <p className="tsp-hint" style={{ marginTop: 8, textAlign: 'center' }}>
            ⚠️ 本益比河流與戴維斯訊號僅供輔助參考，非投資建議，實際進出場請自行判斷。
          </p>
          <DavisLegend />
        </>
      )}
    </div>
  );
}

function Monthly({ monthly, safeNameStr }) {
  const [detailMonth, setDetailMonth] = useState(null);
  if (!monthly.length) return <Empty text="尚無月度統整資料" />;
  const m = detailMonth ? monthly.find(x => x.month === detailMonth) : null;
  const netFlow = m ? (m.sellAmt - m.buyAmt + m.dividend) : 0;
  return (
    <div className="tsp-card tsp-table-wrap">
      <table className="tsp-table">
        <thead><tr><th>月份</th><th className="tsp-right">交易次數</th><th className="tsp-right">買入總額</th><th className="tsp-right">賣出總額</th><th className="tsp-right">已實現損益</th><th className="tsp-right">領取股利</th><th className="tsp-right">月度淨現金流</th><th></th></tr></thead>
        <tbody>
          {monthly.map(mo => {
            const nf = mo.sellAmt - mo.buyAmt + mo.dividend;
            return (
              <tr key={mo.month} className="tsp-clickable-row" onClick={() => setDetailMonth(mo.month)}>
                <td className="tsp-mono"><b>{mo.month}</b></td><td className="tsp-right tsp-mono">{mo.count}</td><td className="tsp-right tsp-mono">{fmtInt(mo.buyAmt)}</td><td className="tsp-right tsp-mono">{fmtInt(mo.sellAmt)}</td>
                <td className={`tsp-right tsp-mono ${changeCls(mo.realizedPL)}`}>{mo.realizedPL > 0 ? '+' : ''}{fmtInt(mo.realizedPL)}</td><td className="tsp-right tsp-mono tsp-up">{mo.dividend > 0 ? `+${fmtInt(mo.dividend)}` : 0}</td>
                <td className={`tsp-right tsp-mono ${changeCls(nf)}`}>{nf > 0 ? '+' : ''}{fmtInt(nf)}</td>
                <td className="tsp-right"><ChevronDown size={16} className="tsp-muted" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {m && (
      <ModalPortal>
        <div className="tsp-modal-backdrop" onClick={() => setDetailMonth(null)}>
          <div className="tsp-modal" onClick={e => e.stopPropagation()}>
            <div className="tsp-modal-head">
              <h3>📅 {m.month} 資金與交易明細</h3>
              <button type="button" className="tsp-icon-btn" onClick={() => setDetailMonth(null)}><X size={18} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div className="tsp-data-card" style={{ marginBottom: 16 }}>
                <div className="tsp-data-card-row"><span>交易次數</span><span>{m.count}</span></div>
                <div className="tsp-data-card-row"><span>買入總額</span><span>{fmtInt(m.buyAmt)}</span></div>
                <div className="tsp-data-card-row"><span>賣出總額</span><span>{fmtInt(m.sellAmt)}</span></div>
                <div className="tsp-data-card-row"><span>已實現損益</span><span className={changeCls(m.realizedPL)}>{m.realizedPL > 0 ? '+' : ''}{fmtInt(m.realizedPL)}</span></div>
                <div className="tsp-data-card-row"><span>領取股利</span><span className="tsp-up">{m.dividend > 0 ? `+${fmtInt(m.dividend)}` : 0}</span></div>
                <div className="tsp-data-card-row"><span>月度淨現金流</span><span className={changeCls(netFlow)}>{netFlow > 0 ? '+' : ''}{fmtInt(netFlow)}</span></div>
              </div>
              <p className="tsp-hint" style={{ margin: '0 0 8px' }}>交易與資金明細</p>
              {m.events.map((e, i) => (
                <div key={i} className="tsp-data-subcard">
                  <div className="tsp-data-card-row">
                    <span className="tsp-mono">{e.date}</span>
                    <span>{e.isCash ? (<span className={`tsp-badge ${e.type === 'deposit' ? 'tsp-up-bg tsp-up' : 'tsp-down-bg tsp-down'}`}>{e.type === 'deposit' ? '入金' : '出金'}</span>) : e.isDiv ? (<span className="tsp-badge tsp-up-bg tsp-up">領息</span>) : e.type === 'buy' ? (<span className="tsp-badge tsp-up-bg tsp-up">買進</span>) : (<span className="tsp-badge tsp-down-bg tsp-down">賣出</span>)}</span>
                  </div>
                  <div className="tsp-data-card-row"><span>{e.isCash ? (e.note || '資金變動') : `${e.symbol} ${safeNameStr(e.name)}`}</span><span>{e.isCash ? '-' : `${fmtInt(e.shares)} 股`}</span></div>
                  <div className="tsp-data-card-row">
                    <span>淨收付金額</span>
                    <span>{e.isCash ? (<span className={e.type === 'deposit' ? 'tsp-up' : 'tsp-down'}>{e.type === 'deposit' ? '+' : '-'}{fmtInt(e.amount)}</span>) : e.isDiv ? (<span className="tsp-up">+{fmtInt(e.totalCash)}</span>) : e.type === 'buy' ? (<span className="tsp-down">-{fmtInt(e.shares * e.price + (e.fee||0) + (e.tax||0))}</span>) : (<span className="tsp-up">+{fmtInt(e.shares * e.price - (e.fee||0) - (e.tax||0))}</span>)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </div>
  );
}

function Compare({ data, safeNameStr }) {
  const [detailOwner, setDetailOwner] = useState(null);
  if (data.length <= 1) return <Empty text="需有多個持有者才能進行比較。" />;
  const sorted = [...data].sort((a, b) => b.marketValue - a.marketValue);
  const d = detailOwner ? sorted.find(x => x.owner === detailOwner) : null;
  const dUplPct = d && d.cost > 0 ? (d.upl / d.cost) * 100 : 0;
  return (
    <div className="tsp-card tsp-table-wrap">
      <table className="tsp-table">
        <thead><tr><th>持有者</th><th className="tsp-right">持股檔數</th><th className="tsp-right">持股市值</th><th className="tsp-right">戶頭現金</th><th className="tsp-right">總資產</th><th className="tsp-right">總成本</th><th className="tsp-right">未實現損益</th><th className="tsp-right">已實現損益</th></tr></thead>
        <tbody>
          {sorted.map(row => {
            const uplPct = row.cost > 0 ? (row.upl / row.cost) * 100 : 0;
            return (
              <tr key={row.owner} className="tsp-clickable-row" onClick={() => setDetailOwner(row.owner)}>
                <td><Tag text={row.owner} /></td><td className="tsp-right tsp-mono">{row.holdingCount}</td><td className="tsp-right tsp-mono">{fmtInt(row.marketValue)}</td><td className="tsp-right tsp-mono">{fmtInt(row.cash)}</td><td className="tsp-right tsp-mono tsp-primary" style={{fontWeight: 'bold'}}>{fmtInt(row.marketValue + row.cash)}</td><td className="tsp-right tsp-mono">{fmtInt(row.cost)}</td>
                <td className={`tsp-right tsp-mono ${changeCls(row.upl)}`}><div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end'}}><div>{row.upl > 0 ? '+' : ''}{fmtInt(row.upl)}</div><div style={{ fontSize: 12 }}>{pct(uplPct)}</div></div></td>
                <td className={`tsp-right tsp-mono ${changeCls(row.realized)}`}>{row.realized > 0 ? '+' : ''}{fmtInt(row.realized)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {d && (
      <ModalPortal>
        <div className="tsp-modal-backdrop" onClick={() => setDetailOwner(null)}>
          <div className="tsp-modal" onClick={e => e.stopPropagation()}>
            <div className="tsp-modal-head">
              <h3><Tag text={d.owner} /> 持有明細</h3>
              <button type="button" className="tsp-icon-btn" onClick={() => setDetailOwner(null)}><X size={18} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div className="tsp-data-card">
                <div className="tsp-data-card-row"><span>持股檔數</span><span>{d.holdingCount}</span></div>
                <div className="tsp-data-card-row"><span>持股市值</span><span>{fmtInt(d.marketValue)}</span></div>
                <div className="tsp-data-card-row"><span>戶頭現金</span><span>{fmtInt(d.cash)}</span></div>
                <div className="tsp-data-card-row"><span>總資產</span><span className="tsp-primary" style={{ fontWeight: 'bold' }}>{fmtInt(d.marketValue + d.cash)}</span></div>
                <div className="tsp-data-card-row"><span>總成本</span><span>{fmtInt(d.cost)}</span></div>
                <div className="tsp-data-card-row"><span>未實現損益</span><span className={changeCls(d.upl)}>{d.upl > 0 ? '+' : ''}{fmtInt(d.upl)}（{pct(dUplPct)}）</span></div>
                <div className="tsp-data-card-row"><span>已實現損益</span><span className={changeCls(d.realized)}>{d.realized > 0 ? '+' : ''}{fmtInt(d.realized)}</span></div>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </div>
  );
}

const CSS = `
:root {
  --bg: #f3f4f6; --panel: #ffffff; --panel-2: #f9fafb; --text: #1f2937; --muted: #6b7280; --border: #e5e7eb;
  --primary: #3b82f6; --primary-hover: #2563eb; --up: #ef4444; --down: #10b981;
  --up-bg: #fee2e2; --down-bg: #d1fae5; --warn: #f59e0b; --warn-bg: #fef3c7;
  --radius: 12px; --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #111827; --panel: #1f2937; --panel-2: #374151; --text: #f9fafb; --muted: #9ca3af; --border: #374151;
    --primary: #3b82f6; --up: #f87171; --down: #34d399; --up-bg: rgba(248, 113, 113, 0.2); --down-bg: rgba(52, 211, 153, 0.2);
    --warn: #fbbf24; --warn-bg: rgba(251, 191, 36, 0.15); --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
  }
}
.tsp-app { font-family: system-ui, -apple-system, sans-serif; background-color: var(--bg); color: var(--text); min-height: 100vh; box-sizing: border-box; }
.tsp-app * { box-sizing: inherit; }
.tsp-mono { font-family: var(--font-mono); } .tsp-muted { color: var(--muted); } .tsp-up { color: var(--up); } .tsp-down { color: var(--down); }
.tsp-flat { color: var(--muted); } .tsp-warn { color: var(--warn); } .tsp-up-bg { background-color: var(--up-bg); color: var(--up); }
.tsp-down-bg { background-color: var(--down-bg); color: var(--down); } .tsp-warn-bg { background-color: var(--warn-bg); color: var(--warn); border: 1px solid rgba(245, 158, 11, 0.3); }
.tsp-primary { color: var(--primary); } .tsp-danger { color: #ef4444; }
.tsp-ticker { background: var(--panel-2); border-bottom: 1px solid var(--border); overflow: hidden; white-space: nowrap; padding: 6px 0; font-size: 13px; }
.tsp-ticker-track { display: inline-block; animation: tsp-scroll 30s linear infinite; }
.tsp-ticker-track:hover { animation-play-state: paused; } .tsp-ticker-item { margin-right: 32px; }
@keyframes tsp-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
.tsp-header { display: flex; justify-content: space-between; align-items: center; padding: 24px 24px 16px 24px; max-width: 1200px; margin: 0 auto; }
.tsp-brand { display: flex; align-items: center; gap: 16px; }
.tsp-brand-mark { background: var(--primary); color: white; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; }
.tsp-brand h1 { margin: 0; font-size: 22px; font-weight: 700; } .tsp-brand p { margin: 4px 0 0; font-size: 13px; color: var(--muted); }
.tsp-header-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: flex-end; position: relative; z-index: 30; }
.tsp-owner-select { position: relative; display: flex; align-items: center; gap: 8px; background: var(--panel); padding: 4px 12px; border-radius: 20px; border: 1px solid var(--border); }
.tsp-owner-form { position: absolute; top: 100%; right: 0; margin-top: 8px; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 8px; display: flex; gap: 8px; box-shadow: var(--shadow); z-index: 30; }
.tsp-tabs { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; max-width: 1200px; margin: 0 auto; padding: 0 16px 16px 16px; position: relative; z-index: 20; }
.tsp-tab { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; font-size: 14px; color: var(--muted); font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; flex: 1 1 calc(33.333% - 12px); text-align: center; }
.tsp-tab:hover { color: var(--text); border-color: var(--muted); } .tsp-tab.active { background: var(--primary); color: white; border-color: var(--primary); }
.tsp-main { max-width: 1200px; margin: 0 auto; padding: 0 24px 64px; }
@keyframes tspFadeIn { 0% { opacity: 0; transform: translateX(10px); } 100% { opacity: 1; transform: translateX(0); } }
.tsp-btn { display: flex; align-items: center; gap: 6px; padding: 8px 16px; font-size: 14px; font-weight: 600; border-radius: 8px; border: 1px solid var(--border); background: var(--panel); color: var(--text); cursor: pointer; transition: all 0.2s; min-height: 38px; }
.tsp-btn:hover { background: var(--panel-2); } .tsp-btn-primary { background: var(--primary); color: white; border-color: var(--primary); } .tsp-btn-primary:hover { background: var(--primary-hover); }
.tsp-icon-btn { background: transparent; border: none; color: var(--muted); cursor: pointer; padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: 0.2s; min-height: 38px; min-width: 38px; }
.tsp-icon-btn:hover { background: var(--panel-2); color: var(--text); }
.tsp-input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--panel); color: var(--text); font-size: 14px; transition: border-color 0.2s; min-height: 38px; }
.tsp-input:focus { outline: none; border-color: var(--primary); } .tsp-input-sm { padding: 6px 10px; font-size: 13px; }
.tsp-select { appearance: none; padding-right: 30px; cursor: pointer; background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e"); background-repeat: no-repeat; background-position: right 8px center; background-size: 16px; }
.tsp-card { background: var(--panel); border-radius: var(--radius); border: 1px solid var(--border); box-shadow: var(--shadow); overflow: hidden; }
.tsp-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
.tsp-stat { padding: 20px; display: flex; flex-direction: column; gap: 4px; } .tsp-stat-label { font-size: 13px; color: var(--muted); font-weight: 600; } .tsp-stat-value { font-size: 24px; font-weight: 700; } .tsp-stat-sub { font-size: 13px; }
.tsp-dashboard-bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; } @media(max-width: 768px) { .tsp-dashboard-bottom { grid-template-columns: 1fr; } }
.tsp-panel { padding: 20px; } .tsp-panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; } .tsp-panel-head h3 { margin: 0; font-size: 16px; }
.tsp-toggle-group { display: flex; background: var(--panel-2); border-radius: 8px; padding: 4px; } .tsp-toggle-group button { background: transparent; border: none; padding: 6px 12px; font-size: 13px; font-weight: 600; color: var(--muted); border-radius: 6px; cursor: pointer; transition: 0.2s; min-height: 30px; } .tsp-toggle-group button.active { background: var(--panel); color: var(--text); box-shadow: 0 1px 2px rgb(0 0 0 / 0.1); }
.tsp-table-wrap { overflow-x: auto; width: 100%; box-sizing: border-box; padding-bottom: 8px; -webkit-overflow-scrolling: touch; } .tsp-table { width: 100%; min-width: 1050px; border-collapse: separate; border-spacing: 0; text-align: left; font-size: 14px; } .tsp-table th { background: var(--panel-2); padding: 12px 14px; font-weight: 600; color: var(--muted); border-bottom: 1px solid var(--border); white-space: nowrap; } .tsp-table td { padding: 12px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; white-space: nowrap; background: var(--panel); } .tsp-table tr:last-child td { border-bottom: none; } .tsp-table tbody tr { transition: background 0.2s; } .tsp-table tbody tr:nth-child(even) td { background: var(--panel-2); } .tsp-table tbody tr.tsp-row-warn td { background: rgba(239, 68, 68, 0.06); } .tsp-clickable-row:hover td, .tsp-row-hover:hover td { background: var(--border) !important; } .tsp-clickable-row { cursor: pointer; } .tsp-right { text-align: right; } .tsp-row-warn { background: rgba(239, 68, 68, 0.05) !important; }
.tsp-card-list { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
.tsp-data-card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
.tsp-data-subcard { background: var(--panel-2); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
.tsp-data-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-weight: bold; font-size: 15px; }
.tsp-data-card-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 6px 0; font-size: 13px; border-top: 1px dashed var(--border); }
.tsp-data-card-row:first-of-type { border-top: none; padding-top: 0; }
.tsp-data-card-row > span:first-child { color: var(--muted); flex-shrink: 0; }
.tsp-data-card-row > span:last-child { font-family: var(--font-mono); text-align: right; }
.tsp-table th:first-child, .tsp-table td:first-child { position: sticky; left: 0; z-index: 2; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.15); }
.tsp-table th:first-child { z-index: 3; }
.th-category { min-width: 150px; } .th-alerts { min-width: 200px; }
@media (max-width: 768px) { .tsp-header { flex-direction: column; align-items: stretch; gap: 16px; margin-bottom: 12px; } .tsp-header-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; } .tsp-header-actions > .tsp-owner-select { grid-column: 1 / -1; } .tsp-btn { justify-content: center; padding: 10px; } .tsp-filters { flex-direction: column; align-items: stretch !important; gap: 12px; } .tsp-filters > div, .tsp-filters select { width: 100%; max-width: 100%; } }
.tsp-symbol { font-weight: 700; font-size: 15px; } .tsp-name { font-size: 12px; white-space: normal; min-width: 80px; } .tsp-price-input { display: flex; align-items: center; gap: 4px; justify-content: flex-end; } .tsp-price-input input { width: 80px; text-align: right; } .tsp-meta-inputs { display: flex; flex-direction: column; gap: 6px; } .tsp-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
.tsp-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(2px); padding: 16px; } .tsp-modal { background: var(--panel); border-radius: var(--radius); width: 100%; max-width: 500px; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1); max-height: 90vh; overflow-y: auto; } .tsp-modal-head { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid var(--border); } .tsp-modal-head h3 { margin: 0; font-size: 18px; } .tsp-form { padding: 20px; display: flex; flex-direction: column; gap: 16px; } .tsp-form label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--muted); } .tsp-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; } .tsp-textarea { resize: vertical; min-height: 120px; font-family: var(--font-mono); } .tsp-form-submit { margin-top: 8px; justify-content: center; padding: 12px; } .tsp-hint { font-size: 13px; color: var(--muted); margin: 0; line-height: 1.5; }
.tsp-type-toggle { display: flex; gap: 8px; margin-bottom: 8px; } .tsp-type-toggle button { flex: 1; padding: 12px; border: 2px solid var(--border); background: transparent; border-radius: 8px; font-weight: bold; cursor: pointer; color: var(--muted); transition: 0.2s; } .tsp-type-toggle button.active { border-color: currentColor; }
.tsp-empty { padding: 48px 24px; text-align: center; color: var(--muted); font-size: 15px; } .tsp-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: var(--muted); height: 100vh; font-size: 16px; font-weight: bold; } .tsp-spin { animation: tsp-spin 1s linear infinite; } @keyframes tsp-spin { 100% { transform: rotate(360deg); } } .tsp-toast { position: fixed; bottom: 24px; right: 24px; background: var(--primary); color: white; padding: 12px 24px; border-radius: 8px; box-shadow: var(--shadow); z-index: 1000; animation: tsp-slide-up 0.3s ease-out; font-weight: bold; letter-spacing: 0.5px; } @keyframes tsp-slide-up { 0% { transform: translateY(100%); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
.tsp-back-to-top { position: fixed; bottom: 24px; left: 24px; width: 46px; height: 46px; border-radius: 50%; background: var(--primary); color: white; border: none; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow); cursor: pointer; z-index: 999; transition: transform 0.15s, background 0.15s; } .tsp-back-to-top:hover { background: var(--primary-hover); transform: translateY(-2px); }
.tsp-pie-wrap { display: flex; flex-direction: column; align-items: center; } .tsp-legend { width: 100%; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; margin-top: 16px; } .tsp-legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; } .tsp-dot { width: 10px; height: 10px; border-radius: 50%; }
.tsp-alerts-list { display: flex; flex-direction: column; gap: 12px; } .tsp-alert-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; }
.tsp-filters { padding: 16px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border); background: var(--panel-2); flex-wrap: wrap; } .tsp-filters select { width: 160px; }

/* 禁用數字輸入框的預設滾輪與箭頭 (防止數值亂跳) */
input[type=number]::-webkit-inner-spin-button, 
input[type=number]::-webkit-outer-spin-button { 
  -webkit-appearance: none; 
  margin: 0; 
}
input[type=number] {
  -moz-appearance: textfield;
}
`;