import React, { useState, useRef } from "react";
import { useAppStore } from "../../hooks/useAppStore";
import { db } from "../../lib/db";
import { useDexieQuery } from "../../hooks/useDexie";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { 
  FileText, 
  Settings2, 
  Printer, 
  CheckCircle2, 
  Map as MapIcon,
  Radar,
  History,
  GraduationCap,
  Image as ImageIcon,
  ChevronRight,
  FileCheck,
  Building2,
  Calendar,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "../../lib/utils";

interface ReportConfig {
  includeCover: boolean;
  includeLocalization: boolean;
  includeHazards: boolean;
  includeComplianceLog: boolean;
  includeTraining: boolean;
  includeAnnexes: boolean;
}

export function ReportBuilder() {
  const { currentCompanyId } = useAppStore();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [config, setConfig] = useState<ReportConfig>({
    includeCover: true,
    includeLocalization: true,
    includeHazards: true,
    includeComplianceLog: true,
    includeTraining: true,
    includeAnnexes: true
  });

  const handlePrint = () => {
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.print();
      }
    }, 500);
  };

  // Data fetching for the report
  const company = useDexieQuery(() => currentCompanyId ? db.companies.get(currentCompanyId) : Promise.resolve(undefined), [currentCompanyId]);
  const hazards = useDexieQuery(() => currentCompanyId ? db.surroundingHazards.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([]), [currentCompanyId]) || [];
  const evidences = useDexieQuery(() => currentCompanyId ? db.evidences.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([]), [currentCompanyId]) || [];

  const toggleConfig = (key: keyof ReportConfig) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!currentCompanyId || !company) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Step 1: Configurator */}
        <div className="w-full lg:w-1/3 space-y-6">
          <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500 rounded-xl">
                  <Settings2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">Configurador de Reporte</CardTitle>
                  <CardDescription className="text-slate-400 text-xs">Selecciona los módulos a incluir</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group transition-all hover:border-indigo-200">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                    <div>
                      <Label className="text-sm font-bold text-slate-700">Portada y Datos Generales</Label>
                      <p className="text-[10px] text-slate-400 font-medium">Obligatorio por NOM-030</p>
                    </div>
                  </div>
                  <Checkbox checked={config.includeCover} onCheckedChange={() => toggleConfig('includeCover')} disabled />
                </div>

                <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 group transition-all hover:border-indigo-200">
                  <div className="flex items-center gap-3">
                    <MapIcon className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                    <div>
                      <Label className="text-sm font-bold text-slate-700 pointer-events-none">Localización y Croquis</Label>
                      <p className="text-[10px] text-slate-400 font-medium">Mapa del centro de trabajo</p>
                    </div>
                  </div>
                  <Checkbox checked={config.includeLocalization} onCheckedChange={() => toggleConfig('includeLocalization')} />
                </div>

                <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 group transition-all hover:border-indigo-200">
                  <div className="flex items-center gap-3">
                    <Radar className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                    <div>
                      <Label className="text-sm font-bold text-slate-700 pointer-events-none">Peligros Circundantes</Label>
                      <p className="text-[10px] text-slate-400 font-medium">Infraestructura y entorno</p>
                    </div>
                  </div>
                  <Checkbox checked={config.includeHazards} onCheckedChange={() => toggleConfig('includeHazards')} />
                </div>

                <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 group transition-all hover:border-indigo-200">
                  <div className="flex items-center gap-3">
                    <History className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                    <div>
                      <Label className="text-sm font-bold text-slate-700 pointer-events-none">Bitácora de Seguimiento</Label>
                      <p className="text-[10px] text-slate-400 font-medium">Avances del programa preventivo</p>
                    </div>
                  </div>
                  <Checkbox checked={config.includeComplianceLog} onCheckedChange={() => toggleConfig('includeComplianceLog')} />
                </div>

                <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 group transition-all hover:border-indigo-200">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                    <div>
                      <Label className="text-sm font-bold text-slate-700 pointer-events-none">Personal Capacitado</Label>
                      <p className="text-[10px] text-slate-400 font-medium">Evidencias de capacitación</p>
                    </div>
                  </div>
                  <Checkbox checked={config.includeTraining} onCheckedChange={() => toggleConfig('includeTraining')} />
                </div>

                <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 group transition-all hover:border-indigo-200">
                  <div className="flex items-center gap-3">
                    <ImageIcon className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                    <div>
                      <Label className="text-sm font-bold text-slate-700 pointer-events-none">Galería y Anexos</Label>
                      <p className="text-[10px] text-slate-400 font-medium">Evidencias fotográficas</p>
                    </div>
                  </div>
                  <Checkbox checked={config.includeAnnexes} onCheckedChange={() => toggleConfig('includeAnnexes')} />
                </div>
              </div>

              <div className="pt-4">
                  <Button 
                    onClick={() => { setTimeout(() => { if (typeof window !== 'undefined') { window.print(); } }, 500); }}
                    className="w-full bg-slate-900 hover:bg-black text-white rounded-2xl py-6 h-auto font-bold shadow-xl shadow-slate-200 group"
                  >
                  <Printer className="w-5 h-5 mr-3 text-indigo-400 group-hover:scale-110 transition-transform" />
                  Descargar Reporte Modular
                </Button>
                <p className="text-[10px] text-slate-400 text-center mt-4 uppercase tracking-widest font-black opacity-60">Listo para inspección federal</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Step 2 & 3: Live Preview & Printable Instance */}
        <div className="w-full lg:w-2/3">
          <div className="bg-slate-100 rounded-3xl p-8 min-h-[800px] border border-slate-200/50 shadow-inner overflow-hidden relative">
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm px-4 py-1.5 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest z-10 border border-white shadow-sm">
              Vista Identificada para Impresión
            </div>
            
            {/* The actual component we print */}
            <div className={cn(
              "bg-white shadow-2xl mx-auto origin-top p-0 md:p-0",
              "print:shadow-none print:m-0 print:p-0 print:bg-white print:block print-view"
            )} style={{ width: '100%', maxWidth: '800px' }}>
              <PrintTemplate company={company} config={config} hazards={hazards} evidences={evidences} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- PRINTABLE TEMPLATE COMPONENTS ---

