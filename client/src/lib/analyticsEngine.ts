import {
  UnifiedSaleRecord,
  MonthlyTargetRecord,
  DelegateMetadata,
  ProductMetadata,
} from "./sheetsDataFetcher";

export type FilterState = {
  selectedMonthKey: string; // 'all' | 'YYYY-M'
  governorate: string; // 'all' | name
  delegate: string; // 'all' | name
  company: string; // 'all' | name
  product: string; // 'all' | name
  dateFrom: string;
  dateTo: string;
  searchQuery: string;
  healthFilter: "all" | "anomalies-only" | "missing-delegate" | "missing-company" | "missing-date";
};

export type ExecutiveKpiSummary = {
  totalSales: number;
  totalQuantity: number;
  totalTarget: number;
  achievementRate: number;
  remainingBalance: number;
  transactionCount: number;
  governoratesCount: number;
  delegatesCount: number;
  productsCount: number;
  companiesCount: number;
  bestGovernorate: { name: string; sales: number; rate: number };
  lowestGovernorate: { name: string; sales: number; rate: number };
};

export type GovernoratePerformance = {
  governorate: string;
  totalSales: number;
  totalQuantity: number;
  targetAmount: number;
  remainingBalance: number;
  achievementRate: number;
  status: "متجاوز للهدف" | "متقدم جداً" | "قيد الإنجاز" | "متأخر عن الخطة";
  statusColor: "emerald" | "teal" | "amber" | "rose";
  delegatesCount: number;
  bestDelegate: string;
  bestDelegateSales: number;
  bestProduct: string;
  bestProductSales: number;
  bestCompany: string;
  recentSales: UnifiedSaleRecord[];
};

export type DelegateRanking = {
  rank: number;
  delegateName: string;
  governorate: string;
  code?: string;
  totalSales: number;
  totalQuantity: number;
  transactionCount: number;
  shareOfGovernorateRate: number;
  topProduct: string;
};

export type ProductPerformance = {
  rank: number;
  item: string;
  company: string;
  unitPrice: number;
  totalQuantity: number;
  totalRevenue: number;
  topGovernorate: string;
  topDelegate: string;
  governoratesCovered: number;
};

export type CompanyMarketShare = {
  company: string;
  totalSales: number;
  totalQuantity: number;
  skuCount: number;
  marketShareRate: number;
  topGovernorate: string;
  governoratesDistribution: { governorate: string; sales: number }[];
};

export type SalesTimelinePoint = {
  date: string;
  displayDate: string;
  sales: number;
  quantity: number;
  cumulativeSales: number;
};

/**
 * Filter Unified Sales Records based on all filter parameters
 */
export function filterSalesRecords(
  records: UnifiedSaleRecord[],
  filters: FilterState
): UnifiedSaleRecord[] {
  return records.filter((record) => {
    // 1. Month Filter
    if (filters.selectedMonthKey !== "all" && record.date) {
      const dt = new Date(record.date);
      if (!isNaN(dt.getTime())) {
        const yr = dt.getFullYear();
        const mo = dt.getMonth() + 1;
        const key = `${yr}-${mo}`;
        if (key !== filters.selectedMonthKey) return false;
      }
    }

    // 2. Governorate Filter
    if (filters.governorate !== "all" && record.governorate !== filters.governorate) {
      return false;
    }

    // 3. Delegate Filter
    if (filters.delegate !== "all" && record.delegateName !== filters.delegate) {
      return false;
    }

    // 4. Company Filter
    if (filters.company !== "all" && record.company !== filters.company) {
      return false;
    }

    // 5. Product Filter
    if (filters.product !== "all" && record.item !== filters.product) {
      return false;
    }

    // 6. Date Range Filter
    if (filters.dateFrom && record.date < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && record.date > filters.dateTo) {
      return false;
    }

    // 7. Search Query
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.trim().toLowerCase();
      const match =
        record.delegateName.toLowerCase().includes(q) ||
        record.governorate.toLowerCase().includes(q) ||
        record.company.toLowerCase().includes(q) ||
        record.item.toLowerCase().includes(q);
      if (!match) return false;
    }

    // 8. Health Filter
    if (filters.healthFilter === "anomalies-only" && record.anomalies.length === 0) {
      return false;
    }
    if (
      filters.healthFilter === "missing-delegate" &&
      record.delegateName !== "مندوب غير محدد" &&
      record.delegateName
    ) {
      return false;
    }
    if (
      filters.healthFilter === "missing-company" &&
      record.company !== "غير محددة" &&
      record.company
    ) {
      return false;
    }
    if (filters.healthFilter === "missing-date" && record.date) {
      return false;
    }

    return true;
  });
}

