import React, { useState } from "react";
import { db, type EvidenceLog } from "../../lib/db";
import { useDexieQuery } from "../../hooks/useDexie";
import { useAppStore } from "../../hooks/useAppStore";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";
import { 
  FileUp, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  History,
  GraduationCap,
  Calendar,
  AlertCircle,
  FileCheck,
  CheckCircle,
  Upload
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "../../lib/utils";

const isImageFile = (url?: string, name?: string) => {
  if (!url) return false;
  if (url.startsWith('data:image/')) return true;
  if (name) {
    const ext = name.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext || '');
  }
  return false;
};

export function ComplianceLogModule() {
  const { currentCompanyId } = useAppStore();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const evidences = useDexieQuery(
    () => currentCompanyId ? db.evidences.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([]),
    [currentCompanyId, refreshTrigger]
  ) || [];

  const handleAddEntry = async (entryType: 'progress' | 'training') => {
    if (!currentCompanyId) return;
    
    try {
      await db.evidences.add({
        companyId: currentCompanyId,
        entryType,
        date: new Date(),
        title: entryType === 'progress' ? 'Nuevo seguimiento' : 'Nombre del Responsable',
        progressPercentage: entryType === 'progress' ? 0 : undefined,
        status: entryType === 'progress' ? 'pending' : undefined,
        role: entryType === 'training' ? 'Cargo o Puesto' : undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      setRefreshTrigger(p => p + 1);
      toast.success(entryType === 'progress' ? "Fila de seguimiento agregada" : "Registro de capacitación agregado");
    } catch (e) {
      toast.error("Error al agregar registro");
    }
  };

  const handleUpdate = async (id: number, updates: Partial<EvidenceLog>) => {
    try {
      await db.evidences.update(id, { ...updates, updatedAt: new Date() });
      setRefreshTrigger(p => p + 1);
    } catch (e) {
      toast.error("Error al actualizar");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await db.evidences.delete(id);
      setRefreshTrigger(p => p + 1);
      toast.success("Registro eliminado");
    } catch (e) {
      toast.error("Error al eliminar");
    }
  };

  const handleFileUpload = (id: number, file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      await handleUpdate(id, { 
        fileUrl: dataUrl,
        fileName: file.name
      });
      toast.success("Archivo cargado correctamente");
    };
    reader.readAsDataURL(file);
  };

  if (!currentCompanyId) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
        <History className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold">Selecciona una empresa</h3>
        <p className="text-slate-500 mt-2">Debes seleccionar una empresa para gestionar la bitácora de cumplimiento.</p>
      </div>
    );
  }

  const progressEntries = evidences.filter(e => e.entryType === 'progress');
  const trainingEntries = evidences.filter(e => e.entryType === 'training');

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
              <History className="w-6 h-6 text-white" />
            </div>
            Bitácora de Cumplimiento (NOM-030)
          </h1>
          <p className="text-xs text-slate-500 mt-2 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            Control de Evidencias Legales y Seguimiento del Programa Preventivo
          </p>
        </div>
      </header>

      {/* SECTION 1: SEGUIMIENTO DE AVANCES */}
      <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden bg-white rounded-3xl">
        <CardHeader className="border-b border-slate-50 bg-slate-50/30 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileCheck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-800">1. Seguimiento de Avances</CardTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Reportes de Instauración del Programa</p>
              </div>
            </div>
            <Button onClick={() => handleAddEntry('progress')} size="sm" className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 rounded-xl px-4">
              <Plus className="w-4 h-4 mr-2" /> Agregar Reporte
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead className="w-[120px] text-[10px] font-bold uppercase tracking-widest px-8">Fecha</TableHead>
                  <TableHead className="min-w-[300px] text-[10px] font-bold uppercase tracking-widest">Descripción del Avance</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-bold uppercase tracking-widest text-center">Cumplimiento</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-bold uppercase tracking-widest text-center">Estatus</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-bold uppercase tracking-widest text-center">Evidencia</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {progressEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center py-10">
                      <div className="text-slate-300 italic text-sm">No hay registros de seguimiento para esta empresa.</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  progressEntries.map((entry) => (
                    <TableRow key={entry.id} className="group hover:bg-slate-50/50 transition-colors border-slate-50">
                      <TableCell className="px-8 font-medium text-slate-600">
                        <Input 
                          type="date"
                          className="h-8 text-xs border-none bg-transparent focus-visible:ring-0 p-0 font-bold"
                          value={format(new Date(entry.date), 'yyyy-MM-dd')}
                          onChange={(e) => entry.id && handleUpdate(entry.id, { date: new Date(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input 
                          className="h-8 text-xs border-none bg-transparent focus-visible:ring-0 p-0 font-bold text-slate-800"
                          value={entry.title}
                          onChange={(e) => entry.id && handleUpdate(entry.id, { title: e.target.value })}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-3">
                          <input 
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            className="w-20 h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            value={entry.progressPercentage || 0}
                            onChange={(e) => entry.id && handleUpdate(entry.id, { progressPercentage: parseInt(e.target.value) })}
                          />
                          <span className="text-[10px] font-black text-slate-500 w-8">{entry.progressPercentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <select 
                          className={cn(
                            "text-[10px] font-black uppercase px-2 py-1 rounded-lg border-none cursor-pointer focus:ring-0",
                            entry.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
                            entry.status === 'in_progress' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                          )}
                          value={entry.status}
                          onChange={(e) => entry.id && handleUpdate(entry.id, { status: e.target.value as any })}
                        >
                          <option value="pending">Pendiente</option>
                          <option value="in_progress">En proceso</option>
                          <option value="completed">Completado</option>
                        </select>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                          <input 
                            type="file" 
                            id={`file-${entry.id}`}
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file && entry.id) handleFileUpload(entry.id, file);
                            }}
                          />
                          {entry.fileUrl && isImageFile(entry.fileUrl, entry.fileName) && (
                            <div 
                              className="relative cursor-zoom-in group/thumb" 
                              onClick={() => setPreviewImage({ url: entry.fileUrl!, title: entry.title })}
                            >
                              <img 
                                src={entry.fileUrl} 
                                alt={entry.fileName || "Evidencia"} 
                                className="w-12 h-12 object-cover rounded-lg border border-slate-200 shadow-sm hover:scale-105 hover:border-indigo-400 transition-all duration-200"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          <label 
                            htmlFor={`file-${entry.id}`}
                            className={cn(
                              "flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold cursor-pointer transition-all",
                              entry.fileUrl ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                            )}
                          >
                            <Upload className="w-3 h-3 text-slate-500" />
                            {entry.fileUrl ? "Cambiar" : "Cargar"}
                          </label>
                          {entry.fileUrl && !isImageFile(entry.fileUrl, entry.fileName) && (
                            <span className="text-[9px] text-slate-500 font-medium truncate max-w-[100px] block" title={entry.fileName}>
                              {entry.fileName}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="pr-8">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          onClick={() => entry.id && handleDelete(entry.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: CAPACITACIÓN DEL PERSONAL */}
      <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden bg-white rounded-3xl">
        <CardHeader className="border-b border-slate-50 bg-slate-50/30 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <GraduationCap className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-800">2. Capacitación del Personal</CardTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Servicios Preventivos de Seguridad y Salud</p>
              </div>
            </div>
            <Button onClick={() => handleAddEntry('training')} size="sm" variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50 rounded-xl px-4">
              <Plus className="w-4 h-4 mr-2" /> Registrar Capacitación
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead className="min-w-[250px] text-[10px] font-bold uppercase tracking-widest px-8">Nombre del Responsable</TableHead>
                  <TableHead className="w-[200px] text-[10px] font-bold uppercase tracking-widest px-4 text-center">Cargo o Puesto</TableHead>
                  <TableHead className="w-[180px] text-[10px] font-bold uppercase tracking-widest px-4 text-center">Fecha de Capacitación</TableHead>
                  <TableHead className="w-[200px] text-[10px] font-bold uppercase tracking-widest text-center">Constancia / DC-3</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainingEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center py-10">
                      <div className="text-slate-300 italic text-sm">No se ha registrado capacitación para el personal preventivo.</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  trainingEntries.map((entry) => (
                    <TableRow key={entry.id} className="group hover:bg-slate-50/50 transition-colors border-slate-50">
                      <TableCell className="px-8">
                        <Input 
                          className="h-8 text-xs border-none bg-transparent focus-visible:ring-0 p-0 font-bold text-slate-800"
                          value={entry.title}
                          placeholder="Nombre completo..."
                          onChange={(e) => entry.id && handleUpdate(entry.id, { title: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input 
                          className="h-8 text-xs border-none bg-transparent focus-visible:ring-0 p-0 font-medium text-slate-600 text-center"
                          value={entry.role}
                          placeholder="Cargo..."
                          onChange={(e) => entry.id && handleUpdate(entry.id, { role: e.target.value })}
                        />
                      </TableCell>
                      <TableCell className="text-center font-bold text-slate-600">
                         <Input 
                          type="date"
                          className="h-8 text-xs border-none bg-transparent focus-visible:ring-0 p-0 font-bold text-center"
                          value={format(new Date(entry.date), 'yyyy-MM-dd')}
                          onChange={(e) => entry.id && handleUpdate(entry.id, { date: new Date(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                          <input 
                            type="file" 
                            id={`dc3-${entry.id}`}
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file && entry.id) handleFileUpload(entry.id, file);
                            }}
                          />
                          {entry.fileUrl && isImageFile(entry.fileUrl, entry.fileName) && (
                            <div 
                              className="relative cursor-zoom-in group/thumb" 
                              onClick={() => setPreviewImage({ url: entry.fileUrl!, title: `DC-3: ${entry.title}` })}
                            >
                              <img 
                                src={entry.fileUrl} 
                                alt={entry.fileName || "Constancia"} 
                                className="w-16 h-10 object-cover rounded-lg border border-slate-200 shadow-sm hover:scale-105 hover:border-emerald-400 transition-all duration-200"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          <label 
                            htmlFor={`dc3-${entry.id}`}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-bold cursor-pointer transition-all shadow-sm",
                              entry.fileUrl ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60" : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200"
                            )}
                          >
                            <Upload className="w-3 h-3" />
                            {entry.fileUrl ? "CAMBIAR" : "CARGAR"}
                          </label>
                          {entry.fileUrl && !isImageFile(entry.fileUrl, entry.fileName) && (
                            <span className="text-[9px] text-slate-500 font-semibold truncate max-w-[100px] block" title={entry.fileName}>
                              {entry.fileName}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="pr-8">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          onClick={() => entry.id && handleDelete(entry.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl flex gap-4 items-start shadow-sm">
        <div className="p-2 bg-amber-100 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-600" />
        </div>
        <div className="space-y-1">
          <h4 className="font-bold text-amber-900 text-sm">Nota de Cumplimiento (Art. 4.6 y 4.7)</h4>
          <p className="text-xs text-amber-800 leading-relaxed opacity-80">
            Es obligatorio para el patrón conservar las evidencias de capacitación y los reportes de seguimiento por al menos dos años. 
            Asegúrese de cargar los respaldos digitales escaneados para cada registro.
          </p>
        </div>
      </div>

      {/* Lightbox / Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative bg-white dark:bg-slate-900 rounded-3xl overflow-hidden max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate max-w-[80%] uppercase tracking-wider">
                {previewImage.title}
              </h3>
              <button 
                type="button"
                className="rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 h-7 w-7 flex items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-650 dark:hover:text-slate-350 transition-all"
                onClick={() => setPreviewImage(null)}
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-slate-100/50 dark:bg-slate-950 flex items-center justify-center min-h-[350px]">
              <img 
                src={previewImage.url} 
                alt={previewImage.title} 
                className="max-w-full max-h-[50vh] object-contain rounded-xl shadow-md border border-slate-200/50"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900 text-center border-t border-slate-100 dark:border-slate-800 flex justify-center items-center gap-4">
              <a 
                href={previewImage.url} 
                download={previewImage.title.replace(/\s+/g, '_') + '.png'}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold transition-all"
              >
                📥 Descargar Imagen
              </a>
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium transition-all"
                onClick={() => setPreviewImage(null)}
              >
                Cerrar Vista Previa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
