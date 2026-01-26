import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Copy, RefreshCw, Trash2, CheckCircle, Clock, Calendar, Settings, 
  User, AlertCircle, ShieldCheck, Save, CloudIcon, Key, LogOut, 
  TrendingUp, Wallet, Zap, Search, Bell, ExternalLink, ChevronRight,
  Database, Smartphone, Send, LayoutDashboard, DatabaseZap, ClipboardList,
  MessageSquare, FileText, Lock, UserCheck, Share2, Users, CreditCard, History,
  Wifi, Medal, Trophy, Crown, Gem, Star, UserPlus, Shield, Layers,
  Download, Eye, EyeOff, BarChart3, Link as LinkIcon, ArrowUpRight,
  PlusCircle, LockKeyhole, Activity, TrendingDown
} from 'lucide-react';

// Firebase Imports
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';

// ==========================================================
// 1. KONFIGURASI FIREBASE (PASTIKAN ISI DATA ASLI ANDA)
// ==========================================================
const myLocalFirebaseConfig = {
  apiKey: "AIzaSyAfFX2mj15m6dIafD9Wcp05wVHSIDfQgYc",
  authDomain: "stb-generator-pro.firebaseapp.com",
  projectId: "stb-generator-pro",
  storageBucket: "stb-generator-pro.firebasestorage.app",
  messagingSenderId: "893420515785",
  appId: "1:893420515785:web:a5a99c80de5d7c88afb818"
};

// DAFTAR EMAIL ADMIN (WHITELIST KEAMANAN)
const ALLOWED_ADMINS = [
  "denalyjr@gmail.com", // Contoh email Anda
  "admin-stb@gmail.com"
];

const TIERS = [
  { id: 'bronze', name: 'Bronze', months: 3, price: 100000, color: 'from-orange-400 to-orange-700', icon: Medal, textColor: 'text-orange-600' },
  { id: 'silver', name: 'Silver', months: 6, price: 300000, color: 'from-slate-300 to-slate-500', icon: Trophy, textColor: 'text-slate-500' },
  { id: 'gold', name: 'Gold', months: 9, price: 600000, color: 'from-yellow-400 to-yellow-600', icon: Crown, textColor: 'text-yellow-600' },
  { id: 'diamond', name: 'Diamond', months: 12, price: 900000, color: 'from-cyan-400 to-blue-600', icon: Gem, textColor: 'text-cyan-600' },
];

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : myLocalFirebaseConfig;
const isConfigValid = firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("ISI_API_KEY_ANDA");

let app, auth, db, googleProvider;
if (isConfigValid) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
  } catch (err) { console.error("Firebase Init Error:", err); }
}

const appId = 'stb-enterprise-v11'; 

