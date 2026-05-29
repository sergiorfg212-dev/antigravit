import React, { useState } from "react";
import { cn } from "../../lib/utils";
import { useAppStore } from "../../hooks/useAppStore";
import { db, LegalMatrixRequirement, SafetyProgramItem } from "../../lib/db";
import { useDexieQuery } from "../../hooks/useDexie";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Scale, CheckCircle2, XCircle, HelpCircle, RefreshCw, Plus, Calendar, AlertTriangle, Info, Clock, Trash2, ClipboardList, ShieldAlert, Heart, Stethoscope, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../ui/dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { format, differenceInDays, isAfter, isBefore, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { analyzeSTPSQuestionnaire, generateLegalNormsSuggestions, explainLegalNorm, explainQuestionTechnicalTerm } from "../../services/geminiService";
import { useLiveQuery } from "dexie-react-hooks";
import { Checkbox } from "../ui/checkbox";

const STPS_QUESTIONS = [
  { id: "nom001", area: "Edificios y Locales", text: "¿Cuenta con edificios, locales, instalaciones y áreas permanentes o temporales en el centro de trabajo?" },
  { id: "nom002", area: "Prevención de Incendios", text: "¿Existen procesos o materiales que representen riesgo de incendio (todas las empresas aplican)?" },
  { id: "nom004", area: "Maquinaria y Equipo", text: "¿Utiliza maquinaria o equipo que represente riesgo por partes en movimiento, generación de calor o energía?" },
  { id: "nom005", area: "Sustancias Químicas", text: "¿Maneja, transporta o almacena sustancias químicas peligrosas (inflamables, explosivas, tóxicas, irritantes)?" },
  { id: "nom006", area: "Manejo de Materiales", text: "¿Realiza actividades de almacenamiento y manejo de materiales mediante el uso de maquinaria o de manera manual?" },
  { id: "nom009", area: "Trabajo en Altura", text: "¿Realiza trabajos a una altura mayor de 1.80 metros sobre el nivel del piso?" },
  { id: "nom020", area: "Recipientes a Presión", text: "¿Cuenta con recipientes sujetos a presión, recipientes criogénicos o generadores de vapor (calderas)?" },
  { id: "nom022", area: "Electricidad Estática", text: "¿Existen condiciones de electricidad estática o riesgos por descargas atmosféricas?" },
  { id: "nom025", area: "Iluminación", text: "¿Se requiere un nivel de iluminación específico para las tareas visuales de los trabajadores?" },
  { id: "nom011", area: "Ruido", text: "¿Existen niveles de ruido superiores a 85 dB(A) que puedan afectar la audición?" },
  { id: "nom033", area: "Espacios Confinados", text: "¿Realiza trabajos en espacios confinados (cisternas, silos, túneles, pozos)?" },
  { id: "nom017", area: "Equipo de Protección", text: "¿Se requiere el uso de equipo de protección personal específico según los riesgos?" },
  { id: "nom035", area: "Factores Psicosociales", text: "¿Cuenta con personal laborando (aplica a todos los centros de trabajo)?" },
  { id: "nom036", area: "Factores Ergonómicos", text: "¿Los trabajadores realizan manejo manual de cargas de forma cotidiana?" }
];

const DEFAULT_REQUIREMENTS = [
  { authority: "STPS", nomCode: "NOM-001-STPS-2008", requirement: "Edificios, locales, instalaciones y áreas en los centros de trabajo - Condiciones de seguridad." },
  { authority: "STPS", nomCode: "NOM-002-STPS-2010", requirement: "Condiciones de seguridad - Prevención y protección contra incendios en los centros de trabajo." },
  { authority: "STPS", nomCode: "NOM-004-STPS-1999", requirement: "Sistemas de protección y dispositivos de seguridad en la maquinaria y equipo que se utilice en los centros de trabajo." },
  { authority: "STPS", nomCode: "NOM-005-STPS-1998", requirement: "Relativa a las condiciones de seguridad e higiene en los centros de trabajo para el manejo, transporte y almacenamiento de sustancias químicas peligrosas." },
  { authority: "STPS", nomCode: "NOM-017-STPS-2008", requirement: "Equipo de protección personal - Selección, uso y manejo en los centros de trabajo." },
  { authority: "STPS", nomCode: "NOM-019-STPS-2011", requirement: "Constitución, integración, organización y funcionamiento de las comisiones de seguridad e higiene." },
  { authority: "STPS", nomCode: "NOM-030-STPS-2009", requirement: "Servicios preventivos de seguridad y salud en el trabajo - Funciones y actividades." },
  { authority: "Protección Civil", nomCode: "Ley General de PC", requirement: "Programa Interno de Protección Civil y capacitación de brigadas." },
  { authority: "IMSS", nomCode: "LSS Art. 70-83", requirement: "Seguro de Riesgos de Trabajo - Determinación de la prima en el seguro de riesgos de trabajo." },
  { authority: "SEMARNAT", nomCode: "LGPGIR", requirement: "Generación y manejo integral de residuos peligrosos." },
  { authority: "SEMADET/Estatal", nomCode: "Reglamento Estatal", requirement: "Cédula de Operación Anual (COA) y Registro de Emisiones." },
  { authority: "LEGEPA", nomCode: "LGEEPA", requirement: "Evaluación del impacto ambiental y prevención de la contaminación." },
];

export function LegalMatrixModule() {
  const { currentCompanyId } = useAppStore();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isGeneratingIA, setIsGeneratingIA] = useState(false);

  const company = useLiveQuery(
    () => currentCompanyId ? db.companies.get(currentCompanyId) : null,
    [currentCompanyId]
  );

  const requirements = useDexieQuery(
    () => currentCompanyId ? db.legalMatrix.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([]),
    [currentCompanyId, refreshTrigger]
  );

  const [activeAuthority, setActiveAuthority] = useState("TODAS");
  const [isSeeding, setIsSeeding] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [qAnswers, setQAnswers] = useState<Record<string, boolean>>({});
  const [qHelpId, setQHelpId] = useState<string | null>(null);
  const [qHelpText, setQHelpText] = useState<string>("");
  const [isGeneratingQHelp, setIsGeneratingQHelp] = useState(false);

  const [newReq, setNewReq] = useState<Partial<LegalMatrixRequirement>>({
    authority: "STPS",
    nomCode: "",
    requirement: "",
    applies: true,
    validityMonths: 12
  });

  const authorities = ["TODAS", ...new Set([...DEFAULT_REQUIREMENTS.map(r => r.authority), ...(requirements?.map(r => r.authority) || [])])];

  React.useEffect(() => {
    if (company?.stpsQuestionnaire) {
      try {
        setQAnswers(JSON.parse(company.stpsQuestionnaire));
      } catch (e) {
        console.error("Error parsing questionnaire", e);
      }
    }
  }, [company]);

  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [iaExplanation, setIaExplanation] = useState<string>("");
  const [isExplaining, setIsExplaining] = useState(false);

  const handleExplainNorm = async (requirement: LegalMatrixRequirement) => {
    setResolvingId(requirement.id!);
    setIaExplanation("");
    setIsExplaining(true);
    try {
      const text = await explainLegalNorm(requirement.nomCode, requirement.requirement, company?.businessLine);
      setIaExplanation(text);
    } catch (e) {
      toast.error("Error al obtener explicación");
    } finally {
      setIsExplaining(false);
    }
  };

  const handleSeed = async () => {
    if (!currentCompanyId) {
      toast.error("Selecciona una empresa primero");
      return;
    }
    setIsSeeding(true);
    try {
      const existingList = await db.legalMatrix.where("companyId").equals(currentCompanyId).toArray();
      const existingCodes = new Set(existingList.map(r => r.nomCode.trim().toLowerCase()));

      const toAdd = DEFAULT_REQUIREMENTS
        .filter(r => !existingCodes.has(r.nomCode.trim().toLowerCase()))
        .map(r => ({
          ...r,
          companyId: currentCompanyId,
          applies: null,
          updatedAt: new Date()
        }));

      if (toAdd.length > 0) {
        await db.legalMatrix.bulkAdd(toAdd);
        toast.success(`Se agregaron ${toAdd.length} normas del catálogo base sin duplicar`);
        setRefreshTrigger(prev => prev + 1);
      } else {
        toast.info("Todas las normas del catálogo base ya están registradas en tu matriz legal");
      }
    } catch (e) {
      toast.error("Error al cargar catálogo");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleAyudaQIA = async (q: typeof STPS_QUESTIONS[0]) => {
    setQHelpId(q.id);
    setQHelpText("");
    setIsGeneratingQHelp(true);
    try {
      const text = await explainQuestionTechnicalTerm(q.text, q.area);
      setQHelpText(text);
    } catch (e) {
      toast.error("Error al obtener ayuda IA");
    } finally {
      setIsGeneratingQHelp(false);
    }
  };

  const handleAnalizarCuestionarioIA = async () => {
    if (!currentCompanyId || !company) return;
    setIsGeneratingIA(true);
    try {
      // Save answers first
      await db.companies.update(currentCompanyId, {
        stpsQuestionnaire: JSON.stringify(qAnswers),
        updatedAt: new Date()
      });

      const suggestions = await analyzeSTPSQuestionnaire(company, qAnswers);
      if (suggestions.length > 0) {
        const existingList = await db.legalMatrix.where("companyId").equals(currentCompanyId).toArray();
        const existingCodes = new Set(existingList.map(r => r.nomCode.trim().toLowerCase()));

        const uniqueSuggestions = suggestions.filter(r => !existingCodes.has(r.nomCode.trim().toLowerCase()));

        if (uniqueSuggestions.length > 0) {
          const toAdd = uniqueSuggestions.map(r => ({
            ...r,
            companyId: currentCompanyId,
            applies: true, // If suggested based on "YES" answers, we mark it as applies
            updatedAt: new Date()
          }));
          
          await db.legalMatrix.bulkAdd(toAdd as LegalMatrixRequirement[]);
          toast.success(`IA ha identificado e incorporado ${uniqueSuggestions.length} nuevas normas aplicables`);
        } else {
          toast.info("Todas las normas identificadas por el análisis de IA ya están registradas");
        }
        
        setShowQuestionnaire(false);
        setRefreshTrigger(prev => prev + 1);
      } else {
        toast.warning("IA no pudo determinar normas aplicables. Revisa tus respuestas.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al analizar cuestionario");
    } finally {
      setIsGeneratingIA(false);
    }
  };

  const handleAyudaIA = async () => {
    if (!currentCompanyId || !company) return;
    setIsGeneratingIA(true);
    try {
      const suggestions = await generateLegalNormsSuggestions(company);
      if (suggestions.length > 0) {
        const existingList = await db.legalMatrix.where("companyId").equals(currentCompanyId).toArray();
        const existingCodes = new Set(existingList.map(r => r.nomCode.trim().toLowerCase()));

        const uniqueSuggestions = suggestions.filter(r => !existingCodes.has(r.nomCode.trim().toLowerCase()));

        if (uniqueSuggestions.length > 0) {
          const toAdd = uniqueSuggestions.map(r => ({
            ...r,
            companyId: currentCompanyId,
            applies: null,
            updatedAt: new Date()
          }));
          await db.legalMatrix.bulkAdd(toAdd as LegalMatrixRequirement[]);
          toast.success(`IA ha sugerido e incorporado ${uniqueSuggestions.length} nuevas normas`);
        } else {
          toast.info("Todas las normas sugeridas por la IA ya están registradas");
        }
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (e) {
      toast.error("Error al generar sugerencias IA");
    } finally {
      setIsGeneratingIA(false);
    }
  };

  const handleCreate = async () => {
    if (!currentCompanyId || !newReq.nomCode || !newReq.requirement) return;
    try {
      const existingList = await db.legalMatrix.where("companyId").equals(currentCompanyId).toArray();
      const isDuplicate = existingList.some(r => r.nomCode.trim().toLowerCase() === newReq.nomCode!.trim().toLowerCase());
      
      if (isDuplicate) {
        toast.warning(`La norma "${newReq.nomCode}" ya se encuentra registrada para este centro de trabajo.`);
        return;
      }

      await db.legalMatrix.add({
        ...newReq,
        companyId: currentCompanyId,
        updatedAt: new Date()
      } as LegalMatrixRequirement);
      toast.success("Requerimiento agregado");
      setRefreshTrigger(prev => prev + 1);
      setIsAdding(false);
      setNewReq({ authority: "STPS", nomCode: "", requirement: "", applies: true, validityMonths: 12 });
    } catch (e) {
      toast.error("Error al agregar");
    }
  };

  const updateRequirement = async (id: number, updates: Partial<LegalMatrixRequirement>) => {
    try {
      const existingReq = await db.legalMatrix.get(id);
      if (!existingReq) return;

      const finalUpdates: any = { ...updates, updatedAt: new Date() };
      
      // Auto calculate expiration if dates change or applies status changes
      const execDate = updates.executionDate !== undefined ? updates.executionDate : existingReq.executionDate;
      const months = updates.validityMonths !== undefined ? updates.validityMonths : existingReq.validityMonths;
      
      if (execDate && months !== undefined) {
        finalUpdates.expirationDate = addMonths(new Date(execDate), months);
      }

      await db.legalMatrix.update(id, finalUpdates);
      setRefreshTrigger(prev => prev + 1);
      if (updates.applies !== undefined) {
        toast.success(`Estado actualizado: ${updates.applies ? "SÍ Aplica" : "NO Aplica"}`);
      }
    } catch (e) {
      console.error("Error updating requirement:", e);
      toast.error("Error al actualizar datos");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este requerimiento?")) return;
    try {
      await db.legalMatrix.delete(id);
      toast.success("Requerimiento eliminado");
      setRefreshTrigger(prev => prev + 1);
    } catch (e) {
      toast.error("Error al eliminar");
    }
  };

  const handleDeleteAll = async () => {
    if (!currentCompanyId) return;
    if (!confirm("¿Estás seguro de que deseas eliminar todas las normas registradas para esta empresa? Esta acción no se puede deshacer y borrará toda la personalización de cumplimiento realizada.")) return;
    try {
      const records = await db.legalMatrix.where("companyId").equals(currentCompanyId).toArray();
      const ids = records.map(r => r.id).filter((id): id is number => typeof id === 'number');
      await db.legalMatrix.bulkDelete(ids);
      toast.success("Se han eliminado todas las normas de este centro de trabajo");
      setRefreshTrigger(prev => prev + 1);
    } catch (e) {
      toast.error("Error al limpiar la matriz legal");
    }
  };

  const totalApplies = requirements?.filter(r => r.applies === true).length || 0;
  const totalPending = (requirements?.length || 0) - totalApplies - (requirements?.filter(r => r.applies === false).length || 0);

  const getExpirationStatus = (expirationDate?: Date) => {
    if (!expirationDate) return null;
    const now = new Date();
    const expiry = new Date(expirationDate);
    const daysUntil = differenceInDays(expiry, now);

    if (isBefore(expiry, now)) return { label: "Vencido", color: "bg-red-100 text-red-700", icon: <XCircle className="w-3 h-3" /> };
    if (daysUntil <= 30) return { label: `Vence en ${daysUntil} d`, color: "bg-orange-100 text-orange-700", icon: <AlertTriangle className="w-3 h-3" /> };
    return { label: "Vigente", color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="w-3 h-3" /> };
  };

  if (!currentCompanyId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
        <Scale className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-lg font-medium">Selecciona una empresa para gestionar su matriz legal</p>
      </div>
    );
  }

  const filteredRequirements = activeAuthority === "TODAS" 
    ? (requirements || []) 
    : (requirements || []).filter(r => r.authority === activeAuthority);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight uppercase">Normativa Aplicable</h1>
        <p className="text-[10px] text-slate-500 font-medium">Gestión de cumplimiento normativo nacional e internacional.</p>
      </header>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-4">
            <span className="text-[10px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-100 italic">
              {totalApplies} APLICAN
            </span>
            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100 italic">
              {totalPending} PENDIENTES
            </span>
          </div>
          <div className="flex gap-2">
            <Dialog open={showQuestionnaire} onOpenChange={setShowQuestionnaire}>
              <DialogTrigger render={<Button variant="outline" size="sm" className="border-blue-200 text-blue-700 hover:bg-blue-50" />}>
                <ClipboardList className="w-3 h-3 mr-2" />
                Diagnóstico STPS
              </DialogTrigger>
              <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-blue-600" />
                    Cuestionario de Autogestión STPS
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <p className="text-xs text-blue-800 leading-relaxed">
                      Responde este cuestionario basado en la <strong>Guía de Autogestión de la STPS</strong>. 
                      La IA analizará tus respuestas para determinar automáticamente las normas obligatorias para tu centro de trabajo.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    {STPS_QUESTIONS.map((q) => (
                      <div key={q.id} className="space-y-3 p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                        <div className="flex items-start gap-3">
                          <Checkbox 
                            id={q.id} 
                            checked={qAnswers[q.text] || false}
                            onCheckedChange={(checked) => setQAnswers({...qAnswers, [q.text]: !!checked})}
                            className="mt-1"
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <Label htmlFor={q.id} className="text-sm font-bold cursor-pointer">{q.area}</Label>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 px-2 text-[10px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-bold"
                                onClick={() => handleAyudaQIA(q)}
                              >
                                <Sparkles className="w-3 h-3 mr-1" /> Ayuda IA
                              </Button>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed cursor-pointer" onClick={() => setQAnswers({...qAnswers, [q.text]: !qAnswers[q.text]})}>
                              {q.text}
                            </p>
                          </div>
                        </div>

                        {qHelpId === q.id && (
                          <div className="ml-8 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 relative animate-in fade-in slide-in-from-top-1 duration-200">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="absolute top-1 right-1 h-5 w-5 text-indigo-400 hover:text-indigo-600"
                              onClick={() => setQHelpId(null)}
                            >
                              <XCircle className="w-3 h-3" />
                            </Button>
                            {isGeneratingQHelp ? (
                              <div className="flex items-center gap-2 py-1">
                                <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin" />
                                <span className="text-[10px] text-indigo-600 font-medium">Consultando conceptos técnicos...</span>
                              </div>
                            ) : (
                              <p className="text-[11px] text-indigo-800 leading-relaxed italic pr-4">
                                {qHelpText}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <DialogFooter className="sticky bottom-0 bg-white pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowQuestionnaire(false)}>Cancelar</Button>
                  <Button 
                    onClick={handleAnalizarCuestionarioIA} 
                    disabled={isGeneratingIA}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {isGeneratingIA ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Analizando...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" /> Determinar NOM Aplicables</>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button 
              onClick={handleAyudaIA} 
              disabled={isGeneratingIA} 
              variant="outline" 
              size="sm"
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <Sparkles className={`w-3 h-3 mr-2 ${isGeneratingIA ? 'animate-spin' : ''}`} />
              Sugerencia IA
            </Button>
            <Button onClick={handleSeed} disabled={isSeeding} variant="outline" size="sm" className="border-slate-200">
              <RefreshCw className={`w-3 h-3 mr-2 ${isSeeding ? 'animate-spin' : ''}`} />
              Cargar Catálogo Base
            </Button>
            {requirements && requirements.length > 0 && (
              <Button onClick={handleDeleteAll} variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                <Trash2 className="w-3 h-3 mr-2" />
                Limpiar Matriz
              </Button>
            )}
            <Dialog open={isAdding} onOpenChange={setIsAdding}>
              <DialogTrigger render={<Button size="sm" className="bg-blue-600" />}>
                <Plus className="w-3 h-3 mr-2" /> Agregar Norma
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Nuevo Requerimiento Legal</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="auth" className="text-right">Autoridad</Label>
                    <Input id="auth" className="col-span-3 text-sm" value={newReq.authority} onChange={e => setNewReq({...newReq, authority: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="code" className="text-right">Norma</Label>
                    <Input id="code" className="col-span-3 text-sm" value={newReq.nomCode} onChange={e => setNewReq({...newReq, nomCode: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="req" className="text-right">Requerimiento</Label>
                    <Textarea id="req" className="col-span-3 text-sm" value={newReq.requirement} onChange={e => setNewReq({...newReq, requirement: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="validity" className="text-right">Vigencia (Meses)</Label>
                    <Input id="validity" type="number" className="col-span-3 text-sm" value={newReq.validityMonths} onChange={e => setNewReq({...newReq, validityMonths: parseInt(e.target.value) || 0})} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAdding(false)}>Cancelar</Button>
                  <Button onClick={handleCreate} className="bg-blue-600">Guardar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50 py-3">
            <Tabs value={activeAuthority} onValueChange={setActiveAuthority} className="w-full">
              <TabsList className="bg-slate-100 flex-wrap h-auto p-1">
                {authorities.map(auth => (
                  <TabsTrigger key={auth} value={auth} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider">
                    {auth}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0 overflow-auto">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="w-[120px]">Norma</TableHead>
                  <TableHead className="min-w-[200px]">Requerimiento</TableHead>
                  <TableHead className="w-[120px] text-center">¿Aplica?</TableHead>
                  <TableHead className="w-[110px]">Estatus</TableHead>
                  <TableHead className="w-[130px]">F. Cumplimiento</TableHead>
                  <TableHead className="w-[130px]">Vencimiento</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequirements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-slate-400">
                      No hay registros. Haz clic en "Cargar Catálogo Base" para iniciar.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequirements.map((r) => {
                    const status = getExpirationStatus(r.expirationDate);
                    return (
                      <TableRow key={r.id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <code className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 w-fit">
                              {r.nomCode}
                            </code>
                            <Badge variant="outline" className="text-[9px] uppercase py-0 h-4 border-slate-200">
                              {r.authority}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 leading-tight">
                          <div className="flex flex-col gap-1">
                            <span>{r.requirement}</span>
                            <Dialog open={resolvingId === r.id} onOpenChange={(open) => !open && setResolvingId(null)}>
                              <DialogTrigger render={
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-5 px-1.5 text-[9px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 w-fit gap-1 font-bold"
                                  onClick={() => handleExplainNorm(r)}
                                >
                                  <HelpCircle className="w-2.5 h-2.5" /> ¿Cómo aplicar?
                                </Button>
                              } />
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <HelpCircle className="w-5 h-5 text-indigo-600" />
                                    Orientación sobre cumplimiento: {r.nomCode}
                                  </DialogTitle>
                                </DialogHeader>
                                <div className="py-4">
                                  {isExplaining ? (
                                    <div className="flex flex-col items-center justify-center py-8 space-y-3">
                                      <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                                      <p className="text-xs text-slate-500 animate-pulse">Consultando al experto IA...</p>
                                    </div>
                                  ) : (
                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 whitespace-pre-wrap text-sm text-slate-700 leading-relaxed italic">
                                      {iaExplanation}
                                    </div>
                                  )}
                                </div>
                                <DialogFooter>
                                  <Button onClick={() => setResolvingId(null)}>Entendido</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            <div className="flex bg-slate-200/50 p-0.5 rounded-lg border border-slate-300 w-fit">
                              <button 
                                onClick={() => r.id && updateRequirement(r.id, { applies: true })}
                                className={cn("px-4 py-1 text-[10px] font-extrabold rounded-md transition-all", r.applies === true ? "bg-white text-green-600 shadow-sm" : "text-slate-500")}
                              >SÍ</button>
                              <button 
                                onClick={() => r.id && updateRequirement(r.id, { applies: false })}
                                className={cn("px-4 py-1 text-[10px] font-extrabold rounded-md transition-all", r.applies === false ? "bg-white text-red-600 shadow-sm" : "text-slate-500")}
                              >NO</button>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {r.applies === true ? (
                            r.executionDate ? (
                              <Badge className={cn("text-[9px] py-0 h-5 border-none", status?.color || "bg-blue-100 text-blue-700")}>
                                {status?.label.toUpperCase() || "CUMPLE"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[9px] py-0 h-5">PENDIENTE</Badge>
                            )
                          ) : r.applies === false ? (
                            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 text-[9px] py-0 h-5 font-bold">N/A</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-50 text-slate-400 border-slate-100 text-[9px] py-0 h-5 italic font-medium">PEND. EVAL.</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="date" 
                            className="text-[10px] h-7 px-1 w-full"
                            value={r.executionDate ? format(new Date(r.executionDate), 'yyyy-MM-dd') : ""}
                            onChange={(e) => r.id && updateRequirement(r.id, { executionDate: e.target.value ? new Date(e.target.value) : undefined })}
                            disabled={r.applies === false}
                          />
                        </TableCell>
                        <TableCell>
                          {r.expirationDate && (
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-slate-700">{format(new Date(r.expirationDate), 'dd/MM/yyyy')}</span>
                              {status && <span className={cn("text-[8px] font-bold", status.color.split(' ')[1])}>{status.label}</span>}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300 hover:text-red-500" onClick={() => r.id && handleDelete(r.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
