import { useState } from "react";
import { Button } from "@haza-aios/ui/components/button";
import { LogoMark } from "@haza-aios/ui/components/logo-mark";
import { NavItem, Navbar } from "@haza-aios/ui/components/navbar";

import { navigate } from "@/routes/navigation";

const navItems = ["Products", "Solutions", "Industries", "Resources", "Pricing", "Company"];

function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8 relative">
        <Navbar className="mt-2 flex items-center justify-between rounded-full border border-white/10 bg-blue-900 p-3 shadow-[0_18px_45px_rgba(10,16,28,0.35)]">
          <div className="flex items-center justify-between w-full lg:w-auto">
            <div className="flex items-center gap-3">
              <LogoMark size="sm" />
              <span className="text-lg font-semibold tracking-[-0.04em] text-white">HAZA AIOS</span>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              className="lg:hidden p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? (
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav aria-label="Main navigation" className="hidden items-center gap-6 lg:flex">
            {navItems.map((item) => (
              <NavItem key={item} href="#" className="text-sm text-slate-300 hover:text-white">
                {item}
              </NavItem>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-3">
            <Button
              variant="primary"
              className="rounded-xl px-5 py-2"
              onClick={() => navigate("/login")}
            >
              Sign In
            </Button>
            <Button variant="secondary" className="flex items-center gap-2 rounded-xl px-5 py-2">
              <span>Request Demo</span>
            </Button>
          </div>
        </Navbar>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute left-4 right-4 top-[80px] rounded-2xl border border-white/10 bg-blue-950 p-4 shadow-xl flex flex-col gap-4 animate-in fade-in slide-in-from-top-4">
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => (
                <a
                  key={item}
                  href="#"
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item}
                </a>
              ))}
            </nav>
            <div className="h-px w-full bg-white/10" />
            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                className="w-full justify-center rounded-xl py-3"
                onClick={() => {
                  navigate("/login");
                  setIsMobileMenuOpen(false);
                }}
              >
                Sign In
              </Button>
              <Button variant="secondary" className="w-full justify-center rounded-xl py-3" onClick={() => setIsMobileMenuOpen(false)}>
                Request Demo
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export { Header };
