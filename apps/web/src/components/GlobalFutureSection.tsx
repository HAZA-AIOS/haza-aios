import { Badge } from "@haza-aios/ui/components/badge";
import { Button } from "@haza-aios/ui/components/button";
import { Card } from "@haza-aios/ui/components/card";
import { SectionHeading } from "@haza-aios/ui/components/section-heading";

const globalPoints = [
  "Cross-border coordination",
  "Language-ready experiences",
  "Secure governance at scale",
  "Operational continuity",
];

function GlobalFutureSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div data-aos="fade-right">
            <SectionHeading
              eyebrow="Global future"
              title="Operate across regions with clarity and control."
              description="HAZA AIOS helps organizations unify teams, processes, and information across locations while maintaining security, policy alignment, and operational consistency."
            />

            <div className="mt-8 space-y-4">
              {globalPoints.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-sm text-emerald-300">
                    ✓
                  </span>
                  <span className="text-slate-200">{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button className="rounded-full px-6">Request a walkthrough</Button>
              <Button variant="ghost" className="rounded-full px-6">
                Learn more
              </Button>
            </div>
          </div>

          <div data-aos="fade-left" className="relative">
            <Card className="relative overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(86,106,255,0.18),_transparent_45%),linear-gradient(135deg,#0f172a,#111827_55%,#0b1120)] p-6">
              <div className="absolute inset-0 [background-image:radial-gradient(circle_at_center,rgba(29,78,216,0.16),transparent_55%)] opacity-70" />
              <div className="relative rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-6">
                <div className="mb-6 flex items-center justify-between">
                  <Badge variant="primary">Global operations</Badge>
                  <span className="text-sm text-slate-300">Placeholder map</span>
                </div>

                <div className="flex h-[320px] items-center justify-center rounded-[1.5rem] border border-dashed border-indigo-400/40 bg-[radial-gradient(circle,_rgba(99,102,241,0.16),transparent_60%)] text-center text-slate-300">
                  <div>
                    <p className="text-xs tracking-[0.14em] text-slate-400 uppercase">
                      Multilingual
                    </p>
                    <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
                      Worldwide delivery
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

export { GlobalFutureSection };
