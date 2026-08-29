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
  healthFilter: "all" | "valid-only" | "incomplete-only" | "missing-delegate" | "missing-date";
};

export type ExecutiveKpiSummary = {
  totalSales: number;
  totalQuantity: number;
  totalTarget: number;
  achievementRate: number;
  remainingBalance: number;
  transactionCount: number;
  validCount: number;
  incompleteCount: number;
  governoratesCount: number;
  delegatesCount: number;
  productsCount: number;
  companiesCount: number;
  bestGovernorate: { name: string; sales: number; rate: number };
  lowestGovernorate: { name: string; sales: number; rate: number };
  topProduct: { name: string; revenue: number };
  topCompany: { name: string; revenue: number; share: number };
};

export type ExecutiveInsight = {
  id: string;
  type: "success" | "info" | "warning" | "highlight";
  title: string;
  description: string;
};

export type GovernoratePerformance = {
  governorate: string;
  totalSales: number;
  totalQuantity: number;
  targetAmount: number;
  remainingBalance: number;
  achievementRate: number;
  status: "محقق" | "قريب جداً" | "قيد المتابعة" | "متأخر";
  statusColor: "emerald" | "teal" | "amber" | "rose";
  delegatesCount: number;
  bestDelegate: string;
  bestDelegateSales: number;
  bestProduct: string;
  bestProductSales: number;
  bestCompany: string;
  delegatesList: { name: string; code?: string; sales: number; qty: number; share: number }[];
  productsList: { item: string; qty: number; revenue: number }[];
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
  topCompany: string;
};

export type ProductPerformance = {
  rank: number;
  item: string;
  company: string;
  unitPrice: number;
  totalQuantity: number;
  totalRevenue: number;
  shareOfTotalSales: number;
  topGovernorate: string;
  topDelegate: string;
  governoratesCovered: number;
  transactionsCount: number;
};

export type CompanyMarketShare = {
  company: string;
  totalSales: number;
  totalQuantity: number;
  skuCount: number;
  marketShareRate: number;
  topGovernorate: string;
  topProduct: string;
  governoratesDistribution: { governorate: string; sales: number; share: number }[];
};

export type SalesTimelinePoint = {
  date: string;
  displayDate: string;
  sales: number;
  quantity: number;
  cumulativeSales: number;
};

/**
 * Standardize date strings to YYYY-MM-DD for comparison and period matching
 */
export function normalizeDateToISO(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.trim().split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      const y = parts[0];
      const m = parts[1].padStart(2, "0");
      const d = parts[2].padStart(2, "0");
      return `${y}-${m}-${d}`;
    } else {
      // DD/MM/YYYY
      const d = parts[0].padStart(2, "0");
      const m = parts[1].padStart(2, "0");
      const y = parts[2];
      return `${y}-${m}-${d}`;
    }
  }
  return dateStr;
}

/**
 * Filter Unified Sales Records with full multi-dimensional support
 */
