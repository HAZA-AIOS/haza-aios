import { LogoMark } from "@haza-aios/ui/components/logo-mark";

const footerLinks = {
  Platform: ["Overview", "AI Workflows", "Security", "Integrations"],
  Solutions: ["Operations", "Healthcare", "Education", "Government"],
  Resources: ["Documentation", "Case Studies", "Blog", "Support"],
  Company: ["About", "Careers", "Partners", "Contact"],
};

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-950/90">
      <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr]">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <LogoMark size="sm" />
              <span className="text-lg font-semibold tracking-[-0.04em] text-white">HAZA AIOS</span>
            </div>
            <p className="max-w-xs text-base leading-7 text-slate-400">
              AI-native operations and governance for organizations that want smarter execution.
            </p>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="mb-4 text-sm font-semibold tracking-[0.1em] text-slate-300 uppercase">
                {title}
              </h3>
              <ul className="space-y-3 text-sm text-slate-400">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="transition-colors hover:text-white">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 HAZA AIOS. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <a href="#" className="hover:text-white">
              Privacy
            </a>
            <a href="#" className="hover:text-white">
              Terms
            </a>
            <a href="#" className="hover:text-white">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export { Footer };
