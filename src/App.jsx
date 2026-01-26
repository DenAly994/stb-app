import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Copy, RefreshCw, Trash2, CheckCircle, Clock, Calendar, Settings, 
  User, AlertCircle, ShieldCheck, Save, CloudIcon, Key, LogOut, 
  TrendingUp, Wallet, Zap, Search, Bell, ExternalLink, ChevronRight,
  Database, Smartphone, Send, LayoutDashboard, DatabaseZap, ClipboardList,
  MessageSquare, FileText, Lock, UserCheck, Share2, Users, CreditCard, History,
  Wifi, Medal, Trophy, Crown, Gem, Star, UserPlus, Shield, Layers,
  Download, Eye, EyeOff, BarChart3, Link as LinkIcon, ArrowUpRight,
  PlusCircle, LockKeyhole, Activity, TrendingDown, DollarSign, PieChart,
  Filter, Sparkles, Briefcase, Terminal, HardDrive, Brush, Info
} from 'lucide-react';

// Firebase Imports
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, 
  signOut, signInWithCustomToken 
} from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, getDoc, collection, onSnapshot, 
  addDoc, deleteDoc, updateDoc, query, where, orderBy 
} from 'firebase/firestore';

// ==========================================================
// 1. KONFIGURASI FIREBASE (PASTIKAN TETAP MENGGUNAKAN DATA ANDA)
// ==========================================================
const myLocalFirebaseConfig = {
  apiKey: "AIzaSyAfFX2mj15m6dIafD9Wcp05wVHSIDfQgYc",
  authDomain: "stb-generator-pro.firebaseapp.com",
  projectId: "stb-generator-pro",
  storageBucket: "stb-generator-pro.firebasestorage.app",
  messagingSenderId: "893420515785",
  appId: "1:893420515785:web:a5a99c80de5d7c88afb818"
};

// DAFTAR EMAIL ADMIN (Whitelist Keamanan)
const ALLOWED_ADMINS = [
  "denalyjunior@gmail.com",
  "denalyjr@gmail.com",
  "admin-stb@gmail.com"
];

const TIER_META = [
  { id: 'bronze', name: 'Bronze', months: 3, color: 'from-orange-400 to-orange-700', icon: Medal, textColor: 'text-orange-600' },
  { id: 'silver', name: 'Silver', months: 6, color: 'from-slate-300 to-slate-500', icon: Trophy, textColor: 'text-slate-500' },
  { id: 'gold', name: 'Gold', months: 9, color: 'from-yellow-400 to-yellow-600', icon: Crown, textColor: 'text-yellow-600' },
  { id: 'diamond', name: 'Diamond', months: 12, color: 'from-cyan-400 to-blue-600', icon: Gem, textColor: 'text-cyan-600' },
];

const getFinalConfig = () => {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    try { return JSON.parse(__firebase_config); } catch (e) { return myLocalFirebaseConfig; }
  }
  return myLocalFirebaseConfig;
};

const firebaseConfig = getFinalConfig();
const isConfigValid = firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("ISI_API_KEY_ANDA");

let app, auth, db, googleProvider;
if (isConfigValid) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
  } catch (err) { console.error("Firebase Initialization Error:", err); }
}

const appId = 'stb-enterprise-v14'; 

