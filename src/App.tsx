import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, Legend, ReferenceLine
} from 'recharts';
import {
  Plus, Trash2, Save, X, RefreshCw, AlertTriangle, Users, UserPlus,
  Upload, Download, FileUp, Bell, Coins, TrendingUp, TrendingDown, CheckCircle2, Zap, Search, Pencil, Calculator, Activity, Cloud, ChevronDown, ChevronUp, Mail, LogOut, Wallet, Wand2
} from 'lucide-react';

// --- Firebase Cloud Storage Setup ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

let app, auth, db, appId;
try {
const firebaseConfig = {
  apiKey: "AIzaSyACwAj7n2SzBYLyLuu2AYR5aj2ba0XyTBQ",
  authDomain: "eve-fish.firebaseapp.com",
  projectId: "eve-fish",
  storageBucket: "eve-fish.firebasestorage.app",
  messagingSenderId: "44805669387",
  appId: "1:44805669387:web:873d6fcfe19f0c3a137d0e",
  measurementId: "G-Y6TMKK16RQ"
};
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
} catch (error) {
  console.error("Firebase init error", error);
}

const PALETTE = ['#C9A227', '#4C7EA8', '#9B6FB0', '#D98E3B', '#5FB3B3', '#B0555F', '#7C9473', '#8D6CAB'];
const DEFAULT_SECTORS = ['半導體', '電腦及週邊設備', '電子零組件', '光電', '通信網路', '電子通路', '資訊服務', '其他電子', '金融保險', '航運', '生技醫療', '傳統產業', '民生消費', '能源', 'ETF', '其他'];
const DEFAULT_STRATEGIES = ['長期存股', '中短線交易', '波段操作', '當沖', '退休金'];
const NEAR_PCT = 0.03;

// 基本熱門庫 
const DEFAULT_STOCK_MAP = {
  "2330": "台積電", "2317": "鴻海", "2454": "聯發科", "2308": "台達電", "2382": "廣達",
  "2881": "富邦金", "2882": "國泰金", "2891": "中信金", "2886": "兆豐金", "2002": "中鋼",
  "2603": "長榮", "2609": "陽明", "2615": "萬海", "3231": "緯創", "2356": "英業達",
  "0050": "元大台灣50", "0056": "元大高股息", "00878": "國泰永續高股息", "00929": "復華台灣科技優息", "00919": "群益台灣精選高息"
};
const DEFAULT_NAME_MAP = Object.fromEntries(Object.entries(DEFAULT_STOCK_MAP).map(([k, v]) => [v, k]));

const todayStr = () => new Date().toISOString().slice(0, 10);

// 格式化函式
const cleanNum = (n) => Math.round(n * 10000) / 10000;
const fmtInt = (n) => new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const fmt2 = (n) => new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(cleanNum(n || 0));
const money = (n) => 'NT$ ' + fmtInt(n);
const pct = (n) => (n > 0 ? '+' : '') + fmt2(n) + '%';
const changeCls = (n) => (n > 0 ? 'tsp-up' : n < 0 ? 'tsp-down' : 'tsp-flat');
const arrow = (n) => (n > 0 ? '▲' : n < 0 ? '▼' : '—');

