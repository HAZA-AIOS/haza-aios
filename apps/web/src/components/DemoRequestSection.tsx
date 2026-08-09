import { Badge } from "@haza-aios/ui/components/badge";
import { Button } from "@haza-aios/ui/components/button";
import { Card, CardContent } from "@haza-aios/ui/components/card";
import { Input } from "@haza-aios/ui/components/input";
import { Select } from "@haza-aios/ui/components/select";
import { SectionHeading } from "@haza-aios/ui/components/section-heading";

function DemoRequestSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div data-aos="fade-right">
            <SectionHeading
              eyebrow="Demo request"
              title="See HAZA AIOS in action."
              description="Tell us about your organization and we’ll help map the right AI operating model for your teams."
            />
            <div className="mt-8 rounded-3xl border border-indigo-400/20 bg-indigo-500/5 p-5">
              <p className="text-label text-slate-300">What to expect</p>
              <ul className="mt-4 space-y-3 text-slate-300">
                <li>• Product walkthrough tailored to your environment</li>
                <li>• Use case review across teams and workflows</li>
                <li>• Architecture and security conversation</li>
              </ul>
            </div>
          </div>

          <Card
            className="border border-white/10 bg-slate-900/80 p-6 shadow-[0_30px_80px_rgba(80,82,255,0.14)]"
            data-aos="fade-left"
          >
            <CardContent className="space-y-5 p-0">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-label text-slate-300">Full Name</label>
                  <Input placeholder="Alex Morgan" />
                </div>
                <div className="space-y-2">
                  <label className="text-label text-slate-300">Organization</label>
                  <Input placeholder="Organization / Institution" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-label text-slate-300">Email</label>
                <Input type="email" placeholder="alex@company.com" />
              </div>

              <div className="space-y-2">
                <label className="text-label text-slate-300">Industry</label>
                <Select defaultValue="">
                  <option value="" disabled>
                    Select an industry
                  </option>
                  <option value="education">Education</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="corporate">Corporate</option>
                  <option value="government">Government</option>
                  <option value="public-sector">Public Sector</option>
                </Select>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Badge variant="secondary">Frontend validation only</Badge>
                <Button className="rounded-full px-6">Request Demo</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

export { DemoRequestSection };
