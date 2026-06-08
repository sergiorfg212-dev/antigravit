import { useState, useRef, useEffect } from "react";
import { db, type Company, getActiveUserId } from "../../lib/db";
import { useDexieQuery } from "../../hooks/useDexie";
import { useAppStore } from "../../hooks/useAppStore";
import { cn } from "../../lib/utils";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Building2, 
  Plus, 
  Search, 
  MoreHorizontal, 
  ArrowRight,
  Edit2,
  Trash2,
  AlertCircle,
  FileText,
  ArrowLeft,
  ChevronRight,
  MapPin,
  Users,
  ShieldCheck,
  Database,
  Upload,
  Sparkles,
  Sliders,
  UserCheck,
  TrendingUp,
  BarChart3,
  Lock,
  Unlock,
  Ban
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuPortal
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Label } from "@/components/ui/label";
import { DesignationLetter } from "./DesignationLetter";
import { forwardRef, useImperativeHandle } from "react";

export interface CustomSignaturePadRef {
  clear: () => void;
  isEmpty: () => boolean;
  getTrimmedCanvas: () => { toDataURL: (type?: string) => string } | HTMLCanvasElement;
}

export const CustomSignaturePad = forwardRef<CustomSignaturePadRef, { className?: string }>(
  ({ className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isEmptyState, setIsEmptyState] = useState(true);
    const isDrawingRef = useRef(false);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.strokeStyle = "black";
          ctx.lineWidth = 2.5;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
        }
      }
    }, []);

    useImperativeHandle(ref, () => ({
      clear: () => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
        setIsEmptyState(true);
      },
      isEmpty: () => {
        return isEmptyState;
      },
      getTrimmedCanvas: () => {
        const canvas = canvasRef.current;
        if (!canvas) {
          return { toDataURL: () => "" };
        }
        
        // Trim standard canvas code
        const ctx = canvas.getContext('2d');
        if (!ctx) return canvas;
        const width = canvas.width;
        const height = canvas.height;
        const imgData = ctx.getImageData(0, 0, width, height);
        let minX = width;
        let minY = height;
        let maxX = 0;
        let maxY = 0;
        let found = false;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const alpha = imgData.data[((y * width) + x) * 4 + 3];
            if (alpha > 0) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
              found = true;
            }
          }
        }

        if (!found) {
          return canvas;
        }

        minX = Math.max(0, minX - 4);
        minY = Math.max(0, minY - 4);
        maxX = Math.min(width, maxX + 4);
        maxY = Math.min(height, maxY + 4);

        const trimmedWidth = maxX - minX;
        const trimmedHeight = maxY - minY;

        const trimmedCanvas = document.createElement('canvas');
        trimmedCanvas.width = trimmedWidth;
        trimmedCanvas.height = trimmedHeight;
        const trimmedCtx = trimmedCanvas.getContext('2d');
        if (trimmedCtx) {
          trimmedCtx.putImageData(ctx.getImageData(minX, minY, trimmedWidth, trimmedHeight), 0, 0);
        }
        return trimmedCanvas;
      }
    }));

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      e.stopPropagation();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      let clientX, clientY;
      if ("touches" in e) {
        if (e.touches.length === 0) return;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const x = ((clientX - rect.left) / rect.width) * canvas.width;
      const y = ((clientY - rect.top) / rect.height) * canvas.height;

      ctx.beginPath();
      ctx.moveTo(x, y);
      isDrawingRef.current = true;
      setIsEmptyState(false);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      e.stopPropagation();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      let clientX, clientY;
      if ("touches" in e) {
        if (e.touches.length === 0) return;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const x = ((clientX - rect.left) / rect.width) * canvas.width;
      const y = ((clientY - rect.top) / rect.height) * canvas.height;

      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const stopDrawing = () => {
      isDrawingRef.current = false;
    };

    return (
      <canvas
        ref={canvasRef}
        width={500}
        height={150}
        className={className}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        style={{ touchAction: 'none' }}
      />
    );
  }
);

const companySchema = z.object({
  name: z.string().min(3, "Mínimo 3 caracteres"),
  rfc: z.string().min(12, "RFC inválido").max(13, "RFC inválido"),
  address: z.string().min(5, "Dirección requerida"),
  activity: z.string().min(3, "Actividad requerida"),
  businessLine: z.string().optional(),
  shifts: z.string().optional(),
  workerCount: z.number().min(1, "Debe tener al menos 1 trabajador"),
  riskLevel: z.number().min(1).max(5),
  responsibleName: z.string().min(3, "Nombre requerido"),
  studyDate: z.string().optional(),
  totalBuiltArea: z.number().optional(),
  totalPlotArea: z.number().optional(),
  propertyStatus: z.enum(['owned', 'rented', 'leased', 'borrowed', 'other']).optional(),
});

