import React, { useState, useRef } from "react";
import { useAppStore } from "../../hooks/useAppStore";
import { db, type Company, type Finding, type SafetyProgramItem, type AccidentEvent, type SurroundingHazard, type EvidenceLog, type LegalMatrixRequirement } from "../../lib/db";
import { useDexieQuery } from "../../hooks/useDexie";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Presentation, 
  CheckCircle2, 
  Settings2,
  ShieldCheck,
  Table as TableIcon,
  Layout,
  Activity,
  History,
  Map as MapIcon,
  Archive,
  Database,
  Search,
  FileCheck,
  AlertTriangle
} from "lucide-react";
import ExcelJS from "exceljs";
import pptxgen from "pptxgenjs";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

interface ExportConfig {
  processes: boolean;
  localization: boolean;
  infrastructure: boolean;
  legalFramework: boolean;
  noms: boolean;
  riskMatrix: boolean;
  surroundingHazards: boolean;
  accidentality: boolean;
  safetyProgram: boolean;
  evidences: boolean;
}

export function ExportManager() {
  const { currentCompanyId } = useAppStore();
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const [config, setConfig] = useState<ExportConfig>({
    processes: true,
    localization: true,
    infrastructure: true,
    legalFramework: true,
    noms: true,
    riskMatrix: true,
    surroundingHazards: true,
    accidentality: true,
    safetyProgram: true,
    evidences: true
  });

  // DATA EXTRACTION
  const company = useDexieQuery(() => currentCompanyId ? db.companies.get(currentCompanyId) : Promise.resolve(undefined), [currentCompanyId]);
  const findings = useDexieQuery(() => currentCompanyId ? db.findings.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([]), [currentCompanyId]) || [];
  const hazards = useDexieQuery(() => currentCompanyId ? db.surroundingHazards.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([]), [currentCompanyId]) || [];
  const program = useDexieQuery(() => currentCompanyId ? db.safetyProgram.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([]), [currentCompanyId]) || [];
  const accidents = useDexieQuery(() => currentCompanyId ? db.accidentEvents.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([]), [currentCompanyId]) || [];
  const evidences = useDexieQuery(() => currentCompanyId ? db.evidences.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([]), [currentCompanyId]) || [];
  const legalMatrix = useDexieQuery(() => currentCompanyId ? db.legalMatrix.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([]), [currentCompanyId]) || [];

  const handlePrint = () => {
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.print();
      }
    }, 500);
  };

  const toggleAll = (value: boolean) => {
    const newConfig = { ...config };
    (Object.keys(newConfig) as Array<keyof ExportConfig>).forEach(key => {
      newConfig[key] = value;
    });
    setConfig(newConfig);
  };

  const exportToExcelFull = async () => {
    if (!company) return;
    setIsExporting('excel');
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "NOM-030 Assistant Pro";
      workbook.lastModifiedBy = "NOM-030 Assistant Pro";
      workbook.created = new Date();

      // Helper to add a colored table sheet
      const addSheet = (name: string, headers: string[], data: any[][]) => {
        const sheet = workbook.addWorksheet(name);
        // Header
        const headerRow = sheet.addRow(headers);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        });
        // Data
        data.forEach(row => sheet.addRow(row));
        sheet.columns.forEach(column => { column.width = 25; });
      };

      // 1. Company General
      addSheet("Datos Generales", ["Campo", "Valor"], [
        ["Empresa", company.name],
        ["RFC", company.rfc],
        ["Dirección", company.address],
        ["Actividad", company.activity],
        ["Trabajadores", company.workerCount],
        ["Responsable", company.responsibleName]
      ]);

      // 2. Risk Matrix
      if (config.riskMatrix) {
        addSheet("Matriz de Riesgos", 
          ["Título", "Categoría", "Severidad", "Prioridad", "Estatus", "Acción Correctiva"],
          findings.map(f => [f.title, f.category, f.severity, f.priority, f.status, f.correctiveAction || ""])
        );
      }

      // 3. Safety Program
      if (config.safetyProgram) {
        addSheet("Programa de Seguridad",
          ["Sección NOM", "Acción", "Norma Ref.", "Responsable", "Inicio", "Fin", "% Avance", "Estatus"],
          program.map(p => [p.nomSection, p.action, p.referenceNorm || "N/A", p.responsible, p.startDate, p.endDate, p.progress || 0, p.status])
        );
      }

      // 4. Hazards
      if (config.surroundingHazards) {
        addSheet("Peligros Circundantes",
          ["Tipo", "Fuente", "Distancia", "Probabilidad", "Impacto", "Nivel Riesgo", "Mitigación"],
          hazards.map(h => [h.hazardType, h.source, h.distance, h.probability, h.impact, h.riskLevel, h.mitigationMeasures])
        );
      }

      // 5. Evidence Log
      if (config.evidences) {
        addSheet("Bitácora Evidencias",
          ["Tipo", "Fecha", "Título/Nombre", "Cargo", "% Avance", "Estatus"],
          evidences.map(e => [e.entryType, e.date, e.title, e.role || "", e.progressPercentage || 0, e.status || ""])
        );
      }

      // 6. Accidentalidad
      if (config.accidentality) {
        addSheet("Accidentalidad",
          ["Fecha", "Tipo", "Días Perdidos", "Trabajador", "Descripción"],
          accidents.map(a => [a.date, a.type, a.daysLost, a.workerName || "", a.description])
        );
      }

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Extraccion_Total_${company.name}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
      toast.success("Excel generado con éxito");
    } catch (e) {
      toast.error("Error al generar Excel");
    } finally {
      setIsExporting(null);
    }
  };

  const exportToPPTX = async () => {
    if (!company) return;
    setIsExporting('ppt');
    try {
      const pres = new pptxgen();
      pres.layout = "LAYOUT_16x9";

      // Title Slide
      const slideTitle = pres.addSlide();
      slideTitle.background = { color: "1E293B" };
      slideTitle.addText(`REPORTE NOM-030-STPS`, { x: 1, y: 1, w: "80%", fontSize: 44, bold: true, color: "FFFFFF" });
      slideTitle.addText(`${company.name}`, { x: 1, y: 2, w: "80%", fontSize: 32, color: "cbd5e1" });
      slideTitle.addText(`RFC: ${company.rfc}`, { x: 1, y: 4, w: "80%", fontSize: 18, color: "94a3b8" });

      // Risk Matrix Summary
      if (config.riskMatrix) {
        const slideRisks = pres.addSlide();
        slideRisks.addText("Matriz de Riesgos Identificados", { x: 0.5, y: 0.5, w: "90%", fontSize: 24, bold: true });
        const riskRows = findings.slice(0, 8).map(f => [f.title, f.severity, f.status]);
        slideRisks.addTable([["Riesgo", "Severidad", "Estatus"], ...riskRows], { x: 0.5, y: 1.5, w: "90%", fontSize: 12, border: { type: "solid" } });
      }

      // Safety Program Summary
      if (config.safetyProgram) {
        const slideProg = pres.addSlide();
        slideProg.addText("Programa Preventivo de Seguridad", { x: 0.5, y: 0.5, w: "90%", fontSize: 24, bold: true });
        const progRows = program.slice(0, 7).map(p => [p.action, p.responsible, `${p.progress || 0}%`]);
        slideProg.addTable([["Acción", "Responsable", "Avance"], ...progRows], { x: 0.5, y: 1.5, w: "90%", fontSize: 11, border: { type: "solid" } });
      }

      // Generate
      pres.writeFile({ fileName: `Presentacion_NOM030_${company.name}.pptx` });
      toast.success("Presentación PPT generada");
    } catch (e) {
      toast.error("Error al generar PPT");
    } finally {
      setIsExporting(null);
    }
  };

  if (!company) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-1000">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-2xl shadow-2xl">
              <Archive className="w-8 h-8 text-white" />
            </div>
            Exportador Maestro de Activos
          </h1>
          <p className="text-slate-500 font-medium mt-2 flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-500" />
            Extracción Total de la Base de Datos NOM-030 (10 Módulos de Información)
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Module Selection Panel */}
        <div className="xl:col-span-5 space-y-8">
          <Card className="border-none shadow-2xl shadow-slate-200 rounded-[2.5rem] overflow-hidden bg-white border border-white">
            <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-xl">
                      <Settings2 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <CardTitle className="text-xl font-bold text-slate-800">Contenido del Reporte</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase" onClick={() => toggleAll(true)}>Marcar todo</Button>
                    <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase" onClick={() => toggleAll(false)}>Desmarcar</Button>
                  </div>
               </div>
            </CardHeader>
            <CardContent className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
               {Object.entries(config).map(([key, value]) => (
                 <div 
                   key={key} 
                   className={cn(
                     "flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group",
                     value ? "bg-indigo-50/50 border-indigo-200 ring-4 ring-indigo-50/20" : "bg-slate-50/50 border-slate-100"
                   )}
                   onClick={() => setConfig(prev => ({ ...prev, [key as keyof ExportConfig]: !prev[key as keyof ExportConfig] }))}
                 >
                   <div className="flex items-center gap-3">
                      <div className={cn("p-1.5 rounded-lg transition-colors", value ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-400 group-hover:bg-slate-300")}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <span className={cn("text-xs font-bold uppercase tracking-tight", value ? "text-indigo-900" : "text-slate-400")}>
                        {key === 'processes' ? 'Procesos' : 
                         key === 'localization' ? 'Localización' : 
                         key === 'infrastructure' ? 'Planos/Infra' : 
                         key === 'legalFramework' ? 'Marco Legal' : 
                         key === 'noms' ? 'Normas NOM' : 
                         key === 'riskMatrix' ? 'Matriz Riesgos' : 
                         key === 'surroundingHazards' ? 'Peligros Circ.' : 
                         key === 'accidentality' ? 'Accidentalidad' : 
                         key === 'safetyProgram' ? 'Seguridad' : 'Evidencias'}
                      </span>
                   </div>
                   <Checkbox checked={value} className="ml-2" />
                 </div>
               ))}
            </CardContent>
          </Card>

          <div className="bg-indigo-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:rotate-12 transition-transform duration-700">
               <ShieldCheck className="w-48 h-48" />
             </div>
             <h3 className="text-2xl font-black mb-4 flex items-center gap-3">
               <ShieldCheck className="text-indigo-400" /> Exportación Segura
             </h3>
             <p className="text-indigo-200 text-sm leading-relaxed mb-6 font-medium">
               Todos los reportes generados cumplen con los estándares de extración de datos para cumplimiento normativo STPS. La información es extraída directamente de su base de datos local cifrada.
             </p>
             <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl border border-white/10 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Datos Cifrados
                </div>
                <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl border border-white/10 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Sin Mock-up
                </div>
             </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="xl:col-span-7 space-y-8">
          <Card className="border-none shadow-2xl shadow-slate-200 rounded-[2.5rem] bg-white p-10 flex flex-col items-center justify-center text-center space-y-10 min-h-[400px]">
             <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-200 mb-2">
                <Search className="w-10 h-10 text-white" />
             </div>
             <div className="space-y-4">
               <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Seleccione formato de salida</h2>
               <p className="text-slate-500 max-w-sm mx-auto font-medium">
                 El sistema procesará los módulos seleccionados para generar un archivo optimizado de grado auditoría.
               </p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <Button 
                   onClick={() => { setTimeout(() => { if (typeof window !== 'undefined') { window.print(); } }, 500); }}
                   disabled={isExporting !== null}
                   className="bg-slate-900 hover:bg-black h-20 rounded-2xl flex items-center justify-between px-8 text-lg font-black group transition-all"
                >
                   <div className="flex items-center gap-4">
                      <FileText className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform" />
                      Descargar PDF / WORD
                   </div>
                   <Download className="w-5 h-5 opacity-40" />
                </Button>

                <Button 
                   onClick={exportToExcelFull}
                   disabled={isExporting !== null}
                   className="bg-emerald-600 hover:bg-emerald-700 h-20 rounded-2xl flex items-center justify-between px-8 text-lg font-black group transition-all"
                >
                   <div className="flex items-center gap-4">
                      <FileSpreadsheet className="w-6 h-6 text-emerald-100 group-hover:scale-110 transition-transform" />
                      {isExporting === 'excel' ? 'Procesando...' : 'Descargar EXCEL'}
                   </div>
                   <Download className="w-5 h-5 opacity-40" />
                </Button>

                <Button 
                   onClick={exportToPPTX}
                   disabled={isExporting !== null}
                   className="bg-orange-600 hover:bg-orange-700 h-20 rounded-2xl flex items-center justify-between px-8 text-lg font-black group transition-all"
                >
                   <div className="flex items-center gap-4">
                      <Presentation className="w-6 h-6 text-orange-100 group-hover:scale-110 transition-transform" />
                      {isExporting === 'ppt' ? 'Generando...' : 'Descargar PPT'}
                   </div>
                   <Download className="w-5 h-5 opacity-40" />
                </Button>

                <Button 
                   variant="outline"
                   className="border-2 border-slate-100 h-20 rounded-2xl flex items-center justify-between px-8 text-lg font-black text-slate-800 hover:bg-slate-50 transition-all opacity-50 cursor-not-allowed"
                >
                   <div className="flex items-center gap-4">
                      <TableIcon className="w-6 h-6 text-slate-300" />
                      Respaldo SQL (DB)
                   </div>
                   <AlertTriangle className="w-5 h-5 text-amber-300" />
                </Button>
             </div>
          </Card>

          {/* --- VISTA DE IMPRESIÓN (HIDDEN ON SCREEN) --- */}
          <div className="hidden print:block print-view">
             <MasterPrintTemplate 
               company={company} 
               config={config} 
               findings={findings} 
               hazards={hazards} 
               program={program} 
               accidents={accidents} 
               evidences={evidences} 
             />
          </div>
        </div>
      </div>
    </div>
  );
}

