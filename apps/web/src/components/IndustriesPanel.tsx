import { Badge } from "@haza-aios/ui/components/badge";
import { Card } from "@haza-aios/ui/components/card";

const industries = [
  "Healthcare",
  "Education",
  "Government",
  "Corporate",
  "Operations",
  "Public Sector",
];

function IndustriesPanel() {
  return (
    <Card className="relative overflow-hidden border border-white/10 bg-slate-900/80 p-5 shadow-[0_30px_80px_rgba(59,130,246,0.16)] backdrop-blur-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(127,123,255,0.22),_transparent_45%)]" />
      <div className="relative">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-label text-slate-400">Industries We Serve</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
              Built for complex teams.
            </h3>
          </div>
          <Badge variant="primary">AI Ready</Badge>
        </div>

        <div className="space-y-3">
          {industries.map((item, index) => (
            <div
              key={item}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              data-aos="fade-left"
              data-aos-delay={index * 70}
            >
              <span className="text-sm font-medium text-slate-200">{item}</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-indigo-400/40 bg-indigo-500/10 text-xs text-indigo-200">
                {index + 1}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export { IndustriesPanel };
