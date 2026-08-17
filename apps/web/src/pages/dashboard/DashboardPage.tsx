import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatCard, DashboardCard, AIAssistantWidget, Button } from "@haza-aios/ui";

function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"favorites" | "all">("all");
  const [opMode, setOpMode] = useState<"agent" | "task">("agent");
  const [capacity, setCapacity] = useState("50%");
  const [logs, setLogs] = useState([
    { id: 1, action: "Agent Run", detail: "cognitive-router-v2 initialized", time: "Today", value: "+45.2 GFLOPs" },
    { id: 2, action: "Task Deploy", detail: "education-sync-worker activated", time: "Yesterday", value: "-0.012s latency" },
    { id: 3, action: "Tenant Switch", detail: "Acme Workspace switched", time: "Yesterday", value: "Success" },
  ]);

  const handleAISend = (query: string) => {
    // Mock response trigger
    const newLog = {
      id: Date.now(),
      action: "AI Assistant Query",
      detail: `Processed: "${query}"`,
      time: "Just Now",
      value: "Response OK",
    };
    setLogs((prev) => [newLog, ...prev]);
  };

  return (
    <AppShell>
      <div className="space-y-6 pb-24">
        
        {/* 1. TOP ROW STAT CARDS */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="ACTIVE USERS"
            value="1,248"
            change="+12.4%"
            changeType="positive"
            sparklineData={[10, 12, 11, 15, 14, 18, 20]}
          />
          <StatCard
            title="AI OPERATIONS"
            value="24,130"
            change="+1.2%"
            changeType="positive"
            sparklineData={[15, 13, 14, 18, 16, 22, 24]}
          />
          <StatCard
            title="AUTOMATION TASKS"
            value="8,412"
            change="±0.0%"
            changeType="neutral"
            sparklineData={[8, 9, 8, 8, 9, 8, 8]}
          />
          <StatCard
            title="SYSTEM HEALTH"
            value="99.98%"
            change="+0.02%"
            changeType="positive"
            sparklineData={[20, 20, 20, 20, 20, 20, 20]}
          />
        </div>

        {/* 2. MIDDLE ROW WIDGETS */}
        <div className="grid gap-6 lg:grid-cols-12">
          
          {/* Allocation SVG Donut Chart */}
          <DashboardCard className="lg:col-span-4 flex flex-col justify-between min-h-[360px]">
            <div>
              <h3 className="text-sm font-semibold text-slate-300">AI Operation Allocation</h3>
              <p className="text-xs text-slate-500 mt-0.5">Distribution of telemetry loads</p>
            </div>
            
            <div className="relative flex justify-center py-6">
              <svg className="size-48 transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                {/* Segment 1: Agent Execution (Red) */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#ef4444" strokeWidth="3.2" strokeDasharray="40 60" strokeDashoffset="100" />
                {/* Segment 2: NLP Pipelines (Blue) */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#3b82f6" strokeWidth="3.2" strokeDasharray="30 70" strokeDashoffset="60" />
                {/* Segment 3: RAG Retrieval (Emerald) */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="3.2" strokeDasharray="20 80" strokeDashoffset="30" />
                {/* Segment 4: Cognitive Router (Orange) */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="3.2" strokeDasharray="10 90" strokeDashoffset="10" />
              </svg>
              {/* Center Text label */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <p className="text-[10px] text-slate-400 font-semibold tracking-wider">TOTAL RUNS</p>
                <p className="text-xl font-bold text-white mt-0.5">124.80K</p>
              </div>
            </div>

            {/* Custom Legend */}
            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-red-500 shrink-0"></span>
                <span>Agents (40%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-blue-500 shrink-0"></span>
                <span>NLP (30%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 shrink-0"></span>
                <span>RAG (20%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500 shrink-0"></span>
                <span>Router (10%)</span>
              </div>
            </div>
          </DashboardCard>

          {/* Activity SVG Bar Chart */}
          <DashboardCard className="lg:col-span-5 flex flex-col justify-between min-h-[360px]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-300">AI Operation Activity</h3>
                <p className="text-xs text-slate-500 mt-0.5">Hourly load performance</p>
              </div>
              <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-1 rounded">Last week</span>
            </div>

            {/* Mock Bars */}
            <div className="flex items-end justify-between h-48 px-2 py-4">
              {[60, 45, 75, 90, 80, 55, 65].map((height, i) => (
                <div key={i} className="flex flex-col items-center gap-2 w-full max-w-[20px]">
                  <div className="w-full bg-white/5 rounded-t-sm h-40 flex items-end">
                    <div
                      className="w-full bg-gradient-to-t from-red-500/20 to-red-500 rounded-t-sm transition-all duration-500 hover:opacity-80"
                      style={{ height: `${height}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {["M", "T", "W", "T", "F", "S", "S"][i]}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-white/5 pt-3">
              <span>Peak: 9.42 TFLOPs</span>
              <span>Avg: 6.84 TFLOPs</span>
            </div>
          </DashboardCard>

          {/* Contextual Panel - Trigger Operation Form */}
          <DashboardCard className="lg:col-span-3 flex flex-col justify-between min-h-[360px]">
            <div>
              <h3 className="text-sm font-semibold text-slate-300">Trigger Operation</h3>
              <p className="text-xs text-slate-500 mt-0.5">Dispatch custom actions</p>
            </div>

            {/* Switch Tabs */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-white/5 mt-4">
              <button
                onClick={() => setOpMode("agent")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  opMode === "agent" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Run Agent
              </button>
              <button
                onClick={() => setOpMode("task")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  opMode === "task" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Deploy Task
              </button>
            </div>

            {/* Inputs */}
            <div className="space-y-3 mt-4 flex-1">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Target Resource</label>
                <input
                  type="text"
                  placeholder={opMode === "agent" ? "cognitive-router-v2" : "backup-sync-task"}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500/30"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Capacity Allocation</label>
                {/* Multi-step selector capacity */}
                <div className="grid grid-cols-4 gap-1 text-[10px] text-center font-bold">
                  {["25%", "50%", "75%", "100%"].map((cap) => (
                    <button
                      key={cap}
                      onClick={() => setCapacity(cap)}
                      className={`p-1.5 rounded-lg border transition-all ${
                        capacity === cap
                          ? "bg-red-500/10 border-red-500/30 text-red-500"
                          : "bg-slate-950 border-white/5 text-slate-400 hover:text-white"
                      }`}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button className="w-full mt-4" size="sm">
              Execute {opMode === "agent" ? "Agent" : "Task"}
            </Button>
          </DashboardCard>

        </div>

        {/* 3. BOTTOM ROW LOGS AND DETAILS */}
        <div className="grid gap-6 lg:grid-cols-12">
          
          {/* Active Organizations / Workspaces list */}
          <DashboardCard className="lg:col-span-8">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-300">Active Workspaces</h3>
                <p className="text-xs text-slate-500 mt-0.5">Current tenant isolation spaces</p>
              </div>
              
              <div className="flex rounded-lg bg-slate-950 p-0.5 border border-white/5">
                <button
                  onClick={() => setActiveTab("all")}
                  className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-all ${
                    activeTab === "all" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setActiveTab("favorites")}
                  className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-all ${
                    activeTab === "favorites" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Favorites
                </button>
              </div>
            </div>

            {/* Organizations Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-slate-400 font-semibold">
                    <th className="py-2.5">Workspace</th>
                    <th className="py-2.5">Type</th>
                    <th className="py-2.5">Region</th>
                    <th className="py-2.5 text-right">Telemetry Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-3 font-semibold text-white">The Mentor School</td>
                    <td className="py-3">School</td>
                    <td className="py-3">Pakistan</td>
                    <td className="py-3 text-right text-emerald-400 font-mono">100.0%</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-3 font-semibold text-white">Acme Academy</td>
                    <td className="py-3">School</td>
                    <td className="py-3">United States</td>
                    <td className="py-3 text-right text-emerald-400 font-mono">99.98%</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-3 font-semibold text-white">Global University</td>
                    <td className="py-3">University</td>
                    <td className="py-3">United Kingdom</td>
                    <td className="py-3 text-right text-yellow-400 font-mono">98.40%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </DashboardCard>

          {/* Recent Activity Logs */}
          <DashboardCard className="lg:col-span-4 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-300">Recent System Activity</h3>
              <p className="text-xs text-slate-500 mt-0.5">Real-time system telemetry logs</p>
            </div>

            <div className="space-y-4 my-4 flex-1">
              {logs.map((log) => (
                <div key={log.id} className="flex justify-between items-start gap-4 text-xs border-b border-white/5 pb-2.5 last:border-0 last:pb-0">
                  <div>
                    <p className="font-semibold text-white">{log.action}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{log.detail}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-slate-300 font-semibold">{log.value}</p>
                    <span className="text-[10px] text-slate-500">{log.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </DashboardCard>

        </div>

        {/* 4. FLOATING AI ASSISTANT WIDGET */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full px-4 flex justify-center z-30">
          <AIAssistantWidget onSend={handleAISend} />
        </div>

      </div>
    </AppShell>
  );
}

export { DashboardPage };
export default DashboardPage;
