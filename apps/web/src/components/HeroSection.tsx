import { motion } from "framer-motion";

import { Badge } from "@haza-aios/ui/components/badge";
import { Button } from "@haza-aios/ui/components/button";
import { GlassCard } from "@haza-aios/ui/components/glass-card";
import { Container } from "@haza-aios/ui/components/container";

const trustPills = ["AI automation", "Security", "Scalability", "Governance"];

function HeroSection() {
  return (
    <section className="relative overflow-hidden min-h-screen flex bg-[#090b14] pt-24 lg:pt-32">
      {/* Background with Grid/Waves */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 mix-blend-screen"
        style={{ backgroundImage: 'url("/ai_hero_bg.jpg")' }}
      />
      {/* Purple/Pink subtle glow in background like image */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-fuchsia-600/20 via-purple-900/10 to-transparent pointer-events-none" />

      <Container className="relative w-full z-10 flex flex-col lg:flex-row items-start justify-between gap-12">
        
        {/* Left Content Column */}
        <div className="w-full lg:w-1/2 flex flex-col items-start mt-4 lg:mt-8">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="w-full"
          >
            <h1 className="max-w-2xl text-[3.5rem] leading-[1.1] font-bold tracking-tight text-white md:text-6xl lg:text-[4.5rem]">
              Build a smarter
              <span className="block mt-2">organization.</span>
            </h1>

            <p className="mt-8 max-w-xl text-lg leading-relaxed text-slate-300">
              HAZA AIOS unifies operations, people, data, and intelligent workflows into one
              secure platform for modern organizations.
            </p>

            <div className="mt-10">
              <button className="group relative flex items-center gap-4 overflow-hidden rounded-full bg-gradient-to-r from-fuchsia-600 to-purple-600 p-1 pl-6 pr-2 hover:from-fuchsia-500 hover:to-purple-500 transition-all shadow-[0_0_20px_rgba(192,38,211,0.4)]">
                <span className="text-sm font-bold uppercase tracking-widest text-white">
                  Request Demo
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition-transform group-hover:translate-x-1">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>
          </motion.div>
        </div>

        {/* Right Image/Globe Column */}
        <div className="w-full lg:w-1/2 flex justify-center lg:justify-end">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
            className="relative"
          >
            <div className="relative w-[300px] h-[300px] md:w-[450px] md:h-[450px] lg:w-[500px] lg:h-[500px]">
              {/* Globe glow */}
              <div className="absolute inset-0 bg-fuchsia-500/20 blur-[100px] rounded-full" />
              {/* Using hero-globe.jpg but masked as a circle since it's a square JPEG */}
              <img 
                src="/hero-globe.jpg" 
                alt="HAZA AIOS Global Network" 
                className="w-full h-full object-cover mix-blend-screen opacity-90 rounded-full border border-fuchsia-500/20 shadow-[0_0_50px_rgba(192,38,211,0.2)] animate-pulse"
                style={{ animationDuration: '4s' }}
              />
            </div>
          </motion.div>
        </div>

      </Container>

      {/* Bottom decorative elements like the image */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-between items-end px-12 z-10">
        {/* Social Icons (left) */}
        <div className="hidden md:flex gap-6 text-slate-400">
          <svg className="w-5 h-5 hover:text-white cursor-pointer transition-colors" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          <svg className="w-5 h-5 hover:text-white cursor-pointer transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          <svg className="w-5 h-5 hover:text-white cursor-pointer transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>

        {/* Scroll Indicator (center) */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 flex flex-col items-center justify-center animate-bounce">
          <div className="w-[80px] h-[80px] border border-white/20 rounded-full flex items-center justify-center bg-black/20 backdrop-blur-sm cursor-pointer hover:bg-white/10 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
            <div className="absolute inset-0 rounded-full">
              {/* Circular text could go here, simplified to just the icon for now */}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export { HeroSection };