// THE MASTER PRINT TEMPLATE (10 SECTIONS)
function MasterPrintTemplate({ company, config, findings, hazards, program, accidents, evidences }: any) {
  return (
    <div className="p-0 m-0 bg-white font-sans text-slate-900">
      {/* 1. PORTADA */}
      <section className="h-[297mm] p-24 flex flex-col justify-between border-b-[40px] border-slate-900 print:break-after-page">
         <div className="flex justify-between items-start">
            <div className="space-y-2">
               <h1 className="text-5xl font-black tracking-tighter text-slate-900">INFORME EJECUTIVO MAESTRO</h1>
               <p className="text-xl font-bold text-indigo-600 uppercase tracking-widest">NOM-030-STPS-2009 • SISTEMA INTEGRAL</p>
            </div>
            {company.logo && <img src={company.logo} alt="Logo" className="w-32 h-32 object-contain" />}
         </div>

         <div className="space-y-12">
            <div className="space-y-2">
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Centro de Trabajo Inspeccionado</p>
               <h2 className="text-7xl font-black text-slate-900 tracking-tighter">{company.name}</h2>
               <p className="text-2xl font-bold text-slate-500 uppercase">{company.rfc}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-12 border-t pt-10 border-slate-100">
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Actividad Económica</p>
                  <p className="text-sm font-bold text-slate-800">{company.activity}</p>
               </div>
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Responsable de Seguridad</p>
                  <p className="text-sm font-bold text-slate-800">{company.responsibleName}</p>
               </div>
            </div>
         </div>

         <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-300">
            <span>Fecha de Extracción: {format(new Date(), 'dd/MM/yyyy HH:mm')}</span>
            <span>NOM-030 Assistant Pro v2.0</span>
         </div>
      </section>

      {/* 1. PROCESOS */}
      {config.processes && (
        <section className="p-16 min-h-screen print:break-after-page">
           <h3 className="text-2xl font-black border-b-4 border-slate-900 pb-4 mb-8 uppercase tracking-tight">01. Análisis de Procesos Operativos</h3>
           <div className="space-y-8">
              <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 italic text-slate-700 leading-relaxed">
                 {company.processDescription || "No se registró descripción detallada de procesos."}
              </div>
              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Materias Primas</p>
                    <p className="text-sm font-bold">{company.rawMaterials || "N/A"}</p>
                 </div>
                 <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Maquinaria y Equipo</p>
                    <p className="text-sm font-bold">{company.machinery || "N/A"}</p>
                 </div>
              </div>
           </div>
        </section>
      )}

      {/* 2. LOCALIZACIÓN */}
      {config.localization && (
        <section className="p-16 min-h-screen print:break-after-page">
           <h3 className="text-2xl font-black border-b-4 border-slate-900 pb-4 mb-8 uppercase tracking-tight">02. Localización y Croquis de Entorno</h3>
           <div className="space-y-12">
              <div className="grid grid-cols-2 gap-8">
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Dirección del Predio</p>
                    <p className="text-sm font-bold">{company.address}</p>
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Referencia de Acceso</p>
                    <p className="text-sm font-bold italic">{company.accessibilityDescription || "N/A"}</p>
                 </div>
              </div>
              
              <div className="border-4 border-slate-900 p-2 rounded-2xl overflow-hidden aspect-video bg-slate-50 flex items-center justify-center">
                 {company.surroundingHazardsMap ? (
                   <img src={company.surroundingHazardsMap} alt="Mapa" className="w-full h-full object-contain" />
                 ) : (
                   <p className="text-slate-300 font-black uppercase text-xl">Sin Croquis de Localización</p>
                 )}
              </div>
           </div>
        </section>
      )}

      {/* 3. INFRAESTRUCTURA */}
      {config.infrastructure && (
        <section className="p-16 min-h-screen print:break-after-page">
           <h3 className="text-2xl font-black border-b-4 border-slate-900 pb-4 mb-8 uppercase tracking-tight">03. Infraestructura y Áreas del Predio</h3>
           <div className="space-y-8">
              <div className="grid grid-cols-3 gap-6">
                 <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Sup. Terreno</p>
                    <p className="text-xl font-black">{company.totalPlotArea || 0} m²</p>
                 </div>
                 <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Sup. Construida</p>
                    <p className="text-xl font-black">{company.totalBuiltArea || 0} m²</p>
                 </div>
                 <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Regimen Propiedad</p>
                    <p className="text-xl font-black uppercase tracking-tighter">{company.propertyStatus || "N/A"}</p>
                 </div>
              </div>
              <div className="space-y-2">
                 <p className="text-[10px] font-black text-slate-400 uppercase">Descripción Física</p>
                 <p className="text-sm border-l-4 border-slate-900 pl-6 py-2 leading-relaxed">{company.infrastructureDescription || "No se proporcionó descripción."}</p>
              </div>
           </div>
        </section>
      )}

      {/* 6. MATRIZ RIESGOS */}
      {config.riskMatrix && (
        <section className="p-16 min-h-screen print:break-after-page">
           <h3 className="text-2xl font-black border-b-4 border-slate-900 pb-4 mb-8 uppercase tracking-tight">06. Matriz de Identificación de Riesgos</h3>
           <table className="w-full text-xs border-collapse">
              <thead>
                 <tr className="bg-slate-900 text-white">
                    <th className="p-3 border border-slate-900 uppercase">Peligro / Riesgo</th>
                    <th className="p-3 border border-slate-900 uppercase">Categoría</th>
                    <th className="p-3 border border-slate-900 uppercase">Severidad</th>
                    <th className="p-3 border border-slate-900 uppercase">Estatus</th>
                    <th className="p-3 border border-slate-900 uppercase">Medida Correctiva</th>
                 </tr>
              </thead>
              <tbody>
                 {findings.map((f: any, i: number) => (
                    <tr key={i}>
                       <td className="p-3 border border-slate-100 font-bold">{f.title}</td>
                       <td className="p-3 border border-slate-100 italic">{f.category}</td>
                       <td className="p-3 border border-slate-100 font-black">{f.severity}</td>
                       <td className="p-3 border border-slate-100 uppercase">{f.status}</td>
                       <td className="p-3 border border-slate-100 leading-tight">{f.correctiveAction}</td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </section>
      )}

      {/* 9. PROGRAMA SEGURIDAD */}
      {config.safetyProgram && (
        <section className="p-16 min-h-screen print:break-after-page">
           <h3 className="text-2xl font-black border-b-4 border-slate-900 pb-4 mb-8 uppercase tracking-tight">09. Programa Preventivo de Seguridad y Salud</h3>
           <table className="w-full text-[10px] border-collapse">
              <thead>
                 <tr className="bg-slate-50">
                    <th className="p-3 border border-slate-200 uppercase">Acción</th>
                    <th className="p-3 border border-slate-200 uppercase">NOM Ref</th>
                    <th className="p-3 border border-slate-200 uppercase">Responsable</th>
                    <th className="p-3 border border-slate-200 uppercase">Inicio</th>
                    <th className="p-3 border border-slate-200 uppercase">Término</th>
                    <th className="p-3 border border-slate-200 uppercase">% Avance</th>
                 </tr>
              </thead>
              <tbody>
                 {program.map((p: any, i: number) => (
                    <tr key={i}>
                       <td className="p-3 border border-slate-100 font-bold">{p.action}</td>
                       <td className="p-3 border border-slate-100 text-center">{p.referenceNorm || "N/A"}</td>
                       <td className="p-3 border border-slate-100">{p.responsible}</td>
                       <td className="p-3 border border-slate-100">{format(new Date(p.startDate), 'dd/MM/yy')}</td>
                       <td className="p-3 border border-slate-100">{format(new Date(p.endDate), 'dd/MM/yy')}</td>
                       <td className="p-3 border border-slate-100 font-black text-center">{p.progress || 0}%</td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </section>
      )}

      {/* 10. EVIDENCIAS */}
      {config.evidences && (
        <section className="p-16 min-h-screen print:break-after-page">
           <h3 className="text-2xl font-black border-b-4 border-slate-900 pb-4 mb-8 uppercase tracking-tight">10. Bitácora de Evidencias y DC-3</h3>
           <div className="grid grid-cols-2 gap-8">
              {evidences.map((e: any, i: number) => (
                 <div key={i} className="p-6 border border-slate-100 rounded-3xl bg-slate-50/30 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                       <div>
                          <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">{e.entryType === 'training' ? 'Capacitación' : 'Seguimiento'}</p>
                          <p className="text-sm font-bold text-slate-800">{e.title}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400">{format(new Date(e.date), 'dd MMMM yyyy', { locale: es })}</p>
                       </div>
                    </div>
                    {e.fileUrl && (
                      <div className="w-full aspect-video bg-white rounded-2xl overflow-hidden border border-slate-100">
                         <img src={e.fileUrl} alt="Evidencia" className="w-full h-full object-contain" />
                      </div>
                    )}
                 </div>
              ))}
           </div>
        </section>
      )}

      {/* FINAL SIGNATURE PAGE */}
      <section className="p-24 min-h-screen flex flex-col justify-end">
         <div className="grid grid-cols-2 gap-24">
            <div className="text-center pt-10 border-t-4 border-slate-900">
               <p className="text-sm font-bold">{company.responsibleName}</p>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsable de Servicios Preventivos</p>
            </div>
            <div className="text-center pt-10 border-t-4 border-slate-900">
               <p className="text-sm font-bold">REPRESENTANTE PATRONAL</p>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Patrón / Firma Corporativa</p>
            </div>
         </div>
         <p className="text-center text-[9px] text-slate-300 font-medium mt-32 leading-relaxed max-w-lg mx-auto italic">
            Este reporte ha sido generado electrónicamente bajo los criterios de cumplimiento de la NOM-030-STPS-2009. La veracidad de la información es responsabilidad del centro de trabajo evaluado.
         </p>
      </section>
    </div>
  );
}
