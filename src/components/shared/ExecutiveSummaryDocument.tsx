import React from 'react';
import { db, Company, Finding, RiskAssessment, ChecklistItem, LegalMatrixRequirement, SafetyProgramItem, AccidentEvent, SurroundingHazard, EvidenceLog } from '../../lib/db';
import { Circle, Diamond, Square, Upload, Package, Workflow, ArrowDown, ArrowRight } from 'lucide-react';

type StepType = 'START' | 'PROCESS' | 'DECISION' | 'INPUT' | 'OUTPUT' | 'END';

interface DiagramStep {
  id: string;
  text: string;
  type: StepType;
  nextStepId?: string;
  altStepId?: string;
  textAlign?: "left" | "center" | "right";
  textRotation?: number;
}

interface ExecutiveSummaryDocumentProps {
  activeTab: string;
  company: Company | undefined;
  companiesList: Company[];
  findings: Finding[];
  riskAssessments: RiskAssessment[];
  legalMatrix: LegalMatrixRequirement[];
  checklistItems: ChecklistItem[];
  surroundingHazards: SurroundingHazard[];
  accidentEvents: AccidentEvent[];
  safetyProgram: SafetyProgramItem[];
  evidences: EvidenceLog[];
}

export const ExecutiveSummaryDocument: React.FC<ExecutiveSummaryDocumentProps> = ({
  activeTab,
  company,
  companiesList = [],
  findings = [],
  riskAssessments = [],
  legalMatrix = [],
  checklistItems = [],
  surroundingHazards = [],
  accidentEvents = [],
  safetyProgram = [],
  evidences = []
}) => {
  const currentDateStr = new Date().toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const getRiskLevelName = (level: number | undefined) => {
    if (!level) return 'No Evaluado';
    switch (level) {
      case 1: return 'Clase I (Mínimo)';
      case 2: return 'Clase II (Bajo)';
      case 3: return 'Clase III (Medio)';
      case 4: return 'Clase IV (Alto)';
      case 5: return 'Clase V (Máximo)';
      default: return `Clase ${level}`;
    }
  };

  const getTabExecutiveTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'DIAGNÓSTICO ESTATAL INTEGRAL DE SEGURIDAD Y SALUD EN EL TRABAJO';
      case 'companies':
        return 'CATÁLOGO CORPORATIVO Y REGISTRO DE FILIALES ACTIVAS';
      case 'process':
        return 'DESCRIPCION INTEGRAL DE PROCESOS INDUSTRIALES Y OPERATIVOS';
      case 'localization':
        return 'DETALLE DE COORDENADAS GEO-REFERENCIALES Y ACCESIBILIDAD';
      case 'layout':
        return 'PLANOS E INFRAESTRUCTURA DE PLANTA Y RESGUARDO SEGURO';
      case 'legal':
        return 'EVALUACIÓN DE MARCO LEGAL Y REQUISITOS GENERALES';
      case 'legal_matrix':
        return 'MATRIZ DE CUMPLIMIENTO REGULATORIO Y PRECEPTOS NOM-STPS';
      case 'risks':
        return 'MATRIZ DE IDENTIFICACIÓN DE PELIGROS Y CLASIFICACIÓN DE RIESGOS';
      case 'surrounding_hazards':
        return 'PELIGROS Y AMENAZAS CIRCUNDANTES EXTERNAS A LA PLANTA';
      case 'accident_analysis':
        return 'INDICADORES HISTÓRICOS Y BITÁCORA DE ACCIDENTALIDAD LABORAL';
      case 'compliance':
        return 'PROGRAMA OPERATIVO DE SEGURIDAD Y SALUD EN EL TRABAJO (NOM-030)';
      case 'compliance_log':
        return 'HISTORIAL DE CUMPLIMIENTO, ACADEMIA Y CAPACITACIÓN DC-3';
      default:
        return 'RESUMEN EJECUTIVO DE CUMPLIMIENTO STPS';
    }
  };

  if (activeTab === 'companies' && companiesList.length > 0 && !company) {
    // Overall view of all registered companies if no active company is chosen
    return (
      <div id="tab-executive-summary-print-container" className="p-8 bg-white text-slate-900 border border-slate-200 rounded-lg max-w-[800px] mx-auto text-xs leading-relaxed font-sans">
        {/* Header Block */}
        <div className="flex items-center justify-between border-b-2 border-blue-600 pb-4 mb-6">
          <div className="flex-1">
            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block">SISTEMA DE ADMINISTRACIÓN NOM-030-STPS</span>
            <h1 className="text-lg font-black text-slate-900 tracking-tight mt-1">CATÁLOGO CORPORATIVO DE EMPRESAS Y SUCURSALES</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">Listado estructurado de las firmas registradas para el diagnóstico preventivo</p>
          </div>
          <div className="text-right whitespace-nowrap pl-4">
            <span className="text-[10px] font-bold text-slate-600 uppercase block">FECHA DE EXTRACCIÓN</span>
            <span className="text-[11px] font-black text-slate-900">{currentDateStr}</span>
          </div>
        </div>

        {/* General Overview Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[9px] text-slate-500 uppercase block font-semibold">Total de Firmas</span>
            <span className="text-xl font-black text-slate-800">{companiesList.length}</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[9px] text-slate-500 uppercase block font-semibold">Trabajadores Totales</span>
            <span className="text-xl font-black text-slate-800">{companiesList.reduce((acc, c) => acc + (c.workerCount || 0), 0)}</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[9px] text-slate-500 uppercase block font-semibold">Diagnósticos Completos</span>
            <span className="text-xl font-black text-blue-600">{companiesList.filter(c => c.responsibleSignature).length} firmas firmadas</span>
          </div>
        </div>

        {/* Primary Data Table */}
        <table className="w-full border-collapse border border-slate-200 text-left mb-6">
          <thead>
            <tr className="bg-slate-100 text-[10px] font-bold text-slate-700">
              <th className="border border-slate-200 p-2 text-center" style={{ width: '8%' }}>ID</th>
              <th className="border border-slate-200 p-2" style={{ width: '40%' }}>RAZÓN SOCIAL / NOMBRE</th>
              <th className="border border-slate-200 p-2" style={{ width: '20%' }}>RFC</th>
              <th className="border border-slate-200 p-2 text-center" style={{ width: '16%' }}>TRABAJADORES</th>
              <th className="border border-slate-200 p-2 text-center" style={{ width: '16%' }}>RIESGO LFT</th>
            </tr>
          </thead>
          <tbody>
            {companiesList.map((c, idx) => (
              <tr key={c.id || idx} className="hover:bg-slate-50/50">
                <td className="border border-slate-200 p-2 text-center font-bold text-slate-500">{c.id}</td>
                <td className="border border-slate-200 p-2 font-bold text-slate-800">{c.name}</td>
                <td className="border border-slate-200 p-2 font-mono text-slate-600 text-[11px] uppercase">{c.rfc}</td>
                <td className="border border-slate-200 p-2 text-center">{c.workerCount || 0} operarios</td>
                <td className="border border-slate-200 p-2 text-center font-semibold text-amber-700">{getRiskLevelName(c.riskLevel)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Dynamic Conclusion */}
        <div className="p-3 bg-blue-50/30 border border-blue-100 rounded-xl mb-8">
          <p className="font-bold text-blue-900 mb-1 text-[11px]">DECLARACIÓN DE RESPONSABILIDAD SISTÉMICA:</p>
          <p className="text-[10px] text-slate-600">
            Este padrón contiene el catastro único de centros de trabajo registrados para autoevaluaciones en términos de la NOM-030-STPS. Cada entidad tiene la obligación legal de conservar evidencias documentales y actualizar su diagnóstico de manera anual.
          </p>
        </div>

        {/* Footer info stamp */}
        <div className="border-t border-slate-100 pt-4 flex justify-between items-center text-[9px] text-slate-400 font-mono">
          <span>STPS COMPLIANCE ENGINE © {new Date().getFullYear()}</span>
          <span>FOLIO: CATALOG-STPS-GEN</span>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div id="tab-executive-summary-print-container" className="p-6 bg-white text-slate-500 text-center rounded-lg border max-w-lg mx-auto mt-10">
        <p className="font-bold text-red-500">No hay ninguna empresa activa seleccionada en el sistema.</p>
        <p className="text-xs text-slate-400 mt-2">Por favor, vaya al catálogo de empresas y marque una empresa como activa para poder generar su reporte ejecutivo.</p>
      </div>
    );
  }

  // Helper values calculated dynamically
  const criticalRisksCount = riskAssessments.filter(r => r.riskLevel >= 400 || r.priority === 'very_high' || r.priority === 'high').length;
  const mediumRisksCount = riskAssessments.filter(r => r.riskLevel > 50 && r.riskLevel < 400).length;
  const lowRisksCount = riskAssessments.filter(r => r.riskLevel <= 50).length;

  // Checklist statistics (compliance vs total assessed)
  const assessedChecklist = checklistItems.filter(item => item.compliance && item.compliance !== 'not_applicable');
  const compliantChecklistCount = checklistItems.filter(item => item.compliance === 'compliance').length;
  const checklistComplianceRate = assessedChecklist.length > 0 
    ? Math.round((compliantChecklistCount / assessedChecklist.length) * 100) 
    : 0;

  // Accident Stats
  const yearsWithAccidents = Array.from(new Set(accidentEvents.map(a => new Date(a.date).getFullYear())));
  const totalDaysLost = accidentEvents.reduce((acc, a) => acc + (a.daysLost || 0), 0);
  const totalAccidents = accidentEvents.filter(a => a.type === 'accident' || a.type === 'work_risk').length;
  const totalIllnesses = accidentEvents.filter(a => a.type === 'illness' || a.type === 'professional_illness').length;
  const totalDeaths = accidentEvents.filter(a => a.isDeath).length;

  return (
    <div id="tab-executive-summary-print-container" className="p-8 bg-white text-slate-900 border border-slate-300 rounded-lg max-w-[800px] mx-auto text-[11px] leading-relaxed font-sans">
      
      {/* 1. Official Corporate Letterhead Header */}
      <div className="flex md:flex-row flex-col justify-between items-start md:items-center border-b-2 border-slate-950 pb-4 mb-5 gap-4">
        <div className="flex items-center gap-3">
          {company.logo && !company.logo.startsWith('data:application/pdf') ? (
            <img src={company.logo} alt="Logo" className="w-12 h-12 object-contain rounded border border-slate-100" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-10 h-10 bg-slate-950 text-white font-black flex items-center justify-center rounded text-sm tracking-tighter">
              {company.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <span className="text-[10px] font-black tracking-widest text-blue-700 block uppercase">DIAGNÓSTICO OFICIAL REGLAMENTARIO STPS</span>
            <h1 className="text-sm font-black text-slate-950 tracking-tight leading-none mt-1 uppercase">{company.name}</h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">RFC: {company.rfc} • {company.businessLine || 'GIRO INDUSTRIAL'}</p>
          </div>
        </div>

        <div className="text-right pl-4 border-l border-slate-200 md:block hidden">
          <span className="text-[8px] font-bold text-slate-500 uppercase block tracking-wider">CÓDIGO DE EXPEDIENTE</span>
          <span className="text-[10px] font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded block whitespace-nowrap">REF-STPS-{company.rfc.substring(0, 4)}-2026</span>
          <span className="text-[9px] text-slate-500 block mt-1">Fecha: {currentDateStr}</span>
        </div>
      </div>

      {/* 2. Highlight Title and Description */}
      <div className="bg-slate-950 text-white rounded-lg p-3 text-center mb-5 shadow-sm">
        <h2 className="text-[11px] font-black tracking-wider uppercase">{getTabExecutiveTitle()}</h2>
        <p className="text-[9px] text-slate-300 mt-0.5 font-medium">Sólidamente integrado al Diagnóstico de Seguridad y Salud en el Trabajo conforme la Norma Oficial Mexicana NOM-030-STPS</p>
      </div>

      {/* 3. General Company Metadata Grid */}
      <div className="grid grid-cols-4 gap-2 mb-5 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
        <div>
          <span className="text-[8px] font-bold text-slate-500 uppercase block">Razón Social</span>
          <span className="font-bold text-slate-900 block truncate">{company.name}</span>
        </div>
        <div>
          <span className="text-[8px] font-bold text-slate-500 uppercase block">RFC Legal</span>
          <span className="font-mono font-bold text-slate-800 uppercase block">{company.rfc}</span>
        </div>
        <div>
          <span className="text-[8px] font-bold text-slate-500 uppercase block">Personal Expuesto (N)</span>
          <span className="font-semibold text-slate-800 block">{company.workerCount || 0} trabajadores</span>
        </div>
        <div>
          <span className="text-[8px] font-bold text-slate-500 uppercase block">Giro / Actividad</span>
          <span className="font-semibold text-slate-800 block truncate">{company.activity || 'No registrado'}</span>
        </div>
        <div className="col-span-2 mt-1">
          <span className="text-[8px] font-bold text-slate-500 uppercase block">Domicilio del Centro de Trabajo</span>
          <span className="text-slate-600 block leading-tight">{company.address || 'No declarada'}</span>
        </div>
        <div className="mt-1">
          <span className="text-[8px] font-bold text-slate-500 uppercase block">Turnos de Trabajo</span>
          <span className="text-slate-700 font-medium block">{company.shifts || '1 Turno continuo'}</span>
        </div>
        <div className="mt-1">
          <span className="text-[8px] font-bold text-slate-500 uppercase block">Nivel de Riesgo (LFT / LISS)</span>
          <span className="font-bold text-amber-800 block">{getRiskLevelName(company.riskLevel)}</span>
        </div>
      </div>

      {/* 4. Active-Tab Specific Executive Summary & Indicators */}
      
      {/* CASE A: DASHBOARD STATUS */}
      {activeTab === 'dashboard' && (
        <div>
          <h3 className="text-[10px] font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2">Cuadro de Mando de Compliance (STPS)</h3>
          
          <div className="grid grid-cols-4 gap-2.5 mb-5">
            <div className="p-2.5 border border-blue-200 bg-blue-50/20 rounded-xl text-center">
              <span className="text-[8px] font-bold text-slate-500 uppercase block">Cumplimiento Legal</span>
              <span className="text-lg font-black text-blue-700">{checklistComplianceRate}%</span>
              <span className="text-[8px] text-slate-500 block mt-0.5">{compliantChecklistCount} de {assessedChecklist.length} aplicables</span>
            </div>
            <div className="p-2.5 border border-red-200 bg-red-50/20 rounded-xl text-center">
              <span className="text-[8px] font-bold text-slate-500 uppercase block">Riesgos Críticos (Fine)</span>
              <span className="text-lg font-black text-red-600">{criticalRisksCount}</span>
              <span className="text-[8px] text-slate-500 block mt-0.5">Requieren mitigación inmediata</span>
            </div>
            <div className="p-2.5 border border-amber-200 bg-amber-50/20 rounded-xl text-center">
              <span className="text-[8px] font-bold text-slate-500 uppercase block">Amenazas del Entorno</span>
              <span className="text-lg font-black text-amber-700">{surroundingHazards.length}</span>
              <span className="text-[8px] text-slate-500 block mt-0.5">Peligros geográficos / sociales</span>
            </div>
            <div className="p-2.5 border border-slate-200 bg-slate-100/50 rounded-xl text-center">
              <span className="text-[8px] font-bold text-slate-500 uppercase block">Historial de Siniestralidad</span>
              <span className="text-lg font-black text-slate-800">{accidentEvents.length}</span>
              <span className="text-[8px] text-slate-500 block mt-0.5">{totalDaysLost} total de días perdidos</span>
            </div>
          </div>

          <p className="mb-4 text-justify font-serif text-[11px] text-slate-700">
            <strong>Resumen del Auditor:</strong> El diagnóstico preventivo ejecutado para <strong>{company.name}</strong> revela un nivel general de cumplimiento legal del {checklistComplianceRate}%. Se han registrado {criticalRisksCount} riesgos severos prioritarios en la matriz de análisis técnico. El centro de trabajo clasificado como {getRiskLevelName(company.riskLevel)} cuenta con un personal ocupado expuesto de {company.workerCount || 0} operarios. Es imprescindible que el patrón atienda con brevedad los puntos no conformes con las NOM preventivas para evitar multas de inspección laboral o siniestros operativos.
          </p>

          <h4 className="text-[9px] font-black uppercase text-slate-800 mb-1.5 leading-tight">RESUMEN DE PRIORIDADES DE ATENCIÓN DE RIESGO:</h4>
          <table className="w-full border-collapse border border-slate-200 mb-4 text-left">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-700 text-[9px]">
                <th className="border border-slate-200 p-1.5">REQUISITO O HALLAZGO CRÍTICO</th>
                <th className="border border-slate-200 p-1.5" style={{ width: '24%' }}>GRAVEDAD / SECTOR</th>
                <th className="border border-slate-200 p-1.5" style={{ width: '18%' }}>ESTATUS INICIAL</th>
                <th className="border border-slate-200 p-1.5" style={{ width: '22%' }}>ACCIÓN DEL PROGRAMA</th>
              </tr>
            </thead>
            <tbody>
              {findings.slice(0, 3).map((f, i) => (
                <tr key={f.id || i}>
                  <td className="border border-slate-200 p-1.5">
                    <span className="font-bold text-slate-800 block text-[10px]">{f.title}</span>
                    <span className="text-slate-500 text-[9px] block truncate">{f.description}</span>
                  </td>
                  <td className="border border-slate-200 p-1.5">
                    <span className="font-mono text-cherry-700 font-bold px-1.5 py-0.5 text-[8px] uppercase rounded bg-red-50 text-red-700 border border-red-100">{f.severity}</span>
                  </td>
                  <td className="border border-slate-200 p-1.5 font-semibold text-slate-600 capitalize">{f.status}</td>
                  <td className="border border-slate-200 p-1.5 text-slate-600">{f.correctiveAction || 'Medulación pendiente'}</td>
                </tr>
              ))}
              {findings.length === 0 && (
                <tr>
                  <td colSpan={4} className="border border-slate-200 p-3 text-slate-400 text-center font-mono">
                    No se han registrado hallazgos ni peligros críticos pendientes de atención en el diagnóstico.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CASE B: PROCESS TAB */}
      {activeTab === 'process' && (
        <div className="space-y-2.5">
          <h3 className="text-[10px] font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2">Ficha Técnica de Operación Industrial</h3>
          
          {(() => {
            let textDesc = "";
            let steps: any[] = [];
            let hasDiagram = false;

            if (company.processDescription) {
              try {
                const parsed = JSON.parse(company.processDescription);
                if (Array.isArray(parsed)) {
                  steps = parsed;
                  hasDiagram = true;
                } else if (parsed && typeof parsed === 'object') {
                  steps = parsed.steps || [];
                  textDesc = parsed.customText || parsed.description || "";
                  hasDiagram = steps.length > 0;
                }
              } catch (e) {
                textDesc = company.processDescription;
              }
            }

            // Fallback narrative check
            if (!textDesc && !hasDiagram) {
              textDesc = "No se ha capturado una descripción de los procesos operativos del establecimiento.";
            }

            const getStepIcon = (type: string) => {
              switch (type) {
                case 'START': return <Circle className="w-2.5 h-2.5 text-green-550 fill-green-50 shrink-0" />;
                case 'END': return <Circle className="w-2.5 h-2.5 text-red-550 fill-red-50 shrink-0" />;
                case 'DECISION': return <Diamond className="w-2.5 h-2.5 text-amber-550 fill-amber-50 shrink-0" />;
                case 'INPUT': return <Upload className="w-2.5 h-2.5 text-blue-550 shrink-0" />;
                case 'OUTPUT': return <Package className="w-2.5 h-2.5 text-blue-550 shrink-0" />;
                default: return <Square className="w-2.5 h-2.5 text-slate-400 fill-slate-50 shrink-0" />;
              }
            };

            const localGetStepIcon = (type: string) => {
              switch (type) {
                case 'START': return <Circle className="w-3 h-3 text-green-500 fill-green-50 shrink-0" />;
                case 'END': return <Circle className="w-3 h-3 text-red-500 fill-red-50 shrink-0" />;
                case 'DECISION': return <Diamond className="w-3 h-3 text-amber-500 fill-amber-50 shrink-0" />;
                case 'INPUT': return <Upload className="w-3 h-3 text-blue-500 shrink-0" />;
                case 'OUTPUT': return <Package className="w-3 h-3 text-blue-500 shrink-0" />;
                default: return <Square className="w-3 h-3 text-slate-500 fill-slate-50 shrink-0" />;
              }
            };

            const localGetStepStyle = (type: string) => {
              switch (type) {
                case 'START': return "w-[240px] rounded-full border border-green-200 bg-green-50/45 py-1.5 px-4 shadow-sm text-center";
                case 'END': return "w-[240px] rounded-full border border-red-200 bg-red-50/45 py-1.5 px-4 shadow-sm text-center";
                case 'DECISION': return "w-[120px] h-[120px] relative flex items-center justify-center bg-white";
                case 'INPUT':
                case 'OUTPUT': return "w-[240px] border border-blue-150 bg-blue-50/45 py-1.5 px-4 shadow-sm";
                default: return "w-[240px] rounded border border-slate-200 bg-white py-2 px-4 shadow-sm text-center";
              }
            };

            const renderFlowchartSlice = (stepsSlice: any[], startIndex: number, showContinuationAtEnd: boolean, showContinuationAtStart: boolean) => {
              return (
                <div className="pdf-flowchart-scroll-container w-full relative overflow-y-auto max-h-[500px] p-3 bg-slate-100 rounded-lg border border-slate-150 shadow-inner flex flex-col items-center">
                  <div className="pdf-flowchart-zoom-inner w-full flex flex-col items-center py-2">
                    
                    {/* Continuation Connector at Start of Part 2 slice */}
                    {showContinuationAtStart && (
                      <div className="flex flex-col items-center w-full relative mb-2 shrink-0 select-none">
                        <div className="flex flex-col items-center justify-center py-1">
                          <div className="w-10 h-10 rounded-full border-2 border-dashed border-blue-500 bg-blue-50 flex items-center justify-center shadow-sm relative animate-pulse font-sans">
                            <span className="text-xs font-black text-blue-600">A</span>
                          </div>
                          <span className="text-[7px] font-extrabold text-blue-600 uppercase tracking-widest mt-1">Conector A (Hoja 2)</span>
                          <span className="text-[6.5px] font-bold text-blue-400 mt-0.5 leading-none">Continuación del Proceso</span>
                        </div>
                        <div className="flex flex-col items-center relative py-1 shrink-0">
                          <div className="w-[1.5px] h-5 bg-gradient-to-b from-blue-400 to-slate-200 rounded-full my-0.5"></div>
                          <ArrowDown className="w-3 h-3 text-slate-300 absolute -bottom-1 -translate-y-1/2 stroke-[2px]" />
                        </div>
                      </div>
                    )}

                    {stepsSlice.map((step: any, sliceIdx: number) => {
                      const overallIndex = startIndex + sliceIdx;
                      return (
                        <div key={step.id || overallIndex} className="flex flex-col items-center w-full relative h-auto" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                          <div className={`flex flex-col items-center justify-center ${step.type === 'DECISION' ? 'py-4' : 'py-1.5'}`}>
                            <div className={`border flex flex-col items-center justify-center bg-white relative ${localGetStepStyle(step.type)}`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                              
                              {/* Diamond Background for DECISION */}
                              {step.type === 'DECISION' && (
                                <div className="absolute inset-0 border border-amber-300 bg-amber-50/50 rotate-45 shadow-xs" />
                              )}

                              <span className="absolute -top-1.5 left-2.5 bg-slate-100 text-slate-400 text-[6.5px] px-1 py-0.2 border border-slate-200 rounded font-black z-10 leading-none">
                                {overallIndex + 1}
                              </span>

                              {step.type === 'DECISION' ? (
                                <div className="relative z-10 flex flex-col items-center justify-center w-full px-2 text-center">
                                  <div className="opacity-50 mb-0.5 scale-75">{localGetStepIcon(step.type)}</div>
                                  <p className="text-[6.5px] font-bold text-slate-800 leading-snug max-h-[72px] overflow-hidden break-words font-sans">
                                    {step.text || "Decisión"}
                                  </p>
                                </div>
                              ) : (
                                <div className={`flex flex-col items-center w-full px-1 ${step.type === 'INPUT' || step.type === 'OUTPUT' ? 'skew-x-[12deg]' : ''}`}>
                                  <div className="flex items-center gap-1 mb-0.5 opacity-50 scale-75">
                                    {localGetStepIcon(step.type)}
                                    <span className="text-[5.5px] font-bold text-slate-500 uppercase tracking-widest">{step.type}</span>
                                  </div>
                                  <div 
                                    style={{ textAlign: step.textAlign || 'center' }}
                                    className="w-full shrink-0"
                                  >
                                    <p className="text-[7.5px] font-bold text-slate-800 leading-snug whitespace-normal break-words font-sans">
                                      {step.text || (step.type === 'START' ? 'Empieza aquí' : step.type === 'END' ? 'Finaliza aquí' : `Etapa ${overallIndex + 1}`)}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Decision Yes/No Leaves */}
                              {step.type === 'DECISION' && (
                                <>
                                  {/* YES BRANCH */}
                                  <div className="absolute left-[100%] top-1/2 -translate-y-1/2 flex items-center z-20 pl-0 mt-2">
                                    <div className="flex items-center">
                                      <div className="w-2 h-0.5 bg-blue-400 rounded-full"></div>
                                      <ArrowRight className="w-2 h-2 text-blue-500 -ml-0.5 stroke-[2.5px] shrink-0" />
                                    </div>
                                    <div className="flex flex-col items-start ml-0 bg-white/95 backdrop-blur-xs px-1 py-0.5 rounded border border-blue-100 shadow-xs font-sans scale-90 origin-left">
                                      <span className="text-[4px] font-bold text-blue-600 leading-none">SÍ</span>
                                      {step.nextStepId && (
                                        <div className="mt-0.5 text-[4px] font-medium text-blue-500 whitespace-nowrap leading-none">
                                          Ir a {steps.findIndex((s: any) => s.id === step.nextStepId) + 1 || "Fin"}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* NO BRANCH */}
                                  <div className="absolute right-[100%] top-1/2 -translate-y-1/2 flex items-center flex-row-reverse z-20 pr-0 mt-2">
                                    <div className="flex items-center flex-row-reverse">
                                      <div className="w-2 h-0.5 bg-red-400 rounded-full"></div>
                                      <ArrowRight className="w-2 h-2 text-red-500 -mr-0.5 rotate-180 stroke-[2.5px] shrink-0" />
                                    </div>
                                    <div className="flex flex-col items-end mr-0 bg-white/95 backdrop-blur-xs px-1 py-0.5 rounded border border-red-100 shadow-xs font-sans scale-90 origin-right">
                                      <span className="text-[4px] font-bold text-red-650 leading-none">NO</span>
                                      {step.altStepId && (
                                        <div className="mt-0.5 text-[4px] font-medium text-red-500 whitespace-nowrap leading-none font-sans">
                                          Ir a {steps.findIndex((s: any) => s.id === step.altStepId) + 1 || "Fin"}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Connector Arrows within flowchart slice */}
                          {(sliceIdx < stepsSlice.length - 1 || showContinuationAtEnd) && (
                            <div className="flex flex-col items-center relative py-0.5 shrink-0 font-sans font-sans">
                              <div className={`w-[1.5px] bg-gradient-to-b from-slate-200 to-slate-100 rounded-full ${step.type === 'DECISION' ? 'h-4 -mt-3 mb-1' : 'h-5 my-0.5'}`}></div>
                              <ArrowDown className="w-3 h-3 text-slate-300 absolute -bottom-1 -translate-y-1/2 stroke-[2px]" />
                              
                              {step.nextStepId && step.type !== 'DECISION' && (
                                <div className="absolute top-1/2 -translate-y-1/2 -right-4 translate-x-full px-2 py-0.5 bg-slate-900 text-white text-[7px] font-bold uppercase rounded shadow-sm flex items-center gap-1 whitespace-nowrap z-30 leading-none">
                                  <Workflow className="w-2 h-2 text-blue-400" />
                                  Salto a {steps.findIndex((s: any) => s.id === step.nextStepId) + 1 || "Fin"}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Continuation Connector at bottom of Page 1 flowchart slice */}
                    {showContinuationAtEnd && (
                      <div className="flex flex-col items-center w-full relative mt-2 shrink-0 select-none">
                        <div className="flex flex-col items-center justify-center py-1 font-sans">
                          <div className="w-10 h-10 rounded-full border-2 border-dashed border-blue-500 bg-blue-50 flex items-center justify-center shadow-sm relative animate-pulse">
                            <span className="text-xs font-black text-blue-600">A</span>
                          </div>
                          <span className="text-[7px] font-extrabold text-blue-600 uppercase tracking-widest mt-1">Conector A (Continúa)</span>
                          <span className="text-[6.5px] font-bold text-blue-400 mt-0.5 leading-none">Ver en Siguiente Hoja</span>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              );
            };

            return (
              <div 
                className={`grid grid-cols-12 gap-3 items-start ${steps.length > 5 ? "" : "pdf-no-break"}`}
                style={steps.length > 5 ? {} : { pageBreakInside: "avoid", breakInside: "avoid" }}
              >
                {/* COLUMN 1: NARRATIVE AND METADATA */}
                <div className="col-span-5 space-y-2.5">
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-2.5">
                    <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Descripción del Proceso</span>
                    <div className="text-slate-705 leading-normal text-justify text-[8.5px] whitespace-pre-wrap">
                      {textDesc && (
                        <p className="text-slate-800 leading-normal text-justify text-[8.5px] mb-1.5">
                          {textDesc}
                        </p>
                      )}
                      
                      {steps.length > 0 && (
                        <div className="border-t border-slate-200/50 pt-1.5 mt-1.5">
                          <p className="font-bold text-slate-800 text-[8px] mb-1">Fases cronológicas y operativas:</p>
                          <div className="space-y-1 font-sans max-h-[140px] overflow-y-auto">
                            {steps.slice(0, 15).map((p: any, idx: number) => (
                              <div key={idx} className="flex gap-1 items-start text-[7.5px] leading-tight">
                                <span className="font-extrabold text-slate-500 font-mono shrink-0">{idx + 1}.</span>
                                <p className="text-slate-700">{p.text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Primarias / Maquinarias */}
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-2.5 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wide block">Materias Primas</span>
                      <p className="text-[8px] text-slate-650 font-bold mt-0.5 uppercase leading-tight whitespace-pre-wrap">
                        {company.rawMaterials ? company.rawMaterials.split('\n').filter(Boolean).join(', ') : "No especificadas"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wide block">Maquinaria y Equipos</span>
                      <p className="text-[8px] text-slate-650 font-bold mt-0.5 uppercase leading-tight whitespace-pre-wrap">
                        {company.machinery ? company.machinery.split('\n').filter(Boolean).join(', ') : "No registradas"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* COLUMN 2: THE FLOWCHART / DIAGRAM */}
                <div className="col-span-7 space-y-2.5">
                  <div className="p-2 border border-slate-150 rounded-xl bg-slate-50 w-full overflow-hidden pdf-no-break" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <span className="text-[7px] font-black text-slate-500 uppercase block mb-1 text-center tracking-[0.08em]">Diagrama de Flujo del Proceso</span>
                    
                    {steps.length > 0 ? (
                      steps.length > 5 ? (
                        renderFlowchartSlice(steps.slice(0, 5), 0, true, false)
                      ) : (
                        renderFlowchartSlice(steps, 0, false, false)
                      )
                    ) : (
                      <div className="p-3 text-center bg-white border border-slate-150 rounded-lg text-slate-400 italic text-[8.5px]">
                        Diagrama de flujo sin etapas preliminares registradas.
                      </div>
                    )}
                  </div>

                  {/* Uploaded process file or croquis */}
                  {company.processFileUrl && (
                    <div className="border border-slate-200 p-1 bg-white rounded-xl shadow-xs w-full flex flex-col items-center justify-center">
                      <span className="text-[6.5px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Croquis de Proceso Cargado</span>
                      {company.processFileUrl.startsWith('data:application/pdf') ? (
                        <div className="p-2 text-center flex flex-col items-center justify-center">
                          <span className="text-[7px] font-bold text-slate-505 uppercase">Diagrama en PDF</span>
                          <p className="text-[6px] text-slate-400 mt-0.5 leading-normal">El croquis de proceso se guardó en formato PDF. Cargue un formato PNG o JPG para verlo como imagen.</p>
                        </div>
                      ) : (
                        <img 
                          src={company.processFileUrl} 
                          alt="Archivo del Proceso" 
                          className="max-h-[72px] max-w-full object-contain rounded border border-slate-100"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* CONDITIONAL COMPONENT: SPLIT PAGINATED PART 2 BLOCK FOR MULTIPAGE FLOWCHARTS */}
                {steps.length > 5 && (
                  <div 
                    className="col-span-12 page-break-before py-3 print:py-0 w-full"
                    style={{ pageBreakBefore: 'always', breakBefore: 'page' }}
                  >
                    <div className="p-3 border border-slate-150 rounded-xl bg-slate-50 w-full overflow-hidden pdf-no-break" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                      <span className="text-[8px] font-black text-rose-500 uppercase block mb-2 text-center tracking-[0.1em]">
                        Diagrama de Flujo del Proceso (Continuación - Hoja 2)
                      </span>
                      {renderFlowchartSlice(steps.slice(5), 5, false, true)}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* CASE C: LOCALIZATION TAB */}
      {activeTab === 'localization' && (
        <div>
          <h3 className="text-[10px] font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2">Entorno Geográfico y Datos de Geolocalización</h3>
          
          <div className="grid grid-cols-3 gap-3 mb-4 text-center">
            <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg">
              <span className="text-[8px] font-semibold text-slate-500 uppercase block">Latitud Científica</span>
              <span className="text-xs font-mono font-bold text-slate-800">{company.latitude || 'Sin capturar'}</span>
            </div>
            <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg">
              <span className="text-[8px] font-semibold text-slate-500 uppercase block">Longitud Científica</span>
              <span className="text-xs font-mono font-bold text-slate-800">{company.longitude || 'Sin capturar'}</span>
            </div>
            <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg">
              <span className="text-[8px] font-semibold text-slate-500 uppercase block">Altitud s/ nivel de mar</span>
              <span className="text-xs font-mono font-bold text-slate-800">{company.altitude ? `${company.altitude} msnm` : 'Sin capturar'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[8px] font-bold text-slate-500 uppercase block">Límites y Condiciones de Accesibilidad Vial</span>
              <p className="text-slate-700 text-[10.5px] font-serif text-justify mt-1">
                {company.accessibilityDescription || 'No se han descrito las vías de acceso prioritarias ni las colindancias del predio en el sistema.'}
              </p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[8px] font-bold text-slate-500 uppercase block">Nota del Atlas de Riesgos Regional</span>
              <p className="text-slate-700 text-[10.5px] font-serif text-justify mt-1">
                {company.atlasRiesgosNotes || 'Firma no asociada a especificaciones regionales de Atlas de Riesgos o Protección Civil.'}
              </p>
            </div>
          </div>

          {company.localizationSketch && (
            <div className="mt-2 border border-slate-200 p-2 rounded-xl text-center bg-slate-50">
              <span className="text-[8px] font-mono text-slate-400 block mb-1.5 uppercase">Archivo de Croquis Registrado como Evidencia de Campo</span>
              {company.localizationSketch.startsWith('data:application/pdf') ? (
                <div className="p-4 bg-white rounded border flex flex-col items-center justify-center text-center">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Croquis subido como PDF</span>
                  <p className="text-[8px] text-slate-400 mt-1 leading-normal">El mapa de localización se encuentra guardado en formato PDF. Para verlo aquí, cargue una imagen PNG/JPG.</p>
                </div>
              ) : (
                <img src={company.localizationSketch} alt="Croquis localización" className="max-h-72 object-contain mx-auto rounded border border-slate-200" referrerPolicy="no-referrer" />
              )}
            </div>
          )}
        </div>
      )}

      {/* CASE D: LAYOUT TAB */}
      {activeTab === 'layout' && (
        <div>
          <h3 className="text-[10px] font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2">Análisis de Infraestructura y Régimen de Planta</h3>
          
          <div className="grid grid-cols-3 gap-3 mb-4 text-center">
            <div className="p-2 bg-slate-50 rounded-lg border">
              <span className="text-[8px] text-slate-500 block">Superficie Terreno</span>
              <span className="text-xs font-bold text-slate-800">{company.totalPlotArea ? `${company.totalPlotArea} m²` : 'No registrada'}</span>
            </div>
            <div className="p-2 bg-slate-50 rounded-lg border">
              <span className="text-[8px] text-slate-500 block">Superficie Construida</span>
              <span className="text-xs font-bold text-slate-800">{company.totalBuiltArea ? `${company.totalBuiltArea} m²` : 'No registrada'}</span>
            </div>
            <div className="p-2 bg-slate-50 rounded-lg border">
              <span className="text-[8px] text-slate-500 block">Régimen Legal Propiedad</span>
              <span className="text-xs font-bold text-blue-800 uppercase">{company.propertyStatus || 'No definido'}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl mb-4">
            <span className="text-[8px] font-bold text-slate-500 uppercase block">Descripción General de Infraestructura, Almacenes y Áreas de Trabajo</span>
            <p className="text-slate-700 text-[10.5px] font-serif mt-1 whitespace-pre-line text-justify">
              {company.infrastructureDescription || 'El usuario no ha detallado la estructura física, materiales de construcción ni zonas críticas de almacenamiento en el sistema.'}
            </p>
          </div>

          {company.layoutUrl && (
            <div className="mt-2 text-center border p-2 bg-slate-50 rounded-xl">
              <span className="text-[8px] text-slate-400 block mb-1">Carga Digital de Plano General / Croquis de Distribución</span>
              {company.layoutUrl.startsWith('data:application/pdf') ? (
                <div className="p-4 bg-white rounded border flex flex-col items-center justify-center text-center">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Plano cargado como PDF</span>
                  <p className="text-[8px] text-slate-400 mt-1 leading-normal">El plano de planta se encuentra guardado en formato PDF. Para verlo aquí, cargue una imagen PNG/JPG.</p>
                </div>
              ) : (
                <img src={company.layoutUrl} alt="Plano de planta" className="max-h-72 object-contain mx-auto rounded border" referrerPolicy="no-referrer" />
              )}
            </div>
          )}
        </div>
      )}

      {/* CASE E: LEGAL OBLIGATIONS TAB */}
      {activeTab === 'legal' && (
        <div>
          <h3 className="text-[10px] font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2">Evaluación del Cumplimiento de Obligaciones Generales</h3>
          
          <div className="p-3 bg-blue-50/20 rounded-xl border border-blue-100 flex items-center justify-between mb-4">
            <div>
              <span className="text-[9px] font-bold text-blue-900 block">CUMPLIMIENTO GLOBAL DE NORMAS STPS:</span>
              <p className="text-[10px] text-slate-600">Basado en la auto-evaluación interactiva de la plantilla canónica</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-blue-700">{checklistComplianceRate}%</span>
            </div>
          </div>

          <table className="w-full border-collapse border border-slate-200 text-left mb-4">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-700 text-[9px]">
                <th className="border border-slate-200 p-2" style={{ width: '15%' }}>CÓDIGO NOM</th>
                <th className="border border-slate-200 p-2">REQUISITO EVALUADO GENERAL</th>
                <th className="border border-slate-200 p-2 text-center" style={{ width: '22%' }}>NIVEL DE CUMPLIMIENTO</th>
                <th className="border border-slate-200 p-2" style={{ width: '25%' }}>APRECIACIÓN / COMENTARIO</th>
              </tr>
            </thead>
            <tbody>
              {checklistItems.map((itm, i) => (
                <tr key={itm.id || i}>
                  <td className="border border-slate-200 p-2 font-black font-mono text-slate-800">{itm.nomCode}</td>
                  <td className="border border-slate-200 p-2 text-slate-700">{itm.requirement}</td>
                  <td className="border border-slate-200 p-2 text-center font-bold">
                    <span className={`px-2 py-0.5 rounded text-[8px] uppercase ${
                      itm.compliance === 'compliance' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      itm.compliance === 'non_compliance' ? 'bg-red-50 text-red-700 border border-red-100' :
                      itm.compliance === 'partial' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      'bg-slate-50 text-slate-500'
                    }`}>
                      {itm.compliance === 'compliance' ? 'Conforme' :
                       itm.compliance === 'non_compliance' ? 'No Conforme' :
                       itm.compliance === 'partial' ? 'Parcial' : 'N/A'}
                    </span>
                  </td>
                  <td className="border border-slate-200 p-2 text-slate-500 font-serif">{itm.comments || 'Sin comentarios registrados.'}</td>
                </tr>
              ))}
              {checklistItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="border border-slate-200 p-4 text-center text-slate-400 font-mono">
                    No se han cargado respuestas a la matriz general de obligaciones jurídicas de seguridad.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CASE F: LEGAL MATRIX EVALUATION (STPS) */}
      {activeTab === 'legal_matrix' && (
        <div>
          <h3 className="text-[10px] font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2">Requisitos de Evaluación de Normas Oficiales Mexicanas</h3>
          
          <div className="grid grid-cols-3 gap-3 mb-4 text-center">
            <div className="p-2 bg-slate-50 border rounded-lg">
              <span className="text-[8px] text-slate-500 block">Normas Aplicables</span>
              <span className="text-xs font-bold text-slate-800">{legalMatrix.filter(l => l.applies === true).length} NOMs</span>
            </div>
            <div className="p-2 bg-slate-50 border rounded-lg">
              <span className="text-[8px] text-slate-500 block font-semibold text-cherry-700">Normas No Aplicables</span>
              <span className="text-xs font-bold text-slate-800">{legalMatrix.filter(l => l.applies === false).length} NOMs</span>
            </div>
            <div className="p-2 bg-slate-50 border rounded-lg">
              <span className="text-[8px] text-slate-500 block">Total Evaluadas</span>
              <span className="text-xs font-bold text-slate-800">{legalMatrix.length} directrices</span>
            </div>
          </div>

          <table className="w-full border-collapse border border-slate-200 text-left mb-4">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-700 text-[9px]">
                <th className="border border-slate-200 p-2" style={{ width: '12%' }}>AUTORIDAD</th>
                <th className="border border-slate-200 p-2" style={{ width: '22%' }}>CÓDIGO/REGLAMENTO</th>
                <th className="border border-slate-200 p-2">DESCRIPCIÓN DE LA ACCIÓN / TRÁMITE</th>
                <th className="border border-slate-200 p-2 text-center" style={{ width: '14%' }}>APLICA</th>
                <th className="border border-slate-200 p-2" style={{ width: '20%' }}>NOTAS ADICIONALES</th>
              </tr>
            </thead>
            <tbody>
              {legalMatrix.slice(0, 10).map((m, idx) => (
                <tr key={m.id || idx}>
                  <td className="border border-slate-200 p-2 font-bold font-mono text-slate-800">{m.authority}</td>
                  <td className="border border-slate-200 p-2 font-semibold font-mono text-slate-700 text-[10px]">{m.nomCode}</td>
                  <td className="border border-slate-200 p-2 text-slate-800 font-serif">{m.requirement}</td>
                  <td className="border border-slate-200 p-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-[8px] uppercase font-bold ${
                      m.applies === true ? 'bg-emerald-55 text-emerald-800 bg-emerald-50 border border-emerald-100' :
                      m.applies === false ? 'bg-rose-50 text-rose-800 border-rose-100' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {m.applies === true ? 'Aplica' : m.applies === false ? 'No Aplica' : 'N/E'}
                    </span>
                  </td>
                  <td className="border border-slate-200 p-2 text-slate-500 font-serif leading-tight">{m.notes || '-'}</td>
                </tr>
              ))}
              {legalMatrix.length === 0 && (
                <tr>
                  <td colSpan={5} className="border border-slate-200 p-4 text-center text-slate-400 font-mono">
                    No se han registrado parámetros normativos en esta matriz laboral.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CASE G: RISKS CLASSIFICATION MATRIX */}
      {activeTab === 'risks' && (
        <div>
          <h3 className="text-[10px] font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2">Evaluación Técnica de Peligros y Niveles de Siniestro</h3>
          
          <div className="grid grid-cols-3 gap-3 mb-4 text-center">
            <div className="p-2 border bg-red-50/20 border-red-100 rounded-lg">
              <span className="text-[8px] text-red-700 block font-bold">Riesgos Críticos / Altos</span>
              <span className="text-xs font-black text-red-650 text-red-600">{criticalRisksCount} identificados</span>
            </div>
            <div className="p-2 border bg-amber-50/10 border-amber-100 rounded-lg">
              <span className="text-[8px] text-amber-700 block font-bold">Riesgos Medios / Notables</span>
              <span className="text-xs font-black text-amber-600">{mediumRisksCount} detectados</span>
            </div>
            <div className="p-2 border bg-slate-50 rounded-lg">
              <span className="text-[8px] text-slate-500 block font-medium">Riesgos Leves / Tolerables</span>
              <span className="text-xs font-black text-slate-700">{lowRisksCount} identificados</span>
            </div>
          </div>

          <table className="w-full border-collapse border border-slate-200 text-left mb-4">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-700 text-[9px]">
                <th className="border border-slate-200 p-2" style={{ width: '22%' }}>ÁREA / PROCESO</th>
                <th className="border border-slate-200 p-2">PELIGRO / RIESGO CONCRETO</th>
                <th className="border border-slate-200 p-2 text-center" style={{ width: '12%' }}>MÉTODO</th>
                <th className="border border-slate-200 p-2 text-center" style={{ width: '14%' }}>CRITICIDAD</th>
                <th className="border border-slate-200 p-2" style={{ width: '24%' }}>CONTROLES REGISTRADOS</th>
              </tr>
            </thead>
            <tbody>
              {riskAssessments.slice(0, 10).map((risk, i) => (
                <tr key={risk.id || i}>
                  <td className="border border-slate-200 p-2 font-bold text-slate-900">{risk.processName}</td>
                  <td className="border border-slate-200 p-2">
                    <span className="font-semibold text-slate-850 block">{risk.hazard}</span>
                    <span className="text-[9px] text-slate-500 block truncate">{risk.activity}</span>
                  </td>
                  <td className="border border-slate-200 p-2 text-center font-mono capitalize">{risk.method}</td>
                  <td className="border border-slate-200 p-2 text-center font-bold">
                    <span className={`px-2 py-0.5 rounded text-[8px] uppercase ${
                      risk.priority === 'very_high' || risk.priority === 'high' ? 'bg-red-55 text-red-800 bg-red-50 border border-red-100' :
                      risk.priority === 'medium' ? 'bg-amber-50 text-amber-805 text-amber-700 border border-amber-100' :
                      'bg-slate-55 text-slate-700 bg-slate-50 border border-slate-200'
                    }`}>
                      {risk.priority === 'very_high' ? 'Crítico (GP)' :
                       risk.priority === 'high' ? 'Alto (GP)' :
                       risk.priority === 'medium' ? 'Medio' : 'Leve'}
                    </span>
                    <span className="block text-[8px] text-slate-400 font-mono mt-0.5">Score: {risk.riskLevel}</span>
                  </td>
                  <td className="border border-slate-200 p-2 text-slate-600 font-serif leading-tight">{risk.controls || 'Sin controles asignados.'}</td>
                </tr>
              ))}
              {riskAssessments.length === 0 && (
                <tr>
                  <td colSpan={5} className="border border-slate-200 p-4 text-center text-slate-400 font-mono">
                    No se han registrado incidentes ni riesgos evaluados en la matriz.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CASE H: SURROUNDING HAZARDS TAB */}
      {activeTab === 'surrounding_hazards' && (
        <div>
          <h3 className="text-[10px] font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2">Amenazas Geográficas, Industriales y Sociales Externas</h3>
          
          <table className="w-full border-collapse border border-slate-200 text-left mb-4">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-700 text-[9px]">
                <th className="border border-slate-200 p-2" style={{ width: '15%' }}>CATEGORÍA</th>
                <th className="border border-slate-200 p-2" style={{ width: '22%' }}>ORIGEN / FUENTE</th>
                <th className="border border-slate-200 p-2 text-center" style={{ width: '12%' }}>DISTANCIA</th>
                <th className="border border-slate-200 p-2 text-center" style={{ width: '12%' }}>NIVEL RIESGO</th>
                <th className="border border-slate-200 p-2">MEDIDAS DE MITIGACIÓN / PROTECCIÓN CIVIL</th>
              </tr>
            </thead>
            <tbody>
              {surroundingHazards.map((hz, i) => (
                <tr key={hz.id || i}>
                  <td className="border border-slate-200 p-2 font-bold text-slate-800 capitalize">{hz.hazardType}</td>
                  <td className="border border-slate-200 p-2 font-semibold text-slate-700">{hz.source}</td>
                  <td className="border border-slate-200 p-2 text-center">{hz.distance}</td>
                  <td className="border border-slate-200 p-2 text-center font-bold">
                    <span className={`px-2 py-0.5 rounded text-[8px] ${
                      hz.riskLevel >= 15 ? 'bg-red-50 text-red-700 border border-red-100 font-bold' :
                      hz.riskLevel >= 8 ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      Grado {hz.riskLevel} / 25
                    </span>
                  </td>
                  <td className="border border-slate-200 p-2 text-slate-650 font-serif leading-tight">{hz.mitigationMeasures}</td>
                </tr>
              ))}
              {surroundingHazards.length === 0 && (
                <tr>
                  <td colSpan={5} className="border border-slate-200 p-4 text-center text-slate-400 font-mono">
                    No se han registrado amenazas ni factores de riesgo externos del entorno en la bitácora.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CASE I: ACCIDENTAL LABOR LOG */}
      {activeTab === 'accident_analysis' && (
        <div>
          <h3 className="text-[10px] font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2">Indicadores Estadísticos de Siniestralidad (IMSS / STPS)</h3>
          
          <div className="grid grid-cols-4 gap-2.5 mb-5 text-center">
            <div className="p-2 border border-slate-200 bg-slate-50 rounded-xl">
              <span className="text-[8px] text-slate-500 uppercase block">Accidentes Totales</span>
              <span className="text-sm font-black text-slate-800">{totalAccidents}</span>
            </div>
            <div className="p-2 border border-slate-200 bg-slate-50 rounded-xl">
              <span className="text-[8px] text-slate-500 uppercase block">Incapacidades Médicas</span>
              <span className="text-sm font-black text-slate-800">{totalIllnesses}</span>
            </div>
            <div className="p-2 border border-slate-200 bg-slate-50 rounded-xl">
              <span className="text-[8px] text-slate-500 uppercase block">Días Perdidos de Trabajo</span>
              <span className="text-sm font-black text-red-650 text-red-600">{totalDaysLost} d</span>
            </div>
            <div className="p-2 border border-red-100 bg-red-50/20 rounded-xl">
              <span className="text-[8px] text-red-700 uppercase block font-bold">Defunciones Reportadas</span>
              <span className="text-sm font-black text-red-750 text-red-700">{totalDeaths} def</span>
            </div>
          </div>

          {/* Mathematical formulation block */}
          <div className="p-3 bg-slate-950 text-white rounded-xl mb-4 text-[9.5px] font-mono leading-relaxed">
            <span className="text-amber-400 font-black block text-[10px] uppercase mb-1">Ecuaciones de Siniestralidad Calculadas:</span>
            <p><strong>Fórmula de Frecuencia (IF):</strong> (Accidentes × 200,000) / H.T.W. = <strong className="text-amber-300">
              {company.totalHoursWorked ? ((totalAccidents * 200000) / company.totalHoursWorked).toFixed(2) : 'N/A' }
            </strong> (accidentes por cada 100 operarios de tiempo completo al año)</p>
            <p className="mt-1"><strong>Fórmula de Gravedad (IG):</strong> (Días perdidos × 1,000) / H.T.W. = <strong className="text-amber-300">
              {company.totalHoursWorked ? ((totalDaysLost * 1000) / company.totalHoursWorked).toFixed(2) : 'N/A' }
            </strong> (días perdidos por cada 1,000 horas de exposición al riesgo)</p>
          </div>

          <h4 className="text-[8px] font-black uppercase text-slate-800 mb-1 leading-tight">HISTORIAL CRONOLÓGICO DE EVENTOS REGISTRADOS:</h4>
          <table className="w-full border-collapse border border-slate-200 text-left mb-4">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-700 text-[9px]">
                <th className="border border-slate-200 p-2" style={{ width: '14%' }}>FECHA EVENTO</th>
                <th className="border border-slate-200 p-2" style={{ width: '24%' }}>COLABORADOR / DEPTO</th>
                <th className="border border-slate-200 p-2" style={{ width: '16%' }}>TIPO ACCIDENTE</th>
                <th className="border border-slate-200 p-2 text-center" style={{ width: '12%' }}>DÍAS PERDIDOS</th>
                <th className="border border-slate-100 border-r border-slate-200 p-2">SINOPSIS / LESIÓN OCASIONADA</th>
              </tr>
            </thead>
            <tbody>
              {accidentEvents.slice(0, 8).map((evt, idx) => (
                <tr key={evt.id || idx}>
                  <td className="border border-slate-200 p-2 font-mono">{new Date(evt.date).toLocaleDateString('es-MX')}</td>
                  <td className="border border-slate-200 p-2">
                    <span className="font-bold text-slate-900 block truncate">{evt.workerName || 'Anónimo'}</span>
                    <span className="text-[9px] text-slate-500 block truncate">{evt.department || 'Operativo'}</span>
                  </td>
                  <td className="border border-slate-200 p-2 text-slate-850 capitalize leading-none text-slate-705">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] ${
                      evt.type === 'accident' ? 'bg-red-50 text-red-700 border border-red-100 font-semibold' :
                      evt.type === 'near_miss' ? 'bg-amber-50 text-amber-700 border border-amber-50' :
                      'bg-slate-50 text-slate-500'
                    }`}>
                      {evt.type === 'accident' ? 'Accidente' :
                       evt.type === 'near_miss' ? 'Casi-Accidente' : evt.type}
                    </span>
                  </td>
                  <td className="border border-slate-200 p-2 text-center font-bold text-red-650 text-red-700">{evt.daysLost} días</td>
                  <td className="border border-slate-200 p-2 text-slate-600 font-serif leading-tight">{evt.description}</td>
                </tr>
              ))}
              {accidentEvents.length === 0 && (
                <tr>
                  <td colSpan={5} className="border border-slate-200 p-4 text-center text-slate-400 font-mono">
                    No se han registrado eventos de incapacidad o accidentes en el sistema.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CASE J: SAFETY PROGRAM NOM-030 */}
      {activeTab === 'compliance' && (
        <div>
          <h3 className="text-[10px] font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2">Programa Operativo de Medidas Preventivas de Seguridad</h3>
          
          <div className="grid grid-cols-3 gap-3 mb-4 text-center">
            <div className="p-2 bg-slate-50 border rounded-lg">
              <span className="text-[8px] text-slate-500 block font-semibold">Tareas Pendientes</span>
              <span className="text-xs font-bold text-slate-800">{safetyProgram.filter(p => p.status === 'pending').length} de {safetyProgram.length}</span>
            </div>
            <div className="p-2 bg-slate-50 border rounded-lg">
              <span className="text-[8px] text-slate-500 block font-semibold text-emerald-700">Tareas Completadas</span>
              <span className="text-xs font-bold text-slate-800">{safetyProgram.filter(p => p.status === 'completed').length} de {safetyProgram.length}</span>
            </div>
            <div className="p-2 bg-slate-50 border rounded-lg">
              <span className="text-[8px] text-slate-500 block font-semibold text-blue-700">Porcentaje de Avance Operativo</span>
              <span className="text-xs font-black text-blue-800">
                {safetyProgram.length > 0 
                  ? Math.round((safetyProgram.filter(p => p.status === 'completed').length / safetyProgram.length) * 100) 
                  : 0}% Avance
              </span>
            </div>
          </div>

          <table className="w-full border-collapse border border-slate-200 text-left mb-4">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-700 text-[9px]">
                <th className="border border-slate-200 p-2" style={{ width: '10%' }}>SECCIÓN</th>
                <th className="border border-slate-200 p-2" style={{ width: '30%' }}>ACCIÓN PREVENTIVA PROGRAMADA</th>
                <th className="border border-slate-200 p-2 text-center" style={{ width: '24%' }}>FOTOS (ANTES / DESPUÉS)</th>
                <th className="border border-slate-200 p-2" style={{ width: '14%' }}>RESPONSABLE / ENCARGADO</th>
                <th className="border border-slate-200 p-2 text-center" style={{ width: '10%' }}>ESTATUS</th>
                <th className="border border-slate-200 p-2 text-center" style={{ width: '12%' }}>FECHA LIMITE</th>
              </tr>
            </thead>
            <tbody>
              {safetyProgram.slice(0, 10).map((prog, idx) => (
                <tr key={prog.id || idx}>
                  <td className="border border-slate-200 p-2 font-mono font-bold text-slate-755 text-slate-800">Cla. {prog.nomSection}</td>
                  <td className="border border-slate-200 p-2">
                    <span className="font-bold text-slate-850 block">{prog.action}</span>
                    <span className="text-[9px] text-slate-500 block font-mono">Norma Ref: {prog.referenceNorm || 'NOM-030'}</span>
                  </td>
                  <td className="border border-slate-200 p-2 text-center">
                    {(prog.beforeEvidenceUrl || prog.afterEvidenceUrl) ? (
                      <div className="flex gap-2 justify-center">
                        {prog.beforeEvidenceUrl && (
                          <div className="inline-flex flex-col items-center bg-slate-50 p-1 rounded border border-slate-200">
                            <span className="text-[7px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Antes</span>
                            <img src={prog.beforeEvidenceUrl} className="max-h-12 max-w-[80px] object-cover rounded" referrerPolicy="no-referrer" />
                          </div>
                        )}
                        {prog.afterEvidenceUrl && (
                          <div className="inline-flex flex-col items-center bg-emerald-50/50 p-1 rounded border border-emerald-100">
                            <span className="text-[7px] text-emerald-700 font-bold uppercase tracking-wider mb-0.5">Después</span>
                            <img src={prog.afterEvidenceUrl} className="max-h-12 max-w-[80px] object-cover rounded" referrerPolicy="no-referrer" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[8px] text-slate-400 italic font-mono">- Sin fotos -</span>
                    )}
                  </td>
                  <td className="border border-slate-200 p-2 text-slate-700 font-semibold">{prog.responsible}</td>
                  <td className="border border-slate-200 p-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-bold ${
                      prog.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-55 text-amber-805 bg-amber-50 border border-amber-100'
                    }`}>
                      {prog.status === 'completed' ? 'Completada' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="border border-slate-200 p-2 text-center font-mono text-slate-500">
                    {new Date(prog.endDate).toLocaleDateString('es-MX')}
                  </td>
                </tr>
              ))}
              {safetyProgram.length === 0 && (
                <tr>
                  <td colSpan={6} className="border border-slate-200 p-4 text-center text-slate-400 font-mono">
                    No se han registrado medidas programadas de seguridad para la empresa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* DIAGNÓSTICO NORMATIVO (OBLIGACIONES DEL PATRÓN) INCLUDED IN SAFETY PROGRAM EXPORT */}
          <div className="mt-8 pt-6 border-t border-dashed border-slate-200 page-break-before">
            <h3 className="text-[10px] font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2">Diagnóstico Normativo - Obligaciones del Patrón</h3>
            
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between mb-4">
              <div>
                <span className="text-[9px] font-bold text-slate-700 block uppercase tracking-wider">Cumplimiento Global (NOM-030-STPS)</span>
                <p className="text-[10px] text-slate-500">Evaluación oficial de las obligaciones fundamentales del patrón en seguridad y salud.</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-indigo-700">{checklistComplianceRate}%</span>
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-200 text-left mb-4">
              <thead>
                <tr className="bg-slate-50 font-bold text-slate-700 text-[9px]">
                  <th className="border border-slate-200 p-2" style={{ width: '15%' }}>CÓDIGO NOM</th>
                  <th className="border border-slate-200 p-2">REQUISITO EVALUADO GENERAL</th>
                  <th className="border border-slate-200 p-2 text-center" style={{ width: '22%' }}>NIVEL DE CUMPLIMIENTO</th>
                  <th className="border border-slate-200 p-2" style={{ width: '25%' }}>APRECIACIÓN / COMENTARIO</th>
                </tr>
              </thead>
              <tbody>
                {checklistItems.map((itm, i) => (
                  <tr key={itm.id || i}>
                    <td className="border border-slate-200 p-2 font-black font-mono text-slate-800">{itm.nomCode}</td>
                    <td className="border border-slate-200 p-2 text-slate-700">{itm.requirement}</td>
                    <td className="border border-slate-200 p-2 text-center font-bold">
                      <span className={`px-2 py-0.5 rounded text-[8px] uppercase ${
                        itm.compliance === 'compliance' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        itm.compliance === 'non_compliance' ? 'bg-red-50 text-red-700 border border-red-100' :
                        itm.compliance === 'partial' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        'bg-slate-50 text-slate-500'
                      }`}>
                        {itm.compliance === 'compliance' ? 'Conforme' :
                         itm.compliance === 'non_compliance' ? 'No Conforme' :
                         itm.compliance === 'partial' ? 'Parcial' : 'N/A'}
                      </span>
                    </td>
                    <td className="border border-slate-200 p-2 text-slate-500 font-serif">{itm.comments || 'Sin comentarios registrados.'}</td>
                  </tr>
                ))}
                {checklistItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="border border-slate-200 p-4 text-center text-slate-400 font-mono">
                      No se han cargado respuestas a la matriz general de obligaciones jurídicas de seguridad.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CASE K: COMPLIANCE LOGS EV_LOG */}
      {activeTab === 'compliance_log' && (
        <div>
          <h3 className="text-[10px] font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2">Bitácora e Historial de Evidencias de Capacitación (DC-3)</h3>

          <table className="w-full border-collapse border border-slate-200 text-left mb-4">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-700 text-[9px]">
                <th className="border border-slate-200 p-2" style={{ width: '14%' }}>FECHA CARGA</th>
                <th className="border border-slate-200 p-2" style={{ width: '16%' }}>TIPO ENTRADA</th>
                <th className="border border-slate-200 p-2">DENOMINACIÓN / CURSO CAPACITACIÓN STPS</th>
                <th className="border border-slate-200 p-2" style={{ width: '22%' }}>COLABORADOR / PUESTO</th>
                <th className="border border-slate-200 p-2 text-center" style={{ width: '15%' }}>AVANCE / DC-3</th>
              </tr>
            </thead>
            <tbody>
              {evidences.map((ev, idx) => (
                <tr key={ev.id || idx}>
                  <td className="border border-slate-200 p-2 font-mono">{new Date(ev.date).toLocaleDateString('es-MX')}</td>
                  <td className="border border-slate-200 p-2">
                    <span className="font-semibold text-slate-600 block uppercase text-[9px]">{ev.entryType}</span>
                  </td>
                  <td className="border border-slate-200 p-2">
                    <span className="font-bold text-slate-900 font-serif block">{ev.title}</span>
                    {ev.fileUrl && ev.fileUrl.startsWith('data:image/') && (
                      <div className="mt-1.5 p-1 border border-slate-200 rounded bg-white block max-w-[150px] shadow-sm">
                        <img 
                          src={ev.fileUrl} 
                          alt={ev.fileName || "Evidencia"} 
                          className="max-h-16 max-w-full object-contain rounded"
                          referrerPolicy="no-referrer"
                        />
                        <span className="text-[7px] text-slate-400 font-mono block truncate mt-0.5">{ev.fileName}</span>
                      </div>
                    )}
                  </td>
                  <td className="border border-slate-200 p-2 text-slate-705 font-medium">{ev.role || 'Operario de planta'}</td>
                  <td className="border border-slate-200 p-2 text-center text-slate-800 font-bold">
                    {ev.entryType === 'progress' ? `${ev.progressPercentage || 0}% Avance` : 'DC-3 Registrado'}
                  </td>
                </tr>
              ))}
              {evidences.length === 0 && (
                <tr>
                  <td colSpan={5} className="border border-slate-200 p-4 text-center text-slate-400 font-mono">
                    No se han registrado certificados académicos, cursos o bitácoras de entrenamiento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Validation and Signature Section */}
      <div className="mt-8 pt-6 border-t border-slate-350 grid grid-cols-2 gap-6">
        <div className="text-center flex flex-col items-center justify-between min-h-[140px] pr-4 border-r border-slate-200">
          <div>
            <span className="text-[8px] font-bold text-slate-400 uppercase block tracking-wider">RESPONSABLE TÉCNICO REGISTRADO</span>
            <p className="font-bold text-slate-900 border-b border-slate-200 pb-1 text-[11px] uppercase mt-2">{company.responsibleName || 'Responsable NOM-030'}</p>
            <span className="text-[8px] text-slate-500 uppercase mt-0.5 block leading-none">Coordinador de Seguridad e Higiene Laboral</span>
          </div>
          
          <div className="mt-4 flex flex-col items-center justify-center">
            {company.responsibleSignature && !company.responsibleSignature.startsWith('data:application/pdf') ? (
              <img src={company.responsibleSignature} alt="Firma digital" className="h-16 object-contain mix-blend-multiply" referrerPolicy="no-referrer" />
            ) : company.responsibleSignature && company.responsibleSignature.startsWith('data:application/pdf') ? (
              <span className="text-[8px] font-bold text-slate-500">FIRMA REGISTRADA EN PDF</span>
            ) : (
              <div className="w-40 h-10 border border-dashed border-slate-300 rounded flex items-center justify-center text-[9px] text-slate-400 bg-slate-50 italic">
                Requiere Firma en Configuraciones
              </div>
            )}
            <span className="text-[7.5px] font-mono text-slate-450 mt-1 uppercase block text-slate-500">Firma Digital del Diagnóstico</span>
          </div>
        </div>

        <div className="flex flex-col justify-between pl-4">
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
            <h4 className="text-[8.5px] font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 leading-none mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Sello de Validación del Sistema
            </h4>
            <p className="text-[8px] text-slate-500 text-justify leading-tight">
              Este documento ha sido generado por el Sistema Especializado en Diagnósticos de la Norma Oficial Mexicana <strong>NOM-030-STPS</strong>. Los registros han sido confirmados por el patrón y están resguardados localmente para eventuales visitas de inspección de la Secretaría del Trabajo y Previsión Social mexicana.
            </p>
          </div>

          <div className="text-right text-[8px] font-mono text-slate-400 mt-2">
            <span className="block">FOLIO VERIFICACIÓN: STPS-{company.rfc}-2026-VAL</span>
            <span className="block">FECHA REGISTRO LOCAL IMPRESIÓN: {new Date().toISOString()}</span>
          </div>
        </div>
      </div>

    </div>
  );
};
