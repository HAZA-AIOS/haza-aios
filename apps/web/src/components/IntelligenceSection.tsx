import { motion } from "framer-motion";

import { SectionHeading } from "@haza-aios/ui/components/section-heading";

const items = [
  {
    title: "AI-Driven Intelligence",
    description:
      "Turn fragmented signals into contextual actions with predictive guidance and AI copilots.",
    badge: "Popular",
    action: "Explore Now",
    image:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80",
  },
  {
    title: "Unified Operations",
    description:
      "Bring people, processes, data, and systems together into one decision-ready operating layer.",
    badge: "New",
    action: "View Details",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80",
  },
  {
    title: "Automation at Scale",
    description:
      "Streamline repetition, approvals, and handoffs with resilient workflows across the enterprise.",
    badge: "Trending",
    action: "Explore",
    image:
      "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80",
  },
  {
    title: "Better Experiences",
    description:
      "Create faster, safer, and more human-centered digital experiences for every stakeholder.",
    badge: "Featured",
    action: "Get Started",
    image:
      "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=600&q=80",
  },
];

function IntelligenceSection() {
  return (
    <section id="solutions" className="py-4">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div data-aos="fade-up" className="mb-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-500/50 bg-[#061c16] px-4 py-1 text-sm text-green-500 font-semibold mb-6 tracking-wide uppercase">
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.24V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
              </svg>
              OPERATING MODEL
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-5xl font-extrabold tracking-tight text-white mb-6">
              A smarter way to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">run everything</span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              From frontline teams to strategic leadership, HAZA AIOS helps organizations move with speed, trust, and clarity.
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="flex h-full"
            >
              <div className="flex w-full flex-col justify-between overflow-hidden rounded-xl border border-slate-700/80 bg-slate-800 text-white shadow-md transition-shadow duration-300 hover:shadow-xl">
                <div>
                  {/* Top Image Banner */}
                  <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </div>

                  {/* Card Header & Content */}
                  <div className="p-5 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-bold tracking-tight text-white">
                        {item.title}
                      </h3>
                      <span className="inline-flex shrink-0 items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600 ring-1 ring-blue-500/10 ring-inset">
                        {item.badge}
                      </span>
                    </div>

                    <p className="mt-3 text-center text-xs leading-relaxed text-slate-200">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Card Action Button */}
                <div className="p-5 pt-0">
                  <button
                    type="button"
                    className="w-full rounded-lg bg-blue-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 active:scale-[0.99]"
                  >
                    {item.action}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export { IntelligenceSection };
