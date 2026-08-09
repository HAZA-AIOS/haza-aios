import { Badge } from "@haza-aios/ui/components/badge";
import { Card, CardContent } from "@haza-aios/ui/components/card";
import { SectionHeading } from "@haza-aios/ui/components/section-heading";

const industries = [
  {
    name: "Education",
    description:
      "Digital experiences, academic operations, and student engagement across campuses.",
  },
  {
    name: "Healthcare",
    description: "Safer care delivery, workflow continuity, and operational insight for providers.",
  },
  {
    name: "Corporate",
    description: "Connected teams, cross-functional execution, and accelerated strategic delivery.",
  },
  {
    name: "Government",
    description: "Secure modernization, policy alignment, and service delivery at public scale.",
  },
  {
    name: "Public Sector",
    description: "Better resilience, coordination, and accountability for critical services.",
  },
  {
    name: "Operations",
    description: "AI-powered orchestration for shared services, planning, and transformation.",
  },
];

function IndustryShowcase() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div data-aos="fade-up" className="mb-12">
          <SectionHeading
            eyebrow="Industries"
            title="Where organizations thrive"
            description="HAZA AIOS is designed for teams navigating complexity, modernization, and growing operational demands."
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {industries.map((industry, index) => (
            <Card
              key={industry.name}
              className="group overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(9,13,22,0.9))] p-0 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400/40"
              data-aos="fade-up"
              data-aos-delay={index * 60}
            >
              <div className="h-40 bg-[radial-gradient(circle_at_top,_rgba(118,143,255,0.35),_transparent_40%),linear-gradient(135deg,#0f172a,#1e293b_52%,#0b1120)]" />
              <CardContent className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <Badge variant="accent">{industry.name}</Badge>
                  <span className="text-xs tracking-[0.12em] text-slate-400 uppercase">
                    Case-ready
                  </span>
                </div>
                <p className="text-base leading-7 text-slate-300">{industry.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export { IndustryShowcase };
