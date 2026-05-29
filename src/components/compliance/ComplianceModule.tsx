import { useState } from "react";
import { db, type SafetyProgramItem, type ChecklistItem } from "../../lib/db";
import { useDexieQuery } from "../../hooks/useDexie";
import { useAppStore } from "../../hooks/useAppStore";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { 
  ShieldCheck, 
  ListChecks, 
  Calendar, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Check,
  X,
  Minus,
  RefreshCw,
  Heart,
  Stethoscope,
  ShieldAlert,
  Trash2,
  Camera,
  FileUp,
  Image as ImageIcon,
  Sparkles,
  Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { format, addMonths } from "date-fns";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { generateHealthPromotionProgram, generateEmergencyProgram } from "../../services/geminiService";

const PATRON_OBLIGATIONS = [
  { code: "4.1", requirement: "Designar un responsable de seguridad y salud en el trabajo (interno o externo)." },
  { code: "4.2", requirement: "Proporcionar facilidades al responsable para el desempeño de sus funciones." },
  { code: "4.3", requirement: "Contar con un diagnóstico actualizado de las condiciones de seguridad y salud." },
  { code: "4.4", requirement: "Contar con un Programa de Seguridad y Salud en el Trabajo (o Relación de Acciones si < 100 trabajadores)." },
  { code: "4.5", requirement: "Comunicar a los trabajadores y a la Comisión de Seguridad e Higiene el diagnóstico y programa." },
  { code: "4.6", requirement: "Capacitar al personal que forme parte de los servicios preventivos de seguridad y salud." },
  { code: "4.7", requirement: "Realizar el seguimiento de los avances en la instauración del programa o de la relación de acciones." },
  { code: "4.8", requirement: "Exhibir a la autoridad laboral los documentos que la presente Norma le obligue a elaborar." },
];

export function ComplianceModule() {
  const { currentCompanyId } = useAppStore();
  const [activeTab, setActiveTab ] = useState("checklist");
  const [programTab, setProgramTab] = useState("7.1.a");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const checklistItems = useDexieQuery(
    () => currentCompanyId ? db.checklistItems.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([]),
    [currentCompanyId, refreshTrigger]
  ) || [];

  const safetyProgram = useDexieQuery(
    () => currentCompanyId ? db.safetyProgram.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([]),
    [currentCompanyId, refreshTrigger]
  ) || [];

  const findings = useDexieQuery(
    () => currentCompanyId ? db.findings.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([]),
    [currentCompanyId, refreshTrigger]
  ) || [];

  const surroundingHazards = useDexieQuery(
    () => currentCompanyId ? db.surroundingHazards.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([]),
    [currentCompanyId, refreshTrigger]
  ) || [];

  const [isAddingProgramItem, setIsAddingProgramItem] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiReminder, setAiReminder] = useState<string | null>(null);

  const activeCompany = useDexieQuery(
    () => currentCompanyId ? db.companies.get(currentCompanyId) : Promise.resolve(null),
    [currentCompanyId]
  );

  const accidentRecords = useDexieQuery(
    () => currentCompanyId ? db.accidentRecords.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([]),
    [currentCompanyId, refreshTrigger]
  ) || [];
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    itemId: number | null;
    hasOrigin: boolean;
    item: SafetyProgramItem | null;
  }>({
    isOpen: false,
    itemId: null,
    hasOrigin: false,
    item: null
  });

  const [newProgramItem, setNewProgramItem] = useState<Partial<SafetyProgramItem>>({
    nomSection: '7.1.a',
    action: '',
    category: '',
    referenceNorm: '',
    responsible: '',
    status: 'pending',
    progress: 0,
    startDate: new Date(),
    endDate: addMonths(new Date(), 1)
  });

  const totalItems = checklistItems.length;
  const compliantCount = checklistItems.filter(item => item.compliance === 'compliance').length;
  const partialCount = checklistItems.filter(item => item.compliance === 'partial').length;
  const nonCompliantCount = checklistItems.filter(item => item.compliance === 'non_compliance').length;
  const pendingCount = checklistItems.filter(item => !item.compliance).length;
  
  const evaluatedCount = totalItems - pendingCount;
  const compliancePercentage = evaluatedCount > 0 ? Math.round((compliantCount / evaluatedCount) * 100) : 0;

  if (!currentCompanyId) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
        <ShieldCheck className="w-12 h-12 text-blue-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold">Selecciona una empresa</h3>
        <p className="text-slate-500 mt-2">Debes seleccionar una empresa para gestionar su programa de seguridad.</p>
      </div>
    );
  }

  const handleSeedChecklist = async () => {
    try {
      const existing = await db.checklistItems.where("companyId").equals(currentCompanyId!).count();
      if (existing === 0) {
        const items = PATRON_OBLIGATIONS.map(obs => ({
          companyId: currentCompanyId!,
          diagnosisId: 0,
          nomCode: "NOM-030-STPS-2009",
          requirement: obs.requirement,
          compliance: 'partial' as const,
          comments: '',
          evidenceUrls: [],
          updatedAt: new Date()
        }));
        await db.checklistItems.bulkAdd(items);
        setRefreshTrigger(p => p + 1);
        toast.success("Obligaciones del patrón cargadas");
      }
    } catch (e) {
      toast.error("Error al cargar obligaciones");
    }
  };

  const updateChecklistItem = async (id: number, compliance: ChecklistItem['compliance']) => {
    try {
      await db.checklistItems.update(id, { compliance, updatedAt: new Date() });
      setRefreshTrigger(p => p + 1);
    } catch (e) {
      toast.error("Error al actualizar");
    }
  };

  const handleGenerateAI = async () => {
    if (!currentCompanyId || !activeCompany) {
      toast.error("Selecciona una empresa primero");
      return;
    }

    setIsGeneratingAI(true);
    try {
      const response = await generateHealthPromotionProgram(
        activeCompany,
        accidentRecords,
        findings,
        surroundingHazards
      );

      const existingProgram = await db.safetyProgram.where("companyId").equals(currentCompanyId).toArray();
      const existingActions = new Set(existingProgram.map(item => item.action.trim().toLowerCase()));

      const uniqueSuggestions = response.suggestions.filter(s => !existingActions.has(s.action.trim().toLowerCase()));

      if (uniqueSuggestions.length > 0) {
        const itemsToAdd = uniqueSuggestions.map(s => ({
          ...s,
          companyId: currentCompanyId,
          nomSection: '7.1.b' as const,
          status: 'pending' as const,
          progress: 0,
          updatedAt: new Date()
        }));

        await db.safetyProgram.bulkAdd(itemsToAdd);
        toast.success(`Se agregaron ${itemsToAdd.length} nuevas acciones sugeridas en tu programa de salud`);
      } else {
        toast.info("Todas las acciones de salud sugeridas por la IA ya están registradas");
      }

      setAiReminder(response.reminderText);
      setRefreshTrigger(p => p + 1);
    } catch (error) {
      console.error("AI Generation Error:", error);
      toast.error("Error al generar programa con IA");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleGenerateEmergencyAI = async () => {
    if (!currentCompanyId || !activeCompany) {
      toast.error("Selecciona una empresa primero");
      return;
    }

    setIsGeneratingAI(true);
    try {
      const response = await generateEmergencyProgram(
        activeCompany,
        accidentRecords,
        findings,
        surroundingHazards
      );

      const existingProgram = await db.safetyProgram.where("companyId").equals(currentCompanyId).toArray();
      const existingActions = new Set(existingProgram.map(item => item.action.trim().toLowerCase()));

      const uniqueSuggestions = response.suggestions.filter(s => !existingActions.has(s.action.trim().toLowerCase()));

      if (uniqueSuggestions.length > 0) {
        const itemsToAdd = uniqueSuggestions.map(s => ({
          ...s,
          companyId: currentCompanyId,
          nomSection: '7.1.c' as const,
          status: 'pending' as const,
          progress: 0,
          updatedAt: new Date()
        }));

        await db.safetyProgram.bulkAdd(itemsToAdd);
        toast.success(`Se agregaron ${itemsToAdd.length} nuevos protocolos sugeridos en emergencias`);
      } else {
        toast.info("Todos los protocolos de emergencia sugeridos por la IA ya están registrados");
      }

      setAiReminder(response.reminderText);
      setRefreshTrigger(p => p + 1);
    } catch (error) {
      console.error("AI Emergency Generation Error:", error);
      toast.error("Error al generar programa de emergencias con IA");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSeedProgram = async () => {
    try {
      const existing = await db.safetyProgram.where("companyId").equals(currentCompanyId!).count();
      if (existing === 0) {
        const sections: SafetyProgramItem[] = [
          // 7.1.a - Acciones por riesgos (Simplified seeds)
          { companyId: currentCompanyId!, nomSection: '7.1.a', action: 'Corrección de condiciones inseguras detectadas en diagnóstico', responsible: 'Jefe de Mantenimiento', status: 'pending', startDate: new Date(), endDate: addMonths(new Date(), 3), updatedAt: new Date() },
          
          // 7.1.b - Promoción de Salud
          { companyId: currentCompanyId!, nomSection: '7.1.b', action: 'Realización de Espirometrías', category: 'Examen Médico', referenceNorm: 'NOM-010-STPS', responsible: 'Médico de Empresa', status: 'pending', startDate: new Date(), endDate: addMonths(new Date(), 6), updatedAt: new Date() },
          { companyId: currentCompanyId!, nomSection: '7.1.b', action: 'Campaña de prevención de adicciones', category: 'Campaña', referenceNorm: 'Cap. 7.1.b', responsible: 'Recursos Humanos', status: 'pending', startDate: new Date(), endDate: addMonths(new Date(), 12), updatedAt: new Date() },
          
          // 7.1.c - Emergencias
          { companyId: currentCompanyId!, nomSection: '7.1.c', action: 'Simulacro de evacuación por sismo', category: 'Sismos', responsible: 'Brigada de Evacuación', status: 'pending', startDate: new Date(), endDate: addMonths(new Date(), 4), updatedAt: new Date() },
          { companyId: currentCompanyId!, nomSection: '7.1.c', action: 'Inspección de sistemas contra incendio', category: 'Incendios', responsible: 'Mantenimiento', status: 'pending', startDate: new Date(), endDate: addMonths(new Date(), 1), updatedAt: new Date() },
          { companyId: currentCompanyId!, nomSection: '7.1.c', action: 'Protocolo de higiene por contingencia sanitaria', category: 'Contingencia Sanitaria', responsible: 'Comité Seguridad', status: 'pending', startDate: new Date(), endDate: addMonths(new Date(), 1), updatedAt: new Date() },
        ];
        await db.safetyProgram.bulkAdd(sections);
        setRefreshTrigger(prev => prev + 1);
        toast.success("Estructura de programa cargada");
      }
    } catch (e) {
      toast.error("Error al cargar programa");
    }
  };

  const handleAddProgramItem = async () => {
    if (!newProgramItem.action) return;
    try {
      await db.safetyProgram.add({
        ...newProgramItem,
        companyId: currentCompanyId!,
        updatedAt: new Date()
      } as SafetyProgramItem);
      toast.success("Acción agregada");
      setRefreshTrigger(p => p + 1);
      setIsAddingProgramItem(false);
      setNewProgramItem({ nomSection: programTab as any, action: '', category: '', referenceNorm: '', responsible: '', status: 'pending', progress: 0, startDate: new Date(), endDate: addMonths(new Date(), 1) });
    } catch (e) {
      toast.error("Error al agregar");
    }
  };

  const initiateDelete = async (id: number | undefined) => {
    if (id === undefined) return;
    try {
      const item = await db.safetyProgram.get(id);
      if (!item) {
        toast.error("El elemento ya no existe");
        return;
      }
      setDeleteDialog({
        isOpen: true,
        itemId: id,
        hasOrigin: !!(item.findingId || item.hazardId),
        item: item
      });
    } catch (err) {
      toast.error("Error al preparar eliminación");
    }
  };

  const processDeletion = async (deleteOrigin: boolean = false) => {
    if (!deleteDialog.itemId) return;
    
    const id = deleteDialog.itemId;
    const item = deleteDialog.item;

    try {
      console.log(`[DELETE] Processing deletion for ID: ${id}, deleteOrigin: ${deleteOrigin}`);
      
      // Perform deletion
      await db.safetyProgram.delete(id);
      
      if (deleteOrigin && item) {
        if (item.findingId) {
          const risk = await db.riskAssessments.where('findingId').equals(item.findingId).first();
          if (risk?.id) await db.riskAssessments.delete(risk.id);
          await db.findings.delete(item.findingId);
        }
        if (item.hazardId) {
          await db.surroundingHazards.delete(item.hazardId);
        }
        toast.success("Elemento y registro de origen eliminados");
      } else {
        toast.success("Eliminado correctamente del programa");
      }

      setRefreshTrigger(prev => prev + 1);
      setDeleteDialog({ isOpen: false, itemId: null, hasOrigin: false, item: null });
    } catch (err) {
      console.error("[DELETE] Error:", err);
      toast.error("Error técnico al eliminar el registro");
    }
  };

  const handleUpdateProgramItem = async (id: number, updates: Partial<SafetyProgramItem>) => {
    try {
      await db.safetyProgram.update(id, { ...updates, updatedAt: new Date() });
      
      // If completed, sync with linked finding
      if (updates.status === 'completed' || updates.progress === 100) {
        const item = await db.safetyProgram.get(id);
        if (item?.findingId) {
          await db.findings.update(item.findingId, { 
            status: 'completed', 
            closedAt: new Date(),
            updatedAt: new Date()
          });
        }
      } else if (updates.status === 'pending' || (updates.progress !== undefined && updates.progress < 100)) {
        const item = await db.safetyProgram.get(id);
        if (item?.findingId) {
          await db.findings.update(item.findingId, { 
            status: updates.status === 'pending' ? 'pending' : 'in_progress',
            closedAt: undefined,
            updatedAt: new Date()
          });
        }
      }
      
      setRefreshTrigger(p => p + 1);
    } catch (e) {
      toast.error("Error al actualizar");
    }
  };

  const syncFindingsToActions = async () => {
    const nonCompliantChecklist = checklistItems.filter(item => item.compliance === 'non_compliance' || item.compliance === 'partial');
    
    if (findings.length === 0 && surroundingHazards.length === 0 && nonCompliantChecklist.length === 0) {
      toast.error("No hay riesgos, peligros ni desviaciones normativas identificadas para sincronizar");
      return;
    }
    try {
      // Get FRESH state from DB to avoid racing with component state
      const currentProgram = await db.safetyProgram.where("companyId").equals(currentCompanyId!).toArray();
      const existingFindingIds = currentProgram.map(i => i.findingId).filter(Boolean);
      const existingHazardIds = currentProgram.map(i => i.hazardId).filter(Boolean);
      const existingChecklistItemIds = currentProgram.map(i => (i as any).checklistItemId).filter(Boolean);
      const existingActions = currentProgram.map(i => i.action.toLowerCase().trim());
      
      const newFindings = findings.filter(f => {
        // Avoid duplicates by ID or by exact action text
        const actionText = (f.correctiveAction || `${f.title}: ${f.description}`).toLowerCase().trim();
        return !existingFindingIds.includes(f.id) && !existingActions.includes(actionText);
      });

      // Only pull hazards that don't have an ID in safetyProgram AND don't have an associated finding already synced
      const newHazards = surroundingHazards.filter(h => {
        if (existingHazardIds.includes(h.id)) return false;
        // Check if any finding related to this hazard is already synced
        const relatedFinding = findings.find(f => f.title.includes(h.source) && f.category === 'hazard');
        if (relatedFinding && existingFindingIds.includes(relatedFinding.id)) return false;
        
        const hazardActionText = `Atender Peligro Externo: ${h.source}`.toLowerCase().trim();
        return !existingActions.includes(hazardActionText);
      });

      const newChecklistItems = nonCompliantChecklist.filter(item => {
        if (existingChecklistItemIds.includes(item.id)) return false;
        const actionText = `Atender requisito ${item.nomCode}: ${item.requirement}`.toLowerCase().trim();
        return !existingActions.includes(actionText);
      });

      if (newFindings.length === 0 && newHazards.length === 0 && newChecklistItems.length === 0) {
        toast.info("No hay nuevos riesgos, peligros o desviaciones normativas por sincronizar");
        return;
      }

      const actionsFromFindings = newFindings.map(f => ({
        companyId: currentCompanyId!,
        nomSection: '7.1.a' as const,
        findingId: f.id,
        action: f.correctiveAction || `${f.title}: ${f.description}`,
        category: f.category,
        criticality: f.severity,
        responsible: f.responsible || 'Responsable Seg.',
        status: 'pending' as const,
        startDate: new Date(),
        endDate: f.commitmentDate || addMonths(new Date(), 1),
        updatedAt: new Date()
      }));

      const actionsFromHazards = newHazards.map(h => ({
        companyId: currentCompanyId!,
        nomSection: '7.1.a' as const,
        hazardId: h.id,
        action: `Atender Peligro Externo: ${h.source}`,
        category: 'hazard',
        criticality: h.riskLevel >= 21 ? 'critical' : h.riskLevel >= 13 ? 'high' : h.riskLevel >= 6 ? 'medium' : 'low' as any,
        responsible: 'Responsable Seg.',
        status: 'pending' as const,
        startDate: new Date(),
        endDate: addMonths(new Date(), 1),
        updatedAt: new Date()
      }));

      const actionsFromChecklist = newChecklistItems.map(item => ({
        companyId: currentCompanyId!,
        nomSection: '7.1.a' as const,
        checklistItemId: item.id,
        action: `Atender requisito ${item.nomCode}: ${item.requirement}`,
        category: 'Diagnóstico Normativo',
        referenceNorm: item.nomCode,
        criticality: item.compliance === 'non_compliance' ? 'high' as const : 'medium' as const,
        responsible: 'Responsable Seg.',
        status: 'pending' as const,
        startDate: new Date(),
        endDate: addMonths(new Date(), 1),
        updatedAt: new Date()
      }));

      await db.safetyProgram.bulkAdd([
        ...actionsFromFindings, 
        ...actionsFromHazards,
        ...actionsFromChecklist
      ]);
      
      setRefreshTrigger(p => p + 1);
      const totalSynced = newFindings.length + newHazards.length + newChecklistItems.length;
      toast.success(`${totalSynced} acciones sincronizadas (incluyendo Diagnóstico Normativo)`);
    } catch (e) {
      console.error("Sync error:", e);
      toast.error("Error al sincronizar");
    }
  };

  const handleFileUpload = async (id: number, type: 'before' | 'after', file: File) => {
    console.log(`Intentando subir evidencia ${type} para el elemento con ID: ${id}`);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        await handleUpdateProgramItem(id, {
          [type === 'before' ? 'beforeEvidenceUrl' : 'afterEvidenceUrl']: dataUrl
        });
        toast.success(`Evidencia "${type === 'before' ? 'Antes' : 'Después'}" cargada correctamente`);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error("Error en handleFileUpload:", e);
      toast.error("Error al procesar la imagen");
    }
  };

  const getSeverityBadge = (sev?: string) => {
    switch (sev) {
      case 'critical': return <Badge className="bg-red-600 text-white border-none text-[9px]">CRÍTICO</Badge>;
      case 'high': return <Badge className="bg-orange-500 text-white border-none text-[9px]">ALTO</Badge>;
      case 'medium': return <Badge className="bg-amber-400 text-white border-none text-[9px]">MEDIO</Badge>;
      case 'low': return <Badge className="bg-blue-400 text-white border-none text-[9px]">BAJO</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Prog. Anual de Salud</h1>
        <p className="text-[10px] text-slate-500">Planificación de acciones preventivas y de salud basadas en diagnóstico NOM-030.</p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl h-10 w-full max-w-md">
          <TabsTrigger value="checklist" className="flex-1 rounded-lg gap-2 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
            <ListChecks className="w-3.5 h-3.5" /> Diagnóstico Normativo
          </TabsTrigger>
          <TabsTrigger value="program" className="flex-1 rounded-lg gap-2 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
            <Calendar className="w-3.5 h-3.5" /> Plan de Acción
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checklist" className="space-y-4 animate-in fade-in duration-500">
           {/* ... existing checklist content ... */}
           <div className="flex justify-between items-center bg-blue-50 border border-blue-100 p-4 rounded-2xl">
              <div className="flex items-center gap-3">
                 <ShieldCheck className="w-6 h-6 text-blue-600" />
                 <div>
                    <h3 className="font-bold text-blue-900">Obligaciones del Patrón</h3>
                    <p className="text-xs text-blue-700">Requerimientos fundamentales establecidos en el Capítulo 4 de la NOM-030-STPS-2009.</p>
                 </div>
              </div>
              {checklistItems.length === 0 && (
                <Button onClick={handleSeedChecklist} size="sm" className="bg-blue-600">
                   <RefreshCw className="w-3 h-3 mr-2" /> Cargar Obligaciones
                </Button>
              )}
           </div>

           {checklistItems.length > 0 && (
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner">
               <div className="lg:col-span-2 space-y-2">
                 <div className="flex items-center gap-2">
                   <ShieldCheck className="w-4 h-4 text-indigo-600 animate-pulse" />
                   <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Cumplimiento del Diagnóstico Normativo</span>
                 </div>
                 <div className="flex items-baseline gap-2">
                   <span className="text-2xl font-black text-slate-900">{compliancePercentage}%</span>
                   <span className="text-[10px] text-slate-500 font-semibold uppercase">Cumplimiento General</span>
                 </div>
                 <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                   <div 
                     className={cn(
                       "h-full transition-all duration-500",
                       compliancePercentage >= 80 ? "bg-green-600" :
                       compliancePercentage >= 50 ? "bg-amber-500" : "bg-red-500"
                     )}
                     style={{ width: `${compliancePercentage}%` }}
                   />
                 </div>
                 <p className="text-[9px] text-slate-400 font-medium font-sans">Porcentaje calculado sobre {evaluatedCount} de {totalItems} obligaciones evaluadas.</p>
               </div>
               
               <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-slate-100">
                 <div className="text-center flex flex-col justify-center">
                   <span className="text-sm font-black text-green-600 block">{compliantCount}</span>
                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Cumple</span>
                 </div>
                 <div className="text-center border-x border-slate-150 flex flex-col justify-center">
                   <span className="text-sm font-black text-amber-500 block">{partialCount}</span>
                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Parcial</span>
                 </div>
                 <div className="text-center flex flex-col justify-center">
                   <span className="text-sm font-black text-red-600 block">{nonCompliantCount}</span>
                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">No Cumple</span>
                 </div>
               </div>

               <div className="flex items-center justify-center">
                 {(nonCompliantCount > 0 || partialCount > 0) ? (
                   <Button 
                     onClick={() => {
                       syncFindingsToActions();
                       setActiveTab("program");
                     }}
                     className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold shadow-md shadow-indigo-100 text-[11px] h-10 rounded-xl flex items-center justify-center gap-1.5 transition-all text-white animate-pulse"
                   >
                     <ListChecks className="w-3.5 h-3.5" /> 
                     Importar a Plan de Acción
                   </Button>
                 ) : (
                   <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 p-2.5 rounded-xl text-center text-[10px] font-bold w-full italic">
                     🎉 Diagnóstico 100% Cumplido
                   </div>
                 )}
               </div>
             </div>
           )}

           <div className="grid grid-cols-1 gap-4">
              {checklistItems.map((item) => (
                <Card key={item.id} className="border-slate-100 shadow-sm overflow-hidden group">
                   <CardContent className="p-0">
                      <div className="flex items-stretch min-h-[100px]">
                         <div className={cn(
                            "w-2 transition-colors", 
                            item.compliance === 'compliance' ? "bg-green-500" : 
                            item.compliance === 'non_compliance' ? "bg-red-500" :
                            item.compliance === 'partial' ? "bg-amber-500" : "bg-slate-200"
                         )} />
                         <div className="flex-1 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="max-w-2xl">
                               <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                  Capítulo 4 - Requisito
                                  <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest px-1.5 h-4">Obligatorio</Badge>
                               </h4>
                               <p className="text-sm text-slate-600 mt-1 leading-relaxed">{item.requirement}</p>
                            </div>
                            <div className="flex items-center gap-2">
                               <button
                                 onClick={() => item.id && updateChecklistItem(item.id, 'compliance')}
                                 className={cn(
                                   "w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110",
                                   item.compliance === 'compliance' ? "bg-green-600 text-white shadow-lg shadow-green-200" : "bg-green-50 text-green-600"
                                 )}
                               >
                                 <Check className="w-5 h-5" />
                               </button>
                               <button
                                 onClick={() => item.id && updateChecklistItem(item.id, 'partial')}
                                 className={cn(
                                   "w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110",
                                   item.compliance === 'partial' ? "bg-amber-500 text-white shadow-lg shadow-amber-200" : "bg-amber-50 text-amber-600"
                                 )}
                               >
                                 <Minus className="w-5 h-5" />
                               </button>
                               <button
                                 onClick={() => item.id && updateChecklistItem(item.id, 'non_compliance')}
                                 className={cn(
                                   "w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110",
                                   item.compliance === 'non_compliance' ? "bg-red-600 text-white shadow-lg shadow-red-200" : "bg-red-50 text-red-600"
                                 )}
                               >
                                 <X className="w-5 h-5" />
                               </button>
                            </div>
                         </div>
                      </div>
                   </CardContent>
                </Card>
              ))}
           </div>
        </TabsContent>

        <TabsContent value="program" className="space-y-6 animate-in fade-in duration-500">
           <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-blue-600" />
                Programa Anual de Salud
              </h2>
              <p className="text-xs text-slate-500 italic">Acciones preventivas, correctivas, de salud y emergencias (Cap. 7.1).</p>
            </div>
            <div className="flex gap-2">
              {safetyProgram.length === 0 && (
                <Button onClick={handleSeedProgram} variant="outline" size="sm">
                  <RefreshCw className="w-3 h-3 mr-2" /> Estructura NOM-030
                </Button>
              )}
              <Dialog open={isAddingProgramItem} onOpenChange={setIsAddingProgramItem}>
                <DialogTrigger render={<Button size="sm" className="bg-blue-600" />}>
                   <Plus className="w-3 h-3 mr-2" /> Nueva Acción
                </DialogTrigger>
                <DialogContent className="sm:max-w-[550px]">
                  <DialogHeader>
                    <DialogTitle>Agregar Acción al Programa</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Sección</Label>
                      <select 
                        className="col-span-3 h-9 rounded-md border border-slate-200 px-3 text-sm"
                        value={newProgramItem.nomSection}
                        onChange={e => setNewProgramItem({...newProgramItem, nomSection: e.target.value as any})}
                      >
                        <option value="7.1.a">7.1.a Prevención/Corrección</option>
                        <option value="7.1.b">7.1.b Promoción de Salud</option>
                        <option value="7.1.c">7.1.c Emergencias</option>
                      </select>
                    </div>
                    
                    {newProgramItem.nomSection === '7.1.c' && (
                       <div className="grid grid-cols-4 items-center gap-4">
                         <Label className="text-right">Escenario</Label>
                         <select 
                           className="col-span-3 h-9 rounded-md border border-slate-200 px-3 text-sm"
                           value={newProgramItem.category}
                           onChange={e => setNewProgramItem({...newProgramItem, category: e.target.value})}
                         >
                           <option value="">Selecciona...</option>
                           <option value="Incendios">Incendios</option>
                           <option value="Fugas">Fugas</option>
                           <option value="Sismos">Sismos</option>
                           <option value="Accidentes">Accidentes</option>
                           <option value="Contingencias Sanitarias">Contingencias Sanitarias</option>
                         </select>
                       </div>
                    )}

                    {newProgramItem.nomSection === '7.1.b' && (
                       <>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label className="text-right">Tipo</Label>
                          <select 
                            className="col-span-3 h-9 rounded-md border border-slate-200 px-3 text-sm"
                            value={newProgramItem.category}
                            onChange={e => setNewProgramItem({...newProgramItem, category: e.target.value})}
                          >
                            <option value="">Selecciona...</option>
                            <option value="Campaña de Salud">Campaña de Salud</option>
                            <option value="Examen Médico">Examen Médico</option>
                            <option value="Capacitación">Capacitación</option>
                            <option value="Prevención Adicciones">Prevención Adicciones</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label className="text-right">Norma Ref.</Label>
                          <Input className="col-span-3 text-sm" placeholder="Ej. NOM-011-STPS" value={newProgramItem.referenceNorm} onChange={e => setNewProgramItem({...newProgramItem, referenceNorm: e.target.value})} />
                        </div>
                       </>
                    )}

                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Descripción</Label>
                      <Textarea className="col-span-3 text-sm h-20" value={newProgramItem.action} onChange={e => setNewProgramItem({...newProgramItem, action: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right tracking-tight">Responsable</Label>
                      <Input className="col-span-3 text-sm" value={newProgramItem.responsible} onChange={e => setNewProgramItem({...newProgramItem, responsible: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Fecha Inicio</Label>
                        <Input type="date" className="text-sm" value={newProgramItem.startDate ? format(new Date(newProgramItem.startDate), 'yyyy-MM-dd') : ""} onChange={e => setNewProgramItem({...newProgramItem, startDate: e.target.value ? new Date(e.target.value) : undefined})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Fecha Término</Label>
                        <Input type="date" className="text-sm" value={newProgramItem.endDate ? format(new Date(newProgramItem.endDate), 'yyyy-MM-dd') : ""} onChange={e => setNewProgramItem({...newProgramItem, endDate: e.target.value ? new Date(e.target.value) : undefined})} />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Avance (%)</Label>
                      <div className="col-span-3 flex items-center gap-4">
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          value={newProgramItem.progress || 0}
                          onChange={e => setNewProgramItem({...newProgramItem, progress: parseInt(e.target.value)})}
                        />
                        <span className="text-xs font-bold text-slate-600 min-w-[30px]">{newProgramItem.progress || 0}%</span>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddingProgramItem(false)}>Cancelar</Button>
                    <Button onClick={handleAddProgramItem} className="bg-blue-600">Guardar Acción</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </header>

          <Tabs value={programTab} onValueChange={setProgramTab} className="space-y-6">
            <TabsList className="bg-slate-50 border border-slate-100 p-1 w-full justify-start overflow-auto">
               <TabsTrigger value="7.1.a" className="gap-2 text-xs font-bold uppercase tracking-tight">
                  <ShieldAlert className="w-3.5 h-3.5" /> Prevención y Corrección
               </TabsTrigger>
               <TabsTrigger value="7.1.b" className="gap-2 text-xs font-bold uppercase tracking-tight">
                  <Heart className="w-3.5 h-3.5" /> Promoción de Salud
               </TabsTrigger>
               <TabsTrigger value="7.1.c" className="gap-2 text-xs font-bold uppercase tracking-tight">
                  <Stethoscope className="w-3.5 h-3.5" /> Emergencias
               </TabsTrigger>
            </TabsList>

            <TabsContent value="7.1.a" className="space-y-4 animate-in slide-in-from-left-2 duration-300">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 p-4 rounded-2xl border border-slate-200 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-100 rounded-xl">
                      <ShieldAlert className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">Acciones Preventivas y Correctivas</h3>
                      <p className="text-[10px] text-slate-500 font-medium italic">Cronograma de atención a riesgos detectados en el diagnóstico.</p>
                    </div>
                  </div>
                  <Button onClick={syncFindingsToActions} variant="outline" size="sm" className="bg-indigo-50 border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-100 transition-colors shadow-sm">
                    <ListChecks className="w-4 h-4 mr-2" /> Importar Diagnóstico Normativo
                  </Button>
               </div>

               <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                 <div className="overflow-x-auto">
                   <Table>
                     <TableHeader className="bg-slate-50/80">
                       <TableRow className="hover:bg-transparent border-slate-100">
                         <TableHead className="w-[100px] text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4 px-6">Prioridad</TableHead>
                         <TableHead className="min-w-[250px] text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4">Descripción de la Acción</TableHead>
                         <TableHead className="w-[150px] text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4">Responsable</TableHead>
                         <TableHead className="w-[130px] text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4">Meta</TableHead>
                         <TableHead className="w-[180px] text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4 text-center">Evidencias</TableHead>
                         <TableHead className="w-[140px] text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4">Avance (%)</TableHead>
                         <TableHead className="w-[60px] py-4 pr-6"></TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                        {safetyProgram.filter(i => i.nomSection === '7.1.a').length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-64 text-center bg-slate-50/20 py-8">
                              <div className="max-w-md mx-auto space-y-4 py-4">
                                <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl w-14 h-14 flex items-center justify-center mx-auto shadow-inner">
                                  <ListChecks className="w-7 h-7" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-850">El Plan de Acción está vacío</p>
                                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                                    Aquí aparecerá tu cronograma de acciones NOM-030. Puedes poblarlo automáticamente importando los requisitos desviados de tu Diagnóstico Normativo y tus Hallazgos.
                                  </p>
                                </div>
                                <Button 
                                  onClick={syncFindingsToActions} 
                                  className="bg-indigo-600 font-bold hover:bg-indigo-700 shadow-md shadow-indigo-100 text-xs px-5 rounded-xl transition-all h-9"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin-slow" /> Importar Requisitos Normativos y Hallazgos
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          safetyProgram.filter(i => i.nomSection === '7.1.a').map((item) => (
                            <TableRow key={item.id} className="group transition-colors hover:bg-slate-50/50 border-slate-100 last:border-none">
                              <TableCell className="py-4 px-6">
                                <select 
                                  className={cn(
                                    "text-[10px] font-black uppercase px-2 py-1 rounded border-none cursor-pointer transition-colors focus:ring-0",
                                    item.criticality === 'critical' ? "bg-red-100 text-red-700" :
                                    item.criticality === 'high' ? "bg-orange-100 text-orange-700" :
                                    item.criticality === 'medium' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                                  )}
                                  value={item.criticality || 'low'}
                                  onChange={(e) => item.id && handleUpdateProgramItem(item.id, { criticality: e.target.value as any })}
                                >
                                  <option value="critical">CRÍTICO</option>
                                  <option value="high">ALTO</option>
                                  <option value="medium">MEDIO</option>
                                  <option value="low">BAJO</option>
                                </select>
                              </TableCell>
                              <TableCell className="py-4">
                                <div className="space-y-1 pr-4">
                                  <Textarea 
                                    className="text-xs font-bold text-slate-800 leading-relaxed bg-transparent border-none focus:bg-white resize-none h-14 p-0 shadow-none focus-visible:ring-0 min-w-[200px]"
                                    defaultValue={item.action}
                                    onBlur={(e) => item.id && handleUpdateProgramItem(item.id, { action: e.target.value })}
                                  />
                                  {item.category && <Badge variant="outline" className="text-[9px] text-slate-400 border-slate-100 h-4 bg-slate-50/50">{item.category}</Badge>}
                                </div>
                              </TableCell>
                              <TableCell className="py-4">
                                <Input 
                                  className="h-8 text-xs bg-transparent border-none p-0 focus-visible:ring-0 font-medium text-slate-600"
                                  defaultValue={item.responsible}
                                  onBlur={(e) => item.id && handleUpdateProgramItem(item.id, { responsible: e.target.value })}
                                />
                              </TableCell>
                              <TableCell className="py-4">
                                <Input 
                                  type="date"
                                  className="h-8 text-[11px] bg-transparent border-none p-0 focus-visible:ring-0 font-bold text-slate-700"
                                  value={item.endDate ? format(new Date(item.endDate), 'yyyy-MM-dd') : ""}
                                  onChange={(e) => item.id && handleUpdateProgramItem(item.id, { endDate: new Date(e.target.value) })}
                                />
                              </TableCell>
                              <TableCell className="py-4">
                                <div className="flex items-center justify-center gap-4">
                                  {/* Before */}
                                  <div className="relative group/evidence">
                                    <input 
                                      id={`tab-before-${item.id}`}
                                      type="file" 
                                      className="hidden" 
                                      accept="image/*" 
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file && item.id) handleFileUpload(item.id, 'before', file);
                                      }}
                                    />
                                    <label 
                                      htmlFor={`tab-before-${item.id}`}
                                      className={cn(
                                        "w-9 h-9 rounded-xl border border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden relative group/thumb",
                                        item.beforeEvidenceUrl ? "border-blue-300 bg-blue-50 hover:border-blue-400" : "border-slate-200 text-slate-300 hover:border-slate-400"
                                      )}
                                    >
                                      {item.beforeEvidenceUrl ? (
                                        <img 
                                          src={item.beforeEvidenceUrl} 
                                          className="w-full h-full object-cover cursor-zoom-in" 
                                          alt="Antes" 
                                          referrerPolicy="no-referrer" 
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setPreviewImage({ url: item.beforeEvidenceUrl!, title: `Antes: ${item.action}` });
                                          }}
                                        />
                                      ) : (
                                        <Camera className="w-4 h-4" />
                                      )}
                                    </label>
                                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-400 opacity-0 group-hover/evidence:opacity-100 transition-opacity">ANTES</span>
                                    {item.beforeEvidenceUrl && (
                                      <button onClick={() => item.id && handleUpdateProgramItem(item.id, { beforeEvidenceUrl: undefined })} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-0 group-hover/evidence:opacity-100 transition-opacity">
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    )}
                                  </div>
                                  {/* After */}
                                  <div className="relative group/evidence">
                                    <input 
                                      id={`tab-after-${item.id}`}
                                      type="file" 
                                      className="hidden" 
                                      accept="image/*" 
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file && item.id) handleFileUpload(item.id, 'after', file);
                                      }}
                                    />
                                    <label 
                                      htmlFor={`tab-after-${item.id}`}
                                      className={cn(
                                        "w-9 h-9 rounded-xl border border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden relative group/thumb",
                                        item.afterEvidenceUrl ? "border-green-300 bg-green-50 hover:border-green-400" : "border-slate-200 text-slate-300 hover:border-slate-400"
                                      )}
                                    >
                                      {item.afterEvidenceUrl ? (
                                        <img 
                                          src={item.afterEvidenceUrl} 
                                          className="w-full h-full object-cover cursor-zoom-in" 
                                          alt="Después" 
                                          referrerPolicy="no-referrer" 
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setPreviewImage({ url: item.afterEvidenceUrl!, title: `Después: ${item.action}` });
                                          }}
                                        />
                                      ) : (
                                        <Camera className="w-4 h-4" />
                                      )}
                                    </label>
                                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-400 opacity-0 group-hover/evidence:opacity-100 transition-opacity">DESPUÉS</span>
                                    {item.afterEvidenceUrl && (
                                      <button onClick={() => item.id && handleUpdateProgramItem(item.id, { afterEvidenceUrl: undefined })} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-0 group-hover/evidence:opacity-100 transition-opacity">
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="py-4">
                                <div className="space-y-1.5 px-2 min-w-[120px]">
                                  <div className="flex items-center justify-between text-[9px] font-black">
                                    <span className={cn(
                                      item.status === 'completed' ? "text-green-600" : "text-slate-500"
                                    )}>{item.progress || 0}%</span>
                                    <button 
                                      onClick={() => {
                                        if (item.id) {
                                          const newStatus = item.status === 'completed' ? 'pending' : 'completed';
                                          handleUpdateProgramItem(item.id, { 
                                            status: newStatus,
                                            progress: newStatus === 'completed' ? 100 : 0
                                          });
                                        }
                                      }}
                                      className={cn(
                                        "transition-colors",
                                        item.status === 'completed' ? "text-green-600" : "text-slate-300 hover:text-green-600"
                                      )}
                                    >
                                      {item.status === 'completed' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                    </button>
                                  </div>
                                  <input 
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="5"
                                    className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    value={item.progress || 0}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value);
                                      if (item.id) handleUpdateProgramItem(item.id, { 
                                        progress: val,
                                        status: val === 100 ? 'completed' : 'pending'
                                      });
                                    }}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="py-4 pr-6">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100" 
                                  onClick={() => initiateDelete(item.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                     </TableBody>
                   </Table>
                 </div>
               </div>
            </TabsContent>

            <TabsContent value="7.1.b" className="space-y-4 animate-in slide-in-from-left-2 duration-300">
               <div className="bg-green-50/50 p-4 rounded-2xl border border-green-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-green-600 rounded-xl shadow-lg shadow-green-200">
                      <Heart className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-green-900">Promoción de Salud (Cronograma)</h3>
                      <p className="text-[10px] text-green-700 font-medium">Campañas de salud, prevención de adicciones y exámenes médicos.</p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleGenerateAI} 
                    disabled={isGeneratingAI}
                    variant="outline" 
                    size="sm" 
                    className="bg-white shadow-sm border-green-200 text-green-700 font-bold hover:bg-green-50 transition-colors"
                  >
                    {isGeneratingAI ? (
                      <><RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> Generando...</>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5 mr-2" /> Sugerir con IA</>
                    )}
                  </Button>
               </div>

               {aiReminder && (
                 <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3 items-start animate-in fade-in slide-in-from-top-1">
                   <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                   <p className="text-sm text-blue-800 leading-relaxed italic">{aiReminder}</p>
                 </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {safetyProgram.filter(i => i.nomSection === '7.1.b').map(item => (
                   <Card key={item.id} className="border-slate-100 shadow-sm group border-l-4 border-l-green-500 hover:shadow-md transition-all">
                     <CardContent className="p-4 space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-wrap gap-1 mb-1">
                             <Badge className="bg-green-100 text-green-700 border-green-200 text-[9px] h-4 uppercase">{item.category || 'SALUD'}</Badge>
                             {item.referenceNorm && <Badge variant="outline" className="text-[9px] h-4 italic border-slate-100 bg-slate-50/50 text-slate-500">{item.referenceNorm}</Badge>}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors" 
                            onClick={() => initiateDelete(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="space-y-1">
                           <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Acción Sugerida / Campaña</Label>
                           <Textarea 
                             className="text-xs font-bold text-slate-900 leading-tight bg-transparent border-none focus:bg-slate-50 resize-none h-14 p-0 shadow-none focus-visible:ring-0"
                             defaultValue={item.action}
                             onBlur={(e) => item.id && handleUpdateProgramItem(item.id, { action: e.target.value })}
                           />
                        </div>

                        <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-50">
                           <div className="space-y-1">
                              <Label className="text-[9px] text-slate-400 font-bold uppercase">Responsable</Label>
                              <Input 
                                className="h-7 text-[10px] bg-transparent border-none p-0 focus-visible:ring-0 h-auto font-bold text-slate-700"
                                defaultValue={item.responsible}
                                onBlur={(e) => item.id && handleUpdateProgramItem(item.id, { responsible: e.target.value })}
                                placeholder="Nombre..."
                              />
                           </div>
                           <div className="space-y-1">
                              <Label className="text-[9px] text-slate-400 font-bold uppercase">Ejecución</Label>
                              <Input 
                                type="date"
                                className="h-7 text-[10px] bg-transparent border-none p-0 focus-visible:ring-0 h-auto font-bold text-slate-700 block w-full"
                                value={item.endDate ? format(new Date(item.endDate), 'yyyy-MM-dd') : (item.startDate ? format(new Date(item.startDate), 'yyyy-MM-dd') : "")}
                                onChange={(e) => item.id && handleUpdateProgramItem(item.id, { endDate: new Date(e.target.value) })}
                              />
                           </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                           <div className="flex gap-2">
                             <div className="relative group/evidence">
                                <input 
                                  id={`tab-before-${item.id}`}
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file && item.id) handleFileUpload(item.id, 'before', file);
                                  }}
                                />
                                <label 
                                  htmlFor={`tab-before-${item.id}`}
                                  className={cn(
                                    "w-8 h-8 rounded-lg border border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden relative group/thumb",
                                    item.beforeEvidenceUrl ? "border-blue-300 bg-blue-50 hover:border-blue-400" : "border-slate-200 text-slate-300 hover:border-slate-400"
                                  )}
                                >
                                  {item.beforeEvidenceUrl ? (
                                    <img 
                                      src={item.beforeEvidenceUrl} 
                                      className="w-full h-full object-cover cursor-zoom-in" 
                                      alt="Antes" 
                                      referrerPolicy="no-referrer" 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setPreviewImage({ url: item.beforeEvidenceUrl!, title: `Antes: ${item.action}` });
                                      }}
                                    />
                                  ) : (
                                    <Camera className="w-3.5 h-3.5" />
                                  )}
                                </label>
                                {item.beforeEvidenceUrl && (
                                  <button onClick={() => item.id && handleUpdateProgramItem(item.id, { beforeEvidenceUrl: undefined })} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-0 group-hover/evidence:opacity-100 transition-opacity">
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                )}
                             </div>
                             <div className="relative group/evidence">
                                <input 
                                  id={`tab-after-${item.id}`}
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file && item.id) handleFileUpload(item.id, 'after', file);
                                  }}
                                />
                                <label 
                                  htmlFor={`tab-after-${item.id}`}
                                  className={cn(
                                    "w-8 h-8 rounded-lg border border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden relative group/thumb",
                                    item.afterEvidenceUrl ? "border-green-300 bg-green-50 hover:border-green-400" : "border-slate-200 text-slate-300 hover:border-slate-400"
                                  )}
                                >
                                  {item.afterEvidenceUrl ? (
                                    <img 
                                      src={item.afterEvidenceUrl} 
                                      className="w-full h-full object-cover cursor-zoom-in" 
                                      alt="Después" 
                                      referrerPolicy="no-referrer" 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setPreviewImage({ url: item.afterEvidenceUrl!, title: `Después: ${item.action}` });
                                      }}
                                    />
                                  ) : (
                                    <Camera className="w-3.5 h-3.5" />
                                  )}
                                </label>
                                {item.afterEvidenceUrl && (
                                  <button onClick={() => item.id && handleUpdateProgramItem(item.id, { afterEvidenceUrl: undefined })} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-0 group-hover/evidence:opacity-100 transition-opacity">
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                )}
                             </div>
                           </div>
                           <div className="flex-1 space-y-2">
                             <div className="flex items-center justify-between px-1">
                               <Label className="text-[10px] font-bold text-slate-500 uppercase">Avance: {item.progress || 0}%</Label>
                               {item.progress === 100 ? (
                                 <Badge className="bg-green-100 text-green-700 border-green-200 text-[8px] h-4">COMPLETADO</Badge>
                               ) : (
                                 <Badge variant="outline" className="text-[8px] h-4 bg-slate-50 text-slate-400 border-slate-200">
                                   {item.progress && item.progress > 0 ? 'EN PROCESO' : 'PENDIENTE'}
                                 </Badge>
                               )}
                             </div>
                             <div className="flex items-center gap-3">
                               <input 
                                 type="range"
                                 min="0"
                                 max="100"
                                 step="5"
                                 className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-green-600"
                                 value={item.progress || 0}
                                 onChange={(e) => {
                                   const val = parseInt(e.target.value);
                                   if (item.id) handleUpdateProgramItem(item.id, { 
                                     progress: val,
                                     status: val === 100 ? 'completed' : 'pending'
                                   });
                                 }}
                               />
                               <Button 
                                 variant="ghost" 
                                 size="sm" 
                                 className={cn(
                                   "h-8 px-2 text-[10px] font-black rounded-lg",
                                   item.status === 'completed' ? "text-green-600 bg-green-50" : "text-slate-400 hover:text-green-600"
                                 )}
                                 onClick={() => {
                                   if (item.id) {
                                     const newStatus = item.status === 'completed' ? 'pending' : 'completed';
                                     handleUpdateProgramItem(item.id, { 
                                       status: newStatus,
                                       progress: newStatus === 'completed' ? 100 : 0
                                     });
                                   }
                                 }}
                               >
                                 {item.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                               </Button>
                             </div>
                           </div>
                        </div>
                     </CardContent>
                   </Card>
                 ))}
                 {safetyProgram.filter(i => i.nomSection === '7.1.b').length === 0 && (
                   <div className="col-span-full py-16 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                      <Heart className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400 italic font-medium">No hay programas de salud registrados.</p>
                   </div>
                 )}
               </div>
            </TabsContent>

            <TabsContent value="7.1.c" className="space-y-4 animate-in slide-in-from-left-2 duration-300">
               <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-red-600 rounded-xl shadow-lg shadow-red-200">
                      <ShieldAlert className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-red-900">Atención de Emergencias y Contingencias</h3>
                      <p className="text-[10px] text-red-700 font-medium">Protocolos ante incendios, fugas, sismos y contingencias sanitarias.</p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleGenerateEmergencyAI} 
                    disabled={isGeneratingAI}
                    variant="outline" 
                    size="sm" 
                    className="bg-white shadow-sm border-red-200 text-red-700 font-bold hover:bg-red-50 transition-colors"
                  >
                    {isGeneratingAI ? (
                      <><RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> Generando...</>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5 mr-2" /> Sugerir con IA</>
                    )}
                  </Button>
               </div>

               {aiReminder && activeTab === 'program' && programTab === '7.1.c' && (
                 <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3 items-start animate-in fade-in slide-in-from-top-1">
                   <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                   <p className="text-sm text-blue-800 leading-relaxed italic">{aiReminder}</p>
                 </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {safetyProgram.filter(i => i.nomSection === '7.1.c').map(item => (
                   <Card key={item.id} className="border-slate-100 shadow-sm group border-l-4 border-l-red-500 hover:shadow-md transition-all">
                     <CardContent className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] h-4 mb-1">{item.category?.toUpperCase() || 'EMERGENCIA'}</Badge>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors" 
                            onClick={() => initiateDelete(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="space-y-1">
                           <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Plan de Acción / Protocolo</Label>
                           <Textarea 
                             className="text-xs font-bold text-slate-900 leading-tight bg-transparent border-none focus:bg-slate-50 resize-none h-14 p-0 shadow-none focus-visible:ring-0"
                             defaultValue={item.action}
                             onBlur={(e) => item.id && handleUpdateProgramItem(item.id, { action: e.target.value })}
                           />
                        </div>
                        <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-50">
                           <div className="space-y-1">
                              <Label className="text-[9px] text-slate-400 font-bold uppercase">Responsable</Label>
                              <Input 
                                className="h-7 text-[10px] bg-transparent border-none p-0 focus-visible:ring-0 h-auto font-bold text-slate-700"
                                defaultValue={item.responsible}
                                onBlur={(e) => item.id && handleUpdateProgramItem(item.id, { responsible: e.target.value })}
                                placeholder="Nombre..."
                              />
                           </div>
                           <div className="space-y-1 text-right">
                              <Label className="text-[9px] text-slate-400 font-bold uppercase">Meta Anual</Label>
                              <Input 
                                type="date"
                                className="h-7 text-[10px] bg-transparent border-none p-0 focus-visible:ring-0 h-auto font-bold text-slate-700 block w-full text-right"
                                value={item.startDate ? format(new Date(item.startDate), 'yyyy-MM-dd') : ""}
                                onChange={(e) => item.id && handleUpdateProgramItem(item.id, { startDate: new Date(e.target.value) })}
                              />
                           </div>
                        </div>
                        <div className="space-y-4 pt-2 border-t border-slate-50">
                           <div className="flex gap-2">
                             <div className="relative group/evidence">
                                <input 
                                  id={`emerg-before-${item.id}`}
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file && item.id) handleFileUpload(item.id, 'before', file);
                                  }}
                                />
                                <label 
                                  htmlFor={`emerg-before-${item.id}`}
                                  className={cn(
                                    "w-8 h-8 rounded-lg border border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden relative group/thumb",
                                    item.beforeEvidenceUrl ? "border-blue-300 bg-blue-50 hover:border-blue-400" : "border-slate-200 text-slate-300 hover:border-slate-400"
                                  )}
                                >
                                  {item.beforeEvidenceUrl ? (
                                    <img 
                                      src={item.beforeEvidenceUrl} 
                                      className="w-full h-full object-cover cursor-zoom-in" 
                                      alt="Antes" 
                                      referrerPolicy="no-referrer" 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setPreviewImage({ url: item.beforeEvidenceUrl!, title: `Antes: ${item.action}` });
                                      }}
                                    />
                                  ) : (
                                    <Camera className="w-3.5 h-3.5" />
                                  )}
                                </label>
                                {item.beforeEvidenceUrl && (
                                  <button onClick={() => item.id && handleUpdateProgramItem(item.id, { beforeEvidenceUrl: undefined })} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-0 group-hover/evidence:opacity-100 transition-opacity">
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                )}
                             </div>
                             <div className="relative group/evidence">
                                <input 
                                  id={`emerg-after-${item.id}`}
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file && item.id) handleFileUpload(item.id, 'after', file);
                                  }}
                                />
                                <label 
                                  htmlFor={`emerg-after-${item.id}`}
                                  className={cn(
                                    "w-8 h-8 rounded-lg border border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden relative group/thumb",
                                    item.afterEvidenceUrl ? "border-green-300 bg-green-50 hover:border-green-400" : "border-slate-200 text-slate-300 hover:border-slate-400"
                                  )}
                                >
                                  {item.afterEvidenceUrl ? (
                                    <img 
                                      src={item.afterEvidenceUrl} 
                                      className="w-full h-full object-cover cursor-zoom-in" 
                                      alt="Después" 
                                      referrerPolicy="no-referrer" 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setPreviewImage({ url: item.afterEvidenceUrl!, title: `Después: ${item.action}` });
                                      }}
                                    />
                                  ) : (
                                    <Camera className="w-3.5 h-3.5" />
                                  )}
                                </label>
                                {item.afterEvidenceUrl && (
                                  <button onClick={() => item.id && handleUpdateProgramItem(item.id, { afterEvidenceUrl: undefined })} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-0 group-hover/evidence:opacity-100 transition-opacity">
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                )}
                             </div>
                             <div className="flex-1 space-y-2">
                               <div className="flex items-center justify-between px-1">
                                 <Label className="text-[10px] font-bold text-slate-500 uppercase">Avance: {item.progress || 0}%</Label>
                                 <button
                                   onClick={() => {
                                     if (item.id) {
                                       const newStatus = item.status === 'completed' ? 'pending' : 'completed';
                                       handleUpdateProgramItem(item.id, { 
                                         status: newStatus,
                                         progress: newStatus === 'completed' ? 100 : 0
                                       });
                                     }
                                   }}
                                   className={cn(
                                     "text-[10px] font-bold",
                                     item.status === 'completed' ? "text-green-600" : "text-slate-400"
                                   )}
                                 >
                                   {item.status === 'completed' ? 'CERRADO' : 'PENDIENTE'}
                                 </button>
                               </div>
                               <input 
                                 type="range"
                                 min="0"
                                 max="100"
                                 step="5"
                                 className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-red-600"
                                 value={item.progress || 0}
                                 onChange={(e) => {
                                   const val = parseInt(e.target.value);
                                   if (item.id) handleUpdateProgramItem(item.id, { 
                                     progress: val,
                                     status: val === 100 ? 'completed' : 'pending'
                                   });
                                 }}
                               />
                             </div>
                           </div>
                        </div>
                     </CardContent>
                   </Card>
                 ))}
                 {safetyProgram.filter(i => i.nomSection === '7.1.c').length === 0 && (
                   <div className="col-span-full py-16 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                      <Stethoscope className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400 italic font-medium">No hay planes de emergencia registrados.</p>
                   </div>
                 )}
               </div>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Consolidated Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.isOpen} onOpenChange={(open) => !open && setDeleteDialog(prev => ({ ...prev, isOpen: false }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="w-5 h-5" />
              {deleteDialog.hasOrigin ? "Registros Vinculados Detectados" : "Confirmar Eliminación"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              {deleteDialog.hasOrigin 
                ? "Esta acción proviene de un hallazgo o riesgo identificado en el diagnóstico. ¿Deseas eliminar también el registro de origen para mantener la coherencia de los datos?" 
                : "¿Estás seguro de que deseas eliminar esta acción del programa? Esta operación es definitiva."}
            </p>
            {deleteDialog.item && (
              <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Acción a eliminar:</p>
                <p className="text-xs font-bold text-slate-800 line-clamp-2">{deleteDialog.item.action}</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            {deleteDialog.hasOrigin ? (
              <>
                <Button variant="outline" className="sm:flex-1 font-bold text-xs" onClick={() => processDeletion(false)}>
                  Solo programa
                </Button>
                <Button variant="destructive" className="sm:flex-1 font-bold text-xs" onClick={() => processDeletion(true)}>
                  Acción + Origen
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" className="font-bold text-xs" onClick={() => setDeleteDialog(prev => ({ ...prev, isOpen: false }))}>
                  Cancelar
                </Button>
                <Button variant="destructive" className="font-bold text-xs" onClick={() => processDeletion(false)}>
                  Confirmar Eliminación
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox / Zoom Dialog for Before/After Evidences */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="sm:max-w-3xl bg-slate-900 border-slate-800 text-slate-100 p-0 overflow-hidden shadow-2xl">
          <div className="relative flex flex-col items-center justify-center p-4 min-h-[300px]">
            <DialogHeader className="w-full mb-3 px-4 flex flex-row items-center justify-between text-left">
              <div>
                <DialogTitle className="text-sm font-bold text-slate-100 line-clamp-1">{previewImage?.title}</DialogTitle>
                <p className="text-[10px] text-slate-400 font-medium font-sans">Visualizando evidencia del plan de acción en alta resolución</p>
              </div>
            </DialogHeader>
            {previewImage && (
              <div className="relative bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 max-h-[70vh] flex items-center justify-center w-full p-2">
                <img 
                  src={previewImage.url} 
                  alt={previewImage.title} 
                  className="max-h-[65vh] max-w-full object-contain mx-auto rounded-lg"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
            <div className="w-full flex justify-end gap-2 mt-4 px-4 pb-2">
              <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 text-[11px] font-bold" onClick={() => setPreviewImage(null)}>
                Cerrar Vista
              </Button>
              {previewImage && (
                <Button 
                  size="sm" 
                  className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = previewImage.url;
                    link.download = `evidencia_${Date.now()}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                >
                  Descargar Imagen
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}