function PrintTemplate({ company, config, hazards, evidences }: { 
  company: any, 
  config: ReportConfig, 
  hazards: any[], 
  evidences: any[] 
}) {
  const progressEntries = evidences.filter(e => e.entryType === 'progress');
  const trainingEntries = evidences.filter(e => e.entryType === 'training');

  return (
    <div className="font-sans text-slate-900 bg-white min-h-screen">
      {/* 1. COVER PAGE */}
      {config.includeCover && (
        <section className="p-16 h-screen flex flex-col justify-between border-b-[20px] border-indigo-600 print:h-[297mm] print:break-after-page">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h1 className="text-4xl font-black tracking-tighter text-slate-900">NOM-030-STPS-2009</h1>
              <p className="text-lg font-bold text-slate-500 uppercase tracking-widest">Servicios Preventivos de Seguridad y Salud</p>
            </div>
            <div className="w-24 h-24 bg-slate-100 rounded-2xl flex items-center justify-center border-2 border-slate-50">
              <Building2 className="w-12 h-12 text-slate-300" />
            </div>
          </div>

          <div className="space-y-8">
            <div className="space-y-2">
              <p className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-2">Empresa / Centro de Trabajo</p>
              <h2 className="text-6xl font-black text-slate-900 tracking-tighter leading-tight">{company.name}</h2>
              <p className="text-2xl font-medium text-slate-500">RFC: {company.rfc}</p>
            </div>

            <div className="grid grid-cols-2 gap-12 pt-8 border-t border-slate-100">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Dirección Fiscal / Operativa</p>
                <p className="text-sm font-bold text-slate-700 leading-relaxed">{company.address || "No especificada"}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Responsable de Seguridad</p>
                <p className="text-sm font-bold text-slate-700">{company.legalRepresentative || "Puesto no definido"}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-12">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase">Fecha de Emisión</p>
              <p className="text-sm font-bold">{format(new Date(), 'dd MMMM yyyy', { locale: es })}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase">Generado por</p>
              <p className="text-sm font-bold">NOM-030 Assistant Pro</p>
            </div>
          </div>
        </section>
      )}

      {/* 2. LOCALIZATION */}
      {config.includeLocalization && (
        <section className="p-12 space-y-8 print:break-after-page">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
            <h2 className="text-2xl font-black uppercase tracking-tight">Capítulo 1: Localización y Entorno</h2>
            <div className="text-[10px] font-bold bg-slate-900 text-white px-3 py-1 rounded-full uppercase tracking-widest">CENAPRED</div>
          </div>

          <div className="grid grid-cols-1 gap-8">
             <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800">Descripción del Entorno del Centro de Trabajo</h3>
                <div className="text-sm text-slate-600 leading-relaxed prose prose-slate max-w-none">
                   {company.surroundingHazardsDescription || "No se ha generado una descripción detallada del entorno. Se recomienda utilizar el módulo de IA para proyectar los riesgos circundantes según la NOM-030."}
                </div>
             </div>

             <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase text-center mb-4">Evidencia Cartográfica</p>
                <div className="aspect-video bg-white rounded-xl flex items-center justify-center border border-slate-100 overflow-hidden relative">
                   {company.atlasRiesgosNotes?.includes('Captura de Mapa') ? (
                     <div className="text-center p-8">
                       <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                       <p className="text-sm font-bold text-slate-700">Evidencia Cartográfica Adjunta en Anexos</p>
                       <p className="text-xs text-slate-500">Ver sección final de "Anexos y Fotografías" para ver el mapa de ubicación y riesgos circundantes.</p>
                     </div>
                   ) : (
                     <div className="text-center p-8">
                       <MapIcon className="w-12 h-12 text-slate-200 mx-auto mb-2" />
                       <p className="text-sm font-medium text-slate-400 italic">Croquis de localización no capturado.</p>
                     </div>
                   )}
                </div>
             </div>
          </div>
        </section>
      )}

      {/* 3. SURROUNDING HAZARDS TABLE */}
      {config.includeHazards && (
        <section className="p-12 space-y-8 print:break-after-page">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
            <h2 className="text-2xl font-black uppercase tracking-tight">Capítulo 2: Matriz de Riesgos Circundantes</h2>
            <div className="text-[10px] font-bold bg-slate-900 text-white px-3 py-1 rounded-full uppercase tracking-widest">Auditoría</div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-3 text-[10px] font-bold uppercase border border-slate-900">Tipo de Peligro</th>
                <th className="p-3 text-[10px] font-bold uppercase border border-slate-900">Fuente / Descripción</th>
                <th className="p-3 text-[10px] font-bold uppercase border border-slate-900">Distancia</th>
                <th className="p-3 text-[10px] font-bold uppercase border border-slate-900 text-center">Nivel de Riesgo</th>
                <th className="p-3 text-[10px] font-bold uppercase border border-slate-900">Medidas de Mitigación</th>
              </tr>
            </thead>
            <tbody>
              {hazards.length > 0 ? hazards.map((h, i) => (
                <tr key={i} className="text-xs border-b border-slate-100">
                  <td className="p-4 border border-slate-100 font-bold">{h.hazardType}</td>
                  <td className="p-4 border border-slate-100 italic">{h.source}</td>
                  <td className="p-4 border border-slate-100 text-center">{h.distance}</td>
                  <td className="p-4 border border-slate-100 text-center">
                    <span className={cn(
                      "font-black tracking-widest px-2 py-0.5 rounded",
                      h.riskLevel >= 15 ? "text-red-600" : "text-green-600"
                    )}>
                      {h.riskLevel} pts
                    </span>
                  </td>
                  <td className="p-4 border border-slate-100 text-[10px] leading-tight">{h.mitigationMeasures}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400 italic">No se registraron peligros externos específicos.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* 4. COMPLIANCE LOG */}
      {config.includeComplianceLog && (
        <section className="p-12 space-y-8 print:break-after-page">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
            <h2 className="text-2xl font-black uppercase tracking-tight">Capítulo 3: Seguimiento de Acciones</h2>
            <div className="text-[10px] font-bold bg-slate-900 text-white px-3 py-1 rounded-full uppercase tracking-widest">Cumplimiento</div>
          </div>

          <div className="space-y-6">
             <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <p className="text-sm text-slate-700 leading-relaxed">
                  Con base en el <strong>Numeral 4.6</strong> de la NOM-030-STPS-2009, se presenta el seguimiento de las acciones preventivas y correctivas instauradas en el centro de trabajo para la mejora continua de la seguridad.
                </p>
             </div>

             <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="p-3 text-[10px] font-black uppercase border-b-2 border-slate-200">Fecha</th>
                  <th className="p-3 text-[10px] font-black uppercase border-b-2 border-slate-200">Descripción del Avance</th>
                  <th className="p-3 text-[10px] font-black uppercase border-b-2 border-slate-200 text-center">% Avance</th>
                  <th className="p-3 text-[10px] font-black uppercase border-b-2 border-slate-200 text-center">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {progressEntries.length > 0 ? progressEntries.map((e, i) => (
                  <tr key={i} className="text-xs">
                    <td className="p-4 border-b border-slate-50 font-bold">{format(new Date(e.date), 'dd/MM/yy')}</td>
                    <td className="p-4 border-b border-slate-50">{e.title}</td>
                    <td className="p-4 border-b border-slate-50 text-center font-black">{e.progressPercentage}%</td>
                    <td className="p-4 border-b border-slate-50 text-center">
                      <span className="uppercase text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100">
                        {e.status === 'completed' ? 'Finalizado' : e.status === 'in_progress' ? 'En Curso' : 'Pendiente'}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-slate-400 italic">Sin registros de seguimiento del programa.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 5. TRAINING */}
      {config.includeTraining && (
        <section className="p-12 space-y-8 print:break-after-page">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
            <h2 className="text-2xl font-black uppercase tracking-tight">Capítulo 4: Personal Capacitado</h2>
            <div className="text-[10px] font-bold bg-slate-900 text-white px-3 py-1 rounded-full uppercase tracking-widest">STPS (DC-3)</div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="p-3 text-[10px] font-black uppercase border-b-2 border-slate-200">Nombre del Responsable</th>
                <th className="p-3 text-[10px] font-black uppercase border-b-2 border-slate-200 text-center">Cargo / Puesto</th>
                <th className="p-3 text-[10px] font-black uppercase border-b-2 border-slate-200 text-center">Fecha de Capacitación</th>
                <th className="p-3 text-[10px] font-black uppercase border-b-2 border-slate-200 text-center">Estatus DC-3</th>
              </tr>
            </thead>
            <tbody>
              {trainingEntries.length > 0 ? trainingEntries.map((e, i) => (
                <tr key={i} className="text-xs">
                  <td className="p-4 border-b border-slate-100 font-bold">{e.title}</td>
                  <td className="p-4 border-b border-slate-100 text-center">{e.role}</td>
                  <td className="p-4 border-b border-slate-100 text-center">{format(new Date(e.date), 'dd MMMM yyyy', { locale: es })}</td>
                  <td className="p-4 border-b border-slate-100 text-center">
                    {e.fileUrl ? (
                      <span className="text-[10px] font-bold text-emerald-600 flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> EVIDENCIA DISPONIBLE
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-300">SIN EVIDENCIA DIGITAL</span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-400 italic">No se ha registrado capacitación formal de servicios preventivos.</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-12 mt-24">
             <div className="text-center pt-8 border-t-2 border-slate-900">
                <p className="text-sm font-bold">{company.legalRepresentative || "RESPONSABLE LEGAL"}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase">Patrón / Representante Legal</p>
             </div>
             <div className="text-center pt-8 border-t-2 border-slate-900">
                <p className="text-sm font-bold">SEGURIDAD Y SALUD</p>
                <p className="text-[10px] font-black text-slate-400 uppercase">Responsable de Servicios Preventivos</p>
             </div>
          </div>
        </section>
      )}

      {/* 6. ANNEXES */}
      {config.includeAnnexes && (
        <section className="p-12 space-y-8 print:break-before-page">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
            <h2 className="text-2xl font-black uppercase tracking-tight">Capítulo 5: Anexos y Galerías Fotográficas</h2>
            <div className="text-[10px] font-bold bg-slate-900 text-white px-3 py-1 rounded-full uppercase tracking-widest">Evidencias</div>
          </div>

          <div className="grid grid-cols-2 gap-8">
             {evidences.filter(e => e.fileUrl).map((e, i) => (
                <div key={i} className="space-y-3 p-4 border border-slate-100 rounded-2xl">
                   <div className="aspect-video bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
                      <img src={e.fileUrl} alt={e.title} className="w-full h-full object-contain" />
                   </div>
                   <div>
                      <p className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">{e.title}</p>
                      <p className="text-[9px] text-slate-400 font-medium">Archivo: {e.fileName || 'Evidencia digital'}</p>
                   </div>
                </div>
             ))}
             {evidences.filter(e => e.fileUrl).length === 0 && (
               <div className="col-span-2 py-20 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                  <ImageIcon className="w-12 h-12 text-slate-100 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">No se han cargado evidencias gráficas de cumplimiento.</p>
               </div>
             )}
          </div>
        </section>
      )}
    </div>
  );
}
