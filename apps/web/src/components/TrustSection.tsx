import { Badge } from "@haza-aios/ui/components/badge";
import { Card } from "@haza-aios/ui/components/card";
import { SectionHeading } from "@haza-aios/ui/components/section-heading";

const logos = ["Northstar", "VisionOne", "Apex", "NovaWorks", "VectorFlow", "Summit"];

function TrustSection() {
  return (
    <section className="py-4">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div data-aos="fade-up" className="mb-12 text-center">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-500/50 bg-[#061c16] px-4 py-1 text-sm text-green-500 font-semibold mb-6 tracking-wide uppercase">
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.24V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
              </svg>
              TRUST
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-5xl font-extrabold tracking-tight text-white mb-6">
              Trusted by innovators <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">worldwide</span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Placeholder partner marks for demonstration only. Replace with approved customer branding when available.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {logos.map((logo, index) => (
            <Card
              key={logo}
              className="flex min-h-[110px] items-center justify-center border border-white/10 bg-slate-900/70 px-4 py-5 text-center text-lg font-semibold tracking-[-0.04em] text-slate-300"
              data-aos="zoom-in"
              data-aos-delay={index * 50}
            >
              <Badge
                variant="default"
                className="border-white/10 bg-slate-950/60 px-3 py-2 text-slate-200"
              >
                {logo}
              </Badge>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export { TrustSection };
