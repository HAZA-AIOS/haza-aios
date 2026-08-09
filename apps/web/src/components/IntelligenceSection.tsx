import { motion } from "framer-motion";

import { FeatureCard } from "@haza-aios/ui/components/feature-card";
import { SectionHeading } from "@haza-aios/ui/components/section-heading";

const items = [
  {
    title: "AI-Driven Intelligence",
    description:
      "Turn fragmented signals into contextual actions with predictive guidance and AI copilots.",
    icon: "AI",
  },
  {
    title: "Unified Operations",
    description:
      "Bring people, processes, data, and systems together into one decision-ready operating layer.",
    icon: "UO",
  },
  {
    title: "Automation at Scale",
    description:
      "Streamline repetition, approvals, and handoffs with resilient workflows across the enterprise.",
    icon: "AS",
  },
  {
    title: "Better Experiences",
    description:
      "Create faster, safer, and more human-centered digital experiences for every stakeholder.",
    icon: "BX",
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

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
            >
              <FeatureCard
                icon={<span className="text-base font-bold">{item.icon}</span>}
                title={item.title}
                description={item.description}
                className="h-full min-h-[220px] border-white/10 bg-slate-900/70"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export { IntelligenceSection };
