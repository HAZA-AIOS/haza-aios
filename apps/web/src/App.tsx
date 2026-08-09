import { Badge } from "@haza-aios/ui/components/badge";
import { Button } from "@haza-aios/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@haza-aios/ui/components/card";
import { Checkbox } from "@haza-aios/ui/components/checkbox";
import { FeatureCard } from "@haza-aios/ui/components/feature-card";
import { GlassCard } from "@haza-aios/ui/components/glass-card";
import { Input } from "@haza-aios/ui/components/input";
import { NavItem, Navbar } from "@haza-aios/ui/components/navbar";
import { Select } from "@haza-aios/ui/components/select";
import { Switch } from "@haza-aios/ui/components/switch";
import { Textarea } from "@haza-aios/ui/components/textarea";

function App() {
  return (
    <main className="text-foreground min-h-screen bg-[radial-gradient(circle_at_top,_rgba(118,143,255,0.18),_transparent_30%),linear-gradient(180deg,#07111d_0%,#0b1320_100%)] px-4 py-8">
      <div className="container-haza">
        <Navbar className="mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-haza-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold">
              H
            </div>
            <span className="text-lg font-semibold tracking-[-0.04em]">HAZA AIOS</span>
          </div>
          <div className="hidden items-center gap-6 md:flex">
            <NavItem href="#system" active>
              System
            </NavItem>
            <NavItem href="#tokens">Tokens</NavItem>
            <NavItem href="#components">Components</NavItem>
          </div>
          <Button variant="outline" size="sm">
            Preview
          </Button>
        </Navbar>

        <section className="mb-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <GlassCard className="p-8 md:p-10">
            <Badge variant="primary" className="mb-5">
              Design System
            </Badge>
            <h1 className="text-h1 text-gradient">HAZA AIOS</h1>
            <p className="text-body text-muted-foreground mt-4 max-w-xl">
              Reusable product design primitives for AI-native workflows, built on the shared React
              + Vite + Tailwind + shadcn/ui foundation.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button>Primary Action</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
          </GlassCard>

          <Card className="p-6">
            <CardHeader className="p-0">
              <CardTitle>Core Tokens</CardTitle>
              <CardDescription>Color, spacing, glow, and radius values</CardDescription>
            </CardHeader>
            <CardContent className="mt-6 space-y-3 p-0">
              <div className="border-border bg-card flex items-center justify-between rounded-xl border px-3 py-2">
                <span className="text-muted-foreground text-sm">Primary</span>
                <span className="bg-haza-primary h-4 w-16 rounded-full" />
              </div>
              <div className="border-border bg-card flex items-center justify-between rounded-xl border px-3 py-2">
                <span className="text-muted-foreground text-sm">Accent</span>
                <span className="from-primary to-accent h-4 w-16 rounded-full bg-gradient-to-r" />
              </div>
              <div className="border-border bg-card flex items-center justify-between rounded-xl border px-3 py-2">
                <span className="text-muted-foreground text-sm">Surface</span>
                <span className="bg-card h-4 w-16 rounded-full" />
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="components" className="mb-10 grid gap-6 lg:grid-cols-3">
          <FeatureCard
            icon={<span className="text-lg font-bold">A</span>}
            title="Typography"
            description="Responsive SaaS-grade hierarchy for headings, body, labels and navigation."
          />
          <FeatureCard
            icon={<span className="text-lg font-bold">C</span>}
            title="Color System"
            description="Semantic tokens for surfaces, states, gradients, borders, and product emphasis."
          />
          <FeatureCard
            icon={<span className="text-lg font-bold">M</span>}
            title="Motion"
            description="Lightweight motion conventions designed for SaaS clarity and accessibility."
          />
        </section>

        <section id="tokens" className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-6">
            <CardHeader className="p-0">
              <CardTitle>Form Controls</CardTitle>
              <CardDescription>
                Shared inputs and controls aligned with HAZA styling
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-6 space-y-4 p-0">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-label text-muted-foreground">Name</label>
                  <Input placeholder="Alex Morgan" />
                </div>
                <div className="space-y-2">
                  <label className="text-label text-muted-foreground">Workspace</label>
                  <Select defaultValue="ops">
                    <option value="ops">Operations</option>
                    <option value="ai">AI Studio</option>
                    <option value="finance">Finance</option>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-label text-muted-foreground">Notes</label>
                <Textarea placeholder="Design system notes..." />
              </div>
              <div className="border-border bg-card flex items-center justify-between rounded-xl border p-3">
                <div>
                  <p className="font-medium">AI automation</p>
                  <p className="text-caption">Enable smart assist workflows</p>
                </div>
                <Switch aria-checked={true} className="data-[state=checked]:bg-primary" />
              </div>
              <div className="flex items-center gap-3">
                <Checkbox defaultChecked />
                <span className="text-muted-foreground text-sm">Accept design review updates</span>
              </div>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardHeader className="p-0">
              <CardTitle>Surface Layers</CardTitle>
              <CardDescription>Cards, panels, and elevated UI</CardDescription>
            </CardHeader>
            <CardContent className="mt-6 space-y-4 p-0">
              <GlassCard className="p-4">
                <p className="text-label text-muted-foreground">Glass Panel</p>
                <h3 className="text-h3 mt-2">AI-ready surfaces</h3>
              </GlassCard>
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="p-4">
                  <p className="text-label text-muted-foreground">Stat</p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">94%</p>
                  <p className="text-caption mt-1">UX consistency</p>
                </Card>
                <Card className="p-4">
                  <p className="text-label text-muted-foreground">Status</p>
                  <p className="text-success mt-2 text-3xl font-semibold tracking-[-0.04em]">
                    Live
                  </p>
                  <p className="text-caption mt-1">System health</p>
                </Card>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

export default App;
