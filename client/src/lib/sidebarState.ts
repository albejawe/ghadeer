export const SIDEBAR_DEFAULT_OPEN = false;

export function toggleSidebar(open: boolean) {
  return !open;
}

export function sidebarAriaLabel(open: boolean) {
  return open ? "إغلاق القائمة الجانبية" : "فتح القائمة الجانبية";
}
