// SODSAN Fabrika İçi Portal - Veri Modeli ve Durum Yönetimi (data.js)

const STORAGE_KEY = "SODSAN_PORTAL_STATE_V2";
const LEGACY_STORAGE_KEY = "SODSAN_PORTAL_STATE_V1";

// Standart Gerçek Fabrika Departmanları
export const DEFAULT_DEPARTMENTS = [
  { id: "dep_sevkiyat", name: "Sevkiyat & Mamul Depo", icon: "🚚", color: "#f59e0b" },
  { id: "dep_bakim", name: "Bakım & Onarım", icon: "🛠️", color: "#ef4444" },
  { id: "dep_kalite", name: "Kalite Kontrol", icon: "🔍", color: "#10b981" },
  { id: "dep_satinalma", name: "Satın Alma", icon: "🛒", color: "#6366f1" },
  { id: "dep_ik", name: "İnsan Kaynakları & İdari İşler", icon: "👔", color: "#ec4899" },
  { id: "dep_yonetim", name: "Fabrika Müdürlüğü / Yönetim", icon: "🏢", color: "#1e293b" },
  { id: "dep_1792617714014", name: "1400 ÜRETİM", icon: "🏢", color: "#2563eb" },
  { id: "dep_1792617758042", name: "1400 DEPO", icon: "🏢", color: "#2563eb" },
  { id: "dep_1792617771756", name: "1500 DÖŞEME", icon: "🏢", color: "#2563eb" },
  { id: "dep_1792617860390", name: "1500 SEVKİYAT", icon: "🏢", color: "#2563eb" },
  { id: "dep_1792617873852", name: "1500 VAKUM", icon: "🏢", color: "#2563eb" }
];

// Standart Roller ve Yetki Matrisi
export const DEFAULT_ROLES = [
  {
    key: "ADMIN",
    title: "Sistem Yöneticisi (Admin)",
    badge: "bg-red-100 text-red-800",
    permissions: {
      canAddProduct: true,
      canCallForklift: true,
      canCompleteForklift: true,
      canRequestLeave: true,
      canApproveLeave: true,
      canRequestOvertime: true,
      canApproveOvertime: true,
      canAddSupply: true,
      canAddMaintenance: true,
      canAccessAdmin: true
    }
  },
  {
    key: "IK",
    title: "İnsan Kaynakları",
    badge: "bg-pink-100 text-pink-800",
    permissions: {
      canAddProduct: true,
      canCallForklift: false,
      canCompleteForklift: false,
      canRequestLeave: true,
      canApproveLeave: true,
      canRequestOvertime: true,
      canApproveOvertime: true,
      canAddSupply: true,
      canAddMaintenance: true,
      canAccessAdmin: false
    }
  },
  {
    key: "USTA",
    title: "Usta / Formen",
    badge: "bg-blue-100 text-blue-800",
    permissions: {
      canAddProduct: true,
      canCallForklift: true,
      canCompleteForklift: false,
      canRequestLeave: true,
      canApproveLeave: false,
      canRequestOvertime: true,
      canApproveOvertime: false,
      canAddSupply: true,
      canAddMaintenance: false,
      canAccessAdmin: false
    }
  },
  {
    key: "FORKLIFT",
    title: "Forklift Operatörü",
    badge: "bg-amber-100 text-amber-800",
    permissions: {
      canAddProduct: false,
      canCallForklift: false,
      canCompleteForklift: true,
      canRequestLeave: true,
      canApproveLeave: false,
      canRequestOvertime: true,
      canApproveOvertime: false,
      canAddSupply: true,
      canAddMaintenance: false,
      canAccessAdmin: false
    }
  },
  {
    key: "BAKIM",
    title: "Bakım & Onarım Teknisyeni",
    badge: "bg-purple-100 text-purple-800",
    permissions: {
      canAddProduct: true,
      canCallForklift: true,
      canCompleteForklift: false,
      canRequestLeave: true,
      canApproveLeave: false,
      canRequestOvertime: true,
      canApproveOvertime: false,
      canAddSupply: true,
      canAddMaintenance: true,
      canAccessAdmin: false
    }
  },
  {
    key: "PERSONEL",
    title: "Saha Personeli / Çalışan",
    badge: "bg-slate-100 text-slate-800",
    permissions: {
      canAddProduct: false,
      canCallForklift: false,
      canCompleteForklift: false,
      canRequestLeave: true,
      canApproveLeave: false,
      canRequestOvertime: true,
      canApproveOvertime: false,
      canAddSupply: false,
      canAddMaintenance: false,
      canAccessAdmin: false
    }
  }
];

export const ROLES = DEFAULT_ROLES.reduce((acc, r) => {
  acc[r.key] = r;
  return acc;
}, {});

export function getRoleInfo(roleKey) {
  if (typeof appState !== "undefined" && appState && appState.state && appState.state.roles) {
    const found = appState.state.roles.find(r => r.key === roleKey);
    if (found) return found;
  }
  return ROLES[roleKey] || { title: roleKey, badge: "bg-slate-100 text-slate-800", permissions: {} };
}

