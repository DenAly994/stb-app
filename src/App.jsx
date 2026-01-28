import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  doc, deleteDoc, serverTimestamp, setDoc, updateDoc, writeBatch, getDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Shield, RefreshCw, Crown, Gem, Award, 
  Zap, HardDrive, Trash2, 
  MessageSquare, LayoutDashboard, Database, 
  ArrowRight, Search, Users, Settings,
  BellRing, Smartphone, Filter, 
  PlusCircle, RotateCcw, Copy, 
  Navigation, Mail, TerminalSquare,
  ListPlus, Wallet, ArrowUpRight, Receipt, FileText,
  Flame, Star, Info, Target,
  Clock, Layers, Bell, FileCode, Upload, Send, UserCheck, Sparkles, UserCog, LogOut, XCircle,
  Eye, EyeOff, Cloud, CloudOff, Save, Check, Wifi, AlertTriangle, Lock,
  Printer, Skull, FileDown, BarChart3, TrendingUp, TrendingDown, Activity, SendHorizontal,
  Edit3, Bot, Shuffle, CheckCircle2, Moon, Sun, Calendar, FileSpreadsheet, Ticket, RefreshCcw
} from 'lucide-react';

// --- CONFIGURATION: GUNAKAN ENV VITE ---
// CATATAN KETUA: Saat di PC (Vite), UNCOMMENT bagian import.meta.env di bawah ini
// dan hapus string kosong "".
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

// --- GLOBAL CONSTANTS ---
const DEFAULT_APP_ID = "stb-sewa-tool-v3-executive";
const APP_NAME = "STB - PRO MANAGE";

// --- FIREBASE INITIALIZATION ---
let firebaseApp, auth, db;
const isConfigProvided = firebaseConfig && firebaseConfig.apiKey !== "";

try {
  if (isConfigProvided) {
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  } else if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    firebaseApp = getApps().length === 0 ? initializeApp(JSON.parse(__firebase_config)) : getApps()[0];
  }
  
  if (firebaseApp) {
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
  }
} catch (e) {
  console.error("Firebase Init Critical Error:", e);
}

