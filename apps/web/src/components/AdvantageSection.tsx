import { SectionHeading } from "@haza-aios/ui/components/section-heading";

const advantageItems = [
  {
    title: "All-in-One Platform",
    description:
      "Manage operations, knowledge, workflows, and user experiences from a single, governed layer.",
    icon: "◈",
    badge: "$100",
    theme: {
      accent: "#00f0ff",
      glow: "rgba(0, 240, 255, 0.4)",
      badgeBg: "#00f0ff",
      badgeText: "#030712",
      line: "#00f0ff",
      btnBg: "#00f0ff",
      btnText: "#030712",
    },
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80",
    rightFeatures: [
      { title: "UNIFIED HUB", text: "All systems in 1 layer" },
      { title: "CENTRAL ACCESS", text: "Single sign-on control" },
      { title: "REAL-TIME SYNC", text: "Instant data updates" },
    ],
  },
  {
    title: "Built for Any Industry",
    description:
      "Customize the same operating system for education, healthcare, public services, and enterprise teams.",
    icon: "◎",
    badge: "$100",
    theme: {
      accent: "#e056fd",
      glow: "rgba(224, 86, 253, 0.4)",
      badgeBg: "#e056fd",
      badgeText: "#030712",
      line: "#e056fd",
      btnBg: "#e056fd",
      btnText: "#030712",
    },
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
    rightFeatures: [
      { title: "CUSTOM MODULES", text: "Education & Health" },
      { title: "PUBLIC SECTOR", text: "Compliant & secure" },
      { title: "ENTERPRISE", text: "Scalable architecture" },
    ],
  },
  {
    title: "AI at the Core",
    description:
      "Embed intelligence into every workflow so decisions are faster, safer, and more actionable.",
    icon: "✦",
    badge: "$100",
    theme: {
      accent: "#ff6b00",
      glow: "rgba(255, 107, 0, 0.4)",
      badgeBg: "#ff6b00",
      badgeText: "#030712",
      line: "#ff6b00",
      btnBg: "#ff6b00",
      btnText: "#030712",
    },
    image:
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=600&q=80",
    rightFeatures: [
      { title: "PREDICTIVE AI", text: "Contextual guidance" },
      { title: "COPILOT AGENTS", text: "Autonomous workflows" },
      { title: "SMART INSIGHTS", text: "Instant clarity" },
    ],
  },
  {
    title: "Secure & Compliant",
    description:
      "Protect sensitive data with enterprise governance, policy controls, and confidence by design.",
    icon: "▣",
    badge: "$100",
    theme: {
      accent: "#10b981",
      glow: "rgba(16, 185, 129, 0.4)",
      badgeBg: "#10b981",
      badgeText: "#030712",
      line: "#10b981",
      btnBg: "#10b981",
      btnText: "#030712",
    },
    image:
      "https://images.unsplash.com/photo-1563770660941-20978e870e26?auto=format&fit=crop&w=600&q=80",
    rightFeatures: [
      { title: "ENTERPRISE SHIELD", text: "Bank-grade security" },
      { title: "POLICY CONTROL", text: "Strict governance" },
      { title: "AUDIT TRAILS", text: "100% visible logs" },
    ],
  },
];

function AdvantageSection() {
  return (
    <section id="resources" className="py-4">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div data-aos="fade-up" className="mb-12">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-500/50 bg-[#061c16] px-4 py-1 text-sm text-green-500 font-semibold mb-6 tracking-wide uppercase">
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.24V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
              </svg>
              THE ADVANTAGE
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-5xl font-extrabold tracking-tight text-white mb-6">
              The HAZA AIOS <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">advantage</span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              A unified, cross-functional operating layer designed for modern organizations that need speed, visibility, and governance.
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {advantageItems.map((item, index) => (
            <div
              key={item.title}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#0d1017] shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              data-aos="fade-up"
              data-aos-delay={index * 80}
            >
              {/* Top Graphic Banner with Glow */}
              <div
                className="relative flex h-60 w-full items-center justify-center overflow-hidden bg-slate-950 p-4"
                style={{
                  background: `radial-gradient(circle at center, ${item.theme.glow} 0%, rgba(3, 7, 18, 0.95) 70%)`,
                }}
              >
                {/* Decorative Wavy Lines and Ring Accents */}
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full opacity-35"
                  viewBox="0 0 200 200"
                >
                  <path
                    d="M 10,25 Q 35,5 60,25 T 110,25"
                    fill="none"
                    stroke={item.theme.accent}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 100,165 Q 125,145 150,165 T 195,165"
                    fill="none"
                    stroke={item.theme.accent}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="25"
                    cy="145"
                    r="12"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3.5"
                    opacity="0.25"
                  />
                  <circle
                    cx="175"
                    cy="45"
                    r="14"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3.5"
                    opacity="0.25"
                  />
                </svg>

                {/* Top-Right Badge */}
                <div
                  className="absolute top-3 right-3 rounded-md px-2.5 py-1 text-[11px] font-black tracking-wider shadow-md"
                  style={{
                    backgroundColor: item.theme.badgeBg,
                    color: item.theme.badgeText,
                  }}
                >
                  {item.badge}
                </div>

                {/* Center Hero Image */}
                <div className="relative z-10 flex h-36 w-36 items-center justify-center">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-full w-full rounded-2xl object-cover shadow-2xl transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              </div>

              {/* Bottom Dark Content Panel */}
              <div className="flex flex-1 flex-col justify-between bg-[#131722] p-5">
                {/* 2-Column Content Layout */}
                <div className="mb-5 grid grid-cols-2 gap-3">
                  {/* Left Column: Title + Original Description + Stars */}
                  <div className="flex flex-col justify-between pr-1">
                    <div>
                      <h3 className="text-xs font-black tracking-wider text-white uppercase">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                        {item.description}
                      </p>
                    </div>

                    {/* Rating Stars */}
                    <div className="mt-3 flex gap-0.5 text-xs" style={{ color: item.theme.accent }}>
                      ★ ★ ★ ★ <span className="opacity-30">★</span>
                    </div>
                  </div>

                  {/* Right Column: Colored Vertical Line + Sub Features */}
                  <div
                    className="flex flex-col justify-center space-y-2.5 border-l-2 pl-3"
                    style={{ borderColor: item.theme.line }}
                  >
                    {item.rightFeatures.map((feat) => (
                      <div key={feat.title}>
                        <span
                          className="block text-[9px] font-extrabold tracking-wider uppercase"
                          style={{ color: item.theme.accent }}
                        >
                          {feat.title}
                        </span>
                        <span className="block text-[9px] leading-tight text-slate-400">
                          {feat.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export { AdvantageSection };
