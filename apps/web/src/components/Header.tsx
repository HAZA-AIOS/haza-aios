import { Button } from "@haza-aios/ui/components/button";
import { LogoMark } from "@haza-aios/ui/components/logo-mark";
import { NavItem, Navbar } from "@haza-aios/ui/components/navbar";

const navItems = ["Products", "Solutions", "Industries", "Resources", "Pricing", "Company"];

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <Navbar className="mt-4 mb-2 rounded-full border border-white/10 bg-slate-900/70 p-3 shadow-[0_18px_45px_rgba(10,16,28,0.35)]">
          <div className="flex items-center gap-3">
            <LogoMark size="sm" />
            <span className="text-lg font-semibold tracking-[-0.04em] text-white">HAZA AIOS</span>
          </div>

          <nav aria-label="Main navigation" className="hidden items-center gap-6 lg:flex">
            {navItems.map((item) => (
              <NavItem key={item} href="#" className="text-sm text-slate-300 hover:text-white">
                {item}
              </NavItem>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
              Sign In
            </Button>
            <Button variant="primary" size="sm" className="rounded-full px-4">
              Request Demo
            </Button>
          </div>
        </Navbar>
      </div>
    </header>
  );
}

export { Header };