// Oturum açan kullanıcının Sistem Yöneticisi (Admin) olup olmadığını denetler
// Admin paneline erişim yetkisi kural gereği SADECE ve YALNIZCA Admin kullanıcısına aittir
export function isAdmin() {
  if (typeof appState === "undefined" || !appState || !appState.state || !appState.state.currentUser) return false;
  const user = appState.state.currentUser;
  const role = String(user.role || "").trim().toUpperCase();
  const username = String(user.username || "").trim().toLowerCase();
  return (role === "ADMIN" || username === "admin" || user.id === "u_admin");
}

// Oturum açan kullanıcının İdari İşler (İK) veya Admin olup olmadığını denetler
export function isIdariIslerOrAdmin() {
  if (typeof appState === "undefined" || !appState || !appState.state || !appState.state.currentUser) return false;
  if (isAdmin()) return true;
  const user = appState.state.currentUser;
  const role = String(user.role || "").trim().toUpperCase();
  const depId = String(user.departmentId || "").trim().toLowerCase();
  if (role === "IK" || role === "IDARI_ISLER" || role === "YONETICI" || depId === "dep_ik" || depId === "dep_yonetim") return true;
  const roleDef = (appState.state.roles || []).find(r => String(r.key || "").trim().toUpperCase() === role);
  return !!(roleDef && roleDef.permissions && (roleDef.permissions.canApproveLeave || roleDef.permissions.canApproveOvertime));
}

// Oturum açan kullanıcının İK / Yönetici yetkisine sahip olup olmadığını denetler
export function isManagerOrHr() {
  return isIdariIslerOrAdmin();
}

// Oturum açan kullanıcının çalışanlar (employees) tablosundaki karşılığını getirir
export function getCurrentUserEmployee() {
  if (typeof appState === "undefined" || !appState || !appState.state || !appState.state.currentUser) return null;
  const user = appState.state.currentUser;
  const employees = appState.state.employees || [];
  return employees.find(e => e.userId === user.id || e.id === user.id || e.name.toLowerCase() === user.name.toLowerCase()) || null;
}

// Başlangıç Gerçek Fabrika Kullanıcıları (Admin PIN: 58105810, Personel PIN: 1234)
export const DEFAULT_USERS = [
  { id: "u_admin", username: "admin", name: "Sistem Yöneticisi", role: "ADMIN", departmentId: "dep_yonetim", phone: "5551112233", pin: "58105810" },
  { id: "u_ik", username: "gurkan", name: "Gürkan", role: "IK", departmentId: "dep_ik", phone: "", pin: "1234" },
  { id: "u_ahmet", username: "ayhan", name: "Ayhan", role: "USTA", departmentId: "dep_1792617714014", phone: "", pin: "1234" },
  { id: "u_mehmet", username: "eray", name: "Eray", role: "USTA", departmentId: "dep_1792617873852", phone: "", pin: "1234" },
  { id: "u_ali", username: "sefa", name: "Sefa", role: "FORKLIFT", departmentId: "dep_1792617758042", phone: "", pin: "1234" },
  { id: "u_1792618640012", username: "esma", name: "Esma", role: "USTA", departmentId: "dep_1792617860390", phone: "", pin: "1234" },
  { id: "u_1792669812232", username: "nisa", name: "Nisa", role: "USTA", departmentId: "dep_1792617860390", phone: "", pin: "1234" },
  { id: "u_1792669862039", username: "onur", name: "Onur", role: "BAKIM", departmentId: "dep_1792617873852", phone: "", pin: "1234" },
  { id: "u_1792669911638", username: "abdurrahman", name: "Abdurrahman", role: "USTA", departmentId: "dep_1792617771756", phone: "", pin: "1234" },
  { id: "u_1792690211697", username: "mustafakara", name: "Mustafa Kara", role: "PERSONEL", departmentId: "dep_1792617873852", phone: "", pin: "1234" },
  { id: "u_1792696635019", username: "rasit", name: "Raşit", role: "USTA", departmentId: "dep_1792617860390", phone: "", pin: "1234" },
  { id: "u_1792699612413", username: "kaan", name: "Kağan", role: "IK", departmentId: "dep_ik", phone: "", pin: "1234" },
  { id: "u_1792699659049", username: "buke", name: "Büke", role: "IK", departmentId: "dep_ik", phone: "", pin: "1234" }
];

