import { useState, useEffect, useRef } from "react";
import { db, type Company } from "../../lib/db";
import { useDexieQuery } from "../../hooks/useDexie";
import { useAppStore } from "../../hooks/useAppStore";
import { Button } from "../ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { 
  Map as MapIcon, 
  Upload, 
  Plus, 
  Trash2, 
  Maximize2, 
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  Save,
  Building2,
  PenTool,
  Eraser,
  Download,
  Sparkles,
  Loader2,
  HelpCircle,
  Calendar,
  ShieldAlert,
  Wrench,
  Check,
  Info,
  Hammer,
  AlertTriangle,
  Camera,
  Trash
} from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "../ui/dialog";
import SignatureCanvas from "react-signature-canvas";
import { cn } from "../../lib/utils";
import { generateInfrastructureAnalyze, analyzeMaterialFromImage } from "../../services/geminiService";

interface LayoutArea {
  id: string;
  name: string;
  description: string;
}

const AVAILABLE_INSTALLATIONS = [
  "Sistema contra incendios (extintores)",
  "Presencia de hidrantes y tomas siamesas",
  "Subestación eléctrica",
  "Instalaciones eléctricas industriales entubadas (tubería conduit)",
  "Instalación neumática (aire comprimido)",
  "Instalaciones de gas L.P. reguladas",
  "Sistema de aire acondicionado o ventilación de aire",
  "Cisterna de almacenamiento de agua potable para emergencias",
];

const MUROS_PRESETS = [
  "Muros de block de concreto reforzado con soporte estructural de columnas de acero",
  "Panel prefabricado térmico multipanel con bastidores metálicos",
  "Muros de tabique rojo recocido con acabados de cemento blanco",
];

const TECHOS_PRESETS = [
  "Lámina pintro galvanizada termoacústica con estructura de armaduras de acero",
  "Losa maciza de concreto armado reforzado",
  "Lámina engargolada KR-18 con traslúcidos de luz natural",
];

const PISOS_PRESETS = [
  "Piso de concreto hidráulico pulido de gran resistencia para tráfico pesado",
  "Pavimento asfáltico plano",
  "Piso epóxico industrial de alta resistencia química y sanitizante",
];