export function filterSalesRecords(
  records: UnifiedSaleRecord[],
  filters: FilterState
): UnifiedSaleRecord[] {
  return records.filter((record) => {
    // 1. Month / Period Filter
    if (filters.selectedMonthKey !== "all") {
      if (record.date) {
        const iso = normalizeDateToISO(record.date);
        const [y, m] = iso.split("-");
        const key = `${parseInt(y)}-${parseInt(m)}`;
        if (key !== filters.selectedMonthKey) return false;
      } else {
        // If date is missing but we're filtering on month, exclude unless all
        return false;
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
    const isoDate = normalizeDateToISO(record.date);
    if (filters.dateFrom && isoDate && isoDate < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && isoDate && isoDate > filters.dateTo) {
      return false;
    }

    // 7. Search Query
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.trim().toLowerCase();
      const match =
        record.delegateName.toLowerCase().includes(q) ||
        record.governorate.toLowerCase().includes(q) ||
        record.company.toLowerCase().includes(q) ||
        record.item.toLowerCase().includes(q) ||
        (record.notes && record.notes.toLowerCase().includes(q));
      if (!match) return false;
    }

    // 8. Health Filter
    if (filters.healthFilter === "valid-only" && record.status !== "valid") {
      return false;
    }
    if (filters.healthFilter === "incomplete-only" && record.status !== "incomplete") {
      return false;
    }
    if (filters.healthFilter === "missing-delegate" && record.delegateName !== "غير محدد" && record.delegateName) {
      return false;
    }
    if (filters.healthFilter === "missing-date" && record.date) {
      return false;
    }

    return true;
  });
}

/**
 * Computes Executive KPI Summary
 */
export function computeExecutiveKpiSummary(
  filteredSales: UnifiedSaleRecord[],
  allTargets: MonthlyTargetRecord[],
  filters: FilterState
): ExecutiveKpiSummary {
  const totalSales = filteredSales.reduce((sum, r) => sum + r.totalAmount, 0);
  const totalQuantity = filteredSales.reduce((sum, r) => sum + r.quantity, 0);
  const validCount = filteredSales.filter((r) => r.status === "valid").length;
  const incompleteCount = filteredSales.filter((r) => r.status === "incomplete").length;

  // Compute Total Target matching current period and governorate filters
  let totalTarget = 0;
  const relevantTargets = allTargets.filter((t) => {
    if (filters.selectedMonthKey !== "all") {
      const [yr, mo] = filters.selectedMonthKey.split("-").map(Number);
      if (t.year !== yr || t.month !== mo) return false;
    } else {
      // Default to month 8 if all periods chosen to avoid multi-month summation
      if (t.year !== 2026 || t.month !== 8) return false;
    }
    if (filters.governorate !== "all" && t.governorate !== filters.governorate) {
      return false;
    }
    return true;
  });

  if (relevantTargets.length > 0) {
    totalTarget = relevantTargets.reduce((sum, t) => sum + t.targetAmount, 0);
  } else {
    // Default sum from records
    const govMap = new Map<string, number>();
    filteredSales.forEach((r) => {
      if (!govMap.has(r.governorate) && r.governorateTarget > 0) {
        govMap.set(r.governorate, r.governorateTarget);
      }
    });
    totalTarget = Array.from(govMap.values()).reduce((sum, t) => sum + t, 0) || 102000000;
  }

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

  // Top Product & Top Company
  const prodMap = new Map<string, number>();
  const compMap = new Map<string, number>();
  filteredSales.forEach((r) => {
    prodMap.set(r.item, (prodMap.get(r.item) || 0) + r.totalAmount);
    compMap.set(r.company, (compMap.get(r.company) || 0) + r.totalAmount);
  });

  let topProd = { name: "—", revenue: 0 };
  prodMap.forEach((amt, item) => {
    if (amt > topProd.revenue) topProd = { name: item, revenue: amt };
  });

  let topComp = { name: "—", revenue: 0, share: 0 };
  compMap.forEach((amt, comp) => {
    if (amt > topComp.revenue) {
      topComp = {
        name: comp,
        revenue: amt,
        share: totalSales > 0 ? (amt / totalSales) * 100 : 0,
      };
    }
  });

  return {
    totalSales,
    totalQuantity,
    totalTarget,
    achievementRate,
    remainingBalance,
    transactionCount: filteredSales.length,
    validCount,
    incompleteCount,
    governoratesCount: govsSet.size,
    delegatesCount: delsSet.size,
    productsCount: prodsSet.size,
    companiesCount: compsSet.size,
    bestGovernorate: bestGov,
    lowestGovernorate: lowestGov,
    topProduct: topProd,
    topCompany: topComp,
  };
}

/**
 * Generates Deterministic Executive Insights
 */
export function generateExecutiveInsights(
  kpis: ExecutiveKpiSummary,
  govPerformances: GovernoratePerformance[]
): ExecutiveInsight[] {
  const insights: ExecutiveInsight[] = [];

  // 1. Target Overachievers
  const overachievers = govPerformances.filter((g) => g.achievementRate >= 100);
  if (overachievers.length > 0) {
    const names = overachievers.map((g) => `${g.governorate} (${g.achievementRate.toFixed(1)}%)`).join(" و ");
    insights.push({
      id: "insight-overachieve",
      type: "success",
      title: "تجاوز التارغت المستهدف",
      description: `حققت ${names} إنجازاً متميزاً بتجاوز خطة المبيعات المستهدفة للفترة المحددة.`,
    });
  }

  // 2. Highest Volume Sales Governorate
  if (govPerformances.length > 0) {
    const topSalesGov = [...govPerformances].sort((a, b) => b.totalSales - a.totalSales)[0];
    if (topSalesGov && topSalesGov.totalSales > 0) {
      insights.push({
        id: "insight-highest-sales",
        type: "highlight",
        title: "المحافظة الأعلى مبيعاً",
        description: `محافظة ${topSalesGov.governorate} تتصدر الإيرادات بإجمالي مبيعات ${topSalesGov.totalSales.toLocaleString()} د.ع ومساهمة ${topSalesGov.totalQuantity.toLocaleString()} قطعة.`,
      });
    }
  }

  // 3. Governorate needing attention (< 50%)
  const delayedGovs = govPerformances.filter((g) => g.achievementRate < 50);
  if (delayedGovs.length > 0) {
    const delayed = delayedGovs[0];
    insights.push({
      id: "insight-attention",
      type: "warning",
      title: `متابعة تحصيلية: ${delayed.governorate}`,
      description: `نسبة الإنجاز الحالية ${delayed.achievementRate.toFixed(1)}% مع متبقي للهدف قدره ${delayed.remainingBalance.toLocaleString()} د.ع يتطلب تنشيط خطوط سير المندوبين.`,
    });
  }

  // 4. Top SKU
  if (kpis.topProduct.name !== "—") {
    insights.push({
      id: "insight-top-sku",
      type: "info",
      title: "المادة الدوائية الأكثر تصريفاً",
      description: `صنف ${kpis.topProduct.name} يحقق أعلى إيراد بقيمة ${kpis.topProduct.revenue.toLocaleString()} د.ع عبر خطوط التوزيع المباشر والميدان.`,
    });
  }

  return insights;
}

/**
 * Computes Governorates Performance List with Deep Detailed Breakdown
 */
export function computeGovernoratesPerformance(
  filteredSales: UnifiedSaleRecord[],
  allTargets: MonthlyTargetRecord[],
  filters: FilterState,
  allDelegates: DelegateMetadata[]
): GovernoratePerformance[] {
  // Extract all governorates present in records or standard southern governorates
  const govSet = new Set(filteredSales.map((s) => s.governorate).filter(Boolean));
  ["الكوت", "العمارة", "البصرة", "الناصرية"].forEach((g) => govSet.add(g));

  const list: GovernoratePerformance[] = [];

  govSet.forEach((gov) => {
    const govSales = filteredSales.filter((r) => r.governorate === gov);
    const totalSales = govSales.reduce((sum, r) => sum + r.totalAmount, 0);
    const totalQuantity = govSales.reduce((sum, r) => sum + r.quantity, 0);

    // Find Target matching month/year
    let targetAmount = 0;
    const matchTarget = allTargets.find((t) => {
      if (filters.selectedMonthKey !== "all") {
        const [yr, mo] = filters.selectedMonthKey.split("-").map(Number);
        return t.governorate === gov && t.year === yr && t.month === mo;
      }
      return t.governorate === gov && t.year === 2026 && t.month === 8;
    });

    if (matchTarget) {
      targetAmount = matchTarget.targetAmount;
    } else {
      targetAmount = govSales[0]?.governorateTarget || 25000000;
    }

    const remainingBalance = Math.max(0, targetAmount - totalSales);
    const achievementRate = targetAmount > 0 ? (totalSales / targetAmount) * 100 : 0;

    let status: GovernoratePerformance["status"] = "قيد المتابعة";
    let statusColor: GovernoratePerformance["statusColor"] = "amber";

    if (achievementRate >= 100) {
      status = "محقق";
      statusColor = "emerald";
    } else if (achievementRate >= 80) {
      status = "قريب جداً";
      statusColor = "teal";
    } else if (achievementRate >= 50) {
      status = "قيد المتابعة";
      statusColor = "amber";
    } else {
      status = "متأخر";
      statusColor = "rose";
    }

    // Delegates Breakdown in this Governorate
    const delMap = new Map<string, { sales: number; qty: number }>();
    govSales.forEach((r) => {
      const cur = delMap.get(r.delegateName) || { sales: 0, qty: 0 };
      cur.sales += r.totalAmount;
      cur.qty += r.quantity;
      delMap.set(r.delegateName, cur);
    });

    let bestDel = "—";
    let bestDelSales = 0;
    const delegatesList: GovernoratePerformance["delegatesList"] = [];

    delMap.forEach((data, name) => {
      const share = totalSales > 0 ? (data.sales / totalSales) * 100 : 0;
      const meta = allDelegates.find((d) => d.name === name);
      delegatesList.push({
        name,
        code: meta?.code,
        sales: data.sales,
        qty: data.qty,
        share,
      });
      if (data.sales > bestDelSales) {
        bestDelSales = data.sales;
        bestDel = name;
      }
    });

    delegatesList.sort((a, b) => b.sales - a.sales);

    // Products Breakdown in this Governorate
    const prodMap = new Map<string, { qty: number; revenue: number }>();
    govSales.forEach((r) => {
      const cur = prodMap.get(r.item) || { qty: 0, revenue: 0 };
      cur.qty += r.quantity;
      cur.revenue += r.totalAmount;
      prodMap.set(r.item, cur);
    });

    let bestProd = "—";
    let bestProdSales = 0;
    const productsList: GovernoratePerformance["productsList"] = [];

    prodMap.forEach((data, item) => {
      productsList.push({ item, qty: data.qty, revenue: data.revenue });
      if (data.revenue > bestProdSales) {
        bestProdSales = data.revenue;
        bestProd = item;
      }
    });

    productsList.sort((a, b) => b.revenue - a.revenue);

    // Best Company in this Governorate
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

    const activeGovDelegatesCount = allDelegates.filter((d) => d.governorate === gov).length || 8;

    list.push({
      governorate: gov,
      totalSales,
      totalQuantity,
      targetAmount,
      remainingBalance,
      achievementRate,
      status,
      statusColor,
      delegatesCount: activeGovDelegatesCount,
      bestDelegate: bestDel,
      bestDelegateSales: bestDelSales,
      bestProduct: bestProd,
      bestProductSales: bestProdSales,
      bestCompany: bestComp,
      delegatesList,
      productsList,
      recentSales: govSales.slice(0, 10),
    });
  });

  return list.sort((a, b) => b.achievementRate - a.achievementRate);
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
    companies: Map<string, number>;
  }>();

  filteredSales.forEach((r) => {
    const cur = delegatesMap.get(r.delegateName) || {
      sales: 0,
      qty: 0,
      count: 0,
      gov: r.governorate,
      products: new Map<string, number>(),
      companies: new Map<string, number>(),
    };
    cur.sales += r.totalAmount;
    cur.qty += r.quantity;
    cur.count += 1;
    cur.products.set(r.item, (cur.products.get(r.item) || 0) + r.totalAmount);
    cur.companies.set(r.company, (cur.companies.get(r.company) || 0) + r.totalAmount);
    delegatesMap.set(r.delegateName, cur);
  });

  const govSalesTotal = new Map<string, number>();
  filteredSales.forEach((r) => {
    govSalesTotal.set(r.governorate, (govSalesTotal.get(r.governorate) || 0) + r.totalAmount);
  });

  const list: DelegateRanking[] = [];

  delegatesMap.forEach((val, name) => {
    let topProduct = "—";
    let maxProd = 0;
    val.products.forEach((amt, p) => {
      if (amt > maxProd) {
        maxProd = amt;
        topProduct = p;
      }
    });

    let topCompany = "—";
    let maxComp = 0;
    val.companies.forEach((amt, c) => {
      if (amt > maxComp) {
        maxComp = amt;
        topCompany = c;
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
      topCompany,
    });
  });

  list.sort((a, b) => b.totalSales - a.totalSales);
  list.forEach((item, idx) => (item.rank = idx + 1));

  return list;
}

/**
 * Computes Products Performance Analytics
 */
export function computeProductPerformance(
  filteredSales: UnifiedSaleRecord[],
  allProducts: ProductMetadata[]
): ProductPerformance[] {
  const totalAllSales = filteredSales.reduce((sum, r) => sum + r.totalAmount, 0) || 1;
  const prodMap = new Map<string, {
    qty: number;
    revenue: number;
    price: number;
    company: string;
    count: number;
    govs: Map<string, number>;
    delegates: Map<string, number>;
  }>();

  filteredSales.forEach((r) => {
    const cur = prodMap.get(r.item) || {
      qty: 0,
      revenue: 0,
      price: r.unitPrice,
      company: r.company,
      count: 0,
      govs: new Map<string, number>(),
      delegates: new Map<string, number>(),
    };
    cur.qty += r.quantity;
    cur.revenue += r.totalAmount;
    cur.count += 1;
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
      unitPrice: meta?.unitPrice || val.price || 0,
      totalQuantity: val.qty,
      totalRevenue: val.revenue,
      shareOfTotalSales: (val.revenue / totalAllSales) * 100,
      topGovernorate: topGov,
      topDelegate: topDel,
      governoratesCovered: val.govs.size,
      transactionsCount: val.count,
    });
  });

  list.sort((a, b) => b.totalRevenue - a.totalRevenue);
  list.forEach((p, idx) => (p.rank = idx + 1));

  return list;
}