const App = () => {
  // --- STATE: DARK MODE ---
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('stb_dark_mode');
    return saved ? JSON.parse(saved) : false;
  });

  // --- STATE: AUTH & SYSTEM ---
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [appId, setAppId] = useState(typeof __app_id !== 'undefined' ? __app_id : DEFAULT_APP_ID);
  const [isSettingsSynced, setIsSettingsSynced] = useState(false);
  const [dbStatus, setDbStatus] = useState('connecting');

  // --- STATE: DATA ---
  const [history, setHistory] = useState([]);
  const [crmClients, setCrmClients] = useState([]); // NEW: Persistent CRM Data
  const [logs, setLogs] = useState([]);
  const [toast, setToast] = useState(null);
  
  // --- STATE: FORMS & FILTERS ---
  const [selectedTier, setSelectedTier] = useState('Bronze');
  const [clientName, setClientName] = useState('');
  const [clientWA, setClientWA] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [generatedData, setGeneratedData] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [existingMember, setExistingMember] = useState(null);
  
  // --- STATE: SEARCH & FILTER ---
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortConfig, setSortConfig] = useState('newest');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

  // --- STATE: MODALS & EDITING ---
  const [editingItem, setEditingItem] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [showCrmTemplateEditor, setShowCrmTemplateEditor] = useState(false);
  const fileInputRef = useRef(null);

  // --- STATE: SETTINGS ---
  const [revenueTarget, setRevenueTarget] = useState(10000000);
  const [apiKeys, setApiKeys] = useState({
    fonnteToken: '',
    telegramToken: '',
    telegramChatId: '',
    warningDays: 3,
    waTemplate: `🚀 *${APP_NAME}* 🚀\n------------------------------------------\n✅ *AKTIVASI BERHASIL*\nRef: #INV-{orderNum}\n\nTerima kasih {nama}, paket Anda telah aktif!\n\n📦 *Paket:* {paket}\n🌐 *Unit ID:* \`{id}\`\n🔑 *Password:* \`{pass}\`\n📅 *Masa Aktif:* s/d {expired}\n\n*Penting:* Simpan pesan ini untuk klaim dukungan atau perpanjangan.`,
    reminderTemplate: `⚠️ *URGENT: LAYANAN BERAKHIR* ⚠️\n------------------------------------------\nHalo *{nama}*, paket *{paket}* Anda akan berakhir pada:\n\n📅 *Tanggal:* {expired}\n\nSegera hubungi admin untuk perpanjangan agar akses tidak terputus. Terima kasih!`,
    crmTemplate: `Halo *{nama}*! 👋\n\nKami dari ${APP_NAME} ingin menyapa Anda. Apakah ada kendala dengan layanan kami? Ada promo khusus untuk perpanjangan hari ini lho!\n\nBalas pesan ini untuk info lebih lanjut.`,
    telegramTemplate: `🤖 *Laporan Transaksi Baru*\n\n👤 Klien: {nama}\n📦 Paket: {paket}\n💰 Nominal: {amount}\n📝 Tipe: {type}\n📅 Exp: {expired}\n\n_System Auto-Report_`
  });

  const [customTiers, setCustomTiers] = useState({
    Bronze: { price: 100000, months: 3, prefix: 'STB-BRZ', accent: 'bg-orange-600', icon: 'Award', color: 'text-orange-600 bg-orange-50 border-orange-200' },
    Silver: { price: 300000, months: 6, prefix: 'STB-SLV', accent: 'bg-slate-600', icon: 'Zap', color: 'text-slate-600 bg-slate-50 border-slate-200' },
    Gold: { price: 600000, months: 9, prefix: 'STB-GLD', accent: 'bg-yellow-600', icon: 'Crown', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
    Diamond: { price: 900000, months: 12, prefix: 'STB-DMD', accent: 'bg-blue-600', icon: 'Gem', color: 'text-blue-600 bg-blue-50 border-blue-200' }
  });

  const iconMap = { Award, Zap, Crown, Gem, Shield, Star };

  // --- INTELLIGENCE CORE ---
  const intelligence = useMemo(() => {
    const now = Date.now();
    const revenue = history.reduce((acc, curr) => acc + (customTiers[curr.tier]?.price || 0), 0);
    const potentialRevenue = history
        .filter(h => h.expiryTimestamp > now && h.expiryTimestamp <= now + (30 * 24 * 60 * 60 * 1000))
        .reduce((acc, curr) => acc + (customTiers[curr.tier]?.price || 0), 0);
    const expiredCount = history.filter(h => h.expiryTimestamp < now).length;

    const monthlyStats = history.reduce((acc, curr) => {
        if (!curr.createdAt) return acc;
        const date = new Date(curr.createdAt.seconds * 1000);
        const key = date.toLocaleString('default', { month: 'short', year: '2-digit' });
        const sortKey = date.getTime();
        if (!acc[key]) acc[key] = { name: key, value: 0, sortKey, count: 0 };
        acc[key].value += (customTiers[curr.tier]?.price || 0);
        acc[key].count += 1;
        return acc;
    }, {});

    const chartData = Object.values(monthlyStats).sort((a, b) => a.sortKey - b.sortKey).slice(-6);
    const currentMonthData = chartData[chartData.length - 1] || { value: 0 };
    const lastMonthData = chartData[chartData.length - 2] || { value: 0 };
    
    let trendPercentage = 0;
    if (lastMonthData.value > 0) {
        trendPercentage = ((currentMonthData.value - lastMonthData.value) / lastMonthData.value) * 100;
    } else if (currentMonthData.value > 0) {
        trendPercentage = 100;
    }

    const clientLTV = history.reduce((acc, curr) => {
        const price = customTiers[curr.tier]?.price || 0;
        acc[curr.client] = (acc[curr.client] || 0) + price;
        return acc;
    }, {});

    const clientStats = history.reduce((acc, curr) => {
        acc[curr.client] = (acc[curr.client] || 0) + 1;
        return acc;
    }, {});

    const tierCounts = history.reduce((acc, curr) => {
        acc[curr.tier] = (acc[curr.tier] || 0) + 1;
        return acc;
    }, {});
    const hotTier = Object.keys(tierCounts).reduce((a, b) => (tierCounts[a] || 0) > (tierCounts[b] || 0) ? a : b, 'Bronze');
    
    return { 
        revenue, potentialRevenue, clientStats, clientLTV, 
        hotTier, expiredCount,
        chartData, trendPercentage
    };
  }, [history, customTiers, selectedTier]);

  const clientSuggestions = useMemo(() => {
    // Combine names from history AND crmClients for better suggestions
    const historyNames = history.map(h => h.client);
    const crmNames = crmClients.map(c => c.client);
    return [...new Set([...historyNames, ...crmNames])].sort();
  }, [history, crmClients]);

  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => {
      if (sortConfig === 'name') return a.client.localeCompare(b.client);
      if (sortConfig === 'expiry') return (a.expiryTimestamp || 0) - (b.expiryTimestamp || 0);
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });
  }, [history, sortConfig]);

  const filteredHistory = useMemo(() => {
    return sortedHistory.filter(item => {
      const target = `${item.client} ${item.name} ${item.notes || ''}`.toLowerCase();
      const matchesSearch = target.includes(searchTerm.toLowerCase());
      const isExpired = Date.now() > (item.expiryTimestamp || 0);
      const matchesTier = tierFilter === 'all' || item.tier === tierFilter;
      const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' && !isExpired) || (filterStatus === 'expired' && isExpired);
      
      const itemDate = item.createdAt?.seconds ? item.createdAt.seconds * 1000 : 0;
      const startDate = dateFilter.start ? new Date(dateFilter.start).getTime() : 0;
      const endDate = dateFilter.end ? new Date(dateFilter.end).setHours(23,59,59,999) : Infinity;
      const matchesDate = itemDate >= startDate && itemDate <= endDate;

      return matchesSearch && matchesTier && matchesStatus && matchesDate;
    });
  }, [sortedHistory, searchTerm, tierFilter, filterStatus, dateFilter]);
  
  // --- UTILS ---
  const formatWA = (phone) => {
    let cleaned = String(phone || '').replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
    else if (cleaned.startsWith('8')) cleaned = '62' + cleaned;
    return cleaned;
  };

  const toTitleCase = (str) => {
    if (!str) return '';
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  };

  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);

  const showToast = (msg, type = 'success') => {
    setToast({ msg: String(msg), type });
    setTimeout(() => setToast(null), 3000);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Teks disalin ke clipboard!");
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        showToast("Teks disalin!");
      } catch (e) {
        showToast("Gagal menyalin text", "error");
      }
      document.body.removeChild(textArea);
    }
  };

  const parseTemplate = (template, data) => {
    return String(template || '')
      .replace(/{nama}/g, data.client || '')
      .replace(/{id}/g, data.name || '')
      .replace(/{pass}/g, data.pass || '')
      .replace(/{paket}/g, data.tier || '')
      .replace(/{expired}/g, data.expiryText || '')
      .replace(/{orderNum}/g, data.orderNum || '000')
      .replace(/{amount}/g, data.amount ? formatIDR(data.amount) : 'Rp -')
      .replace(/{type}/g, data.type || 'Update');
  };

  // --- NEW: ID GENERATOR HELPER ---
  const generateNetworkName = (tierKey) => {
      const tier = customTiers[tierKey] || customTiers['Bronze'];
      return `${tier.prefix}-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  };

  // --- COMMUNICATION HELPERS ---
  const sendFonnte = async (target, message) => {
    if (!apiKeys.fonnteToken) {
        showToast("Token Fonnte kosong! Membuka WA Web...", "error");
        window.open(`https://wa.me/${target}?text=${encodeURIComponent(message)}`);
        return false;
    }
    
    setLoading(true);
    try {
        const data = new URLSearchParams();
        data.append('target', target);
        data.append('message', message);

        const res = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: { 'Authorization': apiKeys.fonnteToken },
            body: data
        });
        const resData = await res.json();
        
        if (resData.status) {
            showToast("Pesan Terkirim via Fonnte! 🚀");
            return true;
        } else {
            console.error("Fonnte API Fail:", resData);
            showToast("Gagal kirim Fonnte, membuka WA Web...", "error");
            window.open(`https://wa.me/${target}?text=${encodeURIComponent(message)}`);
            return false;
        }
    } catch (e) {
        console.error("Fonnte Network Error:", e);
        showToast("Koneksi Error, membuka WA Web...", "error");
        window.open(`https://wa.me/${target}?text=${encodeURIComponent(message)}`);
        return false;
    } finally {
        setLoading(false);
    }
  };

  const sendTelegram = async (message) => {
      if (!apiKeys.telegramToken || !apiKeys.telegramChatId) return;
      try {
          const url = `https://api.telegram.org/bot${apiKeys.telegramToken}/sendMessage`;
          await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: apiKeys.telegramChatId, text: message, parse_mode: 'Markdown' })
          });
      } catch (e) { console.error("Telegram Error (CORS/Net):", e); }
  };

  // --- EFFECTS ---
  // Dark Mode Persistence
  useEffect(() => {
    localStorage.setItem('stb_dark_mode', JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (clientWA.length >= 10) {
      const cleanInput = formatWA(clientWA);
      const match = history
        .filter(h => h.phone === cleanInput)
        .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0];
      
      if (match) {
        setDuplicateWarning(`Member Terdeteksi: ${match.client} (${intelligence.clientStats[match.client] || 0}x Order)`);
        setExistingMember(match);
        if (!clientName) setClientName(match.client); 
      } else { 
        setDuplicateWarning(null); 
        setExistingMember(null);
      }
    } else { 
      setDuplicateWarning(null); 
      setExistingMember(null);
    }
  }, [clientWA, history, intelligence.clientStats]);

  useEffect(() => {
    if (clientName.length >= 3 && !clientWA) {
      const match = history
        .filter(h => h.client.toLowerCase() === clientName.toLowerCase())
        .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0];
      if (match) {
        setClientWA(match.phone);
        setDuplicateWarning(`Data ${match.client} ditemukan. WA terisi otomatis.`);
        setTimeout(() => setDuplicateWarning(null), 3000);
      }
    }
  }, [clientName]); 

  useEffect(() => {
    const cachedSettings = localStorage.getItem(`stb_settings_${appId}`);
    if (cachedSettings) {
        try {
            const parsed = JSON.parse(cachedSettings);
            if (parsed.apiKeys) setApiKeys(prev => ({...prev, ...parsed.apiKeys}));
            if (parsed.revenueTarget) setRevenueTarget(Number(parsed.revenueTarget));
            if (parsed.tiers) setCustomTiers(parsed.tiers);
        } catch (e) { console.error("Cache parsing error", e); }
    }
  }, [appId]);

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      setIsAuthLoading(true);
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth Fail", err); } finally { setIsAuthLoading(false); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); if (u) setDbStatus('connected'); });
    return () => unsubscribe();
  }, []);

  // --- MAIN DATABASE LISTENER ---
  useEffect(() => {
    if (!user || !db) return;
    const unsubHistory = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'history'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistory(data);
    }, (err) => { console.error("History sync error", err); setDbStatus('error'); });
    
    // CRM Clients Listener (NEW)
    const unsubClients = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCrmClients(data);
    });

    const unsubLogs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)).slice(0, 15));
    });
    const unsubSettings = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'settings'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setApiKeys(prev => ({ ...prev, ...data }));
        if (data.revenueTarget) setRevenueTarget(Number(data.revenueTarget));
        if (data.tiers) setCustomTiers(prev => ({...prev, ...data.tiers}));
        localStorage.setItem(`stb_settings_${appId}`, JSON.stringify(data));
        setIsSettingsSynced(true);
      }
    });
    return () => { unsubHistory(); unsubClients(); unsubSettings(); unsubLogs(); };
  }, [user, appId]);

  // --- ACTIONS ---
  const ensureAuth = async () => {
    if (auth.currentUser) return auth.currentUser;
    try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            const cred = await signInWithCustomToken(auth, __initial_auth_token);
            return cred.user;
        } else {
            const cred = await signInAnonymously(auth);
            return cred.user;
        }
    } catch (e) {
        throw new Error("Gagal login otomatis. Cek koneksi.");
    }
  };

  const handleSaveSettings = async (specificMsg = "Settings Saved Successfully!") => {
    if (!db) return showToast("Database offline", "error");
    setLoading(true);
    try {
        await ensureAuth();
        const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'settings');
        const payload = { ...apiKeys, revenueTarget, tiers: customTiers };
        await setDoc(configRef, payload, { merge: true });
        localStorage.setItem(`stb_settings_${appId}`, JSON.stringify(payload));
        setIsSettingsSynced(true);
        showToast(specificMsg);
        setShowCrmTemplateEditor(false); 
    } catch (e) {
        console.error("Save Error:", e);
        showToast("Gagal menyimpan: " + e.message, "error");
    } finally { setLoading(false); }
  };

  // --- NEW: PERSISTENT CLIENT STATS UPDATE HELPER ---
  const updateClientStats = async (clientData, amount, newExpiryTimestamp) => {
      if (!db) return;
      const phoneKey = formatWA(clientData.phone);
      if (!phoneKey) return; 
      
      const clientRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', phoneKey);
      try {
          const docSnap = await getDoc(clientRef);
          const current = docSnap.exists() ? docSnap.data() : { totalSpend: 0, transactionCount: 0, latestExpiry: 0 };
          
          await setDoc(clientRef, {
              client: toTitleCase(clientData.client),
              phone: phoneKey,
              totalSpend: Number(current.totalSpend || 0) + Number(amount || 0),
              transactionCount: Number(current.transactionCount || 0) + 1,
              latestExpiry: Math.max(newExpiryTimestamp, current.latestExpiry || 0),
              lastUpdated: serverTimestamp()
          }, { merge: true });
      } catch (e) { console.error("CRM Update Error:", e); }
  };

  const handleSmartRenewFromGenerator = async () => {
    if (!db || loading || !existingMember) return;
    const tierData = customTiers[selectedTier];
    if (!tierData) return showToast("Paket tidak valid", "error");

    setLoading(true);
    try {
        await ensureAuth();
        const now = Date.now();
        let lastExpiry = existingMember.expiryTimestamp && typeof existingMember.expiryTimestamp === 'number' ? existingMember.expiryTimestamp : 0;
        const isActive = lastExpiry > now;
        const basisTime = isActive ? lastExpiry : now;
        const newExpiry = new Date(basisTime);
        newExpiry.setMonth(newExpiry.getMonth() + parseInt(tierData.months));
        
        const options = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
        const expiryText = newExpiry.toLocaleDateString('id-ID', options);

        let finalName = existingMember.name;
        let idChanged = false;
        
        if (selectedTier !== existingMember.tier) {
            finalName = generateNetworkName(selectedTier);
            idChanged = true;
        }

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'history', existingMember.id), {
            expiryTimestamp: newExpiry.getTime(), 
            expiryText: expiryText, 
            tier: selectedTier,
            name: finalName
        });
        
        // Update Persistent CRM
        await updateClientStats(existingMember, tierData.price, newExpiry.getTime());

        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), {
            type: idChanged ? 'Upgrade Paket' : 'Perpanjang (Gen)', 
            client: existingMember.client, 
            tier: selectedTier, 
            amount: tierData.price, 
            timestamp: serverTimestamp(), 
            targetId: existingMember.id
        });

        const tempEntry = { ...existingMember, name: finalName, tier: selectedTier, expiryText: expiryText, amount: tierData.price, type: idChanged ? 'Upgrade & Renew' : 'Renewal' };
        
        if (apiKeys.fonnteToken) {
             const msg = parseTemplate(apiKeys.waTemplate, tempEntry);
             fetch('https://api.fonnte.com/send', { method: 'POST', headers: { 'Authorization': apiKeys.fonnteToken }, body: new URLSearchParams({ target: existingMember.phone, message: msg }) }).catch(console.error);
        }
        sendTelegram(parseTemplate(apiKeys.telegramTemplate, tempEntry));

        setGeneratedData(tempEntry); setClientName(''); setClientWA(''); setClientNotes(''); setExistingMember(null);
        showToast(isActive ? "Member Diperpanjang (Akumulasi)!" : "Member Diaktifkan Kembali!");
    } catch(e) { showToast("Gagal Perpanjang: " + e.message, "error"); } finally { setLoading(false); }
  };

  const handleGenerate = async () => {
    if (!db) return showToast("Database belum siap!", "error");
    if (!clientName.trim()) return showToast("Nama klien wajib diisi!", "error");
    if (loading) return;
    
    setLoading(true);
    try {
      const currentUser = await ensureAuth();
      const tier = customTiers[selectedTier];
      const networkName = generateNetworkName(selectedTier); 
      
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + tier.months);
      
      const options = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
      const expiryString = expiryDate.toLocaleDateString('id-ID', options);

      const entry = {
        client: toTitleCase(clientName), 
        phone: formatWA(clientWA), 
        notes: clientNotes, 
        name: networkName, 
        pass: Math.random().toString(36).substring(2, 10).toUpperCase(), 
        tier: selectedTier, 
        expiryTimestamp: expiryDate.getTime(),
        expiryText: expiryString,
        createdAt: serverTimestamp(), 
        creatorId: currentUser.uid, 
        orderNum: history.length + 1
      };

      const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'history'), entry);
      
      // Update Persistent CRM
      await updateClientStats(entry, tier.price, entry.expiryTimestamp);

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), {
          type: 'Aktivasi Baru', client: entry.client, tier: entry.tier, amount: tier.price, timestamp: serverTimestamp(), targetId: docRef.id
      });

      const fullEntry = { ...entry, amount: tier.price, type: 'New Activation' };

      if (apiKeys.fonnteToken) {
          const msg = parseTemplate(apiKeys.waTemplate, fullEntry);
          fetch('https://api.fonnte.com/send', { method: 'POST', headers: { 'Authorization': apiKeys.fonnteToken }, body: new URLSearchParams({ target: entry.phone, message: msg }) }).catch((err) => console.log("WA error:", err));
      }
      sendTelegram(parseTemplate(apiKeys.telegramTemplate, fullEntry));

      setGeneratedData(entry); setClientName(''); setClientWA(''); setClientNotes('');
      showToast("Token Generated & Saved!");
    } catch (e) { showToast("Gagal Generate: " + e.message, "error"); } finally { setLoading(false); }
  };

  const handleRenew = async (item) => {
    if (!db || loading) return;
    setLoading(true);
    try {
        await ensureAuth();
        const tierData = customTiers[item.tier];
        const now = Date.now();
        let lastExpiry = item.expiryTimestamp && typeof item.expiryTimestamp === 'number' ? item.expiryTimestamp : 0;
        const isActive = lastExpiry > now;
        const basisTime = isActive ? lastExpiry : now;
        const newExpiry = new Date(basisTime);
        newExpiry.setMonth(newExpiry.getMonth() + parseInt(tierData.months));
        
        const options = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
        const expiryText = newExpiry.toLocaleDateString('id-ID', options);

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'history', item.id), {
            expiryTimestamp: newExpiry.getTime(), expiryText: expiryText
        });
        
        // Update Persistent CRM
        await updateClientStats(item, tierData.price, newExpiry.getTime());

        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), {
            type: 'Perpanjang', client: item.client, tier: item.tier, amount: tierData.price, timestamp: serverTimestamp(), targetId: item.id
        });
        
        const tempEntry = { ...item, expiryText: expiryText, amount: tierData.price, type: 'Quick Renew' };
        sendTelegram(parseTemplate(apiKeys.telegramTemplate, tempEntry));

        showToast(isActive ? `Terakumulasi s/d ${expiryText}` : `Diaktifkan s/d ${expiryText}`);
    } catch (e) { showToast("Gagal Update: " + e.message, "error"); } finally { setLoading(false); }
  };

  // --- NEW: SYNC CRM FUNCTION ---
  const handleSyncCRM = async () => {
      if (!db || history.length === 0) return;
      if (!window.confirm("Sinkronisasi akan memindai semua data history dan memperbarui database CRM. Lanjutkan?")) return;
      setLoading(true);
      try {
          const groups = {};
          history.forEach(h => {
              const p = formatWA(h.phone);
              if(!p) return;
              if(!groups[p]) groups[p] = { client: h.client, phone: p, totalSpend: 0, transactionCount: 0, latestExpiry: 0 };
              
              const price = customTiers[h.tier]?.price || 0;
              groups[p].totalSpend += price;
              groups[p].transactionCount += 1;
              if (h.expiryTimestamp > groups[p].latestExpiry) groups[p].latestExpiry = h.expiryTimestamp;
          });

          const batch = writeBatch(db);
          let count = 0;
          Object.values(groups).forEach(data => {
              // Create doc for each client
              const ref = doc(db, 'artifacts', appId, 'public', 'data', 'clients', data.phone);
              batch.set(ref, { ...data, lastUpdated: serverTimestamp() }, { merge: true });
              count++;
          });
          
          await batch.commit();
          showToast(`Berhasil Sinkronisasi ${count} Klien ke CRM!`);
      } catch (e) { showToast("Sync Gagal: " + e.message, "error"); } finally { setLoading(false); }
  };

  // --- NEW: DELETE CLIENT FUNCTION ---
  const handleDeleteClient = async (clientId) => {
      if(!window.confirm("Hapus klien ini dari CRM permanen?")) return;
      try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', clientId));
          showToast("Klien dihapus dari CRM");
      } catch(e) { showToast("Gagal hapus", "error"); }
  };

  const handleCRMFollowUp = async (profile) => {
      const msg = parseTemplate(apiKeys.crmTemplate || "Halo {nama}, ayo sewa lagi!", { client: profile.client });
      await sendFonnte(profile.phone, msg);
  };

  const handleDatabaseMessage = async (item) => {
      const isExpired = Date.now() > (item.expiryTimestamp || 0);
      let msg = "";
      if (isExpired) { msg = parseTemplate(apiKeys.reminderTemplate, item); } 
      else { msg = parseTemplate(apiKeys.waTemplate, item); }
      if (window.confirm(`Kirim pesan ke ${item.client} via Fonnte?`)) {
          await sendFonnte(item.phone, msg);
      }
  };

  const handleUpdate = async () => {
    if (!db || !editingItem) return;
    try {
      await ensureAuth();
      
      let finalName = editingItem.name;
      const targetTier = customTiers[editingItem.tier];
      
      if (targetTier && !finalName.startsWith(targetTier.prefix)) {
          finalName = generateNetworkName(editingItem.tier); 
      }

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'history', editingItem.id), {
        client: editingItem.client, 
        phone: editingItem.phone, 
        notes: editingItem.notes, 
        tier: editingItem.tier,
        name: finalName 
      });
      showToast("Data Berhasil Diupdate!"); setEditingItem(null);
    } catch (e) { showToast("Gagal Update: " + e.message, "error"); }
  };

  const handleBatchPurge = async () => {
      if (!db || loading) return;
      const expiredItems = history.filter(h => (h.expiryTimestamp || 0) < Date.now());
      if (expiredItems.length === 0) return showToast("Tidak ada data expired.", "error");
      setLoading(true);
      try {
          await ensureAuth();
          const batch = writeBatch(db);
          const toDelete = expiredItems.slice(0, 450);
          toDelete.forEach(item => { batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'history', item.id)); });
          await batch.commit();
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), {
            type: 'System Purge', client: 'SYSTEM', tier: 'Reaper Protocol', amount: 0, timestamp: serverTimestamp(), targetId: 'BATCH'
          });
          setShowPurgeModal(false); showToast(`Berhasil memusnahkan ${toDelete.length} data expired! Sadis! 💀`);
      } catch (e) { showToast("Gagal memusnahkan: " + e.message, "error"); } finally { setLoading(false); }
  };

  const handlePrintReport = () => { setPrintMode(true); setTimeout(() => { window.print(); setPrintMode(false); }, 500); };
  
  const handlePrintReceipt = (item) => {
      setReceiptData(item);
      setTimeout(() => {
          window.print();
          setReceiptData(null);
      }, 500);
  };

  const exportToCSV = () => {
      if(history.length === 0) return showToast("Tidak ada data untuk diexport", "error");
      
      const headers = ["Client Name,WhatsApp,Tier,Unit ID,Notes,Expiry Date,Status,Created At"];
      const rows = history.map(item => {
          const status = Date.now() > (item.expiryTimestamp || 0) ? "EXPIRED" : "ACTIVE";
          const created = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('id-ID') : '-';
          const clean = (text) => `"${String(text || '').replace(/"/g, '""')}"`;
          
          return `${clean(item.client)},${clean(item.phone)},${clean(item.tier)},${clean(item.name)},${clean(item.notes)},${clean(item.expiryText)},${clean(status)},${clean(created)}`;
      });
      
      const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `STB_REPORT_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Laporan Excel (CSV) Berhasil Didownload!");
  };

  const handleImportJSON = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.history || !Array.isArray(data.history)) throw new Error("Format JSON Salah");
        setLoading(true);
        await ensureAuth();
        if (data.settings) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'settings'), data.settings, { merge: true });
        const batch = writeBatch(db);
        let count = 0;
        data.history.forEach(item => {
              if(count < 490) { 
                  const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'history', item.id || Math.random().toString(36).substr(2,9));
                  batch.set(docRef, item);
                  count++;
              }
        });
        await batch.commit();
        showToast(`Restore Berhasil: ${count} Data`);
      } catch (err) { showToast("Gagal Import: " + err.message, "error"); } finally { setLoading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
    };
    reader.readAsText(file);
  };

  const exportToJSON = () => {
    const backupData = { appName: APP_NAME, exportDate: new Date().toISOString(), history: history, logs: logs, settings: { apiKeys, revenueTarget, customTiers } };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `STB_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Backup JSON Berhasil!");
  };

  if (isAuthLoading) return <LoadingScreen />;
  if (!firebaseApp) return <ConfigNeededUI />;

  if (receiptData) {
      return (
          <div className="bg-white text-black font-mono text-[10px] p-2 max-w-[58mm] mx-auto">
              <div className="text-center mb-4 border-b-2 border-black pb-2">
                  <h1 className="font-black text-sm">{APP_NAME}</h1>
                  <p>Bukti Transaksi Sewa</p>
              </div>
              <div className="space-y-1 mb-4">
                  <div className="flex justify-between"><span>Tgl:</span><span>{new Date().toLocaleDateString('id-ID')}</span></div>
                  <div className="flex justify-between"><span>Ref:</span><span>#{receiptData.orderNum || '000'}</span></div>
                  <div className="flex justify-between font-bold"><span>Klien:</span><span>{receiptData.client}</span></div>
                  <div className="flex justify-between"><span>Paket:</span><span>{receiptData.tier}</span></div>
              </div>
              <div className="border-t border-dashed border-black py-2 mb-2">
                  <p className="font-bold">Unit ID:</p>
                  <p className="text-xs">{receiptData.name}</p>
                  <p className="font-bold mt-1">Password:</p>
                  <p className="text-xs">{receiptData.pass}</p>
              </div>
              <div className="border-t-2 border-black pt-2 mb-4 text-center">
                  <p className="font-bold">Masa Aktif s/d:</p>
                  <p className="text-sm font-black">{receiptData.expiryText}</p>
              </div>
              <div className="text-center text-[8px]">
                  <p>Simpan struk ini sebagai bukti sah.</p>
                  <p>Terima Kasih!</p>
              </div>
          </div>
      );
  }

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white dark-mode-active' : 'bg-[#F8FAFC] text-slate-900 selection:bg-indigo-100'} flex flex-col lg:flex-row overflow-hidden`}>
      
      {printMode && (
          <div className="fixed inset-0 z-[9999] bg-white p-8 overflow-auto animate-in fade-in text-slate-900">
              <div className="max-w-5xl mx-auto border-b-4 border-slate-900 pb-6 mb-8 flex justify-between items-end">
                  <div>
                      <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">{APP_NAME}</h1>
                      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Executive Summary Report</p>
                  </div>
                  <div className="text-right">
                      <p className="text-xs font-bold text-slate-400 uppercase">Generated On</p>
                      <p className="text-lg font-black">{new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</p>
                  </div>
              </div>
              <div className="grid grid-cols-4 gap-6 mb-12">
                  <div className="p-6 bg-slate-50 border border-slate-200">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Total Revenue</p>
                      <p className="text-2xl font-black">{formatIDR(intelligence.revenue)}</p>
                  </div>
                  <div className="p-6 bg-slate-50 border border-slate-200">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Active Units</p>
                      <p className="text-2xl font-black">{history.filter(h => h.expiryTimestamp > Date.now()).length}</p>
                  </div>
                  <div className="p-6 bg-slate-50 border border-slate-200">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Expired Units</p>
                      <p className="text-2xl font-black text-red-600">{intelligence.expiredCount}</p>
                  </div>
                  <div className="p-6 bg-slate-50 border border-slate-200">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Total Clients</p>
                      <p className="text-2xl font-black">{intelligence.clientStats ? Object.keys(intelligence.clientStats).length : 0}</p>
                  </div>
              </div>
              <table className="w-full text-left border-collapse">
                  <thead>
                      <tr className="border-b-2 border-slate-900">
                          <th className="py-3 text-xs font-black uppercase">Client Name</th>
                          <th className="py-3 text-xs font-black uppercase">Tier / Package</th>
                          <th className="py-3 text-xs font-black uppercase">Unit ID</th>
                          <th className="py-3 text-xs font-black uppercase">Status</th>
                          <th className="py-3 text-xs font-black uppercase text-right">Expiration</th>
                      </tr>
                  </thead>
                  <tbody>
                      {[...history].sort((a, b) => a.client.localeCompare(b.client)).map((item, idx) => {
                          const isExpired = Date.now() > (item.expiryTimestamp || 0);
                          return (
                              <tr key={item.id} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-slate-50/50' : ''}`}>
                                  <td className="py-3 text-xs font-bold text-slate-700">{item.client}</td>
                                  <td className="py-3 text-xs font-medium text-slate-500">{item.tier}</td>
                                  <td className="py-3 text-xs font-mono text-slate-500">{item.name}</td>
                                  <td className="py-3"><span className={`text-[10px] px-2 py-1 rounded font-black uppercase ${isExpired ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{isExpired ? 'EXPIRED' : 'ACTIVE'}</span></td>
                                  <td className="py-3 text-xs font-bold text-slate-700 text-right">{item.expiryText}</td>
                              </tr>
                          )
                      })}
                  </tbody>
              </table>
          </div>
      )}

      <aside className={`hidden lg:flex lg:w-72 flex-col transition-colors duration-300 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} border-r px-6 py-10 z-50 shadow-sm relative ${printMode ? 'hidden' : ''}`}>
        <div className="flex items-center gap-4 mb-14 px-2 cursor-pointer group" onClick={() => setActiveTab('dashboard')}>
            <div className={`p-3 rounded-2xl shadow-xl transition-colors duration-500 ${darkMode ? 'bg-indigo-600' : 'bg-slate-950 group-hover:bg-indigo-600'}`}><Layers className="w-6 h-6 text-white" /></div>
            <div><h1 className={`font-black text-xl tracking-tighter leading-none uppercase ${darkMode ? 'text-white' : 'text-slate-800'}`}>STB</h1><p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">PRO SUITE</p></div>
        </div>
        <nav className="flex-1 space-y-2">
          <SideLink icon={LayoutDashboard} label="Dashboard Hub" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} darkMode={darkMode} />
          <SideLink icon={PlusCircle} label="Aktivasi Baru" active={activeTab === 'generator'} onClick={() => setActiveTab('generator')} darkMode={darkMode} />
          <SideLink icon={Database} label="Data Database" active={activeTab === 'history'} onClick={() => setActiveTab('history')} darkMode={darkMode} />
          <SideLink icon={UserCog} label="CRM Klien" active={activeTab === 'crm'} onClick={() => setActiveTab('crm')} darkMode={darkMode} />
          <SideLink icon={Settings} label="Pengaturan Pro" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} darkMode={darkMode} />
        </nav>
        <div className="mt-auto">
            <div className={`p-6 rounded-[2.5rem] border mb-6 relative overflow-hidden transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-indigo-50 border-indigo-100'}`}>
                <div className="absolute top-0 right-0 p-4 opacity-10"><Target className="w-12 h-12" /></div>
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-3 text-center">Revenue Target</p>
                <div className="h-2 bg-indigo-200/50 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-indigo-600 transition-all duration-1000 shadow-[0_0_10px_rgba(79,70,229,0.5)]" style={{ width: `${Math.min((intelligence.revenue / revenueTarget) * 100, 100)}%` }} />
                </div>
                <div className="flex justify-between px-1"><span className={`text-xl font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>{(intelligence.revenue / revenueTarget * 100).toFixed(0)}%</span><span className="text-[9px] font-bold text-slate-400 mt-1.5">ACHIEVED</span></div>
            </div>
            
            <div className="flex items-center justify-between gap-2 mb-6">
                <button onClick={() => setDarkMode(!darkMode)} className={`flex-1 p-4 rounded-2xl flex items-center justify-center gap-2 transition-all ${darkMode ? 'bg-slate-800 text-yellow-400 shadow-inner' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                    {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    <span className="text-[9px] font-black uppercase tracking-widest">{darkMode ? 'LIGHT' : 'DARK'}</span>
                </button>
            </div>

            <div className={`text-[9px] font-black uppercase text-center tracking-widest flex items-center justify-center gap-2 ${dbStatus === 'connected' ? 'text-emerald-500' : 'text-red-500 animate-pulse'}`}>
                {dbStatus === 'connected' ? <Wifi className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />} {dbStatus === 'connected' ? 'SYSTEM ONLINE' : 'DISCONNECTED'}
            </div>
        </div>
      </aside>

      <main className={`flex-1 overflow-y-auto custom-scrollbar h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-950' : 'bg-slate-50/50'} relative ${printMode ? 'hidden' : ''}`}>
        <header className={`lg:hidden flex justify-between items-center backdrop-blur-md p-5 sticky top-0 z-[40] border-b transition-colors ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-100'}`}>
             <div className="flex items-center gap-3"><div className={`p-2 rounded-xl ${darkMode ? 'bg-indigo-600' : 'bg-slate-950'}`}><Layers className="w-5 h-5 text-white" /></div><h1 className="font-black text-lg tracking-tighter uppercase">STB PRO</h1></div>
             <div className="flex gap-2">
                <button onClick={() => setDarkMode(!darkMode)} className={`p-2.5 rounded-xl ${darkMode ? 'bg-slate-800 text-yellow-400' : 'bg-slate-100 text-slate-400'}`}>{darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
                <button onClick={() => setActiveTab('settings')} className={`p-2.5 rounded-xl ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-400'}`}><Settings className="w-5 h-5" /></button>
             </div>
        </header>

        <div className="p-6 lg:p-12 max-w-7xl mx-auto pb-32 lg:pb-12">
          {activeTab === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in duration-700 slide-in-from-bottom-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                    <StatBlock label="Total Units" value={history.length} icon={HardDrive} color="text-blue-600" bg="bg-blue-50" darkMode={darkMode} />
                    <StatBlock label="Active Clients" value={history.filter(h => h.expiryTimestamp > Date.now()).length} icon={Shield} color="text-emerald-600" bg="bg-emerald-50" darkMode={darkMode} />
                    <StatBlock label="Soon Expired" value={history.filter(h => (h.expiryTimestamp - Date.now()) / (1000*60*60*24) <= apiKeys.warningDays && h.expiryTimestamp > Date.now()).length} icon={Bell} color="text-orange-600" bg="bg-orange-50" darkMode={darkMode} />
                    <StatBlock label="Total Revenue" value={formatIDR(intelligence.revenue)} icon={Wallet} color="text-indigo-600" bg="bg-indigo-50" darkMode={darkMode} />
                </div>
                <div className={`rounded-[3.5rem] p-8 lg:p-12 border shadow-sm relative overflow-hidden group transition-colors ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <div className="flex justify-between items-start mb-8 relative z-10">
                        <div><h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-3 text-slate-400 mb-2"><BarChart3 className="w-5 h-5 text-indigo-600" /> Analytics Command</h3><h2 className={`text-3xl lg:text-4xl font-black tracking-tighter ${darkMode ? 'text-white' : 'text-slate-900'}`}>Income Trend</h2></div>
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${intelligence.trendPercentage >= 0 ? (darkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : (darkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600')}`}>
                            {intelligence.trendPercentage >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />} {Math.abs(intelligence.trendPercentage).toFixed(1)}% vs Last Month
                        </div>
                    </div>
                    <div className="h-64 w-full relative z-10">
                        {intelligence.chartData.length > 0 ? (
                            <div className="w-full h-full flex items-end justify-between gap-2">
                                {intelligence.chartData.map((data, idx) => {
                                    const maxVal = Math.max(...intelligence.chartData.map(d => d.value), 1);
                                    const height = (data.value / maxVal) * 100;
                                    return (
                                        <div key={idx} className="flex-1 flex flex-col items-center gap-3 group/bar">
                                            <div className={`w-full rounded-t-2xl relative flex items-end overflow-hidden h-full transition-colors ${darkMode ? 'bg-slate-800 group-hover/bar:bg-slate-700' : 'bg-slate-50 group-hover/bar:bg-slate-100'}`}>
                                                <div className="w-full bg-indigo-600 rounded-t-2xl transition-all duration-1000 ease-out relative group-hover/bar:bg-indigo-500" style={{ height: `${height}%` }}>
                                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-20">{formatIDR(data.value)}</div>
                                                </div>
                                            </div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase">{data.name}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : <div className="h-full flex items-center justify-center text-slate-300 font-bold text-xs uppercase tracking-widest bg-slate-50 rounded-3xl border border-dashed border-slate-200">No Enough Data for Analytics</div>}
                    </div>
                </div>
                
                {/* --- RECENT ACTIVITY FULL WIDTH --- */}
                <section className={`p-8 lg:p-10 rounded-[2.5rem] border shadow-sm relative mt-10 transition-colors ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                      <div className="flex justify-between items-center mb-8 px-2"><h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-4 text-slate-400"><Receipt className="w-5 h-5 text-indigo-600" /> Recent Activity</h3></div>
                    <div className="space-y-3">
                        {logs.length === 0 ? <div className="py-20 text-center text-slate-200 font-black uppercase text-[10px] tracking-widest">No logs detected</div> : logs.map(log => (
                            <div key={log.id} className={`flex items-center justify-between p-5 rounded-[2rem] border transition-all group ${darkMode ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800' : 'bg-slate-50/50 border-slate-100/50 hover:bg-white hover:shadow-md'}`}>
                                <div className="flex items-center gap-5">
                                    <div className={`p-3 rounded-2xl transition-colors ${log.type.includes('Purge') ? (darkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-600') : log.type.includes('Baru') ? (darkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600') : (darkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600')}`}>
                                        {log.type.includes('Purge') ? <Skull className="w-5 h-5" /> : log.type.includes('Baru') ? <PlusCircle className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                                    </div>
                                    <div><p className={`text-sm font-black uppercase leading-none mb-1.5 ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{log.client}</p><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{log.type} • {log.tier}</p></div>
                                </div>
                                <div className="text-right"><p className="text-sm font-black text-indigo-600 mb-1">{formatIDR(log.amount)}</p><p className="text-[9px] font-bold text-slate-400 uppercase">{log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Recent'}</p></div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
          )}

          {activeTab === 'generator' && (
            <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-8 duration-700">
                <section className={`rounded-[3.5rem] p-8 lg:p-16 shadow-2xl border relative overflow-hidden transition-colors ${darkMode ? 'bg-slate-900 border-slate-800 shadow-black/50' : 'bg-white border-slate-100 shadow-slate-200'}`}>
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                    <div className="mb-12 text-center"><h2 className={`text-4xl lg:text-5xl font-black tracking-tighter uppercase mb-4 leading-none ${darkMode ? 'text-white' : 'text-slate-900'}`}>Activation Core</h2><p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.4em]">Secure Generation Protocol</p></div>
                    <div className="grid md:grid-cols-2 gap-8 lg:gap-12 mb-12">
                        <div className="space-y-8">
                            <FormGroup label="WhatsApp ID" icon={Smartphone} darkMode={darkMode}>
                                <div className="relative">
                                    <input type="text" placeholder="e.g. 08123..." value={clientWA} onChange={(e) => setClientWA(e.target.value)} className={`form-input-apex ${duplicateWarning ? 'border-orange-200 bg-orange-50/20' : ''}`} />
                                    {clientWA && <button onClick={() => {setClientWA(''); setClientName(''); setDuplicateWarning(null); setExistingMember(null);}} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                                </div>
                                {duplicateWarning && <div className="mt-4 p-4 bg-orange-50 border border-orange-100 rounded-[1.5rem] text-[10px] font-black text-orange-600 uppercase flex items-center gap-3 animate-pulse"><Info className="w-4 h-4" /> {duplicateWarning}</div>}
                            </FormGroup>
                            <FormGroup label="Client Name" icon={Users} darkMode={darkMode}>
                                <input type="text" placeholder="Client Name" value={clientName} onChange={(e) => setClientName(e.target.value)} list="client-suggestions" className="form-input-apex" autoComplete="off" />
                                <datalist id="client-suggestions">{clientSuggestions.map((name, idx) => (<option key={idx} value={name} />))}</datalist>
                            </FormGroup>
                        </div>
                        <FormGroup label="System Notes" icon={FileText} darkMode={darkMode}><textarea rows="7" placeholder="ID Unit, Location, etc..." value={clientNotes} onChange={(e) => setClientNotes(e.target.value)} className="form-input-apex resize-none shadow-inner" /></FormGroup>
                    </div>
                    <div className="mb-12">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center block mb-8">Select Tier Protocol</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
                            {Object.entries(customTiers).map(([name, info]) => {
                                const IconComp = iconMap[info.icon] || Award;
                                const isHot = intelligence.hotTier === name;
                                return (
                                    <button key={name} onClick={() => setSelectedTier(name)} className={`p-6 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-4 relative overflow-hidden group ${selectedTier === name ? `${info.color} scale-105 shadow-xl ring-4 ring-indigo-50` : darkMode ? 'bg-slate-800 border-slate-800 text-slate-400 hover:border-slate-700' : 'bg-slate-50 border-slate-50 text-slate-400 hover:border-slate-200 hover:bg-white'}`}>
                                            {isHot && <div className="absolute top-4 right-4"><Flame className="w-3 h-3 text-orange-500 fill-orange-500 animate-pulse" /></div>}
                                            <IconComp className={`w-8 h-8 ${selectedTier === name ? 'text-indigo-600' : 'text-slate-300 group-hover:text-slate-400'} transition-colors`} />
                                            <div className="text-center"><span className="font-black text-[10px] uppercase tracking-widest block mb-1">{name}</span><span className="text-[9px] font-bold opacity-60">{formatIDR(info.price)}</span></div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    {existingMember ? (
                        <div className="grid md:grid-cols-2 gap-4">
                            <button onClick={handleSmartRenewFromGenerator} disabled={loading} className="w-full bg-emerald-600 text-white py-8 rounded-[2.5rem] font-black text-sm tracking-widest flex items-center justify-center gap-4 hover:bg-emerald-700 transition-all active:scale-95 shadow-xl disabled:opacity-70 disabled:cursor-not-allowed">{loading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <>PERPANJANG (AKUMULASI) <RotateCcw className="w-6 h-6" /></>}</button>
                            <button onClick={handleGenerate} disabled={loading} className="w-full bg-slate-900 text-white py-8 rounded-[2.5rem] font-black text-sm tracking-widest flex items-center justify-center gap-4 hover:bg-slate-800 transition-all active:scale-95 shadow-xl disabled:opacity-70 disabled:cursor-not-allowed">{loading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <>BUAT UNIT BARU <PlusCircle className="w-6 h-6" /></>}</button>
                        </div>
                    ) : (
                        <button onClick={handleGenerate} disabled={loading} className="w-full bg-slate-950 text-white py-8 rounded-[2.5rem] font-black text-sm tracking-widest flex items-center justify-center gap-4 hover:bg-indigo-600 transition-all active:scale-95 shadow-xl disabled:opacity-70 disabled:cursor-not-allowed">{loading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <>PROCEED GENERATION <ArrowRight className="w-6 h-6" /></>}</button>
                    )}
                    {generatedData && (
                        <div className="mt-16 p-10 bg-indigo-600 text-white rounded-[3rem] animate-in zoom-in slide-in-from-bottom-4 shadow-2xl border-4 border-indigo-500/50">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 relative z-10">
                                <div><div className="bg-white/10 text-white border border-white/20 px-4 py-1.5 rounded-full text-[9px] font-black uppercase mb-4 shadow-lg flex items-center gap-2 w-fit"><UserCheck className="w-4 h-4" /> Protocol Ready</div><h4 className="text-4xl font-black uppercase tracking-tighter">{generatedData.client}</h4></div>
                                <div className="flex gap-3">
                                    <button onClick={() => window.open(`https://wa.me/${generatedData.phone}`)} className="p-5 bg-white text-indigo-600 rounded-2xl shadow-xl hover:scale-110 transition-all"><MessageSquare className="w-6 h-6" /></button>
                                    <button onClick={() => copyToClipboard(parseTemplate(apiKeys.waTemplate, generatedData))} className="p-5 bg-white text-slate-800 rounded-2xl shadow-xl hover:scale-110 transition-all border border-slate-100"><Copy className="w-6 h-6" /></button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-white/10 pt-8 relative z-10">
                                <div><p className="text-[10px] font-black text-indigo-200 uppercase mb-2 leading-none tracking-widest">Access Key ID</p><p className="font-mono text-xl font-black tracking-tight">{generatedData.name}</p></div>
                                <div><p className="text-[10px] font-black text-indigo-200 uppercase mb-2 tracking-widest leading-none">Expired Date</p><p className="font-black text-xl tracking-tight">{generatedData.expiryText}</p></div>
                            </div>
                        </div>
                    )}
                </section>
            </div>
          )}

          {activeTab === 'crm' && (
            <div className="animate-in fade-in duration-700">
                <div className={`rounded-[3.5rem] p-8 lg:p-12 shadow-2xl border relative transition-colors ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <div className="flex justify-between items-center mb-12">
                        <div><h2 className={`text-3xl font-black uppercase tracking-tighter mb-2 ${darkMode ? 'text-white' : 'text-slate-950'}`}>CRM Intelligence</h2><p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.4em]">Customer Relationship Management</p></div>
                        <div className="flex gap-3">
                            <button onClick={handleSyncCRM} className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase shadow-sm transition-all flex items-center gap-2 border ${darkMode ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}><RefreshCcw className="w-4 h-4" /> Sync History to CRM</button>
                            <button onClick={() => setShowCrmTemplateEditor(!showCrmTemplateEditor)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-sm transition-all flex items-center gap-2 border ${darkMode ? 'bg-slate-800 text-indigo-400 border-slate-700' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'}`}><Edit3 className="w-4 h-4" /> Edit Template</button>
                        </div>
                    </div>
                    {showCrmTemplateEditor && (
                        <div className={`mb-12 p-8 border rounded-[2.5rem] animate-in slide-in-from-top-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-indigo-100'}`}>
                            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest flex items-center gap-2"><MessageSquare className="w-4 h-4 text-indigo-600" /> Follow-Up Message Template</h4>
                            <textarea rows="6" value={apiKeys.crmTemplate} onChange={(e) => setApiKeys(p => ({ ...p, crmTemplate: e.target.value }))} className="form-input-apex text-xs font-mono leading-relaxed shadow-inner" />
                            <div className="flex justify-end"><button onClick={() => handleSaveSettings("CRM Template Saved!")} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"><Save className="w-4 h-4" /> Save Template</button></div>
                        </div>
                    )}
                    <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar-apex">
                        {crmClients.length === 0 ? 
                            <div className="text-center py-20">
                                <p className="text-slate-300 font-black uppercase text-sm tracking-widest mb-4">No CRM data</p>
                                <button onClick={handleSyncCRM} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700">Sync Data from History Now</button>
                            </div> 
                        :
                        crmClients.sort((a,b) => b.totalSpend - a.totalSpend).map((profile, idx) => {
                            const isActive = profile.latestExpiry > Date.now();
                            return (
                                <div key={profile.id} className={`p-6 rounded-[2.5rem] border transition-all flex flex-col md:flex-row items-center gap-6 group ${darkMode ? 'bg-slate-800/50 border-transparent hover:bg-slate-800 hover:border-slate-700' : 'bg-slate-50 hover:bg-white hover:shadow-xl border-transparent hover:border-indigo-100'}`}>
                                    <div className={`w-12 h-12 rounded-2xl font-black flex items-center justify-center transition-colors ${darkMode ? 'bg-slate-700 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white' : 'bg-slate-200 text-slate-500 group-hover:bg-indigo-600 group-hover:text-white'}`}>{idx + 1}</div>
                                    <div className="flex-1 text-center md:text-left">
                                        <div className="flex items-center justify-center md:justify-start gap-3">
                                            <h4 className={`font-black text-lg uppercase ${darkMode ? 'text-white' : 'text-slate-900'}`}>{profile.client}</h4>
                                            <span className={`text-[8px] font-bold px-2 py-0.5 rounded uppercase ${isActive ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>{isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest"><Wallet className="w-3 h-3 inline mr-1" /> Total: {formatIDR(profile.totalSpend)} • {profile.transactionCount}x Transaksi</p>
                                    </div>
                                    <button onClick={() => handleDeleteClient(profile.id)} className={`p-3 rounded-2xl transition-all ${darkMode ? 'bg-slate-900 text-red-400 hover:bg-red-900/30' : 'bg-white text-red-400 hover:bg-red-50 border border-slate-100'}`}><Trash2 className="w-4 h-4" /></button>
                                    <button onClick={() => handleCRMFollowUp(profile)} className={`border-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-sm transition-all flex items-center gap-2 ${darkMode ? 'bg-slate-900 text-indigo-400 border-slate-700 hover:border-indigo-500' : 'bg-white text-indigo-600 border-indigo-50 hover:bg-indigo-600 hover:text-white hover:border-indigo-600'}`}><Send className="w-3 h-3" /> Fonnte CRM</button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="animate-in fade-in duration-700">
                <div className={`rounded-[3.5rem] p-8 lg:p-12 shadow-2xl border relative transition-colors ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 mb-12">
                        <div><h2 className={`text-3xl font-black uppercase tracking-tighter mb-2 leading-none ${darkMode ? 'text-white' : 'text-slate-950'}`}>Database Hub</h2><p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.4em]">Integrated Database Management</p></div>
                        <div className="flex flex-wrap gap-3 items-center justify-end">
                            <button onClick={handlePrintReport} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg transition-all flex items-center gap-2 ${darkMode ? 'bg-slate-800 text-white hover:bg-indigo-600' : 'bg-slate-950 text-white hover:bg-indigo-600'}`}><Printer className="w-4 h-4" /> PDF Report</button>
                            <button onClick={exportToCSV} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> Excel Export</button>
                            <button onClick={() => setShowPurgeModal(true)} className="bg-red-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-red-700 transition-all flex items-center gap-2 border border-red-500"><Skull className="w-4 h-4" /> Purge</button>
                            
                            <select value={tierFilter} onChange={(e)=>setTierFilter(e.target.value)} className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase outline-none border transition-colors cursor-pointer ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 focus:border-indigo-300'}`}><option value="all">All Tiers</option>{Object.keys(customTiers).map(tier => <option key={tier} value={tier}>{tier}</option>)}</select>
                            <select value={sortConfig} onChange={(e)=>setSortConfig(e.target.value)} className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase outline-none border transition-colors cursor-pointer ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 focus:border-indigo-300'}`}><option value="newest">Terbaru</option><option value="expiry">Sisa Hari</option><option value="name">Nama Klien</option></select>
                            
                            <button onClick={() => fileInputRef.current.click()} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-sm transition-all flex items-center gap-2 ${darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}><Upload className="w-4 h-4" /> Import</button>
                            <input type="file" ref={fileInputRef} onChange={handleImportJSON} className="hidden" accept=".json" />
                            <button onClick={exportToJSON} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-slate-900 transition-all flex items-center gap-2"><FileCode className="w-4 h-4" /> Backup JSON</button>
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 mb-10">
                        <div className="relative group flex-1">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5 group-focus-within:text-indigo-500 transition-colors" />
                            <input type="text" placeholder="Search client identity, unit ID, or notes..." className={`w-full pl-16 pr-8 py-5 rounded-[2rem] outline-none font-bold border-2 transition-all text-sm shadow-inner ${darkMode ? 'bg-slate-800 border-transparent focus:border-indigo-500 text-white placeholder-slate-500' : 'bg-slate-50 border-transparent focus:bg-white focus:border-indigo-100 text-slate-700'}`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        <div className={`flex items-center gap-2 px-6 py-2 rounded-[2rem] border-2 transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                            <Calendar className="w-5 h-5 text-indigo-500" />
                            <input type="date" value={dateFilter.start} onChange={(e)=>setDateFilter({...dateFilter, start: e.target.value})} className="bg-transparent outline-none text-xs font-bold uppercase w-28" />
                            <span className="text-slate-400">-</span>
                            <input type="date" value={dateFilter.end} onChange={(e)=>setDateFilter({...dateFilter, end: e.target.value})} className="bg-transparent outline-none text-xs font-bold uppercase w-28" />
                        </div>
                    </div>
                    <div className="space-y-5 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar-apex">
                        {filteredHistory.map(item => {
                            const isExpired = Date.now() > (item.expiryTimestamp || 0);
                            const ltvValue = intelligence.clientLTV[item.client] || 0;
                            const TierIcon = iconMap[customTiers[item.tier]?.icon] || Shield;
                            return (
                                <div key={item.id} className={`p-8 rounded-[3rem] border-2 transition-all flex flex-col xl:flex-row items-center gap-8 group relative ${darkMode ? 'bg-slate-800/50 border-transparent hover:bg-slate-800 hover:border-indigo-500/50' : 'bg-slate-50/50 border-transparent hover:bg-white hover:shadow-xl hover:border-indigo-100'}`}>
                                    <div className={`p-6 rounded-[2rem] ${customTiers[item.tier]?.accent || 'bg-slate-400'} text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}><TierIcon className="w-8 h-8" /></div>
                                    <div className="flex-1 min-w-0 text-center xl:text-left w-full">
                                        <div className="flex flex-col xl:flex-row items-center justify-center xl:justify-start gap-3 mb-3">
                                            {/* --- UPDATE: MENAMPILKAN NAMA & WA --- */}
                                            <div className="text-center xl:text-left">
                                                <h4 className={`font-black text-xl uppercase truncate tracking-tight leading-none ${darkMode ? 'text-white' : 'text-slate-900'}`}>{item.client}</h4>
                                                <p className="text-[11px] font-mono font-bold text-slate-500 mt-1 flex items-center justify-center xl:justify-start gap-1">
                                                    <Smartphone className="w-3 h-3" /> {item.phone}
                                                </p>
                                            </div>
                                            
                                            {/* Badge Status */}
                                            <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest border ${isExpired ? (darkMode ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-red-50 text-red-500 border-red-100') : (darkMode ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' : 'bg-emerald-50 text-emerald-600 border-emerald-100')}`}>
                                                {isExpired ? 'EXPIRED' : 'ACTIVE'}
                                            </span>
                                        </div>

                                        {/* Info Tier & LTV tetap sama */}
                                        <div className="flex flex-wrap justify-center xl:justify-start gap-x-8 gap-y-4 mt-4 px-2">
                                            <div className="flex items-center gap-3">
                                                <Target className="w-5 h-5 text-slate-300" />
                                                <div className="flex flex-col text-left">
                                                    <span className={`text-xs font-black leading-none ${darkMode ? 'text-slate-300' : 'text-slate-900'}`}>{item.tier}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">{item.name}</span>
                                                </div>
                                            </div>
                                            
                                            {/* --- UPDATE: TAMPILAN TANGGAL EXPIRED DIPERJELAS --- */}
                                            <div className="flex items-center gap-3">
                                                <Clock className="w-5 h-5 text-indigo-300" />
                                                <div className="flex flex-col text-left">
                                                    <span className={`text-xs font-black leading-none ${isExpired ? 'text-red-600' : 'text-indigo-600'}`}>
                                                        {item.expiryText}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">MASA AKTIF</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 w-full xl:w-auto justify-center">
                                        <ActionBtn icon={Ticket} color={darkMode ? "bg-orange-900/30 text-orange-400 border-orange-800" : "bg-orange-50 text-orange-600 border-orange-100"} onClick={() => handlePrintReceipt(item)} />
                                        <ActionBtn icon={SendHorizontal} color={darkMode ? "bg-indigo-900/30 text-indigo-400 border-indigo-800" : "bg-indigo-50 text-indigo-600 border-indigo-100"} onClick={() => handleDatabaseMessage(item)} />
                                        <ActionBtn icon={Copy} color={darkMode ? "bg-slate-700 text-slate-300 border-slate-600" : "bg-white text-slate-600 border-slate-200"} onClick={() => copyToClipboard(parseTemplate(apiKeys.waTemplate, item))} />
                                        <ActionBtn icon={RotateCcw} color={darkMode ? "bg-emerald-900/30 text-emerald-400 border-emerald-800" : "bg-emerald-50 text-emerald-600 border-emerald-100"} onClick={() => handleRenew(item)} />
                                        <ActionBtn icon={Settings} color={darkMode ? "bg-slate-700 text-slate-300 border-slate-600" : "bg-slate-100 text-slate-600 border-slate-200"} onClick={() => setEditingItem(item)} />
                                        <ActionBtn icon={Trash2} color={darkMode ? "bg-red-900/30 text-red-400 border-red-800" : "bg-red-50 text-red-600 border-red-100"} onClick={() => setShowDeleteModal(item.id)} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-8 duration-700 pb-24">
                <div className={`rounded-[3.5rem] p-8 lg:p-16 shadow-2xl border transition-colors ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <div className="flex justify-between items-center mb-12">
                         <h3 className={`text-3xl font-black flex items-center gap-4 uppercase tracking-tighter leading-none ${darkMode ? 'text-white' : 'text-slate-800'}`}><TerminalSquare className="w-10 h-10 text-indigo-600" /> System Control</h3>
                         <div className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border ${isSettingsSynced ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>{isSettingsSynced ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />} {isSettingsSynced ? 'Synced Cloud' : 'Local Mode'}</div>
                    </div>
                    <div className="space-y-12">
                        <section className="p-8 bg-slate-950 rounded-[2.5rem] text-white shadow-2xl relative">
                            <div className="flex justify-between items-center mb-8">
                                <h4 className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.4em] flex items-center gap-3"><ListPlus className="w-4 h-4" /> Tier Configuration</h4>
                                <button onClick={()=>handleSaveSettings("Tiers Config Updated!")} className="text-[9px] font-black uppercase tracking-widest bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition-colors flex items-center gap-2"><Save className="w-3 h-3" /> Save Tiers</button>
                            </div>
                            <div className="grid md:grid-cols-2 gap-6">
                                {Object.keys(customTiers).map(t => (
                                    <div key={t} className="p-6 bg-white/5 rounded-[2rem] border border-white/10 space-y-4 hover:bg-white/10 transition-colors">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-black uppercase text-white tracking-tight">{t}</span>
                                            <div className="flex gap-1">{['Award', 'Zap', 'Crown', 'Gem'].map(iconName => (<button key={iconName} onClick={() => setCustomTiers(p => ({...p, [t]: {...p[t], icon: iconName}}))} className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${customTiers[t].icon === iconName ? 'bg-indigo-600 shadow-md scale-110' : 'text-slate-600 hover:text-slate-300'}`}><span className="text-[8px] font-black">{iconName[0]}</span></button>))}</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1"><label className="text-[8px] font-black text-indigo-300 uppercase ml-2">Rate (Rp)</label><input type="number" value={customTiers[t].price} onChange={(e)=>setCustomTiers(p=>({...p, [t]: {...p[t], price: Number(e.target.value)}}))} className="w-full bg-slate-900 border border-white/20 rounded-xl px-4 py-2 font-bold text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                            <div className="space-y-1"><label className="text-[8px] font-black text-indigo-300 uppercase ml-2">Months</label><input type="number" value={customTiers[t].months} onChange={(e)=>setCustomTiers(p=>({...p, [t]: {...p[t], months: Number(e.target.value)}}))} className="w-full bg-slate-900 border border-white/20 rounded-xl px-4 py-2 font-bold text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                        <div className="flex justify-end"><button onClick={() => setShowSecrets(!showSecrets)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 flex items-center gap-2">{showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {showSecrets ? 'Hide Secrets' : 'Show Secrets'}</button></div>
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className={`p-8 rounded-[2.5rem] border shadow-inner relative group transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="flex justify-between items-center mb-6"><h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-3"><Smartphone className="w-4 h-4 text-indigo-600" /> Fonnte Engine</h4><button onClick={()=>handleSaveSettings("Fonnte Token Saved!")} className={`text-[9px] font-black uppercase tracking-widest border px-4 py-2 rounded-full transition-colors flex items-center gap-2 shadow-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-300 hover:text-white' : 'bg-white border-slate-200 hover:border-indigo-400 hover:text-indigo-600'}`}><Save className="w-3 h-3" /> Quick Save</button></div>
                                <input type={showSecrets ? "text" : "password"} value={apiKeys.fonnteToken} onChange={(e)=>setApiKeys(p=>({...p, fonnteToken: e.target.value}))} className="form-input-apex shadow-sm" placeholder="Paste Fonnte Token Here" />
                            </div>
                            <div className={`p-8 rounded-[2.5rem] border shadow-inner relative group transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="flex justify-between items-center mb-6"><h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-3"><Navigation className="w-4 h-4 text-indigo-600" /> Telegram Bot</h4><button onClick={()=>handleSaveSettings("Telegram Config Saved!")} className={`text-[9px] font-black uppercase tracking-widest border px-4 py-2 rounded-full transition-colors flex items-center gap-2 shadow-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-300 hover:text-white' : 'bg-white border-slate-200 hover:border-indigo-400 hover:text-indigo-600'}`}><Save className="w-3 h-3" /> Quick Save</button></div>
                                <div className="space-y-4">
                                    <input type={showSecrets ? "text" : "password"} value={apiKeys.telegramToken} onChange={(e)=>setApiKeys(p=>({...p, telegramToken: e.target.value}))} className="form-input-apex shadow-sm" placeholder="Bot Token" />
                                    <input type="text" value={apiKeys.telegramChatId} onChange={(e)=>setApiKeys(p=>({...p, telegramChatId: e.target.value}))} className="form-input-apex shadow-sm" placeholder="Chat ID" />
                                </div>
                            </div>
                        </div>
                        {/* --- NEW: TELEGRAM NOTIFICATION TEMPLATE --- */}
                        <div className={`p-8 rounded-[2.5rem] border shadow-inner transition-colors ${darkMode ? 'bg-indigo-900/20 border-indigo-800' : 'bg-indigo-50/50 border-indigo-100'}`}>
                            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-6 flex items-center gap-3"><Bot className="w-4 h-4 text-indigo-600" /> Telegram Notification Template</h4>
                            <textarea rows="5" value={apiKeys.telegramTemplate} onChange={(e)=>setApiKeys(p=>({...p, telegramTemplate: e.target.value}))} className={`form-input-apex text-xs font-mono leading-relaxed border-transparent focus:border-indigo-300 ${darkMode ? 'bg-slate-800 text-white' : 'bg-white'}`} placeholder="Template pesan untuk bot telegram..." />
                        </div>
                        <div className="grid lg:grid-cols-2 gap-8">
                             <div className="space-y-4"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 flex items-center gap-2"><Mail className="w-4 h-4 text-indigo-600" /> WA Activation Layout</label><textarea rows="8" value={apiKeys.waTemplate} onChange={(e)=>setApiKeys(p=>({...p, waTemplate: e.target.value}))} className="form-input-apex text-xs font-mono leading-relaxed border-transparent" /></div>
                             <div className="space-y-4"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 flex items-center gap-2"><BellRing className="w-4 h-4 text-indigo-600" /> WA Reminder Layout</label><textarea rows="8" value={apiKeys.reminderTemplate} onChange={(e)=>setApiKeys(p=>({...p, reminderTemplate: e.target.value}))} className="form-input-apex text-xs font-mono leading-relaxed border-transparent" /></div>
                        </div>
                        <button onClick={() => handleSaveSettings("All System Settings Deployed!")} disabled={loading} className="w-full py-8 bg-slate-950 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.4em] hover:bg-indigo-600 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-4">
                            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} {loading ? "DEPLOYING..." : "DEPLOY & SAVE ALL SETTINGS"}
                        </button>
                    </div>
                </div>
            </div>
          )}
        </div>

        {/* --- TOAST & MOBILE NAV --- */}
        {toast && (<div className={`fixed bottom-10 right-10 z-[100] px-8 py-5 rounded-2xl shadow-2xl font-black uppercase text-xs tracking-widest animate-in slide-in-from-right duration-300 flex items-center gap-4 ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-slate-900 text-white'}`}>{toast.type === 'error' ? <Info className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}{toast.msg}</div>)}
        <nav className={`lg:hidden fixed bottom-6 left-6 right-6 z-[90] backdrop-blur-xl rounded-[2.5rem] p-3 flex justify-around border shadow-2xl ${darkMode ? 'bg-slate-900/95 border-slate-800 shadow-black/50' : 'bg-white/95 border-white/10 shadow-slate-900/10'}`}>
            <MobileIcon icon={LayoutDashboard} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} darkMode={darkMode} />
            <MobileIcon icon={PlusCircle} active={activeTab === 'generator'} onClick={() => setActiveTab('generator')} darkMode={darkMode} />
            <MobileIcon icon={Database} active={activeTab === 'history'} onClick={() => setActiveTab('history')} darkMode={darkMode} />
            <MobileIcon icon={Settings} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} darkMode={darkMode} />
        </nav>
      </main>

      {/* --- MODALS --- */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[500] flex items-center justify-center p-6">
          <div className={`rounded-[3rem] p-10 max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-300 ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
             <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><Trash2 className="text-red-500 w-10 h-10" /></div>
             <h3 className={`text-2xl font-black mb-3 uppercase tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>Destroy Data?</h3>
             <p className="text-slate-400 text-xs mb-8 italic">Aksi ini permanen. Member akan dihapus dari database.</p>
             <div className="flex gap-4">
                <button onClick={() => setShowDeleteModal(null)} className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest ${darkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Batal</button>
                <button onClick={async () => {
                   try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'history', showDeleteModal)); setShowDeleteModal(null); showToast("Data dimusnahkan!", "error"); } catch(e) { showToast("Gagal hapus", "error"); }
                }} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-200 hover:bg-red-700">Hapus</button>
             </div>
          </div>
        </div>
      )}
      
      {showPurgeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[500] flex items-center justify-center p-6">
          <div className={`rounded-[3rem] p-12 max-w-md w-full text-center shadow-2xl animate-in zoom-in duration-300 border-4 border-red-100 ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
             <div className="bg-red-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner animate-pulse"><Skull className="text-red-600 w-12 h-12" /></div>
             <h3 className={`text-3xl font-black mb-4 uppercase tracking-tighter leading-none ${darkMode ? 'text-white' : 'text-slate-900'}`}>THE REAPER PROTOCOL</h3>
             <p className="text-slate-500 text-sm mb-4 font-bold">Apakah Anda yakin ingin memusnahkan semua data expired?</p>
             <div className={`p-4 rounded-2xl mb-8 border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Eliminasi</p>
                 <p className="text-4xl font-black text-red-600 mt-1">{intelligence.expiredCount} <span className="text-sm text-slate-400">USERS</span></p>
             </div>
             <div className="flex gap-4">
                <button onClick={() => setShowPurgeModal(false)} className={`flex-1 py-5 rounded-2xl font-black uppercase text-xs tracking-widest transition-colors ${darkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Batalkan</button>
                <button onClick={handleBatchPurge} disabled={loading || intelligence.expiredCount === 0} className="flex-1 py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-red-200 hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Skull className="w-4 h-4" />} EXECUTE
                </button>
             </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[500] flex items-center justify-center p-6">
          <div className={`rounded-[3rem] p-10 max-w-md w-full shadow-2xl animate-in zoom-in duration-300 ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
             <h3 className={`text-2xl font-black mb-8 uppercase tracking-tight text-center ${darkMode ? 'text-white' : 'text-slate-900'}`}>Edit Data</h3>
             <div className="space-y-5 mb-8">
                 <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Nama Klien</label><input className="form-input-apex py-4" value={editingItem.client} onChange={(e) => setEditingItem({...editingItem, client: e.target.value})} /></div>
                 <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Nomor WhatsApp</label><input className="form-input-apex py-4" value={editingItem.phone} onChange={(e) => setEditingItem({...editingItem, phone: e.target.value})} /></div>
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Paket Layanan (Tier)</label>
                    <select className={`form-input-apex py-4 ${darkMode ? 'bg-slate-800' : 'bg-white'}`} value={editingItem.tier} onChange={(e) => setEditingItem({...editingItem, tier: e.target.value})}>{Object.keys(customTiers).map(t => <option key={t} value={t}>{t}</option>)}</select>
                 </div>
                 <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Catatan</label><textarea rows="3" className="form-input-apex py-4 resize-none" value={editingItem.notes} onChange={(e) => setEditingItem({...editingItem, notes: e.target.value})} /></div>
             </div>
             <div className="flex gap-4">
                <button onClick={() => setEditingItem(null)} className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest ${darkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Batal</button>
                <button onClick={handleUpdate} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-indigo-700">Simpan</button>
             </div>
          </div>
        </div>
      )}

      <style>{`
        .form-input-apex { width: 100%; padding: 1.5rem 2rem; border-radius: 2rem; font-weight: 700; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); outline: none; font-size: 0.95rem; border: 2px solid transparent; }
        .form-input-apex:focus { box-shadow: 0 10px 30px -10px rgba(99,102,241,0.2); transform: translateY(-2px); }
        
        /* Light Mode Inputs */
        .form-input-apex { background-color: #f8fafc; color: #1e293b; }
        .form-input-apex:focus { border-color: #818cf8; background-color: white; }

        /* Dark Mode Inputs */
        .dark-mode-active .form-input-apex { background-color: #1e293b; color: white; border-color: transparent; }
        .dark-mode-active .form-input-apex:focus { background-color: #0f172a; border-color: #6366f1; }

        .custom-scrollbar-apex::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar-apex::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .dark-mode-active .custom-scrollbar-apex::-webkit-scrollbar-thumb { background: #475569; }
        .custom-scrollbar-apex::-webkit-scrollbar-track { background: transparent; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        @media print { body { background: white; } .no-print { display: none !important; } }
      `}</style>
    </div>
  );
};

// --- SUBCOMPONENTS ---
const SideLink = ({ icon: Icon, label, active, onClick, darkMode }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-5 px-8 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.2em] transition-all duration-300 ${active ? (darkMode ? 'bg-indigo-600 text-white shadow-xl translate-x-3 scale-105' : 'bg-slate-950 text-white shadow-xl translate-x-3 scale-105') : (darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50')}`}>
        <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-current'}`} /> {label}
    </button>
);

const MobileIcon = ({ icon: Icon, active, onClick, darkMode }) => (
    <button onClick={onClick} className={`p-4 rounded-2xl transition-all duration-300 ${active ? (darkMode ? 'bg-indigo-600 text-white scale-110 shadow-inner' : 'bg-slate-950 text-white scale-110 shadow-inner') : (darkMode ? 'text-slate-500' : 'text-slate-400')}`}><Icon className="w-6 h-6" /></button>
);

const StatBlock = ({ label, value, icon: Icon, color, bg, darkMode }) => (
    <div className={`p-8 rounded-[3rem] border shadow-sm group hover:-translate-y-1 transition-all duration-300 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className={`p-4 rounded-2xl w-fit mb-6 ${darkMode ? 'bg-slate-800' : bg} ${color} shadow-md transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}><Icon className="w-6 h-6" /></div>
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.25em] mb-2 leading-none">{label}</p>
        <p className={`text-3xl font-black tracking-tighter leading-none ${darkMode ? 'text-white' : 'text-slate-900'}`}>{value}</p>
    </div>
);

const FilterButton = ({ active, label, onClick, color }) => (
    <button onClick={onClick} className={`px-8 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 whitespace-nowrap border ${active ? `${color} text-white border-transparent shadow-lg transform scale-105` : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}>{label}</button>
);

const ActionBtn = ({ icon: Icon, color, onClick }) => (
    <button onClick={onClick} className={`p-4 rounded-2xl ${color} border hover:scale-110 active:scale-95 transition-all shadow-sm group`}>
        <Icon className="w-5 h-5 group-hover:rotate-6 transition-transform" />
    </button>
);

const FormGroup = ({ label, icon: Icon, children }) => (
    <div className="space-y-4">
        <label className="text-[11px] font-black text-slate-950 uppercase flex items-center gap-3 ml-4 tracking-wider">
            <Icon className="w-4 h-4 text-indigo-600" /> <span className="dark:text-white">{label}</span>
        </label>
        {children}
    </div>
);

const LoadingScreen = () => (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-12 text-center">
        <div className="relative mb-12">
            <div className="w-20 h-20 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <Layers className="w-8 h-8 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-2">System Initializing</h2>
        <p className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.4em] animate-pulse">Connecting to Core...</p>
    </div>
);

const ConfigNeededUI = () => (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950" />
        <div className="max-w-md w-full bg-slate-900/50 border border-white/10 rounded-[3rem] p-12 backdrop-blur-2xl shadow-2xl relative z-10">
            <div className="bg-red-500/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                <LogOut className="text-red-500 w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-6 leading-none">CONFIG<br/>MISSING</h1>
            <p className="text-slate-400 text-xs leading-relaxed mb-10 tracking-wide">Firebase credentials belum terdeteksi. Harap isi variabel <code className="text-indigo-400 font-mono bg-indigo-500/10 px-2 py-1 rounded">firebaseConfig</code> atau cek file .env di dalam source code.</p>
        </div>
    </div>
);

export default App;