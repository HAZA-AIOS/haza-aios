import { motion } from "framer-motion";

import { Badge } from "@haza-aios/ui/components/badge";
import { Button } from "@haza-aios/ui/components/button";
import { Card, CardContent } from "@haza-aios/ui/components/card";
import { GlassCard } from "@haza-aios/ui/components/glass-card";
import { Container } from "@haza-aios/ui/components/container";
import { IconBadge } from "@haza-aios/ui/components/icon-badge";

import heroImage from "../assets/hero.png";
import { IndustriesPanel } from "./IndustriesPanel";

const trustPills = ["AI automation", "Security", "Scalability", "Governance"];

function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-8 pb-20 sm:pt-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(128,122,255,0.2),_transparent_30%)]" />
      <Container className="relative">
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <GlassCard className="p-6 sm:p-8 lg:p-10">
              <Badge variant="primary" className="mb-6">
                AI-native operating system
              </Badge>

              <h1 className="max-w-xl text-5xl leading-[0.92] font-black tracking-[-0.07em] text-white md:text-6xl lg:text-[5rem]">
                Build a smarter
                <span className="block bg-[linear-gradient(135deg,#8da2ff,#88e0ff,#c5a7ff)] bg-clip-text text-transparent">
                  organization.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                HAZA AIOS unifies operations, people, data, and intelligent workflows into one
                secure platform for modern organizations.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button className="rounded-full px-6 py-3 text-base">Request Demo</Button>
                <Button variant="secondary" className="rounded-full px-6 py-3 text-base">
                  Explore Platform
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

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
            className="relative"
          >
            <Card className="relative overflow-hidden border border-white/10 bg-slate-950/80 p-4 shadow-[0_30px_80px_rgba(72,108,255,0.18)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_45%)]" />
              <div className="relative rounded-[1.75rem] border border-white/10 bg-slate-900/80 p-3">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconBadge size="sm" className="bg-indigo-500/20 text-indigo-200">
                      ✦
                    </IconBadge>
                    <span className="text-sm text-slate-200">AI system overview</span>
                  </div>
                  <Badge variant="success">Live</Badge>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/80 p-3 shadow-inner shadow-indigo-500/10">
                  <img
                    src={heroImage}
                    alt="abstract AI system platform illustration"
                    className="h-auto w-full rounded-[1.25rem] object-cover"
                  />
                </div>

                <CardContent className="mt-4 space-y-3 p-0">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div>
                      <p className="text-xs tracking-[0.08em] text-slate-400 uppercase">
                        Automation
                      </p>
                      <p className="mt-1 text-lg font-semibold text-white">84% faster workflows</p>
                    </div>
                    <span className="text-sm font-medium text-emerald-300">+24%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs tracking-[0.08em] text-slate-400 uppercase">Security</p>
                      <p className="mt-1 text-xl font-semibold text-white">Zero-trust</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs tracking-[0.08em] text-slate-400 uppercase">Scale</p>
                      <p className="mt-1 text-xl font-semibold text-white">Global</p>
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>

            <div className="absolute -bottom-6 -left-6 hidden max-w-[230px] md:block">
              <IndustriesPanel />
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}

export { HeroSection };
