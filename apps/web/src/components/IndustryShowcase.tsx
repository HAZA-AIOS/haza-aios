import { Badge } from "@haza-aios/ui/components/badge";
import { Card, CardContent } from "@haza-aios/ui/components/card";
import { SectionHeading } from "@haza-aios/ui/components/section-heading";

const industries = [
  {
    name: "Education",
    description:
      "Digital experiences, academic operations, and student engagement across campuses.",
  },
  {
    name: "Healthcare",
    description: "Safer care delivery, workflow continuity, and operational insight for providers.",
  },
  {
    name: "Corporate",
    description: "Connected teams, cross-functional execution, and accelerated strategic delivery.",
  },
  {
    name: "Government",
    description: "Secure modernization, policy alignment, and service delivery at public scale.",
  },
  {
    name: "Public Sector",
    description: "Better resilience, coordination, and accountability for critical services.",
  },
  {
    name: "Operations",
    description: "AI-powered orchestration for shared services, planning, and transformation.",
  },
];

function IndustryShowcase() {
  return (
    <section id="industries" className="py-4">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div data-aos="fade-up" className="mb-12">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-500/50 bg-[#061c16] px-4 py-1 text-sm text-green-500 font-semibold mb-6 tracking-wide uppercase">
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.24V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
              </svg>
              INDUSTRIES
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-5xl font-extrabold tracking-tight text-white mb-6">
              Where organizations <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">thrive</span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              HAZA AIOS is designed for teams navigating complexity, modernization, and growing operational demands.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {industries.map((industry, index) => {
            const colors = [
              "from-purple-500 to-fuchsia-500",
              "from-blue-500 to-cyan-400",
              "from-amber-400 to-orange-500",
              "from-green-400 to-emerald-500",
              "from-yellow-400 to-amber-500",
              "from-red-500 to-rose-400"
            ];
            
            const bgImages = [
              "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=600&auto=format&fit=crop", // Education
              "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=600&auto=format&fit=crop", // Healthcare
              "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=600&auto=format&fit=crop", // Corporate
              "https://images.unsplash.com/photo-1523292562811-8fa7962ba765?q=80&w=600&auto=format&fit=crop", // Government
              "https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=600&auto=format&fit=crop", // Public Sector
              "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=600&auto=format&fit=crop"  // Operations
            ];

            return (
              <Card
                key={industry.name}
                className="group relative overflow-hidden border-none p-6 h-[280px] flex flex-col justify-between transition-transform duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50"
                data-aos="fade-up"
                data-aos-delay={index * 60}
              >
                {/* Background Image with Overlay */}
                <div 
                  className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url(${bgImages[index % bgImages.length]})` }}
                />
                <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#0a0a0a] via-[#1a1a1a]/80 to-[#1a1a1a]/40 group-hover:via-[#1a1a1a]/70 transition-colors duration-500" />

                <div className="relative z-10 flex justify-between items-start">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[index % colors.length]} flex items-center justify-center shadow-lg backdrop-blur-sm bg-opacity-90`}>
                    <span className="text-white font-bold text-xl">{industry.name.charAt(0)}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-white/80 tracking-wider bg-black/30 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">CASE-READY</span>
                </div>

                <div className="relative z-10 mt-auto pt-8">
                  <p className="text-[11px] text-blue-300 font-medium mb-2 tracking-wide uppercase drop-shadow-md">Industry Focus</p>
                  <h3 className="text-2xl font-bold text-white mb-3 tracking-tight drop-shadow-lg">{industry.name}</h3>
                  <p className="text-sm text-slate-200 leading-relaxed max-w-[95%] drop-shadow-md">{industry.description}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export { IndustryShowcase };
