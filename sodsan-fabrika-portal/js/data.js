// SODSAN Fabrika İçi Portal - Veri Modeli ve Durum Yönetimi (data.js)

const STORAGE_KEY = "SODSAN_PORTAL_STATE_V2";
const LEGACY_STORAGE_KEY = "SODSAN_PORTAL_STATE_V1";

// Standart Gerçek Fabrika Departmanları
export const DEFAULT_DEPARTMENTS = [
  { id: "dep_sevkiyat", name: "Sevkiyat & Mamul Depo", icon: "🚚", color: "#f59e0b" },
  { id: "dep_bakim", name: "Bakım & Onarım", icon: "🛠️", color: "#ef4444" },
  { id: "dep_kalite", name: "Kalite Kontrol", icon: "🔍", color: "#10b981" },
  { id: "dep_satinalma", name: "Satın Alma", icon: "🛒", color: "#6366f1" },
  { id: "dep_ik", name: "İdari İşler", icon: "👔", color: "#ec4899" },
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
      canViewAllLeaveBalances: true,
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
    key: "IZLEYICI",
    title: "İzleyici / Gözlemci",
    badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
    permissions: {
      canViewAllLeaveBalances: true,
      canAddProduct: false,
      canCallForklift: false,
      canCompleteForklift: false,
      canRequestLeave: false,
      canApproveLeave: false,
      canRequestOvertime: false,
      canApproveOvertime: false,
      canAddSupply: false,
      canAddMaintenance: false,
      canAccessAdmin: false
    }
  },
  {
    key: "IK",
    title: "İdari İşler",
    badge: "bg-pink-100 text-pink-800",
    permissions: {
      canViewAllLeaveBalances: true,
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
    title: "Vardiya Amiri",
    badge: "bg-blue-100 text-blue-800",
    permissions: {
      canViewAllLeaveBalances: false,
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
      canViewAllLeaveBalances: false,
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
      canViewAllLeaveBalances: false,
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
      canViewAllLeaveBalances: false,
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
  // 1. Aktif kullanıcı nesnesi (appState veya window üzerinde mevcutsa KESİNLİKLE yetkili kaynaktır)
  const curUser = (typeof appState !== "undefined" && appState && appState.state && appState.state.currentUser)
    ? appState.state.currentUser
    : (typeof window !== "undefined" && window.__portalCurrentUser ? window.__portalCurrentUser : null);

  if (curUser) {
    const role = String(curUser.role || "").trim().toUpperCase();
    const username = String(curUser.username || "").trim().toLowerCase();
    const uid = String(curUser.id || "").trim();
    return (role === "ADMIN" || username === "admin" || uid === "u_admin");
  }

  // 2. Yalnızca henüz aktif bir kullanıcı nesnesi belleğe yüklenmemişse (ilk boot anı) oturum belirteçlerine bak
  if (typeof sessionStorage !== "undefined") {
    const sessId = sessionStorage.getItem("sodsan_session_user_id");
    if (sessId) return (sessId === "u_admin" || sessId === "admin");
  }
  if (typeof localStorage !== "undefined") {
    const authId = localStorage.getItem("sodsan_auth_user_id");
    if (authId) return (authId === "u_admin" || authId === "admin");
  }

  return false;
}

// Oturum açan kullanıcının İdari İşler (İK) veya Admin olup olmadığını denetler
export function isIdariIslerOrAdmin() {
  if (isAdmin()) return true;
  const user = (typeof appState !== "undefined" && appState && appState.state && appState.state.currentUser) 
    ? appState.state.currentUser 
    : (typeof window !== "undefined" ? window.__portalCurrentUser : null);
  if (!user) return false;
  const normRole = normalizeRoleText(user.role);
  const depId = String(user.departmentId || "").trim().toLowerCase();
  const uUsername = String(user.username || "").toLowerCase();
  const uName = String(user.name || "").toLowerCase();

  // Öner kullanıcısı veya idari işler / İK / yönetim rolleri
  if (uUsername.includes("oner") || uName.includes("oner")) return true;
  if (normRole === "ik" || normRole.includes("idari") || normRole.includes("yonetici") || normRole.includes("yonetim") || depId === "dep_ik" || depId === "dep_yonetim") return true;

  if (typeof appState !== "undefined" && appState && appState.state && Array.isArray(appState.state.roles)) {
    const roleDef = appState.state.roles.find(r => normalizeRoleText(r.key) === normRole || r.id === user.role);
    if (roleDef) {
      const titleNorm = normalizeRoleText(roleDef.title);
      if (titleNorm.includes("idari") || titleNorm.includes("insan kaynak") || titleNorm.includes("ik") || titleNorm.includes("yonetici") || titleNorm.includes("yonetim")) return true;
      if (roleDef.permissions && (roleDef.permissions.canApproveLeave || roleDef.permissions.canApproveOvertime)) return true;
    }
  }
  return false;
}

// Oturum açan kullanıcının İK / Yönetici yetkisine sahip olup olmadığını denetler
export function isManagerOrHr() {
  return isIdariIslerOrAdmin();
}

// Yardımcı metin normalleştirici (Türkçe karakter ve yazım varyasyonlarına karşı tam uyumlu: 'İ', 'I', 'ı', 'i')
function normalizeRoleText(str) {
  if (!str) return "";
  return String(str)
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .replace(/ı/g, "i")
    .toLowerCase()
    .trim();
}

// Oturum açan kullanıcının veya parametre olarak verilen kullanıcının 'İzleyici' rolünde olup olmadığını denetler
export function isViewer(userOrRole = null) {
  let role = "";
  let user = null;

  if (typeof userOrRole === "string") {
    role = userOrRole;
  } else if (userOrRole && typeof userOrRole === "object") {
    user = userOrRole;
    role = String(user.role || "");
  } else {
    user = (typeof appState !== "undefined" && appState && appState.state && appState.state.currentUser)
      ? appState.state.currentUser
      : (typeof window !== "undefined" && window.__portalCurrentUser ? window.__portalCurrentUser : null);
    if (user) {
      role = String(user.role || "");
    }
  }

  const normRole = normalizeRoleText(role);
  if (!normRole && !user) return false;

  // 1. Standart anahtar varyasyonları: IZLEYICI, VIEWER, GOZLEMCI, ızleyıcı
  if (normRole === "izleyici" || normRole === "viewer" || normRole === "gozlemci" ||
      normRole.includes("izleyici") || normRole.includes("viewer") || normRole.includes("gozlemci")) {
    return true;
  }

  // 2. Rol listesindeki tanımından kontrol et (Kullanıcının Admin panelinde dinamik oluşturduğu rol başlığı veya anahtarı)
  if (typeof appState !== "undefined" && appState && appState.state && Array.isArray(appState.state.roles)) {
    const roleDef = appState.state.roles.find(r => 
      normalizeRoleText(r.key) === normRole || 
      String(r.id || "").trim() === String(role).trim()
    );
    if (roleDef) {
      const titleNorm = normalizeRoleText(roleDef.title);
      const keyNorm = normalizeRoleText(roleDef.key);
      if (titleNorm.includes("izleyici") || titleNorm.includes("gozlemci") || titleNorm.includes("viewer") ||
          keyNorm.includes("izleyici") || keyNorm.includes("viewer") || keyNorm.includes("gozlemci")) {
        return true;
      }
    }
  }

  // 3. Kullanıcı nesnesinin doğrudan title veya roleTitle alanı varsa
  if (user) {
    if (user.roleTitle && normalizeRoleText(user.roleTitle).includes("izleyici")) return true;
    if (user.title && normalizeRoleText(user.title).includes("izleyici")) return true;
  }

  return false;
}

// Belirli bir kullanıcının veya personelin aktif oturumu kullanan kişi tarafından görülüp görülemeyeceğini denetler.
// KURAL: İzleyici rolündeki kullanıcılar YALNIZCA Sistem Yöneticisi (Admin) tarafından görülebilir!
export function isUserVisibleToCurrentSession(targetUserOrEmployee) {
  if (!targetUserOrEmployee) return false;

  // Hedef kullanıcının rolünü tespit et
  let targetRole = targetUserOrEmployee.role || "";
  if (!targetRole && targetUserOrEmployee.userId && typeof appState !== "undefined" && appState && appState.state) {
    const u = (appState.state.users || []).find(x => x.id === targetUserOrEmployee.userId);
    if (u) targetRole = u.role;
  }

  // Eğer hedef kişi bir İzleyici ise:
  if (isViewer(targetUserOrEmployee) || isViewer(targetRole)) {
    // Kural: Sadece ve yalnızca Admin görebilir!
    return isAdmin();
  }

  return true;
}

// Oturum açan kullanıcının çalışanlar (employees) tablosundaki karşılığını getirir
export function getCurrentUserEmployee() {
  if (typeof appState === "undefined" || !appState || !appState.state || !appState.state.currentUser) return null;
  const user = appState.state.currentUser;
  const employees = appState.state.employees || [];
  return employees.find(e => isEmployeeCurrentUser(e, user)) || null;
}

// Bir çalışan nesnesinin (employee) oturumdaki aktif kullanıcıya ait olup olmadığını doğrular
export function isEmployeeCurrentUser(emp, user = null) {
  const curUser = user || (typeof appState !== "undefined" && appState && appState.state ? appState.state.currentUser : null);
  if (!curUser || !emp) return false;

  const curId = String(curUser.id || "").trim();
  const curUsername = normalizeRoleText(curUser.username || "");
  const curName = normalizeRoleText(curUser.name || "");

  const empId = String(emp.id || "").trim();
  const empUserId = String(emp.userId || "").trim();
  const empName = normalizeRoleText(emp.name || "");

  return (
    (curId && (empUserId === curId || empId === curId)) ||
    (curUsername && (empName === curUsername || normalizeRoleText(empUserId) === curUsername)) ||
    (curName && empName === curName) ||
    (empName && curName && (empName.includes(curName) || curName.includes(empName)))
  );
}

// Admin, İzleyici ve İdari Kısım (İK / İdari İşler / Yönetim) dışındaki hiçbir rolün ve kişinin
// kendisinden başkalarının izin gün sayılarını görmesini engelleyen merkezi güvenlik fonksiyonu
// Admin panelindeki Yetki & Görünürlük Matrisinden dinamik olarak kontrol edilebilir!
export function canViewAllLeaveBalances(user = null) {
  const curUser = user || (typeof appState !== "undefined" && appState && appState.state ? appState.state.currentUser : null);
  if (isAdmin()) return true;
  if (!curUser) return false;

  // 1. Dinamik rol tablosundaki 'canViewAllLeaveBalances' tanımını kontrol et
  const roleKey = String(curUser.role || "").toUpperCase();
  if (typeof appState !== "undefined" && appState && appState.state && Array.isArray(appState.state.roles)) {
    const roleDef = appState.state.roles.find(r => String(r.key || "").toUpperCase() === roleKey || r.id === curUser.role);
    if (roleDef && roleDef.permissions && typeof roleDef.permissions.canViewAllLeaveBalances === "boolean") {
      return roleDef.permissions.canViewAllLeaveBalances;
    }
  }

  // 2. Varsayılan korumalar: İzleyici veya İdari Kısım görebilir, diğerleri göremez
  if (isViewer(curUser)) return true;
  if (isIdariIslerOrAdmin()) return true;
  return false;
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
  { id: "u_1792699659049", username: "buke", name: "Büke", role: "IK", departmentId: "dep_ik", phone: "", pin: "1234" },
  { id: "u_1793335108706", username: "taner", name: "Taner", role: "IZLEYICI", departmentId: "dep_yonetim", phone: "", pin: "1234" },
  { id: "u_1793341866461", username: "öner", name: "oner", role: "IK", departmentId: "dep_ik", phone: "", pin: "1234" }
];

// Başlangıç Gerçek Fabrika Personel Listesi (İzin Bakiye Takibi - Admin hariç!)
export const DEFAULT_EMPLOYEES = [
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
  { id: "u_1792699659049", userId: "u_1792699659049", name: "Büke", role: "IK", departmentId: "dep_ik", totalLeave: 14, usedLeave: 0, remainingLeave: 14, hireDate: "2024-01-01" },
  { id: "u_1793335108706", userId: "u_1793335108706", name: "Taner", role: "IZLEYICI", departmentId: "dep_yonetim", totalLeave: 14, usedLeave: 0, remainingLeave: 14, hireDate: "2024-01-01" },
  { id: "u_1793341866461", userId: "u_1793341866461", name: "oner", role: "IK", departmentId: "dep_ik", totalLeave: 14, usedLeave: 0, remainingLeave: 14, hireDate: "2024-01-01" }
];

// Gelen-Giden Ürün Hareketleri (Gerçek Kayıtlar)
export const DEFAULT_PRODUCTS = [
  {
    id: "p_1793342651053",
    date: "2026-10-30T06:44:11.053Z",
    type: "GELEN",
    departmentId: "dep_ik",
    productName: "Pp hammadde",
    amount: 3,
    unit: "Ton",
    unitDetail: "",
    company: "Burpol",
    supplier: "Burpol",
    invoiceNo: "",
    createdBy: "oner",
    createdById: "u_1793341866461",
    createdByUsername: "öner",
    note: ""
  },
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
export const DEFAULT_BREAKDOWNS = [
  {
    id: "brk_1793334488743",
    machineName: "TAILIFT FORKLİFT",
    departmentId: "dep_yonetim",
    location: "1500 VAKUM",
    faultType: "Mekanik / Sıkışma / Rulman",
    urgency: "Normal",
    description: "FORKLİFT BAKIMI YAPILDI(HAMDİ AYAZ)",
    reportedBy: "Sistem Yöneticisi",
    reportedTime: "2026-10-30T04:28:08.743Z",
    status: "Giderildi",
    assignedTechnician: null,
    technicianNotes: "[GİDERİLDİ] Sistem Yöneticisi: Arıza giderildi, test yapıldı ve çalışır vaziyette teslim edildi.",
    resolvedTime: "2026-10-30T04:28:25.598Z"
  },
  {
    id: "brk_1793334390045",
    machineName: "HUAYA FORKLİFT",
    departmentId: "dep_yonetim",
    location: "1400 Depo",
    faultType: "Mekanik / Sıkışma / Rulman",
    urgency: "Normal",
    description: "Aküler yenilendi(Mavi Global)",
    reportedBy: "Sistem Yöneticisi",
    reportedTime: "2026-10-30T04:26:30.045Z",
    status: "Giderildi",
    assignedTechnician: null,
    technicianNotes: "[GİDERİLDİ] Sistem Yöneticisi: Arıza giderildi, test yapıldı ve çalışır vaziyette teslim edildi.",
    resolvedTime: "2026-10-30T04:26:51.981Z"
  }
];

// Tanımlı Standart Makine Arıza Türleri
export const DEFAULT_FAULT_TYPES = [
  { id: "ft_mekanik", name: "Mekanik / Sıkışma / Rulman / Kasnak", icon: "⚙️", isCustom: false },
  { id: "ft_elektrik", name: "Elektrik / Sigorta / Motor / Şalter", icon: "⚡", isCustom: false },
  { id: "ft_hidrolik", name: "Hidrolik / Pnömatik / Basınç / Kaçak", icon: "💧", isCustom: false },
  { id: "ft_bicak", name: "Bıçak / Tel Kopması / Kalıp", icon: "🔪", isCustom: false },
  { id: "ft_otomasyon", name: "Otomasyon / Sensör / PLC / Ekran", icon: "💻", isCustom: false },
  { id: "ft_isitici", name: "Isıtıcı / Rezistans / Termokupl", icon: "🔥", isCustom: false },
  { id: "ft_yaglama", name: "Yağlama / Filtre / Soğutma Suyu", icon: "🛢️", isCustom: false },
  { id: "ft_bilinmiyor", name: "Bilinmiyor / Ses, Koku veya Duman", icon: "❓", isCustom: false }
];

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
export const DEFAULT_CALENDAR_EVENTS = [
    {
        "id":  "ev_maint_enj-1400_2025_10_01",
        "title":  "[ENJEKSIYON 1400] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2025-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Tamamlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2025_10_01",
        "title":  "[ENJEKSIYON 1500] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2025-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Tamamlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2025_10_01",
        "title":  "[ENJEKSIYON 1050] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2025-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Tamamlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2025_10_01",
        "title":  "[ENJEKSIYON 130] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2025-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Tamamlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2025_11_01",
        "title":  "[ENJEKSIYON 1400] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2025-11-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Tamamlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2025_11_01",
        "title":  "[ENJEKSIYON 1500] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2025-11-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Tamamlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2025_11_01",
        "title":  "[ENJEKSIYON 1050] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2025-11-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Tamamlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2025_11_01",
        "title":  "[ENJEKSIYON 130] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2025-11-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Tamamlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2025_12_01",
        "title":  "[ENJEKSIYON 1400] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2025-12-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Tamamlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2025_12_01",
        "title":  "[ENJEKSIYON 1500] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2025-12-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Tamamlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2025_12_01",
        "title":  "[ENJEKSIYON 1050] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2025-12-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Tamamlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2025_12_01",
        "title":  "[ENJEKSIYON 130] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2025-12-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Tamamlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2026_01_01",
        "title":  "[ENJEKSIYON 1400] 3 Aylik Bakim ve Filtre Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2026-01-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Tamamlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2026_01_01",
        "title":  "[ENJEKSIYON 1500] 3 Aylik Bakim ve Filtre Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2026-01-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Tamamlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2026_01_01",
        "title":  "[ENJEKSIYON 1050] 3 Aylik Bakim ve Filtre Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2026-01-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Tamamlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2026_01_01",
        "title":  "[ENJEKSIYON 130] 3 Aylik Bakim ve Filtre Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2026-01-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Tamamlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2026_02_01",
        "title":  "[ENJEKSIYON 1400] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-02-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2026_02_01",
        "title":  "[ENJEKSIYON 1500] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-02-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2026_02_01",
        "title":  "[ENJEKSIYON 1050] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-02-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2026_02_01",
        "title":  "[ENJEKSIYON 130] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-02-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2026_03_01",
        "title":  "[ENJEKSIYON 1400] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-03-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2026_03_01",
        "title":  "[ENJEKSIYON 1500] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-03-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2026_03_01",
        "title":  "[ENJEKSIYON 1050] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-03-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2026_03_01",
        "title":  "[ENJEKSIYON 130] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-03-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2026_04_01",
        "title":  "[ENJEKSIYON 1400] 6 Aylik Kapsamli Bakim ve Esanjor Temizligi",
        "type":  "MAKINABAKIM",
        "date":  "2026-04-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[6 AYLIK VE 3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi\n- Yag sogutma esanjor temizligi\n- Makina terazi kontrolu\n- Hareketli plaka alt kizak tasiyicilari kontrolu\n- Sabit plaka ile hareketli plaka paralellik kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2026_04_01",
        "title":  "[ENJEKSIYON 1500] 6 Aylik Kapsamli Bakim ve Esanjor Temizligi",
        "type":  "MAKINABAKIM",
        "date":  "2026-04-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[6 AYLIK VE 3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi\n- Yag sogutma esanjor temizligi\n- Makina terazi kontrolu\n- Hareketli plaka alt kizak tasiyicilari kontrolu\n- Sabit plaka ile hareketli plaka paralellik kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2026_04_01",
        "title":  "[ENJEKSIYON 1050] 6 Aylik Kapsamli Bakim ve Esanjor Temizligi",
        "type":  "MAKINABAKIM",
        "date":  "2026-04-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[6 AYLIK VE 3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi\n- Yag sogutma esanjor temizligi\n- Makina terazi kontrolu\n- Hareketli plaka alt kizak tasiyicilari kontrolu\n- Sabit plaka ile hareketli plaka paralellik kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2026_04_01",
        "title":  "[ENJEKSIYON 130] 6 Aylik Kapsamli Bakim ve Esanjor Temizligi",
        "type":  "MAKINABAKIM",
        "date":  "2026-04-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[6 AYLIK VE 3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi\n- Yag sogutma esanjor temizligi\n- Makina terazi kontrolu\n- Hareketli plaka alt kizak tasiyicilari kontrolu\n- Sabit plaka ile hareketli plaka paralellik kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2026_05_01",
        "title":  "[ENJEKSIYON 1400] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-05-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2026_05_01",
        "title":  "[ENJEKSIYON 1500] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-05-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2026_05_01",
        "title":  "[ENJEKSIYON 1050] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-05-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2026_05_01",
        "title":  "[ENJEKSIYON 130] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-05-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2026_06_01",
        "title":  "[ENJEKSIYON 1400] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-06-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2026_06_01",
        "title":  "[ENJEKSIYON 1500] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-06-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2026_06_01",
        "title":  "[ENJEKSIYON 1050] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-06-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2026_06_01",
        "title":  "[ENJEKSIYON 130] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-06-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2026_07_01",
        "title":  "[ENJEKSIYON 1400] 3 Aylik Bakim ve Filtre Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2026-07-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2026_07_01",
        "title":  "[ENJEKSIYON 1500] 3 Aylik Bakim ve Filtre Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2026-07-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2026_07_01",
        "title":  "[ENJEKSIYON 1050] 3 Aylik Bakim ve Filtre Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2026-07-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2026_07_01",
        "title":  "[ENJEKSIYON 130] 3 Aylik Bakim ve Filtre Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2026-07-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2026_08_01",
        "title":  "[ENJEKSIYON 1400] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-08-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2026_08_01",
        "title":  "[ENJEKSIYON 1500] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-08-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2026_08_01",
        "title":  "[ENJEKSIYON 1050] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-08-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2026_08_01",
        "title":  "[ENJEKSIYON 130] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-08-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2026_09_01",
        "title":  "[ENJEKSIYON 1400] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-09-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2026_09_01",
        "title":  "[ENJEKSIYON 1500] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-09-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2026_09_01",
        "title":  "[ENJEKSIYON 1050] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-09-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2026_09_01",
        "title":  "[ENJEKSIYON 130] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-09-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2026_10_01",
        "title":  "[ENJEKSIYON 1400] Yillik Agir Bakim ve Paralellik Kontrolu",
        "type":  "MAKINABAKIM",
        "date":  "2026-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[YILLIK VE 6 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi\n- Yag sogutma esanjor temizligi\n- Makina terazi kontrolu\n- Hareketli plaka alt kizak tasiyicilari kontrolu\n- Sabit plaka ile hareketli plaka paralellik kontrolu\n- Emis filtresi degisimi\n- Yuksek basincli hortumlarin kontrolu ve gerekirse degisimi\n- Motor kontrolu ve gerekirse bakimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2026_10_01",
        "title":  "[ENJEKSIYON 1500] Yillik Agir Bakim ve Paralellik Kontrolu",
        "type":  "MAKINABAKIM",
        "date":  "2026-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[YILLIK VE 6 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi\n- Yag sogutma esanjor temizligi\n- Makina terazi kontrolu\n- Hareketli plaka alt kizak tasiyicilari kontrolu\n- Sabit plaka ile hareketli plaka paralellik kontrolu\n- Emis filtresi degisimi\n- Yuksek basincli hortumlarin kontrolu ve gerekirse degisimi\n- Motor kontrolu ve gerekirse bakimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2026_10_01",
        "title":  "[ENJEKSIYON 1050] Yillik Agir Bakim ve Paralellik Kontrolu",
        "type":  "MAKINABAKIM",
        "date":  "2026-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[YILLIK VE 6 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi\n- Yag sogutma esanjor temizligi\n- Makina terazi kontrolu\n- Hareketli plaka alt kizak tasiyicilari kontrolu\n- Sabit plaka ile hareketli plaka paralellik kontrolu\n- Emis filtresi degisimi\n- Yuksek basincli hortumlarin kontrolu ve gerekirse degisimi\n- Motor kontrolu ve gerekirse bakimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2026_10_01",
        "title":  "[ENJEKSIYON 130] Yillik Agir Bakim ve Paralellik Kontrolu",
        "type":  "MAKINABAKIM",
        "date":  "2026-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[YILLIK VE 6 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi\n- Yag sogutma esanjor temizligi\n- Makina terazi kontrolu\n- Hareketli plaka alt kizak tasiyicilari kontrolu\n- Sabit plaka ile hareketli plaka paralellik kontrolu\n- Emis filtresi degisimi\n- Yuksek basincli hortumlarin kontrolu ve gerekirse degisimi\n- Motor kontrolu ve gerekirse bakimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2026_11_01",
        "title":  "[ENJEKSIYON 1400] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-11-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2026_11_01",
        "title":  "[ENJEKSIYON 1500] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-11-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2026_11_01",
        "title":  "[ENJEKSIYON 1050] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-11-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2026_11_01",
        "title":  "[ENJEKSIYON 130] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-11-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2026_12_01",
        "title":  "[ENJEKSIYON 1400] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-12-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2026_12_01",
        "title":  "[ENJEKSIYON 1500] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-12-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2026_12_01",
        "title":  "[ENJEKSIYON 1050] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-12-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2026_12_01",
        "title":  "[ENJEKSIYON 130] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2026-12-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2027_01_01",
        "title":  "[ENJEKSIYON 1400] 3 Aylik Bakim ve Filtre Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2027-01-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2027_01_01",
        "title":  "[ENJEKSIYON 1500] 3 Aylik Bakim ve Filtre Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2027-01-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2027_01_01",
        "title":  "[ENJEKSIYON 1050] 3 Aylik Bakim ve Filtre Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2027-01-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2027_01_01",
        "title":  "[ENJEKSIYON 130] 3 Aylik Bakim ve Filtre Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2027-01-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2027_02_01",
        "title":  "[ENJEKSIYON 1400] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-02-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2027_02_01",
        "title":  "[ENJEKSIYON 1500] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-02-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2027_02_01",
        "title":  "[ENJEKSIYON 1050] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-02-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2027_02_01",
        "title":  "[ENJEKSIYON 130] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-02-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2027_03_01",
        "title":  "[ENJEKSIYON 1400] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-03-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2027_03_01",
        "title":  "[ENJEKSIYON 1500] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-03-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2027_03_01",
        "title":  "[ENJEKSIYON 1050] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-03-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2027_03_01",
        "title":  "[ENJEKSIYON 130] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-03-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2027_04_01",
        "title":  "[ENJEKSIYON 1400] 6 Aylik Kapsamli Bakim ve Esanjor Temizligi",
        "type":  "MAKINABAKIM",
        "date":  "2027-04-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[6 AYLIK VE 3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi\n- Yag sogutma esanjor temizligi\n- Makina terazi kontrolu\n- Hareketli plaka alt kizak tasiyicilari kontrolu\n- Sabit plaka ile hareketli plaka paralellik kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2027_04_01",
        "title":  "[ENJEKSIYON 1500] 6 Aylik Kapsamli Bakim ve Esanjor Temizligi",
        "type":  "MAKINABAKIM",
        "date":  "2027-04-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[6 AYLIK VE 3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi\n- Yag sogutma esanjor temizligi\n- Makina terazi kontrolu\n- Hareketli plaka alt kizak tasiyicilari kontrolu\n- Sabit plaka ile hareketli plaka paralellik kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2027_04_01",
        "title":  "[ENJEKSIYON 1050] 6 Aylik Kapsamli Bakim ve Esanjor Temizligi",
        "type":  "MAKINABAKIM",
        "date":  "2027-04-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[6 AYLIK VE 3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi\n- Yag sogutma esanjor temizligi\n- Makina terazi kontrolu\n- Hareketli plaka alt kizak tasiyicilari kontrolu\n- Sabit plaka ile hareketli plaka paralellik kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2027_04_01",
        "title":  "[ENJEKSIYON 130] 6 Aylik Kapsamli Bakim ve Esanjor Temizligi",
        "type":  "MAKINABAKIM",
        "date":  "2027-04-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[6 AYLIK VE 3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi\n- Yag sogutma esanjor temizligi\n- Makina terazi kontrolu\n- Hareketli plaka alt kizak tasiyicilari kontrolu\n- Sabit plaka ile hareketli plaka paralellik kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2027_05_01",
        "title":  "[ENJEKSIYON 1400] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-05-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2027_05_01",
        "title":  "[ENJEKSIYON 1500] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-05-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2027_05_01",
        "title":  "[ENJEKSIYON 1050] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-05-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2027_05_01",
        "title":  "[ENJEKSIYON 130] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-05-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2027_06_01",
        "title":  "[ENJEKSIYON 1400] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-06-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2027_06_01",
        "title":  "[ENJEKSIYON 1500] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-06-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2027_06_01",
        "title":  "[ENJEKSIYON 1050] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-06-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2027_06_01",
        "title":  "[ENJEKSIYON 130] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-06-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2027_07_01",
        "title":  "[ENJEKSIYON 1400] 3 Aylik Bakim ve Filtre Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2027-07-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2027_07_01",
        "title":  "[ENJEKSIYON 1500] 3 Aylik Bakim ve Filtre Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2027-07-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2027_07_01",
        "title":  "[ENJEKSIYON 1050] 3 Aylik Bakim ve Filtre Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2027-07-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2027_07_01",
        "title":  "[ENJEKSIYON 130] 3 Aylik Bakim ve Filtre Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2027-07-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[3 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2027_08_01",
        "title":  "[ENJEKSIYON 1400] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-08-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2027_08_01",
        "title":  "[ENJEKSIYON 1500] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-08-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2027_08_01",
        "title":  "[ENJEKSIYON 1050] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-08-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2027_08_01",
        "title":  "[ENJEKSIYON 130] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-08-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2027_09_01",
        "title":  "[ENJEKSIYON 1400] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-09-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2027_09_01",
        "title":  "[ENJEKSIYON 1500] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-09-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2027_09_01",
        "title":  "[ENJEKSIYON 1050] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-09-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2027_09_01",
        "title":  "[ENJEKSIYON 130] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-09-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2027_10_01",
        "title":  "[ENJEKSIYON 1400] Yillik Agir Bakim ve Paralellik Kontrolu",
        "type":  "MAKINABAKIM",
        "date":  "2027-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[YILLIK VE 6 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi\n- Yag sogutma esanjor temizligi\n- Makina terazi kontrolu\n- Hareketli plaka alt kizak tasiyicilari kontrolu\n- Sabit plaka ile hareketli plaka paralellik kontrolu\n- Emis filtresi degisimi\n- Yuksek basincli hortumlarin kontrolu ve gerekirse degisimi\n- Motor kontrolu ve gerekirse bakimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2027_10_01",
        "title":  "[ENJEKSIYON 1500] Yillik Agir Bakim ve Paralellik Kontrolu",
        "type":  "MAKINABAKIM",
        "date":  "2027-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[YILLIK VE 6 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi\n- Yag sogutma esanjor temizligi\n- Makina terazi kontrolu\n- Hareketli plaka alt kizak tasiyicilari kontrolu\n- Sabit plaka ile hareketli plaka paralellik kontrolu\n- Emis filtresi degisimi\n- Yuksek basincli hortumlarin kontrolu ve gerekirse degisimi\n- Motor kontrolu ve gerekirse bakimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2027_10_01",
        "title":  "[ENJEKSIYON 1050] Yillik Agir Bakim ve Paralellik Kontrolu",
        "type":  "MAKINABAKIM",
        "date":  "2027-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[YILLIK VE 6 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi\n- Yag sogutma esanjor temizligi\n- Makina terazi kontrolu\n- Hareketli plaka alt kizak tasiyicilari kontrolu\n- Sabit plaka ile hareketli plaka paralellik kontrolu\n- Emis filtresi degisimi\n- Yuksek basincli hortumlarin kontrolu ve gerekirse degisimi\n- Motor kontrolu ve gerekirse bakimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2027_10_01",
        "title":  "[ENJEKSIYON 130] Yillik Agir Bakim ve Paralellik Kontrolu",
        "type":  "MAKINABAKIM",
        "date":  "2027-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu\n\n[YILLIK VE 6 AYLIK EK BAKIMLAR]\n- Yag tanki pompa emis filtre degisimi\n- By-pass filtre degisimi\n- Yag sogutma esanjor temizligi\n- Makina terazi kontrolu\n- Hareketli plaka alt kizak tasiyicilari kontrolu\n- Sabit plaka ile hareketli plaka paralellik kontrolu\n- Emis filtresi degisimi\n- Yuksek basincli hortumlarin kontrolu ve gerekirse degisimi\n- Motor kontrolu ve gerekirse bakimi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2027_11_01",
        "title":  "[ENJEKSIYON 1400] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-11-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2027_11_01",
        "title":  "[ENJEKSIYON 1500] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-11-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2027_11_01",
        "title":  "[ENJEKSIYON 1050] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-11-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2027_11_01",
        "title":  "[ENJEKSIYON 130] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-11-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2027_12_01",
        "title":  "[ENJEKSIYON 1400] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-12-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2027_12_01",
        "title":  "[ENJEKSIYON 1500] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-12-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2027_12_01",
        "title":  "[ENJEKSIYON 1050] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-12-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2027_12_01",
        "title":  "[ENJEKSIYON 130] Aylik Periyodik Bakim",
        "type":  "MAKINABAKIM",
        "date":  "2027-12-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[AYLIK BAKIM]\n- Hidrolik yag tank seviye kontrolu\n- Enjeksiyon unitesini elle yaglama\n- Mengene unitesini yaglama\n- Kalip ayar unitesini yaglama\n- Sebeke 3 faz kontrolu\n- Meme merkez kontrolu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-1400_2027_10_01_2y",
        "title":  "[ENJEKSIYON 1400] 2 Yillik Hidrolik Yag Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2027-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[2 YILLIK BUYUK BAKIM]\n- Komple Hidrolik Yag Degisimi\n- Tank ici temizlik ve dip tortu tahliyesi\n- Emis suzgeci temizligi ve yeni yag dolumu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1400_2028_10_01_3y",
        "title":  "[ENJEKSIYON 1400] 3 Yillik PLC / Kart Pil Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2028-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi (Otomasyon)",
        "status":  "Planlandi",
        "notes":  "[3 YILLIK BAKIM]\n- PLC bellek yedekleme pili degisimi\n- CNC / Kontrol paneli hafiza pili kontrol ve degisimi\n- Parametre yedeklerinin harici ortama aktarilmasi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1400_2030_10_01_5y",
        "title":  "[ENJEKSIYON 1400] 5 Yillik Kece, O-Ring ve Yuksek Basinc Hortum Revizyonu",
        "type":  "MAKINABAKIM",
        "date":  "2030-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi (Hidrolik)",
        "status":  "Planlandi",
        "notes":  "[5 YILLIK AGIR REVIZYON]\n- Hidrolik pistonlarin komple kece ve o-ring degisimi\n- Yuksek basincli hidrolik hortumlarin degisimi (tum hatlar)\n- Mengene ve enjeksiyon silindir sizdirmazlik testleri",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_fxhbk1bqn",
        "machineName":  "ENJEKSIYON 1400"
    },
    {
        "id":  "ev_maint_enj-1500_2027_10_01_2y",
        "title":  "[ENJEKSIYON 1500] 2 Yillik Hidrolik Yag Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2027-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[2 YILLIK BUYUK BAKIM]\n- Komple Hidrolik Yag Degisimi\n- Tank ici temizlik ve dip tortu tahliyesi\n- Emis suzgeci temizligi ve yeni yag dolumu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1500_2028_10_01_3y",
        "title":  "[ENJEKSIYON 1500] 3 Yillik PLC / Kart Pil Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2028-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi (Otomasyon)",
        "status":  "Planlandi",
        "notes":  "[3 YILLIK BAKIM]\n- PLC bellek yedekleme pili degisimi\n- CNC / Kontrol paneli hafiza pili kontrol ve degisimi\n- Parametre yedeklerinin harici ortama aktarilmasi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1500_2030_10_01_5y",
        "title":  "[ENJEKSIYON 1500] 5 Yillik Kece, O-Ring ve Yuksek Basinc Hortum Revizyonu",
        "type":  "MAKINABAKIM",
        "date":  "2030-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi (Hidrolik)",
        "status":  "Planlandi",
        "notes":  "[5 YILLIK AGIR REVIZYON]\n- Hidrolik pistonlarin komple kece ve o-ring degisimi\n- Yuksek basincli hidrolik hortumlarin degisimi (tum hatlar)\n- Mengene ve enjeksiyon silindir sizdirmazlik testleri",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_gakua6pxy",
        "machineName":  "ENJEKSIYON 1500"
    },
    {
        "id":  "ev_maint_enj-1050_2027_10_01_2y",
        "title":  "[ENJEKSIYON 1050] 2 Yillik Hidrolik Yag Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2027-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[2 YILLIK BUYUK BAKIM]\n- Komple Hidrolik Yag Degisimi\n- Tank ici temizlik ve dip tortu tahliyesi\n- Emis suzgeci temizligi ve yeni yag dolumu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-1050_2028_10_01_3y",
        "title":  "[ENJEKSIYON 1050] 3 Yillik PLC / Kart Pil Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2028-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi (Otomasyon)",
        "status":  "Planlandi",
        "notes":  "[3 YILLIK BAKIM]\n- PLC bellek yedekleme pili degisimi\n- CNC / Kontrol paneli hafiza pili kontrol ve degisimi\n- Parametre yedeklerinin harici ortama aktarilmasi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-1050_2030_10_01_5y",
        "title":  "[ENJEKSIYON 1050] 5 Yillik Kece, O-Ring ve Yuksek Basinc Hortum Revizyonu",
        "type":  "MAKINABAKIM",
        "date":  "2030-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi (Hidrolik)",
        "status":  "Planlandi",
        "notes":  "[5 YILLIK AGIR REVIZYON]\n- Hidrolik pistonlarin komple kece ve o-ring degisimi\n- Yuksek basincli hidrolik hortumlarin degisimi (tum hatlar)\n- Mengene ve enjeksiyon silindir sizdirmazlik testleri",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ur9hr2fee",
        "machineName":  "ENJEKSIYON 1050"
    },
    {
        "id":  "ev_maint_enj-130_2027_10_01_2y",
        "title":  "[ENJEKSIYON 130] 2 Yillik Hidrolik Yag Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2027-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi",
        "status":  "Planlandi",
        "notes":  "[2 YILLIK BUYUK BAKIM]\n- Komple Hidrolik Yag Degisimi\n- Tank ici temizlik ve dip tortu tahliyesi\n- Emis suzgeci temizligi ve yeni yag dolumu",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-130_2028_10_01_3y",
        "title":  "[ENJEKSIYON 130] 3 Yillik PLC / Kart Pil Degisimi",
        "type":  "MAKINABAKIM",
        "date":  "2028-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi (Otomasyon)",
        "status":  "Planlandi",
        "notes":  "[3 YILLIK BAKIM]\n- PLC bellek yedekleme pili degisimi\n- CNC / Kontrol paneli hafiza pili kontrol ve degisimi\n- Parametre yedeklerinin harici ortama aktarilmasi",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    },
    {
        "id":  "ev_maint_enj-130_2030_10_01_5y",
        "title":  "[ENJEKSIYON 130] 5 Yillik Kece, O-Ring ve Yuksek Basinc Hortum Revizyonu",
        "type":  "MAKINABAKIM",
        "date":  "2030-10-01",
        "responsible":  "Bakim \u0026 Onarim Ekibi (Hidrolik)",
        "status":  "Planlandi",
        "notes":  "[5 YILLIK AGIR REVIZYON]\n- Hidrolik pistonlarin komple kece ve o-ring degisimi\n- Yuksek basincli hidrolik hortumlarin degisimi (tum hatlar)\n- Mengene ve enjeksiyon silindir sizdirmazlik testleri",
        "createdBy":  "Sistem Yoneticisi",
        "machineId":  "mac_ealni0wrm",
        "machineName":  "ENJEKSIYON 130"
    }
];

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
    excludeFromProduction: true,
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
    excludeFromProduction: true,
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
    excludeFromProduction: true,
    addedAt: "2026-10-22"
  },
  {
    id: "mac_tailift_forklift",
    name: "TAILIFT FORKLİFT",
    code: "FRK-01",
    departmentId: "dep_1792617758042",
    location: "1500 VAKUM",
    notes: "",
    status: "Aktif",
    excludeFromProduction: true,
    addedAt: "2026-10-30"
  },
  {
    id: "mac_huaya_forklift",
    name: "HUAYA FORKLİFT",
    code: "FRK-02",
    departmentId: "dep_1792617758042",
    location: "1400 Depo",
    notes: "",
    status: "Aktif",
    excludeFromProduction: true,
    addedAt: "2026-10-30"
  }
];

// Haftalık Üretim Programı & Kalıp Baskı Planları (Kesinlikle Sahte Veri Yoktur, Kullanıcı Kendisi Ekler)
export const DEFAULT_PRODUCTION_PLANS = [];

// Forklift Parkuru (Fabrikaya Kayıtlı Gerçek Forkliftler)
export const DEFAULT_FORKLIFTS = [
  {
    id: "fk_1793299917469",
    code: "HUAYA",
    brand: "HUAYA",
    capacity: "1.5 Ton",
    fuelType: "Elektrikli",
    operatorName: "",
    status: "Aktif",
    notes: "",
    createdAt: "2026-10-29T18:51:57.469Z"
  },
  {
    id: "fk_1793299936531",
    code: "TAILIFT",
    brand: "TAILIFT",
    capacity: "3.0 Ton",
    fuelType: "Dizel",
    operatorName: "",
    status: "Aktif",
    notes: "",
    createdAt: "2026-10-29T18:52:16.531Z"
  }
];

// Varsayılan Telegram Bot Yapılandırması
export const DEFAULT_TELEGRAM_CONFIG = {
  botToken: "",
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
    id: "ext_1793300054267",
    companyName: "ULUDAĞ KOMPRESÖR",
    contactPerson: "FATİH",
    specialty: "KOMPRESÖR",
    phone: "0536 824 7604",
    notes: ""
  },
  {
    id: "ext_1793300110958",
    companyName: "HAITIAN",
    contactPerson: "ERCAN",
    specialty: "ENJEKSİYON",
    phone: "0534 838 80 04",
    notes: ""
  },
  {
    id: "ext_1793300170971",
    companyName: "AYAZ FORKLİFT",
    contactPerson: "HAMDİ AYAZ",
    specialty: "FORKLİFT",
    phone: "0532 503 03 83",
    notes: ""
  },
  {
    id: "ext_1793300219466",
    companyName: "ROSS OTOMASYON",
    contactPerson: "HİKMET",
    specialty: "ELEKTRİK OTOMASYON",
    phone: "0532 450 29 15",
    notes: ""
  },
  {
    id: "ext_1793300398477",
    companyName: "DC ENERJİ",
    contactPerson: "CİHAN",
    specialty: "TESİSAT ELEKTRİĞİ & AYDINLATMA",
    phone: "0532 399 68 91",
    notes: ""
  },
  {
    id: "ext_1793301415929",
    companyName: "UÇAK ASANSÖR",
    contactPerson: "MUHAMMED",
    specialty: "1500 ASANSÖR ARIZA",
    phone: "0542 786 48 45",
    notes: ""
  },
  {
    id: "ext_1793301533528",
    companyName: "ASANSÖRCÜ FATİH",
    contactPerson: "FATİH",
    specialty: "1400 YÜK ASANSÖRÜ ARIZA BAKIM",
    phone: "0531 474 37 26",
    notes: ""
  }
];