// Başlangıç Gerçek Fabrika Personel Listesi (İzin Bakiye Takibi)
export const DEFAULT_EMPLOYEES = [
  { id: "u_admin", userId: "u_admin", name: "Sistem Yöneticisi", role: "ADMIN", departmentId: "dep_yonetim", totalLeave: 14, usedLeave: 0, remainingLeave: 14, hireDate: "2024-01-01" },
  { id: "u_ik", userId: "u_ik", name: "Gürkan", role: "IK", departmentId: "dep_ik", totalLeave: 14, usedLeave: 0, remainingLeave: 14, hireDate: "2024-01-01" },
  { id: "u_ahmet", userId: "u_ahmet", name: "Ayhan", role: "USTA", departmentId: "dep_1792617714014", totalLeave: 14, usedLeave: 0, remainingLeave: 14, hireDate: "2024-01-01" },
  { id: "u_mehmet", userId: "u_mehmet", name: "Eray", role: "USTA", departmentId: "dep_1792617873852", totalLeave: 14, usedLeave: 0, remainingLeave: 14, hireDate: "2024-01-01" },
  { id: "u_ali", userId: "u_ali", name: "Sefa", role: "FORKLIFT", departmentId: "dep_1792617758042", totalLeave: 14, usedLeave: 0, remainingLeave: 14, hireDate: "2024-01-01" },
  { id: "u_1792618640012", userId: "u_1792618640012", name: "Esma", role: "USTA", departmentId: "dep_1792617860390", totalLeave: 14, usedLeave: 0, remainingLeave: 14, hireDate: "2024-01-01" },
  { id: "u_1792669812232", userId: "u_1792669812232", name: "Nisa", role: "USTA", departmentId: "dep_1792617860390", totalLeave: 14, usedLeave: 0, remainingLeave: 14, hireDate: "2024-01-01" },
  { id: "u_1792669862039", userId: "u_1792669862039", name: "Onur", role: "BAKIM", departmentId: "dep_1792617873852", totalLeave: 14, usedLeave: 0, remainingLeave: 14, hireDate: "2024-01-01" },
  { id: "u_1792669911638", userId: "u_1792669911638", name: "Abdurrahman", role: "USTA", departmentId: "dep_1792617771756", totalLeave: 14, usedLeave: 0, remainingLeave: 14, hireDate: "2024-01-01" },
  { id: "u_1792690211697", userId: "u_1792690211697", name: "Mustafa Kara", role: "PERSONEL", departmentId: "dep_1792617873852", totalLeave: 14, usedLeave: 0, remainingLeave: 14, hireDate: "2024-01-01" },
  { id: "u_1792696635019", userId: "u_1792696635019", name: "Raşit", role: "USTA", departmentId: "dep_1792617860390", totalLeave: 14, usedLeave: 0, remainingLeave: 14, hireDate: "2024-01-01" },
  { id: "u_1792699612413", userId: "u_1792699612413", name: "Kağan", role: "IK", departmentId: "dep_ik", totalLeave: 14, usedLeave: 0, remainingLeave: 14, hireDate: "2024-01-01" },
  { id: "u_1792699659049", userId: "u_1792699659049", name: "Büke", role: "IK", departmentId: "dep_ik", totalLeave: 14, usedLeave: 0, remainingLeave: 14, hireDate: "2024-01-01" }
];

// Gelen-Giden Ürün Hareketleri (Gerçek Kayıtlar)
export const DEFAULT_PRODUCTS = [
  {
    id: "p_1792689128132",
    date: "2026-10-22T17:12:08.132Z",
    type: "GELEN",
    departmentId: "dep_1792617714014",
    productName: "C702",
    amount: 1,
    unit: "Ton",
    unitDetail: "",
    company: "Burpol",
    supplier: "Burpol (İRSALİYE YOK)",
    invoiceNo: "İRSALİYE YOK",
    createdBy: "Sistem Yöneticisi",
    note: ""
  }
];

// Sarf Malzeme İhtiyaçları
export const DEFAULT_SUPPLIES = [];

// İzin Talepleri
export const DEFAULT_LEAVE_REQUESTS = [];

// Fazla Mesai Talepleri
export const DEFAULT_OVERTIME_REQUESTS = [];

// Makina Arıza Bildirimleri
export const DEFAULT_BREAKDOWNS = [];

// Forklift Çağrıları (Gerçek Kayıtlar)
export const DEFAULT_FORKLIFT_REQUESTS = [
  {
    id: "fork_1792694908797",
    departmentId: "dep_1792617714014",
    location: "1400",
    urgency: "Normal",
    description: "deneme cagrısı",
    status: "Tamamlandı",
    requestTime: "2026-10-22T18:48:28.797Z",
    requestedBy: "Sistem Yöneticisi",
    operatorName: "Sistem Yöneticisi"
  }
];

// Takvim Etkinlikleri & Makine Bakım Planı
export const DEFAULT_CALENDAR_EVENTS = [];

// Standart Tanımlı Firma & Tedarikçi & Müşteri Listesi
export const DEFAULT_COMPANIES = [
  "Bayer Kimya A.Ş.",
  "Bellona Mobilya A.Ş.",
  "Burpol",
  "Doğan Sünger",
  "İstikbal Mobilya",
  "Kolsan Koltuk",
  "Teknik Bıçak San.",
  "Yataş A.Ş."
];