/**
 * Computes Companies Analytics Breakdown
 */
export function computeCompanyAnalytics(
  filteredSales: UnifiedSaleRecord[]
): CompanyMarketShare[] {
  const totalAllSales = filteredSales.reduce((sum, r) => sum + r.totalAmount, 0) || 1;
  const companyMap = new Map<string, {
    sales: number;
    qty: number;
    items: Set<string>;
    prods: Map<string, number>;
    govs: Map<string, number>;
  }>();

  filteredSales.forEach((r) => {
    const compName = r.company || "LDP";
    const cur = companyMap.get(compName) || {
      sales: 0,
      qty: 0,
      items: new Set<string>(),
      prods: new Map<string, number>(),
      govs: new Map<string, number>(),
    };
    cur.sales += r.totalAmount;
    cur.qty += r.quantity;
    cur.items.add(r.item);
    cur.prods.set(r.item, (cur.prods.get(r.item) || 0) + r.totalAmount);
    cur.govs.set(r.governorate, (cur.govs.get(r.governorate) || 0) + r.totalAmount);
    companyMap.set(compName, cur);
  });

  return Array.from(companyMap.entries()).map(([comp, data]) => {
    let topGov = "—";
    let maxGovSales = 0;
    const govList: { governorate: string; sales: number; share: number }[] = [];

    data.govs.forEach((amt, g) => {
      const share = data.sales > 0 ? (amt / data.sales) * 100 : 0;
      govList.push({ governorate: g, sales: amt, share });
      if (amt > maxGovSales) {
        maxGovSales = amt;
        topGov = g;
      }
    });

    govList.sort((a, b) => b.sales - a.sales);

    let topProd = "—";
    let maxProd = 0;
    data.prods.forEach((amt, item) => {
      if (amt > maxProd) {
        maxProd = amt;
        topProd = item;
      }
    });

    return {
      company: comp,
      totalSales: data.sales,
      totalQuantity: data.qty,
      skuCount: data.items.size,
      marketShareRate: (data.sales / totalAllSales) * 100,
      topGovernorate: topGov,
      topProduct: topProd,
      governoratesDistribution: govList,
    };
  }).sort((a, b) => b.totalSales - a.totalSales);
}

/**
 * Computes Sales Velocity Timeline
 */
export function computeSalesTimeline(
  filteredSales: UnifiedSaleRecord[]
): SalesTimelinePoint[] {
  const dateMap = new Map<string, { sales: number; qty: number; rawDate: string }>();

  filteredSales.forEach((r) => {
    if (!r.date) return;
    const iso = normalizeDateToISO(r.date);
    const cur = dateMap.get(iso) || { sales: 0, qty: 0, rawDate: r.date };
    cur.sales += r.totalAmount;
    cur.qty += r.quantity;
    dateMap.set(iso, cur);
  });

  const sortedKeys = Array.from(dateMap.keys()).sort();
  let cumulative = 0;

  return sortedKeys.map((iso) => {
    const data = dateMap.get(iso)!;
    cumulative += data.sales;

    let displayDate = data.rawDate;
    try {
      const dt = new Date(iso);
      if (!isNaN(dt.getTime())) {
        displayDate = new Intl.DateTimeFormat("ar-IQ", { day: "2-digit", month: "short" }).format(dt);
      }
    } catch {
      // fallback to raw
    }

    return {
      date: iso,
      displayDate,
      sales: data.sales,
      quantity: data.qty,
      cumulativeSales: cumulative,
    };
  });
}
