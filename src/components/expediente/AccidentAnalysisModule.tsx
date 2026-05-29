import React, { useState, useRef, useEffect } from "react";
import { useAppStore } from "../../hooks/useAppStore";
import { db, AccidentEvent, AccidentRecord } from "../../lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { 
  Activity, 
  Plus, 
  Trash2, 
  TrendingUp, 
  AlertCircle, 
  Calendar, 
  Upload, 
  Download, 
  FileSpreadsheet, 
  Clock,
  Briefcase,
  AlertTriangle,
  Stethoscope,
  Plane,
  ShieldCheck,
  User,
  ExternalLink,
  Info,
  Pencil
} from "lucide-react";
import { toast } from "sonner";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  Legend,
  Cell
} from 'recharts';
import * as XLSX from 'xlsx';
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

const ACCIDENT_TYPES = [
  { value: 'accident', label: 'Accidente de Trabajo', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
  { value: 'illness', label: 'Enfermedad General', icon: Stethoscope, color: 'text-blue-600', bg: 'bg-blue-50' },
  { value: 'near_miss', label: 'Casi Accidente (Incidente)', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
  { value: 'professional_illness', label: 'Enfermedad Profesional', icon: Briefcase, color: 'text-purple-600', bg: 'bg-purple-50' },
  { value: 'work_risk', label: 'Riesgo de Trabajo', icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { value: 'commuting_risk', label: 'Riesgo de Trayecto', icon: Plane, color: 'text-indigo-600', bg: 'bg-indigo-50' },
];

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export function AccidentAnalysisModule() {
  const { currentCompanyId } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const company = useLiveQuery(
    () => currentCompanyId ? db.companies.get(currentCompanyId) : Promise.resolve(undefined),
    [currentCompanyId]
  );

  const events = useLiveQuery(
    () => {
      if (!currentCompanyId) return [];
      return db.accidentEvents
        .where("companyId")
        .equals(currentCompanyId)
        .reverse()
        .sortBy("date");
    },
    [currentCompanyId]
  );

  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editingEventData, setEditingEventData] = useState<Partial<AccidentEvent>>({});
  const [editingHours, setEditingHours] = useState(false);
  const [multiplier, setMultiplier] = useState(1000000); // STPS Multiplier
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [totalHours, setTotalHours] = useState(200000);
  const [avgWorkersExp, setAvgWorkersExp] = useState(100); // N in IMSS formula

  // IMSS formula constants
  const V_CONSTANT = 28;
  const F_FACTOR = 0.5;
  const M_MINIMUM = 0.0050;

  // Manual overrides for indices
  const [manualAccidents, setManualAccidents] = useState<number | null>(null);
  const [manualDaysLost, setManualDaysLost] = useState<number | null>(null);
  const [manualPrima, setManualPrima] = useState<number | null>(null);

  const [newEvent, setNewEvent] = useState<Partial<AccidentEvent>>({
    date: new Date(),
    type: 'accident',
    daysLost: 0,
    permanentDisabilityPercentage: 0,
    isDeath: false,
    description: "",
    treatment: "",
    totalCost: 0,
    workerName: "",
    department: ""
  });

  useEffect(() => {
    setTotalHours(company?.totalHoursWorked ?? 200000);
    setAvgWorkersExp(company?.avgWorkersExp ?? 100);
  }, [company]);

  const handleAddEvent = async () => {
    if (!currentCompanyId) return;
    
    // Validate date
    const eventDate = newEvent.date instanceof Date && !isNaN(newEvent.date.getTime()) 
      ? newEvent.date 
      : new Date();

    try {
      const eventData: AccidentEvent = {
        companyId: currentCompanyId,
        date: eventDate,
        type: (newEvent.type as any) || 'accident',
        daysLost: Number(newEvent.daysLost) || 0,
        permanentDisabilityPercentage: Number(newEvent.permanentDisabilityPercentage) || 0,
        isDeath: !!newEvent.isDeath,
        description: newEvent.description || "",
        treatment: newEvent.treatment || "",
        totalCost: Number(newEvent.totalCost) || 0,
        workerName: newEvent.workerName || "",
        department: newEvent.department || "",
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.accidentEvents.add(eventData);

      // Update company last accident date if it's an accident or risk
      if (['accident', 'work_risk', 'professional_illness'].includes(eventData.type)) {
        const lastDate = company?.lastAccidentDate ? new Date(company.lastAccidentDate) : null;
        if (!lastDate || eventDate > lastDate) {
          await db.companies.update(currentCompanyId, { 
            lastAccidentDate: eventDate,
            updatedAt: new Date()
          });
        }
      }

      setIsAddingEvent(false);
      setNewEvent({
        date: new Date(),
        type: 'accident',
        daysLost: 0,
        description: "",
        treatment: "",
        totalCost: 0,
        workerName: "",
        department: ""
      });
      toast.success("Evento registrado y guardado");
    } catch (e) {
      console.error("Error saving accident event:", e);
      toast.error("Error al guardar el registro. Verifica los campos.");
    }
  };

  const handleUpdateEvent = async () => {
    if (!editingEventId || !currentCompanyId) return;
    try {
      await db.accidentEvents.update(editingEventId, {
        ...editingEventData,
        date: editingEventData.date ? new Date(editingEventData.date) : undefined,
        updatedAt: new Date()
      });
      
      // Recalculate last accident date
      const allEventsForCompany = await db.accidentEvents.where("companyId").equals(currentCompanyId).toArray();
      const accidents = allEventsForCompany.filter(e => ['accident', 'work_risk'].includes(e.type));
      const latestDate = accidents.reduce((latest, current) => {
        const curDate = new Date(current.date);
        return !latest || curDate > latest ? curDate : latest;
      }, null as Date | null);
      
      await db.companies.update(currentCompanyId, { 
        lastAccidentDate: latestDate || undefined,
        updatedAt: new Date()
      });

      setEditingEventId(null);
      toast.success("Registro actualizado");
    } catch (e) {
      toast.error("Error al actualizar");
    }
  };

  const handleDeleteEvent = async (id: number) => {
    try {
      await db.accidentEvents.delete(id);
      toast.success("Registro eliminado");
    } catch (e) {
      toast.error("Error al eliminar");
    }
  };

  const handleUpdateHours = async () => {
    if (!currentCompanyId) return;
    try {
      await db.companies.update(currentCompanyId, {
        totalHoursWorked: Number(totalHours),
        avgWorkersExp: Number(avgWorkersExp),
        updatedAt: new Date()
      });
      setEditingHours(false);
      toast.success("Parámetros actualizados");
    } catch (e) {
      toast.error("Error al actualizar");
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentCompanyId) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        let importedCount = 0;
        for (const row of data) {
          // Try to map columns: Fecha, Tipo, Días, Descripción, Trabajador, Departamento
          const date = row.Fecha ? new Date(row.Fecha) : new Date();
          const typeMap: Record<string, AccidentEvent['type']> = {
            'Accidente': 'accident',
            'Enfermedad': 'illness',
            'Incidente': 'near_miss',
            'Casi Accidente': 'near_miss',
            'Profesional': 'professional_illness',
            'Riesgo Trabajo': 'work_risk',
            'Trayecto': 'commuting_risk'
          };

          await db.accidentEvents.add({
            companyId: currentCompanyId,
            date: date,
            type: typeMap[row.Tipo] || 'accident',
            daysLost: Number(row.Días) || 0,
            description: row.Descripción || "",
            workerName: row.Trabajador || "",
            department: row.Departamento || "",
            createdAt: new Date(),
            updatedAt: new Date()
          });
          importedCount++;
        }

        toast.success(`${importedCount} registros importados desde Excel`);
      } catch (err) {
        toast.error("Error al procesar el archivo Excel. Asegúrate de que tenga las columnas correctas (Fecha, Tipo, Días, Descripción, Trabajador, Departamento).");
      }
    };
    reader.readAsBinaryString(file);
    if (e.target) e.target.value = "";
  };

  if (!currentCompanyId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
        <Activity className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-lg font-medium">Selecciona una empresa para gestionar su registro de accidentabilidad</p>
      </div>
    );
  }

  // Calculations
  const allEvents = events || [];
  const yearEvents = allEvents.filter(e => new Date(e.date).getFullYear() === selectedYear);

  // Source values
  const autoAccidents = yearEvents.filter(e => ['accident', 'work_risk'].includes(e.type)).length;
  const autoDaysLost = yearEvents.reduce((acc, curr) => acc + Number(curr.daysLost || 0), 0);
  
  // IMSS Specific Variables
  const S_DaysSubsidiados = autoDaysLost;
  const I_DisabilitiesSum = yearEvents.reduce((acc, curr) => acc + (Number(curr.permanentDisabilityPercentage || 0) / 100), 0);
  const D_Deaths = yearEvents.filter(e => e.isDeath).length;
  const N_AvgWorkers = avgWorkersExp || 100;

  // Prima Formula: Prima = [ (S/365) + V * (I + D) ] * (F/N) + M
  const calculatedPrima = ( (S_DaysSubsidiados / 365) + V_CONSTANT * (I_DisabilitiesSum + D_Deaths) ) * (F_FACTOR / N_AvgWorkers) + M_MINIMUM;
  const effectivePrima = manualPrima !== null ? manualPrima : calculatedPrima;

  // Effective values (auto or manual)
  const effectiveAccidents = manualAccidents !== null ? manualAccidents : autoAccidents;
  const effectiveDaysLost = manualDaysLost !== null ? manualDaysLost : autoDaysLost;
  
  const totalIncidents = yearEvents.filter(e => e.type === 'near_miss').length;
  const totalIllness = yearEvents.filter(e => ['illness', 'professional_illness'].includes(e.type)).length;
  const totalCostYear = yearEvents.reduce((acc, curr) => acc + Number(curr.totalCost || 0), 0);
  const currentHours = company?.totalHoursWorked || 200000;

  // IF: (Accidentes * Multiplier) / Horas hombre
  const frequencyIndex = currentHours > 0 ? (effectiveAccidents * multiplier) / currentHours : 0;
  // IG: (Días perdidos * 1,000) / Horas hombre
  const severityIndex = currentHours > 0 ? (effectiveDaysLost * 1000) / currentHours : 0;

  // Days since last accident
  const lastAccDate = company?.lastAccidentDate ? new Date(company.lastAccidentDate) : null;
  const daysSinceLast = lastAccDate ? Math.max(0, differenceInDays(new Date(), lastAccDate)) : "---";

  // Chart Data
  const chartData = MONTHS.map((name, index) => {
    const monthEvents = yearEvents.filter(e => new Date(e.date).getMonth() === index);
    return {
      name: name.substring(0, 3),
      Accidentes: monthEvents.filter(e => ['accident', 'work_risk'].includes(e.type)).length,
      Incidentes: monthEvents.filter(e => e.type === 'near_miss').length,
      DíasPerdidos: monthEvents.reduce((acc, curr) => acc + Number(curr.daysLost || 0), 0),
      Salud: monthEvents.filter(e => ['illness', 'professional_illness'].includes(e.type)).length
    };
  });

  const typeDistribution = ACCIDENT_TYPES.map(t => ({
    name: t.label,
    count: yearEvents.filter(e => e.type === t.value).length,
    color: t.color
  })).filter(t => t.count > 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* Header & Excel Tool */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Registro de Accidentabilidad</h1>
          <p className="text-slate-500">Gestión de riesgos, accidentes y enfermedades ({selectedYear})</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 mr-2 bg-white border border-slate-200 rounded-lg p-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0" 
              onClick={() => setSelectedYear(prev => prev - 1)}
            >
              <Calendar className="w-2.5 h-2.5" />
            </Button>
            <span className="text-[10px] font-bold w-10 text-center">{selectedYear}</span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0" 
              onClick={() => setSelectedYear(prev => prev + 1)}
            >
              <Plus className="w-2.5 h-2.5" />
            </Button>
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xlsx, .xls"
            onChange={handleExcelUpload}
          />
        </div>
      </header>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {/* Days Since Last Accident - The "Chronometer" */}
        <Card className="bg-slate-900 text-white flex flex-col justify-center items-center p-6 border-none shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Clock className="w-8 h-8" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1 z-10">Días sin accidentes</p>
          <p className="text-4xl font-black mb-1 z-10">{daysSinceLast}</p>
          <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-medium z-10">
            <Calendar className="w-3 h-3" />
            Último: {lastAccDate ? format(lastAccDate, "dd/MM/yyyy") : "Sin registro"}
          </div>
        </Card>

        <Card className="bg-white p-6 shadow-sm border-slate-100 flex flex-col justify-center items-center group relative">
          <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">Índice Frecuencia (IF)</p>
          <p className="text-2xl font-extrabold text-blue-600">{frequencyIndex.toFixed(2)}</p>
          <p className="text-[9px] text-slate-400 mt-2 text-center uppercase tracking-tighter">Accidentes x 1M / HHT</p>
          {manualAccidents !== null && (
            <div className="absolute top-2 right-2 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase">Manual</div>
          )}
        </Card>

        <Card className="bg-white p-6 shadow-sm border-slate-100 flex flex-col justify-center items-center group relative">
          <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">Índice Severidad (IG)</p>
          <p className="text-2xl font-extrabold text-purple-600">{severityIndex.toFixed(2)}</p>
          <p className="text-[9px] text-slate-400 mt-2 text-center uppercase tracking-tighter">Días Perdidos x 1K / HHT</p>
          {manualDaysLost !== null && (
            <div className="absolute top-2 right-2 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase">Manual</div>
          )}
        </Card>

        <Card className="bg-emerald-600 text-white p-6 shadow-sm border-none flex flex-col justify-center items-center group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <p className="text-[10px] font-bold uppercase text-emerald-100 mb-1 z-10">Prima de Riesgo (IMSS)</p>
          <p className="text-2xl font-black z-10">{(effectivePrima * 100).toFixed(4)}%</p>
          <p className="text-[8px] text-emerald-100 mt-2 text-center uppercase tracking-tighter z-10">Cálculo RACERF Art. 32</p>
          {manualPrima !== null && (
            <div className="absolute top-2 right-2 bg-white/20 text-white px-1.5 py-0.5 rounded text-[8px] font-bold uppercase">Manual</div>
          )}
        </Card>

        <Card className="bg-white p-6 shadow-sm border-slate-100 flex flex-col justify-center items-center">
          <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">Costo Total Incidencias</p>
          <p className="text-2xl font-extrabold text-red-600">${totalCostYear.toLocaleString()}</p>
          <p className="text-[9px] text-slate-400 mt-2 text-center uppercase tracking-tighter">Impacto económico anual</p>
        </Card>

        <Card className="bg-white p-6 shadow-sm border-slate-100 flex flex-col justify-center items-center">
          <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">Total Días Perdidos</p>
          <p className="text-2xl font-extrabold text-slate-900">{effectiveDaysLost}</p>
          <p className="text-[9px] text-slate-400 mt-2 text-center uppercase tracking-tighter">Acumulado del año</p>
        </Card>

        <Card className="bg-white p-6 shadow-sm border-slate-100 flex flex-col justify-center items-center">
          <div className="flex items-center justify-between w-full mb-1">
            <p className="text-[10px] font-bold uppercase text-slate-500">Horas Hombre</p>
            <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => setEditingHours(!editingHours)}>
              <TrendingUp className="w-3 h-3" />
            </Button>
          </div>
          {editingHours ? (
            <div className="flex flex-col gap-3 w-full animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> Horas Hombre (HHT)
                  </Label>
                  <Input 
                    type="number" 
                    value={totalHours} 
                    className="h-8 text-xs text-center font-bold border-blue-100 bg-blue-50/30" 
                    onChange={(e) => setTotalHours(parseInt(e.target.value) || 0)} 
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                    <User className="w-2.5 h-2.5" /> Trab. Expuestos (N)
                  </Label>
                  <Input 
                    type="number" 
                    value={avgWorkersExp} 
                    className="h-8 text-xs text-center font-bold border-blue-100 bg-blue-50/30" 
                    onChange={(e) => setAvgWorkersExp(parseInt(e.target.value) || 0)} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Button 
                  size="sm" 
                  className="h-8 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 shadow-sm" 
                  onClick={handleUpdateHours}
                >
                  Guardar Cambios
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline"
                    size="sm" 
                    className="h-8 text-[10px] border-slate-200 hover:bg-slate-50" 
                    onClick={() => {
                      // Revert to DB values
                      setTotalHours(company?.totalHoursWorked ?? 200000);
                      setAvgWorkersExp(company?.avgWorkersExp ?? 100);
                      // Clear manual overrides as well
                      setManualAccidents(null);
                      setManualDaysLost(null);
                      setManualPrima(null);
                      toast.info("Valores revertidos a los guardados en sistema");
                    }}
                  >
                    Deshacer
                  </Button>
                  <Button 
                    variant="outline"
                    size="sm" 
                    className="h-8 text-[10px] text-red-500 border-red-100 hover:bg-red-50" 
                    onClick={() => {
                      // Reset to industry defaults
                      setTotalHours(200000);
                      setAvgWorkersExp(100);
                      setManualAccidents(null);
                      setManualDaysLost(null);
                      setManualPrima(null);
                      toast.warning("Valores restablecidos a estándar (200k HHT / 100 N)");
                    }}
                  >
                    Restablecer Fábrica
                  </Button>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-[11px] text-slate-400 hover:text-slate-600" 
                  onClick={() => setEditingHours(false)}
                >
                  Cerrar Edición
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-2xl font-extrabold text-slate-900">{company?.totalHoursWorked?.toLocaleString() || "0"}</p>
          )}
          <p className="text-[9px] text-slate-400 mt-2 text-center uppercase tracking-tighter">Exposición al riesgo</p>
        </Card>
      </div>

      {/* Calculation Breakdown Section */}
      <Card className="bg-blue-50 border-blue-100 shadow-sm">
        <CardHeader className="py-3 border-b border-blue-100 bg-blue-50/50">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-800">
              <Activity className="w-3.5 h-3.5" />
              Metodología e Inteligencia de Cálculo ({selectedYear})
            </CardTitle>
            <div className="flex items-center gap-2 text-[10px] text-blue-600 font-bold bg-white px-2 py-1 rounded-full border border-blue-200">
              <Info className="w-3 h-3" />
              REFERENCIA: ESTÁNDAR OIT / IMSS
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Variables and Source */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold uppercase text-blue-600 tracking-wider">Configuración de Parámetros</h4>
                <div className="flex bg-white border rounded-md p-1 gap-1">
                  <Button 
                    variant={multiplier === 1000000 ? "default" : "ghost"} 
                    size="xs" 
                    className="h-6 text-[10px] px-2"
                    onClick={() => setMultiplier(1000000)}
                  >
                    1M (ANSI)
                  </Button>
                  <Button 
                    variant={multiplier === 200000 ? "default" : "ghost"} 
                    size="xs" 
                    className="h-6 text-[10px] px-2"
                    onClick={() => setMultiplier(200000)}
                  >
                    200K (OSHA)
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-lg border border-blue-100 space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Valores Base (STPS)</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span>Horas Hombre (HHT)</span>
                      <span className="font-bold">{currentHours.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span>Accidentes (N)</span>
                      <div className="flex items-center gap-1">
                        <Input 
                          type="number" 
                          className="w-14 h-6 text-center text-[10px]" 
                          value={effectiveAccidents}
                          onChange={(e) => setManualAccidents(parseInt(e.target.value) || 0)}
                        />
                        {manualAccidents !== null && (
                          <Button variant="ghost" size="icon" className="h-4 w-4 text-red-500" onClick={() => setManualAccidents(null)}>
                            <Plus className="w-3 h-3 rotate-45" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span>Días Perdidos (D)</span>
                      <div className="flex items-center gap-1">
                        <Input 
                          type="number" 
                          className="w-14 h-6 text-center text-[10px]" 
                          value={effectiveDaysLost}
                          onChange={(e) => setManualDaysLost(parseInt(e.target.value) || 0)}
                        />
                        {manualDaysLost !== null && (
                          <Button variant="ghost" size="icon" className="h-4 w-4 text-red-500" onClick={() => setManualDaysLost(null)}>
                            <Plus className="w-3 h-3 rotate-45" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-blue-100 space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Variables Prima (IMSS)</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span>N (Trab. Prom.)</span>
                      <Input 
                        type="number" 
                        className="w-16 h-6 text-center text-[10px]" 
                        value={avgWorkersExp}
                        onChange={(e) => setAvgWorkersExp(parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span>I (Incap. Perm.)</span>
                      <span className="font-bold">{(I_DisabilitiesSum * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span>D (Defunciones)</span>
                      <span className="font-bold">{D_Deaths}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 text-slate-200 p-4 rounded-xl space-y-3 shadow-inner">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Justificación STPS (NOM-030)
                  </p>
                  <p className="text-[9px] leading-relaxed italic opacity-80">
                    "Los Índices de Frecuencia (IF) y Gravedad (IG) se calculan como parte del diagnóstico de seguridad y salud, dando cumplimiento al Artículo 7, fracciones 7.1 y 7.2 de la Norma Oficial Mexicana NOM-030-STPS-2009. La constante ({multiplier.toLocaleString()}) se justifica bajo los criterios de homogeneidad estadística para la comparación de tasas de accidentabilidad."
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Justificación IMSS (RACERF)
                  </p>
                  <p className="text-[9px] leading-relaxed italic opacity-80">
                    "El cálculo de la siniestralidad se fundamenta en el Artículo 32 del Reglamento de la Ley del Seguro Social en Materia de Afiliación (RACERF). Establece literalmente la ecuación matemática aplicable para determinar la Prima del Seguro de Riesgos de Trabajo anual."
                  </p>
                </div>
              </div>
            </div>

            {/* Formulas Breakdown */}
            <div className="space-y-4">
              <h4 className="text-[11px] font-bold uppercase text-blue-600 tracking-wider">Memorias de Cálculo</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-lg border border-blue-100 flex flex-col items-center">
                  <p className="text-[9px] font-bold text-slate-400 mb-2">IF (STPS/ANSI)</p>
                  <div className="text-[10px] font-mono flex flex-col items-center">
                    <span>({effectiveAccidents} × {multiplier.toLocaleString()})</span>
                    <div className="h-px w-full bg-slate-200 my-1" />
                    <span>{currentHours.toLocaleString()}</span>
                  </div>
                  <p className="text-lg font-black text-blue-600 mt-2">{frequencyIndex.toFixed(2)}</p>
                </div>

                <div className="bg-white p-4 rounded-lg border border-blue-100 flex flex-col items-center">
                  <p className="text-[9px] font-bold text-slate-400 mb-2">IG (STPS/ANSI)</p>
                  <div className="text-[10px] font-mono flex flex-col items-center">
                    <span>({effectiveDaysLost} × 1,000)</span>
                    <div className="h-px w-full bg-slate-200 my-1" />
                    <span>{currentHours.toLocaleString()}</span>
                  </div>
                  <p className="text-lg font-black text-purple-600 mt-2">{severityIndex.toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-blue-100 relative group">
                <p className="text-[9px] font-bold text-slate-400 mb-3 text-center uppercase tracking-widest">Protocolo Prima de Riesgo IMSS</p>
                <div className="flex flex-col items-center gap-2">
                  <div className="text-[11px] font-mono bg-slate-50 px-4 py-2 rounded border border-dashed border-slate-200">
                    Prima = [ (S/365) + V × (I + D) ] × (F/N) + M
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[8px] font-bold text-slate-500 w-full">
                    <div className="bg-slate-50 p-1 rounded text-center">S: {S_DaysSubsidiados}</div>
                    <div className="bg-slate-50 p-1 rounded text-center">I: {I_DisabilitiesSum.toFixed(2)}</div>
                    <div className="bg-slate-50 p-1 rounded text-center">V: {V_CONSTANT}</div>
                    <div className="bg-slate-50 p-1 rounded text-center">F: {F_FACTOR}</div>
                  </div>
                  <div className="text-2xl font-black text-emerald-600 mt-1">
                    {(effectivePrima * 100).toFixed(4)}%
                  </div>
                  <p className="text-[8px] text-slate-400 text-center">
                    Cálculo basado en Art. 32 RACERF. Valores obligatorios para declaración anual ante el IMSS.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-blue-100 flex flex-col md:flex-row gap-4 items-center justify-between text-[10px]">
            <div className="flex items-center gap-2 text-slate-400">
               <ShieldCheck className="w-3 h-3" />
               Cálculos basados en estándares STPS y Guías del IMSS para el cálculo del Índice de Siniestralidad.
            </div>
            <div className="flex gap-4">
              <a href="https://www.imss.gob.mx/patrones/siniestralidad" target="_blank" className="text-blue-600 hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Guía IMSS
              </a>
              <a href="https://www.ilo.org/es" target="_blank" className="text-blue-600 hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Portal OIT
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Forms & Table */}
        <div className="lg:col-span-2 space-y-6">
          {isAddingEvent && (
            <Card className="border-blue-200 bg-blue-50/20">
              <CardHeader className="py-4">
                <CardTitle className="text-sm">Nuevo Registro de Salud o Seguridad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Fecha del Evento</Label>
                    <Input 
                      type="date" 
                      value={newEvent.date ? format(newEvent.date, "yyyy-MM-dd") : ""} 
                      onChange={(e) => setNewEvent({...newEvent, date: new Date(e.target.value)})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Tipo de Registro</Label>
                    <select 
                      className="w-full h-10 px-3 py-2 text-sm border rounded-md bg-white"
                      value={newEvent.type}
                      onChange={(e) => setNewEvent({...newEvent, type: e.target.value as AccidentEvent['type']})}
                    >
                      {ACCIDENT_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-blue-600 font-bold">Días Perdidos (S)</Label>
                    <Input 
                      type="number" 
                      min="0"
                      value={newEvent.daysLost}
                      onChange={(e) => setNewEvent({...newEvent, daysLost: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-emerald-600 font-bold">Defunción</Label>
                      <input 
                        type="checkbox" 
                        checked={newEvent.isDeath} 
                        onChange={(e) => setNewEvent({...newEvent, isDeath: e.target.checked})}
                        className="rounded border-slate-300"
                      />
                    </div>
                    <div className="pt-2">
                      <Label className="text-[10px] text-slate-500">% Incapacidad (I)</Label>
                      <Input 
                        type="number" 
                        min="0"
                        max="100"
                        value={newEvent.permanentDisabilityPercentage}
                        onChange={(e) => setNewEvent({...newEvent, permanentDisabilityPercentage: parseInt(e.target.value) || 0})}
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Trabajador (Opcional)</Label>
                    <Input 
                      placeholder="Nombre del afectado"
                      value={newEvent.workerName}
                      onChange={(e) => setNewEvent({...newEvent, workerName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Departamento / Área</Label>
                    <Input 
                      placeholder="Donde ocurrió"
                      value={newEvent.department}
                      onChange={(e) => setNewEvent({...newEvent, department: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Tratamiento / Seguimiento</Label>
                    <Input 
                      placeholder="Ej. Reposo absoluto, Terapia, etc."
                      value={newEvent.treatment}
                      onChange={(e) => setNewEvent({...newEvent, treatment: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-red-600 font-bold">Costo Total del Incidente ($)</Label>
                    <Input 
                      type="number"
                      placeholder="0.00"
                      value={newEvent.totalCost}
                      onChange={(e) => setNewEvent({...newEvent, totalCost: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Descripción de lo ocurrido</Label>
                  <Input 
                    placeholder="Detalles breves..."
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsAddingEvent(false)}>Cancelar</Button>
                  <Button size="sm" onClick={handleAddEvent} className="bg-blue-600">Guardar Registro</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Historical Log */}
          <Card>
            <CardHeader className="bg-slate-50/50 border-b py-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                  Bitácora de Eventos {selectedYear}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => fileInputRef.current?.click()} 
                    className="h-8 text-[10px] bg-white border-emerald-100 text-emerald-700 hover:bg-emerald-50 px-2 sm:px-3"
                  >
                    <FileSpreadsheet className="w-3 h-3 mr-1.5" /> 
                    <span className="hidden xs:inline">Importar Excel</span>
                    <span className="xs:hidden">Importar</span>
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => setIsAddingEvent(!isAddingEvent)} 
                    className="h-8 text-[10px] bg-blue-600 hover:bg-blue-700 shadow-sm px-2 sm:px-3"
                  >
                    <Plus className="w-3 h-3 mr-1.5" /> 
                    <span className="hidden xs:inline">Nuevo Registro</span>
                    <span className="xs:hidden">Nuevo</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Personal / Área</TableHead>
                    <TableHead>Tratamiento / Descripción</TableHead>
                    <TableHead className="text-center">Días / Costo</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allEvents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-slate-400 italic">No hay registros cargados aún.</TableCell>
                    </TableRow>
                  ) : (
                    allEvents.map((evt) => {
                      const typeInfo = ACCIDENT_TYPES.find(t => t.value === evt.type) || ACCIDENT_TYPES[0];
                      const Icon = typeInfo.icon;
                      const isEditing = editingEventId === evt.id;

                      if (isEditing) {
                        return (
                          <TableRow key={evt.id} className="bg-blue-50/30">
                            <TableCell>
                              <Input 
                                type="date" 
                                value={editingEventData.date ? format(new Date(editingEventData.date), "yyyy-MM-dd") : ""}
                                onChange={(e) => setEditingEventData({...editingEventData, date: new Date(e.target.value)})}
                                className="h-8 text-[10px]"
                              />
                            </TableCell>
                            <TableCell>
                              <select 
                                className="w-full h-8 px-2 py-1 text-[10px] border rounded-md bg-white"
                                value={editingEventData.type}
                                onChange={(e) => setEditingEventData({...editingEventData, type: e.target.value as any})}
                              >
                                {ACCIDENT_TYPES.map(t => (
                                  <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                              </select>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Input 
                                  placeholder="Trabajador"
                                  value={editingEventData.workerName}
                                  onChange={(e) => setEditingEventData({...editingEventData, workerName: e.target.value})}
                                  className="h-7 text-[10px]"
                                />
                                <Input 
                                  placeholder="Departamento"
                                  value={editingEventData.department}
                                  onChange={(e) => setEditingEventData({...editingEventData, department: e.target.value})}
                                  className="h-7 text-[10px]"
                                />
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                <label className="text-[9px] flex items-center gap-1">
                                  Def: <input type="checkbox" checked={editingEventData.isDeath} onChange={(e) => setEditingEventData({...editingEventData, isDeath: e.target.checked})} />
                                </label>
                                <Input 
                                  placeholder="% I"
                                  type="number"
                                  value={editingEventData.permanentDisabilityPercentage}
                                  onChange={(e) => setEditingEventData({...editingEventData, permanentDisabilityPercentage: Number(e.target.value)})}
                                  className="h-5 w-12 text-[9px] px-1"
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Input 
                                  placeholder="Descripción"
                                  value={editingEventData.description}
                                  onChange={(e) => setEditingEventData({...editingEventData, description: e.target.value})}
                                  className="h-7 text-[10px]"
                                />
                                <Input 
                                  placeholder="Tratamiento"
                                  value={editingEventData.treatment}
                                  onChange={(e) => setEditingEventData({...editingEventData, treatment: e.target.value})}
                                  className="h-7 text-[10px]"
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] text-slate-400">Días:</span>
                                  <Input 
                                    type="number"
                                    value={editingEventData.daysLost}
                                    onChange={(e) => setEditingEventData({...editingEventData, daysLost: Number(e.target.value)})}
                                    className="h-7 text-center text-[10px]"
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] text-slate-400">Costo:</span>
                                  <Input 
                                    type="number"
                                    value={editingEventData.totalCost}
                                    onChange={(e) => setEditingEventData({...editingEventData, totalCost: Number(e.target.value)})}
                                    className="h-7 text-center text-[10px]"
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={handleUpdateEvent}>
                                  <ShieldCheck className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400" onClick={() => setEditingEventId(null)}>
                                  <Plus className="w-4 h-4 rotate-45" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return (
                        <TableRow key={evt.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {format(new Date(evt.date), "dd MMM yyyy", { locale: es })}
                          </TableCell>
                          <TableCell>
                            <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${typeInfo.bg} ${typeInfo.color}`}>
                              <Icon className="w-3 h-3" />
                              {typeInfo.label}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <p className="font-bold">{evt.workerName || "Sin nombre"}</p>
                              <p className="text-slate-400">{evt.department || "No especificado"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-[10px] space-y-0.5 max-w-[200px]">
                              <p className="font-medium text-slate-700 line-clamp-1">{evt.description}</p>
                              <p className="text-slate-400 italic line-clamp-1">{evt.treatment || "Sin tratamiento registrado"}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-slate-600">{evt.daysLost} días</span>
                              <span className="text-[10px] text-red-600 font-medium">${(evt.totalCost || 0).toLocaleString()}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-slate-400 hover:text-blue-600 h-8 w-8"
                                onClick={() => {
                                  setEditingEventId(evt.id!);
                                  setEditingEventData(evt);
                                }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-red-400 hover:text-red-600 h-8 w-8"
                                onClick={() => evt.id && handleDeleteEvent(evt.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
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

        {/* Charts & Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Tendencia Mensual</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10} tick={{fill: '#94a3b8'}} />
                  <YAxis fontSize={10} tick={{fill: '#94a3b8'}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px'}}
                  />
                  <Bar dataKey="Accidentes" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Salud" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Incidentes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Gravedad (Días)</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10} tick={{fill: '#94a3b8'}} />
                  <YAxis fontSize={10} tick={{fill: '#94a3b8'}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px'}}
                  />
                  <Line type="monotone" dataKey="DíasPerdidos" stroke="#475569" strokeWidth={3} dot={{r: 4, fill: '#475569'}} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-slate-50 border-slate-100">
            <CardContent className="p-4 space-y-3">
              <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Distribución por Tipo</h4>
              {typeDistribution.length === 0 ? (
                <p className="text-[10px] text-slate-300 italic text-center py-4">No hay datos por distribuir</p>
              ) : (
                <div className="space-y-2">
                  {typeDistribution.map((t, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-600">{t.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${t.color.replace('text-', 'bg-')}`} 
                            style={{ width: `${(t.count / yearEvents.length) * 100}%` }}
                          />
                        </div>
                        <span className="font-bold w-4 text-right">{t.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
