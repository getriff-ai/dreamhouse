"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const navLinks = [
  { href: "/", label: "Search" },
  { href: "/profiles", label: "Profiles" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={`glass sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "border-b border-border-light shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
          {/* Logo */}
          <Link
            href="/"
            className="text-lg font-light tracking-tight text-foreground transition-opacity hover:opacity-70"
          >
            dreamhouse
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 text-[13px] font-normal text-muted transition-colors hover:text-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:text-foreground md:hidden"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <X className="h-[18px] w-[18px]" />
            ) : (
              <Menu className="h-[18px] w-[18px]" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile full-screen overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white md:hidden">
          <div className="flex h-14 items-center justify-between px-5">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="text-lg font-light tracking-tight text-foreground"
            >
              dreamhouse
            </Link>
            <button
              onClick={() => setMenuOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:text-foreground"
              aria-label="Close menu"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>

          <nav className="flex flex-1 flex-col items-center justify-center gap-8">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="text-2xl font-light text-foreground transition-opacity hover:opacity-60"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
