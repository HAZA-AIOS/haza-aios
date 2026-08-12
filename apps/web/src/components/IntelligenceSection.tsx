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
    <section className="py-20">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div data-aos="fade-up" className="mb-10">
          <SectionHeading
            eyebrow="Operating model"
            title="A smarter way to run everything"
            description="From frontline teams to strategic leadership, HAZA AIOS helps organizations move with speed, trust, and clarity."
            align="center"
          />
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
