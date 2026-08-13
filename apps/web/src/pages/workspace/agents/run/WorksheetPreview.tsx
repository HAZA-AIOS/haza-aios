import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@haza-aios/ui";
import type { Worksheet } from "@/modules/education/worksheet-service";
import { Download, Save } from "lucide-react";

interface WorksheetPreviewProps {
  worksheet: Worksheet;
  onSave?: () => void;
  isSaving?: boolean;
}

export const WorksheetPreview: React.FC<WorksheetPreviewProps> = ({ worksheet, onSave, isSaving }) => {
  const [showAnswers, setShowAnswers] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{worksheet.title}</h2>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge>{worksheet.params.grade}</Badge>
            <Badge>{worksheet.params.subject}</Badge>
            <Badge>{worksheet.params.difficulty}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAnswers(!showAnswers)}>
            {showAnswers ? "Hide Answers" : "Show Answers"}
          </Button>
          {onSave && (
            <Button onClick={onSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Worksheet"}
            </Button>
          )}
        </div>
      </div>

      {worksheet.params.instructions && (
        <Card className="bg-slate-900/50">
          <CardHeader className="py-4">
            <CardTitle className="text-sm text-slate-400 uppercase tracking-wider">Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-200">{worksheet.params.instructions}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {worksheet.questions.map((q, index) => (
          <Card key={q.id || index} className="overflow-hidden">
            <div className="flex">
              <div className="bg-blue-900/20 px-4 py-4 flex items-center justify-center border-r border-slate-800">
                <span className="text-xl font-bold text-blue-400">{q.number || index + 1}</span>
              </div>
              <div className="flex-1 p-4">
                <div className="flex justify-between items-start gap-4 mb-4">
                  <p className="text-lg text-slate-100">{q.question}</p>
                  <Badge variant="secondary" className="shrink-0 text-xs">{q.type.replace(/-/g, " ")}</Badge>
                </div>
                
                {q.type === "multiple-choice" && q.options && (
                  <div className="space-y-2 mt-4 ml-4">
                    {q.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full border border-slate-600 flex items-center justify-center text-xs text-slate-400">
                          {String.fromCharCode(65 + i)}
                        </div>
                        <span className="text-slate-300">{opt}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {(q.type === "open-ended" || q.type === "fill-in-the-blank") && (
                  <div className="mt-4">
                    <div className="h-20 w-full border-b border-dashed border-slate-700"></div>
                  </div>
                )}

                {showAnswers && (
                  <div className="mt-6 p-4 rounded-md bg-green-950/30 border border-green-900/50">
                    <span className="text-xs uppercase tracking-wider text-green-500 font-bold block mb-1">Answer Key</span>
                    <span className="text-green-300">{worksheet.answerKey[q.id || q.number] || q.answer}</span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
