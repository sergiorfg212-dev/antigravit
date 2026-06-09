import { useState } from "react";
import { db, type RiskAssessment, type Finding } from "../../lib/db";
import { useDexieQuery } from "../../hooks/useDexie";
import { useAppStore } from "../../hooks/useAppStore";
import { Button } from "../ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { 
  AlertTriangle, 
  Plus, 
  ShieldCheck, 
  Zap, 
  Info, 
  ArrowUpRight, 
  TrendingUp, 
  Calculator, 
  Trash2, 
  Sparkles,
  Camera, 
  Upload, 
  Loader2, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Trash, 
  Eye 
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "../ui/table";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription 
} from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Separator } from "../ui/separator";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { suggestRiskAssessments, generateSpecificRiskAnalysis, analyzeRiskFromPhoto } from "../../services/geminiService";

const FINE_CONSEQUENCES = [
  { value: 100, label: "Catastrófico (Varias muertes)", color: "bg-red-700" },
  { value: 40, label: "Desastre (Alguna muerte)", color: "bg-red-500" },
  { value: 15, label: "Muy Grave (Una muerte)", color: "bg-orange-600" },
  { value: 6, label: "Grave (Incapacidad permanente)", color: "bg-amber-600" },
  { value: 4, label: "Serio (Incapacidad temporal)", color: "bg-blue-600" },
  { value: 1, label: "Leve (Pequeñas lesiones)", color: "bg-slate-600" },
];

const FINE_EXPOSURE = [
  { value: 10, label: "Continua" },
  { value: 6, label: "Frecuente (Diaria)" },
  { value: 3, label: "Ocasional (Semanal)" },
  { value: 2, label: "Inusual (Mensual)" },
  { value: 1, label: "Rara (Anual)" },
  { value: 0.5, label: "Muy rara" },
];

const FINE_PROBABILITY = [
  { value: 10, label: "Esperado (Casi seguro)" },
  { value: 6, label: "Es muy posible" },
  { value: 3, label: "Inusual pero posible" },
  { value: 1, label: "Remotamente posible" },
  { value: 0.5, label: "Extremadamente remoto" },
  { value: 0.1, label: "Prácticamente imposible" },
];

