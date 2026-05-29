import { 
  Building2, 
  MapPin, 
  ChevronRight, 
  ShieldAlert, 
  ShieldCheck,
  UserRound, 
  ClipboardCheck, 
  Zap, 
  FileCheck, 
  X,
  Factory,
  Globe,
  Scale,
  Radar,
  Activity,
  FileText,
  TrendingDown,
  History,
  AlertTriangle,
  CheckCircle2,
  Clock
} from "lucide-react";
import { motion } from "motion/react";
import { useAppStore } from "../../hooks/useAppStore";
import { db } from "../../lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Badge } from "../ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { format, differenceInDays, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';

const moduleConfig: Record<string, { desc: string; color: string }> = {
  process: { desc: "Gestión de procesos internos y diagramas de flujo.", color: "bg-blue-600 shadow-blue-200" },
  localization: { desc: "Ubicación geográfica detallada del centro de trabajo.", color: "bg-emerald-600 shadow-emerald-200" },
  layout: { desc: "Planos de infraestructura y distribución de planta.", color: "bg-indigo-600 shadow-indigo-200" },
  legal: { desc: "Evaluación del marco legal y cumplimiento normativo inicial.", color: "bg-amber-600 shadow-amber-200" },
  legal_matrix: { desc: "Matriz detallada de normativa nacional e internacional aplicable.", color: "bg-slate-700 shadow-slate-200" },
  risks: { desc: "Identificación y evaluación de riesgos por puesto.", color: "bg-red-600 shadow-red-200" },
  surrounding_hazards: { desc: "Análisis de amenazas en el entorno industrial.", color: "bg-orange-600 shadow-orange-200" },
  accident_analysis: { desc: "Registro e historial de accidentabilidad laboral.", color: "bg-rose-600 shadow-rose-200" },
  compliance: { desc: "Programa de seguridad y salud en el trabajo.", color: "bg-teal-600 shadow-teal-200" },
  reports: { desc: "Generación de informes ejecutivos y exportación PDF.", color: "bg-cyan-600 shadow-cyan-200" },
};

export function Dashboard() {
  const { currentCompanyId, setCurrentCompanyId, setActiveTab } = useAppStore();

  const company = useLiveQuery(
    () => currentCompanyId ? db.companies.get(currentCompanyId) : null,
    [currentCompanyId]
  );

  const findings = useLiveQuery(
    () => currentCompanyId ? db.findings.where('companyId').equals(currentCompanyId).toArray() : [],
    [currentCompanyId]
  );

  const accidentEvents = useLiveQuery(
    () => currentCompanyId ? db.accidentEvents.where('companyId').equals(currentCompanyId).toArray() : [],
    [currentCompanyId]
  );

  if (!currentCompanyId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-6">
        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 shadow-inner">
          <Building2 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[#1e293b] tracking-tight">Selecciona una Empresa</h2>
          <p className="text-slate-500 max-w-sm mx-auto text-sm">
            Accede al catálogo de empresas para comenzar la gestión de cumplimiento normativo.
          </p>
        </div>
        <Button 
          className="bg-[#1e293b] hover:bg-[#0f172a] rounded-xl px-6 h-10"
          onClick={() => setActiveTab("companies")}
        >
          Ir a Empresas
        </Button>
      </div>
    );
  }

  // Dashboard Stats
  const complianceScore = 72;
  const personnel = company?.workerCount || 0;
  const superficie = company?.totalBuiltArea || 0;
  const criticalFindings = findings?.filter(f => f.severity === 'high' || f.severity === 'critical').length || 0;
  const pendingFindings = findings?.filter(f => f.status === 'pending').length || 0;
  const inProgressFindings = findings?.filter(f => f.status === 'in_progress').length || 0;
  const completedFindings = findings?.filter(f => f.status === 'completed').length || 0;

  // Accident Free Days Calculation
  const lastAccident = accidentEvents
    ?.filter(e => e.type === 'accident')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  
  const referenceDate = lastAccident ? new Date(lastAccident.date) : (company?.createdAt || new Date());
  const daysWithoutAccidents = Math.max(0, differenceInDays(new Date(), referenceDate));

  // Chart Data: Findings Closure History (Last 6 months)
  const last6Months = eachMonthOfInterval({
    start: subMonths(new Date(), 5),
    end: new Date()
  });

  const chartData = last6Months.map(month => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    const count = findings?.filter(f => 
      f.status === 'completed' && 
      f.closedAt && 
      isWithinInterval(new Date(f.closedAt), { start: monthStart, end: monthEnd })
    ).length || 0;

    return {
      name: format(month, 'MMM', { locale: es }).toUpperCase(),
      cierres: count
    };
  });

  const modules = [
    { id: "process", label: "Procesos", icon: Factory },
    { id: "localization", label: "Localización", icon: Globe },
    { id: "layout", label: "Planos/Infraestructura", icon: MapPin },
    { id: "legal", label: "Marco Legal", icon: ShieldCheck },
    { id: "legal_matrix", label: "Normativa Aplicable", icon: Scale },
    { id: "risks", label: "Matriz Riesgos", icon: ShieldAlert },
    { id: "surrounding_hazards", label: "Peligros Circundantes", icon: Radar },
    { id: "accident_analysis", label: "Accidentalidad", icon: Activity },
    { id: "compliance", label: "Programa de Seg.", icon: ClipboardCheck },
    { id: "reports", label: "Reportes", icon: FileText },
  ];

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'very_high': return <Badge className="bg-red-600 hover:bg-red-700">Muy Alta</Badge>;
      case 'high': return <Badge className="bg-orange-500 hover:bg-orange-600">Alta</Badge>;
      case 'medium': return <Badge className="bg-blue-500 hover:bg-blue-600">Media</Badge>;
      case 'low': return <Badge className="bg-slate-400 hover:bg-slate-500">Baja</Badge>;
      default: return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-emerald-500 hover:bg-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Cerrado</Badge>;
      case 'in_progress': return <Badge className="bg-amber-500 hover:bg-amber-600 flex items-center gap-1"><Clock className="w-3 h-3" /> En Proceso</Badge>;
      case 'pending': return <Badge className="bg-rose-500 hover:bg-rose-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Pendiente</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700 pb-12">
      {/* Top Action Bar - Compact */}
      <div className="flex items-center justify-between bg-white/50 backdrop-blur-sm -mx-4 -mt-4 px-6 py-2 border-b border-slate-100 mb-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setCurrentCompanyId(null)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-[#1e293b] tracking-tight">
              Sede: <span className="text-slate-400">{company?.rfc}</span>
            </h2>
            <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-3 py-1 rounded-lg border border-emerald-100 uppercase tracking-widest shadow-sm">Activo</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <p className="text-[11px] font-bold text-[#1e293b] leading-none">Rafael</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Consultor</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-white shadow-sm flex items-center justify-center font-bold text-slate-400 text-xs text-center">
              R
            </div>
          </div>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 relative overflow-hidden"
      >
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-10">
          <div className="flex flex-col sm:flex-row gap-8 w-full lg:w-auto">
            <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-slate-100 shrink-0">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Sede Activa</span>
                </div>
                <h1 className="text-4xl font-black text-[#1e293b] tracking-tighter leading-none mb-1">
                  {company?.name.toUpperCase()}
                </h1>
                <div className="flex items-center gap-3 text-slate-400">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold uppercase tracking-widest leading-none">{company?.address}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-12 items-center justify-center lg:justify-end w-full lg:w-auto">
            <div className="text-center lg:text-right group">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-70 flex items-center justify-center lg:justify-end gap-2 group-hover:text-emerald-500 transition-colors">
                <TrendingDown className="w-3 h-3" /> Siniestralidad
              </p>
              <div className="flex flex-col items-center lg:items-end">
                <div className="flex items-baseline gap-1 justify-center lg:justify-end">
                  <span className="text-3xl font-black text-emerald-600 tracking-tighter">{daysWithoutAccidents}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Días sin accidentes</span>
                </div>
                {lastAccident && (
                  <div className="flex flex-col items-center lg:items-end mt-1 text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                    <p>Último: {format(new Date(lastAccident.date), 'dd MMM yyyy', { locale: es })}</p>
                    <p className="text-emerald-500">Área: {lastAccident.department || 'No especificada'}</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="text-center lg:text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-70">Cumplimiento</p>
              <div className="flex items-center justify-center lg:justify-end gap-3">
                <span className="text-2xl font-black text-orange-500 tracking-tighter">{complianceScore}%</span>
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 shadow-sm">
                  <Zap className="w-4 h-4 fill-current transition-transform hover:scale-125" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute -right-12 -top-12 w-32 h-32 opacity-[0.02] pointer-events-none rotate-12">
          <Building2 className="w-full h-full" />
        </div>
      </motion.div>

      {/* Quick Access Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Puntos Críticos", value: criticalFindings, sub: "Prioridad Muy Alta", icon: ShieldAlert, color: "text-red-500", bg: "bg-red-50/50" },
          { label: "Estatus Hallazgos", value: `${completedFindings}/${findings?.length || 0}`, sub: `${pendingFindings} Pendientes`, icon: ClipboardCheck, color: "text-blue-500", bg: "bg-blue-50/50" },
          { label: "Historial Accidentes", value: daysWithoutAccidents, sub: lastAccident ? `Área: ${lastAccident.department || 'N/A'} - ${format(new Date(lastAccident.date), 'dd/MM/yy')}` : "Sin registros", icon: Activity, color: "text-emerald-500", bg: "bg-emerald-50/50" },
          { label: "Vigencia Documental", value: "92%", sub: "Próximo vencimiento Ene 25", icon: FileCheck, color: "text-slate-600", bg: "bg-slate-50/50" },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 group hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-between">
              <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center shadow-sm`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <span className="bg-slate-50 text-slate-400 text-[10px] font-black px-3 py-1.5 rounded-lg border border-slate-100 uppercase tracking-wider">Métrica</span>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-80">{stat.label}</p>
              <h3 className="text-xl font-black text-[#1e293b] tracking-tighter leading-none">{stat.value}</h3>
              <p className="text-[11px] font-bold text-slate-400 leading-tight">{stat.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Findings and closure history Chart */}
        <Card className="xl:col-span-2 border-slate-100 shadow-sm rounded-[2rem] overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black text-[#1e293b] uppercase tracking-widest flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-blue-500" />
                  Historial de Cierre de Hallazgos
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase mt-1">Últimos 6 meses de gestión correctiva</CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200">Total: {completedFindings}</Badge>
            </div>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCierres" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '11px',
                    fontWeight: 700
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="cierres" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorCierres)" 
                  animationBegin={200}
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Priority and Status Management List */}
        <Card className="border-slate-100 shadow-sm rounded-[2rem]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black text-[#1e293b] uppercase tracking-widest flex items-center gap-2">
              <History className="w-4 h-4 text-orange-500" />
              Prioridad y Estatus
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase mt-1">Últimos hallazgos identificados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {findings?.slice(0, 5).map((f, idx) => (
              <div key={idx} className="flex flex-col gap-2 p-3 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-blue-100 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider truncate max-w-[150px]">{f.title}</span>
                  {getStatusBadge(f.status)}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <p className="text-[10px] font-bold text-slate-500 line-clamp-1">{f.description}</p>
                    <span className="text-[9px] font-medium text-slate-400 italic">Resp: {f.responsible}</span>
                  </div>
                  {getPriorityBadge(f.priority)}
                </div>
              </div>
            ))}
            {(!findings || findings.length === 0) && (
              <div className="h-40 flex flex-col items-center justify-center text-slate-300">
                <ShieldCheck className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest">Sin hallazgos pendientes</p>
              </div>
            )}
            <Button 
                variant="ghost" 
                className="w-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 h-8"
                onClick={() => setActiveTab("compliance")}
            >
                Ver Programa de Seguridad <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Modules Area */}
      <div className="space-y-8 pt-6">
        <div className="flex items-center gap-4">
          <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] ml-1">Módulos del Sistema</h2>
          <div className="flex-1 h-px bg-slate-100" />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {modules.map((item, i) => {
            const config = moduleConfig[item.id] || { desc: "Accede al módulo de gestión.", color: "bg-slate-600" };
            return (
              <motion.div
                key={i}
                whileHover={{ y: -4 }}
                onClick={() => setActiveTab(item.id)}
                className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm cursor-pointer group flex flex-col gap-4 transition-all hover:shadow-xl hover:border-blue-100"
              >
                <div className={`w-10 h-10 ${config.color} rounded-xl flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform`}>
                  <item.icon className="w-4 h-4" />
                </div>
                <div className="space-y-1 flex-1">
                  <h3 className="text-xs font-black text-[#1e293b] tracking-tighter leading-tight group-hover:text-blue-600 transition-colors">
                    {item.label.toUpperCase()}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold leading-relaxed line-clamp-2">
                    {config.desc}
                  </p>
                </div>
                <div className="pt-1 flex items-center text-blue-600 font-black text-[9px] tracking-widest gap-2 opacity-0 group-hover:opacity-100 transition-all uppercase">
                  Abrir Módulo <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
