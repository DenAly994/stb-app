import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Copy, RefreshCw, Trash2, CheckCircle, Clock, Calendar, Settings, 
  User, AlertCircle, ShieldCheck, Save, CloudIcon, Key, LogOut, 
  TrendingUp, Wallet, Zap, Search, Bell, ExternalLink, ChevronRight,
  Database, Smartphone, Send, LayoutDashboard, DatabaseZap, ClipboardList,
  MessageSquare, FileText, Lock, UserCheck, Share2, Users, CreditCard, History,
  Wifi, Medal, Trophy, Crown, Gem, Star, UserPlus, Shield, Layers,
  Download, Eye, EyeOff, BarChart3, Link as LinkIcon, ArrowUpRight,
  PlusCircle, LockKeyhole, Activity, TrendingDown, DollarSign, PieChart
} from 'lucide-react';

// Firebase Imports
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';

// ==========================================================
// 1. KONFIGURASI FIREBASE (PASTIKAN TETAP MENGGUNAKAN DATA ANDA)
// ==========================================================
const myLocalFirebaseConfig = {
  apiKey: "ISI_API_KEY_ANDA",
  authDomain: "PROJECT_ID.firebaseapp.com",
  projectId: "PROJECT_ID",
  storageBucket: "PROJECT_ID.firebasestorage.app",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

// DAFTAR EMAIL ADMIN (Sesuai dengan screenshot Anda: Denaly Junior)
const ALLOWED_ADMINS = [
  "denalyjunior@gmail.com", // Pastikan ini email yang Anda gunakan login
  "denalyjr@gmail.com",
  "admin-stb@gmail.com"
];

// Tier Data dengan metadata visual
const TIER_META = [
  { id: 'bronze', name: 'Bronze', months: 3, color: 'from-orange-400 to-orange-700', icon: Medal, textColor: 'text-orange-600' },
  { id: 'silver', name: 'Silver', months: 6, color: 'from-slate-300 to-slate-500', icon: Trophy, textColor: 'text-slate-500' },
  { id: 'gold', name: 'Gold', months: 9, color: 'from-yellow-400 to-yellow-600', icon: Crown, textColor: 'text-yellow-600' },
  { id: 'diamond', name: 'Diamond', months: 12, color: 'from-cyan-400 to-blue-600', icon: Gem, textColor: 'text-cyan-600' },
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

const appId = 'stb-enterprise-v11'; // Gunakan ID yang sama agar data Vercel tidak hilang

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
  
  const [memberInfo, setMemberInfo] = useState({ name: '', phone: '', password: '' });
  const [isAccumulating, setIsAccumulating] = useState(false);
  const [existingExpiry, setExistingExpiry] = useState(null);

  // Konfigurasi Enterprise v12 (Termasuk Dynamic Pricing)
  const [config, setConfig] = useState({
    fonnteToken: '', telegramToken: '', telegramChatId: '', telegramOwnerId: '',
    autoSend: true,
    prices: { bronze: 100000, silver: 300000, gold: 600000, diamond: 900000 },
    waTemplate: "*STRUK AKTIVASI STB - {{tier}}*\n\nHallo {{name}},\nTerima kasih! Layanan Anda telah aktif.\n\n🏆 Paket: {{tier}}\n🔑 Token: {{code}}\n🔐 Pass: {{password}}\n⏳ Masa Aktif: {{duration}} Bulan\n🗓️ Berlaku s/d: {{expiry}}\n\n_Nikmati layanan terbaik kami._"
  });

  // 2. AUTH & SECURITY
  useEffect(() => {
    if (!isConfigValid || !auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (ALLOWED_ADMINS.includes(currentUser.email)) {
          setUser(currentUser);
          setIsAdmin(true);
        } else {
          showStatus('error', 'Akses Ditolak: Email tidak terdaftar di Whitelist.');
          signOut(auth);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 3. CLOUD SINKRONISASI
  useEffect(() => {
    if (!user || !db || !isAdmin) return;

    const configDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config');
    getDoc(configDocRef).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig(prev => ({ ...prev, ...data, prices: data.prices || prev.prices }));
      }
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

  // 4. SMART LOGIC (Memory & Accumulation)
  useEffect(() => {
    if (memberInfo.phone.length > 8) {
      const now = new Date();
      const activeMatch = tokens
        .filter(t => t.memberPhone === memberInfo.phone && t.expiryDate > now)
        .sort((a, b) => b.expiryDate - a.expiryDate)[0];

      if (activeMatch) {
        setIsAccumulating(true);
        setExistingExpiry(activeMatch.expiryDate);
        if (!memberInfo.name) setMemberInfo(prev => ({ ...prev, name: activeMatch.memberName }));
      } else {
        setIsAccumulating(false);
        setExistingExpiry(null);
        const matchAny = tokens.find(t => t.memberPhone === memberInfo.phone);
        if (matchAny && !memberInfo.name) setMemberInfo(prev => ({ ...prev, name: matchAny.memberName }));
      }
    }
  }, [memberInfo.phone, tokens]);

  // 5. ANALYTICS ENGINE v12
  const stats = useMemo(() => {
    const now = new Date();
    const revenue = tokens.reduce((acc, t) => acc + (t.price || 0), 0);
    const active = tokens.filter(t => t.expiryDate > now).length;
    
    // Revenue per Tier
    const tierStats = TIER_META.map(tier => ({
      ...tier,
      count: tokens.filter(t => t.tier === tier.name).length,
      revenue: tokens.filter(t => t.tier === tier.name).reduce((sum, t) => sum + (t.price || 0), 0)
    }));

    // Member LTV (Lifetime Value)
    const memberLTV = tokens.reduce((acc, t) => {
      acc[t.memberPhone] = (acc[t.memberPhone] || 0) + (t.price || 0);
      return acc;
    }, {});

    return { revenue, active, total: tokens.length, tierStats, memberLTV };
  }, [tokens]);

  const filteredTokens = tokens.filter(t => 
    t.memberName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.memberPhone?.includes(searchTerm) ||
    t.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 6. ACTIONS
  const showStatus = (type, text) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg({ type: '', text: '' }), 5000);
  };

  const handleGenerate = async (tierObj) => {
    if (!user || !db || !isAdmin) return;
    if (!memberInfo.phone || !memberInfo.name) return showStatus('error', 'Nama & WA Wajib Diisi!');

    setLoading(true);
    const currentPrice = config.prices[tierObj.id] || 0;
    const baseDate = isAccumulating && existingExpiry ? new Date(existingExpiry) : new Date();
    const exp = new Date(baseDate);
    exp.setMonth(exp.getMonth() + tierObj.months);

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = `STB-${Array.from({ length: 8 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('')}`;

    const newToken = {
      code, tier: tierObj.name, duration: tierObj.months, price: currentPrice,
      memberName: memberInfo.name, memberPhone: memberInfo.phone,
      password: memberInfo.password || 'PASS-' + Math.floor(1000 + Math.random() * 9000),
      createdAt: new Date(), expiryDate: exp,
      isAccumulated: isAccumulating
    };

    try {
      const colRef = collection(db, 'artifacts', appId, 'users', user.uid, 'tokens');
      await addDoc(colRef, newToken);
      setLatestToken(newToken);
      showStatus('success', isAccumulating ? 'Masa Aktif Berhasil Diakumulasi!' : 'Aktivasi Berhasil!');
      setMemberInfo({ name: '', phone: '', password: '' });
    } catch (e) { showStatus('error', 'Gagal Menghubungi Cloud.'); } 
    finally { setLoading(false); }
  };

  const saveConfig = async () => {
    if (!user || !db || !isAdmin) return;
    setIsSaving(true);
    try {
      const configDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config');
      await setDoc(configDocRef, config, { merge: true });
      showStatus('success', 'Konfigurasi Cloud Berhasil Diupdate!');
    } catch (e) { showStatus('error', 'Gagal Update Cloud.'); } 
    finally { setIsSaving(false); }
  };

  const copy = (txt) => {
    const el = document.createElement('textarea'); el.value = txt; document.body.appendChild(el);
    el.select(); document.execCommand('copy'); document.body.removeChild(el);
    showStatus('success', 'Teks Berhasil Disalin!');
  };

  // Helper untuk progress bar masa aktif
  const getExpiryProgress = (expiry) => {
    const now = new Date();
    const exp = new Date(expiry);
    const diff = exp - now;
    const total = 30 * 24 * 60 * 60 * 1000; // Standar 30 hari (hanya untuk visual)
    if (diff <= 0) return 0;
    return Math.min((diff / total) * 100, 100);
  };

  // LOGIN UI
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden font-sans italic">
        <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[70%] bg-indigo-600/10 blur-[150px] rounded-full"></div>
        <div className="max-w-md w-full relative z-10 text-center text-white">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl">
            <ShieldCheck size={52} className="text-white" />
          </div>
          <h1 className="text-4xl font-black mb-2 tracking-tighter uppercase not-italic italic">STB ENTERPRISE V12</h1>
          <p className="text-slate-400 text-[10px] mb-12 uppercase tracking-[0.4em] font-black">Dynamic Pricing & Analytics Active</p>
          <button onClick={() => signInWithPopup(auth, googleProvider)} className="w-full py-5 px-6 bg-white rounded-2xl font-black text-slate-900 flex items-center justify-center gap-4 shadow-xl active:scale-95 transition-all not-italic">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
            <span>LANJUT SEBAGAI ADMIN</span>
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
            <div className="bg-slate-900 p-3 rounded-2xl shadow-lg"><Zap size={24} className="text-indigo-500" /></div>
            <span className="text-2xl font-black tracking-tighter uppercase italic">STB Pro</span>
          </div>
          <nav className="space-y-4">
            {[
              { id: 'dashboard', label: 'Analytics', icon: LayoutDashboard },
              { id: 'generator', label: 'Generator', icon: Zap },
              { id: 'members', label: 'Member Center', icon: Users },
              { id: 'settings', label: 'Enterprise Settings', icon: Settings },
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
              <span className="text-[8px] font-black uppercase text-slate-400">Admin Live Cloud</span>
            </div>
          </div>
          <button onClick={() => signOut(auth)} className="ml-auto text-slate-300 hover:text-red-500 transition-colors"><LogOut size={16} /></button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 p-4 lg:p-12 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700">
          
          {/* TAB 1: ANALYTICS DASHBOARD */}
          {activeTab === 'dashboard' && (
             <div className="space-y-12">
                <header className="flex justify-between items-end">
                  <div>
                    <h1 className="text-3xl font-black uppercase italic underline decoration-indigo-500 underline-offset-8">Business Insights</h1>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-4">Enterprise Monitoring System v12</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <Activity size={20} className="text-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Real-time DB Sync</span>
                  </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                   {[
                      { label: 'Net Revenue', val: `Rp ${stats.revenue.toLocaleString()}`, icon: DollarSign, color: 'indigo' },
                      { label: 'Active Members', val: stats.active, icon: UserCheck, color: 'emerald' },
                      { label: 'Tier Conversion', val: stats.total, icon: BarChart3, color: 'blue' },
                      { label: 'Lifetime Users', val: Object.keys(stats.memberLTV).length, icon: DatabaseZap, color: 'slate' },
                   ].map((s, i) => (
                      <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-6 group hover:shadow-lg transition-all border-b-4 hover:border-b-indigo-500">
                         <div className={`p-5 rounded-3xl bg-${s.color}-50 text-${s.color}-600 group-hover:rotate-12 transition-transform`}><s.icon size={28} /></div>
                         <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">{s.label}</p><p className="text-2xl font-black tracking-tighter italic">{s.val}</p></div>
                      </div>
                   ))}
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                   <div className="lg:col-span-2 bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-sm">
                      <h2 className="text-xs font-black uppercase tracking-[0.4em] mb-12 text-slate-400 flex items-center gap-3"><PieChart size={18}/> Revenue Distribution by Tier</h2>
                      <div className="space-y-8">
                         {stats.tierStats.map(tier => {
                            const percent = (tier.revenue / (stats.revenue || 1)) * 100;
                            return (
                               <div key={tier.id} className="space-y-3">
                                  <div className="flex justify-between text-[11px] font-black uppercase">
                                     <span className="flex items-center gap-2"><tier.icon size={14} className={tier.textColor}/> {tier.name} Tier</span>
                                     <span>Rp {tier.revenue.toLocaleString()} ({percent.toFixed(1)}%)</span>
                                  </div>
                                  <div className="w-full h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                     <div className={`h-full bg-gradient-to-r ${tier.color} transition-all duration-1000`} style={{ width: `${percent}%` }}></div>
                                  </div>
                               </div>
                            );
                         })}
                      </div>
                   </div>

                   <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white relative overflow-hidden flex flex-col justify-center">
                      <div className="absolute top-0 right-0 p-8 opacity-10"><Trophy size={150}/></div>
                      <h2 className="text-[10px] font-black uppercase tracking-[0.4em] mb-8 text-indigo-400">Top Member (LTV)</h2>
                      <div className="space-y-6 relative z-10">
                         {Object.entries(stats.memberLTV)
                           .sort((a, b) => b[1] - a[1])
                           .slice(0, 5)
                           .map(([phone, ltv], i) => (
                             <div key={phone} className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black">{i+1}</div>
                                <div className="flex-1">
                                   <p className="text-xs font-black uppercase tracking-tighter">{tokens.find(t => t.memberPhone === phone)?.memberName || 'Member'}</p>
                                   <p className="text-[9px] text-slate-400 font-mono tracking-widest">{phone}</p>
                                </div>
                                <div className="text-xs font-black text-indigo-400 italic">Rp {ltv.toLocaleString()}</div>
                             </div>
                           ))
                         }
                      </div>
                   </div>
                </div>
             </div>
          )}

          {/* TAB 2: GENERATOR (SMART V12) */}
          {activeTab === 'generator' && (
             <div className="space-y-12">
                <header className="text-center italic"><h1 className="text-3xl font-black uppercase tracking-tighter decoration-indigo-500 underline underline-offset-8 decoration-4">Provisioning Center v12</h1></header>
                <div className="grid grid-cols-1 xl:grid-cols-5 gap-12">
                   <div className="xl:col-span-3 space-y-10">
                      <div className="bg-white rounded-[3.5rem] p-12 border border-slate-200 shadow-sm relative overflow-hidden">
                         {isAccumulating && (
                            <div className="mb-10 bg-indigo-50 border border-indigo-100 p-8 rounded-[2.5rem] flex items-center gap-6 animate-in slide-in-from-top-6">
                              <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl"><History size={24} /></div>
                              <div>
                                 <span className="block text-xs font-black text-indigo-600 uppercase tracking-widest italic">Smart Accumulation Handshake</span>
                                 <span className="text-[10px] text-slate-500 font-bold uppercase mt-1 italic leading-relaxed">Masa aktif tersisa hingga {existingExpiry?.toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}. Paket baru akan ditambahkan dari tanggal ini.</span>
                              </div>
                            </div>
                         )}
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12">
                            <div className="space-y-4">
                               <label className="text-[11px] font-black uppercase text-slate-400 ml-6 tracking-widest italic">Member Identity</label>
                               <div className="relative group">
                                  <User className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20}/>
                                  <input type="text" placeholder="Masukkan Nama" className="w-full pl-16 pr-6 py-6 bg-slate-50 border-2 border-transparent rounded-[2.25rem] text-sm font-black outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner uppercase italic" value={memberInfo.name} onChange={(e) => handleNameInput(e.target.value)} />
                               </div>
                            </div>
                            <div className="space-y-4">
                               <label className="text-[11px] font-black uppercase text-slate-400 ml-6 tracking-widest italic">WhatsApp (62...)</label>
                               <div className="relative group">
                                  <Smartphone className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20}/>
                                  <input type="text" placeholder="628xxxxxxxx" className="w-full pl-16 pr-6 py-6 bg-slate-50 border-2 border-transparent rounded-[2.25rem] text-sm font-mono font-black outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner" value={memberInfo.phone} onChange={(e) => handlePhoneInput(e.target.value)} />
                               </div>
                            </div>
                         </div>
                         <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            {TIER_META.map(tier => (
                              <button key={tier.id} onClick={() => handleGenerate(tier)} className="group bg-slate-900 rounded-[2.75rem] border-4 border-transparent p-8 text-center text-white hover:border-indigo-500 transition-all hover:shadow-2xl active:scale-95 flex flex-col items-center">
                                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${tier.color} flex items-center justify-center mb-6 shadow-xl group-hover:rotate-12 transition-transform`}><tier.icon size={32} /></div>
                                <h3 className="text-[11px] font-black uppercase tracking-widest">{tier.name} Plan</h3>
                                <div className="text-[13px] font-black text-indigo-400 mt-2 italic">Rp {config.prices[tier.id].toLocaleString()}</div>
                                <div className="mt-4 py-2 px-4 bg-white/5 rounded-xl text-[8px] uppercase font-black opacity-30 group-hover:opacity-100 transition-opacity italic tracking-widest">{tier.months} Months</div>
                              </button>
                            ))}
                         </div>
                      </div>
                   </div>

                   <div className="xl:col-span-2">
                      <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden relative">
                         <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-widest italic flex items-center gap-3"><MessageSquare size={18} className="text-emerald-500"/> WhatsApp Receipt Hub</h2>
                            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                         </div>
                         <div className="flex-1 p-10 bg-[#e5ddd5] relative">
                            <div className="absolute inset-0 opacity-10 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')]"></div>
                            <div className="relative z-10 bg-white p-8 rounded-[2rem] shadow-2xl border border-emerald-100 max-w-[95%] animate-in fade-in slide-in-from-left-8">
                               <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 leading-relaxed italic font-medium">
                                  {latestToken ? 
                                    (config.waTemplate.replace(/{{name}}/g, latestToken.memberName).replace(/{{code}}/g, latestToken.code).replace(/{{duration}}/g, latestToken.duration).replace(/{{tier}}/g, latestToken.tier).replace(/{{expiry}}/g, latestToken.expiryDate.toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'}))) 
                                    : "Pilih paket untuk melihat pratinjau struk..."
                                  }
                               </pre>
                               <div className="text-[10px] text-slate-400 mt-6 text-right flex items-center justify-end gap-1.5 font-bold tracking-tighter italic">Preview Mode ✓✓</div>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
                {latestToken && (
                  <div id="result-focus" className="bg-[#0a0f1d] rounded-[5rem] p-16 shadow-[0_60px_100px_-20px_rgba(0,0,0,0.6)] animate-in zoom-in duration-700 text-white flex flex-col items-center text-center relative overflow-hidden border border-indigo-500/20">
                    <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-indigo-500 to-purple-600 animate-pulse"></div>
                    <div className="bg-indigo-600 px-10 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.5em] mb-12 shadow-xl flex items-center gap-3"><Zap size={16}/> PROVISIONING SUCCESSFUL</div>
                    <h4 className="text-6xl font-black mb-12 italic underline decoration-indigo-500 decoration-8 underline-offset-8 uppercase tracking-tighter">{latestToken.memberName}</h4>
                    <div className="text-6xl md:text-8xl font-mono font-black tracking-[0.4em] mb-14 py-16 bg-white/5 border-4 border-dashed border-white/10 rounded-[4rem] w-full max-w-5xl shadow-2xl relative group">
                       {latestToken.code}
                       <button onClick={() => copy(latestToken.code)} className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white text-slate-900 px-8 py-3 rounded-2xl text-[11px] font-black uppercase shadow-2xl hover:bg-indigo-50 transition-all border border-indigo-100 italic">Click to Copy Code</button>
                    </div>
                    <div className="flex gap-8 w-full max-w-2xl not-italic">
                      <button onClick={() => copy(latestToken.code)} className="flex-1 py-7 bg-white text-slate-900 rounded-[2.5rem] font-black uppercase text-sm tracking-widest hover:scale-[1.03] transition-all flex items-center justify-center gap-4 shadow-2xl group">
                         <Copy size={24} className="group-hover:text-indigo-600"/> COPY TOKEN
                      </button>
                      <button onClick={() => copy(latestToken.code)} className="p-7 bg-indigo-600 text-white rounded-[2.5rem] hover:bg-indigo-500 transition-all shadow-2xl flex items-center justify-center px-16 group hover:scale-[1.03]">
                         <Send size={32} className="group-hover:translate-x-2 transition-transform"/>
                      </button>
                    </div>
                  </div>
                )}
             </div>
          )}

          {/* TAB 3: MEMBER CENTER (PROGRESSIVE) */}
          {activeTab === 'members' && (
             <div className="bg-white rounded-[4rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500 italic">
                <div className="p-14 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-12">
                   <div className="flex items-center gap-8">
                      <div className="p-6 bg-slate-900 text-indigo-400 rounded-[2rem] shadow-2xl"><Users size={40}/></div>
                      <div>
                         <h2 className="text-3xl font-black uppercase tracking-tighter italic underline decoration-indigo-200 decoration-4 underline-offset-8">Enterprise Member Base</h2>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em] mt-3 italic">Sync with Cloud Database Active</p>
                      </div>
                   </div>
                   <div className="flex gap-6 not-italic">
                      <button onClick={exportCSV} className="p-6 bg-white text-slate-400 border-2 border-slate-100 rounded-[1.75rem] hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-md group"><Download size={24} className="group-hover:-translate-y-1 transition-transform"/></button>
                      <div className="relative w-[450px]">
                         <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
                         <input type="text" placeholder="Search Identity, Token, or WhatsApp..." className="w-full pl-18 pr-8 py-6 bg-white border-2 border-slate-100 rounded-[2.25rem] text-sm font-black outline-none focus:border-indigo-500 transition-all shadow-lg italic tracking-tight" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                      </div>
                   </div>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm">
                      <thead className="bg-white text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] border-b border-slate-100">
                         <tr><th className="px-16 py-10">Member Profile</th><th className="px-10 py-10 text-center">Membership Progress</th><th className="px-10 py-10">Tier & LTV</th><th className="px-16 py-10 text-right">Admin Console</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {filteredTokens.map(t => {
                            const isExpired = t.expiryDate < new Date();
                            const progress = getExpiryProgress(t.expiryDate);
                            return (
                               <tr key={t.id} className="group hover:bg-slate-50/70 transition-all italic">
                                  <td className="px-16 py-12">
                                     <div className="flex flex-col gap-2">
                                        <span className="font-black text-slate-900 text-xl uppercase tracking-tighter underline decoration-slate-100 decoration-4 group-hover:decoration-indigo-100 transition-all">{t.memberName}</span>
                                        <div className="flex items-center gap-3 text-slate-400">
                                           <Smartphone size={14}/>
                                           <span className="text-[10px] font-mono font-black tracking-widest">{t.memberPhone}</span>
                                        </div>
                                     </div>
                                  </td>
                                  <td className="px-10 py-12">
                                     <div className="w-[200px] mx-auto space-y-3">
                                        <div className="flex justify-between text-[9px] font-black uppercase">
                                           <span>{isExpired ? 'EXPIRED' : 'ACTIVE'}</span>
                                           <span>{t.expiryDate.toLocaleDateString('id-ID')}</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                           <div className={`h-full transition-all duration-1000 ${progress > 50 ? 'bg-emerald-500' : progress > 20 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${progress}%` }}></div>
                                        </div>
                                     </div>
                                  </td>
                                  <td className="px-10 py-12">
                                     <div className="flex flex-col gap-1.5">
                                        <span className="font-black text-indigo-600 text-[11px] uppercase tracking-widest italic">{t.tier} Tier</span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase italic tracking-tighter">Spent: Rp {stats.memberLTV[t.memberPhone]?.toLocaleString()}</span>
                                     </div>
                                  </td>
                                  <td className="px-16 py-12 text-right">
                                     <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                        <button onClick={() => { setActiveTab('generator'); setMemberInfo({ name: t.memberName, phone: t.memberPhone, password: t.password }); }} className="p-4 bg-white text-emerald-600 rounded-[1.25rem] border shadow-sm hover:bg-emerald-600 hover:text-white transition-all"><ArrowUpRight size={22}/></button>
                                        <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tokens', t.id))} className="p-4 bg-white text-red-300 hover:text-red-600 rounded-[1.25rem] border shadow-sm transition-all"><Trash2 size={22}/></button>
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

          {/* TAB 4: ENTERPRISE SETTINGS (v12 DYNAMIC) */}
          {activeTab === 'settings' && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in duration-500 max-w-7xl mx-auto pb-20 italic">
                <div className="space-y-12">
                   <div className="bg-white rounded-[4rem] p-12 border border-slate-200 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-5"><DollarSign size={100}/></div>
                      <div className="flex items-center justify-between mb-12">
                         <div className="flex items-center gap-4">
                            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl shadow-inner"><Wallet size={24}/></div>
                            <div><h2 className="text-2xl font-black uppercase tracking-tighter italic">Dynamic Pricing</h2><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 italic">Real-time Tier Price Config</p></div>
                         </div>
                         <button onClick={saveConfig} disabled={isSaving} className="p-4 bg-slate-900 text-white rounded-2xl hover:bg-emerald-600 transition-all shadow-xl">{isSaving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}</button>
                      </div>
                      <div className="grid grid-cols-2 gap-8">
                         {TIER_META.map(tier => (
                            <div key={tier.id} className="space-y-3">
                               <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-[0.2em]">{tier.name} Price (Rp)</label>
                               <input type="number" className="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[2rem] text-sm font-black outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner italic" value={config.prices[tier.id]} onChange={e => setConfig({...config, prices: {...config.prices, [tier.id]: parseInt(e.target.value) || 0}})} />
                            </div>
                         ))}
                      </div>
                   </div>

                   <div className="bg-white rounded-[4rem] p-12 border border-slate-200 shadow-sm relative">
                      <div className="flex items-center gap-6 mb-12">
                         <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl shadow-2xl"><DatabaseZap size={24}/></div>
                         <div><h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 italic">Cloud API Hub</h2><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 italic">Gateway Handshake Config</p></div>
                      </div>
                      <div className="space-y-8">
                         <div className="space-y-3"><label className="text-[10px] font-black text-slate-400 uppercase ml-6 tracking-[0.3em]">WA PROVIDER TOKEN</label><input type="password" placeholder="FONNTE_TOKEN" className="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[2rem] text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner tracking-widest italic" value={config.fonnteToken} onChange={e => setConfig({...config, fonnteToken: e.target.value})} /></div>
                         <div className="space-y-3"><label className="text-[10px] font-black text-slate-400 uppercase ml-6 tracking-[0.3em]">TELEGRAM BOT TOKEN</label><input type="password" placeholder="BOT_TOKEN" className="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[2rem] text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner tracking-widest italic" value={config.telegramToken} onChange={e => setConfig({...config, telegramToken: e.target.value})} /></div>
                      </div>
                   </div>
                </div>

                <div className="bg-white rounded-[4rem] p-12 border border-slate-200 shadow-sm flex flex-col h-full italic relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
                   <h2 className="text-2xl font-black mb-10 tracking-tighter uppercase underline decoration-indigo-500 decoration-4 italic">Messaging System Blueprint</h2>
                   <div className="flex flex-wrap gap-2.5 mb-8 p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-inner">
                      {['name', 'code', 'password', 'duration', 'tier', 'expiry'].map(tag => (
                         <button key={tag} className="px-4 py-2 bg-white text-indigo-600 text-[9px] font-black rounded-xl border border-indigo-100 uppercase transition-all hover:bg-indigo-600 hover:text-white shadow-sm flex items-center gap-2 italic">
                            <Zap size={10} /> {'{{' + tag + '}}'}
                         </button>
                      ))}
                   </div>
                   <textarea className="w-full flex-1 p-10 bg-slate-50 border-2 border-slate-50 rounded-[3rem] text-base font-bold outline-none focus:ring-4 focus:ring-indigo-50/50 mb-6 shadow-inner italic leading-relaxed" value={config.waTemplate} onChange={e => setConfig({...config, waTemplate: e.target.value})} />
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic text-center">Changes are synced globally across all Admin PC's</p>
                </div>
             </div>
          )}
        </div>
      </main>

      {/* NOTIFICATION LAYER */}
      <div className="fixed bottom-12 right-12 z-[999] pointer-events-none not-italic">
        {statusMsg.text && (
          <div className={`p-10 rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] flex items-center gap-8 animate-in slide-in-from-right-12 pointer-events-auto border-4 ${statusMsg.type === 'success' ? 'bg-[#0a0f1d] text-white border-indigo-500/40' : 'bg-red-600 text-white'}`}>
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