const App = () => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tokens, setTokens] = useState([]);
  const [logs, setLogs] = useState([]);
  const [latestToken, setLatestToken] = useState(null);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [authError, setAuthError] = useState(null); // Deteksi error domain
  
  const [memberInfo, setMemberInfo] = useState({ name: '', phone: '', password: '' });
  const [isAccumulating, setIsAccumulating] = useState(false);
  const [existingExpiry, setExistingExpiry] = useState(null);

  const [config, setConfig] = useState({
    businessName: 'STB PRO ENTERPRISE',
    fonnteToken: '', telegramToken: '', telegramChatId: '',
    autoSend: true,
    prices: { bronze: 100000, silver: 300000, gold: 600000, diamond: 900000 },
    waTemplate: "*STRUK AKTIVASI {{biz}} - {{tier}}*\n\nHallo {{name}},\nTerima kasih! Layanan Anda telah aktif.\n\n🏆 Paket: {{tier}}\n🔑 Token: {{code}}\n🔐 Pass: {{password}}\n⏳ Masa Aktif: {{duration}} Bulan\n🗓️ Berlaku s/d: {{expiry}}\n\n_Nikmati layanan terbaik kami._"
  });

  // 2. AUTH & SECURITY WITH ERROR HANDLING
  useEffect(() => {
    if (!isConfigValid || !auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (ALLOWED_ADMINS.includes(currentUser.email)) {
          setUser(currentUser);
          setIsAdmin(true);
        } else {
          showStatus('error', 'Akses Ditolak! Email tidak ada dalam Whitelist.');
          signOut(auth);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setAuthError(null);
    try {
      if (!auth) throw new Error("Firebase not initialized");
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        setAuthError({
          title: 'Domain Tidak Diizinkan',
          message: `URL ini (${window.location.hostname}) belum didaftarkan di Firebase Console.`,
          guide: 'Buka Firebase > Authentication > Settings > Authorized Domains > Tambahkan domain ini.'
        });
      } else {
        showStatus('error', 'Gagal Login: ' + error.message);
      }
    }
  };

  // 3. CLOUD SYNC & AUDIT LOGS
  useEffect(() => {
    if (!user || !db || !isAdmin) return;

    // Load Config
    const configDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config');
    getDoc(configDocRef).then((docSnap) => {
      if (docSnap.exists()) setConfig(prev => ({ ...prev, ...docSnap.data() }));
    });

    // Sync Tokens
    const tokensColRef = collection(db, 'artifacts', appId, 'users', user.uid, 'tokens');
    const unsubscribeTokens = onSnapshot(tokensColRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        expiryDate: doc.data().expiryDate?.toDate() || new Date()
      }));
      setTokens([...list].sort((a, b) => b.createdAt - a.createdAt));
      setIsCloudConnected(true);
    }, (err) => {
      console.error("Firestore error:", err);
      setIsCloudConnected(false);
    });

    // Sync Audit Logs (Limit 20)
    const logsColRef = collection(db, 'artifacts', appId, 'users', user.uid, 'audit_logs');
    const unsubscribeLogs = onSnapshot(logsColRef, (snapshot) => {
      const logList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(logList.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20));
    });

    return () => { unsubscribeTokens(); unsubscribeLogs(); };
  }, [user, isAdmin]);

  // 4. SMART ANALYTICS v15 (Growth & Stats)
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;

    const revenue = tokens.reduce((acc, t) => acc + (t.price || 0), 0);
    const activeMembers = tokens.filter(t => t.expiryDate > now);
    
    const revenueThisMonth = tokens
      .filter(t => t.createdAt.getMonth() === currentMonth)
      .reduce((acc, t) => acc + (t.price || 0), 0);
    
    const revenueLastMonth = tokens
      .filter(t => t.createdAt.getMonth() === lastMonth)
      .reduce((acc, t) => acc + (t.price || 0), 0);

    const growth = revenueLastMonth === 0 ? 100 : ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100;

    const expiringSoon = activeMembers.filter(t => (t.expiryDate - now) < (3 * 24 * 60 * 60 * 1000));

    return { 
      revenue, revenueThisMonth, growth,
      active: activeMembers.length, 
      total: tokens.length,
      expiringSoon
    };
  }, [tokens]);

  // 5. SMART LOGIC (Auto-Fill)
  const handleNameInput = (val) => {
    setMemberInfo(prev => ({ ...prev, name: val }));
    if (val.length > 2) {
      const match = tokens.find(t => t.memberName?.toLowerCase().includes(val.toLowerCase()));
      if (match && !memberInfo.phone) setMemberInfo(prev => ({ ...prev, phone: match.memberPhone }));
    }
  };

  useEffect(() => {
    if (memberInfo.phone.length > 8) {
      const now = new Date();
      const activeMatch = tokens.filter(t => t.memberPhone === memberInfo.phone && t.expiryDate > now).sort((a,b)=>b.expiryDate - a.expiryDate)[0];
      if (activeMatch) {
        setIsAccumulating(true);
        setExistingExpiry(activeMatch.expiryDate);
      } else {
        setIsAccumulating(false);
        setExistingExpiry(null);
      }
    }
  }, [memberInfo.phone, tokens]);

  // 6. CORE ACTIONS
  const showStatus = (type, text) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg({ type: '', text: '' }), 5000);
  };

  const addAuditLog = async (action) => {
    if (!user || !db) return;
    try {
      const logRef = collection(db, 'artifacts', appId, 'users', user.uid, 'audit_logs');
      await addDoc(logRef, {
        admin: user.displayName,
        action,
        timestamp: Date.now()
      });
    } catch (e) { console.error("Audit log failed"); }
  };

  const handleGenerate = async (tierObj) => {
    if (!user || !db || !isAdmin) return;
    if (!memberInfo.phone || !memberInfo.name) return showStatus('error', 'Identitas member wajib lengkap!');

    setLoading(true);
    const price = config.prices[tierObj.id] || 0;
    const baseDate = isAccumulating && existingExpiry ? new Date(existingExpiry) : new Date();
    const exp = new Date(baseDate);
    exp.setMonth(exp.getMonth() + tierObj.months);

    const code = `STB-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const newToken = {
      code, tier: tierObj.name, duration: tierObj.months, price,
      memberName: memberInfo.name, memberPhone: memberInfo.phone,
      password: memberInfo.password || 'PASS-' + Math.floor(1000 + Math.random() * 9000),
      createdAt: new Date(), expiryDate: exp,
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'tokens'), newToken);
      await addAuditLog(`Created ${tierObj.name} token for ${memberInfo.name}`);
      setLatestToken(newToken);
      showStatus('success', 'Aktivasi Berhasil Disimpan!');
      setMemberInfo({ name: '', phone: '', password: '' });
    } catch (e) { showStatus('error', 'Koneksi Cloud Terputus!'); } 
    finally { setLoading(false); }
  };

  const saveConfig = async () => {
    if (!user || !db) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config'), config, { merge: true });
      await addAuditLog(`Updated System Configuration`);
      showStatus('success', 'Sistem Branding Sinkron!');
    } catch (e) { showStatus('error', 'Gagal Update Cloud.'); } 
    finally { setIsSaving(false); }
  };

  const backupData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tokens));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `STB_BACKUP_${new Date().getTime()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showStatus('success', 'Database Berhasil Dicadangkan!');
  };

  const copy = (txt) => {
    const el = document.createElement('textarea'); el.value = txt; document.body.appendChild(el);
    el.select(); document.execCommand('copy'); document.body.removeChild(el);
    showStatus('success', 'Tersalin!');
  };

  const getFilteredTokens = () => {
    return tokens.filter(t => {
      const matches = t.memberName?.toLowerCase().includes(searchTerm.toLowerCase()) || t.memberPhone?.includes(searchTerm);
      const expired = t.expiryDate < new Date();
      if (filterStatus === 'active') return matches && !expired;
      if (filterStatus === 'expired') return matches && expired;
      return matches;
    });
  };

  // UI RENDERING
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[70%] bg-indigo-600/10 blur-[150px] rounded-full"></div>
        <div className="max-w-md w-full relative z-10 text-center text-white">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl">
            <ShieldCheck size={52} />
          </div>
          <h1 className="text-4xl font-black mb-2 tracking-tighter uppercase italic">STB PRO V15</h1>
          <p className="text-slate-400 text-[10px] mb-12 uppercase tracking-[0.4em] font-black italic decoration-indigo-500 underline underline-offset-4">Enterprise Security Handshake</p>
          
          {authError && (
            <div className="mb-10 p-8 bg-red-500/10 border-2 border-red-500/30 rounded-[2rem] text-left animate-in zoom-in duration-300">
               <div className="flex items-center gap-4 text-red-400 mb-4">
                  <AlertCircle size={24} />
                  <span className="font-black uppercase tracking-widest text-xs">{authError.title}</span>
               </div>
               <p className="text-xs text-slate-300 leading-relaxed font-bold italic mb-4 uppercase">{authError.message}</p>
               <div className="p-4 bg-red-500/20 rounded-xl flex gap-3 items-start">
                  <Info size={14} className="text-red-300 mt-0.5" />
                  <p className="text-[10px] text-red-200 font-bold uppercase leading-relaxed">{authError.guide}</p>
               </div>
            </div>
          )}

          <button onClick={handleLogin} className="w-full py-6 px-6 bg-white rounded-3xl font-black text-slate-900 flex items-center justify-center gap-4 shadow-[0_20px_50px_-10px_rgba(255,255,255,0.2)] active:scale-95 transition-all">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
            <span>AUTHENTICATE AS ADMIN</span>
          </button>
          
          {statusMsg.text && <p className="mt-8 text-red-400 text-[10px] font-black uppercase tracking-widest animate-pulse italic">{statusMsg.text}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900 overflow-hidden italic font-medium">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-72 bg-white border-r border-slate-200 hidden lg:flex flex-col sticky top-0 h-screen shadow-sm not-italic">
        <div className="p-10">
          <div className="flex items-center gap-3 mb-14">
            <div className="bg-slate-900 p-3 rounded-2xl shadow-lg"><Briefcase size={24} className="text-indigo-500" /></div>
            <span className="text-2xl font-black tracking-tighter uppercase italic">{config.businessName.split(' ')[0]}</span>
          </div>
          <nav className="space-y-4">
            {[
              { id: 'dashboard', label: 'Intelligence', icon: LayoutDashboard },
              { id: 'generator', label: 'Provisioning', icon: Zap },
              { id: 'members', label: 'Member Center', icon: Users },
              { id: 'audit', label: 'Audit Trail', icon: Terminal },
              { id: 'settings', label: 'Enterprise Hub', icon: Settings },
            ].map((item) => (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-5 px-6 py-4 rounded-2xl text-sm font-black transition-all ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}>
                <item.icon size={22} /> {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-8 border-t border-slate-100 flex items-center gap-4">
          <img src={user?.photoURL} className="w-10 h-10 rounded-full border-2 border-indigo-50" />
          <div className="overflow-hidden">
            <p className="text-[10px] font-black truncate uppercase">{user?.displayName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[8px] font-black uppercase text-slate-400 italic tracking-widest">Master Admin</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 p-4 lg:p-12 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700">
          
          {/* TAB 1: INTELLIGENCE DASHBOARD */}
          {activeTab === 'dashboard' && (
             <div className="space-y-12">
                <header className="flex justify-between items-end">
                   <div>
                      <h1 className="text-3xl font-black uppercase italic underline decoration-indigo-500 underline-offset-8 uppercase">{config.businessName}</h1>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-4 italic">v15 Intelligence Overview</p>
                   </div>
                   <button onClick={backupData} className="p-4 bg-white border border-slate-200 rounded-2xl hover:bg-indigo-50 text-indigo-600 transition-all shadow-sm flex items-center gap-3 text-[10px] font-black uppercase italic tracking-widest">
                      <HardDrive size={18}/> Local Backup
                   </button>
                </header>

                {stats.expiringSoon.length > 0 && (
                   <div className="bg-rose-50 border-2 border-rose-200 p-8 rounded-[3rem] flex items-center gap-8 animate-in slide-in-from-top-6">
                      <div className="p-5 bg-rose-500 text-white rounded-3xl shadow-xl shadow-rose-200"><Bell size={32} className="animate-bounce" /></div>
                      <div className="flex-1">
                         <h3 className="text-lg font-black uppercase italic text-rose-900 tracking-tighter leading-none">Smart Attention: Retention Alert</h3>
                         <p className="text-xs text-rose-700 font-bold uppercase mt-1 italic italic tracking-widest leading-relaxed">Ada {stats.expiringSoon.length} member akan segera kedaluwarsa. Optimalkan pendapatan Anda sekarang.</p>
                      </div>
                      <button onClick={()=>setActiveTab('members')} className="px-10 py-5 bg-rose-900 text-white text-[11px] font-black uppercase rounded-2xl shadow-xl hover:scale-105 transition-all italic tracking-[0.2em]">Contact Members</button>
                   </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                   {[
                      { label: 'Net Revenue', val: `Rp ${stats.revenue.toLocaleString()}`, icon: DollarSign, color: 'indigo' },
                      { label: 'Monthly Growth', val: `${stats.growth.toFixed(1)}%`, icon: TrendingUp, color: 'emerald' },
                      { label: 'Active Users', val: stats.active, icon: UserCheck, color: 'blue' },
                      { label: 'Total Matrix', val: stats.total, icon: DatabaseZap, color: 'slate' },
                   ].map((s, i) => (
                      <div key={i} className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm flex items-center gap-6 group hover:shadow-lg transition-all border-b-8 hover:border-b-indigo-500">
                         <div className={`p-5 rounded-3xl bg-${s.color}-50 text-${s.color}-600 group-hover:rotate-12 transition-transform shadow-inner`}><s.icon size={28} /></div>
                         <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1 italic tracking-widest">{s.label}</p><p className="text-2xl font-black tracking-tighter italic">{s.val}</p></div>
                      </div>
                   ))}
                </div>
                
                <div className="bg-white p-12 rounded-[4rem] border border-slate-200 shadow-sm">
                   <h2 className="text-xs font-black uppercase tracking-[0.5em] mb-12 text-slate-400 flex items-center gap-4 italic"><PieChart size={20}/> Revenue Stream Performance</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
                      {TIER_META.map(tier => {
                         const count = tokens.filter(t => t.tier === tier.name).length;
                         const percent = (count / (tokens.length || 1)) * 100;
                         return (
                            <div key={tier.id} className="flex flex-col items-center">
                               <div className={`w-24 h-24 rounded-[2.5rem] bg-slate-50 flex items-center justify-center mb-6 shadow-inner group cursor-default relative overflow-hidden`}>
                                  <div className={`absolute bottom-0 left-0 w-full bg-gradient-to-t ${tier.color} opacity-20`} style={{height: `${percent}%`}}></div>
                                  <tier.icon className={`${tier.textColor} group-hover:scale-125 transition-transform relative z-10`} size={40} />
                               </div>
                               <span className="text-[10px] font-black uppercase tracking-[0.3em]">{tier.name} Tier</span>
                               <span className="text-2xl font-black italic mt-1">{count}</span>
                               <span className="text-[9px] text-slate-400 font-bold uppercase mt-1 italic tracking-widest">{percent.toFixed(1)}% Share</span>
                            </div>
                         );
                      })}
                   </div>
                </div>
             </div>
          )}

          {/* TAB 2: PROVISIONING (v15) */}
          {activeTab === 'generator' && (
             <div className="animate-in fade-in duration-700 space-y-12">
                <header className="text-center italic"><h1 className="text-4xl font-black uppercase tracking-tighter decoration-indigo-500 underline underline-offset-8 decoration-4 italic">Provisioning Hub</h1></header>
                <div className="grid grid-cols-1 xl:grid-cols-5 gap-12">
                   <div className="xl:col-span-3 space-y-10">
                      <div className="bg-white rounded-[4.5rem] p-12 border border-slate-200 shadow-sm relative overflow-hidden">
                         <div className="absolute top-0 right-0 p-10 opacity-5"><PlusCircle size={200}/></div>
                         {isAccumulating && (
                            <div className="mb-10 bg-indigo-50 border-2 border-indigo-200 p-8 rounded-[2.5rem] flex items-center gap-6 animate-pulse shadow-sm">
                              <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl"><History size={24} /></div>
                              <div>
                                 <span className="block text-xs font-black text-indigo-600 uppercase tracking-widest italic leading-none mb-1">Cumulative Active</span>
                                 <span className="text-[10px] text-slate-500 font-bold uppercase italic leading-relaxed block tracking-tighter">Sisa masa aktif hingga {existingExpiry?.toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}.</span>
                              </div>
                            </div>
                         )}
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12 relative z-10">
                            <div className="space-y-4">
                               <label className="text-[11px] font-black uppercase text-slate-400 ml-8 tracking-widest italic leading-none">Identity Matrix</label>
                               <input type="text" placeholder="Masukkan Nama" className="w-full p-7 bg-slate-50 border-2 border-transparent rounded-[2.5rem] text-sm font-black outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner uppercase italic" value={memberInfo.name} onChange={(e) => handleNameInput(e.target.value)} />
                            </div>
                            <div className="space-y-4">
                               <label className="text-[11px] font-black uppercase text-slate-400 ml-8 tracking-widest italic leading-none">WhatsApp Link</label>
                               <input type="text" placeholder="628xxxxxxxx" className="w-full p-7 bg-slate-50 border-2 border-transparent rounded-[2.5rem] text-sm font-mono font-black outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner tracking-widest" value={memberInfo.phone} onChange={(e) => setMemberInfo({...memberInfo, phone: e.target.value.replace(/\D/g, '')})} />
                            </div>
                         </div>
                         <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                            {TIER_META.map(tier => (
                              <button key={tier.id} onClick={() => handleGenerate(tier)} className="group bg-slate-900 rounded-[3rem] border-4 border-transparent p-8 text-center text-white hover:border-indigo-500 transition-all active:scale-95 flex flex-col items-center">
                                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${tier.color} flex items-center justify-center mb-6 shadow-xl group-hover:rotate-12 transition-transform`}><tier.icon size={32} /></div>
                                <h3 className="text-[10px] font-black uppercase tracking-widest opacity-60 italic">{tier.name} Access</h3>
                                <div className="text-[14px] font-black text-white mt-2 italic tracking-tighter">Rp {config.prices[tier.id].toLocaleString()}</div>
                                <div className="mt-4 py-2 px-4 bg-white/10 rounded-xl text-[8px] uppercase font-black text-indigo-400 italic tracking-widest opacity-30 group-hover:opacity-100 transition-opacity">{tier.months} Months</div>
                              </button>
                            ))}
                         </div>
                      </div>
                   </div>

                   <div className="xl:col-span-2">
                      <div className="bg-white rounded-[4rem] border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden relative">
                         <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-widest italic flex items-center gap-3"><MessageSquare size={18} className="text-emerald-500"/> Blueprint Receipt</h2>
                            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                         </div>
                         <div className="flex-1 p-10 bg-[#e5ddd5] relative">
                            <div className="absolute inset-0 opacity-10 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')]"></div>
                            <div className="relative z-10 bg-white p-8 rounded-[2rem] shadow-2xl border border-emerald-100 max-w-[95%] animate-in fade-in slide-in-from-left-12">
                               <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 leading-relaxed italic font-medium lowercase">
                                  {latestToken ? 
                                    (config.waTemplate.replace(/{{biz}}/g, config.businessName).replace(/{{name}}/g, latestToken.memberName).replace(/{{code}}/g, latestToken.code).replace(/{{duration}}/g, latestToken.duration).replace(/{{tier}}/g, latestToken.tier).replace(/{{expiry}}/g, latestToken.expiryDate.toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'}))) 
                                    : "Struk otomatis siap dikirim..."
                                  }
                               </pre>
                               <div className="text-[10px] text-slate-400 mt-6 text-right flex items-center justify-end gap-1.5 font-bold tracking-tighter italic italic">System v15 Handshake ✓✓</div>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          )}

          {/* TAB 3: MEMBER CENTER */}
          {activeTab === 'members' && (
             <div className="bg-white rounded-[4.5rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500 italic font-medium">
                <div className="p-14 bg-slate-50/50 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-center gap-12">
                   <div className="flex items-center gap-8">
                      <div className="p-6 bg-slate-900 text-indigo-400 rounded-[2rem] shadow-2xl"><Users size={40}/></div>
                      <div>
                         <h2 className="text-3xl font-black uppercase tracking-tighter italic underline decoration-indigo-200 decoration-4 underline-offset-8">Member Base Repository</h2>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em] mt-3 italic tracking-widest">Global Instance Synchronized</p>
                      </div>
                   </div>
                   <div className="flex flex-col md:flex-row gap-6 not-italic items-center w-full xl:w-auto">
                      <div className="flex gap-2 p-2 bg-white border-2 border-slate-100 rounded-3xl shadow-md">
                         {['all', 'active', 'expired'].map(m => (
                           <button key={m} onClick={() => setFilterStatus(m)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all italic ${filterStatus === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>{m}</button>
                         ))}
                      </div>
                      <div className="relative w-full md:w-[400px]">
                         <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
                         <input type="text" placeholder="Search Filter..." className="w-full pl-18 pr-8 py-6 bg-white border-2 border-slate-100 rounded-[2.25rem] text-sm font-black outline-none focus:border-indigo-500 transition-all shadow-lg italic tracking-tight italic" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                      </div>
                   </div>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm">
                      <thead className="bg-white text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] border-b border-slate-100">
                         <tr><th className="px-16 py-10 uppercase italic">Member Identification</th><th className="px-10 py-10 text-center uppercase italic">Subscription Matrix</th><th className="px-10 py-10 uppercase italic">Tier Analytics</th><th className="px-16 py-10 text-right uppercase italic">Control Ops</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {getFilteredTokens().map(t => {
                            const isExpired = t.expiryDate < new Date();
                            const progress = Math.max(0, Math.min(100, (t.expiryDate - new Date()) / (30 * 24 * 60 * 60 * 1000) * 100));
                            return (
                               <tr key={t.id} className="group hover:bg-slate-50/70 transition-all italic">
                                  <td className="px-16 py-12">
                                     <div className="flex flex-col gap-2">
                                        <span className="font-black text-slate-900 text-xl uppercase tracking-tighter underline decoration-slate-100 decoration-4 group-hover:decoration-indigo-100 transition-all italic underline-offset-8">{t.memberName}</span>
                                        <div className="flex items-center gap-3 text-slate-400">
                                           <Smartphone size={14}/>
                                           <span className="text-[10px] font-mono font-black tracking-[0.2em]">{t.memberPhone}</span>
                                        </div>
                                     </div>
                                  </td>
                                  <td className="px-10 py-12">
                                     <div className="w-[200px] mx-auto space-y-4">
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest italic leading-none">
                                           <span className={isExpired ? 'text-red-500' : 'text-emerald-500'}>{isExpired ? 'TERMINATED' : 'PROVISIONED'}</span>
                                           <span>{t.expiryDate.toLocaleDateString('id-ID')}</span>
                                        </div>
                                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
                                           <div className={`h-full transition-all duration-1000 ${isExpired ? 'bg-red-300' : progress > 50 ? 'bg-emerald-500' : progress > 20 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: isExpired ? '100%' : `${progress}%` }}></div>
                                        </div>
                                     </div>
                                  </td>
                                  <td className="px-10 py-12">
                                     <div className="flex flex-col gap-1.5">
                                        <span className="font-black text-indigo-600 text-[11px] uppercase tracking-widest italic">{t.tier} Tier</span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase italic tracking-tighter">Value: Rp {t.price?.toLocaleString()}</span>
                                     </div>
                                  </td>
                                  <td className="px-16 py-12 text-right">
                                     <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                        <button onClick={() => { setActiveTab('generator'); setMemberInfo({ name: t.memberName, phone: t.memberPhone, password: t.password }); }} className="p-4 bg-white text-emerald-600 rounded-[1.5rem] border-2 shadow-sm hover:bg-emerald-600 hover:text-white transition-all"><ArrowUpRight size={22}/></button>
                                        <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tokens', t.id))} className="p-4 bg-white text-red-300 hover:text-red-600 rounded-[1.5rem] border-2 shadow-sm transition-all"><Trash2 size={22}/></button>
                                     </div>
                                  </td>
                               </tr>
                            );
                         })}
                      </tbody>
                   </table>
                </div>
             </div>
          )}

          {/* TAB 4: AUDIT TRAIL */}
          {activeTab === 'audit' && (
             <div className="bg-white rounded-[4rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500 italic">
                <div className="p-14 bg-slate-50/50 border-b border-slate-100">
                   <h2 className="text-3xl font-black uppercase tracking-tighter underline decoration-indigo-500 decoration-8 underline-offset-8 italic">System Audit Trail</h2>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em] mt-6 italic">Tracking 20 latest administrative actions across all instances</p>
                </div>
                <div className="p-10 space-y-6">
                   {logs.map(log => (
                      <div key={log.id} className="flex items-center gap-8 p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 group hover:bg-white hover:shadow-lg transition-all">
                         <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform"><Terminal size={28}/></div>
                         <div className="flex-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic leading-none mb-3">{new Date(log.timestamp).toLocaleString('id-ID')}</p>
                            <p className="text-lg font-black text-slate-800 uppercase tracking-tighter italic">{log.action}</p>
                         </div>
                         <div className="text-right">
                            <span className="px-5 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg italic tracking-widest">Admin: {log.admin.split(' ')[0]}</span>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          )}

          {/* TAB 5: ENTERPRISE HUB */}
          {activeTab === 'settings' && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in duration-500 pb-20 italic">
                <div className="space-y-12">
                   <div className="bg-white rounded-[4rem] p-12 border border-slate-200 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-10 opacity-5"><Brush size={100}/></div>
                      <div className="flex items-center justify-between mb-14">
                         <div className="flex items-center gap-6">
                            <div className="p-5 bg-indigo-50 text-indigo-600 rounded-[1.75rem] shadow-inner"><Brush size={28}/></div>
                            <div><h2 className="text-2xl font-black uppercase tracking-tighter italic underline decoration-indigo-500 decoration-4">Branding Hub</h2><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 italic">Enterprise Business Identity</p></div>
                         </div>
                         <button onClick={saveConfig} disabled={isSaving} className="p-5 bg-slate-900 text-white rounded-3xl hover:bg-emerald-600 transition-all shadow-xl active:scale-95">{isSaving ? <RefreshCw size={24} className="animate-spin" /> : <Save size={24} />}</button>
                      </div>
                      <div className="space-y-8 relative z-10">
                         <div className="space-y-4">
                            <label className="text-[11px] font-black text-slate-400 uppercase ml-8 tracking-[0.3em] italic">Business Identity Name</label>
                            <input type="text" className="w-full p-7 bg-slate-50 border-2 border-transparent rounded-[2.5rem] text-sm font-black outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner italic" value={config.businessName} onChange={e => setConfig({...config, businessName: e.target.value.toUpperCase()})} />
                         </div>
                         <div className="grid grid-cols-2 gap-8">
                            {TIER_META.map(tier => (
                               <div key={tier.id} className="space-y-3">
                                  <label className="text-[10px] font-black uppercase text-slate-400 ml-6 italic">{tier.name} Cost (Rp)</label>
                                  <input type="number" className="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[2.25rem] text-sm font-black outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner italic" value={config.prices[tier.id]} onChange={e => setConfig({...config, prices: {...config.prices, [tier.id]: parseInt(e.target.value) || 0}})} />
                               </div>
                            ))}
                         </div>
                      </div>
                   </div>

                   <div className="bg-white rounded-[4rem] p-12 border border-slate-200 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-10 opacity-5"><Database size={100}/></div>
                      <div className="flex items-center gap-8 mb-14">
                         <div className="p-5 bg-indigo-50 text-indigo-600 rounded-[1.75rem] shadow-2xl"><DatabaseZap size={28}/></div>
                         <div><h2 className="text-2xl font-black uppercase tracking-tighter italic">Global API Gateway</h2><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 italic">Inter-System Handshake Protocol</p></div>
                      </div>
                      <div className="space-y-8">
                         <div className="space-y-4"><label className="text-[10px] font-black text-slate-400 uppercase ml-8 italic">WhatsApp Handshake Token</label><input type="password" placeholder="FONNTE_TOKEN" className="w-full p-7 bg-slate-50 border-2 border-transparent rounded-[2.5rem] text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner tracking-widest italic" value={config.fonnteToken} onChange={e => setConfig({...config, fonnteToken: e.target.value})} /></div>
                         <div className="space-y-4"><label className="text-[10px] font-black text-slate-400 uppercase ml-8 italic">Telegram Bot Matrix Token</label><input type="password" placeholder="BOT_TOKEN" className="w-full p-7 bg-slate-50 border-2 border-transparent rounded-[2.5rem] text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner tracking-widest italic" value={config.telegramToken} onChange={e => setConfig({...config, telegramToken: e.target.value})} /></div>
                      </div>
                   </div>
                </div>

                <div className="bg-white rounded-[4.5rem] p-12 border border-slate-200 shadow-sm flex flex-col h-full italic relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>
                   <h2 className="text-3xl font-black mb-12 tracking-tighter uppercase underline decoration-indigo-500 decoration-8 underline-offset-8 italic">Omni-Channel Messaging Blueprint</h2>
                   <div className="flex flex-wrap gap-3 mb-10 p-8 bg-slate-50 rounded-[3rem] border-2 border-slate-100 shadow-inner">
                      {['biz', 'name', 'code', 'password', 'duration', 'tier', 'expiry'].map(tag => (
                         <button key={tag} className="px-5 py-2.5 bg-white text-indigo-600 text-[10px] font-black rounded-2xl border-2 border-indigo-100 uppercase transition-all hover:bg-indigo-600 hover:text-white shadow-sm flex items-center gap-3 italic">
                            <Zap size={12} /> {'{{' + tag + '}}'}
                         </button>
                      ))}
                   </div>
                   <textarea className="w-full flex-1 p-12 bg-slate-50 border-2 border-slate-50 rounded-[3.5rem] text-base font-bold outline-none focus:ring-8 focus:ring-indigo-50/50 mb-8 shadow-inner italic leading-relaxed lowercase tracking-tight" value={config.waTemplate} onChange={e => setConfig({...config, waTemplate: e.target.value})} />
                   <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.5em] italic text-center leading-relaxed">System v15: Global Cloud Sync Active Across Multi-Admin Terminals</p>
                </div>
             </div>
          )}
        </div>
      </main>

      {/* NOTIFICATION LAYER */}
      <div className="fixed bottom-12 right-12 z-[999] pointer-events-none not-italic">
        {statusMsg.text && (
          <div className={`p-10 rounded-[4rem] shadow-[0_60px_100px_-20px_rgba(0,0,0,0.6)] flex items-center gap-10 animate-in slide-in-from-right-12 pointer-events-auto border-4 ${statusMsg.type === 'success' ? 'bg-[#0a0f1d] text-white border-indigo-500/40' : 'bg-red-600 text-white border-white/20'}`}>
            <div className={`p-5 rounded-3xl ${statusMsg.type === 'success' ? 'bg-indigo-500/20 text-emerald-400 shadow-2xl' : 'bg-white/20'}`}><CheckCircle size={40} /></div>
            <div>
               <p className="text-2xl font-black uppercase tracking-[0.3em] italic leading-none">{statusMsg.text}</p>
               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-3 italic flex items-center gap-3 leading-none tracking-[0.2em]"><Activity size={16}/> {isAdmin ? 'ADMIN AUTHENTICATED' : 'SINKRONISASI CLOUD'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;