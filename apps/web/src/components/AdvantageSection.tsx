import { Card, CardContent, CardHeader, CardTitle } from "@haza-aios/ui/components/card";
import { IconBadge } from "@haza-aios/ui/components/icon-badge";
import { SectionHeading } from "@haza-aios/ui/components/section-heading";

const advantageItems = [
  {
    title: "All-in-One Platform",
    description:
      "Manage operations, knowledge, workflows, and user experiences from a single, governed layer.",
    icon: "◈",
  },
  {
    title: "Built for Any Industry",
    description:
      "Customize the same operating system for education, healthcare, public services, and enterprise teams.",
    icon: "◎",
  },
  {
    title: "AI at the Core",
    description:
      "Embed intelligence into every workflow so decisions are faster, safer, and more actionable.",
    icon: "✦",
  },
  {
    title: "Secure & Compliant",
    description:
      "Protect sensitive data with enterprise governance, policy controls, and confidence by design.",
    icon: "▣",
  },
];

function AdvantageSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div data-aos="fade-up" className="mb-12">
          <SectionHeading
            eyebrow="The advantage"
            title="The HAZA AIOS advantage"
            description="A unified, cross-functional operating layer designed for modern organizations that need speed, visibility, and governance."
            align="center"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {advantageItems.map((item, index) => (
            <Card
              key={item.title}
              className="group border-white/10 bg-slate-900/70 p-6 transition-transform duration-300 hover:-translate-y-1 hover:border-indigo-400/40"
              data-aos="fade-up"
              data-aos-delay={index * 80}
            >
              <CardHeader className="p-0">
                <IconBadge className="mb-5 bg-indigo-500/10 text-indigo-200">{item.icon}</IconBadge>
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

export { AdvantageSection };
