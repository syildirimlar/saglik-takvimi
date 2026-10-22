// SODSAN Fabrika İçi Portal - Veri Modeli ve Durum Yönetimi (data.js)

const STORAGE_KEY = "SODSAN_PORTAL_STATE_V1";

// Standart Varsayılan Departmanlar
export const DEFAULT_DEPARTMENTS = [
  { id: "dep_hammadde", name: "Hammadde & Giriş Depo", icon: "📦", color: "#3b82f6" },
  { id: "dep_kesim", name: "Kesim & Sünger Üretim", icon: "✂️", color: "#8b5cf6" },
  { id: "dep_montaj", name: "Montaj & Hatlar", icon: "⚙️", color: "#06b6d4" },
  { id: "dep_sevkiyat", name: "Sevkiyat & Mamul Depo", icon: "🚚", color: "#f59e0b" },
  { id: "dep_bakim", name: "Bakım & Onarım", icon: "🛠️", color: "#ef4444" },
  { id: "dep_kalite", name: "Kalite Kontrol", icon: "🔍", color: "#10b981" },
  { id: "dep_satinalma", name: "Satın Alma", icon: "🛒", color: "#6366f1" },
  { id: "dep_ik", name: "İnsan Kaynakları & İdari İşler", icon: "👔", color: "#ec4899" },
  { id: "dep_yonetim", name: "Fabrika Müdürlüğü / Yönetim", icon: "🏢", color: "#1e293b" }
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

// Oturum açan kullanıcının İK / Yönetici yetkisine sahip olup olmadığını denetler
export function isManagerOrHr() {
  if (typeof appState === "undefined" || !appState || !appState.state || !appState.state.currentUser) return false;
  const user = appState.state.currentUser;
  if (user.role === "ADMIN" || user.role === "IK" || user.role === "YONETICI") return true;
  const roleDef = (appState.state.roles || []).find(r => r.key === user.role);
  return !!(roleDef && roleDef.permissions && (roleDef.permissions.canAccessAdmin || roleDef.permissions.canApproveLeave || roleDef.permissions.canApproveOvertime));
}

// Oturum açan kullanıcının çalışanlar (employees) tablosundaki karşılığını getirir
export function getCurrentUserEmployee() {
  if (typeof appState === "undefined" || !appState || !appState.state || !appState.state.currentUser) return null;
  const user = appState.state.currentUser;
  const employees = appState.state.employees || [];
  return employees.find(e => e.userId === user.id || e.id === user.id || e.name.toLowerCase() === user.name.toLowerCase()) || null;
}

// Başlangıç Demo Kullanıcıları
export const DEFAULT_USERS = [
  { id: "u_admin", username: "admin", name: "Sistem Yöneticisi", role: "ADMIN", departmentId: "dep_yonetim", phone: "5551112233", pin: "1234" },
  { id: "u_ik", username: "ik_elif", name: "Elif Hanım (İK)", role: "IK", departmentId: "dep_ik", phone: "5552223344", pin: "1234" },
  { id: "u_ahmet", username: "usta_ahmet", name: "Ahmet Usta (Kesim)", role: "USTA", departmentId: "dep_kesim", phone: "5553334455", pin: "1234" },
  { id: "u_mehmet", username: "usta_mehmet", name: "Mehmet Usta (Montaj)", role: "USTA", departmentId: "dep_montaj", phone: "5554445566", pin: "1234" },
  { id: "u_ali", username: "forklift_ali", name: "Ali K. (Forklift)", role: "FORKLIFT", departmentId: "dep_sevkiyat", phone: "5555556677", pin: "1234" },
  { id: "u_kemal", username: "bakim_kemal", name: "Kemal Usta (Bakım)", role: "BAKIM", departmentId: "dep_bakim", phone: "5556667788", pin: "1234" },
  { id: "u_hasan", username: "depo_hasan", name: "Hasan Bey (Hammadde)", role: "USTA", departmentId: "dep_hammadde", phone: "5557778899", pin: "1234" },
  { id: "u_can", username: "personel_can", name: "Can Demir (Operatör)", role: "PERSONEL", departmentId: "dep_kesim", phone: "5558889900", pin: "1234" }
];

// Başlangıç Personel Listesi (İzin Bakiye Takibi için - Boş başlangıç)
export const DEFAULT_EMPLOYEES = [];

// Gelen-Giden Ürün Hareketleri (Boş başlangıç)
export const DEFAULT_PRODUCTS = [];

// Sarf Malzeme İhtiyaçları (Boş başlangıç)
export const DEFAULT_SUPPLIES = [];

// İzin Talepleri (Boş başlangıç)
export const DEFAULT_LEAVE_REQUESTS = [];

// Fazla Mesai Talepleri (Boş başlangıç)
export const DEFAULT_OVERTIME_REQUESTS = [];

// Makina Arıza Bildirimleri (Boş başlangıç)
export const DEFAULT_BREAKDOWNS = [];

// Forklift Çağrıları (Boş başlangıç)
export const DEFAULT_FORKLIFT_REQUESTS = [];

// Takvim Etkinlikleri & Makine Bakım Planı (Boş başlangıç)
export const DEFAULT_CALENDAR_EVENTS = [];

// Standart Tanımlı Firma & Tedarikçi & Müşteri Listesi
export const DEFAULT_COMPANIES = [
  "Bayer Kimya A.Ş.",
  "Bellona Mobilya A.Ş.",
  "İstikbal Mobilya",
  "Doğan Sünger",
  "Yataş A.Ş.",
  "Teknik Bıçak San.",
  "Kolsan Koltuk"
];

// Tanımlı Makina & Hat Listesi (Kompresör hariç hepsi silindi, kullanıcı yenilerini ekleyebilir)
export const DEFAULT_MACHINES = [
  "Kompresör"
];

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

// Başlangıç İşlem Kayıtları (Audit Log - Boş başlangıç)
export const DEFAULT_LOGS = [];

// LocalStorage Veri Yükleyici & Saklayıcı
export class StateManager {
  constructor() {
    this.state = this.loadState();
    this.syncUsersToEmployees();
  }

  loadState() {
    // Eski örnek/demo olay ve kayıtların ID kümesi
    const DEMO_IDS = new Set([
      "p_1", "p_2", "p_3",
      "sup_1", "sup_2", "sup_3",
      "leave_1", "leave_2",
      "ot_1", "ot_2", "ot_3",
      "brk_1", "brk_2",
      "fork_1", "fork_2",
      "ev_1", "ev_2", "ev_3",
      "log_1", "log_2", "log_3", "log_4", "log_5",
      "emp_1", "emp_2", "emp_3", "emp_4", "emp_5", "emp_6"
    ]);

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.roles || parsed.roles.length === 0) {
          parsed.roles = DEFAULT_ROLES;
        }

        // Önbellekteki veya mevcut depolamadaki tüm örnek olayları kaldır
        let stateChanged = false;
        const cleanArray = (key) => {
          if (Array.isArray(parsed[key])) {
            const beforeCount = parsed[key].length;
            parsed[key] = parsed[key].filter(item => item && item.id && !DEMO_IDS.has(item.id));
            if (parsed[key].length !== beforeCount) {
              stateChanged = true;
            }
          } else {
            parsed[key] = [];
            stateChanged = true;
          }
        };

        cleanArray("products");
        cleanArray("supplies");
        cleanArray("leaveRequests");
        cleanArray("overtimeRequests");
        cleanArray("breakdowns");
        cleanArray("forkliftRequests");
        cleanArray("calendarEvents");
        cleanArray("activityLogs");

        // Firma & Müşteri Listesi
        if (!Array.isArray(parsed.companies) || parsed.companies.length === 0) {
          parsed.companies = [...DEFAULT_COMPANIES];
          stateChanged = true;
        }

        // Makina Listesi (Kompresör hariç eski varsayılanlar silinir, Kompresör ve eklenenler kalır)
        const OLD_HARDCODED_MACHINES = new Set([
          "Dikey Blok Kesim Makinası No:1",
          "Dikey Blok Kesim Makinası No:2",
          "Yatay Sünger Dilme Hattı",
          "Köpük Döküm Reaktörü & Mikser",
          "Blok Taşıma Konveyör Hattı",
          "CNC Kontur Kesim Robotu",
          "Paketleme & Rulo Pres Makinası",
          "Koltuk Karkas Montaj Robotu",
          "Vidalı Hava Kompresörü & Kurutucu"
        ]);
        if (!Array.isArray(parsed.machines)) {
          parsed.machines = [...DEFAULT_MACHINES];
          stateChanged = true;
        } else {
          const filteredMachines = parsed.machines.filter(m => !OLD_HARDCODED_MACHINES.has(m));
          if (!filteredMachines.some(m => m.toLowerCase().includes("kompresör") || m.toLowerCase().includes("kompresor"))) {
            filteredMachines.unshift("Kompresör");
          }
          if (filteredMachines.length !== parsed.machines.length) {
            parsed.machines = filteredMachines;
            stateChanged = true;
          }
        }

        // Dış Servis Ekipleri Rehberi
        if (!Array.isArray(parsed.externalServices) || parsed.externalServices.length === 0) {
          parsed.externalServices = [...DEFAULT_EXTERNAL_SERVICES];
          stateChanged = true;
        }

        // Sahte/Örnek Personel Kayıtlarını Çizelgeden Temizle
        if (Array.isArray(parsed.employees)) {
          const fakeEmpNames = new Set(["Can Demir", "Murat Yıldız", "Serkan Aydın", "İsmail Koç", "Recep Şen", "Yusuf Çelik"]);
          const beforeEmpCount = parsed.employees.length;
          parsed.employees = parsed.employees.filter(emp => !DEMO_IDS.has(emp.id) && !fakeEmpNames.has(emp.name));
          if (parsed.employees.length !== beforeEmpCount) {
            stateChanged = true;
          }
        } else {
          parsed.employees = [];
          stateChanged = true;
        }

        // Örnek izinler temizlendiğinde personel kalan izinlerini sıfırla/düzelt
        if (Array.isArray(parsed.employees)) {
          parsed.employees.forEach(emp => {
            if (emp.usedLeave > 0 && (!parsed.leaveRequests || parsed.leaveRequests.length === 0)) {
              emp.usedLeave = 0;
              emp.remainingLeave = emp.totalLeave;
              stateChanged = true;
            }
          });
        }

        if (stateChanged) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          } catch (e) {
            console.error("Temizlenen state kaydedilemedi:", e);
          }
        }

        return parsed;
      }
    } catch (e) {
      console.error("State parse hatası:", e);
    }

    return {
      departments: DEFAULT_DEPARTMENTS,
      users: DEFAULT_USERS,
      roles: DEFAULT_ROLES,
      activityLogs: DEFAULT_LOGS,
      employees: DEFAULT_EMPLOYEES,
      products: DEFAULT_PRODUCTS,
      supplies: DEFAULT_SUPPLIES,
      leaveRequests: DEFAULT_LEAVE_REQUESTS,
      overtimeRequests: DEFAULT_OVERTIME_REQUESTS,
      breakdowns: DEFAULT_BREAKDOWNS,
      forkliftRequests: DEFAULT_FORKLIFT_REQUESTS,
      calendarEvents: DEFAULT_CALENDAR_EVENTS,
      companies: [...DEFAULT_COMPANIES],
      machines: [...DEFAULT_MACHINES],
      externalServices: [...DEFAULT_EXTERNAL_SERVICES],
      currentUser: DEFAULT_USERS[0], // Varsayılan Admin
      telegramConfig: {
        botToken: "",
        chatId: "",
        enabled: false
      }
    };
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
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

  registerMachine(name) {
    const clean = (name || "").trim();
    if (!clean || clean === "DIGER") return null;
    if (!Array.isArray(this.state.machines)) {
      this.state.machines = [...DEFAULT_MACHINES];
    }
    const exists = this.state.machines.some(m => m.toLowerCase() === clean.toLowerCase());
    if (!exists) {
      this.state.machines.push(clean);
      this.state.machines.sort((a, b) => a.localeCompare(b, 'tr'));
      this.saveState();
    }
    return clean;
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

export function registerMachine(name) {
  return appState.registerMachine(name);
}

export function addExternalService(service) {
  return appState.addExternalService(service);
}

export function deleteExternalService(id) {
  return appState.deleteExternalService(id);
}
