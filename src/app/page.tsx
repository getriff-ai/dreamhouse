"use client";

import Header from "@/components/layout/Header";
import SearchHero from "@/components/search/SearchHero";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <main className="hero-gradient flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-5 pb-20">
        <div className="hero-glow" />
        <div className="relative z-10">
          <SearchHero />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-100 bg-white px-5 py-6">
        <p className="text-center text-[12px] font-light text-neutral-400">
          Powered by King County public records. Not affiliated with Zillow or Redfin.
        </p>
      </footer>
    </div>
  );
}