interface CompaniesProps {
  onSelect?: () => void;
}

export function Companies({ onSelect }: CompaniesProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [viewingDesignationFor, setViewingDesignationFor] = useState<Company | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<number | null>(null);
  const sigCanvas = useRef<CustomSignaturePadRef>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { setCurrentCompanyId, currentCompanyId, currentUser, isAdminMode, setIsAdminMode } = useAppStore();
  
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [showAdminConsole, setShowAdminConsole] = useState(false);

  // Strictly enforce that only sergio.rfg212@gmail.com can hold isAdminMode
  useEffect(() => {
    const isMasterAdmin = currentUser?.email?.trim().toLowerCase() === 'sergio.rfg212@gmail.com';
    if (!isMasterAdmin && isAdminMode) {
      setIsAdminMode(false);
    }
  }, [currentUser, isAdminMode, setIsAdminMode]);

  // Queries for Admin consolidation
  const companies = useDexieQuery(
    () => db.companies.toArray(),
    []
  ) || [];

  const adminUsers = useDexieQuery(
    () => db.users.toArray(),
    []
  ) || [];

  const adminAllFindings = useDexieQuery(
    () => db.findings.toArray(),
    []
  ) || [];

  const filteredCompanies = companies.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.rfc.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (isAdminMode) {
      if (selectedUserId === "all") return matchesSearch;
      return c.userId?.toString() === selectedUserId && matchesSearch;
    } else {
      // Normal: Only show companies belonging to the current user, or legacy/universal companies (no userId)
      const matchesUser = !currentUser || !c.userId || c.userId === getActiveUserId();
      return matchesUser && matchesSearch;
    }
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      rfc: "",
      address: "",
      activity: "",
      businessLine: "",
      shifts: "",
      workerCount: 1,
      riskLevel: 1,
      responsibleName: "",
      studyDate: new Date().toISOString().split('T')[0],
      totalBuiltArea: 0,
      totalPlotArea: 0,
      propertyStatus: 'owned',
    }
  });

  const formatDateForInput = (dateVal: any) => {
    if (!dateVal) return "";
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return "";
      return d.toISOString().split('T')[0];
    } catch (e) {
      return "";
    }
  };

  const onSubmit = async (data: any) => {
    try {
      // Robust signature extraction
      let signature = editingCompany?.responsibleSignature || undefined;
      const canvas = sigCanvas.current;
      if (canvas && !canvas.isEmpty()) {
        try {
          signature = canvas.getTrimmedCanvas().toDataURL('image/png');
        } catch (canvasErr) {
          console.error("Signature canvas processing failed:", canvasErr);
        }
      }

      // Safe date formatting
      let parsedStudyDate: Date | undefined = undefined;
      if (data.studyDate) {
        const parsed = new Date(data.studyDate);
        if (!isNaN(parsed.getTime())) {
          parsedStudyDate = parsed;
        }
      }

      // Prevent NaN and schema mismatch values
      const workerCountNum = typeof data.workerCount === 'number' && !isNaN(data.workerCount) ? data.workerCount : 1;
      const riskLevelNum = typeof data.riskLevel === 'number' && !isNaN(data.riskLevel) ? data.riskLevel : 1;
      const totalBuiltAreaNum = typeof data.totalBuiltArea === 'number' && !isNaN(data.totalBuiltArea) ? data.totalBuiltArea : 0;
      const totalPlotAreaNum = typeof data.totalPlotArea === 'number' && !isNaN(data.totalPlotArea) ? data.totalPlotArea : 0;

      const formattedData = {
        ...data,
        workerCount: workerCountNum,
        riskLevel: riskLevelNum,
        totalBuiltArea: totalBuiltAreaNum,
        totalPlotArea: totalPlotAreaNum,
        responsibleSignature: signature,
        studyDate: parsedStudyDate,
        userId: getActiveUserId(),
        creatorName: currentUser?.name || currentUser?.email
      };

      if (editingCompany?.id) {
        await db.companies.update(editingCompany.id, {
          ...formattedData,
          updatedAt: new Date(),
        });
        toast.success("Empresa actualizada correctamente");
      } else {
        const id = await db.companies.add({
          ...formattedData,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        toast.success("Empresa registrada correctamente");
        setCurrentCompanyId(id as number);
        if (onSelect) onSelect();
      }
      setIsDialogOpen(false);
      setEditingCompany(null);
      reset();
    } catch (error: any) {
      console.error("Error al guardar la empresa:", error);
      toast.error(`Error al procesar la operación: ${error?.message || error}`);
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    reset({
      name: company.name,
      rfc: company.rfc,
      address: company.address,
      activity: company.activity,
      businessLine: company.businessLine || "",
      shifts: company.shifts || "",
      workerCount: company.workerCount,
      riskLevel: company.riskLevel,
      responsibleName: company.responsibleName,
      studyDate: formatDateForInput(company.studyDate),
      totalBuiltArea: company.totalBuiltArea || 0,
      totalPlotArea: company.totalPlotArea || 0,
      propertyStatus: company.propertyStatus || 'owned',
    });
    setIsDialogOpen(true);
  };

  const deleteCompany = async () => {
    if (companyToDelete) {
      await db.companies.delete(companyToDelete);
      if (currentCompanyId === companyToDelete) setCurrentCompanyId(null);
      setCompanyToDelete(null);
      toast.success("Empresa eliminada");
    }
  };

  const handleExportBackup = async () => {
    try {
      const data = {
        companies: await db.companies.toArray(),
        findings: await db.findings.toArray(),
        diagnoses: await db.diagnoses.toArray(),
        riskAssessments: await db.riskAssessments.toArray(),
        safetyActions: await db.safetyActions.toArray(),
        checklistItems: await db.checklistItems.toArray(),
        legalMatrix: await db.legalMatrix.toArray(),
        safetyProgram: await db.safetyProgram.toArray(),
        accidentEvents: await db.accidentEvents.toArray(),
        surroundingHazards: await db.surroundingHazards.toArray(),
        evidences: await db.evidences.toArray(),
        users: await db.users.toArray(),
        version: "NOM030-backup-v1"
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute("download", `NOM030_RESPALDO_CONSOLIDADO_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Respaldo exportado exitosamente.");
    } catch (err: any) {
      console.error(err);
      toast.error("Error al exportar respaldo: " + err.message);
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.version !== "NOM030-backup-v1") {
          toast.error("El formato de archivo no es un respaldo válido de NOM-030.");
          return;
        }

        // Import users if they don't exist
        if (data.users && Array.isArray(data.users)) {
          for (const u of data.users) {
            const exists = await db.users.where("email").equals(u.email).first();
            if (!exists) {
              const uCopy = { ...u };
              delete uCopy.id;
              await db.users.add(uCopy);
            }
          }
        }

        if (data.companies && Array.isArray(data.companies)) {
          let importedCount = 0;
          for (const c of data.companies) {
            const exists = await db.companies.where("rfc").equals(c.rfc).first();
            if (!exists) {
              const cCopy = { ...c };
              delete cCopy.id;
              const newCompanyId = await db.companies.add(cCopy);

              const originalId = c.id;
              
              // Seed findings
              if (data.findings && Array.isArray(data.findings)) {
                for (const f of data.findings.filter(item => item.companyId === originalId)) {
                  delete f.id;
                  await db.findings.add({ ...f, companyId: newCompanyId });
                }
              }

              // Seed hazards
              if (data.surroundingHazards && Array.isArray(data.surroundingHazards)) {
                for (const hz of data.surroundingHazards.filter(item => item.companyId === originalId)) {
                  delete hz.id;
                  await db.surroundingHazards.add({ ...hz, companyId: newCompanyId });
                }
              }

              // Seed checklist
              if (data.checklistItems && Array.isArray(data.checklistItems)) {
                for (const item of data.checklistItems.filter(ci => ci.companyId === originalId)) {
                  delete item.id;
                  await db.checklistItems.add({ ...item, companyId: newCompanyId });
                }
              }

              // Seed legal matrix
              if (data.legalMatrix && Array.isArray(data.legalMatrix)) {
                for (const lm of data.legalMatrix.filter(item => item.companyId === originalId)) {
                  delete lm.id;
                  await db.legalMatrix.add({ ...lm, companyId: newCompanyId });
                }
              }

              // Seed safety program
              if (data.safetyProgram && Array.isArray(data.safetyProgram)) {
                for (const sp of data.safetyProgram.filter(item => item.companyId === originalId)) {
                  delete sp.id;
                  await db.safetyProgram.add({ ...sp, companyId: newCompanyId });
                }
              }

              // Seed accidents
              if (data.accidentEvents && Array.isArray(data.accidentEvents)) {
                for (const ae of data.accidentEvents.filter(item => item.companyId === originalId)) {
                  delete ae.id;
                  await db.accidentEvents.add({ ...ae, companyId: newCompanyId });
                }
              }

              importedCount++;
            }
          }
          toast.success(`Consolidación finalizada: se importaron ${importedCount} nuevas empresas.`);
        } else {
          toast.success("Importación realizada (datos vacíos).");
        }
      } catch (err: any) {
        console.error(err);
        toast.error("Fallo al consolidar respaldo: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleGenerateSimulationData = async () => {
    try {
      const mockUsers = [
        { name: "Ing. Daniel Torres", email: "daniel.torres@nom030.com", passwordHash: btoa("password123"), role: "user" as const, createdAt: new Date() },
        { name: "Dra. Elizabeth Ramos", email: "elizabeth.ramos@nom030.com", passwordHash: btoa("password123"), role: "user" as const, createdAt: new Date() },
        { name: "Mtro. Francisco Ortiz", email: "francisco.ortiz@nom030.com", passwordHash: btoa("password123"), role: "user" as const, createdAt: new Date() },
      ];

      const createdUserIds: number[] = [];
      for (const u of mockUsers) {
        const exists = await db.users.where("email").equals(u.email).first();
        if (!exists) {
          const id = await db.users.add(u);
          createdUserIds.push(id as number);
        } else {
          createdUserIds.push(exists.id!);
        }
      }

      const mockCompanies = [
        {
          name: "METALMECÁNICA AVANZADA S.A.",
          rfc: "MMA851020TX8",
          address: "Parque Industrial Chachapa Lote 24, Puebla",
          activity: "Estampado y fundición de piezas automotrices",
          workerCount: 140,
          riskLevel: 5,
          responsibleName: "Ing. Javier Arriaga",
          businessLine: "Siderúrgico / Metalmecánico",
          shifts: "Matutino y Nocturno",
          studyDate: new Date(),
          totalPlotArea: 5000,
          totalBuiltArea: 3200,
          propertyStatus: "owned" as const,
          userId: createdUserIds[0],
          creatorName: "Ing. Daniel Torres"
        },
        {
          name: "FARMACÉUTICA DEL CENTRO",
          rfc: "FCE980415G34",
          address: "Av. de los Cien Metros 420, Ciudad de México",
          activity: "Fabricación de soluciones médicas estériles",
          workerCount: 85,
          riskLevel: 3,
          responsibleName: "Dra. Elizabeth Ramos",
          businessLine: "Química / Farmacéutica",
          shifts: "Matutino",
          studyDate: new Date(),
          totalPlotArea: 3000,
          totalBuiltArea: 2500,
          propertyStatus: "leased" as const,
          userId: createdUserIds[1],
          creatorName: "Dra. Elizabeth Ramos"
        },
        {
          name: "LOGÍSTICA EXPRES INTERNACIONAL",
          rfc: "LEI120901A56",
          address: "Eje Central Lázaro Cárdenas 1005, Estado de México",
          activity: "Almacenamiento y distribución masiva",
          workerCount: 210,
          riskLevel: 2,
          responsibleName: "Lic. Miguel Ángel Sosa",
          businessLine: "Transportes y Almacenaje",
          shifts: "24 Horas Rotativo",
          studyDate: new Date(),
          totalPlotArea: 12000,
          totalBuiltArea: 9500,
          propertyStatus: "rented" as const,
          userId: createdUserIds[2],
          creatorName: "Mtro. Francisco Ortiz"
        }
      ];

      let addedCount = 0;
      for (const comp of mockCompanies) {
        const exists = await db.companies.where("rfc").equals(comp.rfc).first();
        if (!exists) {
          const compId = await db.companies.add(comp as any);
          
          await db.findings.add({
            companyId: compId as number,
            diagnosisId: 1,
            title: comp.riskLevel === 5 ? "Alta temperatura en área de fundición" : "Falta de ventilación en laboratorios",
            description: "Condición expuesta detectada en la auditoría técnica física.",
            severity: comp.riskLevel === 5 ? "high" : "medium",
            priority: "high",
            status: "pending",
            responsible: comp.responsibleName,
            commitmentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            evidenceUrls: [],
            nomReference: ["NOM-030-STPS", "NOM-017-STPS"],
            category: "unsafe_condition",
            correctiveAction: "Instalación de ventilación asistida forzada y climatización.",
            createdAt: new Date(),
            updatedAt: new Date()
          });

          addedCount++;
        }
      }

      toast.success(`Simulación cargada: de forma consolidada se crearon ${createdUserIds.length} asesores y ${addedCount} proyectos seed.`);
    } catch (err: any) {
      console.error(err);
      toast.error("Error al poblar datos de simulación: " + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-lg h-9 w-9 border-slate-200 shadow-sm shrink-0"
            onClick={() => onSelect && onSelect()}
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-[#1e293b] tracking-tight">Empresas y Sedes</h1>
            <p className="text-xs text-slate-500 font-bold tracking-tight uppercase opacity-70">Gestión de centros de trabajo y evaluaciones normativas</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          {/* Admin Switch Switcher - Restricted to sergio.rfg212@gmail.com */}
          {currentUser?.email?.trim().toLowerCase() === 'sergio.rfg212@gmail.com' && (
            <div className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200/85 p-1.5 px-3.5 rounded-xl transition-all border border-slate-200/55 shadow-inner">
              <ShieldCheck className={cn("w-4 h-4 transition-all duration-300", isAdminMode ? "text-amber-500 animate-pulse" : "text-slate-400")} />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 select-none">
                Modo Administrador
              </span>
              <button
                onClick={() => {
                  setIsAdminMode(!isAdminMode);
                  if (!isAdminMode) {
                    toast.success("Rol de Administrador Activado: Visualizando proyectos de todos los asesores");
                  } else {
                    toast.info("Modo Administrador Desactivado: Retornando a proyectos individuales");
                  }
                }}
                className={cn(
                  "w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none flex items-center relative transition-all",
                  isAdminMode ? "bg-amber-500 justify-end" : "bg-slate-300 justify-start"
                )}
              >
                <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-md" />
              </button>
            </div>
          )}
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingCompany(null);
              reset({
                name: "",
                rfc: "",
                address: "",
                activity: "",
                businessLine: "",
                shifts: "",
                workerCount: 1,
                riskLevel: 1,
                responsibleName: "",
                studyDate: new Date().toISOString().split('T')[0],
                totalBuiltArea: 0,
                totalPlotArea: 0,
                propertyStatus: 'owned',
              });
              sigCanvas.current?.clear();
            }
          }}>
            <DialogTrigger className="bg-[#1e293b] hover:bg-[#0f172a] text-white font-black tracking-tighter px-6 h-10 rounded-xl shadow-lg uppercase text-[10px] transition-all hover:scale-105 active:scale-95 flex items-center justify-center">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Sede
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 text-xs rounded-3xl overflow-hidden shadow-2xl">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle className="text-lg font-black text-slate-900 tracking-tight">{editingCompany ? "Editar Sede" : "Registrar Sede"}</DialogTitle>
                <DialogDescription className="text-[11px] text-slate-500">
                  {editingCompany ? "Actualiza los datos de la empresa." : "Ingresa los datos fiscales y generales de la empresa."}
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-6">
                <form onSubmit={handleSubmit(onSubmit)} id="company-form" className="grid grid-cols-2 gap-4 pb-4">
                  <div className="col-span-2 space-y-2">
                    <Label className="font-bold">Razón Social *</Label>
                    <Input {...register("name")} placeholder="Nombre comercial o legal" />
                    {errors.name && <p className="text-xs text-red-500">{errors.name.message as string}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">RFC *</Label>
                    <Input {...register("rfc")} placeholder="RFC con homoclave" />
                    {errors.rfc && <p className="text-xs text-red-500">{errors.rfc.message as string}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">Giro de la Empresa</Label>
                    <Input {...register("businessLine")} placeholder="Ejem: Manufactura, Servicios..." />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label className="font-bold">Domicilio Completo *</Label>
                    <Input {...register("address")} placeholder="Calle, Número, Colonia, CP, Ciudad" />
                    {errors.address && <p className="text-xs text-red-500">{errors.address.message as string}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">Actividad Económica *</Label>
                    <Input {...register("activity")} />
                    {errors.activity && <p className="text-xs text-red-500">{errors.activity.message as string}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">Número de Trabajadores *</Label>
                    <Input type="number" {...register("workerCount", { valueAsNumber: true })} />
                    {errors.workerCount && <p className="text-xs text-red-500">{errors.workerCount.message as string}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">Nivel de Riesgo (Clase) *</Label>
                    <select 
                      {...register("riskLevel", { valueAsNumber: true })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                    >
                      <option value={1}>Clase I (Riesgo Mínimo)</option>
                      <option value={2}>Clase II (Riesgo Bajo)</option>
                      <option value={3}>Clase III (Riesgo Medio)</option>
                      <option value={4}>Clase IV (Riesgo Alto)</option>
                      <option value={5}>Clase V (Riesgo Máximo)</option>
                    </select>
                    {errors.riskLevel && <p className="text-xs text-red-500">{errors.riskLevel.message as string}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">Turnos de Trabajo</Label>
                    <Input {...register("shifts")} placeholder="Ejem: 1er Turno (08-16), 2do Turno..." />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">Fecha de Realización del Estudio</Label>
                    <Input type="date" {...register("studyDate")} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">Situación del Predio</Label>
                    <select 
                      {...register("propertyStatus")}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="owned">Propio</option>
                      <option value="rented">Rentado</option>
                      <option value="leased">Arrendado</option>
                      <option value="borrowed">Prestado</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">Superficie del Terreno (m²)</Label>
                    <Input type="number" {...register("totalPlotArea", { valueAsNumber: true })} step="0.01" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">Superficie Construida (m²)</Label>
                    <Input type="number" {...register("totalBuiltArea", { valueAsNumber: true })} step="0.01" />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label className="font-bold">Responsable de Seguridad y Salud</Label>
                    <Input {...register("responsibleName")} />
                    {errors.responsibleName && <p className="text-xs text-red-500">{errors.responsibleName.message as string}</p>}
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label className="font-bold">Firma del Responsable</Label>
                    <div className="border rounded-md bg-white overflow-hidden flex items-center justify-center">
                      <CustomSignaturePad 
                        ref={sigCanvas}
                        className="w-full h-32 cursor-crosshair bg-white"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] text-slate-400">Firma en el recuadro anterior</p>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="text-[10px] h-6"
                        onClick={() => sigCanvas.current?.clear()}
                      >
                        Limpiar firma
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
              <div className="p-6 pt-2 border-t mt-auto">
                <Button form="company-form" type="submit" className="w-full bg-[#1e293b] hover:bg-black text-white font-black text-xs uppercase tracking-widest py-3">
                  {editingCompany ? "Actualizar Sede" : "Guardar Sede"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* CONSOLA DE ADMINISTRACIÓN DE PROYECTOS (Solo visible para Administradores de forma extendida) */}
      {isAdminMode && (
        <div className="bg-[#0f172a] text-slate-100 p-8 rounded-[2rem] border border-slate-800 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

          {/* Console Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest leading-none flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Consola Maestra de Control
                </span>
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest leading-none">
                  Rol: Administrador
                </span>
              </div>
              <h2 className="text-xl font-black tracking-tight text-white uppercase sm:normal-case mt-1.5">Consola de Consolidación de Proyectos</h2>
              <p className="text-slate-400 text-xs">Monitoreo absoluto de actividades técnicas normativas NOM-030-STPS-2009 en todo el sistema.</p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportBackup}
                className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl h-9 text-[10px] font-black uppercase tracking-wider"
              >
                <Database className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                Respaldar Base de Datos
              </Button>

              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                  id="admin-import-file-inp"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("admin-import-file-inp")?.click()}
                  className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl h-9 text-[10px] font-black uppercase tracking-wider"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                  Consolidar Respaldo
                </Button>
              </div>

              <Button
                size="sm"
                onClick={handleGenerateSimulationData}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl h-9 text-[10px] font-black uppercase tracking-wider"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
                Simular Otros Usuarios
              </Button>
            </div>
          </div>

          {/* Stats KPI Widgets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-6 text-left">
            <div className="bg-slate-900/50 border border-slate-800/80 p-5 rounded-2xl">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Empresas Consolidadas</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">{companies.length}</span>
                <span className="text-[10px] font-bold text-slate-400 leading-none">sedes</span>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(100, companies.length * 10)}%` }} />
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/80 p-5 rounded-2xl">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Asesores de Campo (Usuarios)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">{adminUsers.length}</span>
                <span className="text-[10px] font-bold text-slate-400 leading-none">cuentas activas</span>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, adminUsers.length * 20)}%` }} />
              </div>
            </div>

            <div className="bg-[#0f172a] border border-slate-800/80 p-5 rounded-2xl">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Hallazgos Activos Globales</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-400">{adminAllFindings.length}</span>
                <span className="text-[10px] font-bold text-slate-400 leading-none">alertas NOM</span>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, adminAllFindings.length * 5)}%` }} />
              </div>
            </div>

            <div className="bg-[#0f172a] border border-slate-800/80 p-5 rounded-2xl">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Trabajadores Protegidos</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-indigo-400">
                  {companies.reduce((sum, c) => sum + (c.workerCount || 0), 0)}
                </span>
                <span className="text-[10px] font-bold text-slate-400 leading-none">colaboradores</span>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full" style={{ width: "65%" }} />
              </div>
            </div>
          </div>

          {/* Filter Toolbar & User List Toggle */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 leading-none shrink-0 text-left">
                <Sliders className="w-3.5 h-3.5 text-blue-500" /> Filtrar por Asesor Técnico:
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl px-3.5 py-2 w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-slate-700"
              >
                <option value="all">Ver todas las cuentas (Consolidado)</option>
                {adminUsers.map((u) => (
                  <option key={u.id} value={u.id?.toString()}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-slate-900/60 px-4 py-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs gap-3">
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Gestión de Roles:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdminConsole(!showAdminConsole)}
                className="text-[10px] h-7 font-black uppercase tracking-wider text-blue-400 hover:text-white hover:bg-slate-800 rounded-lg selection:bg-slate-800"
              >
                {showAdminConsole ? "Ocultar Directorio" : "Mostrar Directorio"}
              </Button>
            </div>
          </div>

          {/* Collapsible User Directory Directory */}
          {showAdminConsole && (
            <div className="mt-6 p-4 rounded-xl bg-slate-950 border border-slate-900 animate-in fade-in slide-in-from-top-2 duration-300">
              <h3 className="text-xs font-black text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" /> Directorio de Cuentas y Asesores Registrados
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-950 text-slate-500 uppercase font-black text-[9px] tracking-wider">
                      <th className="py-2.5">ID</th>
                      <th className="py-2.5">Nombre</th>
                      <th className="py-2.5">Email</th>
                      <th className="py-1 px-3 text-center">Rol de Sistema</th>
                      <th className="py-1 px-3 text-center">Estado</th>
                      <th className="py-2.5 text-right font-black">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.map((user) => (
                      <tr key={user.id} className="border-b border-slate-900/45 hover:bg-slate-900/30">
                        <td className="py-2 text-slate-500">{user.id}</td>
                        <td className="py-2 font-black text-slate-200">{user.name}</td>
                        <td className="py-2 text-slate-400">{user.email}</td>
                        <td className="py-2 text-center">
                          <span className={cn(
                            "text-[8px] font-black px-2 py-0.5 rounded-md",
                            user.role === 'admin' ? "bg-amber-500/10 text-amber-500 border border-amber-500/30" : "bg-slate-805 text-slate-500 border border-slate-700"
                          )}>
                            {(user.role || 'user').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 text-center">
                          <span className={cn(
                            "text-[8px] font-black px-2 py-0.5 rounded-md",
                            user.isBlocked ? "bg-red-500/10 text-red-500 border border-red-500/30" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          )}>
                            {user.isBlocked ? "BLOQUEADO" : "ACTIVO"}
                          </span>
                        </td>
                        <td className="py-2 text-right text-[11px]">
                          <div className="flex items-center justify-end gap-1">
                            {/* Toggle system role */}
                            <Button
                              variant="ghost" 
                              size="icon"
                              title={user.role === 'admin' ? "Cambiar a Asesor (Usuario)" : "Cambiar a Administrador"}
                              onClick={async () => {
                                if (user.email === currentUser?.email) {
                                  toast.error("No puedes cambiar tu propio rol.");
                                  return;
                                }
                                const newRole = user.role === 'admin' ? 'user' : 'admin';
                                if (newRole === 'admin' && user.email.trim().toLowerCase() !== 'sergio.rfg212@gmail.com') {
                                  toast.error("Solo el constructor de la app (sergio.rfg212@gmail.com) tiene permitido el rol de Administrador.");
                                  return;
                                }
                                await db.users.update(user.id!, { role: newRole });
                                toast.success(`Rol de ${user.name} cambiado a ${newRole.toUpperCase()}`);
                              }}
                              className="h-6 w-6 rounded-md hover:bg-slate-900 text-slate-400 hover:text-amber-500"
                            >
                              {user.role === 'admin' ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            </Button>

                            {/* Block / Unblock user */}
                            <Button
                              variant="ghost" 
                              size="icon"
                              title={user.isBlocked ? "Desbloquear usuario/asesor" : "Bloquear usuario/asesor"}
                              onClick={async () => {
                                if (user.email === currentUser?.email) {
                                  toast.error("No puedes bloquear tu propio usuario.");
                                  return;
                                }
                                const updatedBlocked = !user.isBlocked;
                                await db.users.update(user.id!, { isBlocked: updatedBlocked });
                                toast.success(updatedBlocked ? `${user.name} ha sido bloqueado exitosamente.` : `${user.name} ha sido desbloqueado.`);
                              }}
                              className={cn(
                                "h-6 w-6 rounded-md hover:bg-slate-900",
                                user.isBlocked ? "text-red-500 hover:text-red-400" : "text-slate-400 hover:text-red-500"
                              )}
                            >
                              <Ban className="w-3 h-3" />
                            </Button>

                            {/* Delete User */}
                            <Button
                              variant="ghost" 
                              size="icon"
                              title="Eliminar usuario definitivamente"
                              onClick={async () => {
                                if (user.email === currentUser?.email) {
                                  toast.error("No puedes auto-eliminarte de la sesión actual.");
                                  return;
                                }
                                if (confirm(`¿Estás completamente seguro de eliminar a ${user.name}? Sus centros de trabajo permanecerán de forma universal en la base de datos.`)) {
                                  // Update companies' user assignment to undefined so the projects are not deleted
                                  try {
                                    const projects = await db.companies.where("userId").equals(user.id!).toArray();
                                    for (const p of projects) {
                                      await db.companies.update(p.id!, { userId: undefined });
                                    }
                                    await db.users.delete(user.id!);
                                    toast.success(`Asesor técnico ${user.name} ha sido eliminado definitivamente.`);
                                  } catch (err: any) {
                                    toast.error("Ocurrió un error al eliminar: " + err.message);
                                  }
                                }
                              }}
                              className="h-6 w-6 rounded-md hover:bg-slate-900 text-slate-400 hover:text-red-500"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input 
          placeholder="Buscar centro de trabajo..." 
          className="pl-10 bg-white border-slate-200 rounded-xl h-10 text-sm shadow-sm focus:ring-slate-400"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredCompanies.length === 0 ? (
          <div className="col-span-full h-80 border-2 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center text-slate-400 space-y-4">
            <Building2 className="w-16 h-16 opacity-20" />
            <p className="font-bold text-base uppercase tracking-widest">No hay registros</p>
          </div>
        ) : (
          filteredCompanies.map((company) => (
            <div 
              key={company.id} 
              className={`group bg-white p-6 rounded-3xl border-2 transition-all relative cursor-pointer hover:shadow-xl ${
                currentCompanyId === company.id ? 'border-blue-600 ring-4 ring-blue-50/50' : 'border-slate-100'
              }`}
              onClick={() => {
                setCurrentCompanyId(company.id!);
                toast.success(`Empresa ${company.name} seleccionada`);
                if (onSelect) onSelect();
              }}
            >
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shadow-inner">
                  {company.logo ? (
                    <img src={company.logo} alt="Logo" className="w-9 h-9 object-contain" />
                  ) : (
                    <Building2 className="w-5 h-5 text-slate-300" />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-emerald-50 text-emerald-600 text-xs font-black px-3 py-1 rounded-lg border border-emerald-100/50 uppercase tracking-widest shadow-sm">Vigente</span>
                  <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-slate-400 transition-colors" />
                </div>
              </div>

              <div className="space-y-1.5 mb-8">
                <h3 className="text-xl font-black text-slate-900 tracking-tighter leading-none truncate pr-12">
                  {company.name.toUpperCase()}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase truncate opacity-80">
                  {company.rfc}
                </p>
                <p className="text-xs font-bold text-slate-500 truncate mt-2.5 leading-relaxed">
                  {company.businessLine || company.activity}
                </p>
              </div>

              <div className="pt-6 border-t border-slate-50 space-y-4">
                <div className="flex items-center gap-3 text-slate-500">
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-wider truncate flex-1 leading-none">{company.address}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-wider leading-none">{company.workerCount} TRABAJADORES</span>
                </div>

                {isAdminMode && (
                  <div className="mt-2 pt-4 border-t border-slate-100 flex items-center justify-between text-left">
                    <div className="flex items-center gap-1.5 text-[9px] uppercase font-black text-slate-400">
                      <UserCheck className="w-3.5 h-3.5 text-blue-500" /> Asesor Campo:
                    </div>
                    <span className="text-[9px] font-extrabold text-blue-600 bg-blue-50/50 border border-blue-100/40 px-2.5 py-1 rounded-lg leading-none truncate max-w-[150px]">
                      {company.creatorName || "Universal / Legacy"}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions Overlay */}
              <div 
                className="absolute top-6 right-8 z-30" 
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:text-slate-900 transition-all shadow-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="w-4 h-4 text-slate-500" />
                      </Button>
                    }
                  />
                  <DropdownMenuPortal>
                    <DropdownMenuContent align="end" className="rounded-3xl border-slate-200 shadow-2xl p-3 min-w-[240px] z-[100] animate-in fade-in zoom-in-95 duration-200">
                      <DropdownMenuItem 
                        className="rounded-xl py-3 px-4 cursor-pointer font-black text-xs uppercase tracking-widest focus:bg-slate-50 flex items-center gap-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingDesignationFor(company);
                        }}
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        Carta Designación
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="rounded-xl py-3 px-4 cursor-pointer font-black text-xs uppercase tracking-widest focus:bg-slate-50 flex items-center gap-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(company);
                        }}
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                          <Edit2 className="w-3.5 h-3.5" />
                        </div>
                        Editar Datos Registro
                      </DropdownMenuItem>
                      <div className="h-px bg-slate-100 my-2" />
                      <DropdownMenuItem 
                        className="rounded-xl py-3 px-4 text-red-600 cursor-pointer font-black text-xs uppercase tracking-widest focus:bg-red-50 flex items-center gap-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (company.id) setCompanyToDelete(company.id);
                        }}
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </div>
                        Eliminar Sede / Empresa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenuPortal>
                </DropdownMenu>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={companyToDelete !== null} onOpenChange={(open) => !open && setCompanyToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar empresa?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todos los hallazgos y registros asociados a este centro de trabajo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setCompanyToDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={deleteCompany}>Eliminar definitivamente</Button>
          </div>
        </DialogContent>
      </Dialog>

      {!currentCompanyId && filteredCompanies.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 text-amber-800">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-medium">Selecciona una empresa para comenzar con el diagnóstico y seguimiento.</p>
        </div>
      )}

      {viewingDesignationFor && (
        <DesignationLetter 
          company={viewingDesignationFor} 
          onClose={() => setViewingDesignationFor(null)} 
        />
      )}
    </div>
  );
}
