"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserState {
  currentUserId: number | null;
  setCurrentUser: (id: number | null) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      currentUserId: null,
      setCurrentUser: (id) => set({ currentUserId: id }),
    }),
    { name: "asimaster-user" }
  )
);