/**
 * Computes Executive KPI Summary Cards
 */
export function computeExecutiveKpiSummary(
  filteredSales: UnifiedSaleRecord[],
  allTargets: MonthlyTargetRecord[],
  filters: FilterState
): ExecutiveKpiSummary {
  const totalSales = filteredSales.reduce((sum, r) => sum + r.totalAmount, 0);
  const totalQuantity = filteredSales.reduce((sum, r) => sum + r.quantity, 0);

  // Compute Total Target matching current filters
  let totalTarget = 0;
  const relevantTargets = allTargets.filter((t) => {
    if (filters.selectedMonthKey !== "all") {
      const [yr, mo] = filters.selectedMonthKey.split("-").map(Number);
      if (t.year !== yr || t.month !== mo) return false;
    }
    if (filters.governorate !== "all" && t.governorate !== filters.governorate) {
      return false;
    }
    return true;
  });

  if (relevantTargets.length > 0) {
    totalTarget = relevantTargets.reduce((sum, t) => sum + t.targetAmount, 0);
  } else {
    // Default fallback from records if targets sheet not matching
    const govMap = new Map<string, number>();
    filteredSales.forEach((r) => {
      if (!govMap.has(r.governorate)) {
        govMap.set(r.governorate, r.governorateTarget);
      }
    });
    totalTarget = Array.from(govMap.values()).reduce((sum, t) => sum + t, 0);
  }

  // Fallback sanity target if 0
  if (totalTarget === 0) totalTarget = 102000000;

  const achievementRate = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;
  const remainingBalance = Math.max(0, totalTarget - totalSales);

  const govsSet = new Set(filteredSales.map((r) => r.governorate).filter(Boolean));
  const delsSet = new Set(filteredSales.map((r) => r.delegateName).filter(Boolean));
  const prodsSet = new Set(filteredSales.map((r) => r.item).filter(Boolean));
  const compsSet = new Set(filteredSales.map((r) => r.company).filter(Boolean));

  // Compute Best & Lowest Governorates
  const govSalesMap = new Map<string, { sales: number; target: number }>();
  filteredSales.forEach((r) => {
    const cur = govSalesMap.get(r.governorate) || { sales: 0, target: r.governorateTarget || 25000000 };
    cur.sales += r.totalAmount;
    govSalesMap.set(r.governorate, cur);
  });

  let bestGov = { name: "—", sales: 0, rate: 0 };
  let lowestGov = { name: "—", sales: Infinity, rate: Infinity };

  govSalesMap.forEach((val, name) => {
    const rate = val.target > 0 ? (val.sales / val.target) * 100 : 0;
    if (rate > bestGov.rate) {
      bestGov = { name, sales: val.sales, rate };
    }
    if (rate < lowestGov.rate) {
      lowestGov = { name, sales: val.sales, rate };
    }
  });

  if (lowestGov.sales === Infinity) {
    lowestGov = { name: "—", sales: 0, rate: 0 };
  }

  return {
    totalSales,
    totalQuantity,
    totalTarget,
    achievementRate,
    remainingBalance,
    transactionCount: filteredSales.length,
    governoratesCount: govsSet.size,
    delegatesCount: delsSet.size,
    productsCount: prodsSet.size,
    companiesCount: compsSet.size,
    bestGovernorate: bestGov,
    lowestGovernorate: lowestGov,
  };
}

/**
 * Computes Governorates Performance List
 */
