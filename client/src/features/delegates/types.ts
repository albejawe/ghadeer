export type SaleIssueCode =
  | "missing-representative"
  | "unknown-representative"
  | "missing-governorate"
  | "missing-company"
  | "company-mismatch"
  | "missing-product"
  | "unknown-product"
  | "missing-quantity"
  | "missing-saved-price"
  | "missing-total"
  | "total-mismatch"
  | "missing-date";

export type DataQualityIssue = {
  code: SaleIssueCode;
  label: string;
  severity: "warning" | "error";
};

export type SaleRecord = {
  id: string;
  representative: string;
  governorate: string;
  company: string;
  product: string;
  quantity: number | null;
  savedUnitPrice: number | null;
  totalAmount: number | null;
  date: string | null;
  monthlyTargetSnapshot: number | null;
  targetContribution: number | null;
  notes: string;
  sourceSheet: string;
  sourceRow: number;
  issues: DataQualityIssue[];
  isAnalytical: boolean;
};

export type Representative = {
  governorate: string;
  name: string;
  code: string;
  notes: string;
};

export type Product = {
  name: string;
  currentPrice: number;
  company: string;
};

export type MonthlyTarget = {
  year: number;
  month: number;
  governorate: string;
  amount: number;
  notes: string;
};

export type SheetSummary = {
  name: string;
  gid: string;
  rowCount: number;
  kind: "sales" | "representatives" | "products" | "targets" | "price-history" | "other";
};

export type DelegatesDataset = {
  sales: SaleRecord[];
  representatives: Representative[];
  products: Product[];
  targets: MonthlyTarget[];
  sheets: SheetSummary[];
  fetchedAt: string;
  sourceUrl: string;
};

export type DashboardFilters = {
  period: string;
  governorate: string;
  representative: string;
  company: string;
  product: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  issuesOnly: boolean;
};

export type GovernoratePerformance = {
  governorate: string;
  sales: number;
  target: number | null;
  achievement: number | null;
  remaining: number | null;
  quantity: number;
  representativesCount: number;
  transactionsCount: number;
  status: "محقق" | "قريب جداً" | "قيد المتابعة" | "متأخر" | "بلا هدف";
  tone: "success" | "near" | "watch" | "late" | "neutral";
  topRepresentative: string;
  topProduct: string;
  topCompany: string;
};

export type RepresentativePerformance = {
  rank: number;
  name: string;
  governorate: string;
  code: string;
  sales: number;
  quantity: number;
  transactions: number;
  governorateShare: number;
  topProduct: string;
  topCompany: string;
};

export type ProductPerformance = {
  rank: number;
  name: string;
  company: string;
  currentPrice: number;
  sales: number;
  quantity: number;
  transactions: number;
  governorates: number;
  share: number;
  topGovernorate: string;
  topRepresentative: string;
};

export type CompanyPerformance = {
  name: string;
  sales: number;
  quantity: number;
  transactions: number;
  products: number;
  share: number;
  topProduct: string;
  topGovernorate: string;
};
