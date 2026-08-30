import { Card } from "@haza-aios/ui/components/card";

const capabilityItems = [
  {
    title: "AI Assistants",
    description: "Contextual helpers for teams, operations, and customer experience.",
  },
  {
    title: "Workflow Automation",
    description: "Automate routing, approvals, and operational decisions with less friction.",
  },
  {
    title: "Data & Analytics",
    description: "Turn datasets into accessible insight for better decisions and reporting.",
  },
  {
    title: "Communication Hub",
    description: "Coordinate messages, updates, and internal collaboration in one place.",
  },
  {
    title: "Document Management",
    description: "Organize, index, and retrieve essential records across the organization.",
  },
  {
    title: "Integration & APIs",
    description: "Connect systems and services securely through an extensible platform layer.",
  },
];

function CapabilitiesSection() {
  return (
    <section id="products" className="py-4">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div data-aos="fade-up" className="mb-12">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-500/50 bg-[#061c16] px-4 py-1 text-sm text-green-500 font-semibold mb-6 tracking-wide uppercase">
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.24V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
              </svg>
              CAPABILITIES
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-5xl font-extrabold tracking-tight text-white mb-6">
              Powerful <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">capabilities</span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Designed to simplify the work that slows teams down while accelerating decisions, collaboration, and execution.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {capabilityItems.map((item, index) => {
            const colors = [
              "from-green-400 to-emerald-600",
              "from-indigo-500 to-purple-600",
              "from-rose-500 to-pink-600",
              "from-amber-400 to-orange-600",
              "from-cyan-400 to-blue-600",
              "from-violet-500 to-fuchsia-600"
            ];
            
            const shapes = [
              "rounded-[40px]", // Rounded Square
              "rounded-full",   // Circle
              "rotate-45 rounded-xl"       // Diamond
            ];

            const currentShape = shapes[index % shapes.length];
            const isDiamond = currentShape.includes("rotate-45");

            return (
              <Card
                key={item.title}
                className="group relative overflow-hidden border-none bg-[#0a0a0f] min-h-[320px] p-0 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center rounded-sm"
                data-aos="fade-up"
                data-aos-delay={index * 60}
              >
                {/* Background glowing waves simulation */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] opacity-[0.25] blur-[60px] rounded-full bg-gradient-to-br ${colors[index % colors.length]} transition-opacity duration-500 group-hover:opacity-40`} />
                <div className="absolute inset-0 opacity-[0.15] bg-[repeating-radial-gradient(ellipse_at_center,transparent_0,transparent_5px,#fff_6px,#fff_7px)] scale-[2] transition-transform duration-[30s] group-hover:scale-[2.2] group-hover:rotate-6" />
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/90 via-transparent to-[#0a0a0f]/90 z-0" />
                
                {/* Top Left Dots & Text */}
                <div className="absolute top-4 left-4 flex flex-col gap-1 z-20">
                  <div className="w-1 h-1 bg-white/70 rounded-full shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
                  <div className="w-1 h-1 bg-white/70 rounded-full shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
                  <div className="w-1 h-1 bg-white/70 rounded-full shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
                  <span className="text-[6px] text-white/50 tracking-[0.3em] uppercase mt-2">HAZA AIOS</span>
                </div>

                {/* Top Right Pill (Badge) */}
                <div className="absolute top-4 right-4 flex flex-col items-end z-20">
                  <span className="text-[6px] text-white/50 tracking-[0.2em] uppercase mb-1">INDEX</span>
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br ${colors[index % colors.length]} shadow-[0_5px_10px_rgba(0,0,0,0.5)] border border-white/20 backdrop-blur-md`}>
                    <span className="text-white font-bold text-[10px] drop-shadow-md">{`0${index + 1}`}</span>
                  </div>
                </div>

                {/* Right Edge Rotated Text */}
                <div className="absolute -right-4 top-1/2 -translate-y-1/2 -rotate-90 origin-center opacity-30 z-20">
                  <span className="text-[6px] tracking-[0.4em] text-white uppercase whitespace-nowrap">FEATURE</span>
                </div>

                {/* Center Geometric Shape */}
                <div className={`relative flex items-center justify-center w-[140px] h-[140px] border border-white/20 z-10 transition-transform duration-700 group-hover:border-white/40 group-hover:scale-105 shadow-[0_0_20px_rgba(0,0,0,0.3)] bg-black/10 backdrop-blur-[2px] ${currentShape}`}>
                  <div className={`absolute inset-0 flex flex-col items-center justify-center p-3 text-center ${isDiamond ? '-rotate-45' : ''}`}>
                    <h3 className="text-lg font-bold text-white leading-[1.1] tracking-tight uppercase mb-1 drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)]">
                      {item.title.split(' ').map((word, i) => (
                        <span key={i} className={i === 0 ? "block text-white" : "block text-white/90"}>{word}</span>
                      ))}
                    </h3>
                  </div>
                </div>

                {/* Bottom Text / Description */}
                <div className="absolute bottom-8 left-0 right-0 px-10 text-center z-20 flex flex-col items-center justify-center">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-[1px] w-4 bg-white/20" />
                    <span className="text-[8px] text-white/40 tracking-[0.3em] uppercase">OVERVIEW</span>
                    <div className="h-[1px] w-4 bg-white/20" />
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed font-light tracking-wide max-w-[200px] mx-auto">
                    {item.description}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export { CapabilitiesSection };
