import React, { useState, useEffect } from "react";
import { Card, CardContent, Button, Badge } from "@haza-aios/ui";
import { useOrganization } from "@/org/use-organization";
import { Link } from "@/routes/router";
import { AppShell } from "@/components/AppShell";
import { BookOpen, Calendar, Clock, GraduationCap, Layers, Hash, ArrowLeft, ChevronRight } from "lucide-react";
import { AcademicService } from "@/modules/education/sis/academic.service";
import type { AcademicYear } from "@/modules/education/sis/sis.types";

export const AcademicOverviewPage: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [stats, setStats] = useState({ years: 0, terms: 0, classes: 0, sections: 0, subjects: 0 });

  useEffect(() => {
    if (currentOrganization) {
      const loadStats = async () => {
        const years = await AcademicService.getAcademicYears(currentOrganization.id);
        const active = years.find(y => y.status === "active") || null;
        setActiveYear(active);
        
        const terms = await AcademicService.getTerms(currentOrganization.id);
        const classes = await AcademicService.getGrades(currentOrganization.id);
        const sections = await AcademicService.getSections(currentOrganization.id);
        const subjects = await AcademicService.getSubjects(currentOrganization.id);
        
        setStats({
          years: years.length,
          terms: terms.length,
          classes: classes.length,
          sections: sections.length,
          subjects: subjects.length
        });
      };
      loadStats();
    }
  }, [currentOrganization]);

  const sections = [
    { name: "Academic Years", icon: <Calendar className="w-8 h-8 text-blue-500" />, desc: "Manage academic cycles and terms", link: "/workspace/education/academic/years", count: stats.years },
    { name: "Terms & Semesters", icon: <Clock className="w-8 h-8 text-teal-500" />, desc: "Configure specific grading periods", link: "/workspace/education/academic/terms", count: stats.terms },
    { name: "Grades / Classes", icon: <Layers className="w-8 h-8 text-purple-500" />, desc: "Setup grade levels (e.g. Grade 1, Year 10)", link: "/workspace/education/academic/classes", count: stats.classes },
    { name: "Sections", icon: <Hash className="w-8 h-8 text-pink-500" />, desc: "Divide classes into logical groups (A, B)", link: "/workspace/education/academic/sections", count: stats.sections },
    { name: "Subjects", icon: <BookOpen className="w-8 h-8 text-orange-500" />, desc: "Master list of all taught courses", link: "/workspace/education/academic/subjects", count: stats.subjects },
  ];

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/workspace" className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <span className="p-2 bg-blue-500/10 rounded-lg"><Calendar className="w-8 h-8 text-blue-500" /></span> 
                Academic Structure
              </h1>
              <p className="text-slate-400 mt-2 text-lg">Define and manage the foundational academic framework.</p>
            </div>
          </div>
        </div>

        {/* Active Year Banner */}
        <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/20 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="default" className="bg-blue-500/20 text-blue-300 border-blue-500/30">Active Academic Year</Badge>
              </div>
              <h2 className="text-2xl font-bold text-white">
                {activeYear ? activeYear.name : "No Active Year Set"}
              </h2>
              {activeYear && (
                <p className="text-slate-300 mt-1">
                  {new Date(activeYear.startDate).toLocaleDateString()} — {new Date(activeYear.endDate).toLocaleDateString()}
                </p>
              )}
            </div>
            <Link to="/workspace/education/academic/years">
              <Button variant="outline" className="border-blue-500/30 hover:bg-blue-500/10 text-blue-300">
                Manage Years
              </Button>
            </Link>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((sec, i) => (
            <Link to={sec.link} key={i}>
              <Card className="bg-[#0f141f] border-white/5 hover:border-white/20 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:-translate-y-1 h-full cursor-pointer group">
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-white/5 rounded-xl group-hover:scale-110 transition-transform duration-300">
                      {sec.icon}
                    </div>
                    <Badge variant="secondary" className="bg-white/5 text-slate-300 font-mono">
                      {sec.count}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{sec.name}</h3>
                  <p className="text-slate-400 text-sm flex-1">{sec.desc}</p>
                  
                  <div className="mt-6 flex items-center text-sm font-medium text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0 duration-300">
                    Manage <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

      </div>
    </AppShell>
  );
};
