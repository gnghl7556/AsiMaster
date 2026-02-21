export interface User {
  id: number;
  name: string;
  naver_store_name: string | null;
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
  lowest_seller: string | null;
  price_gap: number | null;
  price_gap_percent: number | null;
  my_rank: number | null;
  keyword_count: number;
  margin_amount: number | null;
  margin_percent: number | null;
  sparkline: number[];
  last_crawled_at: string | null;
}

export interface RankingItem {
  id: number;
  rank: number;
  product_name: string;
  price: number;
  mall_name: string;
  product_url: string | null;
  image_url: string | null;
  naver_product_id: string | null;
  is_my_store: boolean;
  is_relevant: boolean;
  crawled_at: string;
}

export interface ExcludedProduct {
  id: number;
  naver_product_id: string;
  naver_product_name: string | null;
  created_at: string;
}

export interface KeywordDetail {
  id: number;
  keyword: string;
  sort_type: "sim" | "asc";
  is_primary: boolean;
  crawl_status: string;
  last_crawled_at: string | null;
  rankings: RankingItem[];
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
  lowest_seller: string | null;
  price_gap: number | null;
  price_gap_percent: number | null;
  my_rank: number | null;
  last_crawled_at: string | null;
  keywords: KeywordDetail[];
  margin: MarginDetail | null;
}

export interface SearchKeyword {
  id: number;
  product_id: number;
  keyword: string;
  sort_type: "sim" | "asc";
  is_primary: boolean;
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
