export function formatPrice(price: number | null | undefined): string {
  if (price == null) return "-";
  return price.toLocaleString("ko-KR");
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "-";
  return `${value.toFixed(1)}%`;
}

export function formatGap(gap: number | null | undefined): string {
  if (gap == null) return "-";
  if (gap === 0) return "-";
  const sign = gap > 0 ? "+" : "";
  return `${sign}${gap.toLocaleString("ko-KR")}`;
}

export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "수집 전";
  const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(dateStr);
  const normalized = hasTimezone ? dateStr : `${dateStr}Z`;
  const diff = Date.now() - new Date(normalized).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전 수집`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전 수집`;
  const days = Math.floor(hours / 24);
  return `${days}일 전 수집`;
}