// Tanımlı Makina & Hat Parkuru (Gerçek Fabrika Parkuru: 7 Adet Asıl Makine)
export const DEFAULT_MACHINES = [
  {
    id: "mac_ur9hr2fee",
    name: "ENJEKSİYON 1050",
    code: "ENJ-1050",
    departmentId: "dep_1792617714014",
    location: "1400 Üretim",
    notes: "",
    status: "Aktif",
    addedAt: "2026-10-22"
  },
  {
    id: "mac_ealni0wrm",
    name: "ENJEKSİYON 130",
    code: "ENJ-130",
    departmentId: "dep_1792617714014",
    location: "1400 Üretim",
    notes: "",
    status: "Aktif",
    addedAt: "2026-10-22"
  },
  {
    id: "mac_fxhbk1bqn",
    name: "ENJEKSİYON 1400",
    code: "ENJ-1400",
    departmentId: "dep_1792617714014",
    location: "1400 Üretim",
    notes: "",
    status: "Aktif",
    addedAt: "2026-10-22"
  },
  {
    id: "mac_gakua6pxy",
    name: "ENJEKSİYON 1500",
    code: "ENJ-1500",
    departmentId: "dep_1792617873852",
    location: "1500 Vakum",
    notes: "",
    status: "Aktif",
    addedAt: "2026-10-22"
  },
  {
    id: "mac_ful1pjcg3",
    name: "HAVA KURUTUCU",
    code: "KRT-01",
    departmentId: "dep_1792617860390",
    location: "1500 Sevkiyat",
    notes: "",
    status: "Aktif",
    addedAt: "2026-10-22"
  },
  {
    id: "mac_kompresor",
    name: "Kompresör1",
    code: "KMP-01",
    departmentId: "dep_1792617860390",
    location: "Kompresör Dairesi",
    notes: "",
    status: "Aktif",
    addedAt: "2026-10-22"
  },
  {
    id: "mac_1792696272439_732",
    name: "Kompresör2",
    code: "KMP-02",
    departmentId: "dep_1792617860390",
    location: "Kompresör Dairesi",
    notes: "",
    status: "Aktif",
    addedAt: "2026-10-22"
  }
];

// Haftalık Üretim Programı & Kalıp Baskı Planları (Kesinlikle Sahte Veri Yoktur, Kullanıcı Kendisi Ekler)
export const DEFAULT_PRODUCTION_PLANS = [];

// Forklift Parkuru (Kesinlikle Sahte Veri Yoktur, Kullanıcı Kendisi Ekler)
export const DEFAULT_FORKLIFTS = [];

// Varsayılan Telegram Bot Yapılandırması
export const DEFAULT_TELEGRAM_CONFIG = {
  botToken: "8946959841:AAFj2Wtzf8n1FNcRjc5gYkJZOrBlci5c1HA",
  chatId: "-1004438133842",
  enabled: true,
  notifyForkliftNew: true,
  notifyForkliftEnRoute: true,
  notifyForkliftDone: true,
  notifyBreakdown: true,
  notifyCalendar: true,
  notifyProduction: true,
  voiceAnnounceEnabled: true,
  webhookCallUrl: ""
};

// Dışarıdan Hizmet Alınan Servis & Bakım Ekipleri Rehberi
export const DEFAULT_EXTERNAL_SERVICES = [
  {
    id: "ext_1",
    companyName: "Kompresör Yetkili Teknik Servisi",
    contactPerson: "Ahmet Usta",
    specialty: "Vidalı Kompresör, Kurutucu & Hava Hattı",
    phone: "0532 555 10 20",
    notes: "Periyodik yağ ve filtre bakımı, acil arıza desteği."
  }
];

// Yemek Şirketi & Aylık Menü Yapılandırması
export const DEFAULT_CATERING_CONFIG = {
  companyName: "Yemek Şirketi",
  websiteUrl: "",
  username: "",
  password: "",
  menuUrl: "",
  menuImage: "",
  menuMonth: "Ekim 2026",
  menuDays: [],
  updatedAt: null,
  updatedBy: ""
};

// Personel Servis Güzergahları & Araç/Şoför Listesi (Sahte veri yoktur)
export const DEFAULT_SHUTTLE_ROUTES = [];

// Sesli Uyarı Çalıcı (Web Audio API - harici dosya gerektirmez)
export function playAlertSound(type = "call") {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === "critical") {
      // 2 tonlu acil durum uyarısı
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.15);
      osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.5);
    } else {
      // Hoş bir zil sesi (Ding-Dong)
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.4);
    }
  } catch (e) {
    console.warn("Audio Context başlatılamadı:", e);
  }
}

// Türkçe Sesli Mesaj / Anons Okuyucu (Web Speech API)
export function speakVoiceAlert(text) {
  try {
    if (!('speechSynthesis' in window)) return;
    if (typeof appState !== "undefined" && appState?.state?.telegramConfig?.voiceAnnounceEnabled === false) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'tr-TR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn("Sesli anons hatası:", e);
  }
}

// Başlangıç İşlem Kayıtları (Audit Log - Boş başlangıç)
export const DEFAULT_LOGS = [];

// LocalStorage Veri Yükleyici & Saklayıcı
export class StateManager {
  constructor() {
    this.state = this.loadState();
    this.syncUsersToEmployees();
  }

