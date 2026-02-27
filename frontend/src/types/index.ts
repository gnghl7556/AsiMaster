export type { components, operations, paths } from "./api.generated";
import type { components as OpenAPIComponents } from "./api.generated";

type ApiSchemas = OpenAPIComponents["schemas"];
type Schema<K extends keyof ApiSchemas> = ApiSchemas[K];
type Override<T, U> = Omit<T, keyof U> & U;

export type ProductStatus = "winning" | "close" | "losing";
export type SortOption = "urgency" | "margin" | "rank_drop" | "category";

export type User = Schema<"UserResponse">;

export type Product = Override<
  Omit<Schema<"ProductResponse">, "cost_preset_id">,
  {
    brand: string | null;
    maker: string | null;
    series: string | null;
    capacity: string | null;
    color: string | null;
    material: string | null;
    product_attributes: Record<string, string> | null;
    cost_preset_ids: number[];
  }
>;

export type ProductListItem = Override<
  Omit<Schema<"ProductListItem">, "cost_preset_id">,
  {
    model_code: string | null;
    brand: string | null;
    cost_preset_ids: number[];
    status: ProductStatus;
  }
>;

export type RankingItem = Override<
  Schema<"RankingItemResponse">,
  {
    relevance_reason: string | null;
    brand: string | null;
    maker: string | null;
    product_type: string | null;
    category1: string | null;
    category2: string | null;
    category3: string | null;
    category4: string | null;
  }
>;

export type ExcludedProduct = Schema<"ExcludedProductResponse">;
export type IncludedOverride = Schema<"IncludedOverrideResponse">;
export type ShippingOverride = Schema<"ShippingOverrideResponse">;
export type StoreProduct = Schema<"StoreProductItem">;
export type StoreImportCreatedProduct = Schema<"CreatedProductMapping">;
export type StoreImportResult = Override<
  Schema<"StoreImportResult">,
  { created_products?: StoreImportCreatedProduct[] }
>;

export interface NaverCategory {
  name: string;
  product_count: number;
  children: NaverCategory[];
}

export interface NaverCategoryTree {
  categories: NaverCategory[];
  total_paths: number;
}

export type ClassifiedToken = Schema<"TokenItem">;
export type SuggestedKeyword = Override<
  Schema<"SuggestedKeyword">,
  { level: "specific" | "medium" | "broad" }
>;
export type KeywordSuggestion = Override<
  Schema<"KeywordSuggestionResponse">,
  {
    tokens: ClassifiedToken[];
    keywords: SuggestedKeyword[];
    field_guide: {
      brand: string | null;
      category: string | null;
    };
  }
>;

export type SearchKeyword = Override<
  Schema<"KeywordResponse">,
  { sort_type: "sim" | "asc" }
>;

export type KeywordDetail = Override<
  Schema<"KeywordWithRankings">,
  {
    sort_type: "sim" | "asc";
    rankings: RankingItem[];
  }
>;

export type CostItemCalculated = Override<
  Schema<"CostItemCalculated">,
  { type: "percent" | "fixed" }
>;

export type MarginDetail = Override<
  Schema<"MarginDetail">,
  { cost_items: CostItemCalculated[] }
>;

export type CompetitorSummary = Override<
  Schema<"CompetitorSummary">,
  {
    brand: string | null;
    maker: string | null;
  }
>;

export type ProductDetail = Override<
  Omit<Schema<"ProductDetail">, "cost_preset_id">,
  {
    brand: string | null;
    maker: string | null;
    series: string | null;
    capacity: string | null;
    color: string | null;
    material: string | null;
    product_attributes: Record<string, string> | null;
    cost_preset_ids: number[];
    status: ProductStatus;
    competitors: CompetitorSummary[];
    keywords: KeywordDetail[];
    margin: MarginDetail | null;
  }
>;

export type Alert = Schema<"AlertResponse">;
export type DashboardSummary = Schema<"DashboardSummary">;