export function computeGovernoratesPerformance(
  filteredSales: UnifiedSaleRecord[],
  allTargets: MonthlyTargetRecord[],
  filters: FilterState
): GovernoratePerformance[] {
  const governorates = Array.from(
    new Set(filteredSales.map((s) => s.governorate).filter(Boolean))
  );

  return governorates.map((gov) => {
    const govSales = filteredSales.filter((r) => r.governorate === gov);
    const totalSales = govSales.reduce((sum, r) => sum + r.totalAmount, 0);
    const totalQuantity = govSales.reduce((sum, r) => sum + r.quantity, 0);

    // Find Target
    let targetAmount = 0;
    const matchTarget = allTargets.find((t) => {
      if (filters.selectedMonthKey !== "all") {
        const [yr, mo] = filters.selectedMonthKey.split("-").map(Number);
        return t.governorate === gov && t.year === yr && t.month === mo;
      }
      return t.governorate === gov;
    });

    if (matchTarget) {
      targetAmount = matchTarget.targetAmount;
    } else {
      targetAmount = govSales[0]?.governorateTarget || 25000000;
    }

    const remainingBalance = Math.max(0, targetAmount - totalSales);
    const achievementRate = targetAmount > 0 ? (totalSales / targetAmount) * 100 : 0;

    let status: GovernoratePerformance["status"] = "قيد الإنجاز";
    let statusColor: GovernoratePerformance["statusColor"] = "amber";

    if (achievementRate >= 100) {
      status = "متجاوز للهدف";
      statusColor = "emerald";
    } else if (achievementRate >= 75) {
      status = "متقدم جداً";
      statusColor = "teal";
    } else if (achievementRate >= 50) {
      status = "قيد الإنجاز";
      statusColor = "amber";
    } else {
      status = "متأخر عن الخطة";
      statusColor = "rose";
    }

    // Best Delegate in Governorate
    const delMap = new Map<string, number>();
    govSales.forEach((r) => delMap.set(r.delegateName, (delMap.get(r.delegateName) || 0) + r.totalAmount));
    let bestDel = "—";
    let bestDelSales = 0;
    delMap.forEach((amt, name) => {
      if (amt > bestDelSales) {
        bestDelSales = amt;
        bestDel = name;
      }
    });

    // Best Product in Governorate
    const prodMap = new Map<string, number>();
    govSales.forEach((r) => prodMap.set(r.item, (prodMap.get(r.item) || 0) + r.totalAmount));
    let bestProd = "—";
    let bestProdSales = 0;
    prodMap.forEach((amt, name) => {
      if (amt > bestProdSales) {
        bestProdSales = amt;
        bestProd = name;
      }
    });

    // Best Company in Governorate
    const compMap = new Map<string, number>();
    govSales.forEach((r) => compMap.set(r.company, (compMap.get(r.company) || 0) + r.totalAmount));
    let bestComp = "—";
    let bestCompSales = 0;
    compMap.forEach((amt, name) => {
      if (amt > bestCompSales) {
        bestCompSales = amt;
        bestComp = name;
      }
    });

    const delegatesCount = delMap.size;

    return {
      governorate: gov,
      totalSales,
      totalQuantity,
      targetAmount,
      remainingBalance,
      achievementRate,
      status,
      statusColor,
      delegatesCount,
      bestDelegate: bestDel,
      bestDelegateSales: bestDelSales,
      bestProduct: bestProd,
      bestProductSales: bestProdSales,
      bestCompany: bestComp,
      recentSales: govSales.slice(0, 10),
    };
  }).sort((a, b) => b.achievementRate - a.achievementRate);
}

/**
 * Computes Delegates Ranking Leaderboard
 */
export function computeDelegatesRanking(
  filteredSales: UnifiedSaleRecord[],
  allDelegates: DelegateMetadata[]
): DelegateRanking[] {
  const delegatesMap = new Map<string, {
    sales: number;
    qty: number;
    count: number;
    gov: string;
    products: Map<string, number>;
  }>();

  filteredSales.forEach((r) => {
    const cur = delegatesMap.get(r.delegateName) || {
      sales: 0,
      qty: 0,
      count: 0,
      gov: r.governorate,
      products: new Map<string, number>(),
    };
    cur.sales += r.totalAmount;
    cur.qty += r.quantity;
    cur.count += 1;
    cur.products.set(r.item, (cur.products.get(r.item) || 0) + r.totalAmount);
    delegatesMap.set(r.delegateName, cur);
  });

  // Calculate Governorate Totals to compute share %
  const govSalesTotal = new Map<string, number>();
  filteredSales.forEach((r) => {
    govSalesTotal.set(r.governorate, (govSalesTotal.get(r.governorate) || 0) + r.totalAmount);
  });

  const list: DelegateRanking[] = [];

  delegatesMap.forEach((val, name) => {
    let topProduct = "—";
    let topProdSales = 0;
    val.products.forEach((amt, p) => {
      if (amt > topProdSales) {
        topProdSales = amt;
        topProduct = p;
      }
    });

    const meta = allDelegates.find((d) => d.name === name);
    const govTotal = govSalesTotal.get(val.gov) || 1;
    const share = (val.sales / govTotal) * 100;

    list.push({
      rank: 1,
      delegateName: name,
      governorate: val.gov,
      code: meta?.code,
      totalSales: val.sales,
      totalQuantity: val.qty,
      transactionCount: val.count,
      shareOfGovernorateRate: share,
      topProduct,
    });
  });

  list.sort((a, b) => b.totalSales - a.totalSales);
  list.forEach((item, idx) => (item.rank = idx + 1));

  return list;
}

/**
 * Computes Products Performance Ranking
 */