  loadState() {
    try {
      // 1. Önce V2 (yeni sürüm) depolamayı kontrol et, yoksa V1'i dene
      let saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      
      let parsed = null;
      if (saved) {
        try {
          parsed = JSON.parse(saved);
        } catch (e) {
          console.error("State parse hatası:", e);
        }
      }

      if (!parsed || typeof parsed !== "object") {
        parsed = {};
      }

      // Departmanlar: Boşsa veya eksikse varsayılan gerçek fabrika departmanlarını kullan
      if (!Array.isArray(parsed.departments) || parsed.departments.length === 0) {
        parsed.departments = JSON.parse(JSON.stringify(DEFAULT_DEPARTMENTS));
      } else {
        // Eksik gerçek departman varsa ekle
        DEFAULT_DEPARTMENTS.forEach(defDep => {
          if (!parsed.departments.some(d => d.id === defDep.id)) {
            parsed.departments.push(defDep);
          }
        });
      }

      // Roller: Sadece ADMIN rolünde canAccessAdmin true olabilir, diğer tüm rollerde kural gereği kesinlikle false olmalıdır!
      if (!Array.isArray(parsed.roles) || parsed.roles.length === 0) {
        parsed.roles = JSON.parse(JSON.stringify(DEFAULT_ROLES));
      } else {
        parsed.roles.forEach(r => {
          if (!r.permissions) r.permissions = {};
          r.permissions.canAccessAdmin = (r.key === "ADMIN");
        });
      }

      // Kullanıcılar (users): Kesinlikle hiçbir kullanıcı silinmez!
      if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
        parsed.users = JSON.parse(JSON.stringify(DEFAULT_USERS));
      } else {
        // Gerçek kullanıcıların eksiksiz olmasını sağla
        DEFAULT_USERS.forEach(defUser => {
          const existing = parsed.users.find(u => u.username === defUser.username || u.id === defUser.id);
          if (!existing) {
            parsed.users.push(defUser);
          } else {
            // Admin şifresini eğer boşsa veya 1234 ise kullanıcının asıl PIN'i (58105810) ile güncelle
            if (defUser.username === "admin" && (!existing.pin || existing.pin === "1234")) {
              existing.pin = defUser.pin;
            }
          }
        });
      }

      // Personel (employees): Kesinlikle silinmez!
      if (!Array.isArray(parsed.employees) || parsed.employees.length === 0) {
        parsed.employees = JSON.parse(JSON.stringify(DEFAULT_EMPLOYEES));
      } else {
        DEFAULT_EMPLOYEES.forEach(defEmp => {
          if (!parsed.employees.some(e => e.id === defEmp.id || e.name === defEmp.name)) {
            parsed.employees.push(defEmp);
          }
        });
      }

      // Makineler (machines): Sadece kullanıcının gerçek fabrika makineleri korunur. Sahte/örnek makineler kesinlikle temizlenir!
      const FAKE_MACHINE_IDS = new Set(["mac_inj800", "mac_inj650", "mac_inj450", "mac_inj250", "mac_vkm01", "mac_vkm02", "mac_dsm01"]);
      const FAKE_MACHINE_NAMES = new Set(["ENJEKSİYON 800", "ENJEKSİYON 650", "ENJEKSİYON 450", "ENJEKSİYON 250", "VAKUM PRES HATTI 01", "VAKUM PRES HATTI 02", "DÖŞEME & MONTAJ HATTI"]);

      if (!Array.isArray(parsed.machines) || parsed.machines.length === 0) {
        parsed.machines = JSON.parse(JSON.stringify(DEFAULT_MACHINES));
      } else {
        // Sahte/örnek makineleri tamamen temizle
        parsed.machines = parsed.machines.filter(m => {
          const id = typeof m === "string" ? m : m.id;
          const name = typeof m === "string" ? m : m.name;
          return !FAKE_MACHINE_IDS.has(id) && !FAKE_MACHINE_NAMES.has(name);
        });

        DEFAULT_MACHINES.forEach(defMac => {
          if (!parsed.machines.some(m => (typeof m === "object" ? m.id === defMac.id || m.name.toLowerCase() === defMac.name.toLowerCase() : m === defMac.name))) {
            parsed.machines.push(defMac);
          }
        });
      }

      // Ürün Hareketleri
      if (!Array.isArray(parsed.products) || parsed.products.length === 0) {
        parsed.products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
      }

      // Forklift Talepleri
      if (!Array.isArray(parsed.forkliftRequests) || parsed.forkliftRequests.length === 0) {
        parsed.forkliftRequests = JSON.parse(JSON.stringify(DEFAULT_FORKLIFT_REQUESTS));
      }

      // Haftalık Üretim & Kalıp Baskı Planları: Sahte demo planları temizle!
      const FAKE_PLAN_IDS = new Set(["plan_1050_1", "plan_1400_1", "plan_1500_1", "plan_130_1", "plan_800_1"]);
      if (!Array.isArray(parsed.productionPlans)) {
        parsed.productionPlans = [];
      } else {
        parsed.productionPlans = parsed.productionPlans.filter(p => !FAKE_PLAN_IDS.has(p.id) && !FAKE_MACHINE_IDS.has(p.machineId) && !FAKE_MACHINE_NAMES.has(p.machineName));
      }

      // Diğer diziler
      if (!Array.isArray(parsed.supplies)) parsed.supplies = [];
      if (!Array.isArray(parsed.leaveRequests)) parsed.leaveRequests = [];
      if (!Array.isArray(parsed.overtimeRequests)) parsed.overtimeRequests = [];
      if (!Array.isArray(parsed.breakdowns)) parsed.breakdowns = [];
      if (!Array.isArray(parsed.calendarEvents)) parsed.calendarEvents = [];
      if (!Array.isArray(parsed.activityLogs)) parsed.activityLogs = [];

      // Firmalar
      if (!Array.isArray(parsed.companies) || parsed.companies.length === 0) {
        parsed.companies = [...DEFAULT_COMPANIES];
      }

      // Dış Servisler
      if (!Array.isArray(parsed.externalServices) || parsed.externalServices.length === 0) {
        parsed.externalServices = [...DEFAULT_EXTERNAL_SERVICES];
      }

      // Telegram Yapılandırması
      if (!parsed.telegramConfig || !parsed.telegramConfig.botToken) {
        parsed.telegramConfig = JSON.parse(JSON.stringify(DEFAULT_TELEGRAM_CONFIG));
      } else {
        parsed.telegramConfig = {
          botToken: parsed.telegramConfig.botToken || DEFAULT_TELEGRAM_CONFIG.botToken,
          chatId: parsed.telegramConfig.chatId || DEFAULT_TELEGRAM_CONFIG.chatId,
          enabled: parsed.telegramConfig.enabled !== false,
          notifyForkliftNew: parsed.telegramConfig.notifyForkliftNew !== false,
          notifyForkliftEnRoute: parsed.telegramConfig.notifyForkliftEnRoute !== false,
          notifyForkliftDone: parsed.telegramConfig.notifyForkliftDone !== false,
          notifyBreakdown: parsed.telegramConfig.notifyBreakdown !== false,
          notifyCalendar: parsed.telegramConfig.notifyCalendar !== false,
          notifyProduction: parsed.telegramConfig.notifyProduction !== false,
          voiceAnnounceEnabled: parsed.telegramConfig.voiceAnnounceEnabled !== false,
          webhookCallUrl: parsed.telegramConfig.webhookCallUrl || ""
        };
      }

      // Forklift Parkuru (Kesinlikle sahte veri yoktur, kullanıcı ekler)
      if (!Array.isArray(parsed.forklifts)) {
        parsed.forklifts = [];
      }

      // Yemek Şirketi & Menü Yapılandırması
      if (!parsed.cateringConfig || typeof parsed.cateringConfig !== "object") {
        parsed.cateringConfig = JSON.parse(JSON.stringify(DEFAULT_CATERING_CONFIG));
      } else {
        parsed.cateringConfig = {
          companyName: parsed.cateringConfig.companyName || "Yemek Şirketi",
          websiteUrl: parsed.cateringConfig.websiteUrl || "",
          username: parsed.cateringConfig.username || "",
          password: parsed.cateringConfig.password || "",
          menuUrl: parsed.cateringConfig.menuUrl || "",
          menuImage: parsed.cateringConfig.menuImage || "",
          menuMonth: parsed.cateringConfig.menuMonth || "Ekim 2026",
          menuDays: Array.isArray(parsed.cateringConfig.menuDays) ? parsed.cateringConfig.menuDays : [],
          updatedAt: parsed.cateringConfig.updatedAt || null,
          updatedBy: parsed.cateringConfig.updatedBy || ""
        };
      }

      // Personel Servis Güzergahları
      if (!Array.isArray(parsed.shuttleRoutes)) {
        parsed.shuttleRoutes = [];
      }

      // Varsayılan olarak oturum açılmamış başlar (Giriş ekranı zorunlu)
      parsed.currentUser = null;

      // Güncel veriyi V2 olarak kaydet
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        localStorage.setItem("sodsan_auto_backup_latest", JSON.stringify(parsed));
      } catch (e) {
        console.error("State kaydedilemedi:", e);
      }

