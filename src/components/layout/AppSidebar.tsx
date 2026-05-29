import { cn } from "../../lib/utils";
import { 
  LayoutDashboard, 
  Building2, 
  ClipboardCheck, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  Settings,
  Factory,
  Map,
  Globe,
  MapPin,
  Menu,
  X,
  ChevronRight,
  LogOut,
  Scale,
  Radar,
  Activity,
  History
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";

import { useAppStore } from "../../hooks/useAppStore";

import { auth } from '../../lib/firebase';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}


const navItems = [
  { id: "companies", label: "Empresas", icon: Building2 },
  { id: "process", label: "Procesos", icon: Factory },
  { id: "localization", label: "Localización", icon: Globe },
  { id: "layout", label: "Planos/Infraestructura", icon: MapPin },
  { id: "legal", label: "Marco Legal", icon: ShieldCheck },
  { id: "legal_matrix", label: "Normativa Aplicable", icon: Scale },
  { id: "risks", label: "Matriz Riesgos", icon: AlertTriangle },
  { id: "surrounding_hazards", label: "Peligros Circundantes", icon: Radar },
  { id: "accident_analysis", label: "Accidentalidad", icon: Activity },
  { id: "compliance", label: "Programa de Seg.", icon: ClipboardCheck },
  { id: "compliance_log", label: "Bitácora Evidencias", icon: History },
  { id: "reports", label: "Reportes", icon: FileText },
  { id: "settings", label: "Configuración", icon: Settings },
];

export function AppSidebar({ activeTab: _, onTabChange: __, isOpen = false, onClose }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { currentCompanyId, activeTab, setActiveTab, setCurrentUser, setCurrentCompanyId } = useAppStore();

  const handleLogout = () => {
    auth.signOut().catch(err => console.error("Firebase sign out failed:", err));
    setCurrentUser(null);
    setCurrentCompanyId(null);
    setActiveTab("companies");
  };

  return (
    <>
      {/* Backdrop panel for mobile view */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      <div 
        className={cn(
          "h-screen bg-white border-r border-slate-200 flex flex-col z-50 shadow-xl",
          "fixed inset-y-0 left-0 md:sticky md:top-0",
          "transition-all duration-300 ease-in-out transform",
          isOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0",
          isCollapsed ? "md:w-14" : "md:w-56",
          "w-64"
        )}
      >
        <div className="p-3 mb-2 flex items-center justify-between">
          {(!isCollapsed || onClose) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-black text-sm text-slate-900 tracking-tighter flex items-center gap-2"
            >
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span className="leading-[1.1] uppercase font-bold text-[11px]">Diagnóstico <span className="text-blue-600 block text-[8px] tracking-[0.2em] font-black mt-0.5">NOM-030</span></span>
            </motion.div>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              if (onClose) {
                onClose();
              } else {
                setIsCollapsed(!isCollapsed);
              }
            }}
            className="h-8 w-8 hover:bg-slate-50 transition-all rounded-lg"
          >
            {onClose ? (
              <X className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              isCollapsed ? <Menu className="w-3.5 h-3.5 text-slate-400" /> : <X className="w-3.5 h-3.5 text-slate-400" />
            )}
          </Button>
        </div>

        <nav className="flex-1 px-2 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            // Only show items other than "companies" and "settings" if a company is selected
            const isEnabled = item.id === "companies" || item.id === "settings" || currentCompanyId !== null;

            if (!isEnabled) return null;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  onClose?.();
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all group relative",
                  isActive 
                    ? "bg-slate-900 text-white font-black shadow-md shadow-slate-200" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600")} />
                {(!isCollapsed || onClose) && <span className="text-[10px] uppercase font-black tracking-widest truncate">{item.label}</span>}
                {isActive && !isCollapsed && !onClose && (
                  <motion.div 
                    layoutId="active-nav"
                    className="absolute left-0 w-0.5 h-4 bg-blue-500 rounded-r-full"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <button 
            onClick={() => {
              handleLogout();
              onClose?.();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest"
          >
            <LogOut className="w-3.5 h-3.5" />
            {(!isCollapsed || onClose) && <span className="truncate">Cerrar Sesión</span>}
          </button>
        </div>
      </div>
    </>
  );
}

