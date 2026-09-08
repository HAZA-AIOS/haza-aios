import React, { useState, useEffect } from "react";
import { Button, Card, CardContent, Input, Textarea, CardHeader, CardTitle } from "@haza-aios/ui";
import { Runtime } from "@/agents/runtime/AgentRuntime";
import { AgentService } from "@/agents/agent-service";
import { ConversationService } from "@/agents/runtime/conversation/ConversationService";
import type { AgentInstance, ConversationMessage } from "@/agents/agent.types";
import { WorksheetPreview } from "./WorksheetPreview";
import { Loader2 } from "lucide-react";

interface WorksheetCreatorUIProps {
  instance: AgentInstance;
  organizationId: string;
}

export const WorksheetCreatorUI: React.FC<WorksheetCreatorUIProps> = ({
  instance,
  organizationId,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [worksheet, setWorksheet] = useState<any>(null);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [debugContext, setDebugContext] = useState<string | null>(null);

  // Poll for messages if conversation exists
  useEffect(() => {
    let interval: any;
    if (conversationId) {
      interval = setInterval(async () => {
        const msgs = await ConversationService.getMessages(
          conversationId,
          undefined,
          organizationId,
        );
        setMessages(msgs);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [conversationId]);

  const handleSend = async () => {
    if (!input.trim()) return;

    setIsGenerating(true);
    setWorksheet(null);
    setDebugContext(null);
    const currentInput = input;
    setInput("");

    // Optimistically add user message if we already have a conversation
    if (conversationId) {
      setMessages((prev) => [
        ...prev,
        {
          id: "temp",
          conversationId,
          role: "user",
          content: currentInput,
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    try {
      const run = await Runtime.requestExecution(
        {
          agentInstanceId: instance.id,
          organizationId,
          conversationId: conversationId || undefined,
          input: currentInput,
          requestedBy: "current_user",
          executionMode: "manual",
        },
        instance,
        () => AgentService as any,
      );

      if (!conversationId && run.metadata?.conversationId) {
        setConversationId(run.metadata.conversationId);
      }

      let currentRun = run;
      while (["queued", "running", "waiting"].includes(currentRun.status)) {
        await new Promise((r) => setTimeout(r, 1000));
        const runs = await AgentService.getRuns(organizationId, instance.id);
        currentRun = runs.find((r) => r.id === run.id) || currentRun;
      }

      // Fetch actual messages now that it's complete
      if (run.metadata?.conversationId) {
        const msgs = await ConversationService.getMessages(
          run.metadata.conversationId,
          undefined,
          organizationId,
        );
        setMessages(msgs);
      }

      if (currentRun.status === "completed" && currentRun.output) {
        // The mock model returns text. If it looks like JSON, it might be a worksheet.
        try {
          const generatedData = JSON.parse(currentRun.output);
          if (generatedData.questions) {
            // Simple heuristic
            setWorksheet({
              ...generatedData,
              id: `ws-${Date.now()}`,
              organizationId,
              createdBy: "current_user",
              agentInstanceId: instance.id,
              runId: currentRun.id,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            setDebugContext(currentRun.output);
          }
        } catch (e) {
          // Normal chat response
          console.log("Response is standard text, not worksheet JSON.");
        }
      }
    } catch (error) {
      console.error("Execution failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left Chat Panel */}
      <div className="flex flex-col space-y-4 lg:col-span-1">
        <Card className="flex max-h-[600px] min-h-[500px] flex-1 flex-col border-white/5 bg-[#0f141f]">
          <CardHeader className="border-b border-white/5 py-4">
            <CardTitle className="text-lg">Chat & Instruct</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="mt-10 text-center text-slate-500 italic">
                Start by giving instructions, eg:
                <br />
                <br />
                "Remember that I prefer 10-question worksheets"
                <br />
                or
                <br />
                "Create a worksheet about Fractions for Grade 5"
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-3 text-sm ${msg.role === "user" ? "ml-8 bg-blue-900/40 text-blue-100" : "mr-8 bg-slate-800 text-slate-200"}`}
                >
                  <div className="mb-1 text-xs font-semibold tracking-wider uppercase opacity-75">
                    {msg.role}
                  </div>
                  <div className="whitespace-pre-wrap">
                    {/* Hide massive JSON dumps in chat view */}
                    {msg.content.startsWith("{") && msg.content.includes("questions")
                      ? "[Worksheet Generated in Preview]"
                      : msg.content}
                  </div>
                </div>
              ))
            )}
            {isGenerating && (
              <div className="flex items-center gap-2 text-sm text-slate-400 italic">
                <Loader2 className="h-4 w-4 animate-spin" /> Agent is thinking...
              </div>
            )}
          </CardContent>
          <div className="border-t border-white/5 bg-slate-900 p-4">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                disabled={isGenerating}
              />
              <Button onClick={handleSend} disabled={isGenerating || !input.trim()}>
                Send
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Right Preview Panel */}
      <div className="space-y-6 lg:col-span-2">
        {worksheet ? (
          <WorksheetPreview worksheet={worksheet} onSave={() => {}} />
        ) : (
          <Card className="flex min-h-[500px] items-center justify-center border-white/5 bg-[#0f141f]">
            <div className="max-w-sm px-6 text-center text-slate-500">
              <div className="mb-4 text-4xl">📝</div>
              <h3 className="mb-2 text-lg font-medium text-slate-300">No Worksheet Generated</h3>
              <p className="text-sm">
                Instruct the agent in the chat to generate a worksheet. Your preferences will be
                remembered across generations in this session.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
