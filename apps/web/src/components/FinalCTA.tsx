import { Button } from "@haza-aios/ui/components/button";
import { Card } from "@haza-aios/ui/components/card";

const stats = [
  { value: "24/7", label: "AI operations" },
  { value: "3x", label: "faster execution" },
  { value: "99%", label: "placeholder coverage" },
];

function FinalCTA() {
  return (
    <section className="pt-10 pb-20">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden border border-indigo-400/20 bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.18),_transparent_30%),linear-gradient(180deg,#0b1220,#101827)] p-8 sm:p-10 lg:p-12">
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-label text-indigo-200">Ready to transform?</p>
              <h2 className="mt-4 text-4xl font-black tracking-[-0.06em] text-white sm:text-5xl">
                Ready to transform your organization?
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
                Replace fragmented systems with a single operating layer designed for speed,
                resilience, and intelligent growth.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button className="rounded-full px-6">Schedule a demo</Button>
                <Button variant="secondary" className="rounded-full px-6">
                  Talk to sales
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-center"
                  >
                    <p className="text-2xl font-semibold text-white">{stat.value}</p>
                    <p className="mt-1 text-xs tracking-[0.1em] text-slate-400 uppercase">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

export { FinalCTA };
