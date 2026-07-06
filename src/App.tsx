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
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

function MetaInput({ val, options, placeholder, onSave }) {
  const [isCustom, setIsCustom] = useState(false);
  const [v, setV] = useState(val || '');

  useEffect(() => {
    if (!isCustom) setV(val || '');
  }, [val, isCustom]);

  if (isCustom) {
    return (
      <input 
        className="tsp-input tsp-input-sm" 
        autoFocus 
        placeholder={`請輸入${placeholder}...`}
        value={v} 
        onChange={e => setV(e.target.value)} 
        onBlur={() => { onSave(v); setIsCustom(false); }}
        onKeyDown={e => { if(e.key === 'Enter') e.target.blur(); }}
      />
    );
  }

  return (
    <select 
      className="tsp-input tsp-input-sm tsp-select" 
      value={options.includes(v) ? v : (v ? 'custom_hidden' : '')} 
      onChange={e => {
        if (e.target.value === '___custom___') {
          setIsCustom(true);
          setV('');
        } else if (e.target.value !== 'custom_hidden') {
          setV(e.target.value);
          onSave(e.target.value);
        }
      }}
    >
      <option value="">選擇{placeholder}...</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
      {v && !options.includes(v) && <option value="custom_hidden">{v}</option>}
      <option value="___custom___">✏️ 自行輸入...</option>
    </select>
  );
}

