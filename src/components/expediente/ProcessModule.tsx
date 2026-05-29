import { useState, useEffect, useRef } from "react";
import { db, type Company } from "../../lib/db";
import { useDexieQuery } from "../../hooks/useDexie";
import { useAppStore } from "../../hooks/useAppStore";
import { Button } from "../ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { 
  Factory, 
  Save, 
  Upload, 
  Info, 
  AlertTriangle,
  Layers,
  Wrench,
  Package,
  ArrowDown,
  FileText,
  Workflow,
  Plus,
  Trash2,
  FileImage,
  RefreshCw,
  Sparkles,
  HelpCircle,
  Circle,
  Square,
  Diamond,
  MoveHorizontal,
  ArrowRight,
  AlignLeft,
  AlignCenter,
  AlignRight
} from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { extractProcessAssets, analyzeProcessFile, Type } from "../../services/geminiService";

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

export function ProcessModule() {
  const { currentCompanyId } = useAppStore();
  const company = useDexieQuery(
    () => currentCompanyId ? db.companies.get(currentCompanyId) : Promise.resolve(undefined),
    [currentCompanyId]
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processType, setProcessType] = useState<'text' | 'file' | 'diagram'>('text');
  const [formData, setFormData] = useState({
    processDescription: "",
    rawMaterials: "",
    machinery: "",
    processFileUrl: ""
  });

  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [diagramSteps, setDiagramSteps] = useState<DiagramStep[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);

  const handleAutofillAssets = async () => {
    if (!formData.processDescription.trim()) {
      toast.error("Describe el proceso primero para extraer datos.");
      return;
    }
    setIsExtracting(true);
    try {
      const assets = await extractProcessAssets(formData.processDescription);
      setFormData(prev => ({
        ...prev,
        machinery: assets.machinery,
        rawMaterials: assets.rawMaterials
      }));
      toast.success("Maquinaria y Materias Primas extraídas satisfactoriamente.");
    } catch (e) {
      toast.error("Error al extraer datos con IA");
    } finally {
      setIsExtracting(false);
    }
  };

  useEffect(() => {
    if (company) {
      setProcessType(company.processType || 'text');
      
      let initialDescription = company.processDescription || "";
      let loadedSteps: DiagramStep[] = [];
      
      if (company.processDescription) {
        try {
          const parsed = JSON.parse(company.processDescription);
          if (Array.isArray(parsed)) {
            loadedSteps = parsed;
            initialDescription = "";
          } else if (parsed && typeof parsed === 'object') {
            loadedSteps = parsed.steps || [];
            initialDescription = parsed.customText || "";
          }
        } catch (e) {
          initialDescription = company.processDescription;
        }
      }

      setFormData({
        processDescription: initialDescription,
        rawMaterials: company.rawMaterials || "",
        machinery: company.machinery || "",
        processFileUrl: company.processFileUrl || ""
      });

      if (loadedSteps.length > 0) {
        setDiagramSteps(loadedSteps.map(s => ({
          ...s,
          type: s.type || 'PROCESS',
          textAlign: s.textAlign || 'center',
          textRotation: s.textRotation || 0
        })));
      } else {
        setDiagramSteps([]);
      }
    }
  }, [company]);

  const handleSave = async (customData?: Partial<typeof formData>) => {
    if (!currentCompanyId) return;
    
    // Always preserve both the diagram steps and the process description as JSON to avoid overwriting or erasing each other
    const textToSave = (customData && customData.processDescription !== undefined) 
      ? customData.processDescription 
      : formData.processDescription;

    const stepsToSave = diagramSteps || [];
    
    const description = JSON.stringify({
      steps: stepsToSave,
      customText: textToSave
    });

    try {
      await db.companies.update(currentCompanyId, {
        ...formData,
        ...customData,
        processDescription: description,
        processType,
        updatedAt: new Date()
      });
      toast.success("Información del proceso guardada");
    } catch (err) {
      toast.error("Error al guardar");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setFormData(prev => ({ ...prev, processFileUrl: base64 }));
      
      setIsAnalyzingFile(true);
      const toastId = toast.loading("Analizando el archivo cargado con IA para extraer materias primas, maquinaria y el diagrama de flujo...");
      try {
        const result = await analyzeProcessFile(base64);
        
        // Generate UUIDs for the steps
        const stepIds = result.steps.map(() => crypto.randomUUID());
        const mappedSteps: DiagramStep[] = result.steps.map((s, index) => ({
          id: stepIds[index],
          text: s.text,
          type: s.type as StepType,
          textAlign: "center",
          textRotation: 0,
          nextStepId: index < result.steps.length - 1 ? stepIds[index + 1] : undefined
        }));

        setFormData(prev => ({
          ...prev,
          processFileUrl: base64,
          rawMaterials: result.rawMaterials,
          machinery: result.machinery,
          processDescription: result.description
        }));
        setDiagramSteps(mappedSteps);
        
        // Save description as JSON steps
        const description = JSON.stringify({
          steps: mappedSteps,
          customText: result.description
        });

        if (currentCompanyId) {
          await db.companies.update(currentCompanyId, {
            processFileUrl: base64,
            rawMaterials: result.rawMaterials,
            machinery: result.machinery,
            processDescription: description,
            processType: 'diagram',
            updatedAt: new Date()
          });
        }

        toast.success("¡Análisis completado! Se han extraído las materias primas, maquinaria y equipos, y se ha generado su diagrama de flujo.", { id: toastId });
        setProcessType('diagram');
      } catch (err) {
        console.error("Error analyzing process file:", err);
        toast.error("Error al procesar el archivo con IA, guardando de forma segura.", { id: toastId });
        await handleSave({ processFileUrl: base64 });
      } finally {
        setIsAnalyzingFile(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const addDiagramStep = () => {
    setDiagramSteps([...diagramSteps, { 
      id: crypto.randomUUID(), 
      text: "", 
      type: 'PROCESS',
      textAlign: 'center',
      textRotation: 0
    }]);
  };

  const updateDiagramStep = (id: string, text: string, type?: StepType, nextStepId?: string, altStepId?: string, textAlign?: 'left' | 'center' | 'right', textRotation?: number) => {
    setDiagramSteps(diagramSteps.map(s => s.id === id ? { 
      ...s, 
      text, 
      type: type || s.type,
      nextStepId: nextStepId !== undefined ? nextStepId : s.nextStepId,
      altStepId: altStepId !== undefined ? altStepId : s.altStepId,
      textAlign: textAlign || s.textAlign,
      textRotation: textRotation !== undefined ? textRotation : s.textRotation
    } : s));
  };

  const removeDiagramStep = (id: string) => {
    setDiagramSteps(diagramSteps.filter(s => s.id !== id));
  };

  const generateDiagramWithAI = async () => {
    const promptToUse = aiPrompt || formData.processDescription;
    if (!promptToUse.trim()) {
      toast.error("Por favor describe el proceso primero");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gemini-3.5-flash",
          contents: `Analiza la siguiente descripción de un proceso industrial y genera un diagrama de flujo estructurado.
          
          Descripción: "${promptToUse}"
          
          Debes identificar los pasos clave y clasificarlos en:
          - START: El inicio del proceso.
          - PROCESS: Operaciones o tareas estándar.
          - DECISION: Puntos donde se toma una decisión o se hace una inspección.
          - INPUT: Entrada de materiales o suministros.
          - OUTPUT: Salida de productos o desechos.
          - END: El fin del proceso.
          
          Responde estrictamente con un JSON que sea un array de objetos con esta estructura:
          [{ "text": "Nombre del paso", "type": "START|PROCESS|DECISION|INPUT|OUTPUT|END" }]`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  type: { 
                    type: Type.STRING,
                    enum: ["START", "PROCESS", "DECISION", "INPUT", "OUTPUT", "END"]
                  }
                },
                required: ["text", "type"]
              }
            }
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate diagram from Gemini API");
      }

      const data = await response.json();
      const resText = data.text;
      const parsedSteps = JSON.parse(resText);
      const newSteps = parsedSteps.map((s: any) => ({ ...s, id: crypto.randomUUID() }));
      
      setDiagramSteps(newSteps);
      toast.success("Sugerencia de diagrama generada");
      setProcessType('diagram');
    } catch (err) {
      console.error(err);
      toast.error("Error al generar el diagrama con IA");
    } finally {
      setIsGenerating(false);
    }
  };

  const getStepIcon = (type: StepType) => {
    switch (type) {
      case 'START': return <Circle className="w-4 h-4 text-green-500 fill-green-50" />;
      case 'END': return <Circle className="w-4 h-4 text-red-500 fill-red-50" />;
      case 'DECISION': return <Diamond className="w-4 h-4 text-amber-500 fill-amber-50" />;
      case 'INPUT': return <Upload className="w-4 h-4 text-blue-500" />;
      case 'OUTPUT': return <Package className="w-4 h-4 text-blue-500" />;
      default: return <Square className="w-4 h-4 text-slate-500 fill-slate-50" />;
    }
  };

  const getStepStyle = (type: StepType) => {
    switch (type) {
      case 'START': return "rounded-full border-green-200 bg-green-50/50 py-3";
      case 'END': return "rounded-full border-red-200 bg-red-50/50 py-3";
      case 'DECISION': return "relative h-32 w-32 flex items-center justify-center";
      case 'INPUT':
      case 'OUTPUT': return "skew-x-[-15deg] border-blue-200 bg-blue-50/50 py-4";
      default: return "rounded-xl border-slate-200 bg-white py-4 px-6";
    }
  };

  if (!currentCompanyId) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
        <Factory className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold">Selecciona una empresa</h3>
        <p className="text-slate-500 mt-2">Debes seleccionar una empresa para gestionar su proceso productivo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Proceso Productivo</h1>
          <p className="text-slate-500">Define cómo opera la empresa para evaluar riesgos operacionales.</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          <Button 
            variant={processType === 'text' ? 'secondary' : 'ghost'} 
            size="sm" 
            onClick={() => setProcessType('text')}
            className={cn("rounded-lg", processType === 'text' && "bg-white shadow-sm")}
          >
            <FileText className="w-4 h-4 mr-2" /> Texto
          </Button>
          <Button 
            variant={processType === 'file' ? 'secondary' : 'ghost'} 
            size="sm" 
            onClick={() => setProcessType('file')}
            className={cn("rounded-lg", processType === 'file' && "bg-white shadow-sm")}
          >
            <Upload className="w-4 h-4 mr-2" /> Archivo
          </Button>
          <Button 
            variant={processType === 'diagram' ? 'secondary' : 'ghost'} 
            size="sm" 
            onClick={() => setProcessType('diagram')}
            className={cn("rounded-lg", processType === 'diagram' && "bg-white shadow-sm")}
          >
            <Workflow className="w-4 h-4 mr-2" /> Diagrama
          </Button>
        </div>
      </header>

      <div className={cn(
        "grid grid-cols-1 gap-6",
        processType === 'diagram' ? "lg:grid-cols-1" : "lg:grid-cols-3"
      )}>
        <Card className={cn(
          "border-slate-200",
          processType === 'diagram' ? "lg:col-span-1" : "lg:col-span-2"
        )}>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <Layers className="w-5 h-5 text-blue-600" />
                {processType === 'text' && "Descripción del Proceso"}
                {processType === 'file' && "Documento del Proceso"}
                {processType === 'diagram' && "Diagrama de Flujo"}
              </CardTitle>
              {processType !== 'file' && (
                <Button onClick={() => handleSave()} size="sm" className="bg-blue-600 hover:bg-blue-700 h-9">
                  <Save className="w-4 h-4 mr-2" /> Guardar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="min-h-[450px]">
             <AnimatePresence mode="wait">
                {processType === 'text' && (
                  <motion.div 
                    key="text" 
                    initial={{ opacity: 0, scale: 0.98 }} 
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 mb-4">
                       <div className="flex gap-3 items-center">
                          <Sparkles className="w-5 h-5 text-blue-600" />
                          <div>
                             <p className="text-sm font-semibold text-blue-900">Generador Automático</p>
                             <p className="text-xs text-blue-700">Escribe tu proceso y transpórtalo a un diagrama.</p>
                          </div>
                       </div>
                    </div>
                    <Textarea 
                      id="description"
                      placeholder="Ej: Inicia con la recepción de aceros, se cortan a medida, pasan a soldadura, se pintan y finalmente se empacan..."
                      className="min-h-[350px] resize-none text-base leading-relaxed"
                      value={formData.processDescription}
                      onChange={(e) => setFormData(prev => ({ ...prev, processDescription: e.target.value }))}
                    />
                    <div className="flex gap-2">
                       <Button 
                        variant="secondary" 
                        className="flex-1 bg-white border-slate-200 shadow-sm"
                        onClick={() => {
                          setAiPrompt(formData.processDescription);
                          generateDiagramWithAI();
                        }}
                        disabled={isGenerating || !formData.processDescription}
                       >
                         {isGenerating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Workflow className="w-4 h-4 mr-2" />}
                         Convertir a Diagrama
                       </Button>
                    </div>
                  </motion.div>
                )}

                {processType === 'file' && (
                  <motion.div 
                    key="file" 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-10"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*,application/pdf"
                      onChange={handleFileUpload}
                    />
                    
                    {isAnalyzingFile ? (
                      <div className="text-center p-12 border-2 border-dashed border-blue-200 bg-blue-50/20 rounded-3xl w-full flex flex-col items-center justify-center min-h-[250px]">
                        <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                        <h3 className="text-lg font-bold text-blue-900 mb-1">Analizando con Inteligencia Artificial...</h3>
                        <p className="text-slate-600 text-xs max-w-sm leading-relaxed">Leeyendo tu documento de proceso para extraer las materias primas, maquinaria y equipos, y estructurar el diagrama de flujo correspondiente de forma automática.</p>
                      </div>
                    ) : formData.processFileUrl ? (
                      <div className="w-full space-y-6">
                        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 flex items-center justify-center p-4">
                          {formData.processFileUrl.startsWith('data:application/pdf') ? (
                            <div className="flex flex-col items-center gap-3 py-10">
                              <FileText className="w-16 h-16 text-blue-500" />
                              <p className="font-medium text-slate-700 text-center">PDF del Proceso Productivo cargado.<br/><span className="text-xs text-slate-400 font-normal">Identifica posibles riesgos basados en este archivo.</span></p>
                            </div>
                          ) : (
                            <img src={formData.processFileUrl} alt="Proceso" className="max-h-[300px] rounded-lg shadow-sm" />
                          )}
                        </div>
                        <div className="flex justify-center gap-4">
                          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                            <RefreshCw className="w-4 h-4 mr-2" /> Reemplazar
                          </Button>
                          <Button variant="destructive" onClick={async () => {
                            setFormData(prev => ({ ...prev, processFileUrl: "" }));
                            await handleSave({ processFileUrl: "" });
                          }}>
                            <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-3xl w-full hover:border-blue-300 hover:bg-blue-50/20 transition-all">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                           <FileImage className="w-8 h-8 text-slate-300" />
                        </div>
                        <h4 className="text-lg font-semibold mb-2">Sube tu diagrama o manual físico</h4>
                        <p className="text-slate-500 mb-6 max-w-xs mx-auto">Aceptamos imágenes (JPG/PNG) del proceso o manuales corporativos en PDF.</p>
                        <Button onClick={() => fileInputRef.current?.click()}>
                          <Upload className="w-4 h-4 mr-2" /> Seleccionar Archivo
                        </Button>
                      </div>
                    )}
                  </motion.div>
                )}

                {processType === 'diagram' && (
                  <motion.div 
                    key="diagram" 
                    initial={{ opacity: 0, x: 20 }} 
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col lg:flex-row gap-8">
                       {/* Editor Section */}
                       <div className="w-full lg:w-[450px] space-y-4 shrink-0">
                          <div className="flex justify-between items-center sticky top-0 bg-white z-10 py-2 border-b border-slate-100 mb-2">
                             <Label className="font-bold flex items-center gap-2 text-slate-700">
                                <Wrench className="w-4 h-4" /> Configuración de Etapas
                             </Label>
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={addDiagramStep}>
                                <Plus className="w-5 h-5" />
                             </Button>
                          </div>
                          
                          <div className="space-y-4 max-h-[700px] overflow-y-auto pr-3 custom-scrollbar px-1">
                             {diagramSteps.map((step, index) => (
                               <div key={step.id} className="p-4 border border-slate-200 rounded-3xl bg-white shadow-sm space-y-4 group animate-in slide-in-from-left-2 duration-300">
                                  <div className="flex justify-between items-center">
                                     <Badge className="bg-blue-50 text-blue-700 border-blue-100 px-3 py-0.5 rounded-full text-[10px] font-bold">
                                        Paso {index + 1}
                                     </Badge>
                                     <button onClick={() => removeDiagramStep(step.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                        <Trash2 className="w-4 h-4" />
                                     </button>
                                  </div>
                                  
                                  <div className="space-y-3">
                                    <Input 
                                      value={step.text} 
                                      onChange={(e) => updateDiagramStep(step.id, e.target.value)}
                                      placeholder="Nombre de la etapa..."
                                      className="h-10 text-sm rounded-xl"
                                    />
                                    
                                    {/* Text Alignment & Rotation */}
                                    <div className="flex items-center justify-between gap-2 p-1.5 bg-slate-50 rounded-xl border border-slate-100">
                                       <div className="flex gap-1">
                                          {(['left', 'center', 'right'] as const).map(align => (
                                            <button
                                              key={align}
                                              onClick={() => updateDiagramStep(step.id, step.text, undefined, undefined, undefined, align)}
                                              className={cn(
                                                "p-1.5 rounded-md transition-all",
                                                step.textAlign === align ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                              )}
                                            >
                                              {align === 'left' && <AlignLeft className="w-4 h-4" />}
                                              {align === 'center' && <AlignCenter className="w-4 h-4" />}
                                              {align === 'right' && <AlignRight className="w-4 h-4" />}
                                            </button>
                                          ))}
                                       </div>
                                       <button
                                         onClick={() => updateDiagramStep(step.id, step.text, undefined, undefined, undefined, undefined, (step.textRotation || 0) + 90)}
                                         className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                                       >
                                         <RefreshCw className="w-3 h-3" /> Rotar Texto
                                       </button>
                                    </div>
                                  </div>

                                  <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
                                     {(['START', 'PROCESS', 'DECISION', 'INPUT', 'OUTPUT', 'END'] as StepType[]).map(type => (
                                       <button
                                         key={type}
                                         onClick={() => updateDiagramStep(step.id, step.text, type)}
                                         className={cn(
                                           "px-2.5 py-1.5 rounded-lg text-[9px] uppercase font-black border transition-all shrink-0",
                                           step.type === type 
                                            ? "bg-slate-900 border-slate-900 text-white" 
                                            : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                                         )}
                                       >
                                         {type}
                                       </button>
                                     ))}
                                  </div>

                                  <div className="grid grid-cols-2 gap-3 pt-2">
                                     <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase text-slate-500 font-black tracking-wider flex items-center gap-1">
                                          {step.type === 'DECISION' ? <span className="text-blue-500">●</span> : null}
                                          {step.type === 'DECISION' ? 'Camino SI' : 'Continuar a:'}
                                        </Label>
                                        <select 
                                          className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 text-xs px-3 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                          value={step.nextStepId || ""}
                                          onChange={(e) => updateDiagramStep(step.id, step.text, step.type, e.target.value || undefined)}
                                        >
                                          <option value="">Siguiente Paso</option>
                                          {diagramSteps.filter(s => s.id !== step.id).map((s) => (
                                            <option key={s.id} value={s.id}>
                                              Paso {diagramSteps.findIndex(x => x.id === s.id) + 1}: {s.text.substring(0, 15)}...
                                            </option>
                                          ))}
                                        </select>
                                     </div>
                                     {step.type === 'DECISION' && (
                                       <div className="space-y-1.5">
                                          <Label className="text-[10px] uppercase text-red-500 font-black tracking-wider flex items-center gap-1">
                                            <span>●</span> Camino NO
                                          </Label>
                                          <select 
                                            className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 text-xs px-3 outline-none focus:ring-2 focus:ring-red-100 transition-all font-medium"
                                            value={step.altStepId || ""}
                                            onChange={(e) => updateDiagramStep(step.id, step.text, step.type, undefined, e.target.value || undefined)}
                                          >
                                            <option value="">Saltar a...</option>
                                            {diagramSteps.filter(s => s.id !== step.id).map((s) => (
                                              <option key={s.id} value={s.id}>
                                                Paso {diagramSteps.findIndex(x => x.id === s.id) + 1}: {s.text.substring(0, 15)}...
                                              </option>
                                            ))}
                                          </select>
                                       </div>
                                     )}
                                  </div>
                               </div>
                             ))}
                             {diagramSteps.length === 0 && (
                               <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-[32px] bg-slate-50/50">
                                  <Workflow className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                  <p className="text-sm font-semibold text-slate-400">Diseñador listo</p>
                                  <p className="text-xs text-slate-300">Empieza agregando una etapa</p>
                               </div>
                             )}
                          </div>
                       </div>

                       {/* Visual Preview */}
                       <div className="flex-1 bg-white rounded-[40px] p-12 border border-slate-100 overflow-y-auto max-h-[850px] relative shadow-inner">
                          <div className="absolute top-10 right-10 flex gap-2">
                             <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 border-none rounded-full shadow-2xl text-[11px] font-black text-white uppercase tracking-widest">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" /> Vista en Vivo
                             </div>
                          </div>

                          <div className="flex flex-col items-center gap-4 mt-8 pb-32">
                             {diagramSteps.map((step, index) => (
                               <div key={step.id} className="flex flex-col items-center w-full relative">
                                  {/* Node Container */}
                                  <div className={cn(
                                    "flex flex-col items-center justify-center transition-all duration-700",
                                    step.type === 'DECISION' ? "py-16" : "py-4"
                                  )}>
                                     <div className={cn(
                                       "w-[280px] border shadow-xl flex flex-col items-center justify-center transition-all duration-500 group cursor-default bg-white relative",
                                       getStepStyle(step.type),
                                       step.type !== 'DECISION' && "hover:scale-[1.02] hover:shadow-2xl"
                                     )}>
                                        {/* Diamond Background for DECISION */}
                                        {step.type === 'DECISION' && (
                                          <div className="absolute inset-0 border border-amber-300 bg-amber-50/50 rotate-45 shadow-xl transition-all duration-500 group-hover:scale-[1.02] group-hover:shadow-2xl" />
                                        )}

                                        <Badge className="absolute -top-3 left-6 bg-slate-100 text-slate-400 text-[8px] px-2 py-0 h-4 border-slate-200 font-black z-10">
                                           {index + 1}
                                        </Badge>

                                        {step.type === 'DECISION' ? (
                                          <div className="relative z-10 flex flex-col items-center gap-2 w-full px-6">
                                             <div className="opacity-40">{getStepIcon(step.type)}</div>
                                             <div 
                                               style={{ 
                                                 textAlign: step.textAlign || 'center',
                                                 transform: `rotate(${step.textRotation || 0}deg)`
                                               }}
                                               className="w-full transition-all duration-300"
                                             >
                                                <p className="text-[13px] font-black text-slate-800 leading-tight">
                                                   {step.text || "Decisión"}
                                                </p>
                                             </div>
                                          </div>
                                        ) : (
                                          <div className={cn(
                                            "flex flex-col items-center w-full px-8",
                                            (step.type === 'INPUT' || step.type === 'OUTPUT') && "skew-x-[15deg]"
                                          )}>
                                             <div className="flex items-center gap-2 mb-2 opacity-30">
                                                {getStepIcon(step.type)}
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">{step.type}</span>
                                             </div>
                                             <div 
                                               style={{ 
                                                 textAlign: step.textAlign || 'center',
                                                 transform: `rotate(${step.textRotation || 0}deg)`
                                               }}
                                               className="w-full transition-all duration-300"
                                             >
                                                <p className="text-sm font-black text-slate-800 leading-snug">
                                                  {step.text || (step.type === 'START' ? 'Empieza aquí' : step.type === 'END' ? 'Finaliza aquí' : `Etapa ${index + 1}`)}
                                                </p>
                                             </div>
                                          </div>
                                        )}
                                        
                                        {/* Decision Branches Visuals */}
                                        {step.type === 'DECISION' && (
                                          <>
                                            {/* YES BRANCH */}
                                            <div className="absolute -right-[110px] top-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 z-20">
                                               <div className="flex items-center">
                                                  <div className="w-16 h-1 bg-blue-500 rounded-full"></div>
                                                  <ArrowRight className="w-4 h-4 text-blue-500 -ml-1 stroke-[3px]" />
                                               </div>
                                               <div className="flex flex-col items-center">
                                                  <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full border-2 border-blue-100 shadow-md">SÍ</span>
                                                  {step.nextStepId && (
                                                     <div className="mt-2 text-[10px] font-bold text-blue-500 flex items-center gap-1 whitespace-nowrap bg-white px-2 py-0.5 rounded-md border border-blue-100 shadow-sm">
                                                        <Workflow className="w-3 h-3" /> Ir a Paso {diagramSteps.findIndex(s => s.id === step.nextStepId) + 1}
                                                     </div>
                                                  )}
                                               </div>
                                            </div>
                                            
                                            {/* NO BRANCH */}
                                            <div className="absolute -left-[110px] top-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 z-20">
                                               <div className="flex flex-col items-center">
                                                  <span className="text-[11px] font-black text-red-600 bg-red-50 px-3 py-1 rounded-full border-2 border-red-100 shadow-md">NO</span>
                                                  {step.altStepId && (
                                                     <div className="mt-2 text-[10px] font-bold text-red-500 flex items-center gap-1 whitespace-nowrap bg-white px-2 py-0.5 rounded-md border border-red-100 shadow-sm">
                                                        Ir a Paso {diagramSteps.findIndex(s => s.id === step.altStepId) + 1} <Workflow className="w-3 h-3" />
                                                     </div>
                                                  )}
                                               </div>
                                               <div className="flex items-center">
                                                  <ArrowRight className="w-4 h-4 text-red-500 -mr-1 rotate-180 stroke-[3px]" />
                                                  <div className="w-16 h-1 bg-red-500 rounded-full"></div>
                                               </div>
                                            </div>
                                          </>
                                        )}
                                     </div>
                                  </div>

                                  {/* Enhanced Visual Arrow */}
                                  {index < diagramSteps.length - 1 && (
                                    <div className="flex flex-col items-center relative py-1">
                                       <div className={cn(
                                         "w-[3px] bg-gradient-to-b from-slate-200 to-slate-100 rounded-full transition-all duration-300",
                                         diagramSteps[index].type === 'DECISION' ? "h-8 -mt-8 mb-4 shadow-[0_0_15px_rgba(0,0,0,0.05)]" : "h-10 my-2"
                                       )}></div>
                                       <ArrowDown className="w-6 h-6 text-slate-300 absolute -bottom-2 -translate-y-1/2 stroke-[2.5px]" />
                                       
                                       {/* Sequence label */}
                                       {diagramSteps[index].nextStepId && diagramSteps[index].type !== 'DECISION' && (
                                          <div className="absolute top-1/2 -translate-y-1/2 -right-4 translate-x-full px-3 py-1 bg-slate-900 text-white text-[8px] font-black uppercase rounded-lg shadow-xl flex items-center gap-2">
                                             <Workflow className="w-3 h-3 text-blue-400" />
                                             Salto a Paso {diagramSteps.findIndex(s => s.id === diagramSteps[index].nextStepId) + 1}
                                          </div>
                                       )}
                                    </div>
                                  )}
                               </div>
                             ))}
                             {diagramSteps.length === 0 && (
                               <div className="flex flex-col items-center justify-center py-40 text-slate-300">
                                  <div className="p-8 rounded-[40px] bg-slate-50 border border-slate-100 border-dashed mb-6">
                                     <Workflow className="w-24 h-24 mb-4 text-slate-200" />
                                  </div>
                                  <p className="font-black text-2xl text-slate-900 mb-2">Workspace de Ingeniería</p>
                                  <p className="text-slate-400 max-w-sm text-center font-medium">Construye el flujo lógico de tu proceso industrial operando el panel izquierdo.</p>
                               </div>
                             )}
                          </div>
                       </div>
                    </div>
                  </motion.div>
                )}

                {/* Ficha Técnica / Datos extraídos por la IA del Proceso */}
                <div className="mt-8 pt-8 border-t border-slate-100 space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-blue-500 animate-pulse" /> Ficha Técnica e Interpretación del Proceso
                      </h3>
                      <p className="text-xs text-slate-500">Esta información fue extraída y redactada automáticamente por la IA a partir del documento o imagen suministrada.</p>
                    </div>
                    <Button onClick={() => handleSave()} size="sm" className="bg-blue-600 hover:bg-blue-700 h-9 font-bold px-4 rounded-xl shrink-0">
                      <Save className="w-4 h-4 mr-2" /> Guardar Ficha Técnica
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                     {/* Descripción Interpretada */}
                     <Card className="lg:col-span-1 border-slate-100 shadow-sm bg-slate-50/50">
                       <CardHeader className="pb-2">
                         <CardTitle className="text-sm font-black text-slate-700 flex items-center gap-2">
                           <FileText className="w-4 h-4 text-blue-500" /> Interpretación Narrativa (Descripción)
                         </CardTitle>
                       </CardHeader>
                       <CardContent>
                         <Textarea
                           className="min-h-[160px] bg-white text-xs leading-relaxed"
                           placeholder="La IA colocará aquí la descripción narrativa e interpretación del diagrama de flujo..."
                           value={formData.processDescription}
                           onChange={(e) => setFormData(prev => ({ ...prev, processDescription: e.target.value }))}
                         />
                       </CardContent>
                     </Card>

                     {/* Materias Primas */}
                     <Card className="border-slate-100 shadow-sm bg-slate-50/50">
                       <CardHeader className="pb-2">
                         <CardTitle className="text-sm font-black text-slate-700 flex items-center gap-2">
                           <Package className="w-4 h-4 text-emerald-500" /> Materias Primas e Insumos
                         </CardTitle>
                       </CardHeader>
                       <CardContent>
                         <Textarea
                           className="min-h-[160px] bg-white text-xs leading-relaxed"
                           placeholder="Materias primas identificadas..."
                           value={formData.rawMaterials}
                           onChange={(e) => setFormData(prev => ({ ...prev, rawMaterials: e.target.value }))}
                         />
                       </CardContent>
                     </Card>

                     {/* Maquinaria y Equipos */}
                     <Card className="border-slate-100 shadow-sm bg-slate-50/50">
                       <CardHeader className="pb-2">
                         <CardTitle className="text-sm font-black text-slate-700 flex items-center gap-2">
                           <Wrench className="w-4 h-4 text-amber-500" /> Maquinaria, Herramientas y Equipos
                         </CardTitle>
                       </CardHeader>
                       <CardContent>
                         <Textarea
                           className="min-h-[160px] bg-white text-xs leading-relaxed"
                           placeholder="Maquinaria y equipos de trabajo identificados..."
                           value={formData.machinery}
                           onChange={(e) => setFormData(prev => ({ ...prev, machinery: e.target.value }))}
                         />
                       </CardContent>
                     </Card>
                  </div>
                </div>
             </AnimatePresence>
          </CardContent>
        </Card>

        {processType !== 'diagram' && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="w-5 h-5 text-blue-600" />
                    Materias Primas
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleAutofillAssets}
                    disabled={isExtracting}
                    className="h-7 text-[10px] text-blue-600 hover:bg-blue-50"
                  >
                    <Sparkles className={cn("w-3 h-3 mr-1", isExtracting && "animate-spin")} /> Extracción IA
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea 
                  id="materials"
                  placeholder="Ej. Lámina de acero, solventes, polímeros..."
                  className="min-h-[120px] resize-none text-sm"
                  value={formData.rawMaterials}
                  onChange={(e) => setFormData(prev => ({ ...prev, rawMaterials: e.target.value }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Wrench className="w-5 h-5 text-blue-600" />
                    Maquinaria y Equipos
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleAutofillAssets}
                    disabled={isExtracting}
                    className="h-7 text-[10px] text-blue-600 hover:bg-blue-50"
                  >
                    <Sparkles className={cn("w-3 h-3 mr-1", isExtracting && "animate-spin")} /> Extracción IA
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea 
                  id="machinery"
                  placeholder="Ej. Torno CNC, Prensa hidráulica, Soldadora..."
                  className="min-h-[120px] resize-none text-sm"
                  value={formData.machinery}
                  onChange={(e) => setFormData(prev => ({ ...prev, machinery: e.target.value }))}
                />
              </CardContent>
            </Card>

            <Card className="bg-amber-50 border-amber-100">
              <CardContent className="p-4 flex gap-4 items-start">
                <HelpCircle className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-900 text-sm">¿Por qué es importante?</p>
                  <p className="text-[11px] text-amber-800 leading-tight">
                    Un diagrama fiel al proceso permite a los inspectores de la <span className="font-bold">STPS</span> entender el flujo de materiales y dónde ocurren las potenciales exposiciones a riesgos físicos o químicos.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

