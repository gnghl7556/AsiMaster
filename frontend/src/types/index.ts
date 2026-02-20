export interface User {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  user_id: number;
  name: string;
  category: string | null;
  cost_price: number;
  selling_price: number;
  image_url: string | null;
  is_price_locked: boolean;
  price_lock_reason: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProductStatus = "winning" | "close" | "losing";

export interface ProductListItem {
  id: number;
  name: string;
  category: string | null;
  selling_price: number;
  cost_price: number;
  image_url: string | null;
  is_price_locked: boolean;
  price_lock_reason: string | null;
  status: ProductStatus;
  lowest_price: number | null;
  lowest_platform: string | null;
  lowest_shipping_fee: number | null;
  price_gap: number | null;
  price_gap_percent: number | null;
  ranking: number | null;
  total_sellers: number | null;
  margin_amount: number | null;
  margin_percent: number | null;
  sparkline: number[];
  last_crawled_at: string | null;
}

export interface CompetitorDetail {
  id: number;
  platform: string;
  seller_name: string | null;
  price: number;
  shipping_fee: number;
  total_price: number;
  ranking: number | null;
  is_lowest: boolean;
  gap_from_lowest: number;
  crawled_at: string | null;
}

export interface MarginDetail {
  selling_price: number;
  cost_price: number;
  total_costs: number;
  cost_items: CostItemCalculated[];
  net_margin: number;
  margin_percent: number;
}

export interface CostItemCalculated {
  name: string;
  type: "percent" | "fixed";
  value: number;
  calculated: number;
}

export interface ProductDetail {
  id: number;
  name: string;
  category: string | null;
  selling_price: number;
  cost_price: number;
  image_url: string | null;
  is_price_locked: boolean;
  price_lock_reason: string | null;
  status: ProductStatus;
  lowest_price: number | null;
  lowest_platform: string | null;
  price_gap: number | null;
  price_gap_percent: number | null;
  ranking: number | null;
  total_sellers: number | null;
  last_crawled_at: string | null;
  competitors: CompetitorDetail[];
  margin: MarginDetail | null;
}

export interface Platform {
  id: number;
  name: string;
  display_name: string;
  base_url: string | null;
  is_default: boolean;
}

export interface UserPlatform {
  id: number;
  user_id: number;
  platform_id: number;
  platform_name: string;
  platform_display_name: string;
  is_active: boolean;
  crawl_interval_min: number;
}

export interface Competitor {
  id: number;
  product_id: number;
  platform_id: number;
  url: string;
  seller_name: string | null;
  is_active: boolean;
  last_crawled_at: string | null;
  crawl_status: string;
  created_at: string;
}

export interface Alert {
  id: number;
  user_id: number;
  product_id: number | null;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface DashboardSummary {
  total_products: number;
  active_products: number;
  price_locked_products: number;
  status_counts: {
    winning: number;
    close: number;
    losing: number;
  };
  avg_margin_percent: number | null;
  unread_alerts: number;
  last_crawled_at: string | null;
  crawl_success_rate: number | null;
}

export type SortOption = "urgency" | "margin" | "rank_drop" | "category";