export function RiskModule() {
  const { currentCompanyId } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Custom states for Visual Photo Analysis with AI
  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isPhotoAnalyzing, setIsPhotoAnalyzing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [analyzedRisks, setAnalyzedRisks] = useState<any[]>([]);
  const [expandedDraftIndex, setExpandedDraftIndex] = useState<number | null>(null);

  const [localGeminiKey, setLocalGeminiKey] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('nom030_gemini_api_key') || '' : '';
  });
  const [tempApiKey, setTempApiKey] = useState("");
  const hasApiKey = !!(localGeminiKey || (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY));

  const [formData, setFormData] = useState<{
    category: 'unsafe_condition' | 'physical_agent' | 'chemical_agent' | 'biological_agent' | 'hazard' | 'regulatory_requirement';
    processName: string;
    activity: string;
    hazard: string;
    possibleConsequence: string;
    method: 'fine' | 'matrix';
    probability: number;
    severity: number;
    consequence: number;
    exposure: number;
    likelihood: number;
    controls: string;
    responsible: string;
    commitmentDate: string;
  }>({
    category: 'unsafe_condition',
    processName: "",
    activity: "",
    hazard: "",
    possibleConsequence: "",
    method: 'fine',
    probability: 3,
    severity: 3,
    consequence: 15,
    exposure: 3,
    likelihood: 3,
    controls: "",
    responsible: "",
    commitmentDate: new Date().toISOString().split('T')[0]
  });

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const risks = useDexieQuery(
    () => currentCompanyId ? db.riskAssessments.where('companyId').equals(currentCompanyId).toArray() : Promise.resolve([]),
    [currentCompanyId, refreshTrigger]
  ) || [];

  const activeCompany = useDexieQuery(
    () => currentCompanyId ? db.companies.get(currentCompanyId) : Promise.resolve(null),
    [currentCompanyId]
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingSpecific, setIsGeneratingSpecific] = useState(false);
  const [isSpecificPhotoAnalyzing, setIsSpecificPhotoAnalyzing] = useState(false);

  const handlePhotoSpecificUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSpecificPhotoAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        toast.info("Iniciando análisis óptico del peligro en la fotografía. Por favor espere...");
        const result = await analyzeRiskFromPhoto(base64, `Evaluación para empresa: ${activeCompany?.activity || "General"}`);
        if (result && result.length > 0) {
          const mainRisk = result[0];
          setFormData(prev => ({
            ...prev,
            category: (mainRisk.category === "hazard" ? "hazard" : mainRisk.category) as any || prev.category,
            processName: mainRisk.processName || prev.processName || "General",
            activity: mainRisk.activity || prev.activity || "Operación",
            hazard: mainRisk.hazard || prev.hazard,
            possibleConsequence: mainRisk.possibleConsequence || prev.possibleConsequence,
            controls: mainRisk.controls || prev.controls,
            responsible: mainRisk.responsible || prev.responsible || "Supervisor de Seguridad",
            probability: Number(mainRisk.probability) || prev.probability,
            severity: Number(mainRisk.severity) || prev.severity,
            consequence: Number(mainRisk.consequence) || prev.consequence,
            exposure: Number(mainRisk.exposure) || prev.exposure,
            likelihood: Number(mainRisk.likelihood) || prev.likelihood,
          }));
          toast.success("¡Fotografía analizada con éxito! Los campos se han pre-llenado automáticamente.");
        } else {
          toast.warning("La IA no identificó riesgos claros en la fotografía suministrada.");
        }
      } catch (err: any) {
        console.error("Error analyzing specific photo:", err);
        toast.error("Error al analizar la fotografía con IA: " + (err.message || ""));
      } finally {
        setIsSpecificPhotoAnalyzing(false);
      }
    };
    reader.onerror = () => {
      toast.error("Error al leer el archivo de imagen.");
      setIsSpecificPhotoAnalyzing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateSpecificRiskAI = async () => {
    if (!formData.processName) {
      toast.warning("Por favor asigne primero un Proceso / Área para dar contexto a la IA.");
      return;
    }
    if (!activeCompany) {
      toast.error("No se encontró la información de la empresa.");
      return;
    }
    setIsGeneratingSpecific(true);
    try {
      const result = await generateSpecificRiskAnalysis(
        formData.category,
        formData.processName,
        formData.activity || "Operación general",
        activeCompany
      );
      if (result) {
        setFormData(prev => ({
          ...prev,
          hazard: result.hazard || prev.hazard,
          possibleConsequence: result.possibleConsequence || prev.possibleConsequence,
          controls: result.controls || prev.controls,
          responsible: result.responsible || prev.responsible
        }));
        toast.success("Análisis de riesgo y controles generados por la IA.");
      }
    } catch (e) {
      console.error("Error generating specific analysis with IA:", e);
      toast.error("Error al generar análisis con IA");
    } finally {
      setIsGeneratingSpecific(false);
    }
  };

  const handleGenerateRisksWithIA = async () => {
    if (!activeCompany || !currentCompanyId) return;
    setIsGenerating(true);
    try {
      const suggestions = await suggestRiskAssessments(activeCompany);
      if (suggestions.length > 0) {
        const existingRisks = await db.riskAssessments.where("companyId").equals(currentCompanyId).toArray();
        const existingHazards = new Set(existingRisks.map(r => r.hazard.trim().toLowerCase()));

        const uniqueSuggestions = suggestions.filter(s => {
          const hazardText = (s.hazard || "Riesgo no especificado").trim().toLowerCase();
          return !existingHazards.has(hazardText);
        });

        if (uniqueSuggestions.length > 0) {
          for (const s of uniqueSuggestions) {
            const score = (s.probability || 3) * (s.severity || 3);
            let priority: 'low' | 'medium' | 'high' | 'very_high' = 'low';
            if (score >= 20) priority = 'very_high';
            else if (score >= 12) priority = 'high';
            else if (score >= 8) priority = 'medium';

            const riskEntry: any = {
              companyId: currentCompanyId,
              diagnosisId: 0,
              processName: s.processName || "General",
              activity: s.activity || "Operación",
              hazard: s.hazard || "Riesgo no especificado",
              category: s.category || 'unsafe_condition',
              method: 'matrix',
              probability: s.probability || 3,
              severity: s.severity || 3,
              riskLevel: score,
              priority: priority,
              controls: s.controls || "Implementar medidas de seguridad",
              responsible: s.responsible || "Supervisor de Seguridad",
              createdAt: new Date(),
              updatedAt: new Date()
            };

            const riskId = await db.riskAssessments.add(riskEntry);

            const findingSeverity: 'low' | 'medium' | 'high' | 'critical' = 
              (s.severity || 3) >= 5 ? 'critical' : 
              (s.severity || 3) >= 4 ? 'high' : 
              (s.severity || 3) >= 3 ? 'medium' : 'low';

            const findingData: any = {
              companyId: currentCompanyId,
              diagnosisId: 0,
              title: s.hazard || "Riesgo IA",
              description: s.hazard || "Riesgo identificado por IA",
              category: s.category || 'unsafe_condition',
              severity: findingSeverity,
              priority: priority,
              status: 'pending',
              responsible: s.responsible || "Supervisor de Seguridad",
              commitmentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              correctiveAction: s.controls || "Medida sugerida por IA",
              riskMethod: 'matrix',
              riskScore: score,
              possibleConsequence: s.possibleConsequence || "",
              evidenceUrls: [],
              nomReference: [],
              createdAt: new Date(),
              updatedAt: new Date()
            };

            const findingId = await db.findings.add(findingData);
            await db.riskAssessments.update(riskId, { findingId });
          }
          setRefreshTrigger(prev => prev + 1);
          toast.success(`IA ha sugerido y registrado ${uniqueSuggestions.length} nuevos riesgos potenciales.`);
        } else {
          toast.info("Todos los riesgos sugeridos por la IA ya se encuentran registrados.");
        }
      } else {
        toast.warning("IA no encontró riesgos específicos sugeridos.");
      }
    } catch (e) {
      console.error("Error generating risks with IA:", e);
      toast.error("Error al generar riesgos con IA");
    } finally {
      setIsGenerating(false);
    }
  };

  const runPhotoAnalysis = async () => {
    if (!photoBase64) return;
    setIsPhotoAnalyzing(true);
    
    const messages = [
      "Iniciando análisis óptico de la fotografía...",
      "Reconociendo condiciones inseguras y agentes...",
      "Cuantificando riesgos mediante metodologías William Fine y 5x5...",
      "Sugerido medidas preventivas y responsables..."
    ];
    let msgIdx = 0;
    setLoadingMessage(messages[0]);
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      setLoadingMessage(messages[msgIdx]);
    }, 2500);

    try {
      const result = await analyzeRiskFromPhoto(photoBase64, extraContext);
      if (result && result.length > 0) {
        setAnalyzedRisks(result.map((risk, index) => ({
          ...risk,
          tempId: index,
          selected: true
        })));
        setExpandedDraftIndex(0); // expand first item by default
        toast.success(`La IA identificó ${result.length} posibles riesgos en la foto.`);
      } else {
        toast.warning("La IA no logró identificar riesgos claros en la fotografía.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al procesar la imagen con IA.");
    } finally {
      clearInterval(interval);
      setIsPhotoAnalyzing(false);
    }
  };

  const calculateDraftRisk = (risk: any) => {
    if (risk.method === 'matrix') {
      const score = (risk.probability || 3) * (risk.severity || 3);
      let priority: 'low' | 'medium' | 'high' | 'very_high' = 'low';
      if (score >= 20) priority = 'very_high';
      else if (score >= 12) priority = 'high';
      else if (score >= 8) priority = 'medium';
      return { score, priority };
    } else {
      const score = (risk.consequence || 15) * (risk.exposure || 3) * (risk.likelihood || 3);
      let priority: 'low' | 'medium' | 'high' | 'very_high' = 'low';
      if (score > 400) priority = 'very_high';
      else if (score >= 200) priority = 'high';
      else if (score >= 70) priority = 'medium';
      return { score, priority };
    }
  };

  const commitSelectedAnalysisRisks = async () => {
    const selectedDrafts = analyzedRisks.filter(r => r.selected);
    if (selectedDrafts.length === 0) {
      toast.warning("Por favor selecciona al menos un riesgo para guardar.");
      return;
    }

    try {
      for (const draft of selectedDrafts) {
        const { score, priority } = calculateDraftRisk(draft);
        
        let findingSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (draft.method === 'matrix') {
          if (draft.severity >= 5) findingSeverity = 'critical';
          else if (draft.severity >= 4) findingSeverity = 'high';
          else if (draft.severity >= 3) findingSeverity = 'medium';
        } else {
          if (draft.consequence >= 40) findingSeverity = 'critical';
          else if (draft.consequence >= 15) findingSeverity = 'high';
          else if (draft.consequence >= 6) findingSeverity = 'medium';
        }

        const riskEntry = {
          companyId: currentCompanyId!,
          diagnosisId: 0,
          processName: draft.processName || "No especificado",
          activity: draft.activity || "Operación general",
          hazard: draft.hazard || "Peligro identificado",
          category: draft.category || 'unsafe_condition',
          method: draft.method || 'matrix',
          probability: draft.probability || 3,
          severity: draft.severity || 3,
          consequence: draft.consequence || 15,
          exposure: draft.exposure || 3,
          likelihood: draft.likelihood || 3,
          riskLevel: score,
          priority: priority,
          controls: draft.controls || "Medida de control sugerida",
          responsible: draft.responsible || "Supervisor de Seguridad",
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const riskId = await db.riskAssessments.add(riskEntry as any);

        const findingData = {
          companyId: currentCompanyId!,
          diagnosisId: 0,
          title: draft.hazard || "Riesgo IA Especializado",
          description: draft.hazard || "Riesgo detectado por IA visual",
          category: draft.category || 'unsafe_condition',
          severity: findingSeverity,
          priority: priority,
          status: 'pending' as const,
          responsible: draft.responsible || "Supervisor de Seguridad",
          commitmentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
          correctiveAction: draft.controls || "Medida recomendada",
          riskMethod: draft.method || 'matrix',
          riskScore: score,
          possibleConsequence: draft.possibleConsequence || "",
          evidenceUrls: [],
          nomReference: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const findingId = await db.findings.add(findingData as any);
        await db.riskAssessments.update(riskId, { findingId });
      }

      toast.success(`Se registraron exitosamente ${selectedDrafts.length} riesgos evaluados.`);
      setRefreshTrigger(prev => prev + 1);
      
      // Cleanup
      setPhotoBase64(null);
      setAnalyzedRisks([]);
      setExtraContext("");
      setIsPhotoDialogOpen(false);
    } catch (err) {
      console.error("Error committing risks from photo analysis:", err);
      toast.error("Error al registrar los riesgos.");
    }
  };

  const updateDraftRiskField = (index: number, field: string, value: any) => {
    setAnalyzedRisks(prev => prev.map((risk, idx) => {
      if (idx === index) {
        return { ...risk, [field]: value };
      }
      return risk;
    }));
  };

  const handleEdit = (risk: RiskAssessment) => {
    setEditingId(risk.id || null);
    setFormData({
      category: (risk.category as any) || 'unsafe_condition',
      processName: risk.processName,
      activity: risk.activity,
      hazard: risk.hazard,
      possibleConsequence: "", 
      method: risk.method,
      probability: risk.probability || 3,
      severity: risk.severity || 3,
      consequence: risk.consequence || 15,
      exposure: risk.exposure || 3,
      likelihood: risk.likelihood || 3,
      controls: risk.controls,
      responsible: risk.responsible,
      commitmentDate: risk.updatedAt ? (risk.updatedAt instanceof Date ? risk.updatedAt : new Date(risk.updatedAt)).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    });
    
    if (risk.findingId) {
      db.findings.get(risk.findingId).then(finding => {
        if (finding) {
          setFormData(prev => ({
            ...prev,
            possibleConsequence: finding.possibleConsequence || "",
            commitmentDate: finding.commitmentDate ? new Date(finding.commitmentDate).toISOString().split('T')[0] : prev.commitmentDate
          }));
        }
      });
    }
    
    setIsOpen(true);
  };

  const calculateFineMethod = () => {
    const score = formData.consequence * formData.exposure * formData.likelihood;
    let priority: 'low' | 'medium' | 'high' | 'very_high' = 'low';
    if (score > 400) priority = 'very_high';
    else if (score >= 200) priority = 'high';
    else if (score >= 70) priority = 'medium';
    return { score, priority };
  };

  const calculateMatrixMethod = () => {
    const score = formData.probability * formData.severity;
    let priority: 'low' | 'medium' | 'high' | 'very_high' = 'low';
    if (score >= 20) priority = 'very_high';
    else if (score >= 12) priority = 'high';
    else if (score >= 8) priority = 'medium';
    return { score, priority };
  };

  const calculateRisk = () => {
    if (formData.method === 'matrix') {
      return calculateMatrixMethod();
    } else {
      return calculateFineMethod();
    }
  };

  const fineVal = calculateFineMethod();
  const matrixVal = calculateMatrixMethod();
  const { score: currentScore, priority: currentPriority } = calculateRisk();

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'very_high': return "bg-red-100 text-red-700 border-red-200";
      case 'high': return "bg-orange-100 text-orange-700 border-orange-200";
      case 'medium': return "bg-amber-100 text-amber-700 border-amber-200";
      default: return "bg-green-100 text-green-700 border-green-200";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'very_high': return "Muy Alto (Corrección Inmediata)";
      case 'high': return "Alto (Urgente)";
      case 'medium': return "Medio (Necesario)";
      default: return "Bajo (Aceptable)";
    }
  };

  const saveRisk = async (stayInForm: boolean = false) => {
    if (!formData.processName || !formData.hazard) {
      toast.error("Por favor completa los campos obligatorios: Proceso y Peligro");
      return;
    }

    try {
      const { score, priority } = calculateRisk();
      
      let findingSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (formData.method === 'matrix') {
        if (formData.severity >= 5) findingSeverity = 'critical';
        else if (formData.severity >= 4) findingSeverity = 'high';
        else if (formData.severity >= 3) findingSeverity = 'medium';
      } else {
        if (formData.consequence >= 40) findingSeverity = 'critical';
        else if (formData.consequence >= 15) findingSeverity = 'high';
        else if (formData.consequence >= 6) findingSeverity = 'medium';
      }

      const riskEntry: any = {
        companyId: currentCompanyId!,
        diagnosisId: 0, 
        processName: formData.processName,
        activity: formData.activity,
        hazard: formData.hazard,
        method: formData.method,
        probability: formData.probability,
        severity: formData.severity,
        consequence: formData.consequence,
        exposure: formData.exposure,
        likelihood: formData.likelihood,
        riskLevel: score,
        priority: priority as any,
        controls: formData.controls,
        responsible: formData.responsible,
        updatedAt: new Date()
      };

      if (!editingId) {
        riskEntry.createdAt = new Date();
      }

      let riskId: number;
      let findingId: number | undefined;

      if (editingId) {
        await db.riskAssessments.update(editingId, riskEntry);
        riskId = editingId;
        const currentRisk = await db.riskAssessments.get(editingId);
        findingId = currentRisk?.findingId;
      } else {
        riskId = await db.riskAssessments.add(riskEntry as any);
      }

      const findingData: any = {
        companyId: currentCompanyId!,
        diagnosisId: 0,
        title: formData.hazard,
        description: formData.hazard,
        category: formData.category,
        severity: findingSeverity,
        priority: priority as any,
        status: 'pending',
        responsible: formData.responsible,
        commitmentDate: new Date(formData.commitmentDate),
        correctiveAction: formData.controls,
        riskMethod: formData.method,
        riskScore: score,
        possibleConsequence: formData.possibleConsequence,
        updatedAt: new Date()
      };

      if (findingId) {
        await db.findings.update(findingId, findingData);
      } else {
        findingData.createdAt = new Date();
        findingData.evidenceUrls = [];
        findingData.nomReference = [];
        findingId = await db.findings.add(findingData);
        await db.riskAssessments.update(riskId, { findingId });
      }

      toast.success(editingId ? "Evaluación actualizada" : "Evaluación y hallazgo guardados correctamente");
      setRefreshTrigger(prev => prev + 1);
      
      if (stayInForm && !editingId) {
        setFormData(prev => ({
          ...prev,
          hazard: "",
          possibleConsequence: "",
          controls: "",
        }));
      } else {
        setIsOpen(false);
        setEditingId(null);
        setFormData({
          category: 'unsafe_condition',
          processName: "",
          activity: "",
          hazard: "",
          possibleConsequence: "",
          method: 'fine',
          probability: 3,
          severity: 3,
          consequence: 15,
          exposure: 3,
          likelihood: 3,
          controls: "",
          responsible: "",
          commitmentDate: new Date().toISOString().split('T')[0]
        });
      }
    } catch (e) {
      console.error("Critical error saving risk:", e);
      toast.error("Error al guardar evaluación: " + (e instanceof Error ? e.message : "Error desconocido"));
    }
  };

  if (!currentCompanyId) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold">Selecciona una empresa</h3>
        <p className="text-slate-500 mt-2">Debes seleccionar una empresa para ver su matriz de riesgos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Evaluación de Riesgos</h1>
          <p className="text-slate-500">Cuantificación de peligros mediante método William Fine o Matriz 5x5.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setIsPhotoDialogOpen(true)}
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <Camera className="w-4 h-4 mr-2" />
            Analizar Foto con IA
          </Button>
          <Button 
            variant="outline" 
            onClick={handleGenerateRisksWithIA}
            disabled={isGenerating}
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            <Sparkles className={cn("w-4 h-4 mr-2", isGenerating && "animate-spin")} />
            {isGenerating ? "Generando..." : "Generación de Riesgos con IA"}
          </Button>
          <Dialog open={isOpen} onOpenChange={(v) => {
          setIsOpen(v);
          if (!v) {
            setEditingId(null);
            setFormData({
              category: 'unsafe_condition',
              processName: "",
              activity: "",
              hazard: "",
              possibleConsequence: "",
              method: 'fine',
              probability: 3,
              severity: 3,
              consequence: 15,
              exposure: 3,
              likelihood: 3,
              controls: "",
              responsible: "",
              commitmentDate: new Date().toISOString().split('T')[0]
            });
          }
        }}>
          <DialogTrigger
            render={
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Evaluar Riesgo
              </Button>
            }
          />
          <DialogContent className="sm:max-w-[850px] max-h-[92vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-5 border-b shrink-0 bg-slate-50">
              <DialogTitle className="text-lg font-bold text-slate-900">{editingId ? "Editar Evaluación de Riesgo" : "Nueva Evaluación de Riesgo"}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
               <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <h3 className="text-xs uppercase font-black text-slate-500">1. Identificación de la Condición / Agente</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label className="text-xs font-bold">Categoría del Peligro (NOM-030)</Label>
                      <Select 
                        value={formData.category} 
                        onValueChange={(v: any) => setFormData({ ...formData, category: v })}
                      >
                        <SelectTrigger className="h-10 bg-white border-slate-200">
                          <SelectValue placeholder="Selecciona categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unsafe_condition">Condición Insegura</SelectItem>
                          <SelectItem value="physical_agent">Agente Físico</SelectItem>
                          <SelectItem value="chemical_agent">Agente Químico</SelectItem>
                          <SelectItem value="biological_agent">Agente Biológico</SelectItem>
                          <SelectItem value="hazard">Peligro Circundante</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Proceso / Área</Label>
                      <Input 
                        placeholder="Ej. Almacén de Químicos" 
                        value={formData.processName}
                        onChange={e => setFormData({ ...formData, processName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Actividad</Label>
                      <Input 
                        placeholder="Ej. Carga y descarga" 
                        value={formData.activity}
                        onChange={e => setFormData({ ...formData, activity: e.target.value })}
                      />
                    </div>
                  </div>
               </div>

               <div className="col-span-2 space-y-4 bg-blue-50/30 p-4 rounded-xl border border-blue-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-500" />
                      <h3 className="text-xs uppercase font-black text-slate-600">2. Análisis de Riesgo Específico</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        id="photo-upload-specific"
                        className="hidden"
                        onChange={handlePhotoSpecificUpload}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs border-blue-200 text-blue-700 bg-white hover:bg-blue-50 h-8 font-semibold shadow-sm"
                        onClick={() => document.getElementById("photo-upload-specific")?.click()}
                        disabled={isSpecificPhotoAnalyzing}
                      >
                        {isSpecificPhotoAnalyzing ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Camera className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        {isSpecificPhotoAnalyzing ? "Analizando Foto..." : "Analizar con Foto"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 h-8 font-semibold shadow-sm"
                        onClick={handleGenerateSpecificRiskAI}
                        disabled={isGeneratingSpecific}
                      >
                        <Sparkles className={cn("w-3.5 h-3.5 mr-1.5", isGeneratingSpecific && "animate-spin")} />
                        {isGeneratingSpecific ? "Generando..." : "Generar con IA (Análisis y Controles)"}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label className="text-xs font-bold">Descripción del Peligro / Riesgo</Label>
                      <Input 
                        placeholder="Ej. Exposición a vapores de solventes por falta de ventilación" 
                        value={formData.hazard}
                        onChange={e => setFormData({ ...formData, hazard: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label className="text-xs font-bold">Consecuencia Posible (Efecto a la salud)</Label>
                      <Input 
                        placeholder="Ej. Lesión ocular, Cortocircuito, Electrocución..." 
                        value={formData.possibleConsequence}
                        onChange={e => setFormData({ ...formData, possibleConsequence: e.target.value })}
                      />
                    </div>
                  </div>
               </div>

                <div className="col-span-2 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-2 gap-2">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold/90">3. Evaluación de Daño en Ambas Metodologías</Label>
                      <p className="text-[10px] text-slate-500 font-medium">Ambas metodologías se calculan en paralelo. Elige cuál guardar como método principal:</p>
                    </div>
                    <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 h-9 shrink-0 items-center">
                      <button 
                        type="button"
                        onClick={() => setFormData({ ...formData, method: 'fine' })}
                        className={cn(
                          "px-3 h-8 text-xs font-bold rounded-md transition-all cursor-pointer",
                          formData.method === 'fine' ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        William Fine (Principal)
                      </button>
                      <button 
                        type="button"
                        onClick={() => setFormData({ ...formData, method: 'matrix' })}
                        className={cn(
                          "px-3 h-8 text-xs font-bold rounded-md transition-all cursor-pointer",
                          formData.method === 'matrix' ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        Matriz 5x5 (Principal)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* COLUMNA 1: William Fine */}
                    <div className={cn(
                      "p-4 rounded-xl border transition-all space-y-3",
                      formData.method === 'fine' ? "bg-indigo-50/20 border-indigo-200 shadow-sm" : "bg-slate-50/50 border-slate-100"
                    )}>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5">
                          <Calculator className="w-3.5 h-3.5 text-blue-500" />
                          William Fine
                        </h4>
                        {formData.method === 'fine' && <Badge className="bg-indigo-600 hover:bg-indigo-600 font-bold text-[9px] uppercase">Principal</Badge>}
                      </div>

                      <div className="space-y-3">
                         <div className="space-y-1">
                           <Label className="text-[11px] font-bold text-slate-600">Consecuencias (C)</Label>
                           <Select 
                             value={formData.consequence.toString()} 
                             onValueChange={v => setFormData({...formData, consequence: parseFloat(v)})}
                           >
                             <SelectTrigger className="h-9 bg-white border-slate-200">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               {FINE_CONSEQUENCES.map(c => (
                                 <SelectItem key={c.value} value={c.value.toString()}>{c.label} ({c.value})</SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         </div>

                         <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[11px] font-bold text-slate-600">Exposición (E)</Label>
                              <Select 
                                 value={formData.exposure.toString()} 
                                 onValueChange={v => setFormData({...formData, exposure: parseFloat(v)})}
                               >
                                 <SelectTrigger className="h-9 bg-white border-slate-200">
                                   <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent>
                                   {FINE_EXPOSURE.map(e => (
                                     <SelectItem key={e.value} value={e.value.toString()}>{e.label} ({e.value})</SelectItem>
                                   ))}
                                 </SelectContent>
                               </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] font-bold text-slate-600">Probabilidad (P)</Label>
                              <Select 
                                 value={formData.likelihood.toString()} 
                                 onValueChange={v => setFormData({...formData, likelihood: parseFloat(v)})}
                               >
                                 <SelectTrigger className="h-9 bg-white border-slate-200">
                                   <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent>
                                   {FINE_PROBABILITY.map(p => (
                                     <SelectItem key={p.value} value={p.value.toString()}>{p.label} ({p.value})</SelectItem>
                                   ))}
                                 </SelectContent>
                               </Select>
                            </div>
                         </div>
                      </div>

                      <div className="p-3 bg-slate-900 rounded-lg text-white flex items-center justify-between gap-2">
                         <div className="space-y-0.5">
                            <p className="text-[9px] uppercase text-slate-400 font-bold">Grado de Peligrosidad (GP)</p>
                            <span className="text-md font-black">{fineVal.score.toFixed(1)}</span>
                         </div>
                         <Badge className={cn("px-2 py-0.5 font-bold text-[9px] shadow-sm", getPriorityBadge(fineVal.priority))}>
                            {fineVal.priority === 'very_high' ? "MUY ALTO" : fineVal.priority === 'high' ? "ALTO" : fineVal.priority === 'medium' ? "MEDIO" : "BAJO"}
                         </Badge>
                      </div>
                    </div>

                    {/* COLUMNA 2: Matriz 5x5 */}
                    <div className={cn(
                      "p-4 rounded-xl border transition-all space-y-3",
                      formData.method === 'matrix' ? "bg-indigo-50/20 border-indigo-200 shadow-sm" : "bg-slate-50/50 border-slate-100"
                    )}>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                          Matriz 5x5
                        </h4>
                        {formData.method === 'matrix' && <Badge className="bg-indigo-600 hover:bg-indigo-600 font-bold text-[9px] uppercase">Principal</Badge>}
                      </div>

                      <div className="space-y-3">
                         <div className="space-y-1">
                           <Label className="text-[11px] font-bold text-slate-600">Probabilidad (1-5)</Label>
                           <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map(v => (
                                <button
                                  type="button"
                                  key={v}
                                  onClick={() => setFormData({ ...formData, probability: v })}
                                  className={cn(
                                    "flex-1 h-8 rounded-md font-bold text-xs transition-all cursor-pointer",
                                    formData.probability === v ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600"
                                  )}
                                >
                                  {v}
                                </button>
                              ))}
                           </div>
                         </div>

                         <div className="space-y-1">
                           <Label className="text-[11px] font-bold text-slate-600">Severidad (1-5)</Label>
                           <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map(v => (
                                <button
                                  type="button"
                                  key={v}
                                  onClick={() => setFormData({ ...formData, severity: v })}
                                  className={cn(
                                    "flex-1 h-8 rounded-md font-bold text-xs transition-all cursor-pointer",
                                    formData.severity === v ? "bg-amber-600 text-white" : "bg-white border border-slate-200 text-slate-600"
                                  )}
                                >
                                  {v}
                                </button>
                              ))}
                           </div>
                         </div>
                      </div>

                      <div className="p-3 bg-slate-900 rounded-lg text-white flex items-center justify-between gap-2">
                         <div className="space-y-0.5">
                            <p className="text-[9px] uppercase text-slate-400 font-bold">Nivel de Riesgo (NR)</p>
                            <span className="text-md font-black">{matrixVal.score.toFixed(1)}</span>
                         </div>
                         <Badge className={cn("px-2 py-0.5 font-bold text-[9px] shadow-sm", getPriorityBadge(matrixVal.priority))}>
                            {matrixVal.priority === 'very_high' ? "MUY ALTO" : matrixVal.priority === 'high' ? "ALTO" : matrixVal.priority === 'medium' ? "MEDIO" : "BAJO"}
                         </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl text-white">
                     <div className="space-y-1">
                        <p className="text-[10px] uppercase text-slate-400 font-bold">
                          Resultado de Reporte Escogido ({formData.method === 'fine' ? 'William Fine' : 'Matriz 5x5'})
                        </p>
                        <div className="flex items-baseline gap-2">
                           <span className="text-3xl font-black">{currentScore.toFixed(1)}</span>
                           <Calculator className="w-4 h-4 text-slate-500 animate-pulse" />
                        </div>
                     </div>
                     <div className="text-right space-y-1">
                        <p className="text-[10px] uppercase text-slate-400 font-bold text-right">Prioridad Sugerida</p>
                        <Badge className={cn("px-3 py-1 font-bold shadow-sm text-xs", getPriorityBadge(currentPriority))}>
                           {getPriorityLabel(currentPriority)}
                        </Badge>
                     </div>
                  </div>
               </div>

               <div className="col-span-2 space-y-4">
                  <Separator />
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <h3 className="text-xs uppercase font-black text-slate-500">4. Medidas de Control y Seguimiento</h3>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Acción Correctiva / Medida Preventiva</Label>
                    <Textarea 
                      placeholder="Describe las acciones para mitigar el riesgo..." 
                      className="min-h-[80px]"
                      value={formData.controls}
                      onChange={e => setFormData({ ...formData, controls: e.target.value })}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label className="text-xs font-bold">Responsable</Label>
                       <Input 
                         placeholder="Nombre del encargado" 
                         value={formData.responsible}
                         onChange={e => setFormData({ ...formData, responsible: e.target.value })}
                       />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-xs font-bold">Fecha Compromiso</Label>
                       <Input 
                         type="date"
                         value={formData.commitmentDate}
                         onChange={e => setFormData({ ...formData, commitmentDate: e.target.value })}
                       />
                    </div>
                  </div>

               </div>
            </div>
            <div className="p-4 bg-slate-50 border-t flex gap-3 shrink-0">
              <Button type="button" variant="secondary" className="flex-1 h-12 font-bold bg-slate-100 hover:bg-slate-200" onClick={() => saveRisk(true)}>
                Guardar y Seguir
              </Button>
              <Button type="button" className="flex-[2] bg-blue-600 hover:bg-blue-700 h-12 font-bold shadow-lg shadow-blue-200" onClick={() => saveRisk(false)}>
                Guardar y Cerrar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* DIÁLOGO SEGUNDO: Analizador Visual de Riesgos con IA */}
        <Dialog open={isPhotoDialogOpen} onOpenChange={(v) => {
          setIsPhotoDialogOpen(v);
          if (!v) {
            setPhotoBase64(null);
            setAnalyzedRisks([]);
            setExtraContext("");
          }
        }}>
          <DialogContent className="sm:!max-w-[1150px] lg:!max-w-[1300px] w-[96vw] max-h-[94vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-5 border-b shrink-0 bg-slate-50">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <Camera className="w-5 h-5 text-blue-600" />
                Asistente Visual NOM-030 (Identificación de Riesgos con Foto)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Sube una imagen de las instalaciones o del puesto de trabajo. La IA identificará peligros, estimará el riesgo y sugerirá controles inmediatos que podrás revisar y adaptar antes de integrarlos.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6">
              {!photoBase64 ? (
                // Step 1: File dropzone
                <div className="space-y-4 py-6">
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-blue-400 hover:bg-slate-50/50 transition-all relative cursor-pointer group">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setPhotoBase64(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform duration-200">
                      <Upload className="w-8 h-8" />
                    </div>
                    <p className="text-base font-bold text-slate-700">Arrastra o haz clic para subir una fotografía</p>
                    <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto">
                      Sube una foto clara de las instalaciones, equipos, herramientas o del área afectada para que la IA escanee las condiciones inseguras.
                    </p>
                  </div>
                </div>
              ) : isPhotoAnalyzing ? (
                // Step 2: Loader
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                  <div className="relative flex items-center justify-center">
                    <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                    <Sparkles className="w-6 h-6 text-blue-500 absolute animate-pulse" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-slate-800 text-lg">Analizando Fotografía...</h3>
                    <p className="text-xs text-blue-600 animate-pulse mt-1 font-medium">{loadingMessage}</p>
                  </div>
                </div>
              ) : analyzedRisks.length === 0 ? (
                // Step 3: Photo Preview & Extra context form
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                  <div className="rounded-xl overflow-hidden border border-slate-200 max-h-[350px] relative bg-slate-900 flex items-center justify-center">
                    <img src={photoBase64} alt="Preview" className="max-w-full max-h-[350px] object-contain" referrerPolicy="no-referrer" />
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="absolute top-3 right-3 shadow-md"
                      onClick={() => setPhotoBase64(null)}
                    >
                      <Trash className="w-4 h-4 mr-1.5" /> Cambiar Imagen
                    </Button>
                  </div>
                  <div className="flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-black uppercase text-slate-500 flex items-center gap-1">
                          <Info className="w-3.5 h-3.5 text-blue-500" /> Co-Piloto de IA Visual
                        </Label>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          Danos contexto adicional si es necesario (ej. procesos activos, tipo de operarios). La IA examinará el entorno para estimar riesgo por probabilidad y consecuencias.
                        </p>
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-700">Contexto adicional u observaciones (Opcional)</Label>
                        <Textarea 
                          placeholder="Ej. Fotografía tomada en zona de mantenimiento a las 11:00 AM, operarios usando herramientas manuales..." 
                          className="min-h-[120px] text-xs leading-relaxed"
                          value={extraContext}
                          onChange={(e) => setExtraContext(e.target.value)}
                        />
                      </div>
                    </div>

                    {!hasApiKey ? (
                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-250 space-y-3 shadow-sm w-full">
                        <p className="text-xs text-amber-800 font-bold leading-normal">
                          ⚠️ <strong>Clave API de Gemini requerida:</strong> Al estar en una URL de vista previa o dominio no configurado, necesitas pegar tu API Key para poder escanear la foto.
                        </p>
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            placeholder="Pega tu API Key de Gemini..."
                            value={tempApiKey}
                            onChange={(e) => setTempApiKey(e.target.value)}
                            className="h-10 text-xs bg-white border-amber-300 rounded-xl"
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              if (tempApiKey.trim()) {
                                localStorage.setItem('nom030_gemini_api_key', tempApiKey.trim());
                                setLocalGeminiKey(tempApiKey.trim());
                                toast.success("Clave API guardada con éxito.");
                              } else {
                                toast.error("Ingresa una clave válida.");
                              }
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 rounded-xl"
                          >
                            Guardar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 shadow-lg shadow-blue-200"
                        onClick={runPhotoAnalysis}
                      >
                        <Sparkles className="w-4 h-4 mr-2" /> Identificar Riesgos con IA visual
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                // Step 4: AI Results list & Inline Editing Review
                <div className="space-y-6 py-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <h3 className="font-bold text-slate-800 text-md">Riesgos Identificados por IA</h3>
                      <p className="text-xs text-slate-500">Selecciona y perfecciona cada evaluación antes de incorporarlos a la matriz.</p>
                    </div>
                    <Badge className="bg-blue-50 text-blue-700 border border-blue-200">
                      {analyzedRisks.filter(r => r.selected).length} de {analyzedRisks.length} seleccionados
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {analyzedRisks.map((draft, idx) => {
                      const isExpanded = expandedDraftIndex === idx;
                      const { score, priority } = calculateDraftRisk(draft);
                      
                      return (
                        <div 
                          key={idx} 
                          className={cn(
                            "border rounded-xl overflow-hidden transition-all",
                            draft.selected ? "border-slate-200 shadow-sm" : "border-slate-100 opacity-60"
                          )}
                        >
                          {/* Draft Card Header Line */}
                          <div 
                            className={cn(
                              "flex flex-col sm:flex-row sm:items-center justify-between p-3 cursor-pointer gap-3 select-none",
                              isExpanded ? "bg-slate-50 border-b" : "hover:bg-slate-50/50"
                            )}
                            onClick={() => setExpandedDraftIndex(isExpanded ? null : idx)}
                          >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <input 
                                type="checkbox" 
                                checked={draft.selected} 
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateDraftRiskField(idx, "selected", e.target.checked);
                                }}
                                className="w-4 h-4 mt-0.5 rounded text-blue-600 border-slate-300 cursor-pointer focus:ring-0 shrink-0"
                              />
                              
                              <div className="flex flex-col gap-1 min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] shrink-0 font-medium capitalize">
                                    {draft.category === "unsafe_condition" ? "Condición Insegura" : 
                                     draft.category === "physical_agent" ? "Agente Físico" : 
                                     draft.category === "chemical_agent" ? "Agente Químico" : 
                                     draft.category === "biological_agent" ? "Agente Biológico" : "Peligro Circundante"}
                                  </Badge>
                                  <span className="text-xs font-bold text-slate-800 line-clamp-1">{draft.processName || "Proceso no definido"}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 line-clamp-1 italic">{draft.hazard}</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2 select-none shrink-0" onClick={(e) => e.stopPropagation()}>
                              <Badge className={cn("text-[9px] font-bold shadow-xs uppercase", getPriorityBadge(priority))}>
                                {priority === "very_high" ? "MUY ALTO" : priority === "high" ? "ALTO" : priority === "medium" ? "MEDIO" : "BAJO"} ({score.toFixed(1)})
                              </Badge>

                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-400 p-0 hover:bg-slate-100 rounded-md"
                                onClick={() => setExpandedDraftIndex(isExpanded ? null : idx)}
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>

                          {/* Expanded Form to Edit the Suggested Risk */}
                          {isExpanded && (
                            <div className="p-5 bg-white grid grid-cols-1 xl:grid-cols-2 gap-6 text-xs select-text">
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <Label className="text-[10px] font-bold text-slate-500">Proceso / Área</Label>
                                    <Input 
                                      className="h-10 mt-1 text-xs bg-slate-50/50"
                                      value={draft.processName}
                                      onChange={(e) => updateDraftRiskField(idx, "processName", e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-[10px] font-bold text-slate-500">Actividad</Label>
                                    <Input 
                                      className="h-10 mt-1 text-xs bg-slate-50/50"
                                      value={draft.activity}
                                      onChange={(e) => updateDraftRiskField(idx, "activity", e.target.value)}
                                    />
                                  </div>
                                </div>

                                <div>
                                  <Label className="text-[10px] font-bold text-slate-500">Análisis del Peligro / Riesgo Visual</Label>
                                  <Input 
                                    className="h-10 mt-1 text-xs bg-slate-50/50"
                                    value={draft.hazard}
                                    onChange={(e) => updateDraftRiskField(idx, "hazard", e.target.value)}
                                  />
                                </div>

                                <div>
                                  <Label className="text-[10px] font-bold text-slate-500">Consecuencia Posible (Efecto a la salud)</Label>
                                  <Input 
                                    className="h-10 mt-1 text-xs bg-slate-50/50"
                                    value={draft.possibleConsequence}
                                    onChange={(e) => updateDraftRiskField(idx, "possibleConsequence", e.target.value)}
                                  />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <Label className="text-[10px] font-bold text-slate-500">Categoría NOM-030</Label>
                                    <Select 
                                      value={draft.category}
                                      onValueChange={(val: any) => updateDraftRiskField(idx, "category", val)}
                                    >
                                      <SelectTrigger className="h-10 mt-1 bg-white text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="unsafe_condition">Condición Insegura</SelectItem>
                                        <SelectItem value="physical_agent">Agente Físico</SelectItem>
                                        <SelectItem value="chemical_agent">Agente Químico</SelectItem>
                                        <SelectItem value="biological_agent">Agente Biológico</SelectItem>
                                        <SelectItem value="hazard">Peligro Circundante</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-[10px] font-bold text-slate-500">Método Principal</Label>
                                    <div className="flex rounded-md border bg-slate-50 p-0.5 mt-1 h-10 items-center">
                                      <button 
                                        type="button"
                                        onClick={() => updateDraftRiskField(idx, "method", "fine")}
                                        className={cn(
                                          "flex-1 h-8 rounded text-[10px] font-bold transition-all cursor-pointer",
                                          draft.method === 'fine' ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-755"
                                        )}
                                      >
                                        William Fine
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => updateDraftRiskField(idx, "method", "matrix")}
                                        className={cn(
                                          "flex-1 h-8 rounded text-[10px] font-bold transition-all cursor-pointer",
                                          draft.method === 'matrix' ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-755"
                                        )}
                                      >
                                        Matriz 5x5
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Scoring Configuration block */}
                              <div className="space-y-4 border-t pt-6 xl:border-t-0 xl:pt-0 xl:border-l xl:pl-6 border-slate-100 flex flex-col justify-between">
                                {draft.method === 'fine' ? (
                                  <div className="space-y-3">
                                    <div>
                                      <Label className="text-[10px] font-bold text-slate-500">Consecuencias Fine (C)</Label>
                                      <Select 
                                        value={draft.consequence.toString()}
                                        onValueChange={(v) => updateDraftRiskField(idx, "consequence", parseFloat(v))}
                                      >
                                        <SelectTrigger className="h-8 mt-1 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {FINE_CONSEQUENCES.map(c => (
                                            <SelectItem key={c.value} value={c.value.toString()}>{c.label} ({c.value})</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <Label className="text-[10px] font-bold text-slate-500">Exposición (E)</Label>
                                        <Select 
                                          value={draft.exposure.toString()}
                                          onValueChange={(v) => updateDraftRiskField(idx, "exposure", parseFloat(v))}
                                        >
                                          <SelectTrigger className="h-8 mt-1 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {FINE_EXPOSURE.map(e => (
                                              <SelectItem key={e.value} value={e.value.toString()}>{e.label} ({e.value})</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label className="text-[10px] font-bold text-slate-500">Probabilidad (P)</Label>
                                        <Select 
                                          value={draft.likelihood.toString()}
                                          onValueChange={(v) => updateDraftRiskField(idx, "likelihood", parseFloat(v))}
                                        >
                                          <SelectTrigger className="h-8 mt-1 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {FINE_PROBABILITY.map(p => (
                                              <SelectItem key={p.value} value={p.value.toString()}>{p.label} ({p.value})</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <div>
                                      <Label className="text-[10px] font-bold text-slate-500">Probabilidad (1-5)</Label>
                                      <div className="flex gap-1 mt-1">
                                        {[1, 2, 3, 4, 5].map(v => (
                                          <button
                                            type="button"
                                            key={v}
                                            onClick={() => updateDraftRiskField(idx, "probability", v)}
                                            className={cn(
                                              "flex-1 h-7 rounded font-bold text-[10px] transition-all cursor-pointer",
                                              draft.probability === v ? "bg-blue-600 text-white" : "bg-slate-50 border border-slate-200 text-slate-600"
                                            )}
                                          >
                                            {v}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <Label className="text-[10px] font-bold text-slate-500">Severidad (1-5)</Label>
                                      <div className="flex gap-1 mt-1">
                                        {[1, 2, 3, 4, 5].map(v => (
                                          <button
                                            type="button"
                                            key={v}
                                            onClick={() => updateDraftRiskField(idx, "severity", v)}
                                            className={cn(
                                              "flex-1 h-7 rounded font-bold text-[10px] transition-all cursor-pointer",
                                              draft.severity === v ? "bg-amber-600 text-white" : "bg-slate-50 border border-slate-200 text-slate-600"
                                            )}
                                          >
                                            {v}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <div>
                                  <Label className="text-[10px] font-bold text-slate-500">Acción Correctiva Sugerida</Label>
                                  <Textarea 
                                    className="min-h-[50px] mt-1 text-xs"
                                    value={draft.controls}
                                    onChange={(e) => updateDraftRiskField(idx, "controls", e.target.value)}
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-[10px] font-bold text-slate-500">Responsable</Label>
                                    <Input 
                                      className="h-8 text-xs mt-1 bg-slate-50/50"
                                      value={draft.responsible}
                                      onChange={(e) => updateDraftRiskField(idx, "responsible", e.target.value)}
                                    />
                                  </div>
                                  <div className="flex flex-col justify-end text-right font-medium text-slate-700">
                                    <span>Cálculo: <b className="text-slate-950 text-xs">{score.toFixed(1)}</b></span>
                                    <span className="text-[8px] uppercase tracking-wider text-slate-400">Método {draft.method === 'fine' ? 'Fine' : 'Matrix'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {photoBase64 && !isPhotoAnalyzing && analyzedRisks.length > 0 && (
              <div className="p-4 bg-slate-50 border-t flex gap-3 shrink-0">
                <Button 
                  type="button"
                  variant="outline" 
                  className="flex-1 font-bold h-11"
                  onClick={() => {
                    setPhotoBase64(null);
                    setAnalyzedRisks([]);
                  }}
                >
                  Volver a analizar otra foto
                </Button>
                <Button 
                  type="button"
                  className="flex-[2] bg-blue-600 hover:bg-blue-700 font-bold h-11 text-white shadow-lg shadow-blue-200"
                  onClick={commitSelectedAnalysisRisks}
                >
                  Confirmar y Registrar en Matriz ({analyzedRisks.filter(r => r.selected).length})
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         {[
           { label: "Bajo (< 70)", count: risks.filter(r => r.priority === 'low').length, color: "text-green-600" },
           { label: "Medio (70-200)", count: risks.filter(r => r.priority === 'medium').length, color: "text-amber-600" },
           { label: "Alto (200-400)", count: risks.filter(r => r.priority === 'high').length, color: "text-orange-600" },
           { label: "Muy Alto (+400)", count: risks.filter(r => r.priority === 'very_high').length, color: "text-red-600" },
         ].map((stat, i) => (
           <Card key={i} className="border-none shadow-sm bg-white/50 backdrop-blur">
              <CardContent className="p-4 flex items-center justify-between">
                 <div>
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-tighter">{stat.label}</p>
                    <h4 className={cn("text-2xl font-black", stat.color)}>{stat.count}</h4>
                 </div>
                 <TrendingUp className={cn("w-6 h-6 opacity-20", stat.color)} />
              </CardContent>
           </Card>
         ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
         <Table>
            <TableHeader className="bg-slate-50">
               <TableRow>
                  <TableHead>Proceso / Peligro</TableHead>
                  <TableHead>Método / Cálculo</TableHead>
                  <TableHead>GP (Nivel)</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {risks.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-400 italic">No hay riesgos evaluados aún.</TableCell>
                 </TableRow>
               ) : (
                 risks.map((risk) => (
                   <TableRow key={risk.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell>
                         <div className="space-y-1">
                            <div className="flex items-center gap-2">
                               <p className="font-bold text-slate-900">{risk.processName}</p>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-1">{risk.hazard}</p>
                         </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-slate-400 font-bold">{risk.method === 'fine' ? 'William Fine' : 'Matriz 5x5'}</span>
                            <span className="text-xs font-mono text-slate-600">
                               {risk.method === 'fine' 
                                 ? `${risk.consequence}×${risk.exposure}×${risk.likelihood}` 
                                 : `${risk.probability}×${risk.severity}`}
                            </span>
                         </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900">{risk.riskLevel.toFixed(1)}</span>
                         </div>
                      </TableCell>
                      <TableCell>
                         <Badge className={cn("border font-bold text-[10px]", getPriorityBadge(risk.priority))}>
                           {risk.priority === 'very_high' ? "MUY ALTO" : 
                            risk.priority === 'high' ? "ALTO" : 
                            risk.priority === 'medium' ? "MEDIO" : "BAJO"}
                         </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                         <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50" onClick={() => handleEdit(risk)}>
                               <ArrowUpRight className="w-4 h-4 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 group" onClick={async (e) => {
                               e.preventDefault();
                               e.stopPropagation();
                               if (risk.id === undefined) return;
                               if (window.confirm("¿Eliminar evaluación?")) {
                                 try {
                                   if (risk.findingId) {
                                     await db.findings.delete(risk.findingId);
                                     const prog = await db.safetyProgram.where('findingId').equals(risk.findingId).first();
                                     if (prog?.id) await db.safetyProgram.delete(prog.id);
                                   }
                                   console.log("Eliminando riesgo:", risk.id);
                                   await db.riskAssessments.delete(risk.id);
                                   setRefreshTrigger(prev => prev + 1);
                                   toast.success("Eliminado");
                                 } catch (err) {
                                   console.error("Delete risk error:", err);
                                   toast.error("Error");
                                 }
                               }
                            }}>
                               <Trash2 className="w-4 h-4 text-slate-300 group-hover:text-red-500 transition-colors" />
                            </Button>
                         </div>
                      </TableCell>
                   </TableRow>
                 ))
               )}
            </TableBody>
         </Table>
      </div>
    </div>
  );
}