export function LayoutModule() {
  const { currentCompanyId } = useAppStore();
  const company = useDexieQuery(
    () => currentCompanyId ? db.companies.get(currentCompanyId) : Promise.resolve(undefined),
    [currentCompanyId]
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [areas, setAreas] = useState<LayoutArea[]>([]);
  const [newArea, setNewArea] = useState({ name: "", description: "" });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [infraDescription, setInfraDescription] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isCanvasActive, setIsCanvasActive] = useState(false);

  // AI-Assisted States
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);

  // Structural details
  const [iaConstructionYear, setIaConstructionYear] = useState("2015");
  const [iaHasCracks, setIaHasCracks] = useState(false);
  const [iaHasDeformations, setIaHasDeformations] = useState(false);
  const [iaHasSettlements, setIaHasSettlements] = useState(false);
  const [iaStructuralObservations, setIaStructuralObservations] = useState("");

  // Dynamic lists of areas with walls, roofs, floors materials
  const [iaAreas, setIaAreas] = useState<Array<{
    name: string;
    walls: string;
    roof: string;
    floors: string;
  }>>([
    { name: "Área de Oficinas Administrativas", walls: "Muros de block de concreto reforzado con soporte de columnas de acero.", roof: "Losa maciza de concreto armado reforzado o loseta plana.", floors: "Piso de loseta cerámica o mosaico cerámico fino." },
    { name: "Área de Producción, Procesos o Taller", walls: "Muros de block de concreto reforzado con soporte de columnas de acero industriales.", roof: "Lámina pintro galvanizada termoacústica estructurada con armaduras metálicas.", floors: "Piso de concreto hidráulico pulido de gran resistencia para tráfico pesado." },
  ]);

  const [customAreaName, setCustomAreaName] = useState("");

  // Services and safety systems
  const [iaInstallations, setIaInstallations] = useState<string[]>([
    "Sistema contra incendios (extintores)",
    "Instalaciones eléctricas industriales entubadas (tubería conduit)"
  ]);
  const [iaCustomDetails, setIaCustomDetails] = useState("");

  // Photo material analyzer states
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [activeAnalysisField, setActiveAnalysisField] = useState<{ areaIndex: number; field: 'walls' | 'roof' | 'floors' } | null>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState<boolean>(false);
  const [photoAnalysisOptions, setPhotoAnalysisOptions] = useState<Array<{ materialName: string; confidence: string; description: string }> | null>(null);

  const [generatedResult, setGeneratedResult] = useState<{
    infrastructureDescription: string;
    identifiedAreas: Array<{ name: string; description: string; selected: boolean }>;
  } | null>(null);

  const triggerPhotoAnalysis = (areaIndex: number, field: 'walls' | 'roof' | 'floors') => {
    setActiveAnalysisField({ areaIndex, field });
    setPhotoAnalysisOptions(null);
    setTimeout(() => {
      if (photoInputRef.current) {
        photoInputRef.current.click();
      }
    }, 100);
  };

  const handlePhotoAnalyzerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activeAnalysisField === null) return;
    
    setIsAnalyzingPhoto(true);
    setPhotoAnalysisOptions(null);
    
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const result = await analyzeMaterialFromImage(base64);
        setPhotoAnalysisOptions(result.suggestedMaterials);
        toast.success("¡Foto analizada! Selecciona una opción sugerida por el asistente.");
      } catch (err: any) {
        console.error("error analyzing photo", err);
        toast.error("Error al analizar el material de la fotografía: " + (err.message || err));
      } finally {
        setIsAnalyzingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const selectAnalyzedMaterial = (materialName: string) => {
    if (activeAnalysisField === null) return;
    const { areaIndex, field } = activeAnalysisField;
    const updated = [...iaAreas];
    updated[areaIndex][field] = materialName;
    setIaAreas(updated);
    setActiveAnalysisField(null);
    setPhotoAnalysisOptions(null);
    toast.success(`Se aplicó "${materialName}" al campo de ${field === 'walls' ? 'muros' : field === 'roof' ? 'techos' : 'pisos'}.`);
  };

  const addCustomIaArea = () => {
    const trimmed = customAreaName.trim();
    if (!trimmed) {
      toast.error("Indica el nombre del área que deseas agregar.");
      return;
    }
    if (iaAreas.some(a => a.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Esta área ya está definida en el formulario.");
      return;
    }

    setIaAreas([
      ...iaAreas,
      {
        name: trimmed,
        walls: "Muros de block de concreto reforzado.",
        roof: "Lámina pintro galvanizada termoacústica estructurada con armaduras metálicas.",
        floors: "Firme de concreto hidráulico."
      }
    ]);
    setCustomAreaName("");
    toast.success(`Se agregó el área "${trimmed}". Ahora define sus materiales.`);
  };

  const removeIaArea = (index: number) => {
    const name = iaAreas[index].name;
    const updated = iaAreas.filter((_, i) => i !== index);
    setIaAreas(updated);
    toast.info(`Se eliminó el área "${name}" del cuestionario.`);
  };

  const handleAIGenerate = async () => {
    if (!company) {
      toast.error("No hay una empresa seleccionada para el diagnóstico.");
      return;
    }
    
    setIsAILoading(true);
    setGeneratedResult(null);
    try {
      const result = await generateInfrastructureAnalyze(
        company,
        uploadedImage,
        {
          areas: iaAreas,
          installations: iaInstallations,
          constructionYear: iaConstructionYear,
          hasCracks: iaHasCracks,
          hasDeformations: iaHasDeformations,
          hasSettlements: iaHasSettlements,
          structuralObservations: iaStructuralObservations,
          customDetails: iaCustomDetails
        }
      );
      
      setGeneratedResult({
        infrastructureDescription: result.infrastructureDescription,
        identifiedAreas: result.identifiedAreas.map(area => ({ ...area, selected: true }))
      });
      toast.success("¡Análisis de materiales e informe técnico NOM-030 generado correctamente!");
    } catch (err: any) {
      console.error("AI Generation Error", err);
      toast.error("Error al generar descripción con IA: " + (err.message || err));
    } finally {
      setIsAILoading(false);
    }
  };

  const applyAIDescription = async () => {
    if (!generatedResult || !currentCompanyId) return;
    try {
      const descText = generatedResult.infrastructureDescription;
      setInfraDescription(descText);
      await db.companies.update(currentCompanyId, {
        infrastructureDescription: descText,
        updatedAt: new Date()
      });
      toast.success("Descripción copiada y guardada correctamente.");
    } catch (e) {
      toast.error("Fallo al aplicar la descripción.");
    }
  };

  const addAIAreas = async () => {
    if (!generatedResult || !currentCompanyId) return;
    try {
      const selectedAreas = generatedResult.identifiedAreas.filter(a => a.selected);
      if (selectedAreas.length === 0) {
        toast.info("No hay áreas seleccionadas para agregar.");
        return;
      }
      
      const newItems = selectedAreas.map(a => ({
        id: crypto.randomUUID(),
        name: a.name,
        description: a.description
      }));
      
      const updated = [...areas, ...newItems];
      await saveAreas(updated);
      
      setAreas(updated);
      toast.success(`Se agregaron ${selectedAreas.length} áreas identificadas de forma automática.`);
    } catch (e) {
      toast.error("No se pudieron agregar las áreas en la base de datos.");
    }
  };

  useEffect(() => {
    if (company) {
      setInfraDescription(company.infrastructureDescription || "");
      if (company.layoutUrl) {
        setUploadedImage(company.layoutUrl);
        // Load into canvas if it's an image
        if (!company.layoutUrl.startsWith('data:application/pdf')) {
          setTimeout(() => {
            if (sigCanvas.current && company.layoutUrl) {
              sigCanvas.current.fromDataURL(company.layoutUrl);
            }
          }, 200);
        }
      } else {
        setUploadedImage(null);
        sigCanvas.current?.clear();
        setIsCanvasActive(false);
      }
      
      if (company.layoutAreas) {
        try {
          setAreas(JSON.parse(company.layoutAreas));
        } catch (e) {
          setAreas([]);
        }
      } else {
        setAreas([]);
      }
    } else {
      setUploadedImage(null);
      sigCanvas.current?.clear();
      setIsCanvasActive(false);
    }
  }, [company]);

  const handleSaveInfra = async () => {
    if (!currentCompanyId) return;
    try {
      await db.companies.update(currentCompanyId, {
        infrastructureDescription: infraDescription,
        updatedAt: new Date()
      });
      toast.success("Descripción de infraestructura guardada");
    } catch (e) {
      toast.error("Error al guardar descripción");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo es demasiado grande (máx 10MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      if (currentCompanyId) {
        try {
          // Update DB immediately
          await db.companies.update(currentCompanyId, { 
            layoutUrl: base64,
            updatedAt: new Date()
          });
          // Update UI immediately
          setUploadedImage(base64);
          setIsCanvasActive(false);
          sigCanvas.current?.clear();
          toast.success("Plano cargado y guardado correctamente");
        } catch (err) {
          toast.error("Error al actualizar el plano");
        }
      }
    };
    reader.readAsDataURL(file);
    // Reset file input
    e.target.value = "";
  };

  const handleSaveSketch = async () => {
    if (!currentCompanyId) return;
    try {
      if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
        const sketch = sigCanvas.current.getTrimmedCanvas().toDataURL("image/png");
        await db.companies.update(currentCompanyId, {
          layoutUrl: sketch,
          updatedAt: new Date()
        });
        setUploadedImage(sketch);
        setIsCanvasActive(false);
        toast.success("Cambios en el plano guardados");
      } else {
        toast.info("No hay trazos nuevos que guardar");
      }
    } catch (e) {
      toast.error("Error al guardar diseño");
    }
  };

  const clearLayout = async () => {
    if (!currentCompanyId) return;
    try {
      await db.companies.update(currentCompanyId, {
        layoutUrl: null as any, // Use null to clear
        updatedAt: new Date()
      });
      setUploadedImage(null);
      sigCanvas.current?.clear();
      setIsCanvasActive(false);
      toast.success("Plano eliminado correctamente");
    } catch (e) {
      toast.error("Error al eliminar plano");
    }
  };

  const saveAreas = async (updatedAreas: LayoutArea[]) => {
    if (!currentCompanyId) return;
    await db.companies.update(currentCompanyId, {
      layoutAreas: JSON.stringify(updatedAreas),
      updatedAt: new Date()
    });
    setAreas(updatedAreas);
  };

  const addArea = () => {
    if (!newArea.name) return;
    const updated = [...areas, { ...newArea, id: crypto.randomUUID() }];
    saveAreas(updated);
    setNewArea({ name: "", description: "" });
    setIsDialogOpen(false);
    toast.success("Área identificada correctamente");
  };

  const removeArea = (id: string) => {
    const updated = areas.filter(a => a.id !== id);
    saveAreas(updated);
  };

  if (!currentCompanyId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
        <Building2 className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-lg font-medium">Selecciona una empresa para gestionar su infraestructura</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Infraestructura</h1>
        <p className="text-slate-500">Gestión del entorno físico, croquis y descripción de instalaciones.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-slate-200">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Descripción de la Infraestructura
              </CardTitle>
              <Button 
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAIDialogOpen(true)}
                className="bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700 font-semibold self-start sm:self-auto flex items-center gap-2 shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                Generar con IA
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Detalles de Construcción e Instalaciones</Label>
                <Textarea 
                  placeholder="Describe los tipos de materiales (techos, muros, pisos), instalaciones eléctricas, hidráulicas, contra incendio, etc."
                  className="min-h-[150px]"
                  value={infraDescription}
                  onChange={(e) => setInfraDescription(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveInfra} className="bg-blue-600 hover:bg-blue-700">
                  <Save className="w-4 h-4 mr-2" /> Guardar Descripción
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-slate-200">
            <CardHeader className="bg-slate-50 border-b border-slate-200">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Croquis del Centro de Trabajo
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                  />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="bg-white">
                    <Upload className="w-4 h-4 mr-2" /> {uploadedImage ? "Reemplazar" : "Subir Plano"}
                  </Button>
                  {uploadedImage && (
                    <>
                      <Button variant="outline" size="sm" onClick={handleSaveSketch} className="bg-blue-50 text-blue-700 border-blue-200">
                        <Save className="w-4 h-4 mr-2" /> Guardar Sketch
                      </Button>
                      <Button variant="outline" size="sm" onClick={clearLayout} className="text-red-600 border-red-100 hover:bg-red-50">
                        <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 bg-slate-50 relative min-h-[500px]">
              <div className="w-full bg-white border-b border-slate-200 relative overflow-hidden" style={{ height: '500px' }}>
                {uploadedImage && !isCanvasActive && (
                  <div className="absolute inset-0 flex items-center justify-center p-4 bg-white z-0">
                    {company?.layoutUrl?.startsWith('data:application/pdf') ? (
                      <div className="flex flex-col items-center gap-4">
                        <FileText className="w-20 h-20 text-slate-300" />
                        <p className="text-slate-600 font-medium">Vista previa no disponible para PDF</p>
                        <Button variant="ghost" className="text-blue-600" onClick={() => window.open(uploadedImage)}>
                          <Maximize2 className="w-4 h-4 mr-2" /> Abrir PDF
                        </Button>
                      </div>
                    ) : (
                      <img src={uploadedImage} alt="Layout" className="max-w-full max-h-full object-contain" />
                    )}
                  </div>
                )}
                
                <SignatureCanvas 
                  ref={sigCanvas}
                  penColor="red"
                  onBegin={() => setIsCanvasActive(true)}
                  canvasProps={{
                    width: 800,
                    height: 500,
                    className: "signature-canvas w-full h-full cursor-crosshair relative z-10"
                  }}
                />
              </div>
              
              <div className="p-3 flex justify-between items-center bg-slate-50 border-t border-slate-200">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">
                  {isCanvasActive ? "Modo edición: Estás dibujando sobre el lienzo" : "Dibuja sobre el plano o usa las herramientas de carga"}
                </p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 text-[10px] uppercase font-black tracking-widest"
                    onClick={() => {
                      let dataUrl = uploadedImage;
                      if (isCanvasActive && sigCanvas.current && !sigCanvas.current.isEmpty()) {
                        dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL("image/png");
                      }
                      
                      if (dataUrl) {
                        const link = document.createElement('a');
                        link.download = 'centro-trabajo-layout.png';
                        link.href = dataUrl;
                        link.click();
                      } else {
                        toast.error("No hay plano para descargar");
                      }
                    }}
                  >
                    <Download className="w-4 h-4 mr-1" /> Descargar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Áreas Identificadas</CardTitle>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" />}>
                  <Plus className="w-5 h-5" />
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Identificar Nueva Área</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nombre del Área</Label>
                      <Input 
                        placeholder="Ej. Almacén de Químicos" 
                        value={newArea.name}
                        onChange={e => setNewArea({ ...newArea, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descripción / Observación</Label>
                      <Input 
                        placeholder="Puntos críticos detectados..." 
                        value={newArea.description}
                        onChange={e => setNewArea({ ...newArea, description: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={addArea} className="bg-blue-600 w-full">Confirmar Área</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {areas.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Sin áreas registradas</p>
                  </div>
                ) : (
                  areas.map(area => (
                    <div key={area.id} className="group p-3 border border-slate-100 rounded-xl hover:border-blue-100 hover:bg-blue-50/30 transition-all">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-sm text-slate-900">{area.name}</span>
                        <button onClick={() => removeArea(area.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">{area.description}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
            <div className="flex gap-2 items-center mb-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">Uso de Croquis</span>
            </div>
            <p className="text-xs text-blue-700 leading-relaxed">
              La distribución de áreas permite orientar visualmente los recorridos de inspección y determinar la ubicación de equipos de emergencia.
            </p>
          </div>
        </div>
      </div>

      {/* Hidden file input for Photo Material Analyzer */}
      <input 
        type="file" 
        ref={photoInputRef} 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
        onChange={handlePhotoAnalyzerChange} 
      />

      {/* AI Assistant Dialog */}
      <Dialog open={isAIDialogOpen} onOpenChange={setIsAIDialogOpen}>
        <DialogContent className="max-w-4xl sm:max-w-4xl w-[96vw] max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 border border-slate-100 overflow-x-hidden">
          <DialogHeader className="border-b border-slate-100 pb-4">
            <DialogTitle className="text-xl font-extrabold flex items-center gap-2 text-indigo-900 leading-tight">
              <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
              Asistente de Infraestructura Inteligente (IA)
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Completa el levantamiento estructural del centro de trabajo para redactar la memoria descriptiva oficial alineada a la NOM-030-STPS.
            </p>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Informative satellite image indicator */}
            <div className="p-3 sm:p-4 rounded-xl border border-indigo-150 bg-indigo-50/50 flex flex-col sm:flex-row items-start gap-3">
              <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 hidden sm:block">
                <MapIcon className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                  <MapIcon className="w-4 h-4 text-indigo-650 sm:hidden" />
                  Levantamiento Físico y Análisis Multimodal
                </h4>
                <p className="text-xs text-indigo-850 leading-relaxed font-medium">
                  {uploadedImage && !uploadedImage.startsWith('data:application/pdf') 
                    ? "¡Plano o croquis detectado! La IA evaluará visualmente tu croquis cargado junto con la materialidad por área ingresada abajo para redactar el informe técnico."
                    : "Asistente guiado de infraestructura. La IA generará la memoria descriptiva basándose rigurosamente en los materiales por área, anomalías estructurales e instalaciones de servicio."
                  }
                </p>
              </div>
            </div>

            {/* SECCIÓN 1: ANTIGÜEDAD Y DIAGNÓSTICO DE INTEGRIDAD */}
            <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/30 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Calendar className="w-5 h-5 text-blue-650" />
                <h3 className="font-bold text-sm text-slate-900">1. Historial de Construcción y Evaluación Estructural</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 md:col-span-1">
                  <Label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Año de Construcción
                  </Label>
                  <Input 
                    type="number" 
                    value={iaConstructionYear}
                    onChange={(e) => setIaConstructionYear(e.target.value)}
                    placeholder="Ej. 2012"
                    className="bg-white border-slate-250 font-semibold"
                  />
                  <span className="text-[10px] text-slate-400 block font-medium">Indica el año estimado del inmueble</span>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs font-bold text-slate-800 uppercase tracking-wide block mb-1">
                    Signos de alarma estructural evidentes (NOM-001)
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none font-semibold transition-all",
                      iaHasCracks ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    )}>
                      <input 
                        type="checkbox" 
                        checked={iaHasCracks}
                        onChange={() => setIaHasCracks(!iaHasCracks)}
                        className="rounded text-amber-600 focus:ring-amber-500 border-slate-300 h-4 w-4"
                      />
                      Grietas en Muros
                    </label>

                    <label className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none font-semibold transition-all",
                      iaHasDeformations ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    )}>
                      <input 
                        type="checkbox" 
                        checked={iaHasDeformations}
                        onChange={() => setIaHasDeformations(!iaHasDeformations)}
                        className="rounded text-amber-600 focus:ring-amber-500 border-slate-300 h-4 w-4"
                      />
                      Pandeos / Deformaciones
                    </label>

                    <label className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none font-semibold transition-all",
                      iaHasSettlements ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    )}>
                      <input 
                        type="checkbox" 
                        checked={iaHasSettlements}
                        onChange={() => setIaHasSettlements(!iaHasSettlements)}
                        className="rounded text-amber-655 focus:ring-amber-500 border-slate-300 h-4 w-4"
                      />
                      Asentamientos / Hundimientos
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <Label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Observaciones estructurales detalladas
                </Label>
                <Textarea 
                  value={iaStructuralObservations}
                  onChange={(e) => setIaStructuralObservations(e.target.value)}
                  placeholder="Por favor describe la severidad de las grietas, desprendimientos de concreto, o especifica si el inmueble está en perfecto estado general..."
                  className="bg-white border-slate-250 text-xs min-h-[60px]"
                />
              </div>
            </div>

            {/* SECCIÓN 2: DIAGNÓSTICO POR ÁREA OPERATIVA Y MATERIALES */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-650" />
                  <h3 className="font-bold text-sm text-slate-900">2. Estructura y Materiales por Área o Zona Física</h3>
                </div>
                {/* Add area button inline */}
                <div className="flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto">
                  <Input 
                    placeholder="Escribir otra área (ej: Almacén, Comedor)..."
                    value={customAreaName}
                    onChange={(e) => setCustomAreaName(e.target.value)}
                    className="h-8 text-xs max-w-[210px]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomIaArea();
                      }
                    }}
                  />
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline"
                    onClick={addCustomIaArea}
                    className="h-8 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 text-xs font-bold shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Agregar
                  </Button>
                </div>
              </div>

              {/* Grid of Areas */}
              <div className="grid grid-cols-1 gap-5">
                {iaAreas.map((area, areaIdx) => (
                  <div key={areaIdx} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                          {areaIdx + 1}
                        </span>
                        <h4 className="font-bold text-slate-800 text-xs sm:text-sm">{area.name}</h4>
                      </div>
                      
                      {areaIdx > 1 && (
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeIaArea(areaIdx)}
                          className="h-7 w-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          title="Eliminar esta área del cuestionario"
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      {/* MUROS FIELD */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">
                            Muros / Paredes
                          </Label>
                          <Button 
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => triggerPhotoAnalysis(areaIdx, 'walls')}
                            className="h-6 text-[10px] text-indigo-650 hover:bg-indigo-50 px-1.5 flex items-center gap-1 font-bold"
                          >
                            <Camera className="w-3 h-3 text-indigo-600" />
                            No sé / Sube foto
                          </Button>
                        </div>
                        <Input 
                          value={area.walls}
                          onChange={(e) => {
                            const updated = [...iaAreas];
                            updated[areaIdx].walls = e.target.value;
                            setIaAreas(updated);
                          }}
                          placeholder="Ej. Block de concreto o ladrillos rojos"
                          className="text-xs bg-white border-slate-200"
                        />
                        {/* Rapid Presets */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {MUROS_PRESETS.slice(0, 2).map((p, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => {
                                const updated = [...iaAreas];
                                updated[areaIdx].walls = p;
                                setIaAreas(updated);
                              }}
                              className="text-[9px] text-slate-655 hover:text-indigo-700 hover:bg-indigo-50/50 bg-slate-50 border border-slate-150 rounded px-1.5 py-0.5 text-left truncate max-w-full"
                              title={p}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* TECHOS FIELD */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">
                            Techo / Cubierta
                          </Label>
                          <Button 
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => triggerPhotoAnalysis(areaIdx, 'roof')}
                            className="h-6 text-[10px] text-indigo-650 hover:bg-indigo-50 px-1.5 flex items-center gap-1 font-bold"
                          >
                            <Camera className="w-3 h-3 text-indigo-600" />
                            No sé / Sube foto
                          </Button>
                        </div>
                        <Input 
                          value={area.roof}
                          onChange={(e) => {
                            const updated = [...iaAreas];
                            updated[areaIdx].roof = e.target.value;
                            setIaAreas(updated);
                          }}
                          placeholder="Ej. Lámina pintro o losa maciza"
                          className="text-xs bg-white border-slate-200"
                        />
                        {/* Rapid Presets */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {TECHOS_PRESETS.slice(0, 2).map((p, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => {
                                const updated = [...iaAreas];
                                updated[areaIdx].roof = p;
                                setIaAreas(updated);
                              }}
                              className="text-[9px] text-slate-655 hover:text-indigo-700 hover:bg-indigo-50/50 bg-slate-50 border border-slate-150 rounded px-1.5 py-0.5 text-left truncate max-w-full"
                              title={p}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* PISOS FIELD */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">
                            Piso / Firme
                          </Label>
                          <Button 
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => triggerPhotoAnalysis(areaIdx, 'floors')}
                            className="h-6 text-[10px] text-indigo-650 hover:bg-indigo-50 px-1.5 flex items-center gap-1 font-bold"
                          >
                            <Camera className="w-3 h-3 text-indigo-600" />
                            No sé / Sube foto
                          </Button>
                        </div>
                        <Input 
                          value={area.floors}
                          onChange={(e) => {
                            const updated = [...iaAreas];
                            updated[areaIdx].floors = e.target.value;
                            setIaAreas(updated);
                          }}
                          placeholder="Ej. Piso epóxico o concreto pulido"
                          className="text-xs bg-white border-slate-200"
                        />
                        {/* Rapid Presets */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {PISOS_PRESETS.slice(0, 2).map((p, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => {
                                const updated = [...iaAreas];
                                updated[areaIdx].floors = p;
                                setIaAreas(updated);
                              }}
                              className="text-[9px] text-slate-655 hover:text-indigo-700 hover:bg-indigo-50/50 bg-slate-50 border border-slate-150 rounded px-1.5 py-0.5 text-left truncate max-w-full"
                              title={p}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* SUB-SECTION FOR THE EYE-CATCHING PHOTO MATERIAL ANALYZER WIDGET */}
                      {activeAnalysisField && activeAnalysisField.areaIndex === areaIdx && (
                        <div className="col-span-1 md:col-span-3 mt-3 bg-indigo-50 p-4 rounded-xl border border-indigo-200 space-y-3 animation-fade-in relative">
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              setActiveAnalysisField(null);
                              setPhotoAnalysisOptions(null);
                            }}
                            className="absolute top-2 right-2 h-6 w-6 text-indigo-800 hover:bg-indigo-100"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>

                          <div className="flex items-center gap-2">
                            <Camera className="w-5 h-5 text-indigo-700 animate-bounce" />
                            <h5 className="text-xs font-extrabold text-indigo-900 uppercase">
                              Analizador Fotográfico de Material para: <span className="underline italic">{activeAnalysisField.field === 'walls' ? 'muros' : activeAnalysisField.field === 'roof' ? 'techos' : 'pisos'}</span>
                            </h5>
                          </div>

                          <p className="text-[11px] text-indigo-800 font-medium">
                            Toma una fotografía clara desde tu dispositivo móvil o sube una imagen de la superficie. Nuestro motor de IA analizará y dará opciones recomendadas de forma inmediata.
                          </p>

                          <div className="flex flex-wrap gap-2 items-center">
                            <Button 
                              type="button" 
                              onClick={() => photoInputRef.current?.click()}
                              disabled={isAnalyzingPhoto}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 text-xs rounded-lg shadow-sm flex items-center gap-1.5"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              {isAnalyzingPhoto ? "Analizando imagen..." : "Escanear / Capturar Foto"}
                            </Button>
                            
                            {isAnalyzingPhoto && (
                              <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold ml-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Leyendo características de la superficie...
                              </div>
                            )}
                          </div>

                          {/* Suggested options display */}
                          {photoAnalysisOptions && (
                            <div className="space-y-2 pt-2 border-t border-indigo-200">
                              <h6 className="text-[10px] font-extrabold uppercase tracking-wide text-indigo-900 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-650" />
                                Opciones Identificadas por la IA (Selecciona una):
                              </h6>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                {photoAnalysisOptions.map((opt, optIdx) => (
                                  <div 
                                    key={optIdx} 
                                    onClick={() => selectAnalyzedMaterial(opt.materialName)}
                                    className="p-3 bg-white hover:bg-indigo-50/50 border border-indigo-200 hover:border-indigo-400 rounded-lg cursor-pointer transition-all shadow-sm group hover:-translate-y-0.5"
                                  >
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span className="font-bold text-slate-900 text-xs leading-none max-w-[75%] truncate">
                                        {opt.materialName}
                                      </span>
                                      <span className={cn(
                                        "text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full",
                                        opt.confidence === "Alta" ? "bg-emerald-100 text-emerald-850" :
                                        opt.confidence === "Media" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                                      )}>
                                        {opt.confidence}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-normal font-medium group-hover:text-slate-700 italic">
                                      {opt.description}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECCIÓN 3: INSTALACIONES DE SERVICIOS */}
            <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/30 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-indigo-100">
                <Wrench className="w-5 h-5 text-indigo-650" />
                <h3 className="font-bold text-sm text-slate-900">3. Instalaciones de Servicios y de Seguridad Físicas</h3>
              </div>
              
              <Label className="text-slate-800 font-bold text-xs uppercase tracking-wider block mb-1">
                Selecciona todas las instalaciones operativas activas en el centro:
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AVAILABLE_INSTALLATIONS.map((install, idx) => {
                  const isChecked = iaInstallations.includes(install);
                  return (
                    <label 
                      key={idx} 
                      className={cn(
                        "flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer select-none transition-all",
                        isChecked 
                          ? "bg-indigo-50/50 border-indigo-200 text-slate-800"
                          : "bg-white border-slate-150 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setIaInstallations(iaInstallations.filter(i => i !== install));
                          } else {
                            setIaInstallations([...iaInstallations, install]);
                          }
                        }}
                        className="mt-1 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-350"
                      />
                      <span className="text-xs leading-tight font-medium">{install}</span>
                    </label>
                  );
                })}
              </div>

              <div className="space-y-1.5 pt-2">
                <Label className="text-xs font-bold text-slate-850 uppercase tracking-wide">
                  Especificaciones o sistemas adicionales
                </Label>
                <Textarea 
                  value={iaCustomDetails}
                  onChange={(e) => setIaCustomDetails(e.target.value)}
                  placeholder="Por ejemplo: Cisternas y capacidad, transformadores eléctricos propios, red de aire comprimido, etc..."
                  className="bg-white border-slate-200 text-xs min-h-[60px]"
                />
              </div>
            </div>

            {/* SECCIÓN 4: BOTÓN DE ACCIÓN GENERAR */}
            <div className="flex justify-center pt-3">
              <Button 
                onClick={handleAIGenerate}
                disabled={isAILoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto px-10 py-6 text-sm font-bold rounded-xl shadow-lg shadow-indigo-150 flex items-center justify-center gap-2 transition-all disabled:opacity-75"
              >
                {isAILoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                    Generando Memoria Técnica Descriptiva por Áreas...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-indigo-200" />
                    Analizar Estructuras y Generar Diagnóstico
                  </>
                )}
              </Button>
            </div>

            {/* Response Section */}
            {generatedResult && (
              <div className="space-y-6 pt-5 border-t border-dashed border-slate-250">
                
                {/* Generated Text area description */}
                <div className="space-y-3 bg-indigo-50/20 p-4 sm:p-5 rounded-2xl border border-indigo-100">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-indigo-650" />
                        A. Memoria Descriptiva Generada por la IA
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Memoria técnica oficial NOM-030 desglosada por áreas, antigüedad de construcción y diagnóstico de riesgos de fracturas u orientación estructural de seguridad.
                      </p>
                    </div>
                    <Button 
                      onClick={applyAIDescription}
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 rounded-xl shadow-md shrink-0 w-full sm:w-auto"
                    >
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      Aplicar y Guardar a Descripción
                    </Button>
                  </div>
                  
                  <Textarea 
                    value={generatedResult.infrastructureDescription}
                    onChange={(e) => setGeneratedResult({
                      ...generatedResult,
                      infrastructureDescription: e.target.value
                    })}
                    className="min-h-[220px] text-xs leading-relaxed bg-white border-slate-250 text-slate-800 font-medium p-3 rounded-xl"
                  />
                  <div className="flex items-start gap-1.5 text-[10px] text-indigo-700 font-medium italic">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-500" />
                    <span>Esta memoria incluye un diagnóstico completo por áreas, análisis de los signos de desgaste declarados y sugerencias directas de ingeniería preventiva listadas formalmente.</span>
                  </div>
                </div>

                {/* Identified database areas */}
                <div className="space-y-3 bg-emerald-50/25 p-4 sm:p-5 rounded-2xl border border-emerald-100">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        B. Áreas Físicas y Zonas Críticas Identificadas
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        La IA ha mapeado los requerimientos preventivos de este tipo de giro de trabajo. Elige cuáles agregar de forma automática a la empresa.
                      </p>
                    </div>
                    <Button 
                      onClick={addAIAreas}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 rounded-xl shadow shrink-0 w-full sm:w-auto"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Agregar Áreas en Automático
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-1">
                    {generatedResult.identifiedAreas.map((area, idx) => (
                      <div 
                        key={idx}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all cursor-pointer shadow-sm select-none",
                          area.selected 
                            ? "bg-white border-emerald-300 ring-2 ring-emerald-50" 
                            : "bg-slate-50 border-slate-200 opacity-60 hover:opacity-100"
                        )}
                        onClick={() => {
                          const updated = [...generatedResult.identifiedAreas];
                          updated[idx].selected = !updated[idx].selected;
                          setGeneratedResult({
                            ...generatedResult,
                            identifiedAreas: updated
                          });
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox"
                            checked={area.selected}
                            readOnly
                            className="mt-1 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 pointer-events-none"
                          />
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-900">{area.name}</p>
                            <p className="text-[10px] text-slate-500 leading-normal font-medium">{area.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-indigo-650 font-bold italic">
                    <Info className="w-3 h-3 text-indigo-500" />
                    <span>Selecciona las áreas sugeridas que operen físicamente en tus instalaciones. Se registrarán de forma segura en la base de datos local.</span>
                  </div>
                </div>

              </div>
            )}
          </div>

          <DialogFooter className="border-t border-slate-100 pt-4 mt-2 flex flex-col sm:flex-row gap-2">
            <Button 
              type="button"
              variant="outline" 
              className="rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 w-full sm:w-auto" 
              onClick={() => setIsAIDialogOpen(false)}
            >
              Cerrar Asistente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
