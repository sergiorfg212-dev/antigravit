import { useState, useEffect, useRef, useCallback } from "react";
import { AppSidebar } from "./components/layout/AppSidebar";
import { AuthModule } from "./components/auth/AuthModule";
import { Dashboard } from "./components/dashboard/Dashboard";
import { Companies } from "./components/companies/Companies";
import { RiskModule } from "./components/risks/RiskModule";
import { ReportsModule } from "./components/reports/ReportsModule";
import { ComplianceModule } from "./components/compliance/ComplianceModule";
import { ComplianceLogModule } from "./components/compliance/ComplianceLogModule";
import { SettingsModule } from "./components/settings/SettingsModule";
import { ProcessModule } from "./components/expediente/ProcessModule";
import { LayoutModule } from "./components/expediente/LayoutModule";
import { LocalizationModule } from "./components/companies/LocalizationModule";
import { LegalModule } from "./components/legal/LegalModule";
import { LegalMatrixModule } from "./components/legal/LegalMatrixModule";
import { AccidentAnalysisModule } from "./components/expediente/AccidentAnalysisModule";
import { SurroundingHazardsModule } from "./components/expediente/SurroundingHazardsModule";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db as fdb } from "./lib/firebase";
import { syncLocalStorageWithCloud } from "./lib/sync";
import { useOnlineStatus, useDexieQuery } from "./hooks/useDexie";
import { useAppStore } from "./hooks/useAppStore";
import { Toaster, toast } from "sonner";
import { ClipboardCheck, ShieldCheck, Download, Loader2, RefreshCw, Menu } from "lucide-react";
import { Button } from "./components/ui/button";
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { db, initializeFirestoreListeners, clearLocalCache, unsubscribeFirestoreListeners, getLocalFallbackMode, setLocalFallbackMode } from "./lib/db";
import { ExecutiveSummaryDocument } from "./components/shared/ExecutiveSummaryDocument";

export default function App() {
  const { currentUser, setCurrentUser, setIsAdminMode } = useAppStore();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          const userDocRef = doc(fdb, "users", fbUser.uid);
          let profile: any = null;

          const initiallyFallback = getLocalFallbackMode();

          if (!initiallyFallback) {
            try {
              const docSnap = await getDoc(userDocRef);
              if (docSnap.exists()) {
                profile = docSnap.data();
              } else {
                console.warn("El documento de usuario no existe en Firestore para UID:", fbUser.uid);
              }
            } catch (getDocError: any) {
              const errMsg = (getDocError?.message || String(getDocError)).toLowerCase();
              const errCode = (getDocError?.code || String(getDocError?.code || '')).toLowerCase();
              if (
                errMsg.includes('quota') || 
                errMsg.includes('resource-exhausted') || 
                errMsg.includes('exhausted') || 
                errMsg.includes('quota_exceeded') ||
                errCode.includes('quota') ||
                errCode.includes('resource-exhausted') ||
                errCode.includes('quota_exceeded')
              ) {
                setLocalFallbackMode(true);
                window.dispatchEvent(new CustomEvent('nom030-db-quota-exhausted'));
              }
              console.warn("No se pudo obtener el documento del usuario desde Firestore (modo desconectado u offline):", getDocError);
            }
          }

          if (!profile) {
            // Intenta extraer desde localStorage backup
            try {
              const stored = localStorage.getItem(`nom030_fallback_users_${fbUser.uid}`);
              if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && parsed.length > 0) {
                  profile = parsed[0];
                }
              }
            } catch (e) {}
          }

          if (!profile) {
            // Fallback: construct basic profile
            profile = {
              name: fbUser.displayName || fbUser.email?.split('@')[0] || "Asesor Técnico",
              email: fbUser.email || "",
              role: "user",
              isBlocked: false,
              createdAt: new Date()
            };
          }

          if (profile) {
            if (!profile.isBlocked) {
              const dexieUser = {
                name: profile.name,
                email: profile.email,
                passwordHash: btoa("firebase"), // Compatibility dummy
                role: profile.role,
                createdAt: profile.createdAt?.toDate ? profile.createdAt.toDate() : (profile.createdAt instanceof Date ? profile.createdAt : new Date())
              };

              // Load authenticated user synchronized configurations
              if (profile.settings) {
                if (profile.settings.currentCompanyId !== undefined) {
                  useAppStore.getState().setCurrentCompanyId(profile.settings.currentCompanyId);
                }
                if (profile.settings.activeTab !== undefined) {
                  useAppStore.getState().setActiveTab(profile.settings.activeTab);
                }
              }

              setCurrentUser(dexieUser);
              const isMasterAdmin = profile.email?.trim().toLowerCase() === 'sergio.rfg212@gmail.com' || profile.email === 'admin.local@nom030.com';
              setIsAdminMode(profile.role === 'admin' && isMasterAdmin);

              // Hook up total Firestore real-time subscriber collections instantly on the PC and mobile
              initializeFirestoreListeners(fbUser.uid, profile.email || fbUser.email || "");
            } else {
              await auth.signOut().catch(() => {});
              setCurrentUser(null);
            }
          } else {
            setCurrentUser(null);
          }
        } else {
          const currentLoadedUser = useAppStore.getState().currentUser;
          if (currentLoadedUser && !currentLoadedUser.email.endsWith('.local@nom030.com')) {
            // Wipes the cache and unsubscribes from collection observers to keep things clean
            clearLocalCache();
            unsubscribeFirestoreListeners();
            useAppStore.getState().setCurrentCompanyId(null);
            useAppStore.getState().setActiveTab("companies");
          }
          setCurrentUser(null);
        }
      } catch (err) {
        console.error("Firebase auth check state fail:", err);
      } finally {
        setInitializing(false);
      }
    });

    return () => unsubscribe();
  }, [setCurrentUser, setIsAdminMode]);

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Verificando sesión en la nube...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <AuthModule />
        <Toaster position="bottom-right" theme="light" richColors />
      </>
    );
  }

  return <MainAppContent />;
}


