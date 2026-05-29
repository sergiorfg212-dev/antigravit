import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from "../../hooks/useAppStore";
import { db, type Company } from "../../lib/db";
import { toast } from "sonner";
import { 
  Loader2, 
  FileText, 
  Printer, 
  Sparkles,
  MapPin,
  Building2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RefreshCw,
  CheckCircle,
  Clock,
  Briefcase,
  Layers,
  ShieldCheck,
  TrendingUp,
  AlertOctagon,
  Image as ImageIcon,
  Edit,
  ClipboardCheck,
  HelpCircle,
  Award,
  Bold,
  Italic,
  Underline,
  Eraser,
  Circle,
  Diamond,
  Square,
  ArrowDown,
  ArrowRight,
  Workflow,
  Upload,
  Package as PackageIcon
} from "lucide-react";

import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { 
  generateFinalAnalysis, 
  generateStudioTargetAndIntroduction 
} from "../../services/geminiService";

// @ts-ignore
import html2pdf from 'html2pdf.js';

// --- HELPER COLOR TRANSLATIONS FOR OKLCH / OKLAB COMPATIBILITY ---
function oklabToRgb(l: number, a_: number, b_: number, a = 1): string {
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
}

function oklchToRgb(l: number, c: number, h: number, a = 1): string {
  const hRad = (h * Math.PI) / 180;
  const a_ = c * Math.cos(hRad);
  const b_ = c * Math.sin(hRad);
  return oklabToRgb(l, a_, b_, a);
}

function replaceOklInComplexString(text: string): string {
  if (!text) return text;
  
  // Replace oklch(...)
  let processed = text.replace(/oklch\(([^)]+)\)/g, (match, content) => {
    try {
      const parts = content.trim().split(/[\s,+/]+/);
      if (parts.length < 3) return 'rgb(120, 120, 120)';
      
      const lStr = parts[0];
      const cStr = parts[1];
      const hStr = parts[2];
      const aStr = parts[3] || '1';
      
      let l = parseFloat(lStr);
      if (lStr.includes('%')) l = l / 100;
      
      let c = parseFloat(cStr);
      if (cStr.includes('%')) c = c / 100;
      
      let h = parseFloat(hStr);
      if (hStr.includes('rad')) {
        h = (parseFloat(hStr) * 180) / Math.PI;
      } else if (hStr.includes('turn')) {
        h = parseFloat(hStr) * 360;
      }
      
      let a = parseFloat(aStr);
      if (aStr.includes('%')) a = a / 100;
      
      if (isNaN(l) || isNaN(c) || isNaN(h)) return 'rgb(120, 120, 120)';
      if (isNaN(a)) a = 1;

      return oklchToRgb(l, c, h, a);
    } catch(e) {
      return 'rgb(120, 120, 120)';
    }
  });

  // Replace oklab(...)
  processed = processed.replace(/oklab\(([^)]+)\)/g, (match, content) => {
    try {
      const parts = content.trim().split(/[\s,+/]+/);
      if (parts.length < 3) return 'rgb(120, 120, 120)';
      
      const lStr = parts[0];
      const aStr_ = parts[1];
      const bStr_ = parts[2];
      const alphaStr = parts[3] || '1';
      
      let l = parseFloat(lStr);
      if (lStr.includes('%')) l = l / 100;
      
      let a_ = parseFloat(aStr_);
      if (aStr_.includes('%')) a_ = a_ / 100;
      
      let b_ = parseFloat(bStr_);
      if (bStr_.includes('%')) b_ = b_ / 100;

      let alpha = parseFloat(alphaStr);
      if (alphaStr.includes('%')) alpha = alpha / 100;
      
      if (isNaN(l) || isNaN(a_) || isNaN(b_)) return 'rgb(120, 120, 120)';
      if (isNaN(alpha)) alpha = 1;

      return oklabToRgb(l, a_, b_, alpha);
    } catch(e) {
      return 'rgb(120, 120, 120)';
    }
  });

  return processed;
}

