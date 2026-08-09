import { Badge } from "@haza-aios/ui/components/badge";
import { Card } from "@haza-aios/ui/components/card";
import { SectionHeading } from "@haza-aios/ui/components/section-heading";

const logos = ["Northstar", "VisionOne", "Apex", "NovaWorks", "VectorFlow", "Summit"];

function TrustSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div data-aos="fade-up" className="mb-12 text-center">
          <SectionHeading
            eyebrow="Trust"
            title="Trusted by innovators worldwide"
            description="Placeholder partner marks for demonstration only. Replace with approved customer branding when available."
            align="center"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {logos.map((logo, index) => (
            <Card
              key={logo}
              className="flex min-h-[110px] items-center justify-center border border-white/10 bg-slate-900/70 px-4 py-5 text-center text-lg font-semibold tracking-[-0.04em] text-slate-300"
              data-aos="zoom-in"
              data-aos-delay={index * 50}
            >
              <Badge
                variant="default"
                className="border-white/10 bg-slate-950/60 px-3 py-2 text-slate-200"
              >
                {logo}
              </Badge>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export { TrustSection };