function MainAppContent() {
  const { currentUser, currentCompanyId, isOnline, activeTab, setActiveTab } = useAppStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncingHeader, setIsSyncingHeader] = useState(false);
  const [showQuotaBanner, setShowQuotaBanner] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const lastSyncTimeRef = useRef<number>(0);
  
  useEffect(() => {
    if (getLocalFallbackMode()) {
      setShowQuotaBanner(true);
    }

    const handleQuotaExceeded = () => {
      setShowQuotaBanner(true);
      toast.warning(
        "Se ha activado el almacenamiento local offline. Se alcanzó el límite de solicitudes gratuitas a la base de datos.",
        { duration: 8000 }
      );
    };

    window.addEventListener("nom030-db-quota-exhausted", handleQuotaExceeded);
    return () => {
      window.removeEventListener("nom030-db-quota-exhausted", handleQuotaExceeded);
    };
  }, []);
  
  useOnlineStatus();

  const triggerManualSync = useCallback(async (isAuto = false) => {
    if (getLocalFallbackMode()) return;
    const fbUser = auth.currentUser;
    if (!fbUser || !isOnline) return;

    // Prevent simultaneous syncing
    if (isSyncingHeader) return;

    const now = Date.now();
    // For auto-sync, throttle to at least once every 15 seconds to avoid spamming the database
    if (isAuto && now - lastSyncTimeRef.current < 15000) {
      return;
    }
    
    lastSyncTimeRef.current = now;
    if (!isAuto) {
      setIsSyncingHeader(true);
    }

    try {
      console.log(`${isAuto ? "Auto" : "Manual"} sync initiated for user:`, fbUser.uid);
      const { pushedCount, pulledCount } = await syncLocalStorageWithCloud(fbUser.uid);
      
      if (pushedCount > 0 || pulledCount > 0) {
        toast.success(
          `Sincronización completa: se respaldaron ${pushedCount} cambios y se descargaron ${pulledCount} registros nuevos.`,
          { id: "sync-toast" }
        );
      } else if (!isAuto) {
        toast.success("Tus datos ya están completamente actualizados con la nube.", { id: "sync-toast" });
      }
    } catch (err) {
      console.warn("Sync failed:", err);
      if (!isAuto) {
        toast.error("Error de sincronización. Revisa tu conexión de red.", { id: "sync-toast" });
      }
    } finally {
      if (!isAuto) {
        setIsSyncingHeader(false);
      }
    }
  }, [isOnline, isSyncingHeader]);

  // Trigger automatic background bidirectional sync when connections become available, or on focus/visibility change, or on a 2-minute interval
  useEffect(() => {
    const fbUser = auth.currentUser;
    if (!fbUser || !isOnline) return;

    // Initial sync on mount/reconnect/login
    triggerManualSync(true);

    // Run when browser tab is brought to the foreground or user returns to the app tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("App brought to foreground, triggering automatic sync...");
        triggerManualSync(true);
      }
    };

    const handleFocus = () => {
      console.log("App window focused, triggering automatic sync...");
      triggerManualSync(true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    const interval = setInterval(() => {
      if (navigator.onLine && auth.currentUser) {
        triggerManualSync(true);
      }
    }, 120000); // Check and sync every 2 minutes

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [isOnline, currentUser, triggerManualSync]);

  // Load all live database query elements to feed the clean executive summaries
  const company = useDexieQuery(
    () => (currentCompanyId ? db.companies.get(currentCompanyId) : Promise.resolve(undefined)),
    [currentCompanyId]
  );
  const companiesList = useDexieQuery(
    () => db.companies.toArray(),
    []
  ) || [];
  const findings = useDexieQuery(
    () => (currentCompanyId ? db.findings.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([])),
    [currentCompanyId]
  ) || [];
  const riskAssessments = useDexieQuery(
    () => (currentCompanyId ? db.riskAssessments.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([])),
    [currentCompanyId]
  ) || [];
  const legalMatrix = useDexieQuery(
    () => (currentCompanyId ? db.legalMatrix.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([])),
    [currentCompanyId]
  ) || [];
  const checklistItems = useDexieQuery(
    () => (currentCompanyId ? db.checklistItems.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([])),
    [currentCompanyId]
  ) || [];
  const surroundingHazards = useDexieQuery(
    () => (currentCompanyId ? db.surroundingHazards.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([])),
    [currentCompanyId]
  ) || [];
  const accidentEvents = useDexieQuery(
    () => (currentCompanyId ? db.accidentEvents.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([])),
    [currentCompanyId]
  ) || [];
  const safetyProgram = useDexieQuery(
    () => (currentCompanyId ? db.safetyProgram.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([])),
    [currentCompanyId]
  ) || [];
  const evidences = useDexieQuery(
    () => (currentCompanyId ? db.evidences.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([])),
    [currentCompanyId]
  ) || [];

  const tabLabels: Record<string, string> = {
    companies: "Catálogo de Empresas",
    process: "Procesos Industriales de Trabajo",
    localization: "Localización y Entorno Geográfico",
    layout: "Planos e Infraestructura de Planta",
    legal: "Marco Legal y Obligaciones",
    legal_matrix: "Normativas de Evaluación STPS",
    risks: "Matriz de Clasificación de Riesgos",
    surrounding_hazards: "Peligros y Amenazas Circundantes",
    accident_analysis: "Bitácora de Accidentalidad Laboral",
    compliance: "Programa de Seguridad y Salud (NOM-030)",
    compliance_log: "Evidencia e Historial de Cumplimiento",
    reports: "Generación de Reportes e Informes",
    settings: "Configuración global de Datos"
  };

  const currentTabTitle = tabLabels[activeTab] || "Módulo de Trabajo NOM-030";

  const handleExportPDF = () => {
    const el = document.getElementById("tab-executive-summary-print-container");
    if (!el) {
      toast.error("No se localizó el contenedor estructurado para el resumen ejecutivo.");
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading("Recopilando registros de base de datos y organizando reporte en PDF corporativo (Letter)...");

    // Convert OKLCH recursively for html2canvas compatibility
    const oklabToRgb = (l: number, a_: number, b_: number, a = 1): string => {
      const l_ = l + 0.3963377774 * a_ + 0.2158037573 * b_;
      const m_ = l - 0.1055613458 * a_ - 0.0638541728 * b_;
      const s_ = l - 0.0894841775 * a_ - 1.2914855480 * b_;

      const l3 = l_ * l_ * l_;
      const m3 = m_ * m_ * m_;
      const s3 = s_ * s_ * s_;

      const r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
      const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
      const b = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

      const clamp = (x: number) => Math.max(0, Math.min(1, x));
      const gamma = (x: number) => x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1/2.4) - 0.055;

      const R = Math.round(gamma(clamp(r)) * 255);
      const G = Math.round(gamma(clamp(g)) * 255);
      const B = Math.round(gamma(clamp(b)) * 255);

      return a === 1 ? `rgb(${R}, ${G}, ${B})` : `rgba(${R}, ${G}, ${B}, ${a})`;
    };

    const oklchToRgb = (l: number, c: number, h: number, a = 1): string => {
      const hRad = (h * Math.PI) / 180;
      const a_ = c * Math.cos(hRad);
      const b_ = c * Math.sin(hRad);
      return oklabToRgb(l, a_, b_, a);
    };

    const replaceOklInComplexString = (text: string): string => {
      if (!text) return text;
      let processed = text.replace(/oklch\(([^)]+)\)/g, (match, content) => {
        try {
          const parts = content.trim().split(/[\s,+/]+/);
          if (parts.length < 3) return "rgb(120, 120, 120)";
          let lStr = parts[0];
          let cStr = parts[1];
          let hStr = parts[2];
          let aStr = parts[3] || "1";
          
          let l = parseFloat(lStr);
          if (lStr.includes("%")) l = l / 100;
          let c = parseFloat(cStr);
          if (cStr.includes("%")) c = c / 100;
          let h = parseFloat(hStr);
          if (hStr.includes("rad")) {
            h = (parseFloat(hStr) * 180) / Math.PI;
          } else if (hStr.includes("turn")) {
            h = parseFloat(hStr) * 360;
          }
          let a = parseFloat(aStr);
          if (aStr.includes("%")) a = a / 100;
          
          if (isNaN(l) || isNaN(c) || isNaN(h)) return "rgb(120, 120, 120)";
          return oklchToRgb(l, c, h, a);
        } catch(e) {
          return "rgb(120, 120, 120)";
        }
      });

      processed = processed.replace(/oklab\(([^)]+)\)/g, (match, content) => {
        try {
          const parts = content.trim().split(/[\s,+/]+/);
          if (parts.length < 3) return "rgb(120, 120, 120)";
          let lStr = parts[0];
          let a_Str = parts[1];
          let b_Str = parts[2];
          let alphaStr = parts[3] || "1";
          
          let l = parseFloat(lStr);
          if (lStr.includes("%")) l = l / 100;
          let a_ = parseFloat(a_Str);
          if (a_Str.includes("%")) a_ = a_ / 100;
          let b = parseFloat(b_Str);
          if (b_Str.includes("%")) b = b / 100;
          let alpha = parseFloat(alphaStr);
          if (alphaStr.includes("%")) alpha = alpha / 100;
          
          if (isNaN(l) || isNaN(a_) || isNaN(b)) return "rgb(120, 120, 120)";
          return oklabToRgb(l, a_, b, alpha);
        } catch(e) {
          return "rgb(120, 120, 120)";
        }
      });

      return processed;
    };

    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = function(elt, pseudoElt) {
      const style = originalGetComputedStyle(elt, pseudoElt);
      const proxy = new Proxy(style, {
        get(target, prop) {
          if (prop === 'getPropertyValue') {
            return function(name: string) {
              const strVal = target.getPropertyValue(name);
              if (typeof strVal === "string" && (strVal.includes("oklch(") || strVal.includes("oklab("))) {
                return replaceOklInComplexString(strVal);
              }
              return strVal;
            };
          }
          const val = Reflect.get(target, prop, target);
          if (typeof val === "function") {
            return val.bind(target);
          }
          if (typeof val === "string" && (val.includes("oklch(") || val.includes("oklab("))) {
            return replaceOklInComplexString(val);
          }
          return val;
        }
      });
      return proxy;
    };

    // Backup and preprocess page stylesheet text content
    const styleBackups: { element: HTMLStyleElement; originalText: string }[] = [];
    const styleElements = Array.from(document.querySelectorAll("style"));
    
    styleElements.forEach((styleEl) => {
      const originalText = styleEl.textContent || "";
      if (originalText.includes("oklch(") || originalText.includes("oklab(")) {
        styleBackups.push({ element: styleEl, originalText });
        const newText = replaceOklInComplexString(originalText);
        styleEl.textContent = newText;
      }
    });

    const restoreAll = () => {
      styleBackups.forEach(({ element, originalText }) => {
        element.textContent = originalText;
      });
      window.getComputedStyle = originalGetComputedStyle;
    };

    setTimeout(() => {
      const tabFileNames: Record<string, string> = {
        companies: "Catalogo_Empresas",
        process: "Procesos_Industriales",
        localization: "Localizacion_Coordenadas",
        layout: "Planos_Infraestructura",
        legal: "Marco_Legal",
        legal_matrix: "Normativa_Aplicable",
        risks: "Matriz_Riesgos",
        surrounding_hazards: "Peligros_Circundantes",
        accident_analysis: "Bitacora_Accidentalidad",
        compliance: "Programa_Seguridad_Salud",
        compliance_log: "Bitacora_Cumplimiento",
        reports: "Informe_Final",
        settings: "Configuracion_NOM030"
      };

      const filename = `Resumen_Ejecutivo_${tabFileNames[activeTab] || activeTab}_NOM030.pdf`;

      const opt = {
        margin: [15, 12, 15, 12] as [number, number, number, number],
        filename: filename,
        image: { type: "jpeg" as const, quality: 0.98 },
        pagebreak: { mode: 'css', avoid: '.pdf-no-break' },
        html2canvas: { 
          scale: 2.0, // Higher scale for pristine crisp letters
          useCORS: true,
          letterRendering: true,
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc: any) => {
            // Remove all canvas elements inside the cloned document to prevent html2canvas zero-size canvas createPattern crash
            try {
              const canvases = clonedDoc.querySelectorAll('canvas');
              canvases.forEach((canvas: any) => {
                canvas.remove();
              });
            } catch (err) {
              console.error("Error removing canvases in clone:", err);
            }

            // Expand flowchart containers and fix scale in printed clone to prevent truncation or overlap
            try {
              const scrollDirs = clonedDoc.querySelectorAll('.pdf-flowchart-scroll-container');
              scrollDirs.forEach((el: any) => {
                el.style.maxHeight = 'none';
                el.style.overflow = 'visible';
                el.style.height = 'auto';
              });
            } catch (err) {
              console.error("Error expanding flowcharts in clone:", err);
            }

            // Patch the cloned window's createPattern to prevent zero-size html2canvas pattern error
            if (clonedDoc.defaultView) {
              try {
                const clonedWindow = clonedDoc.defaultView;
                if (clonedWindow.CanvasRenderingContext2D) {
                  const originalClonedCreatePattern = clonedWindow.CanvasRenderingContext2D.prototype.createPattern;
                  clonedWindow.CanvasRenderingContext2D.prototype.createPattern = function(image: any, repetition: any) {
                    let isZeroSize = false;
                    if (image) {
                      if (image instanceof clonedWindow.HTMLCanvasElement || (image.tagName && image.tagName.toLowerCase() === 'canvas')) {
                        if (image.width === 0 || image.height === 0) isZeroSize = true;
                      } else if (image instanceof clonedWindow.HTMLImageElement || (image.tagName && image.tagName.toLowerCase() === 'img')) {
                        if (image.width === 0 || image.height === 0 || image.naturalWidth === 0 || image.naturalHeight === 0) isZeroSize = true;
                      } else if (image instanceof clonedWindow.HTMLVideoElement || (image.tagName && image.tagName.toLowerCase() === 'video')) {
                        if (image.videoWidth === 0 || image.videoHeight === 0) isZeroSize = true;
                      } else if (typeof image.width === 'number' && typeof image.height === 'number') {
                        if (image.width === 0 || image.height === 0) isZeroSize = true;
                      }
                    }
                    
                    if (isZeroSize) {
                      console.warn("Caught zero-size item in cloned createPattern. Substituting with 1x1 dummy to prevent crash.");
                      const dummyCanvas = clonedDoc.createElement('canvas');
                      dummyCanvas.width = 1;
                      dummyCanvas.height = 1;
                      return originalClonedCreatePattern.call(this, dummyCanvas, repetition || 'repeat');
                    }
                    return originalClonedCreatePattern.apply(this, arguments as any);
                  };
                }
              } catch (err) {
                console.error("Error setting up cloned createPattern patch:", err);
              }
            }
          }
        },
        jsPDF: { unit: "mm" as const, format: "letter" as const, orientation: "portrait" as const }
      };

      html2pdf().from(el).set(opt).save().then(() => {
        toast.success("Resumen Ejecutivo oficial descargado correctamente en PDF legal.", { id: toastId });
        setIsExporting(false);
        restoreAll();
      }).catch((err: any) => {
        console.error("PDF Export error:", err);
        toast.error("Error al compilar el Resumen Ejecutivo a PDF.", { id: toastId });
        setIsExporting(false);
        restoreAll();
      });
    }, 450);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      <div className="no-print">
        <AppSidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      </div>
      
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Mobile Header Top Bar (visible only on mobile) */}
        <header className="bg-white border-b border-slate-200 h-14 px-4 flex items-center justify-between sticky top-0 z-30 md:hidden no-print shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
              title="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-slate-800 text-xs tracking-tight uppercase leading-none">
                NOM-030
              </span>
            </div>
          </div>
          
          <div className="text-[10px] text-slate-500 font-extrabold uppercase truncate max-w-[150px]">
            {company?.name || "Sin Empresa"}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-10 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {showQuotaBanner && (
              <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-[11px] font-medium leading-relaxed shadow-sm flex items-start gap-3 no-print">
                <span className="text-base leading-none mt-0.5">⚠️</span>
                <div>
                  <span className="font-extrabold text-amber-900 uppercase tracking-wider block mb-0.5">Límite de Consumo Alcanzado en Base de Datos (Modo Offline Activado)</span>
                  A fin de asegurar que puedas seguir evaluando riesgos y generando reportes de la NOM-030 sin contratiempos en este sandbox, la aplicación ha activado automáticamente el <strong className="font-extrabold text-amber-900">Modo Local Sin Conexión</strong>. Tus empresas, procesos, planos y diagnósticos se leerán y guardarán en local de forma 100% segura.
                </div>
              </div>
            )}

            {/* Header Action & Selection Info - NOT printed on output PDF */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-rose-100/10 no-print">
              <div>
                <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">Diagnóstico NOM-030-STPS</span>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">{currentTabTitle}</h1>
              </div>

              <div className="flex items-center gap-3">
                {/* Export PDF Button explicitly for each tab content view, except settings */}
                {activeTab !== "settings" && (
                  <Button
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl h-9 px-4 py-1 flex items-center gap-2 shadow-lg shadow-blue-500/10 transition-all active:scale-95 disabled:opacity-50"
                    id={`export-pdf-btn-${activeTab}`}
                    title="Descargar el contenido de esta pestaña en PDF"
                  >
                    {isExporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>Exportar PDF</span>
                  </Button>
                )}

                {!isOnline && (
                  <div className="px-2.5 py-1 bg-amber-50 text-amber-700 text-[10px] font-black rounded-lg border border-amber-100 flex items-center gap-1.5 leading-none uppercase tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Modo Offline
                  </div>
                )}
                {isOnline && (
                  <button
                    onClick={() => triggerManualSync(false)}
                    disabled={isSyncingHeader}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-600 border border-emerald-100 disabled:opacity-85 text-[10px] font-black rounded-lg flex items-center gap-1.5 leading-none uppercase tracking-wide cursor-pointer transition-all duration-200"
                    title="Sincronizar ahora con la nube (Doble Vía)"
                  >
                    {isSyncingHeader ? (
                      <Loader2 className="w-3 h-3 text-emerald-600 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3 text-emerald-500 hover:rotate-180 transition-transform duration-500" />
                    )}
                    <span>{isSyncingHeader ? "Sincronizando..." : "Sincronizado / Sincronizar"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Wrapper for capture container */}
            <div id="tab-content-area" className="w-full">
              {activeTab === "dashboard" && <Dashboard />}
              {activeTab === "companies" && <Companies onSelect={() => setActiveTab("dashboard")} />}
              {activeTab === "risks" && <RiskModule />}
              {activeTab === "surrounding_hazards" && <SurroundingHazardsModule />}
              {activeTab === "accident_analysis" && <AccidentAnalysisModule />}
              {activeTab === "compliance" && <ComplianceModule />}
              {activeTab === "compliance_log" && <ComplianceLogModule />}
              {activeTab === "reports" && <ReportsModule />}
              {activeTab === "process" && <ProcessModule />}
              {activeTab === "localization" && <LocalizationModule />}
              {activeTab === "layout" && <LayoutModule />}
              {activeTab === "legal" && <LegalModule />}
              {activeTab === "legal_matrix" && <LegalMatrixModule />}
              {activeTab === "settings" && <SettingsModule />}
            </div>

            {/* Off-screen high-fidelity executive summary printable document block */}
            <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
              <ExecutiveSummaryDocument
                activeTab={activeTab}
                company={company}
                companiesList={companiesList}
                findings={findings}
                riskAssessments={riskAssessments}
                legalMatrix={legalMatrix}
                checklistItems={checklistItems}
                surroundingHazards={surroundingHazards}
                accidentEvents={accidentEvents}
                safetyProgram={safetyProgram}
                evidences={evidences}
              />
            </div>
          </div>
        </main>
        <Toaster position="bottom-right" theme="light" richColors />
      </div>
    </div>
  );
}

function ClipboardIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}