      return parsed;
    } catch (e) {
      console.error("loadState kritik hata:", e);
      return {
        departments: JSON.parse(JSON.stringify(DEFAULT_DEPARTMENTS)),
        users: JSON.parse(JSON.stringify(DEFAULT_USERS)),
        roles: JSON.parse(JSON.stringify(DEFAULT_ROLES)),
        employees: JSON.parse(JSON.stringify(DEFAULT_EMPLOYEES)),
        products: JSON.parse(JSON.stringify(DEFAULT_PRODUCTS)),
        supplies: [],
        leaveRequests: [],
        overtimeRequests: [],
        breakdowns: [],
        forkliftRequests: JSON.parse(JSON.stringify(DEFAULT_FORKLIFT_REQUESTS)),
        forklifts: [],
        productionPlans: JSON.parse(JSON.stringify(DEFAULT_PRODUCTION_PLANS)),
        calendarEvents: [],
        companies: [...DEFAULT_COMPANIES],
        machines: JSON.parse(JSON.stringify(DEFAULT_MACHINES)),
        externalServices: [...DEFAULT_EXTERNAL_SERVICES],
        shuttleRoutes: [],
        cateringConfig: JSON.parse(JSON.stringify(DEFAULT_CATERING_CONFIG)),
        activityLogs: [],
        currentUser: null,
        telegramConfig: JSON.parse(JSON.stringify(DEFAULT_TELEGRAM_CONFIG))
      };
    }
  }

  saveState() {
    try {
      const dataStr = JSON.stringify(this.state);
      localStorage.setItem(STORAGE_KEY, dataStr);
      // Ayrıca yedek anahtarına da kaydet (veri kaybını %100 önlemek için)
      localStorage.setItem("sodsan_auto_backup_latest", dataStr);
    } catch (e) {
      console.error("State kaydedilemedi:", e);
    }
  }

  registerCompany(name) {
    const clean = (name || "").trim();
    if (!clean || clean === "Belirtilmedi") return null;
    if (!Array.isArray(this.state.companies)) {
      this.state.companies = [...DEFAULT_COMPANIES];
    }
    const exists = this.state.companies.some(c => c.toLowerCase() === clean.toLowerCase());
    if (!exists) {
      this.state.companies.push(clean);
      this.state.companies.sort((a, b) => a.localeCompare(b, 'tr'));
      this.saveState();
    }
    return clean;
  }

  registerMachine(data) {
    let name = "";
    let code = "";
    let departmentId = "";
    let location = "";
    let notes = "";

    if (typeof data === "string") {
      name = data.trim();
    } else if (data && typeof data === "object") {
      name = (data.name || "").trim();
      code = (data.code || "").trim();
      departmentId = data.departmentId || "";
      location = (data.location || "").trim();
      notes = (data.notes || "").trim();
    }

    if (!name || name === "DIGER") return null;

    if (!Array.isArray(this.state.machines)) {
      this.state.machines = JSON.parse(JSON.stringify(DEFAULT_MACHINES));
    }

    const existing = this.state.machines.find(m => {
      const mName = typeof m === "string" ? m : m.name;
      return mName.toLowerCase() === name.toLowerCase();
    });

    if (existing) {
      if (typeof existing === "object") {
        if (code) existing.code = code;
        if (departmentId) existing.departmentId = departmentId;
        if (location) existing.location = location;
        if (notes) existing.notes = notes;
        this.saveState();
        return existing;
      }
      return existing;
    }

    const newMachine = {
      id: "mac_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      name: name,
      code: code,
      departmentId: departmentId,
      location: location,
      notes: notes,
      status: "Aktif",
      addedAt: new Date().toISOString().split("T")[0]
    };

    this.state.machines.push(newMachine);
    this.saveState();
    return newMachine;
  }

  updateMachine(id, data) {
    if (!Array.isArray(this.state.machines)) return false;
    const index = this.state.machines.findIndex(m => {
      if (typeof m === "string") return m === id;
      return m.id === id || m.name === id;
    });

    if (index === -1) return false;

    const old = this.state.machines[index];
    const oldName = typeof old === "string" ? old : old.name;
    const newName = (data.name || oldName).trim();

    const updated = {
      id: (typeof old === "object" && old.id) ? old.id : ("mac_" + Date.now()),
      name: newName,
      code: data.code !== undefined ? data.code.trim() : (old.code || ""),
      departmentId: data.departmentId !== undefined ? data.departmentId : (old.departmentId || ""),
      location: data.location !== undefined ? data.location.trim() : (old.location || ""),
      notes: data.notes !== undefined ? data.notes.trim() : (old.notes || ""),
      status: data.status || (typeof old === "object" ? old.status : "Aktif"),
      addedAt: (typeof old === "object" && old.addedAt) ? old.addedAt : new Date().toISOString().split("T")[0]
    };

    this.state.machines[index] = updated;

    // Eğer makine adı değiştiyse, arıza kayıtlarındaki makine adını da güncelle
    if (oldName !== newName && Array.isArray(this.state.breakdowns)) {
      this.state.breakdowns.forEach(b => {
        if (b.machineName === oldName) {
          b.machineName = newName;
        }
      });
    }

    this.saveState();
    return updated;
  }

  deleteMachine(id) {
    if (!Array.isArray(this.state.machines)) return false;
    this.state.machines = this.state.machines.filter(m => {
      if (typeof m === "string") return m !== id;
      return m.id !== id && m.name !== id;
    });
    this.saveState();
    return true;
  }

  addExternalService(service) {
    if (!Array.isArray(this.state.externalServices)) {
      this.state.externalServices = [];
    }
    const newService = {
      id: "ext_" + Date.now(),
      companyName: service.companyName || "",
      contactPerson: service.contactPerson || "",
      specialty: service.specialty || "",
      phone: service.phone || "",
      notes: service.notes || ""
    };
    this.state.externalServices.push(newService);
    this.saveState();
    return newService;
  }

  deleteExternalService(id) {
    if (!Array.isArray(this.state.externalServices)) return;
    this.state.externalServices = this.state.externalServices.filter(s => s.id !== id);
    this.saveState();
  }

  // Haftalık Üretim & Kalıp Baskı Metotları
  addProductionPlan(plan) {
    if (!Array.isArray(this.state.productionPlans)) {
      this.state.productionPlans = [];
    }
    const newPlan = {
      id: "plan_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
      weekNumber: plan.weekNumber || 43,
      weekStart: plan.weekStart || "2026-10-19",
      weekEnd: plan.weekEnd || "2026-10-25",
      machineId: plan.machineId || "",
      machineName: plan.machineName || "",
      moldCode: plan.moldCode || "",
      moldName: plan.moldName || "",
      productName: plan.productName || "",
      targetQuantity: Number(plan.targetQuantity) || 0,
      producedQuantity: Number(plan.producedQuantity) || 0,
      unit: plan.unit || "Adet",
      day: plan.day || "Hafta Boyu",
      cavityCount: plan.cavityCount || "1 Gözlü",
      rawMaterial: plan.rawMaterial || "",
      cycleTimeSec: Number(plan.cycleTimeSec) || 0,
      operatorName: plan.operatorName || "",
      status: plan.status || "Planlandı",
      notes: plan.notes || "",
      createdAt: new Date().toISOString(),
      createdBy: this.state.currentUser ? this.state.currentUser.name : "Sistem Yöneticisi"
    };
    this.state.productionPlans.unshift(newPlan);
    this.saveState();
    return newPlan;
  }

  updateProductionPlan(id, updates) {
    if (!Array.isArray(this.state.productionPlans)) return null;
    const plan = this.state.productionPlans.find(p => p.id === id);
    if (!plan) return null;
    Object.assign(plan, updates);
    this.saveState();
    return plan;
  }

  deleteProductionPlan(id) {
    if (!Array.isArray(this.state.productionPlans)) return false;
    const initialLen = this.state.productionPlans.length;
    this.state.productionPlans = this.state.productionPlans.filter(p => p.id !== id);
    if (this.state.productionPlans.length !== initialLen) {
      this.saveState();
      return true;
    }
    return false;
  }

  logProductionCount(id, addCount, operatorName) {
    if (!Array.isArray(this.state.productionPlans)) return null;
    const plan = this.state.productionPlans.find(p => p.id === id);
    if (!plan) return null;
    const count = Number(addCount) || 0;
    plan.producedQuantity = Math.max(0, (Number(plan.producedQuantity) || 0) + count);
    if (plan.producedQuantity >= plan.targetQuantity && plan.status !== "Tamamlandı") {
      plan.status = "Tamamlandı";
    } else if (plan.producedQuantity > 0 && plan.status === "Planlandı") {
      plan.status = "Üretimde";
    }
    this.saveState();
    return plan;
  }

  // Tüm kullanıcıları (Ustalar, İdari, Bakım, Saha) otomatik çalışan listesine senkronize eder
  syncUsersToEmployees() {
    if (!this.state) return;
    if (!Array.isArray(this.state.employees)) {
      this.state.employees = [];
    }
    const users = this.state.users || [];
    let changed = false;

    users.forEach(u => {
      // Mevcut çalışanı ID veya isim üzerinden eşle
      const emp = this.state.employees.find(e => e.userId === u.id || e.id === u.id || e.name === u.name);
      if (emp) {
        if (!emp.userId) { emp.userId = u.id; changed = true; }
        if (emp.role !== u.role) { emp.role = u.role; changed = true; }
        if (emp.departmentId !== u.departmentId) { emp.departmentId = u.departmentId; changed = true; }
        if (emp.name !== u.name) { emp.name = u.name; changed = true; }
      } else {
        this.state.employees.push({
          id: u.id,
          userId: u.id,
          name: u.name,
          role: u.role,
          departmentId: u.departmentId,
          totalLeave: 14,
          usedLeave: 0,
          remainingLeave: 14,
          hireDate: "2024-01-01"
        });
        changed = true;
      }
    });

    if (changed) {
      this.saveState();
    }
  }

  resetToDefaults() {
    localStorage.removeItem(STORAGE_KEY);
    this.state = this.loadState();
    this.saveState();
  }

  exportDataJson() {
    return JSON.stringify(this.state, null, 2);
  }

  importDataJson(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.departments && parsed.users) {
        this.state = parsed;
        this.saveState();
        return true;
      }
    } catch (e) {
      console.error("Geçersiz JSON dosyası:", e);
    }
    return false;
  }

  logActivity(actionType, description, details = {}) {
    try {
      if (!this.state.activityLogs) {
        this.state.activityLogs = [];
      }
      const user = this.state.currentUser || { id: "u_anon", name: "Sistem", role: "SYSTEM" };
      const dep = this.state.departments.find(d => d.id === user.departmentId) || { name: "-" };
      
      const newLog = {
        id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        departmentId: user.departmentId || null,
        departmentName: dep.name,
        actionType: actionType,
        description: description,
        details: details
      };

      this.state.activityLogs.unshift(newLog);
      // En fazla 500 kayıt tut
      if (this.state.activityLogs.length > 500) {
        this.state.activityLogs = this.state.activityLogs.slice(0, 500);
      }
      this.saveState();
      return newLog;
    } catch (e) {
      console.error("Log kaydı oluşturulamadı:", e);
    }
  }
}

export const appState = new StateManager();

export function logSystemAction(actionType, description, details = {}) {
  return appState.logActivity(actionType, description, details);
}

export function registerCompany(name) {
  return appState.registerCompany(name);
}

export function registerMachine(data) {
  return appState.registerMachine(data);
}

export function updateMachine(id, data) {
  return appState.updateMachine(id, data);
}

export function deleteMachine(id) {
  return appState.deleteMachine(id);
}

export function addExternalService(service) {
  return appState.addExternalService(service);
}

export function deleteExternalService(id) {
  return appState.deleteExternalService(id);
}