export function computeProductPerformance(
  filteredSales: UnifiedSaleRecord[],
  allProducts: ProductMetadata[]
): ProductPerformance[] {
  const prodMap = new Map<string, {
    qty: number;
    revenue: number;
    price: number;
    company: string;
    govs: Map<string, number>;
    delegates: Map<string, number>;
  }>();

  filteredSales.forEach((r) => {
    const cur = prodMap.get(r.item) || {
      qty: 0,
      revenue: 0,
      price: r.unitPrice,
      company: r.company,
      govs: new Map<string, number>(),
      delegates: new Map<string, number>(),
    };
    cur.qty += r.quantity;
    cur.revenue += r.totalAmount;
    if (r.unitPrice > 0) cur.price = r.unitPrice;
    if (r.company && r.company !== "غير محددة") cur.company = r.company;
    cur.govs.set(r.governorate, (cur.govs.get(r.governorate) || 0) + r.totalAmount);
    cur.delegates.set(r.delegateName, (cur.delegates.get(r.delegateName) || 0) + r.totalAmount);
    prodMap.set(r.item, cur);
  });

  const list: ProductPerformance[] = [];

  prodMap.forEach((val, item) => {
    let topGov = "—";
    let topGovSales = 0;
    val.govs.forEach((amt, g) => {
      if (amt > topGovSales) {
        topGovSales = amt;
        topGov = g;
      }
    });

    let topDel = "—";
    let topDelSales = 0;
    val.delegates.forEach((amt, d) => {
      if (amt > topDelSales) {
        topDelSales = amt;
        topDel = d;
      }
    });

    const meta = allProducts.find((p) => p.item === item);

    list.push({
      rank: 1,
      item,
      company: val.company || meta?.company || "LDP",
      unitPrice: val.price || meta?.unitPrice || 0,
      totalQuantity: val.qty,
      totalRevenue: val.revenue,
      topGovernorate: topGov,
      topDelegate: topDel,
      governoratesCovered: val.govs.size,
    });
  });

  list.sort((a, b) => b.totalRevenue - a.totalRevenue);
  list.forEach((p, idx) => (p.rank = idx + 1));

  return list;
}

/**
 * Computes Companies Market Share Breakdown
 */
export function computeCompanyAnalytics(
  filteredSales: UnifiedSaleRecord[]
): CompanyMarketShare[] {
  const totalAllSales = filteredSales.reduce((sum, r) => sum + r.totalAmount, 0) || 1;
  const companyMap = new Map<string, {
    sales: number;
    qty: number;
    items: Set<string>;
    govs: Map<string, number>;
  }>();

  filteredSales.forEach((r) => {
    const compName = r.company || "LDP";
    const cur = companyMap.get(compName) || {
      sales: 0,
      qty: 0,
      items: new Set<string>(),
      govs: new Map<string, number>(),
    };
    cur.sales += r.totalAmount;
    cur.qty += r.quantity;
    cur.items.add(r.item);
    cur.govs.set(r.governorate, (cur.govs.get(r.governorate) || 0) + r.totalAmount);
    companyMap.set(compName, cur);
  });

  return Array.from(companyMap.entries()).map(([comp, data]) => {
    let topGov = "—";
    let maxGovSales = 0;
    const govList: { governorate: string; sales: number }[] = [];

    data.govs.forEach((amt, g) => {
      govList.push({ governorate: g, sales: amt });
      if (amt > maxGovSales) {
        maxGovSales = amt;
        topGov = g;
      }
    });

    govList.sort((a, b) => b.sales - a.sales);

    return {
      company: comp,
      totalSales: data.sales,
      totalQuantity: data.qty,
      skuCount: data.items.size,
      marketShareRate: (data.sales / totalAllSales) * 100,
      topGovernorate: topGov,
      governoratesDistribution: govList,
    };
  }).sort((a, b) => b.totalSales - a.totalSales);
}

/**
 * Computes Sales Velocity Timeline Points
 */
export function computeSalesTimeline(
  filteredSales: UnifiedSaleRecord[]
): SalesTimelinePoint[] {
  const dateMap = new Map<string, { sales: number; qty: number }>();

  filteredSales.forEach((r) => {
    if (!r.date) return;
    const cur = dateMap.get(r.date) || { sales: 0, qty: 0 };
    cur.sales += r.totalAmount;
    cur.qty += r.quantity;
    dateMap.set(r.date, cur);
  });

  const sortedDates = Array.from(dateMap.keys()).sort();
  let cumulative = 0;

  return sortedDates.map((d) => {
    const data = dateMap.get(d)!;
    cumulative += data.sales;

    let displayDate = d;
    try {
      const dt = new Date(d);
      displayDate = new Intl.DateTimeFormat("ar-IQ", { day: "2-digit", month: "short" }).format(dt);
    } catch {
      // ignore
    }

    return {
      date: d,
      displayDate,
      sales: data.sales,
      quantity: data.qty,
      cumulativeSales: cumulative,
    };
  });
}
