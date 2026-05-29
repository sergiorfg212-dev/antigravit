import { useState } from "react";
import { useAppStore } from "../../hooks/useAppStore";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { 
  FileText, 
  CheckCircle2,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { FinalReportGenerator } from "./FinalReportGenerator";
import { ReportBuilder } from "./ReportBuilder";
import { ExportManager } from "./ExportManager";
import { cn } from "../../lib/utils";

export function ReportsModule() {
  const { currentCompanyId } = useAppStore();

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100">
               <FileText className="w-6 h-6 text-white" />
             </div>
             Reporte Maestro NOM-030
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Generación de diagnóstico integral y programa de seguridad</p>
        </div>
      </header>

      <FinalReportGenerator />
    </div>
  );
}