function BlurInput({ val, placeholder, onSave }) {
  const [v, setV] = useState(val || '');
  const [isFocused, setIsFocused] = useState(false);
  
  useEffect(() => { 
    if (!isFocused) setV(val || ''); 
  }, [val, isFocused]);

  return (
    <input
      className="tsp-input tsp-input-sm tsp-mono"
      placeholder={placeholder}
      type="number"
      step="0.01"
      value={v}
      onFocus={() => setIsFocused(true)}
      onChange={e => setV(e.target.value)}
      onBlur={() => {
        setIsFocused(false);
        const numVal = v ? cleanNum(Number(v)) : null;
        if (numVal !== val) onSave(numVal);
      }}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
    />
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
        sector: m.sector || '', strategy: m.strategy || '', stopLoss, targetPrice,
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
  const [cashTransactions, setCashTransactions] = useState([]); // 新增：現金帳戶明細
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
  const [showCashForm, setShowCashForm] = useState(false); // 新增：出入金表單
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

  // 交易表單新增了 tax
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
      { id: 'cash', label: '現金明細' }, // 新增：現金明細 Tab
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
        const [twseRes, tpexRes] = await Promise.all([
          fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL').catch(() => null),
          fetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes').catch(() => null)
        ]);
        if (twseRes?.ok) {
          const data = await twseRes.json();
          data.forEach(d => { map[d.Code] = { name: d.Name, price: Number(d.ClosingPrice) }; });
        }
        if (tpexRes?.ok) {
          const data = await tpexRes.json();
          data.forEach(d => { map[d.SecuritiesCompanyCode] = { name: d.CompanyName, price: Number(d.Close) }; });
        }
        setOfficialMapCache(map);
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
        setTransactions(data.transactions || []);
        setCashTransactions(data.cashTransactions || []); // Sync cash
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
        fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL').catch(() => null),
        fetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes').catch(() => null)
      ]);
      if (twseRes?.ok) {
        const data = await twseRes.json();
        data.forEach(d => { fallbackMap[d.Code] = Number(d.ClosingPrice); });
      }
      if (tpexRes?.ok) {
        const data = await tpexRes.json();
        data.forEach(d => { fallbackMap[d.SecuritiesCompanyCode] = Number(d.Close); });
      }
      setOfficialMapCache(fallbackMap);
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
        finalPrice = fallbackMap[sym];
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

  // 動態計算戶頭可用餘額
  const totalCashBalance = useMemo(() => {
    let bal = 0;
    // 1. 入金/出金
    filteredCashTxns.forEach(c => bal += c.type === 'deposit' ? Number(c.amount) : -Number(c.amount));
    // 2. 買賣股
    filteredTxns.forEach(t => {
      const cost = (Number(t.shares) * Number(t.price));
      const fee = Number(t.fee) || 0;
      const tax = Number(t.tax) || 0;
      if (t.type === 'buy') bal -= (cost + fee + tax);
      else bal += (cost - fee - tax);
    });
    // 3. 股利
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
    
    // 台股公定手續費率 0.1425% (無條件捨去)
    const fee = Math.floor(total * 0.001425);
    // 台股賣出交易稅 0.3% (無條件捨去)
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

  function submitBatchPrices(e) {
    e.preventDefault();
    const today = todayStr();
    const next = { ...prices };
    let updated = 0;
    for (const raw of batchPriceText.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const parts = line.split(/[\s,、]+/).filter(Boolean);
      if (parts.length < 2) continue;
      const symbol = parts[0].trim().toUpperCase();
      const val = cleanNum(Number(parts[1]));
      if (!symbol || !val || val <= 0) continue;
      const entry = next[symbol] || { current: val, history: [] };
      const hist = [...(entry.history || [])];
      if (hist.length && hist[hist.length - 1].date === today) hist[hist.length - 1] = { date: today, price: val };
      else hist.push({ date: today, price: val });
      next[symbol] = { current: val, history: hist };
      updated += 1;
    }
    if (updated > 0) persistPrices(next);
    setBatchPriceText('');
    setShowBatchForm(false);
  }

  function updateMeta(symbol, patch) { 
    persistMeta({ ...meta, [symbol]: { ...(meta[symbol] || {}), ...patch } }); 
  }

  function addOwner() {
    const name = ownerInput.trim();
    if (!name || owners.includes(name)) { setOwnerInput(''); setShowOwnerForm(false); return; }
    const next = [...owners, name];
    persistOwners(next);
    setSelectedOwner(name);
    setForm(f => ({ ...f, owner: name }));
    setDivForm(f => ({ ...f, owner: name }));
    setCashForm(f => ({ ...f, owner: name }));
    setOwnerInput('');
    setShowOwnerForm(false);
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
                <button type="button" className={form.type === 'buy' ? 'active tsp-up-bg' : ''} onClick={() => setForm(f => ({ ...f, type: 'buy', tax: '0' }))}>買進 / 匯入</button>
                <button type="button" className={form.type === 'sell' ? 'active tsp-down-bg' : ''} onClick={() => setForm(f => ({ ...f, type: 'sell' }))}>賣出</button>
              </div>
              <div className="tsp-form-row">
                <label>日期<input type="date" className="tsp-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required /></label>
                <label>持有者
                  <select className="tsp-input" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}>
                    {owners.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
              </div>
              <div className="tsp-form-row">
                <label>
                  股票代號
                  <div style={{position: 'relative'}}>
                    <input className="tsp-input" autoComplete="off" placeholder="2330" value={form.symbol} onChange={e => handleSymbolChange(e.target.value, false)} onBlur={() => handleSymbolBlur(false)} required />
                    {isLookingUpName && <RefreshCw size={14} className="tsp-spin tsp-muted" style={{position: 'absolute', right: 10, top: 12}} />}
                  </div>
                </label>
                <label>股票名稱<input className="tsp-input" autoComplete="off" placeholder="台積電" value={form.name} onChange={e => handleNameChange(e.target.value, false)} required/></label>
              </div>
              <div className="tsp-form-row">
                <label>股數<input type="number" min="0" step="1" className="tsp-input tsp-mono" placeholder="1000" value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} required /></label>
                <label>成交價 (配股填 0)<input type="number" min="0" step="0.01" className="tsp-input tsp-mono" placeholder="600" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required /></label>
              </div>

              {/* 稅費區塊 */}
              <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold' }}>券商手續費與交易稅金</span>
                  <button type="button" className="tsp-btn" style={{ padding: '4px 8px', fontSize: '12px', minHeight: '28px' }} onClick={autoCalculateTax}><Wand2 size={12} /> 自動試算</button>
                </div>
                <div className="tsp-form-row">
                  <label>手續費<input type="number" min="0" step="1" className="tsp-input tsp-mono" placeholder="0" value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} /></label>
                  <label>交易稅(證交稅)<input type="number" min="0" step="1" className="tsp-input tsp-mono" placeholder="0" value={form.tax} onChange={e => setForm(f => ({ ...f, tax: e.target.value }))} disabled={form.type==='buy'} title={form.type==='buy'?"買進無須交易稅":""} /></label>
                </div>
              </div>

              <label>交易筆記（買進/賣出理由）<input type="text" autoComplete="off" className="tsp-input" placeholder="例如：看好Q3法說會展望 / 停損換股..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} /></label>
              
              <div style={{ background: 'var(--panel-2)', padding: '12px', borderRadius: '8px', fontSize: '13px', color: 'var(--text)', display: 'flex', justifyContent: 'space-between' }}>
                <span className="tsp-muted">此筆預估收付總額：</span>
                <b className="tsp-mono">
                  {form.type === 'buy' ? '-' : '+'}
                  {money(cleanNum((Number(form.shares||0) * Number(form.price||0)) + (form.type === 'buy' ? (Number(form.fee||0) + Number(form.tax||0)) : -(Number(form.fee||0) + Number(form.tax||0)))))}
                </b>
              </div>

              <button type="submit" className="tsp-btn tsp-btn-primary tsp-form-submit"><Save size={16} /> 儲存交易</button>
            </form>
          </div>
        </div>
      )}

      {/* 股利表單 */}
      {showDividendForm && (
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
                    {owners.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
              </div>
              <div className="tsp-form-row">
                <label>
                  股票代號
                  <div style={{position: 'relative'}}>
                    <input className="tsp-input" autoComplete="off" placeholder="2330" value={divForm.symbol} onChange={e => handleSymbolChange(e.target.value, true)} onBlur={() => handleSymbolBlur(true)} required />
                    {isLookingUpName && <RefreshCw size={14} className="tsp-spin tsp-muted" style={{position: 'absolute', right: 10, top: 12}} />}
                  </div>
                </label>
                <label>股票名稱<input className="tsp-input" autoComplete="off" placeholder="台積電" value={divForm.name} onChange={e => handleNameChange(e.target.value, true)} required /></label>
              </div>
              <div className="tsp-form-row">
                <label>參與配息股數<input type="number" min="0" step="1" className="tsp-input tsp-mono" placeholder="1000" value={divForm.shares} onChange={e => setDivForm(f => ({ ...f, shares: e.target.value }))} required /></label>
                <label>現金股利／股<input type="number" min="0" step="0.01" className="tsp-input tsp-mono" placeholder="2.5" value={divForm.cashPerShare} onChange={e => setDivForm(f => ({ ...f, cashPerShare: e.target.value }))} /></label>
              </div>
              <label>股票股利／股（選填）<input type="number" min="0" step="0.001" className="tsp-input tsp-mono" placeholder="0" value={divForm.stockPerShare} onChange={e => setDivForm(f => ({ ...f, stockPerShare: e.target.value }))} /></label>
              <label>備註（選填）<input className="tsp-input" autoComplete="off" value={divForm.note} onChange={e => setDivForm(f => ({ ...f, note: e.target.value }))} /></label>
              <p className="tsp-hint">現金股利金額 = 股數 × 每股現金股利 = {money(cleanNum((Number(divForm.shares) || 0) * (Number(divForm.cashPerShare) || 0)))}</p>
              <button type="submit" className="tsp-btn tsp-btn-primary tsp-form-submit"><Save size={16} /> 儲存股利紀錄</button>
            </form>
          </div>
        </div>
      )}

      {/* 現金明細表單 */}
      {showCashForm && (
        <div className="tsp-modal-backdrop" onClick={() => { setShowCashForm(false); resetCashForm(); }}>
          <div className="tsp-modal" onClick={e => e.stopPropagation()}>
            <div className="tsp-modal-head">
              <h3>{editingCashId ? '✏️ 編輯現金明細' : '💳 新增入金 / 出金'}</h3>
              <button type="button" className="tsp-icon-btn" onClick={() => { setShowCashForm(false); resetCashForm(); }}><X size={18} /></button>
            </div>
            <form onSubmit={submitCash} className="tsp-form">
              <p className="tsp-hint">將您的資金匯入或匯出證券戶頭，系統會自動幫您結算剩餘可用資金。</p>
              <div className="tsp-type-toggle">
                <button type="button" className={cashForm.type === 'deposit' ? 'active tsp-up-bg' : ''} onClick={() => setCashForm(f => ({ ...f, type: 'deposit' }))}>入金 (匯入帳戶)</button>
                <button type="button" className={cashForm.type === 'withdraw' ? 'active tsp-down-bg' : ''} onClick={() => setCashForm(f => ({ ...f, type: 'withdraw' }))}>出金 (匯出帳戶)</button>
              </div>
              <div className="tsp-form-row">
                <label>日期<input type="date" className="tsp-input" value={cashForm.date} onChange={e => setCashForm(f => ({ ...f, date: e.target.value }))} required /></label>
                <label>帳戶所有者
                  <select className="tsp-input" value={cashForm.owner} onChange={e => setCashForm(f => ({ ...f, owner: e.target.value }))}>
                    {owners.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
              </div>
              <label>金額 (台幣)<input type="number" min="1" step="1" className="tsp-input tsp-mono" placeholder="50000" value={cashForm.amount} onChange={e => setCashForm(f => ({ ...f, amount: e.target.value }))} required autoFocus /></label>
              <label>備註（選填）<input className="tsp-input" autoComplete="off" placeholder="例如：領薪水投入、年底提款買車..." value={cashForm.note} onChange={e => setCashForm(f => ({ ...f, note: e.target.value }))} /></label>
              <button type="submit" className="tsp-btn tsp-btn-primary tsp-form-submit"><Save size={16} /> 儲存資金紀錄</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// UI Components
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
      {[['symbol', '股票'], ['sector', '產業'], ['strategy', '策略']].map(([k, l]) => (
        <button key={k} className={groupMode === k ? 'active' : ''} onClick={() => setGroupMode(k)}>{l}</button>
      ))}
    </div>
  );
}

function Empty({ text }) {
  return <div className="tsp-empty">{text}</div>;
}

function AllocationPie({ holdings, meta, groupMode, totalMarketValue }) {
  const data = groupHoldings(holdings, meta, groupMode).sort((a,b) => b.value - a.value);
  if (!data.length) return <Empty text="尚無持股資料，新增交易後這裡會顯示資產配置圖" />;
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

function Dashboard({ totals, holdings, meta, groupMode, setGroupMode, alerts }) {
  return (
    <div className="tsp-dashboard">
      <div className="tsp-stats-grid">
        <StatCard label="總資產 (市值 + 餘額)" value={money(totals.totalMarketValue + totals.totalCashBalance)} />
        <StatCard label="持股總市值" value={money(totals.totalMarketValue)} />
        <StatCard label="戶頭可用餘額" value={money(totals.totalCashBalance)} tone={totals.totalCashBalance < 0 ? 'tsp-down' : ''} />
        <StatCard label="未實現損益" value={(totals.totalUPL > 0 ? '+' : '') + money(totals.totalUPL)} sub={pct(totals.totalUPLPct)} tone={changeCls(totals.totalUPL)} />
        <StatCard label="已實現損益" value={(totals.totalRealized > 0 ? '+' : '') + money(totals.totalRealized)} tone={changeCls(totals.totalRealized)} />
        <StatCard label="累計股利" value={money(totals.totalDividend)} tone="tsp-up" />
      </div>
      
      <div className="tsp-dashboard-bottom">
        <div className="tsp-card tsp-panel">
          <div className="tsp-panel-head">
            <h3>資產配置</h3>
            <GroupToggle groupMode={groupMode} setGroupMode={setGroupMode} />
          </div>
          <AllocationPie holdings={holdings} meta={meta} groupMode={groupMode} totalMarketValue={totals.totalMarketValue} />
        </div>
        
        <div className="tsp-card tsp-panel">
          <div className="tsp-panel-head">
            <h3>股價提醒與風險通知</h3>
          </div>
          <div className="tsp-alerts-list">
            {alerts.length === 0 ? (
              <Empty text="目前沒有觸發任何通知 (可於持股設定防守價/目標價)" />
            ) : (
              alerts.map((a, i) => {
                const Icon = a.icon;
                return (
                  <div key={i} className={`tsp-alert-item tsp-${a.tone}-bg`}>
                    <Icon size={18} className={`tsp-${a.tone}`} />
                    <span>{a.text}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Holdings({ holdings, priceDraft, setPriceDraft, updatePrice, updateMeta, strategyFilter, setStrategyFilter, sectorFilter, setSectorFilter, sectorOptions, strategyOptions, searchQuery, setSearchQuery, onAtrCalculate }) {
  return (
    <div className="tsp-card">
      <div className="tsp-filters" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '150px' }}>
          <Search size={14} className="tsp-muted" style={{ position: 'absolute', left: 10, top: 12 }} />
          <input className="tsp-input" placeholder="搜尋代號或名稱..." style={{ paddingLeft: 32 }} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <select className="tsp-input tsp-select" style={{ flex: 1, minWidth: '120px' }} value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}>
          <option value="all">所有產業</option>
          {sectorOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select className="tsp-input tsp-select" style={{ flex: 1, minWidth: '120px' }} value={strategyFilter} onChange={e => setStrategyFilter(e.target.value)}>
          <option value="all">所有策略</option>
          {strategyOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      {!holdings.length ? (
        <Empty text="找不到符合條件的持股" />
      ) : (
        <div className="tsp-table-wrap">
          <table className="tsp-table">
            <thead>
              <tr>
                <th>股票</th>
                <th className="tsp-right">股數</th>
                <th className="tsp-right">均價(含稅費)</th>
                <th className="tsp-right">現價</th>
                <th className="tsp-right">市值</th>
                <th className="tsp-right">未實現損益</th>
                <th className="th-category">分類設定</th>
                <th className="th-alerts">停損/獲利提醒</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map(h => (
                <tr key={h.symbol} className={h.isWarning ? 'tsp-row-warn' : ''}>
                  <td style={{ whiteSpace: 'normal', wordBreak: 'break-word', minWidth: '100px' }}>
                    <div className="tsp-symbol">{h.symbol}</div>
                    <div className="tsp-name tsp-muted">{h.name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', alignItems: 'flex-start' }}>
                      <Tag text={h.sector} /> 
                      <Tag text={h.strategy} />
                    </div>
                  </td>
                  <td className="tsp-right tsp-mono">{fmtInt(h.shares)}</td>
                  <td className="tsp-right tsp-mono">
                    <div title="均價包含您輸入的手續費">{fmt2(h.avgCost)}</div>
                  </td>
                  <td className="tsp-right">
                    <div className="tsp-price-input">
                      <input className="tsp-input tsp-input-sm tsp-mono" placeholder={fmt2(h.current)}
                        value={priceDraft[h.symbol] ?? ''} 
                        onChange={e => setPriceDraft(d => ({...d, [h.symbol]: e.target.value}))}
                        onKeyDown={e => e.key === 'Enter' && updatePrice(h.symbol)}
                      />
                      {(priceDraft[h.symbol] && Number(priceDraft[h.symbol]) > 0) && (
                        <button className="tsp-icon-btn" onClick={() => updatePrice(h.symbol)}><Save size={14} /></button>
                      )}
                    </div>
                  </td>
                  <td className="tsp-right tsp-mono">{fmtInt(h.marketValue)}</td>
                  <td className={`tsp-right tsp-mono ${changeCls(h.upl)}`}>
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end'}}>
                      <div>{h.upl > 0 ? '+' : ''}{fmtInt(h.upl)}</div>
                      <div style={{ fontSize: 12 }}>{pct(h.uplPct)}</div>
                    </div>
                  </td>
                  <td style={{ minWidth: '130px' }}>
                    <div className="tsp-meta-inputs" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <MetaInput options={sectorOptions} placeholder="選擇或輸入產業" val={h.sector} onSave={(v) => updateMeta(h.symbol, { sector: v })} />
                      <MetaInput options={strategyOptions} placeholder="選擇或輸入策略" val={h.strategy} onSave={(v) => updateMeta(h.symbol, { strategy: v })} />
                    </div>
                  </td>
                  <td style={{ minWidth: '160px' }}>
                    <div className="tsp-meta-inputs" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="tsp-muted" style={{ fontSize: '12px', fontWeight: 'bold', minWidth: '32px' }}>防守</span>
                        <BlurInput val={h.stopLoss} placeholder="輸入防守價" onSave={(v) => updateMeta(h.symbol, { stopLoss: v })} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="tsp-muted" style={{ fontSize: '12px', fontWeight: 'bold', minWidth: '32px' }}>目標</span>
                        <BlurInput val={h.targetPrice} placeholder="輸入目標價" onSave={(v) => updateMeta(h.symbol, { targetPrice: v })} />
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        <button type="button" className="tsp-btn" style={{ flex: 1, padding: '2px 4px', fontSize: '11px', justifyContent: 'center' }} onClick={() => updateMeta(h.symbol, { stopLoss: cleanNum(h.avgCost * 0.9), targetPrice: cleanNum(h.avgCost * 1.2) })} title="防守設為成本-10% / 目標設為成本+20%">
                           ±10/20%
                        </button>
                        <button type="button" className="tsp-btn" style={{ flex: 1, padding: '2px 4px', fontSize: '11px', justifyContent: 'center' }} onClick={() => onAtrCalculate(h.symbol, h.current)} title="根據最近 14 天資料計算 ATR (防守設為現價 - 2×ATR)">
                           ATR
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Transactions({ transactions, onEdit, onDelete, showOwner }) {
  if (!transactions.length) return <Empty text="尚無交易紀錄，點擊右上角「新增交易」開始記錄" />;
  const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
  
  return (
    <div className="tsp-card tsp-table-wrap">
      <table className="tsp-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>類型</th>
            <th>股票</th>
            <th className="tsp-right">股數</th>
            <th className="tsp-right">成交價</th>
            <th className="tsp-right">手續費</th>
            <th className="tsp-right">交易稅</th>
            <th className="tsp-right">總收付金額</th>
            <th>交易筆記</th>
            {showOwner && <th>持有者</th>}
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(t => {
            const cost = cleanNum((Number(t.shares) || 0) * (Number(t.price) || 0));
            const fee = Number(t.fee) || 0;
            const tax = Number(t.tax) || 0;
            const total = t.type === 'buy' ? (cost + fee + tax) : (cost - fee - tax);
            
            return (
              <tr key={t.id} className="tsp-clickable-row" onClick={() => onEdit(t)} title="點擊整行即可編輯此交易">
                <td className="tsp-mono">{t.date}</td>
                <td>
                  <span className={`tsp-badge ${t.type === 'buy' ? 'tsp-up-bg tsp-up' : 'tsp-down-bg tsp-down'}`}>
                    {t.type === 'buy' ? '買進' : '賣出'}
                  </span>
                </td>
                <td>{t.symbol} {t.name}</td>
                <td className="tsp-right tsp-mono">{fmtInt(t.shares)}</td>
                <td className="tsp-right tsp-mono">{fmt2(t.price)}</td>
                <td className="tsp-right tsp-mono">{fmtInt(fee)}</td>
                <td className="tsp-right tsp-mono">{fmtInt(tax)}</td>
                <td className={`tsp-right tsp-mono ${t.type === 'buy' ? 'tsp-down' : 'tsp-up'}`}>{t.type === 'buy' ? '-' : '+'}{fmtInt(total)}</td>
                <td className="tsp-muted" style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.note || '-'}</td>
                {showOwner && <td><Tag text={t.owner || '我'} /></td>}
                <td onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <button className="tsp-icon-btn tsp-danger" onClick={() => { if(window.confirm('確定刪除此交易？')) onDelete(t.id); }} title="刪除"><Trash2 size={16} /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CashAccount({ cashTransactions, onEdit, onDelete, showOwner, totalCashBalance, onAdd }) {
  const sorted = [...cashTransactions].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
  
  return (
    <div className="tsp-cash-view">
      <div className="tsp-stats-grid" style={{ marginBottom: 16 }}>
        <StatCard label="目前戶頭可用餘額" value={money(totalCashBalance)} tone={totalCashBalance < 0 ? 'tsp-down' : ''} />
        <div className="tsp-card tsp-stat" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={onAdd}>
          <Wallet size={24} className="tsp-primary" style={{ marginBottom: 8 }} />
          <span className="tsp-stat-label">新增入金 / 出金紀錄</span>
        </div>
      </div>

      <div className="tsp-card tsp-table-wrap">
        <table className="tsp-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>類型</th>
              <th className="tsp-right">金額 (台幣)</th>
              {showOwner && <th>帳戶所有者</th>}
              <th>備註</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={6}><Empty text="尚無資金紀錄。新增入金讓您的戶頭餘額動起來吧！" /></td></tr>}
            {sorted.map(c => (
              <tr key={c.id} className="tsp-clickable-row" onClick={() => onEdit(c)} title="點擊整行編輯">
                <td className="tsp-mono">{c.date}</td>
                <td>
                  <span className={`tsp-badge ${c.type === 'deposit' ? 'tsp-up-bg tsp-up' : 'tsp-down-bg tsp-down'}`}>
                    {c.type === 'deposit' ? '入金' : '出金'}
                  </span>
                </td>
                <td className={`tsp-right tsp-mono ${c.type === 'deposit' ? 'tsp-up' : 'tsp-down'}`}>
                  {c.type === 'deposit' ? '+' : '-'}{fmtInt(c.amount)}
                </td>
                {showOwner && <td><Tag text={c.owner || '我'} /></td>}
                <td className="tsp-muted">{c.note || '-'}</td>
                <td onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <button className="tsp-icon-btn tsp-danger" onClick={() => { if(window.confirm('確定刪除此紀錄？')) onDelete(c.id); }} title="刪除"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Dividends({ dividends, onEdit, onDelete, showOwner, yearlyDividends, onAdd, totalDividend, holdingsAll }) {
  const sorted = [...dividends].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
  
  return (
    <div className="tsp-dividends-view">
      <div className="tsp-stats-grid" style={{ marginBottom: 16 }}>
        <StatCard label="累計領取股利" value={money(totalDividend)} tone="tsp-up" />
        {yearlyDividends.slice(-3).map(y => (
          <StatCard key={y.year} label={`${y.year}年 股利`} value={money(y.total)} tone="tsp-up" />
        ))}
        <div className="tsp-card tsp-stat" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={onAdd}>
          <Plus size={24} className="tsp-primary" style={{ marginBottom: 8 }} />
          <span className="tsp-stat-label">新增股利紀錄</span>
        </div>
      </div>

      <div className="tsp-card tsp-table-wrap">
        <table className="tsp-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>股票</th>
              <th className="tsp-right">配息股數</th>
              <th className="tsp-right">現金股利/股</th>
              <th className="tsp-right">股票股利/股</th>
              <th className="tsp-right">總現金股利</th>
              {showOwner && <th>持有者</th>}
              <th>備註</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={9}><Empty text="尚無股利紀錄" /></td></tr>}
            {sorted.map(d => (
              <tr key={d.id} className="tsp-clickable-row" onClick={() => onEdit(d)} title="點擊整行即可編輯此股利">
                <td className="tsp-mono">{d.date}</td>
                <td>{d.symbol} {d.name}</td>
                <td className="tsp-right tsp-mono">{fmtInt(d.shares)}</td>
                <td className="tsp-right tsp-mono">{fmt2(d.cashPerShare)}</td>
                <td className="tsp-right tsp-mono">{fmt2(d.stockPerShare)}</td>
                <td className="tsp-right tsp-mono tsp-up">+{fmtInt(d.totalCash)}</td>
                {showOwner && <td><Tag text={d.owner || '我'} /></td>}
                <td className="tsp-muted">{d.note}</td>
                <td onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <button className="tsp-icon-btn tsp-danger" onClick={() => { if(window.confirm('確定刪除？')) onDelete(d.id); }} title="刪除"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Charts({ holdings, prices, meta, symbols, chartSymbol, setChartSymbol, groupMode, setGroupMode }) {
  const currentSymbol = chartSymbol || (symbols.length > 0 ? symbols[0] : null);
  
  const historyData = useMemo(() => {
    if (!currentSymbol || !prices[currentSymbol] || !prices[currentSymbol].history) return [];
    return [...prices[currentSymbol].history].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [currentSymbol, prices]);

  const barData = groupHoldings(holdings, meta, groupMode).sort((a,b) => b.value - a.value);

  const pnlData = useMemo(() => {
    return holdings.map(h => ({ name: `${h.symbol} ${h.name}`, fullName: h.name, pnl: h.upl })).sort((a, b) => b.pnl - a.pnl);
  }, [holdings]);

  const currentHoldingAvgCost = useMemo(() => {
    const h = holdings.find(x => x.symbol === currentSymbol);
    return h ? h.avgCost : null;
  }, [currentSymbol, holdings]);

  return (
    <div className="tsp-charts-view">
      
      <div className="tsp-card tsp-panel" style={{ marginBottom: 16 }}>
        <div className="tsp-panel-head">
          <h3>各股未實現損益排行榜</h3>
        </div>
        {pnlData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={pnlData} margin={{ top: 10, right: 10, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--muted)" tick={{ fill: 'var(--muted)' }} />
              <YAxis stroke="var(--muted)" tick={{ fill: 'var(--muted)' }} tickFormatter={v => fmtInt(v / 10000) + '萬'} />
              <Tooltip formatter={v => money(v)} labelFormatter={(label) => { const item = pnlData.find(d=>d.name===label); return item ? `${item.name} ${item.fullName}` : label; }} cursor={{ fill: 'var(--panel-2)' }} contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {pnlData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.pnl > 0 ? 'var(--up)' : 'var(--down)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <Empty text="尚無持股" />}
      </div>

      <div className="tsp-card tsp-panel" style={{ marginBottom: 16 }}>
        <div className="tsp-panel-head">
          <h3>資產分佈長條圖</h3>
          <GroupToggle groupMode={groupMode} setGroupMode={setGroupMode} />
        </div>
        {barData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData} margin={{ top: 10, right: 10, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--muted)" tick={{ fill: 'var(--muted)' }} />
              <YAxis stroke="var(--muted)" tick={{ fill: 'var(--muted)' }} tickFormatter={v => fmtInt(v / 10000) + '萬'} />
              <Tooltip formatter={v => money(v)} cursor={{ fill: 'var(--panel-2)' }} contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <Empty text="尚無持股" />}
      </div>

      <div className="tsp-card tsp-panel">
        <div className="tsp-panel-head">
          <h3>個股歷史股價紀錄</h3>
          <select className="tsp-input tsp-select" style={{ width: 'auto' }} value={currentSymbol || ''} onChange={e => setChartSymbol(e.target.value)}>
            {symbols.map(s => {
               const holding = holdings.find(h => h.symbol === s);
               const nameStr = holding ? ` ${holding.name}` : '';
               return <option key={s} value={s}>{s}{nameStr}</option>;
            })}
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
              {currentHoldingAvgCost && (
                <ReferenceLine y={currentHoldingAvgCost} stroke="var(--up)" strokeDasharray="5 5" label={{ position: 'top', value: '平均成本', fill: 'var(--up)', fontSize: 12 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : <Empty text="此股票無足夠的歷史股價紀錄 (需有兩筆以上)。請使用自動或批次更新累積歷史資料。" />}
      </div>
    </div>
  );
}

function Monthly({ monthly }) {
  const [expandedMonth, setExpandedMonth] = useState(null);

  if (!monthly.length) return <Empty text="尚無月度統整資料" />;
  
  return (
    <div className="tsp-card tsp-table-wrap">
      <table className="tsp-table">
        <thead>
          <tr>
            <th>月份</th>
            <th className="tsp-right">交易次數</th>
            <th className="tsp-right">買入總額</th>
            <th className="tsp-right">賣出總額</th>
            <th className="tsp-right">已實現損益</th>
            <th className="tsp-right">領取股利</th>
            <th className="tsp-right">月度淨現金流</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {monthly.map(m => {
            const netFlow = m.sellAmt - m.buyAmt + m.dividend;
            const isExpanded = expandedMonth === m.month;
            return (
              <React.Fragment key={m.month}>
                <tr className="tsp-row-hover" style={{ cursor: 'pointer' }} onClick={() => setExpandedMonth(isExpanded ? null : m.month)}>
                  <td className="tsp-mono"><b>{m.month}</b></td>
                  <td className="tsp-right tsp-mono">{m.count}</td>
                  <td className="tsp-right tsp-mono">{fmtInt(m.buyAmt)}</td>
                  <td className="tsp-right tsp-mono">{fmtInt(m.sellAmt)}</td>
                  <td className={`tsp-right tsp-mono ${changeCls(m.realizedPL)}`}>{m.realizedPL > 0 ? '+' : ''}{fmtInt(m.realizedPL)}</td>
                  <td className="tsp-right tsp-mono tsp-up">{m.dividend > 0 ? `+${fmtInt(m.dividend)}` : 0}</td>
                  <td className={`tsp-right tsp-mono ${changeCls(netFlow)}`}>{netFlow > 0 ? '+' : ''}{fmtInt(netFlow)}</td>
                  <td className="tsp-right">
                    <button className="tsp-icon-btn" style={{ marginLeft: 'auto' }}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr style={{ background: 'var(--panel-2)' }}>
                    <td colSpan="8" style={{ padding: '16px 24px' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--muted)' }}>📅 {m.month} 資金與交易明細</h4>
                      <table className="tsp-table" style={{ background: 'var(--panel)', borderRadius: '8px', overflow: 'hidden' }}>
                        <thead>
                          <tr>
                            <th>日期</th>
                            <th>動作</th>
                            <th>標的 / 項目</th>
                            <th className="tsp-right">股數</th>
                            <th className="tsp-right">成交價/配息</th>
                            <th className="tsp-right">淨收付金額(含稅費)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.events.map((e, i) => (
                            <tr key={i}>
                              <td className="tsp-mono">{e.date}</td>
                              <td>
                                {e.isCash ? (
                                  <span className={`tsp-badge ${e.type === 'deposit' ? 'tsp-up-bg tsp-up' : 'tsp-down-bg tsp-down'}`}>
                                    {e.type === 'deposit' ? '入金' : '出金'}
                                  </span>
                                ) : e.isDiv ? (
                                  <span className="tsp-badge tsp-up-bg tsp-up">領息</span>
                                ) : e.type === 'buy' ? (
                                  <span className="tsp-badge tsp-up-bg tsp-up">買進</span>
                                ) : (
                                  <span className="tsp-badge tsp-down-bg tsp-down">賣出</span>
                                )}
                              </td>
                              <td>{e.isCash ? (e.note || '資金變動') : `${e.symbol} ${e.name}`}</td>
                              <td className="tsp-right tsp-mono">{e.isCash ? '-' : fmtInt(e.shares)}</td>
                              <td className="tsp-right tsp-mono">{e.isCash ? '-' : fmt2(e.isDiv ? e.cashPerShare : e.price)}</td>
                              <td className="tsp-right tsp-mono">
                                {e.isCash ? (
                                  <span className={e.type === 'deposit' ? 'tsp-up' : 'tsp-down'}>{e.type === 'deposit' ? '+' : '-'}{fmtInt(e.amount)}</span>
                                ) : e.isDiv ? (
                                  <span className="tsp-up">+{fmtInt(e.totalCash)}</span>
                                ) : e.type === 'buy' ? (
                                  <span className="tsp-down">-{fmtInt(e.shares * e.price + (e.fee||0) + (e.tax||0))}</span>
                                ) : (
                                  <span className="tsp-up">+{fmtInt(e.shares * e.price - (e.fee||0) - (e.tax||0))}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Compare({ data }) {
  if (data.length <= 1) return <Empty text="需有多個持有者才能進行比較。請在右上方新增持有者。" />;
  
  return (
    <div className="tsp-card tsp-table-wrap">
      <table className="tsp-table">
        <thead>
          <tr>
            <th>持有者</th>
            <th className="tsp-right">持股檔數</th>
            <th className="tsp-right">持股市值</th>
            <th className="tsp-right">戶頭現金</th>
            <th className="tsp-right">總資產</th>
            <th className="tsp-right">總成本</th>
            <th className="tsp-right">未實現損益</th>
            <th className="tsp-right">已實現損益</th>
          </tr>
        </thead>
        <tbody>
          {data.sort((a, b) => b.marketValue - a.marketValue).map(d => {
            const uplPct = d.cost > 0 ? (d.upl / d.cost) * 100 : 0;
            return (
              <tr key={d.owner}>
                <td><Tag text={d.owner} /></td>
                <td className="tsp-right tsp-mono">{d.holdingCount}</td>
                <td className="tsp-right tsp-mono">{fmtInt(d.marketValue)}</td>
                <td className="tsp-right tsp-mono">{fmtInt(d.cash)}</td>
                <td className="tsp-right tsp-mono tsp-primary" style={{fontWeight: 'bold'}}>{fmtInt(d.marketValue + d.cash)}</td>
                <td className="tsp-right tsp-mono">{fmtInt(d.cost)}</td>
                <td className={`tsp-right tsp-mono ${changeCls(d.upl)}`}>
                  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end'}}>
                    <div>{d.upl > 0 ? '+' : ''}{fmtInt(d.upl)}</div>
                    <div style={{ fontSize: 12 }}>{pct(uplPct)}</div>
                  </div>
                </td>
                <td className={`tsp-right tsp-mono ${changeCls(d.realized)}`}>
                  {d.realized > 0 ? '+' : ''}{fmtInt(d.realized)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  );
}

// -------------------------------------------------------------
// CSS 樣式定義 
// -------------------------------------------------------------
const CSS = `
:root {
  --bg: #f3f4f6;
  --panel: #ffffff;
  --panel-2: #f9fafb;
  --text: #1f2937;
  --muted: #6b7280;
  --border: #e5e7eb;
  --primary: #3b82f6;
  --primary-hover: #2563eb;
  --up: #ef4444; /* 台股紅漲 */
  --down: #10b981; /* 台股綠跌 */
  --up-bg: #fee2e2;
  --down-bg: #d1fae5;
  --warn: #f59e0b; 
  --warn-bg: #fef3c7;
  --radius: 12px;
  --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #111827;
    --panel: #1f2937;
    --panel-2: #374151;
    --text: #f9fafb;
    --muted: #9ca3af;
    --border: #374151;
    --primary: #3b82f6;
    --up: #f87171; 
    --down: #34d399;
    --up-bg: rgba(248, 113, 113, 0.2);
    --down-bg: rgba(52, 211, 153, 0.2);
    --warn: #fbbf24;
    --warn-bg: rgba(251, 191, 36, 0.15);
    --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
  }
}

.tsp-app {
  font-family: system-ui, -apple-system, sans-serif;
  background-color: var(--bg);
  color: var(--text);
  min-height: 100vh;
  box-sizing: border-box;
}

.tsp-app * { box-sizing: inherit; }
.tsp-mono { font-family: var(--font-mono); }
.tsp-muted { color: var(--muted); }
.tsp-up { color: var(--up); }
.tsp-down { color: var(--down); }
.tsp-flat { color: var(--muted); }
.tsp-warn { color: var(--warn); }
.tsp-up-bg { background-color: var(--up-bg); color: var(--up); }
.tsp-down-bg { background-color: var(--down-bg); color: var(--down); }
.tsp-warn-bg { background-color: var(--warn-bg); color: var(--warn); border: 1px solid rgba(245, 158, 11, 0.3); }
.tsp-primary { color: var(--primary); }
.tsp-danger { color: #ef4444; }

.tsp-ticker {
  background: var(--panel-2);
  border-bottom: 1px solid var(--border);
  overflow: hidden;
  white-space: nowrap;
  padding: 6px 0;
  font-size: 13px;
}
.tsp-ticker-track {
  display: inline-block;
  animation: tsp-scroll 30s linear infinite;
}
.tsp-ticker-track:hover { animation-play-state: paused; }
.tsp-ticker-item { margin-right: 32px; }
@keyframes tsp-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

.tsp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 16px 24px;
  max-width: 1200px;
  margin: 0 auto;
}
.tsp-brand { display: flex; align-items: center; gap: 16px; }
.tsp-brand-mark { background: var(--primary); color: white; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; }
.tsp-brand h1 { margin: 0; font-size: 22px; font-weight: 700; }
.tsp-brand p { margin: 4px 0 0; font-size: 13px; color: var(--muted); }
.tsp-header-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: flex-end; position: relative; z-index: 10; }

.tsp-owner-select { position: relative; display: flex; align-items: center; gap: 8px; background: var(--panel); padding: 4px 12px; border-radius: 20px; border: 1px solid var(--border); }
.tsp-owner-form { position: absolute; top: 100%; right: 0; margin-top: 8px; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 8px; display: flex; gap: 8px; box-shadow: var(--shadow); z-index: 10; }

.tsp-tabs { 
  display: flex; 
  flex-wrap: wrap; 
  justify-content: center;
  gap: 6px; 
  max-width: 1200px; 
  margin: 0 auto; 
  padding: 0 16px 16px 16px; 
  position: relative; 
  z-index: 20; 
}
.tsp-tab {
  background: var(--panel); 
  border: 1px solid var(--border); 
  border-radius: 8px;
  padding: 8px 12px; 
  font-size: 14px; 
  color: var(--muted); 
  font-weight: 600;
  cursor: pointer; 
  transition: all 0.2s; 
  white-space: nowrap;
  flex: 1 1 calc(33.333% - 12px); 
  text-align: center;
}
.tsp-tab:hover { color: var(--text); border-color: var(--muted); }
.tsp-tab.active { background: var(--primary); color: white; border-color: var(--primary); }

.tsp-main { max-width: 1200px; margin: 0 auto; padding: 0 24px 64px; }

@keyframes tspFadeIn {
  0% { opacity: 0; transform: translateX(10px); }
  100% { opacity: 1; transform: translateX(0); }
}

.tsp-btn {
  display: flex; align-items: center; gap: 6px; padding: 8px 16px; font-size: 14px; font-weight: 600;
  border-radius: 8px; border: 1px solid var(--border); background: var(--panel); color: var(--text);
  cursor: pointer; transition: all 0.2s; min-height: 38px;
}
.tsp-btn:hover { background: var(--panel-2); }
.tsp-btn-primary { background: var(--primary); color: white; border-color: var(--primary); }
.tsp-btn-primary:hover { background: var(--primary-hover); }
.tsp-icon-btn {
  background: transparent; border: none; color: var(--muted); cursor: pointer; padding: 6px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center; transition: 0.2s; min-height: 38px; min-width: 38px;
}
.tsp-icon-btn:hover { background: var(--panel-2); color: var(--text); }

.tsp-input {
  width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--panel); color: var(--text); font-size: 14px; transition: border-color 0.2s; min-height: 38px;
}
.tsp-input:focus { outline: none; border-color: var(--primary); }
.tsp-input-sm { padding: 6px 10px; font-size: 13px; }
.tsp-select { appearance: none; padding-right: 30px; cursor: pointer; background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e"); background-repeat: no-repeat; background-position: right 8px center; background-size: 16px; }

.tsp-card { background: var(--panel); border-radius: var(--radius); border: 1px solid var(--border); box-shadow: var(--shadow); overflow: hidden; }
.tsp-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
.tsp-stat { padding: 20px; display: flex; flex-direction: column; gap: 4px; }
.tsp-stat-label { font-size: 13px; color: var(--muted); font-weight: 600; }
.tsp-stat-value { font-size: 24px; font-weight: 700; }
.tsp-stat-sub { font-size: 13px; }

.tsp-dashboard-bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
@media(max-width: 768px) { .tsp-dashboard-bottom { grid-template-columns: 1fr; } }
.tsp-panel { padding: 20px; }
.tsp-panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.tsp-panel-head h3 { margin: 0; font-size: 16px; }

.tsp-toggle-group { display: flex; background: var(--panel-2); border-radius: 8px; padding: 4px; }
.tsp-toggle-group button {
  background: transparent; border: none; padding: 6px 12px; font-size: 13px; font-weight: 600; color: var(--muted);
  border-radius: 6px; cursor: pointer; transition: 0.2s; min-height: 30px;
}
.tsp-toggle-group button.active { background: var(--panel); color: var(--text); box-shadow: 0 1px 2px rgb(0 0 0 / 0.1); }

.tsp-table-wrap { overflow-x: auto; width: 100%; box-sizing: border-box; padding-bottom: 8px; -webkit-overflow-scrolling: touch; }
.tsp-table { width: 100%; min-width: 1050px; border-collapse: collapse; text-align: left; font-size: 14px; }
.tsp-table th { background: var(--panel-2); padding: 12px 14px; font-weight: 600; color: var(--muted); border-bottom: 1px solid var(--border); white-space: nowrap; }
.tsp-table td { padding: 12px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; white-space: nowrap; }
.tsp-table tr:last-child td { border-bottom: none; }
.tsp-table tbody tr { transition: background 0.2s; }
.tsp-clickable-row { cursor: pointer; }
.tsp-clickable-row:hover, .tsp-row-hover:hover { background: var(--panel-2); }
.tsp-right { text-align: right; }
.tsp-row-warn { background: rgba(239, 68, 68, 0.05) !important; }

.th-category { min-width: 150px; }
.th-alerts { min-width: 200px; }

@media (max-width: 768px) {
  .tsp-header { flex-direction: column; align-items: stretch; gap: 16px; margin-bottom: 12px; }
  .tsp-header-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; }
  .tsp-header-actions > .tsp-owner-select { grid-column: 1 / -1; }
  .tsp-btn { justify-content: center; padding: 10px; }
  
  .tsp-filters { flex-direction: column; align-items: stretch !important; gap: 12px; }
  .tsp-filters > div, .tsp-filters select { width: 100%; max-width: 100%; }
}

.tsp-symbol { font-weight: 700; font-size: 15px; }
.tsp-name { font-size: 12px; white-space: normal; min-width: 80px; }
.tsp-price-input { display: flex; align-items: center; gap: 4px; justify-content: flex-end; }
.tsp-price-input input { width: 80px; text-align: right; }
.tsp-meta-inputs { display: flex; flex-direction: column; gap: 6px; }
.tsp-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }

.tsp-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(2px); padding: 16px; }
.tsp-modal { background: var(--panel); border-radius: var(--radius); width: 100%; max-width: 500px; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1); max-height: 90vh; overflow-y: auto; }
.tsp-modal-head { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid var(--border); }
.tsp-modal-head h3 { margin: 0; font-size: 18px; }
.tsp-form { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.tsp-form label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--muted); }
.tsp-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.tsp-textarea { resize: vertical; min-height: 120px; font-family: var(--font-mono); }
.tsp-form-submit { margin-top: 8px; justify-content: center; padding: 12px; }
.tsp-hint { font-size: 13px; color: var(--muted); margin: 0; line-height: 1.5; }

.tsp-type-toggle { display: flex; gap: 8px; margin-bottom: 8px; }
.tsp-type-toggle button { flex: 1; padding: 12px; border: 2px solid var(--border); background: transparent; border-radius: 8px; font-weight: bold; cursor: pointer; color: var(--muted); transition: 0.2s; }
.tsp-type-toggle button.active { border-color: currentColor; }

.tsp-empty { padding: 48px 24px; text-align: center; color: var(--muted); font-size: 15px; }
.tsp-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: var(--muted); height: 100vh; font-size: 16px; font-weight: bold; }
.tsp-spin { animation: tsp-spin 1s linear infinite; }
@keyframes tsp-spin { 100% { transform: rotate(360deg); } }
.tsp-toast { position: fixed; bottom: 24px; right: 24px; background: var(--primary); color: white; padding: 12px 24px; border-radius: 8px; box-shadow: var(--shadow); z-index: 1000; animation: tsp-slide-up 0.3s ease-out; font-weight: bold; letter-spacing: 0.5px; }
@keyframes tsp-slide-up { 0% { transform: translateY(100%); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }

.tsp-pie-wrap { display: flex; flex-direction: column; align-items: center; }
.tsp-legend { width: 100%; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; margin-top: 16px; }
.tsp-legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.tsp-dot { width: 10px; height: 10px; border-radius: 50%; }

.tsp-alerts-list { display: flex; flex-direction: column; gap: 12px; }
.tsp-alert-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; }

.tsp-filters { padding: 16px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border); background: var(--panel-2); flex-wrap: wrap; }
.tsp-filters select { width: 160px; }
`;