function copyToClipboard(text) {
  const el = document.createElement('textarea');
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

function getColorHash(str) {
  if (!str || str === '未分類') return { bg: 'transparent', text: 'var(--muted)', border: 'var(--border)' };
  const colors = [
    { bg: '#fee2e2', text: '#ef4444', border: '#fca5a5' },
    { bg: '#d1fae5', text: '#059669', border: '#6ee7b7' },
    { bg: '#e0e7ff', text: '#4f46e5', border: '#a5b4fc' },
    { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' },
    { bg: '#fae8ff', text: '#c026d3', border: '#f0abfc' },
    { bg: '#ccfbf1', text: '#0d9488', border: '#5eead4' },
    { bg: '#e2e8f0', text: '#475569', border: '#cbd5e1' },
    { bg: '#ffedd5', text: '#ea580c', border: '#fdba74' },
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function Tag({ text }) {
  if (!text) return null;
  const { bg, text: c, border } = getColorHash(text);
  return (
    <span style={{ backgroundColor: bg, color: c, border: `1px solid ${border}`, padding: '2px 6px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', display: 'inline-block' }}>
      {text}
    </span>
  );
}

// 核心計算 (加入 tax 的計算)
function computePortfolio(transactions) {
  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date) || a.id - b.id);
  const state = {};
  const realizedEvents = [];
  
  for (const t of sorted) {
    if (!state[t.symbol]) state[t.symbol] = { shares: 0, totalCost: 0, name: t.name };
    const s = state[t.symbol];
    if (t.name) s.name = t.name;
    
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

function buildHoldings(state, prices, meta, dividendBySymbol) {
  return Object.entries(state)
    .filter(([, h]) => h.shares > 0)
    .map(([symbol, h]) => {
      const current = prices[symbol]?.current ?? h.avgCost;
      const marketValue = cleanNum(current * h.shares);
      const cost = cleanNum(h.totalCost); 
      const upl = cleanNum(marketValue - cost);
      const uplPct = cost > 0 ? cleanNum((upl / cost) * 100) : 0;
      const m = meta[symbol] || {};
      const stopLoss = m.stopLoss ?? null;
      const targetPrice = m.targetPrice ?? null;
      const isStopHit = stopLoss != null && current <= Number(stopLoss);
      const isStopNear = !isStopHit && stopLoss != null && current <= Number(stopLoss) * (1 + NEAR_PCT);
      const isTargetHit = targetPrice != null && current >= Number(targetPrice);
      const isTargetNear = !isTargetHit && targetPrice != null && current >= Number(targetPrice) * (1 - NEAR_PCT);
      const dividendTotal = (dividendBySymbol && dividendBySymbol[symbol]) || 0;
      const dividendYield = cost > 0 ? cleanNum((dividendTotal / cost) * 100) : 0;
      
      return {
        symbol, name: h.name, shares: h.shares, avgCost: h.avgCost, current, marketValue, cost, upl, uplPct,
        sector: m.sector || '', strategy: m.strategy || '', stopLoss, targetPrice, note: m.note || '',
        isStopHit, isStopNear, isTargetHit, isTargetNear, isWarning: isStopHit,
        dividendTotal, dividendYield,
      };
    })
    .sort((a, b) => b.marketValue - a.marketValue);
}

function groupHoldings(holdings, meta, mode) {
  if (mode === 'symbol') return holdings.map(h => ({ name: `${h.symbol} ${h.name}`, value: h.marketValue }));
  const map = {};
  holdings.forEach(h => {
    let key;
    if (mode === 'sector') key = meta[h.symbol]?.sector || '未分類';
    else key = meta[h.symbol]?.strategy || '未分類';
    map[key] = (map[key] || 0) + h.marketValue;
  });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

function dividendsBySymbol(dividends) {
  const map = {};
  for (const d of dividends) map[d.symbol] = (map[d.symbol] || 0) + Number(d.totalCash || 0);
  return map;
}

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

  const [selectedOwner, setSelectedOwner] = useState('all');
  const [showOwnerForm, setShowOwnerForm] = useState(false);
  const [ownerInput, setOwnerInput] = useState('');
  const [tab, setTab] = useState('dashboard');
  
  // Modals
  const [showForm, setShowForm] = useState(false);
  const [showCashForm, setShowCashForm] = useState(false); 
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [showDividendForm, setShowDividendForm] = useState(false);
  
  const [chartSymbol, setChartSymbol] = useState(null);
  const [priceDraft, setPriceDraft] = useState({});
  
  const [editingTxnId, setEditingTxnId] = useState(null);
  const [editingDivId, setEditingDivId] = useState(null);
  const [editingCashId, setEditingCashId] = useState(null);

  const [groupMode, setGroupMode] = useState('symbol');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({ date: todayStr(), symbol: '', name: '', type: 'buy', shares: '', price: '', fee: '', tax: '', owner: '我', note: '' });
  const [divForm, setDivForm] = useState({ date: todayStr(), symbol: '', name: '', shares: '', cashPerShare: '', stockPerShare: '', owner: '我', note: '' });
  const [cashForm, setCashForm] = useState({ date: todayStr(), type: 'deposit', amount: '', owner: '我', note: '' });

  const [toastMsg, setToastMsg] = useState('');
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  const [isLookingUpName, setIsLookingUpName] = useState(false);
  
  const [cloudModal, setCloudModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);

  const [officialMapCache, setOfficialMapCache] = useState({}); 

  // --- 觸控滑動狀態 ---
  const [touchStartPos, setTouchStartPos] = useState(null);

  const activeTabsList = useMemo(() => {
    const list = [
      { id: 'dashboard', label: '總覽' },
      { id: 'holdings', label: '持股' },
      { id: 'txns', label: '交易紀錄' },
      { id: 'dividends', label: '股利' },
      { id: 'cash', label: '現金明細' }, 
      { id: 'charts', label: '圖表' },
      { id: 'monthly', label: '月度統整' },
    ];
    if (owners.length > 1) list.push({ id: 'compare', label: '持有者比較' });
    return list;
  }, [owners.length]);

  function showToast(msg) { setToastMsg(msg); setTimeout(() => setToastMsg(''), 4000); }

  useEffect(() => {
    const fetchOfficialData = async () => {
      const map = {};
      try {
        // 🚀 核心修正：升級為 2026 證交所全新不塞車的收盤 Open Data 清單 API
        const [twseRes, tpexRes] = await Promise.all([
          fetch('https://openapi.twse.com.tw/v1/opendata/t187ap03_L').catch(() => null),
          fetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes').catch(() => null)
        ]);
        if (twseRes?.ok) {
          const data = await twseRes.json();
          data.forEach(d => { 
            if (d.stock_id) map[d.stock_id] = { name: d.stock_name, price: Number(d.closing_price) }; 
          });
        }
        if (tpexRes?.ok) {
          const data = await tpexRes.json();
          data.forEach(d => { 
            if (d.SecuritiesCompanyCode) map[d.SecuritiesCompanyCode] = { name: d.CompanyName, price: Number(d.Close || d.ClosingPrice) }; 
          });
        }
        setOfficialMapCache(map);
      } catch (e) {
        console.error("加載官方總表失敗", e);
      }
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

    const savedUser = localStorage.getItem('eveMoneyUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setIsCloudReady(true);
    }

    const unsubscribe = onAuthStateChanged(auth, u => {
      setUser(u);
      setIsCloudReady(!!u);
      if (u) {
        localStorage.setItem('eveMoneyUser', JSON.stringify({ uid: u.uid, email: u.email }));
      } else {
        localStorage.removeItem('eveMoneyUser');
      }
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
        setTransactions(data.transactions || []);
        setCashTransactions(data.cashTransactions || []); 
        setPrices(data.prices || {});
        setMeta(data.meta || {});
        setDividends(data.dividends || []);
        setOwners(data.owners || ['我']);
      } else {
        setTransactions([]);
        setCashTransactions([]);
        setPrices({});
        setMeta({});
        setDividends([]);
        setOwners(['我']);
      }
      setLoading(false);
    }, (err) => {
      showToast('雲端同步發生錯誤');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, roomCode]);

  async function syncToCloud(payload) {
    if (!user || !db) return;
    const docRef = roomCode
      ? doc(db, 'artifacts', appId, 'public', 'data', 'portfolios', roomCode)
      : doc(db, 'artifacts', appId, 'users', user.uid, 'portfolios', 'default');
    try {
      await setDoc(docRef, payload, { merge: true });
    } catch (e) {
      showToast('寫入雲端失敗');
    }
  }

  function persistTxns(next) { setTransactions(next); syncToCloud({ transactions: next }); }
  function persistCash(next) { setCashTransactions(next); syncToCloud({ cashTransactions: next }); }
  function persistPrices(next) { setPrices(next); syncToCloud({ prices: next }); }
  function persistMeta(next) { setMeta(next); syncToCloud({ meta: next }); }
  function persistOwners(next) { setOwners(next); syncToCloud({ owners: next }); }
  function persistDividends(next) { setDividends(next); syncToCloud({ dividends: next }); }

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
        await setDoc(newDocRef, { transactions, cashTransactions, prices, meta, dividends, owners }, { merge: true });
        showToast(`✅ 註冊成功！資料已綁定至：${emailInput}`);
        setRoomCode('');
      }
      setCloudModal(false);
    } catch (err) {
      let msg = '認證失敗，請檢查信箱或密碼';
      if (err.code === 'auth/email-already-in-use') msg = '此信箱已被註冊過，請改用登入';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') msg = '帳號或密碼錯誤';
      showToast('❌ ' + msg);
    }
    setLoading(false);
  }

  async function handleLogout() {
    if (!auth) return;
    try {
      await signOut(auth);
      await signInAnonymously(auth);
      setRoomCode('');
      showToast('已登出，返回訪客單機模式');
      setCloudModal(false);
    } catch(e) {}
  }

  async function createSharedRoom() {
    if (!user || !db) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const publicRef = doc(db, 'artifacts', appId, 'public', 'data', 'portfolios', code);
    try {
      await setDoc(publicRef, { transactions, cashTransactions, prices, meta, dividends, owners });
      setRoomCode(code);
      showToast(`已成功建立共用群組：${code}`);
      setCloudModal(false);
    } catch(e) {}
  }

  async function joinSharedRoom(e) {
    e.preventDefault();
    if (!user || !db || !joinCodeInput.trim()) return;
    const code = joinCodeInput.trim().toUpperCase();
    const publicRef = doc(db, 'artifacts', appId, 'public', 'data', 'portfolios', code);
    try {
      const snap = await getDoc(publicRef);
      if (snap.exists()) {
        setRoomCode(code);
        showToast(`成功加入共用群組：${code}`);
        setCloudModal(false);
        setJoinCodeInput('');
      } else {
        showToast('找不到該共用代碼，請確認後再試！');
      }
    } catch(err) {}
  }

  async function fetchStockNameApi(symbol) {
    if(!symbol) return null;
    if (officialMapCache[symbol]?.name) return officialMapCache[symbol].name;
    try {
      const res = await fetch(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo&data_id=${symbol}`);
      const json = await res.json();
      if (json && json.data && json.data.length > 0) return json.data[0].stock_name;
    } catch (e) {}
    return null;
  }

  async function handleSymbolBlur(isDiv = false) {
    const currentSym = isDiv ? divForm.symbol : form.symbol;
    const currentName = isDiv ? divForm.name : form.name;
    const cleanSym = currentSym.trim().toUpperCase();
    
    if (cleanSym.length >= 3 && !currentName) {
      setIsLookingUpName(true);
      const fetchedName = await fetchStockNameApi(cleanSym);
      if (fetchedName) {
        if (isDiv) setDivForm(f => ({ ...f, name: fetchedName }));
        else setForm(f => ({ ...f, name: fetchedName }));
      }
      setIsLookingUpName(false);
    }
  }

  async function autoFetchPrices() {
    if (!allSymbols.length) { showToast('目前沒有股票可以更新，請先新增交易紀錄。'); return; }
    setIsFetchingPrices(true);
    showToast('🚀 啟動極速報價更新...');
    
    const nextPrices = { ...prices };
    const today = todayStr();
    let realtimeCount = 0;
    let fallbackCount = 0;

    const fallbackMap = { ...officialMapCache };
    try {
      const [twseRes, tpexRes] = await Promise.all([
        fetch('https://openapi.twse.com.tw/v1/opendata/t187ap03_L').catch(() => null),
        fetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes').catch(() => null)
      ]);
      if (twseRes?.ok) {
        const data = await twseRes.json();
        data.forEach(d => { if (d.stock_id) fallbackMap[d.stock_id] = Number(d.closing_price); });
      }
      if (tpexRes?.ok) {
        const data = await tpexRes.json();
        data.forEach(d => { if (d.SecuritiesCompanyCode) fallbackMap[d.SecuritiesCompanyCode] = Number(d.Close || d.ClosingPrice); });
      }
    } catch(e) {}

    const fetchPromises = allSymbols.map(async (sym) => {
      let finalPrice = null;
      try {
        const twUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}.TW?range=1d`;
        const twoUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}.TWO?range=1d`;
        
        const tasks = [
          fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(twUrl)}`).then(r => r.json()).then(j => JSON.parse(j.contents).chart.result[0].meta.regularMarketPrice),
          fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(twoUrl)}`).then(r => r.json()).then(j => JSON.parse(j.contents).chart.result[0].meta.regularMarketPrice),
          fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(twUrl)}`).then(r => r.json()).then(j => j.chart.result[0].meta.regularMarketPrice),
          fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(twoUrl)}`).then(r => r.json()).then(j => j.chart.result[0].meta.regularMarketPrice)
        ];
        
        const timeoutTask = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
        finalPrice = await Promise.any([...tasks, timeoutTask]);
      } catch (e) {}

      if (finalPrice) {
        realtimeCount++;
      } else if (fallbackMap[sym]) {
        finalPrice = typeof fallbackMap[sym] === 'object' ? fallbackMap[sym].price : fallbackMap[sym];
        fallbackCount++;
      }

      if (finalPrice) {
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
    
    if (realtimeCount > 0 || fallbackCount > 0) { 
      persistPrices(nextPrices); 
      showToast(`✅ 更新成功！即時報價 ${realtimeCount} 檔，官方備援 ${fallbackCount} 檔。`); 
    } else { 
      showToast('❌ 更新失敗，請檢查網路連線。'); 
    }
    setIsFetchingPrices(false);
  }

  async function handleAtrCalculation(symbol, currentPrice) {
    if (!currentPrice) { showToast('請先確保已有該檔股票的現價，才能計算 ATR。'); return; }
    showToast(`${symbol} 歷史資料抓取與 ATR 計算中...`);
    
    let highs = [], lows = [], closes = [];
    try {
      const d = new Date();
      d.setDate(d.getDate() - 40);
      const start_date = d.toISOString().slice(0,10);
      const res = await fetch(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${symbol}&start_date=${start_date}`);
      const json = await res.json();
      if (json && json.data && json.data.length > 0) {
        highs = json.data.map(i => i.max);
        lows = json.data.map(i => i.min);
        closes = json.data.map(i => i.close);
      }
    } catch(e) {}

    if (closes.length === 0) {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.TW?range=1mo&interval=1d`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(tid);
        if (res.ok) {
          const data = await res.json();
          if (data?.chart?.result?.[0]?.indicators?.quote?.[0]) {
             const quote = data.chart.result[0].indicators.quote[0];
             highs = quote.high; lows = quote.low; closes = quote.close;
          }
        }
      } catch (e) {}
    }

    if (!highs || closes.length < 15) { showToast(`${symbol} 歷史交易日資料不足 14 天，無法計算 ATR。`); return; }

    let trs = [];
    for(let i = 1; i < closes.length; i++) {
      if(highs[i] == null || lows[i] == null || closes[i-1] == null) continue;
      const hl = highs[i] - lows[i];
      const hc = Math.abs(highs[i] - closes[i-1]);
      const lc = Math.abs(lows[i] - closes[i-1]);
      trs.push(Math.max(hl, hc, lc));
    }

    const last14 = trs.slice(-14);
    if(last14.length === 0) return;
    const atr = last14.reduce((a, b) => a + b, 0) / last14.length;
    
    const stopLoss = Math.max(0, currentPrice - (2.0 * atr));
    const stopLossFormatted = cleanNum(Number(stopLoss.toFixed(2)));
    
    updateMeta(symbol, { stopLoss: stopLossFormatted });
    showToast(`✅ ${symbol} ATR(14) 約為 ${atr.toFixed(2)}，防守價已自動設為 ${stopLossFormatted}`);
  }

  const handleTouchStart = (e) => {
    if (e.target.closest('.tsp-table-wrap') || 
        e.target.closest('.recharts-wrapper') || 
        e.target.closest('.tsp-modal') ||
        e.target.closest('input') ||
        e.target.closest('select')) {
      setTouchStartPos(null);
      return;
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
      if (dx > 0 && currentIndex < activeTabsList.length - 1) {
        setTab(activeTabsList[currentIndex + 1].id);
      } else if (dx < 0 && currentIndex > 0) {
        setTab(activeTabsList[currentIndex - 1].id);
      }
    }
    setTouchStartPos(null);
  };

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

  const { state: holdingsState, realizedEvents } = useMemo(() => computePortfolio(filteredTxns), [filteredTxns]);
  const divBySymbol = useMemo(() => dividendsBySymbol(filteredDividends), [filteredDividends]);
  const holdingsAll = useMemo(() => buildHoldings(holdingsState, prices, meta, divBySymbol), [holdingsState, prices, meta, divBySymbol]);

  const totalCashBalance = useMemo(() => {
    let bal = 0;
    filteredCashTxns.forEach(c => bal += c.type === 'deposit' ? Number(c.amount) : -Number(c.amount));
    filteredTxns.forEach(t => {
      const cost = (Number(t.shares) * Number(t.price));
      const fee = Number(t.fee) || 0;
      const tax = Number(t.tax) || 0;
      if (t.type === 'buy') bal -= (cost + fee + tax);
      else bal += (cost - fee - tax);
    });
    filteredDividends.forEach(d => bal += Number(d.totalCash || 0));
    return cleanNum(bal);
  }, [filteredCashTxns, filteredTxns, filteredDividends]);

  const totals = useMemo(() => {
    const totalMarketValue = holdingsAll.reduce((s, h) => s + h.marketValue, 0);
    const totalCost = holdingsAll.reduce((s, h) => s + h.cost, 0);
    const totalUPL = totalMarketValue - totalCost;
    const totalUPLPct = totalCost > 0 ? (totalUPL / totalCost) * 100 : 0;
    const totalRealized = realizedEvents.reduce((s, e) => s + e.pl, 0);
    const totalDividend = filteredDividends.reduce((s, d) => s + Number(d.totalCash || 0), 0);
    return { totalMarketValue, totalCost, totalUPL, totalUPLPct, totalRealized, totalDividend, totalCashBalance };
  }, [holdingsAll, realizedEvents, filteredDividends, totalCashBalance]);

  const holdings = useMemo(() => {
    return holdingsAll.filter(h => {
      if (strategyFilter !== 'all' && (h.strategy || '未分類') !== strategyFilter) return false;
      if (sectorFilter !== 'all' && (h.sector || '未分類') !== sectorFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!h.symbol.toLowerCase().includes(q) && !(h.name || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [holdingsAll, strategyFilter, sectorFilter, searchQuery]);

  const allSymbols = useMemo(() => {
    const set = new Set([...Object.keys(holdingsState), ...Object.keys(prices)]);
    return [...set].sort();
  }, [holdingsState, prices]);

  const sectorOptions = useMemo(() => [...new Set([...DEFAULT_SECTORS, ...holdingsAll.map(h => h.sector).filter(Boolean)])], [holdingsAll]);
  const strategyOptions = useMemo(() => [...new Set([...DEFAULT_STRATEGIES, ...holdingsAll.map(h => h.strategy).filter(Boolean)])], [holdingsAll]);

  const alerts = useMemo(() => {
    const list = [];
    for (const h of holdingsAll) {
      if (totals.totalMarketValue > 0 && (h.marketValue / totals.totalMarketValue) > 0.3) {
        list.push({ tone: 'warn', icon: AlertTriangle, text: `曝險警告：${h.symbol} 佔總市值達 ${fmt2((h.marketValue/totals.totalMarketValue)*100)}%，請留意風險` });
      }
      if (h.isStopHit) list.push({ tone: 'down', icon: AlertTriangle, text: `${h.symbol} ${h.name} 已跌破防守價 ${fmt2(h.stopLoss)}` });
      else if (h.isStopNear) list.push({ tone: 'down', icon: Bell, text: `${h.symbol} ${h.name} 接近防守價 ${fmt2(h.stopLoss)}` });
      
      if (h.isTargetHit) list.push({ tone: 'up', icon: CheckCircle2, text: `${h.symbol} ${h.name} 已達目標價 ${fmt2(h.targetPrice)}` });
      else if (h.isTargetNear) list.push({ tone: 'up', icon: Bell, text: `${h.symbol} ${h.name} 接近目標價 ${fmt2(h.targetPrice)}` });
    }
    return list;
  }, [holdingsAll, totals.totalMarketValue]);

  const monthly = useMemo(() => {
    const map = {};
    for (const t of filteredTxns) {
      const m = t.date.slice(0, 7);
      if (!map[m]) map[m] = { month: m, buyAmt: 0, sellAmt: 0, realizedPL: 0, dividend: 0, count: 0, events: [] };
      const cost = cleanNum((Number(t.shares) || 0) * (Number(t.price) || 0));
      const fee = Number(t.fee) || 0;
      const tax = Number(t.tax) || 0;
      if (t.type === 'buy') map[m].buyAmt += cost + fee + tax; 
      else map[m].sellAmt += cost - fee - tax;
      map[m].count += 1;
      map[m].events.push({ ...t, isDiv: false, isCash: false });
    }
    for (const e of realizedEvents) {
      const m = e.month;
      if (!map[m]) map[m] = { month: m, buyAmt: 0, sellAmt: 0, realizedPL: 0, dividend: 0, count: 0, events: [] };
      map[m].realizedPL = cleanNum(map[m].realizedPL + e.pl);
    }
    for (const d of filteredDividends) {
      const m = d.date.slice(0, 7);
      if (!map[m]) map[m] = { month: m, buyAmt: 0, sellAmt: 0, realizedPL: 0, dividend: 0, count: 0, events: [] };
      map[m].dividend = cleanNum(map[m].dividend + Number(d.totalCash || 0));
      map[m].events.push({ ...d, isDiv: true, isCash: false });
    }
    for (const c of filteredCashTxns) {
      const m = c.date.slice(0, 7);
      if (!map[m]) map[m] = { month: m, buyAmt: 0, sellAmt: 0, realizedPL: 0, dividend: 0, count: 0, events: [] };
      map[m].events.push({ ...c, isCash: true });
    }

    Object.values(map).forEach(m => m.events.sort((a,b) => new Date(b.date) - new Date(a.date)));
    return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
  }, [filteredTxns, realizedEvents, filteredDividends, filteredCashTxns]);

  const yearlyDividends = useMemo(() => {
    const map = {};
    for (const d of filteredDividends) {
      const y = d.date.slice(0, 4);
      map[y] = (map[y] || 0) + Number(d.totalCash || 0);
    }
    return Object.entries(map).map(([year, total]) => ({ year, total })).sort((a, b) => b.year.localeCompare(a.year));
  }, [filteredDividends]);

  const ownerComparison = useMemo(() => {
    if (owners.length <= 1) return [];
    return owners.map(o => {
      const oTxns = transactions.filter(t => (t.owner || owners[0]) === o);
      const oDivs = dividends.filter(d => (d.owner || owners[0]) === o);
      const oCash = cashTransactions.filter(c => (c.owner || owners[0]) === o);
      
      const { state, realizedEvents: oRealized } = computePortfolio(oTxns);
      const oDivBySymbol = dividendsBySymbol(oDivs);
      const oHoldings = buildHoldings(state, prices, meta, oDivBySymbol);
      
      const marketValue = oHoldings.reduce((s, h) => s + h.marketValue, 0);
      const cost = oHoldings.reduce((s, h) => s + h.cost, 0);
      const upl = marketValue - cost;
      const realized = oRealized.reduce((s, e) => s + e.pl, 0);
      const dividendTotal = oDivs.reduce((s, d) => s + Number(d.totalCash || 0), 0);
      
      let bal = 0;
      oCash.forEach(c => bal += c.type === 'deposit' ? Number(c.amount) : -Number(c.amount));
      oTxns.forEach(t => {
        const c = (Number(t.shares) * Number(t.price));
        if (t.type === 'buy') bal -= (c + (Number(t.fee)||0) + (Number(t.tax)||0));
        else bal += (c - (Number(t.fee)||0) - (Number(t.tax)||0));
      });
      oDivs.forEach(d => bal += Number(d.totalCash || 0));

      return { owner: o, marketValue, cost, upl, realized, dividendTotal, holdingCount: oHoldings.length, cash: cleanNum(bal) };
    });
  }, [owners, transactions, dividends, prices, meta, cashTransactions]);

  const userStockMap = useMemo(() => {
    const symToName = { ...DEFAULT_STOCK_MAP };
    const nameToSym = { ...DEFAULT_NAME_MAP };
    transactions.forEach(t => {
      if (t.symbol && t.name) {
        symToName[t.symbol] = t.name;
        nameToSym[t.name] = t.symbol;
      }
    });
    return { symToName, nameToSym };
  }, [transactions]);

  function handleSymbolChange(val, isDiv = false) {
    const symbol = val.toUpperCase();
    const clean = symbol.trim();
    const setter = isDiv ? setDivForm : setForm;
    setter(f => {
      let nextName = f.name;
      if (clean === '') nextName = ''; 
      else if (userStockMap.symToName[clean]) nextName = userStockMap.symToName[clean];
      return { ...f, symbol, name: nextName };
    });
  }

  function handleNameChange(val, isDiv = false) {
    const name = val;
    const clean = name.trim();
    const setter = isDiv ? setDivForm : setForm;
    setter(f => {
      let nextSymbol = f.symbol;
      if (clean === '') nextSymbol = ''; 
      else if (userStockMap.nameToSym[clean]) nextSymbol = userStockMap.nameToSym[clean];
      return { ...f, name, symbol: nextSymbol };
    });
  }

  // 🚀 2026 終極高速本地模糊名冊查找線路（絕不卡死、免去外部 Proxy 依賴）
  async function handleNameBlur(isDiv = false) {
    const currentName = isDiv ? divForm.name : form.name;
    const currentSymbol = isDiv ? divForm.symbol : form.symbol;
    const cleanName = currentName.trim();
    
    if (cleanName.length >= 2 && !currentSymbol) {
      setIsLookingUpName(true);
      let fetchedSymbol = '';

      // 1. 本地精準與模糊查找（直接翻找剛下載好的官方名冊）
      const cachedEntry = Object.entries(officialMapCache).find(([sym, data]) => data && data.name === cleanName);
      if (cachedEntry) {
        fetchedSymbol = cachedEntry[0];
      } 
      // 2. 如果官方總表還沒下載完，改用內建基本庫兜底
      else if (userStockMap.nameToSym[cleanName]) {
        fetchedSymbol = userStockMap.nameToSym[cleanName];
      }
      // 3. 如果是美股或其它標的，再嘗試極速抓取
      else {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5秒超時保險
          const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(cleanName)}&quotesCount=1`;
          const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, { signal: controller.signal });
          clearTimeout(timeoutId);
          const data = await res.json();
          if (data.quotes && data.quotes.length > 0) {
            let rawSymbol = data.quotes[0].symbol;
            fetchedSymbol = (rawSymbol.includes('.TW') || rawSymbol.includes('.TWO')) ? rawSymbol.split('.')[0] : rawSymbol;
          }
        } catch (e) {
          console.log("外部備援查詢跳過或超時");
        }
      }

      if (fetchedSymbol) {
        const setter = isDiv ? setDivForm : setForm;
        setter(f => ({ ...f, symbol: fetchedSymbol }));
      }
      setIsLookingUpName(false);
    }
  }

  function resetForm() {
    setEditingTxnId(null);
    setForm({ date: todayStr(), symbol: '', name: '', type: 'buy', shares: '', price: '', fee: '', tax: '', owner: (selectedOwner !== 'all' ? selectedOwner : owners[0]) || '我', note: '' });
  }
  function resetDivForm() {
    setEditingDivId(null);
    setDivForm({ date: todayStr(), symbol: '', name: '', shares: '', cashPerShare: '', stockPerShare: '', owner: (selectedOwner !== 'all' ? selectedOwner : owners[0]) || '我', note: '' });
  }
  function resetCashForm() {
    setEditingCashId(null);
    setCashForm({ date: todayStr(), type: 'deposit', amount: '', owner: (selectedOwner !== 'all' ? selectedOwner : owners[0]) || '我', note: '' });
  }

  function autoCalculateTax() {
    const shares = Number(form.shares) || 0;
    const price = Number(form.price) || 0;
    const total = shares * price;
    const fee = Math.floor(total * 0.001425);
    const tax = form.type === 'sell' ? Math.floor(total * 0.003) : 0;
    setForm(f => ({ ...f, fee: String(fee), tax: String(tax) }));
    showToast('已自動帶入公定手續費與交易稅，可手動微調(如券商折扣)。');
  }

  function handleEditTxn(t) {
    setForm({
      date: t.date, symbol: t.symbol, name: t.name || '', type: t.type,
      shares: t.shares, price: t.price, fee: t.fee || 0, tax: t.tax || 0,
      owner: t.owner || owners[0] || '我', note: t.note || ''
    });
    setEditingTxnId(t.id);
    setShowForm(true);
  }

  function handleEditDividend(d) {
    setDivForm({
      date: d.date, symbol: d.symbol, name: d.name || '', shares: d.shares,
      cashPerShare: d.cashPerShare, stockPerShare: d.stockPerShare || 0,
      owner: d.owner || owners[0] || '我', note: d.note || ''
    });
    setEditingDivId(d.id);
    setShowDividendForm(true);
  }

  function handleEditCash(c) {
    setCashForm({
      date: c.date, type: c.type, amount: c.amount, 
      owner: c.owner || owners[0] || '我', note: c.note || ''
    });
    setEditingCashId(c.id);
    setShowCashForm(true);
  }

  function submitTxn(e) {
    e.preventDefault();
    if (!form.symbol.trim() || !form.shares || (!form.price && form.price !== '0')) return;
    const t = {
      id: editingTxnId || (Date.now() + Math.random()), date: form.date, symbol: form.symbol.trim().toUpperCase(),
      name: form.name.trim() || form.symbol.trim().toUpperCase(), type: form.type,
      shares: cleanNum(Number(form.shares)), price: cleanNum(Number(form.price)), 
      fee: cleanNum(Number(form.fee) || 0), tax: cleanNum(Number(form.tax) || 0),
      owner: form.owner || owners[0] || '我',
      note: (form.note || '').trim()
    };
    
    let next;
    if (editingTxnId) next = transactions.map(item => item.id === editingTxnId ? t : item);
    else next = [...transactions, t];
    
    persistTxns(next);
    if (!prices[t.symbol]) persistPrices({ ...prices, [t.symbol]: { current: t.price, history: [{ date: t.date, price: t.price }] } });
    resetForm();
    setShowForm(false);
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
    
    let next;
    if (editingDivId) next = dividends.map(item => item.id === editingDivId ? d : item);
    else next = [...dividends, d];
    
    persistDividends(next);
    resetDivForm();
    setShowDividendForm(false);
  }

  function submitCash(e) {
    e.preventDefault();
    if (!cashForm.amount) return;
    const c = {
      id: editingCashId || (Date.now() + Math.random()), date: cashForm.date, type: cashForm.type,
      amount: cleanNum(Number(cashForm.amount)),
      owner: cashForm.owner || owners[0] || '我', note: cashForm.note.trim(),
    };
    let next;
    if (editingCashId) next = cashTransactions.map(item => item.id === editingCashId ? c : item);
    else next = [...cashTransactions, c];
    
    persistCash(next);
    resetCashForm();
    setShowCashForm(false);
  }

  function deleteTxn(id) { persistTxns(transactions.filter(t => t.id !== id)); }
  function deleteDividend(id) { persistDividends(dividends.filter(d => d.id !== id)); }
  function deleteCash(id) { persistCash(cashTransactions.filter(c => c.id !== id)); }

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

  const tickerItems = holdingsAll.length ? holdingsAll : null;

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

      <div className="tsp-ticker">
        <div className="tsp-ticker-track">
          {tickerItems ? [...tickerItems, ...tickerItems].map((h, i) => (
            <span className="tsp-ticker-item" key={i}>
              <b>{h.symbol}</b> {h.name} <span className={`tsp-mono ${changeCls(h.uplPct)}`}>{arrow(h.uplPct)} {pct(h.uplPct)}</span>
            </span>
          )) : (<span className="tsp-ticker-item tsp-muted">尚無持股 — 到「交易紀錄」新增第一筆買進紀錄開始追蹤</span>)}
        </div>
      </div>

      <header className="tsp-header">
        <div className="tsp-brand">
          <span className="tsp-brand-mark">股</span>
          <div><h1>台股持股簿</h1><p>向左右滑動可切換面板</p></div>
        </div>
        <div className="tsp-header-actions">
          <div className="tsp-owner-select">
            <Users size={14} className="tsp-muted" />
            <select className="tsp-input tsp-select" value={selectedOwner} onChange={e => setSelectedOwner(e.target.value)}>
              <option value="all">全部持有者</option>
              {owners.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <button className="tsp-icon-btn" title="新增持有者" onClick={() => setShowOwnerForm(v => !v)}><UserPlus size={14} /></button>
            {showOwnerForm && (
              <div className="tsp-owner-form">
                <input className="tsp-input tsp-input-sm" placeholder="輸入姓名" value={ownerInput}
                  onChange={e => setOwnerInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addOwner()} autoFocus />
                <button className="tsp-icon-btn" onClick={addOwner}><Save size={14} /></button>
              </div>
            )}
          </div>
          
          <button className={`tsp-btn ${user && user.email ? 'tsp-up-bg' : (roomCode ? 'tsp-warn-bg' : '')}`} onClick={() => setCloudModal(true)} title="雲端帳號與共用">
            <Cloud size={16} className={user && user.email ? 'tsp-up' : (roomCode ? 'tsp-warn' : '')} />
            {user && user.email ? 'Email已綁定' : (roomCode ? `共用中 (${roomCode})` : '未綁定雲端')}
          </button>
          
          <button className="tsp-btn" onClick={autoFetchPrices} disabled={isFetchingPrices} title="自動極速抓取最新上市櫃股價">
            {isFetchingPrices ? <RefreshCw className="tsp-spin" size={16} /> : <Zap size={16} />}
            {isFetchingPrices ? '閃電更新中...' : '自動報價'}
          </button>
          <button className="tsp-btn" onClick={() => { resetCashForm(); setShowCashForm(true); }}><Wallet size={16} /> 資金增減</button>
          <button className="tsp-btn tsp-btn-primary" onClick={() => { resetForm(); setShowForm(true); }}><Plus size={16} /> 新增交易</button>
        </div>
      </header>

      {/* 滿版標籤列 */}
      <nav className="tsp-tabs">
        {activeTabsList.map((t) => (
          <button key={t.id} className={`tsp-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>

      {/* 使用 Key 驅動的 CSS 動畫 */}
      <main className="tsp-main" key={tab} style={{ animation: 'tspFadeIn 0.25s ease-out forwards' }}>
        {tab === 'dashboard' && (
          <Dashboard totals={totals} holdings={holdingsAll} meta={meta} groupMode={groupMode} setGroupMode={setGroupMode} alerts={alerts} />
        )}
        {tab === 'holdings' && (
          <Holdings holdings={holdings} priceDraft={priceDraft} setPriceDraft={setPriceDraft} updatePrice={updatePrice}
            updateMeta={updateMeta} strategyFilter={strategyFilter} setStrategyFilter={setStrategyFilter}
            sectorFilter={sectorFilter} setSectorFilter={setSectorFilter} sectorOptions={sectorOptions}
            strategyOptions={strategyOptions} searchQuery={searchQuery} setSearchQuery={setSearchQuery} 
            onAtrCalculate={handleAtrCalculation} />
        )}
        {tab === 'txns' && (
          <Transactions transactions={selectedOwner === 'all' ? transactions : filteredTxns} onEdit={handleEditTxn} onDelete={deleteTxn} showOwner={owners.length > 1} />
        )}
        {tab === 'dividends' && (
          <Dividends dividends={selectedOwner === 'all' ? dividends : filteredDividends} onEdit={handleEditDividend} onDelete={deleteDividend}
            showOwner={owners.length > 1} yearlyDividends={yearlyDividends} onAdd={() => { resetDivForm(); setShowDividendForm(true); }}
            totalDividend={totals.totalDividend} holdingsAll={holdingsAll} />
        )}
        {tab === 'cash' && (
          <CashAccount cashTransactions={filteredCashTxns} onEdit={handleEditCash} onDelete={deleteCash} showOwner={owners.length > 1} totalCashBalance={totals.totalCashBalance} onAdd={() => { resetCashForm(); setShowCashForm(true); }} />
        )}
        {tab === 'charts' && (
          <Charts holdings={holdingsAll} prices={prices} meta={meta} symbols={allSymbols} chartSymbol={chartSymbol} setChartSymbol={setChartSymbol} groupMode={groupMode} setGroupMode={setGroupMode} />
        )}
        {tab === 'monthly' && (<Monthly monthly={monthly} />)}
        {tab === 'compare' && (<Compare data={ownerComparison} />)}
      </main>

      {toastMsg && <div className="tsp-toast">{toastMsg}</div>}

      {/* Cloud Sync & Email Auth Modal */}
      {cloudModal && (
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
                     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--up)', fontWeight: 'bold', marginBottom: 12 }}>
                       <CheckCircle2 size={20} /> 已綁定雲端帳號
                     </div>
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
                     <button type="submit" className="tsp-btn tsp-btn-primary" style={{ justifyContent: 'center' }}>
                       {isLoginMode ? '登入帳號' : '註冊並將目前資料存入雲端'}
                     </button>
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
      )}

      {/* 交易表單 (加入稅金與自動計算) */}
      {showForm && (
        <div className="tsp-modal-backdrop" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="tsp-modal" onClick={e => e.stopPropagation()}>
            <div className="tsp-modal-head">
              <h3>{editingTxnId ? '✏️ 編輯交易紀錄' : '➕ 新增交易紀錄'}</h3>
              <button type="button" className="tsp-icon-btn" onClick={() => { setShowForm(false); resetForm(); }}><X size={18} /></button>
            </div>
            <form onSubmit={submitTxn} className="tsp-form">
              {!editingTxnId && <p className="tsp-hint">輸入代號並點擊其他地方，會自動獲取股票名稱。</p>}
              <div className="tsp-type-toggle">
                <button type="button" className={form.type === 'buy' ? 'active tsp-up-bg' : ''} onClick={() => setForm(f