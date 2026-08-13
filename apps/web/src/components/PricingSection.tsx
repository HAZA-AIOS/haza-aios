import React from "react";
import { Button } from "@haza-aios/ui/components/button";

export function PricingSection() {
  return (
    <section id="pricing" className="py-4 relative overflow-hidden bg-slate-950">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-green-500/50 bg-[#061c16] px-4 py-1 text-sm text-green-500 font-semibold mb-6 tracking-wide">
            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.24V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
            </svg>
            PRICING PLANS
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-5xl font-extrabold tracking-tight text-white mb-6">
            Flexible Plans for <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">Every Business</span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Choose a plan that fits your goals. All plans include our commitment to quality, performance, and long-term partnership in scaling your AI operations.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 items-center max-w-6xl mx-auto">
          {/* Basic Plan */}
          <div className="relative p-8 rounded-2xl bg-slate-900 border border-white/5 hover:border-white/10 transition-colors shadow-2xl flex flex-col h-full">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Starter</h3>
                <p className="text-sm text-slate-400">Perfect for small teams and startups</p>
              </div>
            </div>
            
            <div className="mb-8">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">$499</span>
                <span className="text-slate-400 text-sm">/ month</span>
              </div>
            </div>

            <div className="space-y-4 mb-8 flex-1">
              <FeatureItem>Up to 5 Active Agents</FeatureItem>
              <FeatureItem>Basic Agent Builder</FeatureItem>
              <FeatureItem>500,000 Model Tokens / mo</FeatureItem>
              <FeatureItem>1 Organization Workspace</FeatureItem>
              <FeatureItem>Standard Community Support</FeatureItem>
            </div>

            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-6 text-md font-semibold">
              Get Started
              <svg className="ml-2 size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Button>
          </div>

          {/* Standard Plan (Most Popular) */}
          <div className="relative p-8 rounded-2xl bg-slate-900 border border-green-500/50 shadow-[0_0_40px_rgba(34,197,94,0.15)] flex flex-col h-full transform md:-translate-y-4">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
              Most Popular
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/30 text-green-400">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Professional</h3>
                <p className="text-sm text-slate-400">Ideal for growing organizations</p>
              </div>
            </div>
            
            <div className="mb-8">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">$999</span>
                <span className="text-slate-400 text-sm">/ month</span>
              </div>
            </div>

            <div className="space-y-4 mb-8 flex-1">
              <FeatureItem>Up to 20 Active Agents</FeatureItem>
              <FeatureItem>Advanced Builder & Workflows</FeatureItem>
              <FeatureItem>2,000,000 Model Tokens / mo</FeatureItem>
              <FeatureItem>3 Organization Workspaces</FeatureItem>
              <FeatureItem>Custom Industry Modules</FeatureItem>
              <FeatureItem>Priority Email & Chat Support</FeatureItem>
            </div>

            <Button className="w-full bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-slate-950 rounded-xl py-6 text-md font-bold shadow-lg shadow-green-500/20 border-0">
              Get Started
              <svg className="ml-2 size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Button>
          </div>

          {/* Premium Plan */}
          <div className="relative p-8 rounded-2xl bg-slate-900 border border-white/5 hover:border-white/10 transition-colors shadow-2xl flex flex-col h-full">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Enterprise</h3>
                <p className="text-sm text-slate-400">For operations that demand the best</p>
              </div>
            </div>
            
            <div className="mb-8">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">$2,499</span>
                <span className="text-slate-400 text-sm">/ month</span>
              </div>
            </div>

            <div className="space-y-4 mb-8 flex-1">
              <FeatureItem>Unlimited Active Agents</FeatureItem>
              <FeatureItem>Dedicated Backend Resources</FeatureItem>
              <FeatureItem>Unlimited Model Tokens</FeatureItem>
              <FeatureItem>Unlimited Workspaces</FeatureItem>
              <FeatureItem>Custom Agent Development</FeatureItem>
              <FeatureItem>24/7 Phone & SLA Support</FeatureItem>
            </div>

            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-6 text-md font-semibold">
              Get Started
              <svg className="ml-2 size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Button>
          </div>

        </div>
      </div>
    </section>
  );
}

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 bg-green-500/20 text-green-400 rounded-full p-0.5 shrink-0">
        <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <span className="text-sm text-slate-300">{children}</span>
    </div>
  );
}
