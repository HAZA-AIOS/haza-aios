import { motion } from "framer-motion";

import { Badge } from "@haza-aios/ui/components/badge";
import { Button } from "@haza-aios/ui/components/button";
import { GlassCard } from "@haza-aios/ui/components/glass-card";
import { Container } from "@haza-aios/ui/components/container";

const trustPills = ["AI automation", "Security", "Scalability", "Governance"];

function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-8 pb-20 sm:pt-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(128,122,255,0.2),_transparent_30%)]" />
      <Container className="relative">
        <div className="w-full">
          {" "}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <GlassCard className="p-6 sm:p-8 lg:p-10">
              <Badge variant="primary" className="mb-6">
                AI-native operating system
              </Badge>

              <h1 className="max-w-xl text-5xl leading-[0.92] font-black tracking-[-0.07em] text-blue-900 md:text-6xl lg:text-[5rem]">
                Build a smarter
                <span className="block bg-[linear-gradient(135deg,#572756,#c7682a,#c5a7ff)] bg-clip-text text-transparent">
                  organization.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                HAZA AIOS unifies operations, people, data, and intelligent workflows into one
                secure platform for modern organizations.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button className="rounded-xl px-6 py-3 text-base">Request Demo</Button>
                <Button
                  variant="secondary"
                  className="flex items-center gap-2 rounded-xl px-6 py-3 text-base"
                >
                  <span>Explore Solutions</span>
                  <svg
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                {trustPills.map((pill) => (
                  <span
                    key={pill}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium tracking-[0.08em] text-slate-300 uppercase"
                  >
                    {pill}
                  </span>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}

export { HeroSection };
