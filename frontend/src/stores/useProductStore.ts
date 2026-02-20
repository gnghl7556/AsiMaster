"use client";

import { create } from "zustand";
import type { SortOption } from "@/types";

interface ProductState {
  sortBy: SortOption;
  category: string | null;
  search: string;
  setSortBy: (sort: SortOption) => void;
  setCategory: (cat: string | null) => void;
  setSearch: (q: string) => void;
}

export const useProductStore = create<ProductState>((set) => ({
  sortBy: "urgency",
  category: null,
  search: "",
  setSortBy: (sortBy) => set({ sortBy }),
  setCategory: (category) => set({ category }),
  setSearch: (search) => set({ search }),
}));