// Yemek Şirketi & Aylık Menü Yapılandırması (Kayra Yemek Entegrasyonu)
export const DEFAULT_CATERING_CONFIG = {
  companyName: "Kayra Yemek",
  websiteUrl: "https://musteri.kayrayemek.com.tr:4638/AylikMenu",
  username: "Sodsan",
  password: "2025",
  menuUrl: "",
  menuImage: "",
  menuMonth: "Ekim 2026",
  updatedAt: "2026-10-24T10:30:00.000Z",
  updatedBy: "Kayra Yemek Entegrasyonu",
  menuDays: [
    { date: "2026-10-01", dayName: "Perşembe", soup: "ŞEF ÇORBA", mainDish: "AFYON KÖFTE (4 ADET)", sideDish: "KETÇAPLI İNCE UZUN MAKARNA", extra: "AYRAN", items: ["ŞEF ÇORBA", "AFYON KÖFTE (4 ADET)", "KETÇAPLI İNCE UZUN MAKARNA", "AYRAN"] },
    { date: "2026-10-02", dayName: "Cuma", soup: "TAVUKSUYU ÇORBA", mainDish: "YOĞURTLU SEBZE TAVA", sideDish: "SU BÖREĞİ (H)", extra: "REVANİ", items: ["TAVUKSUYU ÇORBA", "YOĞURTLU SEBZE TAVA", "SU BÖREĞİ (H)", "REVANİ"] },
    { date: "2026-10-03", dayName: "Cumartesi", soup: "MERCİMEK ÇORBA", mainDish: "PİLİÇ ORMAN", sideDish: "ERİŞTE", extra: "ARMUT", items: ["MERCİMEK ÇORBA", "PİLİÇ ORMAN", "ERİŞTE", "ARMUT"] },
    { date: "2026-10-04", dayName: "Pazar", soup: "ROMEN ÇORBA", mainDish: "YEŞİL MERCİMEK", sideDish: "PİRİNÇ PİLAVI", extra: "KALBURABASTI", items: ["ROMEN ÇORBA", "YEŞİL MERCİMEK", "PİRİNÇ PİLAVI", "KALBURABASTI"] },
    { date: "2026-10-05", dayName: "Pazartesi", soup: "TUTMAÇ ÇORBA", mainDish: "KARIŞIK IZGARA SUCUKLU (TAŞIMA)/GAR.PATATES", sideDish: "PİRİNÇ PİLAVI", extra: "SICAK İRMİK HELVASI", items: ["TUTMAÇ ÇORBA", "KARIŞIK IZGARA SUCUKLU (TAŞIMA)/GAR.PATATES", "PİRİNÇ PİLAVI", "SICAK İRMİK HELVASI"] },
    { date: "2026-10-06", dayName: "Salı", soup: "YAYLA ÇORBA", mainDish: "FIRIN TÜRLÜ", sideDish: "PEYNİRLİ KALEM BÖREK(H)(2 ADET)", extra: "KOMPOSTO", items: ["YAYLA ÇORBA", "FIRIN TÜRLÜ", "PEYNİRLİ KALEM BÖREK(H)(2 ADET)", "KOMPOSTO"] },
    { date: "2026-10-07", dayName: "Çarşamba", soup: "EZOGELİN ÇORBA", mainDish: "PİLİÇ FAJİTA", sideDish: "FESLEĞEN SOSLU İNCE UZUN MAKARNA (S)", extra: "AYRAN", items: ["EZOGELİN ÇORBA", "PİLİÇ FAJİTA", "FESLEĞEN SOSLU İNCE UZUN MAKARNA (S)", "AYRAN"] },
    { date: "2026-10-08", dayName: "Perşembe", soup: "KURU FASULYE", mainDish: "MELEK PİLAVI", sideDish: "TİRAMİSU", extra: "CACIK", items: ["KURU FASULYE", "MELEK PİLAVI", "TİRAMİSU", "CACIK"] },
    { date: "2026-10-09", dayName: "Cuma", soup: "MERCİMEK ÇORBA", mainDish: "(H) KAĞIT KEBABI", sideDish: "BULGUR PİLAVI", extra: "SADE GAZOZ", items: ["MERCİMEK ÇORBA", "(H) KAĞIT KEBABI", "BULGUR PİLAVI", "SADE GAZOZ"] },
    { date: "2026-10-10", dayName: "Cumartesi", soup: "ARAPAŞI ÇORBA", mainDish: "KIŞ KIZARTMA/GAR.YOĞURT", sideDish: "FIRIN MAKARNA", extra: "MEYVELİ SULTAN", items: ["ARAPAŞI ÇORBA", "KIŞ KIZARTMA/GAR.YOĞURT", "FIRIN MAKARNA", "MEYVELİ SULTAN"] },
    { date: "2026-10-11", dayName: "Pazar", soup: "ŞEF ÇORBA", mainDish: "PİLİÇ SOTE", sideDish: "KETÇAPLI YÜZÜK MAKARNA", extra: "BARDAK YOĞURT", items: ["ŞEF ÇORBA", "PİLİÇ SOTE", "KETÇAPLI YÜZÜK MAKARNA", "BARDAK YOĞURT"] },
    { date: "2026-10-12", dayName: "Pazartesi", soup: "NOHUT", mainDish: "MELEK PİLAVI", sideDish: "SICAK SÜT HELVASI", extra: "CACIK", items: ["NOHUT", "MELEK PİLAVI", "SICAK SÜT HELVASI", "CACIK"] },
    { date: "2026-10-13", dayName: "Salı", soup: "ŞEHRİYE ÇORBA (R)", mainDish: "KADINBUDU KÖFTE/GAR.BAH.ELMA DİL.PATATES", sideDish: "SOSLU BURGU MAKARNA", extra: "AYRAN", items: ["ŞEHRİYE ÇORBA (R)", "KADINBUDU KÖFTE/GAR.BAH.ELMA DİL.PATATES", "SOSLU BURGU MAKARNA", "AYRAN"] },
    { date: "2026-10-14", dayName: "Çarşamba", soup: "TANDIR ÇORBA", mainDish: "TAZE FASULYE", sideDish: "ŞEHRİYELİ PİLAV", extra: "KARAGÖZ TATLISI", items: ["TANDIR ÇORBA", "TAZE FASULYE", "ŞEHRİYELİ PİLAV", "KARAGÖZ TATLISI"] },
    { date: "2026-10-15", dayName: "Perşembe", soup: "DOMATES ÇORBA", mainDish: "PİLİÇ ŞİNİTZEL/GAR.BAH ELMA DİL.PATATES", sideDish: "BULGUR PİLAVI", extra: "AYRAN", items: ["DOMATES ÇORBA", "PİLİÇ ŞİNİTZEL/GAR.BAH ELMA DİL.PATATES", "BULGUR PİLAVI", "AYRAN"] },
    { date: "2026-10-16", dayName: "Cuma", soup: "DÜĞÜN ÇORBA", mainDish: "GRATEN PATATES", sideDish: "ŞEHRİYELİ PİLAV", extra: "SÜTLÜ TAHİNLİ ÖZEL", items: ["DÜĞÜN ÇORBA", "GRATEN PATATES", "ŞEHRİYELİ PİLAV", "SÜTLÜ TAHİNLİ ÖZEL"] },
    { date: "2026-10-17", dayName: "Cumartesi", soup: "MERCİMEK ÇORBA", mainDish: "SAHAN KÖFTE (4 ADET)", sideDish: "KETÇAPLI YÜZÜK MAKARNA", extra: "BARDAK YOĞURT", items: ["MERCİMEK ÇORBA", "SAHAN KÖFTE (4 ADET)", "KETÇAPLI YÜZÜK MAKARNA", "BARDAK YOĞURT"] },
    { date: "2026-10-18", dayName: "Pazar", soup: "TAVUKSUYU ÇORBA", mainDish: "Z.YAĞLI SICAK BİBER DOLMA/GAR.YOĞURT", sideDish: "SU BÖREĞİ (H)", extra: "SÜTLÜ PRENSES", items: ["TAVUKSUYU ÇORBA", "Z.YAĞLI SICAK BİBER DOLMA/GAR.YOĞURT", "SU BÖREĞİ (H)", "SÜTLÜ PRENSES"] },
    { date: "2026-10-19", dayName: "Pazartesi", soup: "ANTEP ÇORBA", mainDish: "KÖRİ BAHARATLI PİLİÇ", sideDish: "BULGUR PİLAVI", extra: "AYRAN", items: ["ANTEP ÇORBA", "KÖRİ BAHARATLI PİLİÇ", "BULGUR PİLAVI", "AYRAN"] },
    { date: "2026-10-20", dayName: "Salı", soup: "YAYLA ÇORBA", mainDish: "SEBZE GRATEN", sideDish: "ERİŞTE", extra: "KEMALPAŞA (3 ADET)", items: ["YAYLA ÇORBA", "SEBZE GRATEN", "ERİŞTE", "KEMALPAŞA (3 ADET)"] },
    { date: "2026-10-21", dayName: "Çarşamba", soup: "DOMATES ÇORBA", mainDish: "HAMBURGER", sideDish: "ARPA ŞEHRİYE SALATASI", extra: "SADE GAZOZ", items: ["DOMATES ÇORBA", "HAMBURGER", "ARPA ŞEHRİYE SALATASI", "SADE GAZOZ"] },
    { date: "2026-10-22", dayName: "Perşembe", soup: "KURU FASULYE", mainDish: "MELEK PİLAVI", sideDish: "KARIŞIK TURŞU", extra: "SUPANGLE", items: ["KURU FASULYE", "MELEK PİLAVI", "KARIŞIK TURŞU", "SUPANGLE"] },
    { date: "2026-10-23", dayName: "Cuma", soup: "ŞEF ÇORBA", mainDish: "EKŞİLİ KÖFTE", sideDish: "SOSLU BURGU MAKARNA", extra: "ELMA", items: ["ŞEF ÇORBA", "EKŞİLİ KÖFTE", "SOSLU BURGU MAKARNA", "ELMA"] },
    { date: "2026-10-24", dayName: "Cumartesi", soup: "TANDIR ÇORBA", mainDish: "TAZE FASULYE", sideDish: "FIRIN MAKARNA", extra: "TEL KADAYIF (H)", items: ["TANDIR ÇORBA", "TAZE FASULYE", "FIRIN MAKARNA", "TEL KADAYIF (H)"] },
    { date: "2026-10-25", dayName: "Pazar", soup: "NANELİ YOĞURT ÇORBA", mainDish: "ROSTO KÖFTE (2 ADET)", sideDish: "KETÇAPLI İNCE UZUN MAKARNA", extra: "MEYVE SUYU", items: ["NANELİ YOĞURT ÇORBA", "ROSTO KÖFTE (2 ADET)", "KETÇAPLI İNCE UZUN MAKARNA", "MEYVE SUYU"] },
    { date: "2026-10-26", dayName: "Pazartesi", soup: "TUTMAÇ ÇORBA", mainDish: "KARNIYARIK", sideDish: "PİRİNÇ PİLAVI", extra: "AYRAN", items: ["TUTMAÇ ÇORBA", "KARNIYARIK", "PİRİNÇ PİLAVI", "AYRAN"] },
    { date: "2026-10-27", dayName: "Salı", soup: "ŞEHRİYE ÇORBA (R)", mainDish: "PİLİÇ TÜRKMEN", sideDish: "BULGUR PİLAVI", extra: "KAYRA ŞÖBİYET (2 ADET)", items: ["ŞEHRİYE ÇORBA (R)", "PİLİÇ TÜRKMEN", "BULGUR PİLAVI", "KAYRA ŞÖBİYET (2 ADET)"] },
    { date: "2026-10-28", dayName: "Çarşamba", soup: "NOHUT", mainDish: "MELEK PİLAVI", sideDish: "KARIŞIK TURŞU", extra: "ÇİKOLATALI BROWNİ", items: ["NOHUT", "MELEK PİLAVI", "KARIŞIK TURŞU", "ÇİKOLATALI BROWNİ"] },
    { date: "2026-10-29", dayName: "Perşembe", soup: "DOMATES ÇORBA", mainDish: "SOSLU GÖYNÜK KÖFTE", sideDish: "KETÇAPLI BURGU MAKARNA", extra: "AYRAN", items: ["DOMATES ÇORBA", "SOSLU GÖYNÜK KÖFTE", "KETÇAPLI BURGU MAKARNA", "AYRAN"] },
    { date: "2026-10-30", dayName: "Cuma", soup: "TANDIR ÇORBA", mainDish: "SOSLU SEBZE TAVA", sideDish: "ŞEHRİYELİ PİLAV", extra: "ŞEKERPARE", items: ["TANDIR ÇORBA", "SOSLU SEBZE TAVA", "ŞEHRİYELİ PİLAV", "ŞEKERPARE"] },
    { date: "2026-10-31", dayName: "Cumartesi", soup: "YAYLA ÇORBA", mainDish: "ÇARDAK KÖFTE", sideDish: "NAPOLİTEN SOSLU İNCE UZUN MAKARNA", extra: "MEYVE", items: ["YAYLA ÇORBA", "ÇARDAK KÖFTE", "NAPOLİTEN SOSLU İNCE UZUN MAKARNA", "MEYVE"] }
  ]
};

