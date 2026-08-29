export type Role = "admin" | "supervisor";

export type User = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  governorateId: string | null;
  active: boolean;
  canEnterWarehouse: boolean;
  companyIds: string[];
};

export type Governorate = { id: string; name: string };
export type Company = { id: string; name: string; active?: boolean };
export type Material = { id: string; name: string; unitPrice: number; companyId: string; company: string; active?: boolean };
export type Representative = { id: string; name: string; governorateId: string; governorate?: string; companyIds: string[]; active?: boolean };
export type ReferenceData = { user: User; governorates: Governorate[]; companies: Company[]; materials: Material[]; representatives: Representative[] };

export type Sale = {
  id: string; saleDate: string; quantity: number; unitPrice: number; totalAmount: number; note?: string;
  supervisorId: string; supervisor: string; representativeId: string; representative: string;
  governorateId: string; governorate: string; companyId: string; company: string;
  materialId: string; material: string; createdAt?: string;
};

export type WarehouseRecord = { id: string; governorateId: string; governorate: string; year: number; month: number; quantity: number; amount: number | null; createdByName: string; updatedAt: string };
export type TargetRecord = { id: string; governorateId: string; governorate: string; year: number; month: number; targetQuantity: number; targetAmount: number | null; createdByName: string; updatedAt: string };

export type DashboardData = {
  period: { year: number; month: number };
  summary: { warehouseQuantity: number; representativeQuantity: number; directQuantity: number; representativeAmount: number; targetQuantity: number; operations: number; achievement: number };
  governorates: Array<{ id: string; name: string; warehouseQuantity: number; representativeQuantity: number; directQuantity: number; representativeAmount: number; warehouseAmount: number | null; targetQuantity: number; targetAmount: number | null; achievement: number; representativeShare: number; operations: number }>;
  topMaterials: Array<{ id: string; name: string; company: string; quantity: number; amount: number }>;
  topRepresentatives: Array<{ id: string; name: string; governorate: string; quantity: number; amount: number }>;
  companies: Array<{ id: string; name: string; quantity: number; amount: number }>;
  trend: Array<{ date: string; quantity: number }>;
  recent: Array<{ id: string; saleDate: string; quantity: number; totalAmount: number; representative: string; material: string; governorate: string; supervisor: string }>;
};

const messages: Record<string, string> = {
  UNAUTHORIZED: "انتهت الجلسة. سجل الدخول من جديد.",
  INVALID_CREDENTIALS: "اسم المستخدم أو كلمة المرور غير صحيحة.",
  ALREADY_INITIALIZED: "النظام مهيأ مسبقاً. استخدم تسجيل الدخول.",
  BOOTSTRAP_LOCKED: "تهيئة الأدمن مقفلة من الخادم.",
  ADMIN_REQUIRED: "هذه العملية متاحة للأدمن فقط.",
  WAREHOUSE_PERMISSION_REQUIRED: "لا تملك صلاحية إدخال مبيعات المذخر.",
  INVALID_USER: "أكمل بيانات المشرف واختر شركة واحدة على الأقل.",
  USER_CREATE_FAILED: "تعذر إنشاء الحساب. قد يكون اسم المستخدم مستخدماً.",
  TARGETS_SAVE_FAILED: "تعذر حفظ الأهداف. تحقق من الأرقام وأعد المحاولة.",
  INVALID_SALE: "أكمل بيانات البيع بشكل صحيح.",
  SALE_CREATE_FAILED: "تعذر حفظ عملية البيع.",
  SALE_REFERENCE_NOT_ALLOWED: "المندوب أو الشركة خارج صلاحيات هذا الحساب.",
  DATABASE_UNAVAILABLE: "تعذر الاتصال بقاعدة البيانات حالياً.",
};

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(messages[code] || "تعذر تنفيذ العملية. حاول مرة أخرى.");
    this.code = code;
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/local/v2${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(String(payload.error || "UNKNOWN_ERROR"), response.status);
  return payload as T;
}

export const formatNumber = (value: number | string | null | undefined) => Number(value || 0).toLocaleString("ar-IQ");
export const formatMoney = (value: number | string | null | undefined) => `${formatNumber(value)} د.ع`;
export const currentPeriod = () => ({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
export const isoToday = () => new Date().toISOString().slice(0, 10);

