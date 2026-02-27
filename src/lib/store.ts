import { create } from "zustand";
import type { SearchResult, BuyerProfile, ParsedIntent } from "@/types";

export type SearchPhase = "parsing" | "searching" | "scoring" | "done" | null;

interface DreamhouseState {
  // Search
  searchResults: SearchResult[];
  selectedProperty: SearchResult | null;
  isSearching: boolean;
  currentQuery: string;
  currentIntent: ParsedIntent | null;
  searchPhase: SearchPhase;
  totalResults: number;
  currentPage: number;
  pageSize: number;

  // Buyer profiles
  buyerProfiles: BuyerProfile[];

  // Actions - Search
  setResults: (results: SearchResult[], total?: number, page?: number, pageSize?: number) => void;
  appendResults: (results: SearchResult[]) => void;
  selectProperty: (result: SearchResult | null) => void;
  clearSelection: () => void;
  setSearching: (searching: boolean) => void;
  setQuery: (query: string) => void;
  setCurrentIntent: (intent: ParsedIntent | null) => void;
  setSearchPhase: (phase: SearchPhase) => void;
  setPage: (page: number) => void;

  // Actions - Profiles
  setBuyerProfiles: (profiles: BuyerProfile[]) => void;
  addBuyerProfile: (profile: BuyerProfile) => void;
  removeBuyerProfile: (id: string) => void;
  updateBuyerProfile: (id: string, updates: Partial<BuyerProfile>) => void;

  // Reset
  resetSearch: () => void;
}

export const useStore = create<DreamhouseState>((set) => ({
  // Initial state
  searchResults: [],
  selectedProperty: null,
  isSearching: false,
  currentQuery: "",
  currentIntent: null,
  searchPhase: null,
  totalResults: 0,
  currentPage: 1,
  pageSize: 25,
  buyerProfiles: [],

  // Search actions
  setResults: (results, total, page, pageSize) =>
    set({
      searchResults: results,
      isSearching: false,
      ...(total !== undefined && { totalResults: total }),
      ...(page !== undefined && { currentPage: page }),
      ...(pageSize !== undefined && { pageSize }),
    }),
  appendResults: (results) =>
    set((state) => ({
      searchResults: [...state.searchResults, ...results],
      isSearching: false,
    })),
  selectProperty: (result) => set({ selectedProperty: result }),
  clearSelection: () => set({ selectedProperty: null }),
  setSearching: (searching) => set({ isSearching: searching }),
  setQuery: (query) => set({ currentQuery: query }),
  setCurrentIntent: (intent) => set({ currentIntent: intent }),
  setSearchPhase: (phase) => set({ searchPhase: phase }),
  setPage: (page) => set({ currentPage: page }),

  // Profile actions
  setBuyerProfiles: (profiles) => set({ buyerProfiles: profiles }),
  addBuyerProfile: (profile) =>
    set((state) => ({
      buyerProfiles: [profile, ...state.buyerProfiles],
    })),
  removeBuyerProfile: (id) =>
    set((state) => ({
      buyerProfiles: state.buyerProfiles.filter((p) => p.id !== id),
    })),
  updateBuyerProfile: (id, updates) =>
    set((state) => ({
      buyerProfiles: state.buyerProfiles.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

  // Reset
  resetSearch: () =>
    set({
      searchResults: [],
      selectedProperty: null,
      isSearching: false,
      currentQuery: "",
      currentIntent: null,
      searchPhase: null,
      totalResults: 0,
      currentPage: 1,
    }),
}));