// Personel Servis Güzergahları & Araç/Şoför Listesi (Sahte veri yoktur)
export const DEFAULT_SHUTTLE_ROUTES = [
  {
    id: "shuttle_1793335790484",
    routeName: "YILDIRIM-KAYAPA",
    plateNumber: "16 SPL 40",
    driverUserId: "u_ahmet",
    driverName: "Ayhan",
    driverPhone: "0541 448 60 33",
    capacity: 16,
    stops: "Yıldırım - Ankara Yolu - İzmir Yolu - Kayapa OSB",
    notes: "16 SPL 40 Vardiya Servisi",
    arventoUrl: "https://web.arvento.com/ui/shareVehiclesLink/ShareVehiclesLink.aspx?g=486597b7c5594071IB6zmbsR5u2EXLKmYgtgEg==ac0cb80e24b00adf&ed=20261229082724&sd=20261030082725&lc=tr&ln=0",
    arventoVehicleId: "C11L00008461 - 16SPL90",
    passengerEmployeeIds: [
      "u_1792699659049",
      "u_ik",
      "u_1792699612413"
    ],
    createdAt: "2026-10-30T04:49:50.484Z",
    updatedAt: "2026-10-31T04:58:41.738Z"
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

// Başlangıç Kurumsal Form ve KVKK Metinleri
export const DEFAULT_CORPORATE_DOCUMENTS = [
  {
    id: "doc_kvkk",
    title: "KVKK Çalışan Aydınlatma ve Açık Rıza Metni",
    category: "KVKK",
    version: "1.0",
    mandatory: true,
    active: true,
    updatedAt: "2026-10-24T00:00:00.000Z",
    updatedBy: "SODSAN Yönetim",
    summary: "6698 sayılı Kişisel Verilerin Korunması Kanunu uyarınca çalışan verilerinin işlenmesi, saklanması ve haklarınıza ilişkin aydınlatma metnidir.",
    content: `SODSAN PLASTİK VE METAL ÜRÜNLERİ SAN. TİC. LTD. ŞTİ.
ÇALIŞAN AYDINLATMA VE AÇIK RIZA METNİ

1. Veri Sorumlusu
6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, kişisel verileriniz veri sorumlusu sıfatıyla SODSAN PLASTİK VE METAL ÜRÜNLERİ SAN. TİC. LTD. ŞTİ. ("Şirket") tarafından aşağıda açıklanan kapsamda işlenmektedir.

2. Kişisel Verilerin İşlenme Amaçları
Kişisel verileriniz (kimlik, iletişim, özlük, mesleki deneyim, sağlık ve güvenlik bilgileri, kamera kayıtları ve fabrika içi operasyon verileri);
- İş sözleşmesinin ifası ve iş kanunu yükümlülüklerinin yerine getirilmesi,
- Çalışan haklarının, bordrolama, SGK ve vergi işlemlerinin yürütülmesi,
- İş sağlığı ve güvenliği faaliyetlerinin mevzuata uygun icrası,
- Fabrika tesis, makine parkuru, çalışan ve ürün güvenliğinin sağlanması,
- Vardiya, servis, lojistik ve operasyonel planlamaların yürütülmesi amaçlarıyla işlenmektedir.

3. Kişisel Verilerin Aktarılması
Kişisel verileriniz, kanuni yükümlülüklerin yerine getirilmesi amacıyla SGK, İŞKUR, yetkili adli/idari merciler, iş sağlığı ve güvenliği ortak sağlık birimleri (OSGB) ve şirketin anlaşmalı olduğu denetim/muhasebe kuruluşlarına aktarılabilecektir.

4. İlgili Kişinin Hakları
KVKK’nın 11. maddesi uyarınca Şirketimize başvurarak verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini ve silinmesini talep etme hakkınız saklıdır.

BEYAN VE ONAY:
Yukarıda yer alan Aydınlatma Metnini okuduğumu, anladığımı ve kişisel verilerimin belirtilen amaçlar doğrultusunda işlenmesine ve aktarılmasına özgür irademle AÇIK RIZA gösterdiğimi kabul, beyan ve taahhüt ederim.`
  },
  {
    id: "doc_isg",
    title: "İş Sağlığı ve Güvenliği (İSG) Genel Talimat ve Taahhütnamesi",
    category: "İSG",
    version: "1.0",
    mandatory: true,
    active: true,
    updatedAt: "2026-10-24T00:00:00.000Z",
    updatedBy: "SODSAN Yönetim",
    summary: "6331 sayılı İSG Kanunu uyarınca fabrika sahasında uyulması gereken temel emniyet ve KKD kuralları taahhütnamesidir.",
    content: `SODSAN FABRİKASI İŞ SAĞLIĞI VE GÜVENLİĞİ (İSG)
GENEL ÇALIŞMA TALİMATI VE TAAHHÜTNAMESİ

1. Kişisel Koruyucu Donanım (KKD) Kullanımı
- Fabrika üretim sahasında çelik burunlu iş ayakkabısı, reflektörlü iş yeleği veya iş elbisesi giyilmesi zorunludur.
- Plastik enjeksiyon, kalıp bağlama, çapak alma ve makine bakım süreçlerinde koruyucu gözlük ve uygun eldiven takılacaktır.

2. Makine ve Kalıp Güvenliği
- Enjeksiyon makinelerinin kapı emniyet switchleri, hidrolik ve mekanik kilitleri asla baypas edilmeyecektir.
- Kalıp değişimi, bakımı ve nozul temizliği sırasında makine enerjisi kesilecek, LOTO (Kilitleme-Etiketleme) kurallarına uyulacaktır.
- Kalıbın altına veya makine mengene arasına hiçbir surette bedenle girilmeyecektir.

3. Fabrika İçi Yaya ve Araç Trafiği
- Forklift ve servis araçlarının çalışma sahasında belirlenen yaya yolları kullanılacak, forklift çalışma alanlarına 5 metreden fazla yaklaşılmayacaktır.

4. Bildirim Yükümlülüğü
- Sahada tespit edilen tüm ramak kala olaylar, makine arızaları ve güvensiz durumlar ivedilikle vardiya amirine veya İSG uzmanına bildirilecektir.

TAAHHÜT:
Yukarıdaki İSG kurallarına eksiksiz uyacağımı, uymamam halinde doğacak yasal ve idari sorumlulukları kabul ettiğimi beyan ve taahhüt ederim.`
  },
  {
    id: "doc_yonetmelik",
    title: "Fabrika Çalışma Esasları ve İç Disiplin Yönetmeliği",
    category: "İç Yönetmelik",
    version: "1.0",
    mandatory: true,
    active: true,
    updatedAt: "2026-10-24T00:00:00.000Z",
    updatedBy: "SODSAN Yönetim",
    summary: "Fabrika içi mesai, mola, temizlik, gizlilik ve davranış kurallarını belirleyen iç yönetmeliktir.",
    content: `SODSAN PLASTİK VE METAL ÜRÜNLERİ SAN. TİC. LTD. ŞTİ.
FABRİKA ÇALIŞMA ESASLARI VE İÇ DİSİPLİN YÖNETMELİĞİ

1. Mesai ve Vardiya Düzeni
- Çalışanlar belirlenen vardiya saatlerine (08:00-16:00, 16:00-24:00, 24:00-08:00) tam vaktinde riayet etmekle yükümlüdür.
- İşe geliş ve çıkışlarda kart okuma / personel imza sistemleri eksiksiz kullanılacaktır.

2. Mola ve Dinlenme Saatleri
- Çay ve yemek molaları belirlenen saatlerde kullanılacak, molalar üretim bandını aksatmayacak şekilde amir koordinesinde tamamlanacaktır.

3. Fabrika Tertip ve Düzeni (5S)
- Her operatör ve personel çalıştığı makinenin, kalıp alanının ve tezgahının temizliğinden bizzat sorumludur.
- Hammadde çuvalları, masterbatch boyalar ve basılan mamul kasaları belirlenen sarı çizgi alanlarında düzenli depolanacaktır.

4. Gizlilik ve Sadakat Yükümlülüğü
- Şirkete ait üretim teknikleri, kalıp tasarımları, müşteri listeleri, mali bilgiler ve şirket içi yazılımlar ticari sır kapsamındadır. Şirket dışına hiçbir surette çıkartılamaz ve 3. şahıslarla paylaşılamaz.

BEYAN:
İç Disiplin Yönetmeliğini okuduğumu, hükümlerine harfiyen riayet edeceğimi beyan ederim.`
  }
];

// Bozuk karakterleri (mojibake / çift UTF-8 kodlama) otomatik tespit edip düzelten temizleyici
export function fixMojibake(val) {
  if (typeof val === "string") {
    if (!/[\u00C2-\u00C5]/.test(val)) return val;
    try {
      return decodeURIComponent(escape(val));
    } catch (e) {
      return val
        .replace(/Ã–/g, "Ö")
        .replace(/Ä°/g, "İ")
        .replace(/ÄŸ/g, "ğ")
        .replace(/Ã§/g, "ç")
        .replace(/ÅŸ/g, "ş")
        .replace(/Ã¼/g, "ü")
        .replace(/Ä±/g, "ı")
        .replace(/Ã¶/g, "ö")
        .replace(/Äž/g, "Ğ")
        .replace(/Ã‡/g, "Ç")
        .replace(/Åž/g, "Ş")
        .replace(/Ãœ/g, "Ü")
        .replace(/Ã¢/g, "â")
        .replace(/Ã®/g, "î");
    }
  } else if (Array.isArray(val)) {
    return val.map(item => fixMojibake(item));
  } else if (val && typeof val === "object") {
    const res = {};
    for (const k in val) {
      if (Object.prototype.hasOwnProperty.call(val, k)) {
        res[k] = fixMojibake(val[k]);
      }
    }
    return res;
  }
  return val;
}

// LocalStorage Veri Yükleyici & Saklayıcı
export class StateManager {
  constructor() {
    this.state = this.loadState();
    this.syncUsersToEmployees();
    if (typeof window !== "undefined") {
      window.__sodsanAppState = this;
    }
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
      } else {
        parsed = fixMojibake(parsed);
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
      // Kullanıcı isteği gereği departman adını İdari İşler olarak sabitle
      parsed.departments.forEach(d => {
        if (d.id === "dep_ik" && (!d.name || d.name.includes("İnsan Kaynakları"))) {
          d.name = "İdari İşler";
        }
      });

      // Roller: Sadece ADMIN rolünde canAccessAdmin true olabilir, diğer tüm rollerde kural gereği kesinlikle false olmalıdır!
      if (!Array.isArray(parsed.roles) || parsed.roles.length === 0) {
        parsed.roles = JSON.parse(JSON.stringify(DEFAULT_ROLES));
      } else {
        // Eksik standart roller varsa (örneğin IZLEYICI) ekle
        DEFAULT_ROLES.forEach(defRole => {
          if (!parsed.roles.some(r => r.key === defRole.key)) {
            parsed.roles.push(JSON.parse(JSON.stringify(defRole)));
          }
        });
        parsed.roles.forEach(r => {
          if (!r.permissions) r.permissions = {};
          r.permissions.canAccessAdmin = (r.key === "ADMIN");
          if (typeof r.permissions.canViewAllLeaveBalances !== "boolean") {
            r.permissions.canViewAllLeaveBalances = (r.key === "ADMIN" || r.key === "IZLEYICI" || r.key === "IK");
          }
          // Kullanıcı isteği doğrultusunda kalıcı rol unvanı eşitlemesi
          if (r.key === "USTA" && (!r.title || r.title === "Usta / Formen")) {
            r.title = "Vardiya Amiri";
          }
          if (r.key === "IK" && (!r.title || r.title === "İnsan Kaynakları" || r.title === "İdari Kısım")) {
            r.title = "İdari İşler";
          }
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

      // Personel (employees): Kesinlikle silinmez! Admin personel listesine dahil EDİLMEZ!
      if (!Array.isArray(parsed.employees) || parsed.employees.length === 0) {
        parsed.employees = JSON.parse(JSON.stringify(DEFAULT_EMPLOYEES));
      } else {
        DEFAULT_EMPLOYEES.forEach(defEmp => {
          if (!parsed.employees.some(e => e.id === defEmp.id || e.name === defEmp.name)) {
            parsed.employees.push(defEmp);
          }
        });
      }
      // Admin kullanıcısını çalışan listesinden tamamen temizle (İzin ve mesai personelleri arasında yer alamaz)
      parsed.employees = parsed.employees.filter(e => 
        e.id !== "u_admin" && 
        e.userId !== "u_admin" && 
        String(e.role || "").trim().toUpperCase() !== "ADMIN" && 
        String(e.name || "").trim().toLowerCase() !== "admin" && 
        String(e.name || "").trim().toLowerCase() !== "sistem yöneticisi"
      );

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

        // Yardımcı ekipmanlar için varsayılan excludeFromProduction kontrolü
        parsed.machines.forEach(m => {
          if (m && typeof m === "object" && m.excludeFromProduction === undefined) {
            const nameLower = (m.name || "").toLowerCase();
            if (nameLower.includes("kompresör") || nameLower.includes("kurutucu") || nameLower.includes("forklift")) {
              m.excludeFromProduction = true;
            } else {
              m.excludeFromProduction = false;
            }
          }
        });
      }

      // Ürün Hareketleri
      if (!Array.isArray(parsed.products) || parsed.products.length === 0) {
        parsed.products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
      } else {
        DEFAULT_PRODUCTS.forEach(defProd => {
          if (!parsed.products.some(p => p.id === defProd.id)) {
            parsed.products.push(defProd);
          }
        });
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
      // Makina Arızaları (DEFAULT_BREAKDOWNS kayıtlarını koru ve birleştir)
      if (!Array.isArray(parsed.breakdowns) || parsed.breakdowns.length === 0) {
        parsed.breakdowns = JSON.parse(JSON.stringify(DEFAULT_BREAKDOWNS));
      } else {
        DEFAULT_BREAKDOWNS.forEach(defBrk => {
          if (!parsed.breakdowns.some(b => b.id === defBrk.id)) {
            parsed.breakdowns.push(defBrk);
          }
        });
      }
            if (!Array.isArray(parsed.calendarEvents)) parsed.calendarEvents = [];
      parsed.calendarEvents = mergeById(DEFAULT_CALENDAR_EVENTS, parsed.calendarEvents);
      if (!Array.isArray(parsed.activityLogs)) parsed.activityLogs = [];

      // Firmalar
      if (!Array.isArray(parsed.companies) || parsed.companies.length === 0) {
        parsed.companies = [...DEFAULT_COMPANIES];
      }

      // Arıza Türleri
      if (!Array.isArray(parsed.faultTypes) || parsed.faultTypes.length === 0) {
        parsed.faultTypes = JSON.parse(JSON.stringify(DEFAULT_FAULT_TYPES));
      } else {
        DEFAULT_FAULT_TYPES.forEach(defFt => {
          if (!parsed.faultTypes.some(ft => (typeof ft === "object" ? ft.id === defFt.id || ft.name.toLowerCase() === defFt.name.toLowerCase() : ft === defFt.name))) {
            parsed.faultTypes.push(defFt);
          }
        });
      }

      // Dış Servisler (DEFAULT_EXTERNAL_SERVICES ile eksiksiz birleştir)
      if (!Array.isArray(parsed.externalServices) || parsed.externalServices.length === 0) {
        parsed.externalServices = JSON.parse(JSON.stringify(DEFAULT_EXTERNAL_SERVICES));
      } else {
        DEFAULT_EXTERNAL_SERVICES.forEach(defExt => {
          if (!parsed.externalServices.some(s => s.id === defExt.id || (s.companyName && defExt.companyName && s.companyName.trim().toLowerCase() === defExt.companyName.trim().toLowerCase()))) {
            parsed.externalServices.push(defExt);
          }
        });
      }

      // Telegram Yapılandırması
      if (!parsed.telegramConfig) {
        parsed.telegramConfig = JSON.parse(JSON.stringify(DEFAULT_TELEGRAM_CONFIG));
      } else {
        parsed.telegramConfig = {
          botToken: parsed.telegramConfig.botToken || "",
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

      // Forklift Parkuru (DEFAULT_FORKLIFTS ile birleştir)
      if (!Array.isArray(parsed.forklifts) || parsed.forklifts.length === 0) {
        parsed.forklifts = JSON.parse(JSON.stringify(DEFAULT_FORKLIFTS));
      } else {
        DEFAULT_FORKLIFTS.forEach(defFk => {
          if (!parsed.forklifts.some(f => f.id === defFk.id || (f.code && defFk.code && f.code.trim().toUpperCase() === defFk.code.trim().toUpperCase()))) {
            parsed.forklifts.push(defFk);
          }
        });
      }

      // Yemek Şirketi & Menü Yapılandırması (Kayra Yemek Entegrasyonu)
      if (!parsed.cateringConfig || typeof parsed.cateringConfig !== "object") {
        parsed.cateringConfig = JSON.parse(JSON.stringify(DEFAULT_CATERING_CONFIG));
      } else {
        const hasDays = Array.isArray(parsed.cateringConfig.menuDays) && parsed.cateringConfig.menuDays.length > 0;
        parsed.cateringConfig = {
          companyName: parsed.cateringConfig.companyName && parsed.cateringConfig.companyName !== "Yemek Şirketi"
            ? parsed.cateringConfig.companyName 
            : DEFAULT_CATERING_CONFIG.companyName,
          websiteUrl: parsed.cateringConfig.websiteUrl || DEFAULT_CATERING_CONFIG.websiteUrl,
          username: parsed.cateringConfig.username || DEFAULT_CATERING_CONFIG.username,
          password: parsed.cateringConfig.password || DEFAULT_CATERING_CONFIG.password,
          menuUrl: parsed.cateringConfig.menuUrl || DEFAULT_CATERING_CONFIG.menuUrl,
          menuImage: parsed.cateringConfig.menuImage || "",
          menuMonth: parsed.cateringConfig.menuMonth || DEFAULT_CATERING_CONFIG.menuMonth,
          menuDays: hasDays ? parsed.cateringConfig.menuDays : JSON.parse(JSON.stringify(DEFAULT_CATERING_CONFIG.menuDays)),
          updatedAt: parsed.cateringConfig.updatedAt || DEFAULT_CATERING_CONFIG.updatedAt,
          updatedBy: parsed.cateringConfig.updatedBy || DEFAULT_CATERING_CONFIG.updatedBy
        };
      }

      // Personel Servis Güzergahları (16 SPL 40 ve DEFAULT_SHUTTLE_ROUTES eksiksiz birleştir ve koru)
      if (!Array.isArray(parsed.shuttleRoutes) || parsed.shuttleRoutes.length === 0) {
        parsed.shuttleRoutes = JSON.parse(JSON.stringify(DEFAULT_SHUTTLE_ROUTES));
      } else {
        DEFAULT_SHUTTLE_ROUTES.forEach(defRoute => {
          const existing = parsed.shuttleRoutes.find(r => 
            r.id === defRoute.id || 
            (r.plateNumber && defRoute.plateNumber && r.plateNumber.trim().toUpperCase() === defRoute.plateNumber.trim().toUpperCase())
          );
          if (!existing) {
            parsed.shuttleRoutes.unshift(JSON.parse(JSON.stringify(defRoute)));
          } else {
            // Eğer arventoUrl boşsa veya eksikse kullanıcının Arvento linkini tamamla
            if (!existing.arventoUrl && defRoute.arventoUrl) {
              existing.arventoUrl = defRoute.arventoUrl;
            }
            if (!existing.arventoVehicleId && defRoute.arventoVehicleId) {
              existing.arventoVehicleId = defRoute.arventoVehicleId;
            }
            if (!existing.driverPhone && defRoute.driverPhone) {
              existing.driverPhone = defRoute.driverPhone;
            }
            if (!existing.stops && defRoute.stops) {
              existing.stops = defRoute.stops;
            }
          }
        });
      }

      // Kurumsal Belgeler & Formlar (KVKK, İSG, İç Yönetmelik)
      if (!Array.isArray(parsed.corporateDocuments) || parsed.corporateDocuments.length === 0) {
        parsed.corporateDocuments = JSON.parse(JSON.stringify(DEFAULT_CORPORATE_DOCUMENTS));
      } else {
        // Eksik temel belgeleri tamamla
        DEFAULT_CORPORATE_DOCUMENTS.forEach(defDoc => {
          if (!parsed.corporateDocuments.some(d => d.id === defDoc.id)) {
            parsed.corporateDocuments.push(defDoc);
          }
        });
      }

      // Personel İmzalı Evraklar Arşivi
      if (!Array.isArray(parsed.signedDocuments)) {
        parsed.signedDocuments = [];
      } else {
        // Kullanıcı Talebi: Yanlışlıkla Mustafa Kara adına atılan imzaların kalıcı olarak silinmesi ve iptali
        parsed.signedDocuments = parsed.signedDocuments.filter(s => {
          const isMustafa = s.userId === "u_1792690211697" || 
            (s.userName && s.userName.toLowerCase().trim().includes("mustafa kara"));
          return !isMustafa;
        });
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
        calendarEvents: JSON.parse(JSON.stringify(DEFAULT_CALENDAR_EVENTS)),
        companies: [...DEFAULT_COMPANIES],
        faultTypes: JSON.parse(JSON.stringify(DEFAULT_FAULT_TYPES)),
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

  saveState(skipCloudNotify = false) {
    try {
      this.state._lastSyncTime = new Date().toISOString();
      const dataStr = JSON.stringify(this.state);
      localStorage.setItem(STORAGE_KEY, dataStr);
      // Ayrıca yedek anahtarına da kaydet (veri kaybını %100 önlemek için)
      localStorage.setItem("sodsan_auto_backup_latest", dataStr);
      if (typeof window !== "undefined") {
        if (typeof window.__broadcastPortalChange === "function") {
          window.__broadcastPortalChange();
        }
        if (!skipCloudNotify && window.__cloudSyncService && typeof window.__cloudSyncService.notifyLocalChange === "function") {
          window.__cloudSyncService.notifyLocalChange();
        }
      }
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
    let excludeFromProduction = false;

    if (typeof data === "string") {
      name = data.trim();
    } else if (data && typeof data === "object") {
      name = (data.name || "").trim();
      code = (data.code || "").trim();
      departmentId = data.departmentId || "";
      location = (data.location || "").trim();
      notes = (data.notes || "").trim();
      excludeFromProduction = Boolean(data.excludeFromProduction);
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
        if (data && typeof data === "object" && data.excludeFromProduction !== undefined) {
          existing.excludeFromProduction = Boolean(data.excludeFromProduction);
        }
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
      excludeFromProduction: excludeFromProduction,
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
      excludeFromProduction: data.excludeFromProduction !== undefined ? Boolean(data.excludeFromProduction) : Boolean(old.excludeFromProduction),
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

  updateExternalService(id, updatedData) {
    if (!Array.isArray(this.state.externalServices)) return null;
    const idx = this.state.externalServices.findIndex(s => s.id === id);
    if (idx === -1) return null;
    this.state.externalServices[idx] = {
      ...this.state.externalServices[idx],
      ...updatedData
    };
    this.saveState();
    return this.state.externalServices[idx];
  }

  deleteExternalService(id) {
    if (!Array.isArray(this.state.externalServices)) return;
    this.state.externalServices = this.state.externalServices.filter(s => s.id !== id);
    this.saveState();
  }

  // Makine Arıza Türleri Yönetimi
  registerFaultType(data) {
    let name = "";
    let icon = "⚠️";
    if (typeof data === "string") {
      name = data.trim();
    } else if (typeof data === "object" && data !== null) {
      name = (data.name || "").trim();
      icon = (data.icon || "⚠️").trim();
    }

    if (!name) return null;

    if (!Array.isArray(this.state.faultTypes)) {
      this.state.faultTypes = JSON.parse(JSON.stringify(DEFAULT_FAULT_TYPES));
    }

    const existing = this.state.faultTypes.find(ft => {
      const ftName = typeof ft === "string" ? ft : ft.name;
      return ftName.toLowerCase() === name.toLowerCase();
    });

    if (existing) {
      return typeof existing === "object" ? existing : { id: "ft_" + Date.now(), name: existing, icon };
    }

    const newFt = {
      id: "ft_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      name: name,
      icon: icon || "⚠️",
      isCustom: true,
      createdAt: new Date().toISOString()
    };

    this.state.faultTypes.push(newFt);
    this.saveState();
    return newFt;
  }

  deleteFaultType(id) {
    if (!Array.isArray(this.state.faultTypes)) return false;
    const initialLen = this.state.faultTypes.length;
    this.state.faultTypes = this.state.faultTypes.filter(ft => {
      if (typeof ft === "string") return ft !== id;
      return ft.id !== id && ft.name !== id;
    });
    if (this.state.faultTypes.length !== initialLen) {
      this.saveState();
      return true;
    }
    return false;
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

  // Tüm kullanıcıları (Ustalar, İdari, Bakım, Saha) otomatik çalışan listesine senkronize eder (Admin hariç!)
  syncUsersToEmployees() {
    if (!this.state) return;
    if (!Array.isArray(this.state.employees)) {
      this.state.employees = [];
    }

    // Admin kullanıcısını çalışan listesinden kesin olarak ayıkla
    this.state.employees = this.state.employees.filter(e => 
      e.id !== "u_admin" && 
      e.userId !== "u_admin" && 
      String(e.role || "").trim().toUpperCase() !== "ADMIN" && 
      String(e.name || "").trim().toLowerCase() !== "admin" && 
      String(e.name || "").trim().toLowerCase() !== "sistem yöneticisi"
    );

    const users = (this.state.users || []).filter(u => 
      String(u.role || "").trim().toUpperCase() !== "ADMIN" && 
      String(u.username || "").trim().toLowerCase() !== "admin" && 
      u.id !== "u_admin"
    );
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

  reloadFromStorage() {
    const freshState = this.loadState();
    // Maintain current user session if already set
    if (this.state && this.state.currentUser && freshState) {
      freshState.currentUser = this.state.currentUser;
    }
    this.state = freshState;
    return this.state;
  }

  resetToDefaults() {
    localStorage.removeItem(STORAGE_KEY);
    this.state = this.loadState();
    this.saveState();
  }

  exportDataJson() {
    return JSON.stringify(this.state);
  }

  importDataJson(jsonString, skipCloudNotify = false) {
    try {
      let parsed = JSON.parse(jsonString);
      if (parsed && typeof parsed === "object") {
        parsed = fixMojibake(parsed);
      }
      if (parsed && (parsed.departments || parsed.users || parsed.machines)) {
        const local = this.state || {};

        // 1. Dış Servisler (externalServices): Birleştir ve hiçbir firmayı silme
        const mergedExtServices = [...(Array.isArray(parsed.externalServices) ? parsed.externalServices : [])];
        const localExtServices = Array.isArray(local.externalServices) ? local.externalServices : [];
        const allExtSources = [...DEFAULT_EXTERNAL_SERVICES, ...localExtServices];
        allExtSources.forEach(src => {
          if (!mergedExtServices.some(s => s.id === src.id || (s.companyName && src.companyName && s.companyName.trim().toLowerCase() === src.companyName.trim().toLowerCase()))) {
            mergedExtServices.push(src);
          }
        });

        // 2. Makina Arızaları (breakdowns): Birleştir ve giderilen durumları koru
        const breakdownMap = new Map();
        DEFAULT_BREAKDOWNS.forEach(b => breakdownMap.set(b.id, { ...b }));
        if (Array.isArray(local.breakdowns)) {
          local.breakdowns.forEach(b => {
            if (b && b.id) breakdownMap.set(b.id, { ...(breakdownMap.get(b.id) || {}), ...b });
          });
        }
        if (Array.isArray(parsed.breakdowns)) {
          parsed.breakdowns.forEach(b => {
            if (b && b.id) {
              const existing = breakdownMap.get(b.id);
              if (existing) {
                const isResolved = existing.status === "Giderildi" || b.status === "Giderildi";
                breakdownMap.set(b.id, {
                  ...existing,
                  ...b,
                  status: isResolved ? "Giderildi" : (b.status || existing.status),
                  technicianNotes: b.technicianNotes || existing.technicianNotes || "",
                  resolvedTime: b.resolvedTime || existing.resolvedTime || null
                });
              } else {
                breakdownMap.set(b.id, { ...b });
              }
            }
          });
        }

        // 3. Personel Servis Güzergahları (shuttleRoutes): Birleştir
        const shuttleMap = new Map();
        DEFAULT_SHUTTLE_ROUTES.forEach(s => shuttleMap.set(s.plateNumber?.trim().toUpperCase() || s.id, { ...s }));
        if (Array.isArray(local.shuttleRoutes)) {
          local.shuttleRoutes.forEach(s => {
            const key = s.plateNumber?.trim().toUpperCase() || s.id;
            const existing = shuttleMap.get(key) || {};
            shuttleMap.set(key, { 
              ...existing, 
              ...s,
              arventoUrl: s.arventoUrl || existing.arventoUrl || "",
              arventoVehicleId: s.arventoVehicleId || existing.arventoVehicleId || "",
              stops: s.stops || existing.stops || "",
              driverPhone: s.driverPhone || existing.driverPhone || ""
            });
          });
        }
        if (Array.isArray(parsed.shuttleRoutes)) {
          parsed.shuttleRoutes.forEach(s => {
            const key = s.plateNumber?.trim().toUpperCase() || s.id;
            const existing = shuttleMap.get(key);
            if (existing) {
              const passengers = Array.from(new Set([...(existing.passengerEmployeeIds || []), ...(s.passengerEmployeeIds || [])]));
              shuttleMap.set(key, { 
                ...existing, 
                ...s, 
                arventoUrl: s.arventoUrl || existing.arventoUrl || "",
                arventoVehicleId: s.arventoVehicleId || existing.arventoVehicleId || "",
                stops: s.stops || existing.stops || "",
                driverPhone: s.driverPhone || existing.driverPhone || "",
                passengerEmployeeIds: passengers 
              });
            } else {
              shuttleMap.set(key, { ...s });
            }
          });
        }

        // 4. Makineler (machines): Birleştir
        const machineMap = new Map();
        const FAKE_MACHINE_IDS = new Set(["mac_inj_800", "mac_inj_650", "mac_inj_450", "mac_inj_250", "mac_vak_01", "mac_vak_02", "mac_dos_01"]);
        DEFAULT_MACHINES.forEach(m => machineMap.set(m.id, { ...m }));
        if (Array.isArray(local.machines)) {
          local.machines.forEach(m => {
            if (m && m.id && !FAKE_MACHINE_IDS.has(m.id)) {
              machineMap.set(m.id, { ...(machineMap.get(m.id) || {}), ...m });
            }
          });
        }
        if (Array.isArray(parsed.machines)) {
          parsed.machines.forEach(m => {
            if (m && m.id && !FAKE_MACHINE_IDS.has(m.id)) {
              machineMap.set(m.id, { ...(machineMap.get(m.id) || {}), ...m });
            }
          });
        }

        // 5. Arıza Türleri (faultTypes): Birleştir
        const faultMap = new Map();
        DEFAULT_FAULT_TYPES.forEach(f => faultMap.set(typeof f === "object" ? f.name.toLowerCase() : f.toLowerCase(), typeof f === "object" ? f : { id: "ft_" + Math.random(), name: f }));
        if (Array.isArray(local.faultTypes)) {
          local.faultTypes.forEach(f => {
            const name = typeof f === "object" ? f.name : f;
            if (name) faultMap.set(name.toLowerCase(), typeof f === "object" ? f : { id: "ft_" + Math.random(), name: f });
          });
        }
        if (Array.isArray(parsed.faultTypes)) {
          parsed.faultTypes.forEach(f => {
            const name = typeof f === "object" ? f.name : f;
            if (name) faultMap.set(name.toLowerCase(), typeof f === "object" ? f : { id: "ft_" + Math.random(), name: f });
          });
        }

        // 6. Kullanıcılar (users): Birleştir
        const userMap = new Map();
        if (Array.isArray(local.users)) {
          local.users.forEach(u => { if (u && u.id) userMap.set(u.id, u); });
        }
        if (Array.isArray(parsed.users)) {
          parsed.users.forEach(u => { if (u && u.id) userMap.set(u.id, { ...(userMap.get(u.id) || {}), ...u }); });
        }

        // 7. Yardımcı fonksiyon: ID bazlı birleştirme
        const mergeById = (localArr, parsedArr) => {
          const map = new Map();
          if (Array.isArray(localArr)) localArr.forEach(item => { if (item && item.id) map.set(item.id, item); });
          if (Array.isArray(parsedArr)) parsedArr.forEach(item => { if (item && item.id) map.set(item.id, { ...(map.get(item.id) || {}), ...item }); });
          return Array.from(map.values());
        };

        // 8. Roller (roles): Birleştir ve unvanları kalıcı koru
        const roleMap = new Map();
        DEFAULT_ROLES.forEach(r => roleMap.set(r.key, { ...r }));
        if (Array.isArray(local.roles)) {
          local.roles.forEach(r => { if (r && r.key) roleMap.set(r.key, { ...(roleMap.get(r.key) || {}), ...r }); });
        }
        if (Array.isArray(parsed.roles)) {
          parsed.roles.forEach(r => { if (r && r.key) roleMap.set(r.key, { ...(roleMap.get(r.key) || {}), ...r }); });
        }
        const mergedRoles = Array.from(roleMap.values()).map(r => {
          if (r.key === "USTA" && (!r.title || r.title === "Usta / Formen")) r.title = "Vardiya Amiri";
          if (r.key === "IK" && (!r.title || r.title === "İnsan Kaynakları" || r.title === "İdari Kısım")) r.title = "İdari İşler";
          return r;
        });

        // Departmanlar: dep_ik varsayılan olarak İdari İşler
        const rawDeps = Array.isArray(parsed.departments) && parsed.departments.length > 0 ? parsed.departments : (local.departments || DEFAULT_DEPARTMENTS);
        const mergedDepartments = rawDeps.map(d => {
          if (d.id === "dep_ik" && (!d.name || d.name.includes("İnsan Kaynakları"))) {
            return { ...d, name: "İdari İşler" };
          }
          return d;
        });

        // Bütünleşik State
        this.state = {
          ...parsed,
          roles: mergedRoles,
          departments: mergedDepartments,
          users: Array.from(userMap.values()),
          employees: mergeById(local.employees, parsed.employees),
          products: mergeById(local.products, parsed.products),
          forklifts: mergeById(local.forklifts, parsed.forklifts),
          forkliftRequests: mergeById(local.forkliftRequests, parsed.forkliftRequests),
          externalServices: mergedExtServices,
          breakdowns: Array.from(breakdownMap.values()),
          shuttleRoutes: Array.from(shuttleMap.values()),
          machines: Array.from(machineMap.values()),
          faultTypes: Array.from(faultMap.values()),
          productionPlans: mergeById(local.productionPlans, parsed.productionPlans),
          productionOrders: mergeById(local.productionOrders, parsed.productionOrders),
          shipments: mergeById(local.shipments, parsed.shipments),
          calendarEvents: mergeById(local.calendarEvents, parsed.calendarEvents),
          leaveRequests: mergeById(local.leaveRequests, parsed.leaveRequests),
          overtimeRequests: mergeById(local.overtimeRequests, parsed.overtimeRequests),
          supplies: mergeById(local.supplies, parsed.supplies),
          corporateDocuments: mergeById(local.corporateDocuments, parsed.corporateDocuments),
          signedDocuments: mergeById(local.signedDocuments, parsed.signedDocuments),
          activityLogs: mergeById(local.activityLogs, parsed.activityLogs).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)).slice(0, 10000)
        };

        if (local.currentUser) {
          this.state.currentUser = local.currentUser;
        }

        this.saveState(skipCloudNotify);
        return true;
      }
    } catch (e) {
      console.error("Geçersiz JSON dosyası veya içe aktarma hatası:", e);
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
      // Denetim ve işlem kayıtları kalıcıdır (asla silinmez)
      if (this.state.activityLogs.length > 10000) {
        this.state.activityLogs = this.state.activityLogs.slice(0, 10000);
      }
      this.saveState();
      return newLog;
    } catch (e) {
      console.error("Log kaydı oluşturulamadı:", e);
    }
  }

  // ==========================================
  // VARDİYA AMİRİ ÜRETİM & SONUÇ RAPORU METOTLARI
  // ==========================================
  saveShiftProductionReport(planId, reportData) {
    if (!Array.isArray(this.state.productionPlans)) return null;
    const plan = this.state.productionPlans.find(p => p.id === planId);
    if (!plan) return null;

    if (!Array.isArray(plan.shiftReports)) {
      plan.shiftReports = [];
    }

    const produced = Number(reportData.producedQuantity) || 0;
    const defect = Number(reportData.defectQuantity) || 0;

    const newReport = {
      id: "shift_rep_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      planId: plan.id,
      timestamp: new Date().toISOString(),
      dateStr: new Date().toLocaleDateString("tr-TR"),
      timeStr: new Date().toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' }),
      shift: reportData.shift || "08:00 - 16:00",
      supervisorName: reportData.supervisorName || (this.state.currentUser?.name || "Vardiya Amiri"),
      supervisorUserId: this.state.currentUser?.id || "",
      barrelTemp: reportData.barrelTemp || "",
      cycleTime: reportData.cycleTime || "",
      pressure: reportData.pressure || "",
      producedQuantity: produced,
      defectQuantity: defect,
      leftProduced: reportData.leftProduced != null ? Number(reportData.leftProduced) : null,
      rightProduced: reportData.rightProduced != null ? Number(reportData.rightProduced) : null,
      leftScrap: reportData.leftScrap != null ? Number(reportData.leftScrap) : null,
      rightScrap: reportData.rightScrap != null ? Number(reportData.rightScrap) : null,
      defectReasons: Array.isArray(reportData.defectReasons) ? reportData.defectReasons : (reportData.defectReasons ? [reportData.defectReasons] : []),
      rawMaterialLot: reportData.rawMaterialLot || "",
      notes: reportData.notes || "",
      action: reportData.action || "DEVAM_EDIYOR" // "DEVAM_EDIYOR" veya "BITTI"
    };

    plan.shiftReports.unshift(newReport);

    // Üretim ve fire toplamlarını güncelle
    plan.producedQuantity = (Number(plan.producedQuantity) || 0) + produced;
    plan.defectQuantity = (Number(plan.defectQuantity) || 0) + defect;
    if (reportData.leftProduced != null) plan.leftProduced = (Number(plan.leftProduced) || 0) + Number(reportData.leftProduced);
    if (reportData.rightProduced != null) plan.rightProduced = (Number(plan.rightProduced) || 0) + Number(reportData.rightProduced);
    if (reportData.leftScrap != null) plan.leftScrap = (Number(plan.leftScrap) || 0) + Number(reportData.leftScrap);
    if (reportData.rightScrap != null) plan.rightScrap = (Number(plan.rightScrap) || 0) + Number(reportData.rightScrap);
    if (reportData.barrelTemp) plan.lastBarrelTemp = reportData.barrelTemp;
    if (reportData.cycleTime) plan.lastCycleTime = reportData.cycleTime;
    if (reportData.pressure) plan.lastPressure = reportData.pressure;
    if (reportData.rawMaterialLot) plan.rawMaterialLot = reportData.rawMaterialLot;

    if (reportData.action === "BITTI") {
      plan.status = "Tamamlandı";
      plan.closedAt = new Date().toISOString();
      plan.closedBy = newReport.supervisorName;
      plan.closedNotes = reportData.notes || "";
    } else {
      if (plan.status === "Planlandı" || plan.status === "Kalıp Bağlanıyor") {
        plan.status = "Üretimde";
      }
    }

    this.saveState();
    this.logActivity(
      reportData.action === "BITTI" ? "ÜRETİM_KAPANDI" : "VARDİYA_RAPORU_EKLENDİ",
      `${plan.machineName} - ${plan.moldName}: Vardiya raporu kaydedildi (${reportData.action === 'BITTI' ? 'ÜRETİM KAPATILDI' : 'Üretim devam ediyor'}, +${produced} sağlam, ${defect} fire).`,
      { planId: plan.id, reportId: newReport.id, action: reportData.action }
    );

    return { plan, report: newReport };
  }

  // ==========================================
  // KURUMSAL FORMLAR & E-İMZA YÖNETİM METOTLARI
  // ==========================================
  saveCorporateDocument(docData) {
    if (!Array.isArray(this.state.corporateDocuments)) {
      this.state.corporateDocuments = [];
    }

    const isNew = !docData.id;
    const docId = docData.id || `doc_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const updaterName = this.state.currentUser?.name || "Yönetici";

    if (isNew) {
      const newDoc = {
        id: docId,
        title: docData.title || "Yeni Kurumsal Form",
        category: docData.category || "Genel",
        version: docData.version || "1.0",
        mandatory: docData.mandatory !== false,
        active: docData.active !== false,
        summary: docData.summary || "",
        content: docData.content || "",
        createdAt: nowIso,
        updatedAt: nowIso,
        updatedBy: updaterName
      };
      this.state.corporateDocuments.push(newDoc);
      this.saveState();
      this.logActivity("KURUMSAL_FORM_EKLENDİ", `Yeni kurumsal form eklendi: ${newDoc.title} (${newDoc.version})`);
      return newDoc;
    } else {
      const idx = this.state.corporateDocuments.findIndex(d => d.id === docId);
      if (idx !== -1) {
        const oldDoc = this.state.corporateDocuments[idx];
        const updated = {
          ...oldDoc,
          title: docData.title || oldDoc.title,
          category: docData.category || oldDoc.category,
          version: docData.version || oldDoc.version,
          mandatory: docData.mandatory !== undefined ? docData.mandatory : oldDoc.mandatory,
          active: docData.active !== undefined ? docData.active : oldDoc.active,
          summary: docData.summary !== undefined ? docData.summary : oldDoc.summary,
          content: docData.content !== undefined ? docData.content : oldDoc.content,
          updatedAt: nowIso,
          updatedBy: updaterName
        };
        this.state.corporateDocuments[idx] = updated;
        this.saveState();
        this.logActivity("KURUMSAL_FORM_GÜNCELLENDİ", `Kurumsal form güncellendi: ${updated.title} (Sürüm: ${updated.version})`);
        return updated;
      }
    }
    return null;
  }

  deleteCorporateDocument(docId) {
    if (!Array.isArray(this.state.corporateDocuments)) return false;
    const doc = this.state.corporateDocuments.find(d => d.id === docId);
    if (!doc) return false;
    this.state.corporateDocuments = this.state.corporateDocuments.filter(d => d.id !== docId);
    this.saveState();
    this.logActivity("KURUMSAL_FORM_SİLİNDİ", `Kurumsal form silindi: ${doc.title} (${doc.version})`);
    return true;
  }

  saveDocumentSignature(sigData) {
    if (!Array.isArray(this.state.signedDocuments)) {
      this.state.signedDocuments = [];
    }

    const user = this.state.currentUser || { id: sigData.userId, name: sigData.userName, role: "PERSONEL" };
    const newSignature = {
      id: "sig_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      userId: sigData.userId || user.id,
      userName: sigData.userName || user.name,
      userRole: sigData.userRole || user.role || "PERSONEL",
      documentId: sigData.documentId,
      documentTitle: sigData.documentTitle,
      documentVersion: sigData.documentVersion,
      signedAt: new Date().toISOString(),
      signatureImage: sigData.signatureImage || "", // Kompakt monokrom base64 (~1 KB)
      ipOrDevice: sigData.ipOrDevice || (typeof navigator !== "undefined" ? navigator.userAgent.substring(0, 60) : "Portal"),
      confirmed: true
    };

    // Aynı kullanıcı aynı sürümü daha önce imzalamışsa güncelle, yoksa ekle
    const existIdx = this.state.signedDocuments.findIndex(s => s.userId === newSignature.userId && s.documentId === newSignature.documentId && s.documentVersion === newSignature.documentVersion);
    if (existIdx !== -1) {
      this.state.signedDocuments[existIdx] = newSignature;
    } else {
      this.state.signedDocuments.push(newSignature);
    }

    this.saveState();
    this.logActivity("FORM_İMZALANDI", `${newSignature.userName} tarafından "${newSignature.documentTitle}" (${newSignature.documentVersion}) dijital olarak imzalandı.`);
    return newSignature;
  }

  deleteSignedDocument(sigId) {
    if (!Array.isArray(this.state.signedDocuments)) return false;
    const sig = this.state.signedDocuments.find(s => s.id === sigId);
    if (!sig) return false;
    this.state.signedDocuments = this.state.signedDocuments.filter(s => s.id !== sigId);
    this.saveState();
    this.logActivity("İMZALI_FORM_İPTAL", `${sig.userName} adına atılan "${sig.documentTitle}" (${sig.documentVersion}) form imzası iptal edildi ve silindi.`);
    return true;
  }

  deleteSignaturesForUser(identifier) {
    if (!Array.isArray(this.state.signedDocuments)) return 0;
    const before = this.state.signedDocuments.length;
    const idLower = (identifier || "").toLowerCase().trim();
    const removed = this.state.signedDocuments.filter(s => 
      s.userId === identifier || 
      (s.userName && s.userName.toLowerCase().trim() === idLower) ||
      (s.userName && s.userName.toLowerCase().trim().includes(idLower))
    );
    this.state.signedDocuments = this.state.signedDocuments.filter(s => 
      s.userId !== identifier && 
      (!s.userName || s.userName.toLowerCase().trim() !== idLower) &&
      (!s.userName || !s.userName.toLowerCase().trim().includes(idLower))
    );
    if (this.state.signedDocuments.length !== before) {
      this.saveState();
      this.logActivity("PERSONEL_İMZALARI_İPTAL", `${identifier} adlı personelin tüm form imzaları iptal edildi ve silindi (${removed.length} adet evrak).`);
    }
    return removed.length;
  }

  getPendingDocumentsForUser(user) {
    if (!user || !Array.isArray(this.state.corporateDocuments)) return [];
    // Yöneticiye (Admin) kesinlikle imza formlarını çıkarma
    if (user.role === "ADMIN" || user.id === "u_admin") return [];

    const activeDocs = this.state.corporateDocuments.filter(d => d.active !== false && d.mandatory === true);
    const signed = this.state.signedDocuments || [];

    return activeDocs.filter(doc => {
      const isSigned = signed.some(s => s.userId === user.id && s.documentId === doc.id && s.documentVersion === doc.version);
      return !isSigned;
    });
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

export function updateExternalService(id, updatedData) {
  return appState.updateExternalService(id, updatedData);
}

export function deleteExternalService(id) {
  return appState.deleteExternalService(id);
}

export function registerFaultType(data) {
  return appState.registerFaultType(data);
}

export function deleteFaultType(id) {
  return appState.deleteFaultType(id);
}