export function FinalReportGenerator() {
  const { currentCompanyId } = useAppStore();
  
  // 1. DATA STATES
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isAISuggesting, setIsAISuggesting] = useState(false);
  
  const [company, setCompany] = useState<Company | null>(null);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [hazards, setHazards] = useState<any[]>([]);
  const [accidentEvents, setAccidentEvents] = useState<any[]>([]);
  const [safetyProgram, setSafetyProgram] = useState<any[]>([]);
  const [evidences, setEvidences] = useState<any[]>([]);
  const [legalMatrix, setLegalMatrix] = useState<any[]>([]);

  // AI-generated states
  const [target, setTarget] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [conclusions, setConclusions] = useState("");
  const [recommendations, setRecommendations] = useState("");

  // Viewer Controls
  const [activePage, setActivePage] = useState(1);
  const [documentScale, setDocumentScale] = useState(0.85); // Default to fit screen nicely
  const isEditMode = false;
  const showWysiwygEditor = false;
  const setIsEditMode = (val: boolean) => {};
  const setShowWysiwygEditor = (val: boolean) => {};

  // References for scroll navigation
  const pageRefs = useRef<HTMLDivElement[]>([]);

  // 2. LOAD DATA FROM INTRODUCED DB TABLES
  const loadWorkspaceData = async () => {
    if (!currentCompanyId) return;
    setIsLoading(true);
    try {
      const companyData = await db.companies.get(currentCompanyId);
      if (!companyData) {
        setIsLoading(false);
        return;
      }

      const [
        loadedChecklist,
        loadedFindings,
        loadedHazards,
        loadedAccidents,
        loadedProgram,
        loadedEvidences,
        loadedLegal
      ] = await Promise.all([
        db.checklistItems.where("companyId").equals(currentCompanyId).toArray().catch(() => []),
        db.findings.where("companyId").equals(currentCompanyId).toArray().catch(() => []),
        db.surroundingHazards.where("companyId").equals(currentCompanyId).toArray().catch(() => []),
        db.accidentEvents.where("companyId").equals(currentCompanyId).toArray().catch(() => []),
        db.safetyProgram.where("companyId").equals(currentCompanyId).toArray().catch(() => []),
        db.evidences.where("companyId").equals(currentCompanyId).toArray().catch(() => []),
        db.legalMatrix.where("companyId").equals(currentCompanyId).toArray().catch(() => [])
      ]);

      setCompany(companyData);
      setChecklistItems(loadedChecklist);
      setFindings(loadedFindings);
      setHazards(loadedHazards);
      setAccidentEvents(loadedAccidents);
      setSafetyProgram(loadedProgram);
      setEvidences(loadedEvidences);
      setLegalMatrix(loadedLegal);

      // Load or generate AI parts
      // We see if the company already has reportTarget cached, otherwise initialize
      // @ts-ignore
      setTarget(companyData.reportTarget || "Haga clic en 'Sincronizar con IA' para generar el objetivo profesional basado en la empresa.");
      // @ts-ignore
      setIntroduction(companyData.reportIntro || "Haga clic en 'Sincronizar con IA' para redactar la introducción oficial adaptada.");
      // @ts-ignore
      setConclusions(companyData.reportConclusions || "Establecer mediante análisis con IA...");
      // @ts-ignore
      setRecommendations(companyData.reportRecommendations || "Sugerencias normativas estimadas por IA...");

    } catch (e) {
      toast.error("Error al recopilar el historial técnico del centro de trabajo.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, [currentCompanyId]);

  useEffect(() => {
    const pages = document.querySelectorAll(".report-page-container");
    pages.forEach((page) => {
      (page as HTMLElement).contentEditable = isEditMode ? "true" : "false";
    });
  }, [isEditMode, checklistItems, findings, hazards, accidentEvents, safetyProgram, evidences, legalMatrix]);

  // Navigate to page via scroll triggers
  const scrollToPage = (pageNumber: number) => {
    setActivePage(pageNumber);
    const targetElement = pageRefs.current[pageNumber - 1];
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // 3. IA AUTO-GENERATOR TRIGGER (CONFORME A NOM-030)
  const handleAIGeneration = async () => {
    if (!company) return;
    setIsAISuggesting(true);
    const toastId = toast.loading("Consultando con el facilitador de IA NOM-030...");
    try {
      // 1. Target & Intro
      const targetAndIntro = await generateStudioTargetAndIntroduction(company, findings, hazards);
      // 2. Conclusions & Recommendations
      const analysis = await generateFinalAnalysis(company, findings, accidentEvents, safetyProgram);

      setTarget(targetAndIntro.target);
      setIntroduction(targetAndIntro.introduction);
      setConclusions(analysis.conclusions);
      setRecommendations(analysis.recommendations);

      // Save to database dynamically so we hold persistence
      await db.companies.update(company.id!, {
        // @ts-ignore
        reportTarget: targetAndIntro.target,
        reportIntro: targetAndIntro.introduction,
        reportConclusions: analysis.conclusions,
        reportRecommendations: analysis.recommendations
      });

      toast.success("Informe técnico actualizado mediante inteligencia artificial corporativa.", { id: toastId });
    } catch (err) {
      console.error("AI Generation Error", err);
      toast.error("Ocurrió un error al estructurar el informe por IA.", { id: toastId });
    } finally {
      setIsAISuggesting(false);
    }
  };

  // Guard manual changes
  const saveManualEdits = async () => {
    if (!company) return;
    try {
      const liveTarget = document.getElementById('editable-report-target')?.innerText || target;
      const liveIntro = document.getElementById('editable-report-intro')?.innerText || introduction;
      const liveConclusions = document.getElementById('editable-report-conclusions')?.innerText || conclusions;
      const liveRecommendations = document.getElementById('editable-report-recommendations')?.innerText || recommendations;

      await db.companies.update(company.id!, {
        // @ts-ignore
        reportTarget: liveTarget,
        reportIntro: liveIntro,
        reportConclusions: liveConclusions,
        reportRecommendations: liveRecommendations
      });

      // Update states
      setTarget(liveTarget);
      setIntroduction(liveIntro);
      setConclusions(liveConclusions);
      setRecommendations(liveRecommendations);

      toast.success("Cambios del borrador de reporte guardados en la base de datos.");
      setIsEditMode(false);
    } catch (err) {
      toast.error("No se pudieron guardar las modificaciones.");
    }
  };

  // 4. ACCIDENT CALCULABILITY METRICS
  const getSiniestralidadStats = () => {
    if (!company) return { if: "0.00", ig: "0.00", count: 0, days: 0 };
    const accidents = accidentEvents.filter((e) => e.type === 'accident').length || 0;
    const daysLost = accidentEvents.reduce((acc, e) => acc + (e.daysLost || 0), 0) || 0;
    const hoursWorked = company.totalHoursWorked || (company.workerCount * 240 * 8) || 1;

    const IF = (accidents * 200000) / hoursWorked;
    const IG = (daysLost * 200000) / hoursWorked;

    return { 
      if: IF.toFixed(2), 
      ig: IG.toFixed(2), 
      count: accidents, 
      days: daysLost,
      hoursWorked: hoursWorked
    };
  };

  const stats = getSiniestralidadStats();

  // 5. PDF EXPORT (COMPLIANT WITH THE STYLES, PROPORTIONS, AND CLEAN PAGES)
  const handleDownloadPDF = () => {
    const el = document.getElementById('documento-preview-pdf');
    if (!el || !company) {
      toast.error("El informe no está completamente renderizado.");
      return;
    }

    setIsGeneratingPDF(true);
    const toastId = toast.loading("Preparando formato digital corporativo...");

    // Store original getComputedStyle of the parent window
    const originalGetComputedStyle = window.getComputedStyle;

    // Helper proxy to wrap computed style declarations and sanitize on-the-fly
    const createStyleProxy = (style: CSSStyleDeclaration) => {
      return new Proxy(style, {
        get(target, prop, receiver) {
          if (prop === 'getPropertyValue') {
            return (propertyName: string) => {
              const val = target.getPropertyValue(propertyName);
              if (typeof val === 'string' && val.includes('okl')) {
                return replaceOklInComplexString(val);
              }
              return val;
            };
          }
          const val = Reflect.get(target, prop, target);
          if (typeof val === 'string' && val.includes('okl')) {
            return replaceOklInComplexString(val);
          }
          if (typeof val === 'function') {
            return val.bind(target);
          }
          return val;
        }
      }) as CSSStyleDeclaration;
    };

    // Override parent window getComputedStyle
    (window as any).getComputedStyle = function(element: Element, pseudo?: string | null) {
      const style = originalGetComputedStyle(element, pseudo);
      return createStyleProxy(style);
    };

    const restoreGetComputedStyle = () => {
      (window as any).getComputedStyle = originalGetComputedStyle;
    };

    setTimeout(() => {
      const opt = {
        margin: 0,
        filename: `NOM030_Reporte_Profesional_${company.name.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        pagebreak: { mode: 'css', avoid: '.pdf-no-break' },
        html2canvas: {
          scale: 2,
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

            // Override the cloned window's getComputedStyle wrapper
            if (clonedDoc.defaultView) {
              const originalClonedGCS = clonedDoc.defaultView.getComputedStyle;
              clonedDoc.defaultView.getComputedStyle = function(element: Element, pseudo?: string | null) {
                const style = originalClonedGCS(element, pseudo);
                return createStyleProxy(style);
              };
            }

            // Apply high-contrast black/slate and Hex override styles to the cloned document
            const style = clonedDoc.createElement('style');
            style.innerHTML = `
              :root {
                --color-slate-50: #f8fafc !important;
                --color-slate-100: #f1f5f9 !important;
                --color-slate-150: #eef2f6 !important;
                --color-slate-200: #e2e8f0 !important;
                --color-slate-250: #ccd3e0 !important;
                --color-slate-300: #cbd5e1 !important;
                --color-slate-400: #94a3b8 !important;
                --color-slate-500: #64748b !important;
                --color-slate-600: #475569 !important;
                --color-slate-700: #334155 !important;
                --color-slate-800: #1e293b !important;
                --color-slate-900: #0f172a !important;
                --color-slate-950: #020617 !important;

                --color-indigo-50: #e0e7ff !important;
                --color-indigo-100: #c7d2fe !important;
                --color-indigo-200: #a5b4fc !important;
                --color-indigo-300: #818cf8 !important;
                --color-indigo-400: #6366f1 !important;
                --color-indigo-500: #6366f1 !important;
                --color-indigo-600: #4f46e5 !important;
                --color-indigo-700: #4338ca !important;
                --color-indigo-800: #3730a3 !important;
                --color-indigo-900: #312e81 !important;

                --color-blue-50: #eff6ff !important;
                --color-blue-100: #dbeafe !important;
                --color-blue-200: #bfdbfe !important;
                --color-blue-300: #93c5fd !important;
                --color-blue-400: #60a5fa !important;
                --color-blue-500: #3b82f6 !important;
                --color-blue-600: #2563eb !important;
                --color-blue-700: #1d4ed8 !important;
                --color-blue-800: #1e40af !important;
                --color-blue-900: #1e3a8a !important;

                --color-red-50: #fef2f2 !important;
                --color-red-100: #fee2e2 !important;
                --color-red-200: #fecaca !important;
                --color-red-300: #fca5a5 !important;
                --color-red-400: #f87171 !important;
                --color-red-500: #ef4444 !important;
                --color-red-600: #dc2626 !important;
                --color-red-700: #b91c1c !important;
                --color-red-800: #991b1b !important;
                --color-red-900: #7f1d1d !important;

                --color-amber-50: #fffbeb !important;
                --color-amber-100: #fef3c7 !important;
                --color-amber-200: #fde68a !important;
                --color-amber-300: #fcd34d !important;
                --color-amber-400: #fbbf24 !important;
                --color-amber-500: #f59e0b !important;
                --color-amber-600: #d97706 !important;
                --color-amber-700: #b45309 !important;
                --color-amber-800: #92400e !important;
                --color-amber-900: #78350f !important;

                --color-emerald-50: #ecfdf5 !important;
                --color-emerald-100: #d1fae5 !important;
                --color-emerald-200: #a7f3d0 !important;
                --color-emerald-300: #6ee7b7 !important;
                --color-emerald-400: #34d399 !important;
                --color-emerald-500: #10b981 !important;
                --color-emerald-600: #059669 !important;
                --color-emerald-700: #047857 !important;
                --color-emerald-800: #065f46 !important;
                --color-emerald-900: #064e3b !important;

                --background: #ffffff !important;
                --foreground: #09090b !important;
                --card: #ffffff !important;
                --card-foreground: #09090b !important;
                --popover: #ffffff !important;
                --popover-foreground: #09090b !important;
                --primary: #18181b !important;
                --primary-foreground: #fafafa !important;
                --secondary: #f4f4f5 !important;
                --secondary-foreground: #18181b !important;
                --muted: #f4f4f5 !important;
                --muted-foreground: #71717a !important;
                --accent: #f4f4f5 !important;
                --accent-foreground: #18181b !important;
                --destructive: #ef4444 !important;
                --border: #e4e4e7 !important;
                --input: #e4e4e7 !important;
                --ring: #18181b !important;
              }
              * {
                color-scheme: light !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body {
                background: white !important;
              }
              .report-page-container {
                width: 215.9mm !important;
                height: 272mm !important;
                min-height: 272mm !important;
                max-height: 272mm !important;
                box-sizing: border-box !important;
                padding: 1.6cm !important;
                overflow: hidden !important;
                box-shadow: none !important;
                border: none !important;
                margin: 0 !important;
                page-break-after: always !important;
                break-after: always !important;
                page-break-before: avoid !important;
                break-before: avoid !important;
              }
              .report-page-container.portada-custom {
                padding: 0 !important;
                display: flex !important;
                flex-direction: row !important;
              }
              .no-print {
                display: none !important;
              }
            `;
            clonedDoc.head.appendChild(style);

            // 1. Sanitize all style elements to eliminate oklch and oklab definitions
            const styleTags = clonedDoc.querySelectorAll('style');
            styleTags.forEach((s: any) => {
              if (s.innerHTML) {
                s.innerHTML = replaceOklInComplexString(s.innerHTML);
              }
            });

            // 2. Loop over every element, query its computed styles, and override inline styles if oklch or oklab is detected
            const allElements = clonedDoc.getElementsByTagName('*');
            for (let i = 0; i < allElements.length; i++) {
              const el = allElements[i] as HTMLElement;
              const computed = window.getComputedStyle(el);

              // Standardize inline styles and attributes using custom replace helper
              const styleAttr = el.getAttribute('style');
              if (styleAttr && (styleAttr.includes('okl') || styleAttr.includes('var('))) {
                el.setAttribute('style', replaceOklInComplexString(styleAttr));
              }

              const propsToProcess = [
                'backgroundColor',
                'color',
                'fill',
                'stroke',
                'borderTopColor',
                'borderBottomColor',
                'borderLeftColor',
                'borderRightColor',
                'outlineColor',
                'boxShadow',
                'textShadow'
              ];

              propsToProcess.forEach(prop => {
                const val = (computed as any)[prop];
                if (val && (val.includes('okl') || val.includes('var('))) {
                  const cleanedVal = replaceOklInComplexString(val);
                  (el.style as any)[prop] = cleanedVal;
                }
              });
            }
          }
        },
        jsPDF: { unit: 'mm' as const, format: 'letter' as const, orientation: 'portrait' as const }
      };

      html2pdf().from(el).set(opt).save().then(() => {
        toast.success("Documento descargado en formato PDF profesional.", { id: toastId });
        setIsGeneratingPDF(false);
        restoreGetComputedStyle();
      }).catch((err: any) => {
        console.error("PDF Fail", err);
        toast.error("Surgió un error al empaquetar el PDF.", { id: toastId });
        setIsGeneratingPDF(false);
        restoreGetComputedStyle();
      });
    }, 500);
  };

  if (!currentCompanyId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] bg-slate-50/50 p-8 rounded-3xl border border-dashed border-slate-200">
        <Building2 className="w-12 h-12 text-slate-400 mb-3" />
        <h3 className="text-base font-bold text-slate-800">No se ha seleccionado ninguna empresa</h3>
        <p className="text-xs text-slate-500 text-center mt-1">Regrese a la pestaña "Empresas" para seleccionar o registrar una firma corporativa activa.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] py-12">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-3">Compilando datos del diagnóstico...</span>
      </div>
    );
  }

  // 17-Page Chapters List
  const chapters = [
    { num: 1, title: "1. Portada" },
    { num: 2, title: "2. Índice General" },
    { num: 3, title: "3. Objetivo del Estudio" },
    { num: 4, title: "4. Datos Generales de la Empresa" },
    { num: 5, title: "5. Localización de la Empresa" },
    { num: 6, title: "6. Infraestructura de las Instalaciones" },
    { num: 7, title: "7. Introducción del Estudio" },
    { num: 8, title: "8. Marco Legal" },
    { num: 9, title: "9. Normativa Aplicable (NOM)" },
    { num: 10, title: "10. Descripción del Proceso" },
    { num: 11, title: "11. Metodología de Evaluación" },
    { num: 12, title: "12. Matriz de Riesgos" },
    { num: 13, title: "13. Accidentabilidad y Gráficas" },
    { num: 14, title: "14. Programa de Seguridad y Salud" },
    { num: 15, title: "15. Bitácora de Evidencias" },
    { num: 16, title: "16. Conclusiones y Recomendaciones" },
    { num: 17, title: "17. Anexos Técnicos" }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
      
      {/* LEFT COLUMN: ADOBE-LIKE PDF NAVIGATION & CONTROL PANEL */}
      <div className="lg:col-span-1 bg-slate-900 text-slate-100 rounded-[2rem] p-5 shadow-2xl space-y-6 border border-slate-800 self-start no-print">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-black uppercase tracking-wider text-white">Consola PDF</h2>
          </div>
          <span className="text-[10px] uppercase bg-green-950 text-green-400 font-extrabold px-2 py-0.5 rounded border border-green-900">
            NOM-030
          </span>
        </div>

        {/* NAVEGACIÓN DE HOJA ANTERIOR / SIGUIENTE */}
        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Navegación de Páginas</label>
          <div className="flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-800">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-slate-800 h-8 w-8 disabled:opacity-30"
              onClick={() => scrollToPage(Math.max(1, activePage - 1))}
              disabled={activePage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-black text-slate-200">
              Págs. <span className="text-white text-sm">{activePage}</span> / 17
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-slate-800 h-8 w-8 disabled:opacity-30"
              onClick={() => scrollToPage(Math.min(17, activePage + 1))}
              disabled={activePage === 17}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ZOOM CONTROLS */}
        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Zoom del Previsualizador</label>
          <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800 items-center">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-300 hover:text-white hover:bg-slate-800 h-8 w-full rounded-lg"
              onClick={() => setDocumentScale(s => Math.max(0.4, s - 0.1))}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <span className="text-center font-bold text-[10px] text-white">
              {Math.round(documentScale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-300 hover:text-white hover:bg-slate-800 h-8 w-full rounded-lg"
              onClick={() => setDocumentScale(s => Math.min(1.5, s + 0.1))}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="flex-1 text-[9px] font-bold h-7 bg-slate-950 hover:bg-slate-850 hover:text-white border border-slate-800 rounded-lg py-0"
              onClick={() => setDocumentScale(0.85)}
            >
              <Minimize2 className="w-3 h-3 mr-1" /> Ajustar Pantalla
            </Button>
            <Button
              variant="ghost"
              className="flex-1 text-[9px] font-bold h-7 bg-slate-950 hover:bg-slate-850 hover:text-white border border-slate-800 rounded-lg py-0"
              onClick={() => setDocumentScale(1.0)}
            >
              <Maximize2 className="w-3 h-3 mr-1" /> Original (100%)
            </Button>
          </div>
        </div>

        {/* CREADO MANUAL / EDICIÓN EN LÍNEA REMOVED */}

        {/* INTEGRACIÓN DE INTELIGENCIA ARTIFICIAL */}
        <div className="space-y-2 bg-indigo-950/40 p-3.5 rounded-2xl border border-indigo-900/40">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span className="text-[10px] font-black uppercase text-indigo-300 tracking-wider">Servicios Inteligentes IA</span>
          </div>
          <p className="text-[9px] text-indigo-200/70 leading-normal mb-2.5">
            Gemini estructurará el Objetivo, la Introducción, las Conclusiones y Recomendaciones cruzando la información guardada.
          </p>
          <Button
            onClick={handleAIGeneration}
            disabled={isAISuggesting || isGeneratingPDF}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl h-9 flex items-center justify-center gap-1 shadow-lg shadow-indigo-900/30"
          >
            {isAISuggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Sincronizar con IA
          </Button>
        </div>

        {/* ACCIÓN PRINCIPAL DE CARTA PDF */}
        <div className="space-y-2">
          <Button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF || isAISuggesting}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider rounded-xl h-11 flex items-center justify-center gap-2 shadow-xl shadow-blue-900/20"
          >
            {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Generar PDF Profesional
          </Button>
        </div>

        {/* NAVEGADOR DE CAPÍTULOS */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Estructura del Informe</label>
          <div className="max-h-[30vh] overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-slate-850">
            {chapters.map((ch) => (
              <button
                key={ch.num}
                onClick={() => scrollToPage(ch.num)}
                className={cn(
                  "w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between",
                  activePage === ch.num 
                    ? "bg-indigo-650 text-white font-bold" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                )}
              >
                <span className="truncate">{ch.title}</span>
                <span className="text-[9px] font-bold text-slate-500 select-none bg-slate-950 px-1 py-0.5 rounded ml-1 min-w-[1.5rem] text-center">
                  P.{ch.num}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: PROFESSIONAL PDF VIEWER EMBEDDED ZONE */}
      <div className="lg:col-span-3 flex flex-col items-center">
        {/* PDF Viewport Status Bar */}
        <div className="w-full mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm no-print gap-2">
          <div className="flex items-center gap-2 text-slate-500">
            <div className={cn("w-2.5 h-2.5 rounded-full", isEditMode ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
            <span className="text-[9px] font-black uppercase tracking-widest">
              {isEditMode ? "Modo Editor de Diagnóstico Activo" : "Previsualización técnica (Adobe PDF Style)"}
            </span>
          </div>
          <div className="text-[8px] sm:text-[9px] font-black uppercase text-slate-400 bg-slate-100 px-3 py-1 rounded-lg">
            Formato Estándar: Carta (215.9mm x 279.4mm)
          </div>
        </div>

        {/* WORD WYSIWYG FORMATTING TOOLBAR REMOVED */}

        {/* ACTUAL COMPONENT PAGES WRAPPED */}
        <div 
          className="w-full overflow-y-auto overflow-x-auto flex justify-center py-8 bg-slate-100/50 rounded-[2.5rem] border border-slate-250 shadow-inner max-h-[110vh] scroll-smooth"
        >
          <div 
            className="origin-top transition-transform duration-100 ease-out"
            style={{ 
              transform: `scale(${documentScale})`,
              width: '215.9mm',
              height: 'fit-content'
            }}
          >
            {/* THIS IS THE EXPORTABLE ELEMENT */}
            <div 
              id="documento-preview-pdf"
              className="bg-slate-200/40 p-0 text-slate-900 font-sans"
              style={{
                fontFamily: 'Arial, ui-sans-serif, system-ui, sans-serif',
                width: '215.9mm'
              }}
            >
              {/* PAGE STYLE CONFIGURATIONS FOR PRINT INTEGRATION */}
              <style dangerouslySetInnerHTML={{ __html: `
                .report-page-container {
                  font-family: 'Arial', sans-serif !important;
                  background-color: white !important;
                  width: 215.9mm !important;
                  height: 272mm !important;
                  min-height: 272mm !important;
                  box-sizing: border-box !important;
                  padding: 1.6cm !important;
                  margin: 0 auto 30px auto !important;
                  box-shadow: 0 10px 30px rgba(0,0,0,0.06) !important;
                  border: 1px solid #e2e8f0 !important;
                  position: relative !important;
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: space-between !important;
                  overflow: hidden !important;
                }
                .report-page-container.portada-custom {
                  padding: 0 !important;
                  display: flex !important;
                  flex-direction: row !important;
                }
                /* MS Word interactive editing styles */
                .report-page-container[contenteditable="true"] {
                  outline: 2px dashed #cbd5e1 !important;
                  outline-offset: 4px !important;
                  transition: outline-color 0.2s, box-shadow 0.2s !important;
                }
                .report-page-container[contenteditable="true"]:hover {
                  outline-color: #f59e0b !important;
                  box-shadow: 0 0 0 10px rgba(245, 158, 11, 0.02), 0 15px 45px rgba(0,0,0,0.1) !important;
                }
                .report-page-container[contenteditable="true"] td:hover, 
                .report-page-container[contenteditable="true"] th:hover,
                .report-page-container[contenteditable="true"] p:hover,
                .report-page-container[contenteditable="true"] h1:hover,
                .report-page-container[contenteditable="true"] h2:hover,
                .report-page-container[contenteditable="true"] h3:hover,
                .report-page-container[contenteditable="true"] h4:hover,
                .report-page-container[contenteditable="true"] li:hover,
                .report-page-container[contenteditable="true"] strong:hover {
                  outline: 1.5px dashed #2563eb !important;
                  outline-offset: 1.5px !important;
                  cursor: text !important;
                }
                .report-page-container[contenteditable="true"] *:focus {
                  outline: 2.5px solid #2563eb !important;
                  background-color: rgba(37, 99, 235, 0.02) !important;
                  box-shadow: 0px 4px 12px rgba(37, 99, 235, 0.05) !important;
                }
                .report-page-container > div:nth-child(2) {
                  flex: 1 !important;
                }
                h1, h2, h3, h4 {
                  font-family: 'Arial', sans-serif !important;
                }
                .p-justified {
                  text-align: justify !important;
                  text-justify: inter-word !important;
                  font-size: 10pt !important;
                  line-height: 1.5 !important;
                  color: #334155 !important;
                }
                table {
                  width: 100% !important;
                  border-collapse: collapse !important;
                  font-family: 'Arial', sans-serif !important;
                  font-size: 8.5pt !important;
                  break-inside: auto !important;
                }
                tr {
                  break-inside: avoid !important;
                }
                thead {
                  display: table-header-group !important;
                }
                th {
                  font-family: 'Arial', sans-serif !important;
                  background-color: #0f172a !important;
                  color: white !important;
                  font-weight: 700 !important;
                  text-align: left !important;
                  padding: 6px 8px !important;
                }
                td {
                  padding: 5px 8px !important;
                  border-bottom: 1px solid #e2e8f0 !important;
                }
                .section-header {
                  border-bottom: 2px solid #0f172a !important;
                  padding-bottom: 4px !important;
                  margin-bottom: 12px !important;
                  display: flex !important;
                  justify-content: space-between !important;
                  align-items: center !important;
                }
                .section-title {
                  font-size: 12pt !important;
                  font-weight: 700 !important;
                  color: #0f172a !important;
                  text-transform: uppercase !important;
                }
                .report-header-area {
                  display: flex !important;
                  justify-content: space-between !important;
                  align-items: center !important;
                  border-bottom: 1px solid #cbd5e1 !important;
                  padding-bottom: 8px !important;
                  margin-bottom: 16px !important;
                  font-size: 8px !important;
                  color: #64748b !important;
                  text-transform: uppercase !important;
                }
                .report-header-area img {
                  max-height: 10px !important;
                }
                .report-footer-area {
                  border-top: 1px solid #cbd5e1 !important;
                  padding-top: 8px !important;
                  margin-top: 16px !important;
                  display: flex !important;
                  justify-content: space-between !important;
                  align-items: center !important;
                  font-size: 8px !important;
                  color: #64748b !important;
                  font-weight: bold !important;
                }
              ` }} />

              {/* PÁGINA 1: PORTADA */}
              <div 
                ref={(el) => { if (el) pageRefs.current[0] = el; }}
                className="report-page-container portada-custom relative overflow-hidden flex flex-row !p-0 bg-white"
              >
                {/* Left Accent Column (Book Spine / Technical Motif) */}
                <div className="w-[50px] shrink-0 bg-slate-900 flex flex-col justify-between items-center py-10 text-white relative border-r border-slate-950 select-none">
                  {/* Spine Top - Shield Badge */}
                  <div className="flex flex-col items-center gap-1">
                    <ShieldCheck className="w-5 h-5 text-amber-500" />
                    <span className="text-[5px] font-black text-amber-500 font-mono tracking-widest">NOM-030</span>
                  </div>

                  {/* Spine Middle - Rotated Vertical Typography */}
                  <div className="flex items-center justify-center w-full">
                    <span className="text-[7.5px] font-extrabold tracking-[0.25em] text-slate-400 uppercase whitespace-nowrap [writing-mode:vertical-lr] rotate-180">
                      SISTEMA DE GESTIÓN DE SEGURIDAD Y SALUD EN EL TRABAJO • STPS MÉXICO
                    </span>
                  </div>

                  {/* Spine Bottom - Standard / Audit Hallmark */}
                  <div className="flex flex-col items-center">
                    <div className="w-4 h-px bg-slate-700 mb-2"></div>
                    <Award className="w-4 h-4 text-slate-500" />
                    <span className="text-[5px] font-bold text-slate-500 mt-1 font-mono">STPS</span>
                  </div>

                  {/* Absolute positioning of vertical colored accent bar */}
                  <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-indigo-600 via-sky-500 to-amber-500" />
                </div>

                {/* Main Content Area (Right side) */}
                <div className="flex-1 flex flex-col justify-between p-12 text-left h-full relative">
                  {/* Subtle Geometric Background Watermark */}
                  {company.coverBackground ? (
                    <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden select-none">
                      <img 
                        src={company.coverBackground} 
                        alt="Background Cover" 
                        className="w-full h-full object-cover opacity-15"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-tr from-white via-white/80 to-transparent" />
                    </div>
                  ) : (
                    <>
                      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-50/20 rounded-full blur-3xl -z-10 pointer-events-none" />
                      <div className="absolute bottom-10 right-10 w-[200px] h-[200px] bg-amber-50/10 rounded-full blur-2xl -z-10 pointer-events-none" />
                    </>
                  )}

                  {/* Header Row: Document Metadata and Logo */}
                  <div className="w-full flex justify-between items-start border-b border-slate-100 pb-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[7px] font-black text-amber-600 bg-amber-100/50 border border-amber-200/50 px-2 py-0.5 rounded uppercase tracking-wider">
                          Vigencia Federal NOM-030-STPS
                        </span>
                        <span className="text-[7px] font-black text-slate-500 bg-slate-100 border border-slate-200/50 px-2 py-0.5 rounded uppercase tracking-wider">
                          Estatus: Aprobado
                        </span>
                      </div>
                      <p className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-widest mt-1">
                        SECRETARÍA DEL TRABAJO Y PREVISIÓN SOCIAL COADYUVANTE
                      </p>
                    </div>

                    {company.logo && !company.logo.startsWith('data:application/pdf') ? (
                      <div className="bg-white p-1.5 border border-slate-200 rounded-xl shadow-xs max-w-[120px] max-h-[50px] flex items-center justify-center">
                        <img 
                          referrerPolicy="no-referrer"
                          src={company.logo} 
                          alt="Logo Corporativo" 
                          className="max-h-10 w-auto object-contain"
                        />
                      </div>
                    ) : company.logo && company.logo.startsWith('data:application/pdf') ? (
                      <div className="bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 flex flex-col items-center">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="text-[6.5px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-1">Logo PDF</span>
                      </div>
                    ) : (
                      <div className="bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-150 text-slate-400 font-bold text-[8.5px] uppercase tracking-widest flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        Sin Logotipo
                      </div>
                    )}
                  </div>

                  {/* Hero Section: Report Title */}
                  <div className="my-auto space-y-6">
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-indigo-600 tracking-[0.4em] uppercase block">
                        DICTAMEN DIAGNÓSTICO INTEGRAL Y PLAN INTEGRADO
                      </span>
                      <h1 className="text-[34px] font-black text-slate-900 leading-[1.08] uppercase tracking-[-0.03em]">
                        Diagnóstico Técnico Situacional<br/>
                        <span className="text-indigo-950">
                          de Seguridad y Salud ocupacional
                        </span>
                      </h1>
                      <div className="w-24 h-1.5 bg-gradient-to-r from-indigo-500 to-amber-500 rounded-full mt-4" />
                    </div>

                    <p className="text-[10.5px] text-slate-500 max-w-xl leading-relaxed mt-4 text-justify font-normal">
                      Informe de diagnóstico situacional formulado para dar cumplimiento legal estricto a las obligaciones en materia de prevención, higiene y medio ambiente de los centros de trabajo. Estructurado rigurosamente bajo los lineamientos metodológicos de los servicios preventivos de seguridad y salud de la República Mexicana.
                    </p>

                    {/* Architectural Technical Meta Grid */}
                    <div className="border border-slate-200/80 rounded-2xl bg-slate-50/50 p-6 relative overflow-hidden mt-8">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-slate-100 -rotate-45 translate-x-12 -translate-y-12 border-b border-l border-slate-200" />
                      
                      <h3 className="text-[9px] font-black uppercase text-slate-500 border-b border-slate-200 pb-2.5 mb-4 tracking-widest flex items-center gap-1.5 font-mono">
                        <Building2 className="w-3.5 h-3.5 text-indigo-600" /> FICHA DE REGISTRO IDENTIFICATORIA
                      </h3>
                      
                      <div className="grid grid-cols-2 gap-x-10 gap-y-4">
                        <div className="space-y-0.5">
                          <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest block">Razón Social o Centro</span>
                          <span className="text-xs font-black text-slate-800 break-words line-clamp-2 uppercase leading-tight">{company.name}</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest block">Matrícula / RFC Empleador</span>
                          <span className="text-xs font-bold text-slate-800 font-mono tracking-wider">{company.rfc || 'No especificado'}</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest block">Responsable de Elaboración</span>
                          <span className="text-xs font-bold text-slate-800 uppercase leading-none">{company.responsibleName || 'No asignado'}</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest block">Fecha de Realización</span>
                          <span className="text-xs font-black text-slate-700 uppercase leading-none">
                            {company.studyDate ? new Date(company.studyDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Row: Legal disclaimer, stamp placeholders, and Slogan */}
                  <div className="border-t border-slate-100 pt-5 flex justify-between items-center bg-transparent">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                      <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest font-mono">
                        ID DE AUDIT: NOM030-{company.rfc ? company.rfc.substring(0, 6) : 'AUDIT'}
                      </span>
                    </div>

                    <div className="text-right">
                      {company.slogan ? (
                        <p className="text-[10px] italic text-slate-600 font-serif font-medium mt-0.5 mb-1 animate-pulse">
                          "{company.slogan}"
                        </p>
                      ) : (
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          SEGURIDAD Y PREVENCIÓN ACTIVA
                        </p>
                      )}
                      <span className="text-[7.5px] text-slate-400 uppercase tracking-widest font-bold block">
                        © {new Date().getFullYear()} {company.name} • DERECHOS REGISTRADOS
                      </span>
                    </div>
                  </div>
                </div>
              </div>


              {/* PÁGINA 2: ÍNDICE DE CONTENIDO */}
              <div 
                ref={(el) => { if (el) pageRefs.current[1] = el; }}
                className="report-page-container"
              >
                <div className="report-header-area">
                  <span>{company.name}</span>
                  <span>Diagnóstico formal NOM-030-STPS</span>
                </div>

                <div className="space-y-6">
                  <div className="section-header">
                    <span className="section-title">Índice General</span>
                    <span className="text-[9px] font-black text-slate-400">Página 02</span>
                  </div>

                  <p className="text-xs text-slate-500 leading-normal max-w-xl pb-2">
                    A continuación se presenta el desglose temático con numeración específica del presente diagnóstico técnico estructural:
                  </p>

                  <div className="space-y-1.5 text-xs text-slate-700">
                    {[
                      { num: "01", title: "Portada del Dictamen de Seguridad", p: "1" },
                      { num: "02", title: "Índice General de Secciones", p: "2" },
                      { num: "03", title: "Objetivo General del Diagnóstico", p: "3" },
                      { num: "04", title: "Datos Generales e Identificación Corporativa", p: "4" },
                      { num: "05", title: "Localización Geográfica del Centro de Trabajo", p: "5" },
                      { num: "06", title: "Infraestructura de las Instalaciones y Entorno", p: "6" },
                      { num: "07", title: "Introducción y Contextualización del Estudio", p: "7" },
                      { num: "08", title: "Marco Legal y Requisitos de Autoridad", p: "8" },
                      { num: "09", title: "Normativa Oficial Mexicana Aplicable (NOM)", p: "9" },
                      { num: "10", title: "Descripción del Proceso Operativo y Flujograma", p: "10" },
                      { num: "11", title: "Metodología de Evaluación de Riesgos Laborales", p: "11" },
                      { num: "12", title: "Matriz Consolidada de Riesgos y Hallazgos", p: "12" },
                      { num: "13", title: "Accidentabilidad e Índices de Siniestralidad (IF / IG)", p: "13" },
                      { num: "14", title: "Programa Integral de Seguridad y Salud Ocupacional", p: "14" },
                      { num: "15", title: "Bitácora Complementaria de Evidencias de Cumplimiento", p: "15" },
                      { num: "16", title: "Conclusiones Analíticas y Recomendaciones Profesionales", p: "16" },
                      { num: "17", title: "Anexos de Soporte (Acta Constitutiva y Obligaciones)", p: "17" }
                    ].map((idx) => (
                      <div 
                        key={idx.num}
                        onClick={() => scrollToPage(parseInt(idx.p))}
                        className="flex justify-between items-center py-1 border-b border-dashed border-slate-100 hover:border-indigo-300 hover:text-indigo-650 cursor-pointer transition-colors"
                      >
                        <div className="flex gap-2">
                          <span className="font-extrabold text-slate-400">{idx.num}</span>
                          <span className="font-semibold">{idx.title}</span>
                        </div>
                        <div className="flex-1 border-b border-dotted border-slate-200 mx-2 self-end h-1" />
                        <span className="font-black">Pág. {idx.p}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="report-footer-area">
                  <span>VIGILANCIA NOM-030</span>
                  <span>Página 2 de 17</span>
                </div>
              </div>


              {/* PÁGINA 3: OBJETIVO DEL ESTUDIO */}
              <div 
                ref={(el) => { if (el) pageRefs.current[2] = el; }}
                className="report-page-container"
              >
                <div className="report-header-area">
                  <span>{company.name}</span>
                  <span>Diagnóstico formal NOM-030-STPS</span>
                </div>

                <div className="space-y-6">
                  <div className="section-header">
                    <span className="section-title">Objetivo del Estudio</span>
                    <span className="text-[9px] font-black text-slate-400">Página 03</span>
                  </div>

                  <div className="p-perfect border-l-4 border-indigo-500 pl-4 py-1 italic bg-indigo-50/50 rounded-r-xl p-4">
                    <p className="text-slate-600 font-medium">Declaratoria de Objetivo:</p>
                    <p 
                      id="editable-report-target"
                      className="p-justified italic mt-2 text-slate-700 whitespace-pre-wrap outline-none"
                      contentEditable={isEditMode}
                      suppressContentEditableWarning={true}
                    >
                      {target}
                    </p>
                  </div>

                  <div className="space-y-4 pt-4">
                    <h4 className="text-[10px] font-black text-[#0f172a] uppercase tracking-wider">Alcance de la Evaluación Diagnóstica:</h4>
                    <p className="p-justified text-xs">
                      El alcance de este dictamen abarca todo el perímetro físico, maquinaria, materias primas y personal operativo que conforma el centro de trabajo de <strong>{company.name}</strong>. Se evalúan puntualmente las medidas de control administrativo y físico a fin de mitigar riesgos de accidentes o detrimentos en la salud de la fuerza laboral expuesta.
                    </p>
                  </div>
                </div>

                <div className="report-footer-area">
                  <span>VIGILANCIA NOM-030</span>
                  <span>Página 3 de 17</span>
                </div>
              </div>


              {/* PÁGINA 4: DATOS GENERALES DE LA EMPRESA */}
              <div 
                ref={(el) => { if (el) pageRefs.current[3] = el; }}
                className="report-page-container"
              >
                <div className="report-header-area">
                  <span>{company.name}</span>
                  <span>Diagnóstico formal NOM-030-STPS</span>
                </div>

                <div className="space-y-6">
                  <div className="section-header">
                    <span className="section-title">Datos Generales de la Empresa</span>
                    <span className="text-[9px] font-black text-slate-400">Página 04</span>
                  </div>

                  <p className="p-justified">
                    Estructura constitutiva e información fáctica del centro de trabajo declarada formalmente en los expedientes corporativos:
                  </p>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {[
                      { l: "Razón Social o Nombre", v: company.name },
                      { l: "Registro Federal de Contribuyentes (RFC)", v: company.rfc },
                      { l: "Actividad Comercial Registrada", v: company.activity },
                      { l: "Giro Comercial / Línea de Negocios", v: company.businessLine || "No especificado" },
                      { l: "Cantidad de Colaboradores Activos", v: `${company.workerCount} trabajadores` },
                      { l: "Clase de Riesgo (IMSS)", v: `Clase ${company.riskLevel}` },
                      { l: "Turnos Operativos Declarados", v: company.shifts || "Un solo turno matutino" },
                      { l: "Superficie Total del Predio", v: company.totalPlotArea ? `${company.totalPlotArea} m²` : "No declarada" },
                      { l: "Superficie Total Construida", v: company.totalBuiltArea ? `${company.totalBuiltArea} m²` : "No declarada" },
                      { l: "Condición Legal del Predio", v: company.propertyStatus ? company.propertyStatus.toUpperCase() : "PROPIEDAD PROPIA" }
                    ].map((item, key) => (
                      <div key={key} className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-1 pdf-no-break">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">{item.l}</span>
                        <span className="text-xs font-black text-slate-800 tracking-tight block">{item.v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="report-footer-area">
                  <span>VIGILANCIA NOM-030</span>
                  <span>Página 4 de 17</span>
                </div>
              </div>


              {/* PÁGINA 5: LOCALIZACIÓN DE LA EMPRESA */}
              <div 
                ref={(el) => { if (el) pageRefs.current[4] = el; }}
                className="report-page-container"
              >
                <div className="report-header-area">
                  <span>{company.name}</span>
                  <span>Diagnóstico de Ubicación</span>
                </div>

                <div className="space-y-2">
                  <div className="section-header">
                    <span className="section-title">Localización de la Empresa</span>
                    <span className="text-[9px] font-black text-slate-400">Página 05</span>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3 items-start">
                      <div className="space-y-2 text-xs">
                        <div className="bg-slate-50 border border-slate-150 rounded-xl p-2 pdf-no-break">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">Dirección Postal</span>
                          <p className="font-semibold text-slate-850 leading-relaxed text-justify text-[8.5px]">{company.address || "No registrada"}</p>
                        </div>

                        <div className="bg-slate-50 border border-slate-150 rounded-xl p-2 pdf-no-break">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">Coordenadas de Referencia</span>
                          <div className="grid grid-cols-3 gap-2 text-[8.5px] font-extrabold text-slate-755">
                            <p>Lat: {company.latitude || "No reg"}</p>
                            <p>Lng: {company.longitude || "No reg"}</p>
                            <p>Alt: {company.altitude ? `${company.altitude} m` : "No reg"}</p>
                          </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-150 rounded-xl p-2 pdf-no-break">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">Accesibilidad Vial</span>
                          <p className="text-[8px] text-slate-650 mt-0.5 text-justify leading-relaxed">{company.accessibilityDescription || "Acceso directo mediante vialidades primarias pavimentadas sin obstrucción de tránsito pesado."}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex flex-col items-center justify-center p-2 border border-slate-200 rounded-xl bg-slate-50 max-h-[110px]">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Croquis de Macrolocalización</span>
                          {company.localizationSketch && !company.localizationSketch.startsWith('data:application/pdf') ? (
                            <div className="relative border border-slate-200 p-0.5 bg-white rounded-lg h-full max-h-[75px] flex items-center justify-center overflow-hidden">
                              <img 
                                src={company.localizationSketch} 
                                alt="Croquis" 
                                className="max-h-[65px] max-w-full object-contain rounded"
                              />
                            </div>
                          ) : company.localizationSketch && company.localizationSketch.startsWith('data:application/pdf') ? (
                            <div className="relative border border-slate-200 p-1 bg-white rounded-lg h-full max-h-[75px] flex flex-col items-center justify-center text-center overflow-hidden">
                              <FileText className="w-5 h-5 text-blue-500 mb-0.5" />
                              <span className="text-[7.5px] font-bold text-slate-500 uppercase">Croquis en PDF</span>
                              <p className="text-[6px] text-slate-400 mt-0.5 leading-tight">Sube PNG o JPG para visualizarlo aquí.</p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-16 w-full border border-dashed border-slate-300 rounded-xl p-1 text-center">
                              <MapPin className="w-4 h-4 text-slate-300 mb-0.5" />
                              <span className="text-[7.5px] font-bold text-slate-400 uppercase">Sin croquis de ubicación</span>
                            </div>
                          )}
                        </div>

                        <div className="bg-slate-50 border border-slate-150 rounded-xl p-2 flex flex-col gap-1 pdf-no-break relative">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">Colindancias y Entorno Sustancial</span>
                          {(() => {
                            const text = company.surroundingHazardsDescription || "Ubicado cercanamente a intersecciones que facilitan el egreso de vehículos de auxilio.";
                            
                            // Si detectamos "GLOSARIO DE REFERENCIAS", lo separamos para darle estilo.
                            const hasGlossary = text.includes("GLOSARIO DE REFERENCIAS");
                            
                            if (hasGlossary) {
                              const splitArr = text.split("GLOSARIO DE REFERENCIAS");
                              return (
                                <>
                                  <div className="text-[8px] text-slate-650 text-justify space-y-0.5">
                                    {splitArr[0].split('\n').filter(p => p.trim()).map((p, i) => (
                                      <p key={`n-${i}`} className="pdf-no-break leading-normal">{p}</p>
                                    ))}
                                  </div>
                                  <div className="mt-0.5 pt-0.5 border-t border-slate-200">
                                    <span className="text-[7px] font-bold text-sky-600 uppercase tracking-wide block mb-0.5">Glosario de Referencias</span>
                                    <div className="text-[7.5px] text-slate-650 text-justify space-y-0.5">
                                      {splitArr[1].split('\n').filter(p => p.trim()).map((p, i) => (
                                        <p key={`g-${i}`} className="pdf-no-break leading-normal">{p}</p>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              );
                            }

                            // Fallback si no tiene "GLOSARIO DE REFERENCIAS" pero son muchos párrafos
                            return (
                              <div className="text-[8px] text-slate-650 text-justify space-y-0.5">
                                {text.split('\n').filter(p => p.trim() !== "").map((paragraph, idx) => (
                                  <p key={`p-${idx}`} className="pdf-no-break leading-normal">{paragraph}</p>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="report-footer-area">
                  <span>VIGILANCIA NOM-030</span>
                  <span>Página 5 de 17</span>
                </div>
              </div>


              {/* PÁGINA 6: INFRAESTRUCTURA DE LAS INSTALACIONES */}
              <div 
                ref={(el) => { if (el) pageRefs.current[5] = el; }}
                className="report-page-container"
              >
                <div className="report-header-area">
                  <span>{company.name}</span>
                  <span>Infraestructura Física</span>
                </div>

                <div className="space-y-3">
                  <div className="section-header">
                    <span className="section-title">Infraestructura y Áreas Identificadas</span>
                    <span className="text-[9px] font-black text-slate-400">Página 06</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 items-start">
                    <div className="space-y-3">
                      <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 pdf-no-break">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Descripción Mecánica Estructural</span>
                        <p className="text-[10px] text-slate-700 leading-relaxed text-justify">
                          {company.infrastructureDescription || "El centro de trabajo consta de muros de concreto, losas reforzadas con columnas de acero y pavimentación industrial con resistencia a vibraciones de maquinaria pesada."}
                        </p>
                      </div>

                      <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 pdf-no-break">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Áreas de Trabajo Distribuidas</span>
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {(() => {
                            try {
                              if (company.layoutAreas) {
                                const parsed = JSON.parse(company.layoutAreas);
                                if (Array.isArray(parsed)) {
                                  return parsed.map((a: any, i: number) => {
                                    const areaName = typeof a === 'object' && a !== null ? (a.name || a.title || "Área") : String(a);
                                    return (
                                      <span key={i} className="text-[8.5px] bg-slate-250 text-slate-800 px-1.5 py-0.5 rounded-full font-bold" title={typeof a === 'object' && a !== null ? a.description : undefined}>
                                        {areaName}
                                      </span>
                                    );
                                  });
                                }
                              }
                            } catch (e) {}
                            return ["Administración", "Producción", "Almacén", "Logística", "Mantenimiento"].map((a, i) => (
                              <span key={i} className="text-[8.5px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full font-bold">
                                {a}
                              </span>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center p-2 border border-slate-200 rounded-2xl bg-slate-50">
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Croquis del Centro de Trabajo</span>
                      {company.layoutUrl && !company.layoutUrl.startsWith('data:application/pdf') ? (
                        <div className="border border-slate-200 p-0.5 bg-white rounded-lg">
                          <img 
                             src={company.layoutUrl} 
                             alt="Croquis de Planta" 
                             className="max-h-[140px] max-w-full object-contain rounded"
                          />
                        </div>
                      ) : company.layoutUrl && company.layoutUrl.startsWith('data:application/pdf') ? (
                        <div className="border border-slate-200 p-2 bg-white rounded-lg flex flex-col items-center justify-center text-center">
                          <FileText className="w-6 h-6 text-blue-500 mb-1" />
                          <span className="text-[8px] font-bold text-slate-500 uppercase">Plano en PDF</span>
                          <p className="text-[6.5px] text-slate-400 mt-0.5 leading-normal">Se guardó en PDF. Sube una imagen PNG o JPG para visualizarla.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-28 w-full border border-dashed border-slate-300 rounded-xl p-2 text-center">
                          <Building2 className="w-6 h-6 text-slate-300 mb-1" />
                          <span className="text-[8px] font-bold text-slate-400 uppercase">Sin croquis de planta</span>
                          <p className="text-[7px] text-slate-400 mt-0.5">Sincronice la distribución física para asociarlo.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="report-footer-area">
                  <span>VIGILANCIA NOM-030</span>
                  <span>Página 6 de 17</span>
                </div>
              </div>


              {/* PÁGINA 7: INTRODUCCIÓN DEL ESTUDIO */}
              <div 
                ref={(el) => { if (el) pageRefs.current[6] = el; }}
                className="report-page-container"
              >
                <div className="report-header-area">
                  <span>{company.name}</span>
                  <span>Estructuración Técnica</span>
                </div>

                <div className="space-y-6">
                  <div className="section-header">
                    <span className="section-title">Introducción del Estudio</span>
                    <span className="text-[9px] font-black text-slate-400">Página 07</span>
                  </div>

                  <div className="space-y-4">
                    <p 
                      id="editable-report-intro"
                      className="p-justified whitespace-pre-wrap leading-relaxed outline-none"
                      contentEditable={isEditMode}
                      suppressContentEditableWarning={true}
                    >
                      {introduction}
                    </p>
                  </div>
                </div>

                <div className="report-footer-area">
                  <span>VIGILANCIA NOM-030</span>
                  <span>Página 7 de 17</span>
                </div>
              </div>


              {/* PÁGINA 8: MARCO LEGAL */}
              <div 
                ref={(el) => { if (el) pageRefs.current[7] = el; }}
                className="report-page-container"
              >
                <div className="report-header-area">
                  <span>{company.name}</span>
                  <span>Marco Legal</span>
                </div>

                <div className="space-y-6">
                  <div className="section-header">
                    <span className="section-title">Marco Legal de Referencia</span>
                    <span className="text-[9px] font-black text-slate-400">Página 08</span>
                  </div>

                  <p className="p-justified">
                    Obligatoriedad emanada directivamente en la Constitución Política, Ley Federal de Trabajo y el Reglamento Federal de Seguridad en el Trabajo en México:
                  </p>

                  <div className="space-y-5">
                    <table>
                      <thead>
                        <tr>
                          <th className="w-[15%] text-center uppercase tracking-tighter">Autoridad</th>
                          <th className="w-[25%] uppercase tracking-tighter">Código / Norma</th>
                          <th className="w-[60%] uppercase tracking-tighter">Descripción de Requisito Legal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {legalMatrix.length > 0 ? legalMatrix.slice(0, 6).map((req, idx) => (
                          <tr key={idx}>
                            <td className="text-center font-bold text-indigo-700">{req.authority}</td>
                            <td className="font-semibold text-slate-800">{req.nomCode}</td>
                            <td className="text-slate-600 text-[8pt] text-justify">{req.requirement}</td>
                          </tr>
                        )) : (
                          [
                            { a: "STPS", c: "Ley Federal de Trabajo", r: "Establecer la obligación patronal de mantener espacios físicos seguros e instrumentar diagnósticos." },
                            { a: "STPS", c: "RFST - Art. 17", r: "OBLIGA a elaborar un diagnóstico de seguridad y salud, y el respectivo programa de la Ley." },
                            { a: "IMSS", c: "LSS - Art. 71", r: "Declarar la siniestralidad de accidentes a fin de calcular la prima de riesgo correlativa." },
                            { a: "PC", c: "LGPCD", r: "Elaboración de planes de evacuación, simulacros anuales y brigadas de socorro certificadas." }
                          ].map((item, idx) => (
                            <tr key={idx}>
                              <td className="text-center font-bold text-slate-500">{item.a}</td>
                              <td className="font-semibold text-slate-800">{item.c}</td>
                              <td className="text-slate-600 text-[8pt] text-justify">{item.r}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="report-footer-area">
                  <span>VIGILANCIA NOM-030</span>
                  <span>Página 8 de 17</span>
                </div>
              </div>


              {/* PÁGINA 9: NORMATIVA APLICABLE */}
              <div 
                ref={(el) => { if (el) pageRefs.current[8] = el; }}
                className="report-page-container"
              >
                <div className="report-header-area">
                  <span>{company.name}</span>
                  <span>Normas Aplicables</span>
                </div>

                <div className="space-y-6">
                  <div className="section-header">
                    <span className="section-title">Normas Oficiales Mexicanas Aplicables</span>
                    <span className="text-[9px] font-black text-slate-400">Página 09</span>
                  </div>

                  <p className="p-justified">
                    Estatus de cumplimiento y diagnóstico de las principales Normas Oficiales Mexicanas dictadas por la Secretaría del Trabajo y Previsión Social (STPS):
                  </p>

                  <div className="space-y-4">
                    <table>
                      <thead>
                        <tr>
                          <th className="w-[15%] text-center tracking-tighter uppercase">Clave STPS</th>
                          <th className="w-[60%] tracking-tighter uppercase">Título de la Norma Evaluada</th>
                          <th className="w-[25%] text-center tracking-tighter uppercase">Cumplimiento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {checklistItems.length > 0 ? checklistItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="text-center font-bold text-indigo-850">{item.nomCode}</td>
                            <td className="text-slate-700 leading-tight font-medium text-[8pt]">{item.requirement}</td>
                            <td className="text-center">
                              <span className={cn(
                                "text-[7.5pt] font-black px-2 py-0.5 rounded-full uppercase",
                                item.compliance === 'compliance' ? "bg-emerald-50 text-emerald-705" :
                                item.compliance === 'partial' ? "bg-amber-50 text-amber-705" :
                                item.compliance === 'non_compliance' ? "bg-rose-50 text-rose-705" : "bg-slate-50 text-slate-505"
                              )}>
                                {item.compliance === 'compliance' ? "CUMPLE" :
                                 item.compliance === 'partial' ? "PARCIAL" :
                                 item.compliance === 'non_compliance' ? "NO CUMPLE" : "N/A"}
                              </span>
                            </td>
                          </tr>
                        )) : (
                          [
                            { c: "NOM-001-STPS-2008", t: "Edificios, locales, instalaciones y áreas de los centros de trabajo - Condiciones de seguridad.", s: "CUMPLE" },
                            { c: "NOM-002-STPS-2010", t: "Condiciones de seguridad - Prevención y protección contra incendios en los centros de trabajo.", s: "PARCIAL" },
                            { c: "NOM-009-STPS-2011", t: "Condiciones de seguridad para realizar trabajos en altura.", s: "PARCIAL" },
                            { c: "NOM-017-STPS-2008", t: "Equipo de protección personal - Selección, uso y manejo en los centros de trabajo.", s: "CUMPLE" },
                            { c: "NOM-025-STPS-2008", t: "Condiciones de iluminación en los centros de trabajo.", s: "CUMPLE" },
                            { c: "NOM-035-STPS-2018", t: "Factores de riesgo psicosocial en el trabajo - Identificación, análisis y prevención.", s: "CUMPLE" }
                          ].map((item, idx) => (
                            <tr key={idx}>
                              <td className="text-center font-bold text-slate-700">{item.c}</td>
                              <td className="text-slate-600 leading-tight font-medium text-[8pt]">{item.t}</td>
                              <td className="text-center">
                                <span className="bg-emerald-50 text-emerald-700 text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                                  {item.s}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="report-footer-area">
                  <span>VIGILANCIA NOM-030</span>
                  <span>Página 9 de 17</span>
                </div>
              </div>


              {/* PÁGINA 10: DESCRIPCIÓN DEL PROCESO */}
              {(() => {
                let steps: any[] = [];
                let isDiagramAvailable = false;
                if (company.processDescription) {
                  try {
                    const parsed = JSON.parse(company.processDescription);
                    if (Array.isArray(parsed)) {
                      steps = parsed;
                      isDiagramAvailable = true;
                    } else if (parsed && typeof parsed === 'object') {
                      steps = parsed.steps || [];
                      isDiagramAvailable = steps.length > 0;
                    }
                  } catch (e) {
                    isDiagramAvailable = false;
                  }
                }

                const getStepIcon = (type: string) => {
                  switch (type) {
                    case 'START': return <Circle className="w-3 h-3 text-green-500 fill-green-50 shrink-0" />;
                    case 'END': return <Circle className="w-3 h-3 text-red-500 fill-red-50 shrink-0" />;
                    case 'DECISION': return <Diamond className="w-3 h-3 text-amber-500 fill-amber-50 shrink-0" />;
                    case 'INPUT': return <Upload className="w-3 h-3 text-blue-500 shrink-0" />;
                    case 'OUTPUT': return <PackageIcon className="w-3 h-3 text-blue-500 shrink-0" />;
                    default: return <Square className="w-3 h-3 text-slate-500 fill-slate-50 shrink-0" />;
                  }
                };

                const getStepStyle = (type: string) => {
                  switch (type) {
                    case 'START': return "w-[240px] rounded-full border border-green-200 bg-green-50/45 py-1.5 px-4 shadow-sm text-center";
                    case 'END': return "w-[240px] rounded-full border border-red-200 bg-red-50/45 py-1.5 px-4 shadow-sm text-center";
                    case 'DECISION': return "w-[120px] h-[120px] relative flex items-center justify-center bg-white";
                    case 'INPUT':
                    case 'OUTPUT': return "w-[240px] border border-blue-150 bg-blue-50/45 py-1.5 px-4 shadow-sm";
                    default: return "w-[240px] rounded border border-slate-200 bg-white py-2 px-4 shadow-sm text-center";
                  }
                };

                const renderFlowchartSlice = (stepsSlice: any[], startIndex: number, showContinuationAtEnd: boolean, showContinuationAtStart: boolean) => {
                  return (
                    <div className="pdf-flowchart-scroll-container w-full relative overflow-y-auto max-h-[500px] p-3 bg-slate-100 rounded-lg border border-slate-150 shadow-inner flex flex-col items-center">
                      <div className="pdf-flowchart-zoom-inner w-full flex flex-col items-center py-2">
                        
                        {/* Continuation Connector at Start of Part 2 slice */}
                        {showContinuationAtStart && (
                          <div className="flex flex-col items-center w-full relative mb-2 shrink-0 select-none">
                            <div className="flex flex-col items-center justify-center py-1">
                              <div className="w-10 h-10 rounded-full border-2 border-dashed border-blue-500 bg-blue-50 flex items-center justify-center shadow-sm relative animate-pulse">
                                <span className="text-xs font-black text-blue-600 font-sans">A</span>
                              </div>
                              <span className="text-[7px] font-extrabold text-blue-600 uppercase tracking-widest mt-1">Conector A (Hoja 2)</span>
                              <span className="text-[6.5px] font-bold text-blue-400 mt-0.5 leading-none">Continuación del Proceso</span>
                            </div>
                            <div className="flex flex-col items-center relative py-1 shrink-0">
                              <div className="w-[1.5px] h-5 bg-gradient-to-b from-blue-400 to-slate-200 rounded-full my-0.5 modifier-pin"></div>
                              <ArrowDown className="w-3 h-3 text-slate-300 absolute -bottom-1 -translate-y-1/2 stroke-[2px]" />
                            </div>
                          </div>
                        )}

                        {stepsSlice.map((step: any, sliceIdx: number) => {
                          const overallIndex = startIndex + sliceIdx;
                          return (
                            <div key={step.id || overallIndex} className="flex flex-col items-center w-full relative h-auto" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                              <div className={`flex flex-col items-center justify-center ${step.type === 'DECISION' ? 'py-4' : 'py-1.5'}`}>
                                <div className={`border flex flex-col items-center justify-center bg-white relative ${getStepStyle(step.type)}`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                  
                                  {/* Diamond Background for DECISION */}
                                  {step.type === 'DECISION' && (
                                    <div className="absolute inset-0 border border-amber-300 bg-amber-50/50 rotate-45 shadow-xs" />
                                  )}

                                  <span className="absolute -top-1.5 left-2.5 bg-slate-100 text-slate-400 text-[6.5px] px-1 py-0.2 border border-slate-200 rounded font-black z-10 leading-none">
                                    {overallIndex + 1}
                                  </span>

                                  {step.type === 'DECISION' ? (
                                    <div className="relative z-10 flex flex-col items-center justify-center w-full px-2 text-center">
                                      <div className="opacity-50 mb-0.5 scale-75">{getStepIcon(step.type)}</div>
                                      <p className="text-[6.5px] font-bold text-slate-800 leading-snug max-h-[72px] overflow-hidden break-words font-sans">
                                        {step.text || "Decisión"}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className={`flex flex-col items-center w-full px-1 ${step.type === 'INPUT' || step.type === 'OUTPUT' ? 'skew-x-[-12deg]' : ''}`}>
                                      <div className="flex items-center gap-1 mb-0.5 opacity-50 scale-75">
                                        {getStepIcon(step.type)}
                                        <span className="text-[5.5px] font-bold text-slate-500 uppercase tracking-widest">{step.type}</span>
                                      </div>
                                      <div 
                                        style={{ textAlign: step.textAlign || 'center' }}
                                        className="w-full shrink-0"
                                      >
                                        <p className="text-[7.5px] font-bold text-slate-800 leading-snug whitespace-normal break-words font-sans">
                                          {step.text || (step.type === 'START' ? 'Empieza aquí' : step.type === 'END' ? 'Finaliza aquí' : `Etapa ${overallIndex + 1}`)}
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Decision Yes/No Leaves */}
                                  {step.type === 'DECISION' && (
                                    <>
                                      {/* YES BRANCH */}
                                      <div className="absolute left-[100%] top-1/2 -translate-y-1/2 flex items-center z-20 pl-0 mt-2">
                                        <div className="flex items-center">
                                          <div className="w-2 h-0.5 bg-blue-400 rounded-full"></div>
                                          <ArrowRight className="w-2 h-2 text-blue-500 -ml-0.5 stroke-[2.5px] shrink-0" />
                                        </div>
                                        <div className="flex flex-col items-start ml-0 bg-white/95 backdrop-blur-xs px-1 py-0.5 rounded border border-blue-100 shadow-xs font-sans scale-90 origin-left">
                                          <span className="text-[4px] font-bold text-blue-600 leading-none">SÍ</span>
                                          {step.nextStepId && (
                                            <div className="mt-0.5 text-[4px] font-medium text-blue-500 whitespace-nowrap leading-none">
                                              Ir a {steps.findIndex((s: any) => s.id === step.nextStepId) + 1 || "Fin"}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* NO BRANCH */}
                                      <div className="absolute right-[100%] top-1/2 -translate-y-1/2 flex items-center flex-row-reverse z-20 pr-0 mt-2">
                                        <div className="flex items-center flex-row-reverse">
                                          <div className="w-2 h-0.5 bg-red-400 rounded-full"></div>
                                          <ArrowRight className="w-2 h-2 text-red-500 -mr-0.5 rotate-180 stroke-[2.5px] shrink-0" />
                                        </div>
                                        <div className="flex flex-col items-end mr-0 bg-white/95 backdrop-blur-xs px-1 py-0.5 rounded border border-red-100 shadow-xs font-sans scale-90 origin-right">
                                          <span className="text-[4px] font-bold text-red-600 leading-none">NO</span>
                                          {step.altStepId && (
                                            <div className="mt-0.5 text-[4px] font-medium text-red-500 whitespace-nowrap leading-none font-sans">
                                              Ir a {steps.findIndex((s: any) => s.id === step.altStepId) + 1 || "Fin"}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Connector Arrows within flowchart slice */}
                              {(sliceIdx < stepsSlice.length - 1 || showContinuationAtEnd) && (
                                <div className="flex flex-col items-center relative py-0.5 shrink-0 font-sans">
                                  <div className={`w-[1.5px] bg-gradient-to-b from-slate-200 to-slate-100 rounded-full ${step.type === 'DECISION' ? 'h-4 -mt-3 mb-1' : 'h-5 my-0.5'}`}></div>
                                  <ArrowDown className="w-3 h-3 text-slate-300 absolute -bottom-1 -translate-y-1/2 stroke-[2px]" />
                                  
                                  {step.nextStepId && step.type !== 'DECISION' && (
                                    <div className="absolute top-1/2 -translate-y-1/2 -right-4 translate-x-full px-2 py-0.5 bg-slate-900 text-white text-[7px] font-bold uppercase rounded shadow-sm flex items-center gap-1 whitespace-nowrap z-30 leading-none">
                                      <Workflow className="w-2 h-2 text-blue-400" />
                                      Salto a {steps.findIndex((s: any) => s.id === step.nextStepId) + 1 || "Fin"}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Continuation Connector at bottom of Page 1 flowchart slice */}
                        {showContinuationAtEnd && (
                          <div className="flex flex-col items-center w-full relative mt-2 shrink-0 select-none">
                            <div className="flex flex-col items-center justify-center py-1 font-sans">
                              <div className="w-10 h-10 rounded-full border-2 border-dashed border-blue-500 bg-blue-50 flex items-center justify-center shadow-sm relative animate-pulse">
                                <span className="text-xs font-black text-blue-600">A</span>
                              </div>
                              <span className="text-[7px] font-extrabold text-blue-600 uppercase tracking-widest mt-1">Conector A (Continúa)</span>
                              <span className="text-[6.5px] font-bold text-blue-400 mt-0.5 leading-none">Ver en Siguiente Hoja</span>
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    <div 
                      ref={(el) => { if (el) pageRefs.current[9] = el; }}
                      className="report-page-container"
                    >
                      <div className="report-header-area">
                        <span>{company.name}</span>
                        <span>Proceso Operativo</span>
                      </div>

                      <div className="space-y-2.5">
                        <div className="section-header">
                          <span className="section-title">Descripción del Proceso y Diagrama de Flujo</span>
                          <span className="text-[9px] font-black text-slate-400">Página 10</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 items-start">
                          <div className="space-y-2.5 text-xs">
                            <div className="bg-slate-50 border border-slate-150 rounded-xl p-2.5 pdf-no-break">
                              <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Narrativa Operativa de Procesos</span>
                              <div className="text-slate-705 leading-normal text-justify text-[8.5px] whitespace-pre-wrap">
                                {(() => {
                                  let textDesc = "";
                                  let stepsList: any[] = [];
                                  
                                  if (company.processDescription) {
                                    try {
                                      const parsed = JSON.parse(company.processDescription);
                                      if (Array.isArray(parsed)) {
                                        stepsList = parsed;
                                      } else if (parsed && typeof parsed === 'object') {
                                        stepsList = parsed.steps || [];
                                        textDesc = parsed.customText || "";
                                      }
                                    } catch (e) {
                                      textDesc = company.processDescription;
                                    }
                                  }
                                  
                                  return (
                                    <div className="space-y-1.5">
                                      {textDesc && (
                                        <div>
                                          <p className="text-slate-800 leading-normal text-justify text-[8.5px]">
                                            {textDesc}
                                          </p>
                                        </div>
                                      )}
                                      {stepsList.length > 0 && (
                                        <div className="border-t border-slate-200/50 pt-1.5 mt-1">
                                          <p className="font-bold text-slate-800 text-[8px] mb-0.5">Fases cronológicas y operativas:</p>
                                          <div className="space-y-0.5 font-sans">
                                            {stepsList.map((p: any, idx: number) => (
                                              <div key={idx} className="flex gap-1 items-start text-[7.5px] leading-tight">
                                                <span className="font-extrabold text-slate-500 font-mono shrink-0">{idx + 1}.</span>
                                                <p className="text-slate-700">{p.text}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {!textDesc && stepsList.length === 0 && (
                                        <p className="italic text-slate-400 text-[8px]">
                                          No se ha capturado una descripción de los procesos operativos del establecimiento.
                                        </p>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-150 rounded-xl p-2.5 grid grid-cols-2 gap-2 pdf-no-break">
                              <div>
                                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wide block">Materias Primas</span>
                                <p className="text-[8.5px] text-slate-600 font-bold mt-0.5 uppercase leading-tight">{company.rawMaterials || "No especificadas"}</p>
                              </div>
                              <div>
                                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wide block">Maquinaria y Equipos</span>
                                <p className="text-[8.5px] text-slate-600 font-bold mt-0.5 uppercase leading-tight">{company.machinery || "No registradas"}</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 w-full pdf-no-break">
                            {/* Flowchart Section */}
                            {(company.processType === 'diagram' || isDiagramAvailable) && (
                              <div className="flex flex-col items-center w-full">
                                <div className="flex flex-col items-center p-2 border border-slate-150 rounded-xl bg-slate-50 w-full overflow-hidden pdf-no-break" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                  <span className="text-[7px] font-black text-slate-500 uppercase block mb-1 text-center tracking-[0.08em]">Diagrama de Flujo del Proceso</span>
                                  {steps.length > 5 ? (
                                    renderFlowchartSlice(steps.slice(0, 5), 0, true, false)
                                  ) : (
                                    renderFlowchartSlice(steps, 0, false, false)
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Uploaded File Image Box */}
                            {company.processFileUrl && !company.processFileUrl.startsWith('data:application/pdf') ? (
                              <div className="border border-slate-200 p-1 bg-white rounded-xl shadow-xs w-full flex flex-col items-center justify-center">
                                <span className="text-[6.5px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Croquis de Proceso Cargado</span>
                                <img 
                                  src={company.processFileUrl} 
                                  alt="Archivo del Proceso" 
                                  className="max-h-[72px] max-w-full object-contain rounded border border-slate-100"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ) : company.processFileUrl && company.processFileUrl.startsWith('data:application/pdf') ? (
                              <div className="border border-slate-200 p-2 bg-white rounded-xl shadow-xs w-full flex flex-col items-center justify-center text-center">
                                <FileText className="w-5 h-5 text-blue-500 mb-0.5" />
                                <span className="text-[7px] font-bold text-slate-500 uppercase">Diagrama en PDF</span>
                                <p className="text-[6px] text-slate-400 leading-normal">Sube un formato PNG o JPG para visualizar el diagrama dentro de este recuadro.</p>
                              </div>
                            ) : (
                              !(company.processType === 'diagram' || (company.processDescription && company.processDescription.startsWith('[')) || (company.processDescription && company.processDescription.includes('"steps"'))) && (
                                <div className="flex flex-col items-center justify-center p-1.5 border border-dashed border-slate-200 rounded-lg bg-white text-center h-16">
                                  <Layers className="w-3.5 h-3.5 text-slate-300 mb-0.5" />
                                  <span className="text-[7px] font-bold text-slate-400 uppercase">Sin croquis de soporte</span>
                                  <p className="text-[6px] text-slate-400 mt-0.5">Sube un croquis de respaldo en la sección de expediente.</p>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="report-footer-area">
                        <span>VIGILANCIA NOM-030</span>
                        <span>Página 10 de 17</span>
                      </div>
                    </div>

                    {/* SEGUNDA HOJA COHERENTE CON DIAGRAMAS DE FLUJO GRANDES */}
                    {steps.length > 5 && (
                      <div className="report-page-container">
                        <div className="report-header-area">
                          <span>{company.name}</span>
                          <span>Proceso Operativo</span>
                        </div>

                        <div className="space-y-2.5">
                          <div className="section-header">
                            <span className="section-title">Diagrama de Flujo del Proceso (Continuación)</span>
                            <span className="text-[9px] font-black text-rose-500 font-sans tracking-wide">Página 10 (Continuación)</span>
                          </div>

                          <div className="p-3 border border-slate-150 rounded-xl bg-slate-50 w-full overflow-hidden pdf-no-break" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                            <span className="text-[8px] font-black text-rose-500 uppercase block mb-2 text-center tracking-[0.1em]">
                              Diagrama de Flujo del Proceso (Continuación - Hoja 2)
                            </span>
                            {renderFlowchartSlice(steps.slice(5), 5, false, true)}
                          </div>
                        </div>

                        <div className="report-footer-area">
                          <span>VIGILANCIA NOM-030</span>
                          <span>Página 10 (Continuación) de 17</span>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}


              {/* PÁGINA 11: METODOLOGÍA PARA LA EVALUACIÓN DE RIESGOS */}
              <div 
                ref={(el) => { if (el) pageRefs.current[10] = el; }}
                className="report-page-container"
              >
                <div className="report-header-area">
                  <span>{company.name}</span>
                  <span>Marco Tecnológico</span>
                </div>

                <div className="space-y-6">
                  <div className="section-header">
                    <span className="section-title">Metodología de Evaluación de Riesgos</span>
                    <span className="text-[9px] font-black text-slate-400">Página 11</span>
                  </div>

                  <div className="space-y-4">
                    <p className="p-justified">
                      Para la presente declaratoria de diagnóstico técnico estructural, se adopta la metodología matemática formal de <strong>William T. Fine</strong>, la cual evalúa de forma multiplicativa las dimensiones fácticas de <strong>Consecuencias</strong>, <strong>Exposición</strong> y <strong>Probabilidad</strong>:
                    </p>

                    <div className="bg-slate-50 border border-slate-150 rounded-2xl p-6 flex flex-col items-center gap-3">
                      <span className="text-sm font-black text-indigo-800">Fórmula del Grado de Peligrosidad (GP):</span>
                      <span className="text-xl font-bold bg-white text-slate-900 border border-slate-200 px-6 py-2 rounded-xl border-dashed">
                        GP = C × E × P
                      </span>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest block mb-1">Criterios de Ponderación e Interpretación:</h4>
                      <p className="p-justified leading-relaxed">
                        • <strong>Consecuencias (C):</strong> Califica la severidad potencial de lesiones y daños materiales posibles derivados del peligro localizado. <br />
                        • <strong>Exposición (E):</strong> Frecuencia fáctica en la cual el colaborador se encuentra interactuando en la vecindad de la fuente de riesgo. <br />
                        • <strong>Probabilidad (P):</strong> Factibilidad estadística de que los acontecimientos concatenados terminen desencadenando el desenlace indeseado.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="report-footer-area">
                  <span>VIGILANCIA NOM-030</span>
                  <span>Página 11 de 17</span>
                </div>
              </div>


              {/* PÁGINA 12: MATRIZ DE RIESGOS */}
              <div 
                ref={(el) => { if (el) pageRefs.current[11] = el; }}
                className="report-page-container"
              >
                <div className="report-header-area">
                  <span>{company.name}</span>
                  <span>Evaluación de Riesgos</span>
                </div>

                <div className="space-y-6">
                  <div className="section-header">
                    <span className="section-title">Matriz Consolidada de Riesgos y Peligros</span>
                    <span className="text-[9px] font-black text-slate-400">Página 12</span>
                  </div>

                  <p className="p-justified">
                    Riesgos específicos y peligros circunstanciales identificados mediante auditoría física conforme GP (Grado de Peligrosidad) tanto al interior del centro de trabajo como en su entorno geográfico inmediato:
                  </p>

                  <div className="space-y-4">
                    {/* Sección 1: Riesgos Internos */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
                        <span className="w-1.5 h-3.5 bg-indigo-600 rounded-sm inline-block" />
                        <h4 className="text-[9px] font-black uppercase text-indigo-950 tracking-wider">
                          1. Factores de Riesgo Internos (Diagnóstico del Centro de Trabajo)
                        </h4>
                      </div>
                      <table>
                        <thead>
                          <tr>
                            <th className="w-[15%] text-center uppercase tracking-tighter">Grado GP</th>
                            <th className="w-[28%] uppercase tracking-tighter">Hallazgo de Riesgo</th>
                            <th className="w-[42%] uppercase tracking-tighter">Medidas de Reducción / Mitigación</th>
                            <th className="w-[15%] text-center uppercase tracking-tighter">Nivel</th>
                          </tr>
                        </thead>
                        <tbody>
                          {findings.length > 0 ? (
                            findings.slice(0, 3).map((f, idx) => {
                              const score = f.riskScore || 0;
                              return (
                                <tr key={idx}>
                                  <td className="text-center font-bold text-[10px] text-indigo-700">{score > 0 ? score : "-"}</td>
                                  <td className="font-semibold text-slate-800 text-[8pt] leading-tight">{f.title}</td>
                                  <td className="text-slate-600 text-[8pt] leading-normal">{f.correctiveAction || f.description}</td>
                                  <td className="text-center">
                                    <span className={cn(
                                      "text-[7pt] font-extrabold px-1.5 py-0.5 rounded-full uppercase",
                                      f.severity === 'critical' || f.severity === 'high' ? "bg-rose-50 text-rose-700" :
                                      f.severity === 'medium' ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                                    )}>
                                      {f.severity ? f.severity.toUpperCase() : "BAJO"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            [
                              { gp: "120", h: "Piso húmedo en área de almacén", m: "Colocación de tarimas antideslizantes de plástico reforzado.", l: "MEDIO", severity: "medium" },
                              { gp: "240", h: "Ruido excesivo en sala de sopladores", m: "Uso obligatorio de protección auditiva NOM-011 y cabinas aislantes.", l: "ALTO", severity: "high" },
                              { gp: "30", h: "Falta iluminación comedor de personal", m: "Reemplazo de tubos fluorescentes por luminarias led de alta eficiencia.", l: "BAJO", severity: "low" }
                            ].map((item, idx) => (
                              <tr key={idx}>
                                <td className="text-center font-semibold text-slate-500">{item.gp}</td>
                                <td className="font-semibold text-slate-800 text-[8pt]">{item.h}</td>
                                <td className="text-slate-600 text-[8pt]">{item.m}</td>
                                <td className="text-center">
                                  <span className={cn(
                                    "text-[7pt] font-extrabold px-1.5 py-0.5 rounded-full uppercase",
                                    item.severity === 'high' ? "bg-rose-50 text-rose-700" :
                                    item.severity === 'medium' ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                                  )}>
                                    {item.l}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Sección 2: Riesgos Externos */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
                        <span className="w-1.5 h-3.5 bg-amber-500 rounded-sm inline-block" />
                        <h4 className="text-[9px] font-black uppercase text-amber-950 tracking-wider">
                          2. Factores de Riesgo Externos (Amenazas en el Entorno y Colindancias)
                        </h4>
                      </div>
                      <table>
                        <thead>
                          <tr>
                            <th className="w-[15%] text-center uppercase tracking-tighter">Nivel Riesgo</th>
                            <th className="w-[28%] uppercase tracking-tighter">Fuente de Amenaza / Peligro</th>
                            <th className="w-[42%] uppercase tracking-tighter">Medidas de Mitigación / Protocolos</th>
                            <th className="w-[15%] text-center uppercase tracking-tighter">Gravedad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hazards.length > 0 ? (
                            hazards.slice(0, 3).map((h, idx) => {
                              const score = h.riskLevel || (h.probability * h.impact) || 0;
                              let severityLabel = "BAJO";
                              let severityClass = "bg-blue-50 text-blue-700";
                              if (score >= 15) {
                                severityLabel = "CRÍTICO";
                                severityClass = "bg-rose-50 text-rose-700";
                              } else if (score >= 8) {
                                severityLabel = "ALTO";
                                severityClass = "bg-rose-50 text-rose-600";
                              } else if (score >= 4) {
                                severityLabel = "MEDIO";
                                severityClass = "bg-amber-50 text-amber-700";
                              }

                              return (
                                <tr key={idx}>
                                  <td className="text-center font-bold text-[10px] text-amber-700">{score > 0 ? `${score} pts` : "-"}</td>
                                  <td className="font-semibold text-slate-800 text-[8pt] leading-tight">
                                    {h.source} <span className="text-[7px] font-normal text-slate-400 block mt-0.5">Tipo: {h.hazardType} • d: {h.distance}</span>
                                  </td>
                                  <td className="text-slate-600 text-[8pt] leading-normal">{h.mitigationMeasures}</td>
                                  <td className="text-center">
                                    <span className={cn("text-[7pt] font-extrabold px-1.5 py-0.5 rounded-full uppercase", severityClass)}>
                                      {severityLabel}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            [
                              { score: "12", h: "Estación de servicio de Gas LP colindante", m: "Monitoreo e integración de brigadas de evacuación en plan de emergencia.", l: "MEDIO", severity: "medium" },
                              { score: "16", h: "Tránsito constante de camiones de carga pesada", m: "Instalación de reductores de velocidad e iluminación de cruces viales.", l: "ALTO", severity: "high" },
                              { score: "3", h: "Riesgo de inundación pluvial municipal", m: "Limpieza periódica de rejillas pluviales y colocación de compuertas.", l: "BAJO", severity: "low" }
                            ].map((item, idx) => (
                              <tr key={idx}>
                                <td className="text-center font-semibold text-slate-500">{item.score} pts</td>
                                <td className="font-semibold text-slate-800 text-[8pt]">{item.h}</td>
                                <td className="text-slate-600 text-[8pt]">{item.m}</td>
                                <td className="text-center">
                                  <span className={cn(
                                    "text-[7pt] font-extrabold px-1.5 py-0.5 rounded-full uppercase",
                                    item.severity === 'high' ? "bg-rose-50 text-rose-700" :
                                    item.severity === 'medium' ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                                  )}>
                                    {item.l}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="report-footer-area">
                  <span>VIGILANCIA NOM-030</span>
                  <span>Página 12 de 17</span>
                </div>
              </div>


              {/* PÁGINA 13: ACCIDENTABILIDAD */}
              <div 
                ref={(el) => { if (el) pageRefs.current[12] = el; }}
                className="report-page-container"
              >
                <div className="report-header-area">
                  <span>{company.name}</span>
                  <span>Estadísticas de Siniestralidad</span>
                </div>

                <div className="space-y-6">
                  <div className="section-header">
                    <span className="section-title">Índices de Siniestralidad y Accidentabilidad</span>
                    <span className="text-[9px] font-black text-slate-400">Página 13</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                      <span className="text-[8px] font-black uppercase text-indigo-650 tracking-wider">Índice de Frecuencia (IF)</span>
                      <p className="text-2xl font-black text-[#0f172a] mt-1">{stats.if}</p>
                      <p className="text-[7.5px] text-slate-400 mt-1 italic">Casos por cada 200,000 HH de exposición</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                      <span className="text-[8px] font-black uppercase text-rose-650 tracking-wider">Índice de Gravedad (IG)</span>
                      <p className="text-2xl font-black text-rose-900 mt-1">{stats.ig}</p>
                      <p className="text-[7.5px] text-slate-400 mt-1 italic">Días perdidos por cada 200,000 HH</p>
                    </div>
                  </div>

                  {/* CUSTOM VECTOR SVG BAR CHART FOR ACCIDENT MONTHLY EVENTS */}
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 flex flex-col items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-4">Tendencia Mensual de Incidentes (GP / Siniestros)</span>
                    
                    <svg className="w-[140mm] h-[40mm] overflow-visible" viewBox="0 0 500 120">
                      {/* Grid Lines */}
                      <line x1="40" y1="20" x2="480" y2="20" stroke="#e2e8f0" strokeDasharray="3 3" />
                      <line x1="40" y1="50" x2="480" y2="50" stroke="#e2e8f0" strokeDasharray="3 3" />
                      <line x1="40" y1="80" x2="480" y2="80" stroke="#e2e8f0" strokeDasharray="3 3" />
                      <line x1="40" y1="100" x2="480" y2="100" stroke="#cbd5e1" strokeWidth="1.5" />
                      
                      {/* Bars & Labels */}
                      {[
                        { m: "Ene", val: 1 }, { m: "Feb", val: 0 }, { m: "Mar", val: 2 },
                        { m: "Abr", val: 1 }, { m: "May", val: 0 }, { m: "Jun", val: 3 },
                        { m: "Jul", val: 1 }, { m: "Ago", val: 0 }, { m: "Sep", val: 1 },
                        { m: "Oct", val: 0 }, { m: "Nov", val: 2 }, { m: "Dic", val: 0 }
                      ].map((item, idx) => {
                        const x = 50 + idx * 36;
                        const barHeight = item.val * 24;
                        const y = 100 - barHeight;
                        return (
                          <g key={idx}>
                            <rect x={x} y={y} width="16" height={barHeight} fill={item.val > 1 ? "#be123c" : "#4f46e5"} rx="3" />
                            <text x={x + 8} y={112} fontSize="8" textAnchor="middle" fill="#64748b" fontWeight="bold">{item.m}</text>
                            <text x={x + 8} y={y - 4} fontSize="7" textAnchor="middle" fill="#0f172a" fontWeight="black">{item.val}</text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[9px] font-bold text-slate-800 uppercase tracking-widest block">Bitácora Simplificada de Eventos:</h4>
                    <table>
                      <thead>
                        <tr>
                          <th className="w-[20%] text-center uppercase tracking-tighter">Fecha</th>
                          <th className="w-[15%] text-center uppercase tracking-tighter">Tipo</th>
                          <th className="w-[50%] uppercase tracking-tighter">Descripción de Siniestro</th>
                          <th className="w-[15%] text-center uppercase tracking-tighter">Días Perd.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accidentEvents.length > 0 ? accidentEvents.slice(0, 3).map((ev, key) => (
                          <tr key={key}>
                            <td className="text-center font-semibold text-slate-655">{new Date(ev.date).toLocaleDateString()}</td>
                            <td className="text-center font-bold text-rose-700 uppercase text-[7pt]">{ev.type}</td>
                            <td className="text-slate-600 text-[8pt] italic">{ev.description}</td>
                            <td className="text-center font-extrabold">{ev.daysLost}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={4} className="text-center italic text-slate-400 py-3">Sin incidentes de gravedad en el periodo vigente.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="report-footer-area">
                  <span>VIGILANCIA NOM-030</span>
                  <span>Página 13 de 17</span>
                </div>
              </div>


              {/* PÁGINA 14: PROGRAMA DE SEGURIDAD Y SALUD */}
              <div 
                ref={(el) => { if (el) pageRefs.current[13] = el; }}
                className="report-page-container"
              >
                <div className="report-header-area">
                  <span>{company.name}</span>
                  <span>Programa Anual</span>
                </div>

                <div className="space-y-6">
                  <div className="section-header">
                    <span className="section-title">Programa de Seguridad y Salud</span>
                    <span className="text-[9px] font-black text-slate-400">Página 14</span>
                  </div>

                  <p className="p-justified">
                    Estrategia preventiva anualizada para la disminución formal de contingencias conforme la NOM-030-STPS:
                  </p>

                  <div className="space-y-4">
                    <table>
                      <thead>
                        <tr>
                          <th className="w-[45%] tracking-tighter uppercase">Acción Programada</th>
                          <th className="w-[20%] tracking-tighter uppercase text-center">Referencia NOM</th>
                          <th className="w-[20%] tracking-tighter uppercase text-center">Responsable</th>
                          <th className="w-[15%] tracking-tighter uppercase text-center">Estatus</th>
                        </tr>
                      </thead>
                      <tbody>
                        {safetyProgram.length > 0 ? safetyProgram.slice(0, 6).map((item, idx) => (
                          <tr key={idx}>
                            <td className="font-semibold text-slate-800 text-[8pt] leading-tight">{item.action}</td>
                            <td className="text-center text-indigo-750 font-bold text-[8pt]">{item.referenceNorm || "General"}</td>
                            <td className="text-center text-slate-600 font-bold text-[8pt]">{item.responsible}</td>
                            <td className="text-center">
                              <span className={cn(
                                "text-[7.5pt] font-black px-2 py-0.5 rounded-full uppercase",
                                item.status === 'completed' ? "bg-emerald-50 text-emerald-705" : "bg-amber-50 text-amber-705"
                              )}>
                                {item.status === 'completed' ? "COMPLETO" : "PENDIENTE"}
                              </span>
                            </td>
                          </tr>
                        )) : (
                          [
                            { a: "Simulacro de gabinete de evacuación", n: "NOM-002-STPS", r: "Protección Civil", s: "PENDIENTE" },
                            { a: "Exámenes médicos audiopatía periódicos", n: "NOM-011-STPS", r: "Médico Empresa", s: "COMPLETO" },
                            { a: "Capacitación en manejo de extintores portátiles", n: "NOM-002-STPS", r: "Previsión", s: "PENDIENTE" }
                          ].map((item, idx) => (
                            <tr key={idx}>
                              <td className="font-medium text-slate-700 text-[8pt]">{item.a}</td>
                              <td className="text-center text-slate-600 font-bold text-[8pt]">{item.n}</td>
                              <td className="text-center text-slate-600 font-bold text-[8pt]">{item.r}</td>
                              <td className="text-center">
                                <span className="bg-amber-50 text-amber-700 text-[8px] font-extrabold px-2 py-0.5 rounded-full">
                                  {item.s}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="report-footer-area">
                  <span>VIGILANCIA NOM-030</span>
                  <span>Página 14 de 17</span>
                </div>
              </div>


              {/* PÁGINA 15: BITÁCORA DE EVIDENCIAS */}
              <div 
                ref={(el) => { if (el) pageRefs.current[14] = el; }}
                className="report-page-container"
              >
                <div className="report-header-area">
                  <span>{company.name}</span>
                  <span>Registro de Evidencias</span>
                </div>

                <div className="space-y-6">
                  <div className="section-header">
                    <span className="section-title">Evidencias Fotográficas y Bitácora</span>
                    <span className="text-[9px] font-black text-slate-400">Página 15</span>
                  </div>

                  <p className="p-justified">
                    Evidencias empíricas recopiladas durante las revisiones estructurales de simulación, capacitación e inspección en campo:
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    {evidences.length > 0 ? evidences.slice(0, 2).map((ev, idx) => (
                      <div key={idx} className="border border-slate-200 rounded-xl p-3 bg-slate-50 relative flex flex-col items-center">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-2">{ev.title}</span>
                        {ev.fileUrl && !ev.fileUrl.startsWith('data:application/pdf') ? (
                          <img 
                            src={ev.fileUrl} 
                            alt={ev.title} 
                            className="max-h-[160px] object-contain rounded border pointer-events-none"
                          />
                        ) : ev.fileUrl && ev.fileUrl.startsWith('data:application/pdf') ? (
                          <div className="h-36 w-full flex flex-col items-center justify-center bg-white border border-dashed rounded text-center p-2">
                            <FileText className="w-8 h-8 text-blue-500 mb-1" />
                            <span className="text-[9px] font-bold text-slate-500 uppercase">Evidencia en PDF</span>
                            <p className="text-[8px] text-slate-400 mt-1">El archivo es un PDF. Para visualizarlo aquí, cargue un formato PNG o JPG.</p>
                          </div>
                        ) : (
                          <div className="h-36 w-full flex items-center justify-center bg-white border border-dashed rounded text-xs text-slate-400">
                            Certificado de capacitación
                          </div>
                        )}
                        <p className="text-[7.5pt] font-black text-slate-500 mt-2 uppercase">Estatus: {ev.status || "COMPLIANT"}</p>
                      </div>
                    )) : (
                      [
                        { t: "Simulacro de Incendios en Producción", p: "Inspección 01" },
                        { t: "Cursos de Capacitación para Brigadas", p: "Capacitación 02" }
                      ].map((item, idx) => (
                        <div key={idx} className="border border-slate-200 border-dashed rounded-xl p-4 bg-slate-50 flex flex-col items-center justify-center text-center">
                          <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
                          <span className="text-[10px] font-bold text-slate-500 block">{item.t}</span>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Evidencia Estándar</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="report-footer-area">
                  <span>VIGILANCIA NOM-030</span>
                  <span>Página 15 de 17</span>
                </div>
              </div>


              {/* PÁGINA 16: CONCLUSIONES Y RECOMENDACIONES */}
              <div 
                ref={(el) => { if (el) pageRefs.current[15] = el; }}
                className="report-page-container"
              >
                <div className="report-header-area">
                  <span>{company.name}</span>
                  <span>Dictamen Analítico</span>
                </div>

                <div className="space-y-6">
                  <div className="section-header">
                    <span className="section-title">Conclusiones y Recomendaciones</span>
                    <span className="text-[9px] font-black text-slate-400">Página 16</span>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-indigo-750 tracking-wider">Directrices Conclusivas:</h3>
                    <p 
                      id="editable-report-conclusions"
                      className="p-justified whitespace-pre-wrap leading-relaxed outline-none"
                      contentEditable={isEditMode}
                      suppressContentEditableWarning={true}
                    >
                      {conclusions}
                    </p>

                    <h3 className="text-xs font-black uppercase text-rose-750 tracking-wider pt-2">Sugerencias y Recomendaciones de Mejora:</h3>
                    <p 
                      id="editable-report-recommendations"
                      className="p-justified whitespace-pre-wrap leading-relaxed outline-none"
                      contentEditable={isEditMode}
                      suppressContentEditableWarning={true}
                    >
                      {recommendations}
                    </p>
                  </div>
                </div>

                <div className="report-footer-area">
                  <span>VIGILANCIA NOM-030</span>
                  <span>Página 16 de 17</span>
                </div>
              </div>


              {/* PÁGINA 17: ANEXOS TÉCNICOS */}
              <div 
                ref={(el) => { if (el) pageRefs.current[16] = el; }}
                className="report-page-container"
              >
                <div className="report-header-area">
                  <span>{company.name}</span>
                  <span>Anexos Formales</span>
                </div>

                <div className="space-y-6">
                  <div className="section-header">
                    <span className="section-title">Anexo 1: Carta de Designación de Responsabilidades</span>
                    <span className="text-[9px] font-black text-slate-400">Página 17</span>
                  </div>

                  <div className="border border-slate-150 rounded-2xl p-5 bg-slate-50/50 space-y-4 text-xs text-justify">
                    <p className="font-extrabold uppercase text-[10px] text-slate-800 text-center tracking-wider underline">
                      ACTA DE NOMBRAMIENTO DE RESPONSABLE DE SEGURIDAD
                    </p>
                    <p className="leading-relaxed">
                      Por medio de la presente, la dirección general de <strong>{company.name}</strong> designa formalmente al C. <strong>{company.responsibleName}</strong> como responsable calificado de instrumentar las actividades de los Servicios Preventivos de Seguridad y Salud en el Trabajo, coordinar las bitácoras legalmente exigibles por la NOM-030-STPS-2009 y supervisar la mitigación de GP calificados.
                    </p>

                    <div className="pt-8 flex flex-col items-center">
                      <p className="font-bold uppercase text-[9px] text-slate-400">Firma del Solicitante / Responsable:</p>
                      
                      {company.responsibleSignature && !company.responsibleSignature.startsWith('data:application/pdf') ? (
                        <div className="my-2 border border-slate-200 bg-white p-2 rounded shadow-sm text-center">
                          <img 
                            src={company.responsibleSignature} 
                            alt="Firma Digitalizada" 
                            className="h-14 object-contain mx-auto"
                          />
                        </div>
                      ) : company.responsibleSignature && company.responsibleSignature.startsWith('data:application/pdf') ? (
                        <div className="my-2 border border-slate-200 bg-white p-3 rounded shadow-sm text-center flex flex-col items-center">
                          <FileText className="w-6 h-6 text-blue-500 mb-1" />
                          <span className="text-[8px] font-bold text-slate-500 uppercase">Firma en PDF</span>
                        </div>
                      ) : (
                        <div className="my-3 border border-dashed border-slate-300 w-44 py-3 text-[9px] text-slate-400 text-center uppercase">
                          Sello de firma pendiente
                        </div>
                      )}

                      <div className="w-56 h-0.5 bg-slate-400 mt-2" />
                      <p className="font-bold text-slate-800 uppercase text-[9px] mt-1 text-center">{company.responsibleName}</p>
                      <p className="text-slate-400 text-[8px] uppercase tracking-wider text-center">Rúbrica de aceptación técnica</p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <h3 className="text-[10px] font-extrabold uppercase text-slate-800 tracking-wider mb-2">Anexo 2: Obligaciones Patronales Obligatorias:</h3>
                    <p className="text-[8.5pt] text-slate-600 text-justify leading-tight">
                      El patrón de <strong>{company.name}</strong> asume la responsabilidad fáctica de: <br />
                      1) Suministrar los presupuestos requeridos para el programa integral anual de SST. <br />
                      2) Permitir auditorías periódicas y capacitar a la totalidad del personal operativo sin penalizaciones de jornada.
                    </p>
                  </div>
                </div>

                <div className="report-footer-area">
                  <span>VIGILANCIA NOM-030</span>
                  <span>Página 17 de 17</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* WORD WYSIWYG EDITOR CONTAINER REMOVED */}
    </div>
  );
}
