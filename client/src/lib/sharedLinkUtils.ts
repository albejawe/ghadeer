export type SharedFilters = { company: string; governorate: string; warehouse: string; status: string; quick: string; search: string };

export function createSharedLinkRequest(filters: SharedFilters, name = "تقرير الفواتير") {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filters, name }),
  } as const;
}

export function sharedLinkPath(origin: string, id: string) {
  return `${origin.replace(/\/$/, "")}/shared/${encodeURIComponent(id)}`;
}

export function sharedIdFromPath(pathname: string) {
  return pathname.match(/^\/shared\/([^/]+)/)?.[1] || "";
}
