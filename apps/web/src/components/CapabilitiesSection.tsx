import { Card, CardContent, CardHeader, CardTitle } from "@haza-aios/ui/components/card";
import { IconBadge } from "@haza-aios/ui/components/icon-badge";
import { SectionHeading } from "@haza-aios/ui/components/section-heading";

const capabilityItems = [
  {
    title: "AI Assistants",
    description: "Contextual helpers for teams, operations, and customer experience.",
  },
  {
    title: "Workflow Automation",
    description: "Automate routing, approvals, and operational decisions with less friction.",
  },
  {
    title: "Data & Analytics",
    description: "Turn datasets into accessible insight for better decisions and reporting.",
  },
  {
    title: "Communication Hub",
    description: "Coordinate messages, updates, and internal collaboration in one place.",
  },
  {
    title: "Document Management",
    description: "Organize, index, and retrieve essential records across the organization.",
  },
  {
    title: "Integration & APIs",
    description: "Connect systems and services securely through an extensible platform layer.",
  },
];

function CapabilitiesSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div data-aos="fade-up" className="mb-12">
          <SectionHeading
            eyebrow="Capabilities"
            title="Powerful capabilities"
            description="Designed to simplify the work that slows teams down while accelerating decisions, collaboration, and execution."
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {capabilityItems.map((item, index) => (
            <Card
              key={item.title}
              className="border border-white/10 bg-slate-900/70 p-6 transition-all duration-300 hover:border-indigo-400/30 hover:bg-slate-900"
              data-aos="fade-up"
              data-aos-delay={index * 60}
            >
              <CardHeader className="p-0">
                <IconBadge className="mb-5 bg-indigo-500/10 text-indigo-200">{index + 1}</IconBadge>
                <CardTitle className="text-2xl text-white">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="mt-4 p-0">
                <p className="text-base leading-7 text-slate-300">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export { CapabilitiesSection };