const App = () => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tokens, setTokens] = useState([]);
  const [latestToken, setLatestToken] = useState(null);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [showPass, setShowPass] = useState(false);
  
  const [memberInfo, setMemberInfo] = useState({ name: '', phone: '', password: '' });
  const [isAccumulating, setIsAccumulating] = useState(false);
  const [existingExpiry, setExistingExpiry] = useState(null);

  const [config, setConfig] = useState({
    fonnteToken: '', telegramToken: '', telegramChatId: '', telegramOwnerId: '',
    autoSend: true,
    waTemplate: "*STRUK AKTIVASI STB - {{tier}}*\n\nHallo {{name}},\nTerima kasih! Layanan Anda telah aktif.\n\n🏆 Paket: {{tier}}\n🔑 Token: {{code}}\n🔐 Pass: {{password}}\n⏳ Masa Aktif: {{duration}} Bulan\n🗓️ Berlaku s/d: {{expiry}}\n\n_Nikmati layanan terbaik kami._"
  });

  // 2. AUTH LOGIC WITH SECURITY CHECK
  useEffect(() => {
    if (!isConfigValid || !auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (ALLOWED_ADMINS.includes(currentUser.email)) {
          setUser(currentUser);
          setIsAdmin(true);
        } else {
          showStatus('error', 'Unauthorized: Email Anda tidak memiliki akses admin.');
          signOut(auth);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 3. REAL-TIME CLOUD SINKRONISASI
  useEffect(() => {
    if (!user || !db || !isAdmin) return;

    const configDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config');
    getDoc(configDocRef).then((docSnap) => {
      if (docSnap.exists()) setConfig(prev => ({ ...prev, ...docSnap.data() }));
    });

    const tokensColRef = collection(db, 'artifacts', appId, 'users', user.uid, 'tokens');
    const unsubscribe = onSnapshot(tokensColRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        expiryDate: doc.data().expiryDate?.toDate() || new Date()
      }));
      setTokens([...list].sort((a, b) => b.createdAt - a.createdAt));
      setIsCloudConnected(true);
    }, (err) => setIsCloudConnected(false));

    return () => unsubscribe();
  }, [user, isAdmin]);

  // 4. SMART BI-DIRECTIONAL MEMORY (Autocomplete)
  const handleNameInput = (val) => {
    setMemberInfo(prev => ({ ...prev, name: val }));
    if (val.length > 3) {
      const match = tokens.find(t => t.memberName?.toLowerCase().includes(val.toLowerCase()));
      if (match && !memberInfo.phone) setMemberInfo(prev => ({ ...prev, phone: match.memberPhone }));
    }
  };

  const handlePhoneInput = (val) => {
    const clean = val.replace(/\D/g, '');
    setMemberInfo(prev => ({ ...prev, phone: clean }));
    if (clean.length > 8) {
      const match = tokens.find(t => t.memberPhone === clean);
      if (match && !memberInfo.name) setMemberInfo(prev => ({ ...prev, name: match.memberName }));
    }
  };

  // 5. SMART ACCUMULATION ENGINE
  useEffect(() => {
    if (memberInfo.phone.length > 8) {
      const now = new Date();
      const activeMatch = tokens
        .filter(t => t.memberPhone === memberInfo.phone && t.expiryDate > now)
        .sort((a, b) => b.expiryDate - a.expiryDate)[0];

      if (activeMatch) {
        setIsAccumulating(true);
        setExistingExpiry(activeMatch.expiryDate);
      } else {
        setIsAccumulating(false);
        setExistingExpiry(null);
      }
    }
  }, [memberInfo.phone, tokens]);

  // 6. ANALYTICS CALCULATION
  const stats = useMemo(() => {
    const revenue = tokens.reduce((acc, t) => acc + (t.price || 0), 0);
    const active = tokens.filter(t => t.expiryDate > new Date()).length;
    const tierStats = TIERS.map(tier => ({
      ...tier,
      count: tokens.filter(t => t.tier === tier.name).length
    }));
    return { revenue, active, total: tokens.length, tierStats };
  }, [tokens]);

  const filteredTokens = tokens.filter(t => 
    t.memberName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.memberPhone?.includes(searchTerm) ||
    t.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const showStatus = (type, text) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg({ type: '', text: '' }), 5000);
  };

  const saveConfig = async () => {
    if (!user || !db || !isAdmin) return;
    setIsSaving(true);
    try {
      const configDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config');
      await setDoc(configDocRef, config, { merge: true });
      showStatus('success', 'Konfigurasi Sinkron Cloud!');
    } catch (e) { showStatus('error', 'Gagal Simpan Konfigurasi.'); } 
    finally { setIsSaving(false); }
  };

  const handleGenerate = async (tierObj) => {
    if (!user || !db || !isAdmin) return;
    if (!memberInfo.phone || !memberInfo.name) return showStatus('error', 'Data Member Belum Lengkap!');

    setLoading(true);
    const baseDate = isAccumulating && existingExpiry ? new Date(existingExpiry) : new Date();
    const exp = new Date(baseDate);
    exp.setMonth(exp.getMonth() + tierObj.months);

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = `STB-${Array.from({ length: 8 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('')}`;

    const newToken = {
      code, tier: tierObj.name, duration: tierObj.months, price: tierObj.price,
      memberName: memberInfo.name, memberPhone: memberInfo.phone,
      password: memberInfo.password || 'PASS-' + Math.floor(1000 + Math.random() * 9000),
      createdAt: new Date(), expiryDate: exp,
      isAccumulated: isAccumulating
    };

    try {
      const colRef = collection(db, 'artifacts', appId, 'users', user.uid, 'tokens');
      await addDoc(colRef, newToken);
      setLatestToken(newToken);
      showStatus('success', isAccumulating ? 'Masa Aktif Akumulasi!' : 'Aktivasi Berhasil!');
      setMemberInfo({ name: '', phone: '', password: '' });
    } catch (e) { showStatus('error', 'Cloud Error saat menyimpan.'); } 
    finally { setLoading(false); }
  };

  const copy = (txt) => {
    const el = document.createElement('textarea'); el.value = txt; document.body.appendChild(el);
    el.select(); document.execCommand('copy'); document.body.removeChild(el);
    showStatus('success', 'Berhasil Disalin');
  };

  // LOGIN UI
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden font-sans italic">
        <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[70%] bg-indigo-600/10 blur-[150px] rounded-full"></div>
        <div className="max-w-md w-full relative z-10 text-center text-white">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl">
            <LockKeyhole size={52} className="text-white" />
          </div>
          <h1 className="text-4xl font-black mb-2 tracking-tighter uppercase not-italic">STB ADMIN PANEL</h1>
          <p className="text-slate-400 text-sm mb-12 uppercase tracking-[0.2em] font-black">Authorized Personnel Only</p>
          <button onClick={() => signInWithPopup(auth, googleProvider)} className="w-full py-5 px-6 bg-white rounded-2xl font-black text-slate-900 flex items-center justify-center gap-4 shadow-xl active:scale-95 transition-all not-italic">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
            <span>LOGIN ADMIN ACCOUNT</span>
          </button>
          {statusMsg.text && <p className="mt-8 text-red-400 text-[10px] font-black uppercase tracking-widest animate-pulse">{statusMsg.text}</p>}
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
            <div className="bg-slate-900 p-3 rounded-2xl shadow-lg"><ShieldCheck size={24} className="text-indigo-500" /></div>
            <span className="text-2xl font-black tracking-tighter uppercase italic">STB Pro</span>
          </div>
          <nav className="space-y-4">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'generator', label: 'Generator', icon: Zap },
              { id: 'members', label: 'Member Center', icon: Users },
              { id: 'settings', label: 'API Gateway', icon: Settings },
            ].map((item) => (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-5 px-6 py-4 rounded-2xl text-sm font-black transition-all ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}>
                <item.icon size={22} /> {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-8 border-t border-slate-100 flex items-center gap-4">
          <img src={user?.photoURL} className="w-10 h-10 rounded-full border-2 border-indigo-50 shadow-sm" />
          <div className="overflow-hidden">
            <p className="text-[10px] font-black truncate uppercase">{user?.displayName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isCloudConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-[8px] font-black uppercase text-slate-400">ADMIN SECURE</span>
            </div>
          </div>
          <button onClick={() => signOut(auth)} className="ml-auto text-slate-300 hover:text-red-500 transition-colors"><LogOut size={16} /></button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-4 lg:p-12 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700">
          
          {activeTab === 'dashboard' && (
             <div className="space-y-12">
                <header><h1 className="text-3xl font-black uppercase italic underline decoration-indigo-500 underline-offset-8">Admin Dashboard</h1></header>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                   {[
                      { label: 'Total Omzet', val: `Rp ${stats.revenue.toLocaleString()}`, icon: Wallet, color: 'indigo' },
                      { label: 'Member Aktif', val: stats.active, icon: UserCheck, color: 'emerald' },
                      { label: 'Orders Hari Ini', val: stats.todaySales, icon: Zap, color: 'blue' },
                      { label: 'Total Database', val: stats.total, icon: DatabaseZap, color: 'slate' },
                   ].map((s, i) => (
                      <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-6 group hover:shadow-lg transition-all">
                         <div className={`p-5 rounded-3xl bg-${s.color}-50 text-${s.color}-600 group-hover:rotate-12 transition-transform`}><s.icon size={28} /></div>
                         <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">{s.label}</p><p className="text-2xl font-black tracking-tighter italic">{s.val}</p></div>
                      </div>
                   ))}
                </div>
                
                <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-sm">
                   <h2 className="text-xs font-black uppercase tracking-[0.4em] mb-10 text-slate-400">Tier Performance Distribution</h2>
                   <div className="flex flex-wrap gap-8 justify-between">
                      {stats.tierStats.map(tier => (
                         <div key={tier.id} className="flex flex-col items-center">
                            <div className={`w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mb-4 border border-slate-100 shadow-inner group cursor-default`}>
                               <tier.icon className={`${tier.textColor} group-hover:scale-125 transition-transform`} size={32} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest">{tier.name}</span>
                            <span className="text-lg font-black italic">{tier.count}</span>
                         </div>
                      ))}
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'generator' && (
             <div className="space-y-12">
                <header className="text-center italic"><h1 className="text-3xl font-black uppercase tracking-tighter decoration-indigo-500 underline underline-offset-8 decoration-4">Provisioning Center</h1></header>
                <div className="bg-white rounded-[3.5rem] p-12 border border-slate-200 shadow-sm relative overflow-hidden">
                   {isAccumulating && (
                      <div className="mb-10 bg-indigo-50 border border-indigo-100 p-6 rounded-[2rem] flex items-center gap-4 animate-bounce">
                        <History className="text-indigo-600" size={20} />
                        <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">Smart Accumulation Mode: Valid until {existingExpiry?.toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</span>
                      </div>
                   )}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12">
                      <div className="space-y-3"><label className="text-[11px] font-black uppercase text-slate-400 ml-4 tracking-widest">Holders Full Identity</label><input type="text" placeholder="Masukkan Nama" className="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[2.25rem] text-sm font-black outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner uppercase italic" value={memberInfo.name} onChange={(e) => handleNameInput(e.target.value)} /></div>
                      <div className="space-y-3"><label className="text-[11px] font-black uppercase text-slate-400 ml-4 tracking-widest">WhatsApp (Memory Link)</label><input type="text" placeholder="628xxxxxxxx" className="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[2.25rem] text-sm font-mono font-black outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner" value={memberInfo.phone} onChange={(e) => handlePhoneInput(e.target.value)} /></div>
                   </div>
                   <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                      {TIERS.map(tier => (
                        <button key={tier.id} onClick={() => handleGenerate(tier)} className="group bg-slate-900 rounded-[2.5rem] border-4 border-transparent p-8 text-center text-white hover:border-indigo-500 transition-all hover:shadow-2xl active:scale-95">
                          <tier.icon className="mx-auto mb-4" size={32} />
                          <h3 className="text-xs font-black uppercase italic tracking-widest">{tier.name} Package</h3>
                          <div className="text-[10px] font-black text-indigo-400 mt-2">Rp {tier.price.toLocaleString()}</div>
                          <div className="mt-4 py-2 bg-white/5 rounded-xl text-[8px] uppercase font-black opacity-30 group-hover:opacity-100 transition-opacity italic">{tier.months} Months Access</div>
                        </button>
                      ))}
                   </div>
                </div>
                {latestToken && (
                  <div id="result-focus" className="bg-[#0a0f1d] rounded-[4rem] p-12 shadow-2xl animate-in zoom-in duration-700 text-white flex flex-col items-center text-center relative overflow-hidden border border-indigo-500/20">
                    <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600 animate-pulse"></div>
                    <div className="text-xs font-black uppercase tracking-[0.4em] mb-10 italic">{latestToken.isAccumulated ? 'ACCUMULATIVE' : 'PROVISIONING'} SUCCESS</div>
                    <h4 className="text-5xl font-black mb-12 italic underline decoration-indigo-500 decoration-4 underline-offset-8 uppercase tracking-tighter">{latestToken.memberName}</h4>
                    <div className="text-5xl md:text-7xl font-mono font-black tracking-[0.4em] mb-12 py-14 bg-white/5 border-4 border-dashed border-white/10 rounded-[3rem] w-full max-w-4xl shadow-2xl relative group">
                       {latestToken.code}
                       <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white text-slate-900 px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">New Access Token</div>
                    </div>
                    <div className="flex gap-4 w-full max-w-xl not-italic">
                      <button onClick={() => copy(latestToken.code)} className="flex-1 py-6 bg-white text-slate-900 rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-4 shadow-xl"><Copy size={20}/> COPY CODE</button>
                      <button onClick={() => copy(latestToken.code)} className="p-6 bg-indigo-600 text-white rounded-[2.5rem] hover:bg-indigo-500 transition-all shadow-xl flex items-center justify-center"><Send size={28}/></button>
                    </div>
                  </div>
                )}
             </div>
          )}

          {activeTab === 'members' && (
             <div className="bg-white rounded-[4rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500 italic">
                <div className="p-14 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                   <h2 className="text-2xl font-black uppercase italic tracking-tighter underline decoration-indigo-200 decoration-4">Member Database</h2>
                   <div className="flex gap-4 not-italic">
                      <button onClick={exportCSV} className="p-5 bg-indigo-50 text-indigo-600 rounded-[1.5rem] hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Download size={22}/></button>
                      <input type="text" placeholder="Filter Database..." className="pl-8 pr-6 py-5 bg-white border-2 border-slate-200 rounded-full text-sm font-black outline-none w-[400px] shadow-md tracking-tight italic" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                   </div>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm">
                      <thead className="bg-white text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                         <tr><th className="px-16 py-10 uppercase">Identity Matrix</th><th className="px-10 py-8 uppercase">Service Tier</th><th className="px-10 py-8 uppercase">Expiry Plan</th><th className="px-16 py-10 text-right uppercase">Admin Ops</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {filteredTokens.map(t => (
                            <tr key={t.id} className="group hover:bg-slate-50/70 transition-all italic">
                               <td className="px-16 py-12 font-black text-slate-900 uppercase text-lg underline decoration-slate-100 decoration-4 underline-offset-8 group-hover:decoration-indigo-100 transition-all">{t.memberName}</td>
                               <td className="px-10 py-10 text-indigo-600 font-black text-xs uppercase italic tracking-widest">{t.tier} Tier Level</td>
                               <td className="px-10 py-10"><span className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase ${t.expiryDate < new Date() ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'} shadow-sm border border-black/5 tracking-tighter`}>{t.expiryDate.toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'})}</span></td>
                               <td className="px-16 py-12 text-right">
                                  <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                     <button onClick={() => { setActiveTab('generator'); setMemberInfo({ name: t.memberName, phone: t.memberPhone, password: t.password }); }} className="p-4 bg-white text-emerald-600 rounded-3xl border shadow-sm hover:bg-emerald-600 hover:text-white transition-all"><ArrowUpRight size={22}/></button>
                                     <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tokens', t.id))} className="p-4 bg-white text-red-300 hover:text-red-600 rounded-3xl border shadow-sm transition-all"><Trash2 size={22}/></button>
                                  </div>
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
          )}

          {activeTab === 'settings' && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in fade-in duration-500">
                <div className="bg-white rounded-[4rem] p-12 border border-slate-200 shadow-sm h-fit">
                   <div className="flex items-center gap-4 mb-14"><h2 className="text-2xl font-black uppercase italic tracking-tighter underline decoration-indigo-500">API Gateway Hub</h2><button onClick={saveConfig} disabled={isSaving} className="p-4 bg-slate-900 text-white rounded-2xl ml-auto hover:bg-indigo-600 transition-all shadow-xl">{isSaving ? <RefreshCw size={22} className="animate-spin" /> : <Save size={22} />}</button></div>
                   <div className="space-y-8">
                      <div className="space-y-3"><label className="text-[11px] font-black text-slate-400 uppercase ml-6 tracking-[0.3em]">WA PROVIDER KEY</label><input type="password" placeholder="FONNTE_TOKEN" className="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[2.25rem] text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner tracking-widest" value={config.fonnteToken} onChange={e => setConfig({...config, fonnteToken: e.target.value})} /></div>
                      <div className="space-y-3"><label className="text-[11px] font-black text-slate-400 uppercase ml-6 tracking-[0.3em]">TELEGRAM BOT TOKEN</label><input type="password" placeholder="BOT_TOKEN" className="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[2.25rem] text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner tracking-widest" value={config.telegramToken} onChange={e => setConfig({...config, telegramToken: e.target.value})} /></div>
                   </div>
                </div>
                <div className="bg-white rounded-[4rem] p-12 border border-slate-200 shadow-sm flex flex-col h-full italic">
                   <h2 className="text-2xl font-black mb-10 tracking-tighter uppercase underline decoration-indigo-500 decoration-4">Messaging Logic Template</h2>
                   <textarea className="w-full h-96 p-10 bg-slate-50 border-2 border-slate-50 rounded-[3rem] text-base font-bold outline-none focus:ring-4 focus:ring-indigo-50/50 mb-6 shadow-inner italic lowercase" value={config.waTemplate} onChange={e => setConfig({...config, waTemplate: e.target.value})} />
                </div>
             </div>
          )}
        </div>
      </main>

      {/* NOTIFICATION LAYER */}
      <div className="fixed bottom-12 right-12 z-[999] pointer-events-none not-italic">
        {statusMsg.text && (
          <div className={`p-10 rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] flex items-center gap-8 animate-in slide-in-from-right-12 pointer-events-auto border-4 ${statusMsg.type === 'success' ? 'bg-[#0a0f1d] text-white border-indigo-500/40' : 'bg-red-600 text-white'}`}>
            <div className={`p-4 rounded-3xl ${statusMsg.type === 'success' ? 'bg-indigo-500/20 text-emerald-400 shadow-2xl' : 'bg-white/20'}`}><CheckCircle size={36} /></div>
            <div>
              <p className="text-xl font-black uppercase tracking-[0.3em] italic">{statusMsg.text}</p>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2 italic flex items-center gap-2"><Activity size={14}/> {isAdmin ? 'ADMIN AUTHENTICATED' : 'SINKRONISASI CLOUD'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;