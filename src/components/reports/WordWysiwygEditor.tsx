import React, { useState, useEffect, useRef } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify,
  PlusCircle, 
  Trash2, 
  Copy, 
  Grid, 
  Image as ImageIcon, 
  Table as TableIcon, 
  Type, 
  Square, 
  Layers, 
  User, 
  Download, 
  Eye, 
  Sparkles, 
  RotateCcw, 
  Maximize2, 
  ChevronUp, 
  ChevronDown, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight,
  Info,
  Lock,
  Unlock,
  CheckCircle,
  FileText,
  FilePlus,
  HelpCircle,
  Heading1,
  Heading2,
  PaintBucket,
  Scale
} from "lucide-react";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { db, type Company } from "../../lib/db";
import html2pdf from 'html2pdf.js';
import { getWysiwygTemplatePages } from './WysiwygTemplates';

// Define structure of a WYSIWYG element/layer
export interface WYSIWYGBlock {
  id: string;
  type: 'text' | 'image' | 'table' | 'shape';
  name: string; // Layer representation name (e.g. "Título de Portada", "Fondo Azul")
  x: number; // in pixels (based on 816px standard letter page width)
  y: number; // in pixels (based on 1056px standard letter page height)
  width: number;
  height: number;
  zIndex: number;
  isLocked?: boolean;
  
  // Outer Styles
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'none';
  borderRadius?: number;
  padding?: number;
  opacity?: number;
  boxShadow?: string;

  // Text specific
  text?: string; // HTML format string for contentEditable
  fontSize?: number; // in pt or px
  fontFamily?: string;
  textColor?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  fontWeight?: 'normal' | 'bold' | 'bolder';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  lineHeight?: number;

  // Image specific
  imageUrl?: string;
  imageFit?: 'contain' | 'cover' | 'fill';

  // Table specific
  tableData?: string[][]; // Rows x Columns cells content
  tableColumnsWidths?: number[]; // Column widths in percentages or px
  tableHeaderColor?: string;
  tableHeaderTextColor?: string;
  tableAlternatingRows?: boolean;
}

export interface WYSIWYGPage {
  id: string;
  blocks: WYSIWYGBlock[];
}

interface WordWysiwygEditorProps {
  company: Company;
  checklistItems: any[];
  findings: any[];
  hazards: any[];
  accidentEvents: any[];
  safetyProgram: any[];
  legalMatrix: any[];
  onClose: () => void;
}

// Letter size dimensions in pixels at 96 DPI
const PAGE_WIDTH = 816;
const PAGE_HEIGHT = 1056;

export function WordWysiwygEditor({
  company,
  checklistItems,
  findings,
  hazards,
  accidentEvents,
  safetyProgram,
  legalMatrix,
  onClose
}: WordWysiwygEditorProps) {
  // --- STATE DECLARATIONS ---
  const [pages, setPages] = useState<WYSIWYGPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(0.8); // Responsive zoom for workspace
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  // Dragging and Resizing pointer trackers
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    isResizing: boolean;
    resizeHandle: string | null;
    startX: number;
    startY: number;
    startBlockX: number;
    startBlockY: number;
    startBlockW: number;
    startBlockH: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // --- INITIALIZE DATA OR RESTORE WORKSPACE ---
  useEffect(() => {
    const restoreSavedDesign = async () => {
      try {
        if (company.id) {
          const freshCompany = await db.companies.get(company.id);
          if (freshCompany && freshCompany.reportFullHTML) {
            // Attempt to parse saved block structure
            if (freshCompany.reportFullHTML.startsWith('[') || freshCompany.reportFullHTML.startsWith('{')) {
              const parsed = JSON.parse(freshCompany.reportFullHTML);
              if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].blocks) {
                setPages(parsed);
                toast.success("Diseño Word personalizado recuperado con éxito.");
                return;
              }
            }
          }
        }
        // If nothing saved or failed parse, boot with template base
        loadDefaultWorkspaceTemplate();
      } catch (err) {
        console.error("Failed restoring template", err);
        loadDefaultWorkspaceTemplate();
      }
    };
    restoreSavedDesign();
  }, [company.id]);

  // --- BUILD INITIAL QUALITY WORD TEMPLATE FROM PROJECT DATA ---
  const loadDefaultWorkspaceTemplate = () => {
    const defaultPages = getWysiwygTemplatePages(
      company,
      checklistItems,
      findings,
      hazards,
      accidentEvents,
      safetyProgram,
      legalMatrix
    );
    setPages(defaultPages);
    setActivePageIndex(0);
    setSelectedBlockId(null);
  };

  // --- SAVE DRAFT STATE BACK TO THE DB ---
  const handleSaveDesign = async (silent = false) => {
    if (!company.id) return;
    try {
      const dataString = JSON.stringify(pages);
      await db.companies.update(company.id, {
        reportFullHTML: dataString
      });
      if (!silent) {
        toast.success("Documento Word WYSIWYG guardado correctamente.");
      }
    } catch (e) {
      console.error(e);
      if (!silent) {
        toast.error("Error al persistir el diseño en las tablas base.");
      }
    }
  };

  // Automatically save draft on element adjustments
  const triggerAutoSave = () => {
    // Lazy autosave
    setTimeout(() => {
      handleSaveDesign(true);
    }, 500);
  };

  // --- COMPILACIÓN FINAL EN FORMATO DE PDF DE ALTA CALIDAD ---
  const handleDownloadWYSIWYGPDF = () => {
    const el = document.getElementById('wysiwyg-print-view');
    if (!el) {
      toast.error("No se ha podido localizar el contenedor maestro de impresión.");
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading("Estructurando capas y empaquetando PDF corporativo libre...");

    setTimeout(() => {
      const opt = {
        margin: 0,
        filename: `NOM030_DISEÑO_LIBRE_${company.name.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        pagebreak: { mode: 'css', avoid: '.pdf-no-break' },
        html2canvas: {
          scale: 2.2, // Ultra crisp resolution
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
        jsPDF: { unit: 'px' as const, format: [PAGE_WIDTH, PAGE_HEIGHT] as [number, number], orientation: 'portrait' as const }
      };

      html2pdf().from(el).set(opt).save().then(() => {
        toast.success("PDF de propuesta de diseño libre descargado.", { id: toastId });
        setIsExporting(false);
      }).catch((err: any) => {
        console.error("PDF Export Fail", err);
        toast.error("Hubo un error al compilar el PDF de diseño.", { id: toastId });
        setIsExporting(false);
      });
    }, 800);
  };

  // --- POINTER MOUSE EVENTS FOR CUSTOM DRAG AND RESIZE HANDLES ---
  const handlePointerDown = (
    e: React.MouseEvent,
    block: WYSIWYGBlock,
    action: 'move' | 'resize',
    handle: string | null = null,
    pIdx?: number
  ) => {
    if (block.isLocked) return;
    e.stopPropagation();
    e.preventDefault();

    if (pIdx !== undefined) {
      setActivePageIndex(pIdx);
    }
    setSelectedBlockId(block.id);

    setDragState({
      isDragging: action === 'move',
      isResizing: action === 'resize',
      resizeHandle: handle,
      startX: e.clientX,
      startY: e.clientY,
      startBlockX: block.x,
      startBlockY: block.y,
      startBlockW: block.width,
      startBlockH: block.height
    });
  };

  const handlePointerMove = (e: React.MouseEvent) => {
    if (!dragState) return;
    e.preventDefault();

    const dx = (e.clientX - dragState.startX) / zoomScale;
    const dy = (e.clientY - dragState.startY) / zoomScale;

    const updatedPages = [...pages];
    const page = updatedPages[activePageIndex];
    const blockIndex = page.blocks.findIndex(b => b.id === selectedBlockId);
    if (blockIndex === -1) return;

    const block = { ...page.blocks[blockIndex] };

    if (dragState.isDragging) {
      let nextX = dragState.startBlockX + dx;
      let nextY = dragState.startBlockY + dy;

      // Handle Snapping to a 10px Grid if desired
      if (snapToGrid) {
        nextX = Math.round(nextX / 10) * 10;
        nextY = Math.round(nextY / 10) * 10;
      }

      // Boundaries inside Letter format
      nextX = Math.max(0, Math.min(PAGE_WIDTH - block.width, nextX));
      nextY = Math.max(0, Math.min(PAGE_HEIGHT - block.height, nextY));

      block.x = nextX;
      block.y = nextY;
    } else if (dragState.isResizing && dragState.resizeHandle) {
      let nw = block.width;
      let nh = block.height;
      let nx = block.x;
      let ny = block.y;

      const handle = dragState.resizeHandle;

      if (handle.includes('r')) {
        nw = dragState.startBlockW + dx;
      }
      if (handle.includes('b')) {
        nh = dragState.startBlockH + dy;
      }
      if (handle.includes('l')) {
        const potentialW = dragState.startBlockW - dx;
        if (potentialW > 25) {
          nw = potentialW;
          nx = dragState.startBlockX + dx;
        }
      }
      if (handle.includes('t')) {
        const potentialH = dragState.startBlockH - dy;
        if (potentialH > 25) {
          nh = potentialH;
          ny = dragState.startBlockY + dy;
        }
      }

      if (snapToGrid) {
        nw = Math.round(nw / 10) * 10;
        nh = Math.round(nh / 10) * 10;
        nx = Math.round(nx / 10) * 10;
        ny = Math.round(ny / 10) * 10;
      }

      nw = Math.max(25, Math.min(PAGE_WIDTH - nx, nw));
      nh = Math.max(25, Math.min(PAGE_HEIGHT - ny, nh));

      block.width = nw;
      block.height = nh;
      block.x = nx;
      block.y = ny;
    }

    page.blocks[blockIndex] = block;
    setPages(updatedPages);
  };

  const handlePointerUp = () => {
    if (dragState) {
      setDragState(null);
      triggerAutoSave();
    }
  };

  // Keyboard navigation support for pixel-perfect microscopic shifts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedBlockId) return;

      // Skip arrow moving if the user is actively typing in a contentEditable text field
      if (document.activeElement?.getAttribute('contenteditable') === 'true') {
        return;
      }

      const moveKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (!moveKeys.includes(e.key)) return;

      e.preventDefault();

      const step = e.shiftKey ? 10 : 1;
      const updatedPages = [...pages];
      const page = updatedPages[activePageIndex];
      const bIndex = page.blocks.findIndex(b => b.id === selectedBlockId);
      if (bIndex === -1) return;

      const block = { ...page.blocks[bIndex] };
      if (block.isLocked) return;

      switch (e.key) {
        case 'ArrowUp':
          block.y = Math.max(0, block.y - step);
          break;
        case 'ArrowDown':
          block.y = Math.min(PAGE_HEIGHT - block.height, block.y + step);
          break;
        case 'ArrowLeft':
          block.x = Math.max(0, block.x - step);
          break;
        case 'ArrowRight':
          block.x = Math.min(PAGE_WIDTH - block.width, block.x + step);
          break;
      }

      page.blocks[bIndex] = block;
      setPages(updatedPages);
      triggerAutoSave();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockId, activePageIndex, pages]);

  // --- ACTIONS: BLOCK INSERTIONS ---
  const addNewTextBlock = () => {
    const defaultText: WYSIWYGBlock = {
      id: `text-${Date.now()}`,
      type: 'text',
      name: `Nuevo Texto ${pages[activePageIndex].blocks.length + 1}`,
      x: 100,
      y: 150,
      width: 400,
      height: 120,
      zIndex: getNextZIndex(),
      text: '<p style="margin:0; font-size:13px; color:#334155; line-height:1.5;">Haga doble clic para editar este cajón de texto enriquecido con estilo Word...</p>',
      fontFamily: 'Arial',
      fontSize: 11
    };

    const updated = [...pages];
    updated[activePageIndex].blocks.push(defaultText);
    setPages(updated);
    setSelectedBlockId(defaultText.id);
    triggerAutoSave();
  };

  const addNewImageBlock = () => {
    const defaultImage: WYSIWYGBlock = {
      id: `image-${Date.now()}`,
      type: 'image',
      name: `Capa Imagen ${pages[activePageIndex].blocks.length + 1}`,
      x: 200,
      y: 200,
      width: 200,
      height: 150,
      zIndex: getNextZIndex(),
      imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&q=80',
      imageFit: 'cover'
    };

    const updated = [...pages];
    updated[activePageIndex].blocks.push(defaultImage);
    setPages(updated);
    setSelectedBlockId(defaultImage.id);
    triggerAutoSave();
  };

  const addNewTableBlock = () => {
    const defaultTable: WYSIWYGBlock = {
      id: `table-${Date.now()}`,
      type: 'table',
      name: `Tabla Editable ${pages[activePageIndex].blocks.length + 1}`,
      x: 80,
      y: 300,
      width: 650,
      height: 140,
      zIndex: getNextZIndex(),
      tableData: [
        ['Renglón Encabezado 1', 'Encabezado Columna 2', 'Encabezado Columna 3'],
        ['Dato Celda A1', 'Dato Celda A2', 'Dato Celda A3'],
        ['Dato Celda B1', 'Dato Celda B2', 'Dato Celda B3']
      ],
      tableHeaderColor: '#0f172a',
      tableHeaderTextColor: '#ffffff',
      tableAlternatingRows: true
    };

    const updated = [...pages];
    updated[activePageIndex].blocks.push(defaultTable);
    setPages(updated);
    setSelectedBlockId(defaultTable.id);
    triggerAutoSave();
  };

  const addNewShapeBlock = () => {
    const defaultShape: WYSIWYGBlock = {
      id: `shape-${Date.now()}`,
      type: 'shape',
      name: `Forma Contenedora ${pages[activePageIndex].blocks.length + 1}`,
      x: 150,
      y: 250,
      width: 300,
      height: 100,
      zIndex: getNextZIndex(),
      backgroundColor: '#f1f5f9',
      borderColor: '#94a3b8',
      borderWidth: 2,
      borderStyle: 'solid',
      borderRadius: 12
    };

    const updated = [...pages];
    updated[activePageIndex].blocks.push(defaultShape);
    setPages(updated);
    setSelectedBlockId(defaultShape.id);
    triggerAutoSave();
  };

  const getNextZIndex = () => {
    const page = pages[activePageIndex];
    if (!page || page.blocks.length === 0) return 1;
    return Math.max(...page.blocks.map(b => b.zIndex)) + 1;
  };

  // --- LOCAL DRAG & DROP IMAGES SUPPORT ---
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const base64Url = loadEvent.target?.result as string;
        
        // Add new image layer where it was dropped
        const defaultImage: WYSIWYGBlock = {
          id: `image-drop-${Date.now()}`,
          type: 'image',
          name: `Imagen Subida Local`,
          x: 100,
          y: 200,
          width: 300,
          height: 220,
          zIndex: getNextZIndex(),
          imageUrl: base64Url,
          imageFit: 'contain'
        };

        const updated = [...pages];
        updated[activePageIndex].blocks.push(defaultImage);
        setPages(updated);
        setSelectedBlockId(defaultImage.id);
        toast.success("Imagen de escritorio recibida y montada como capa.");
        triggerAutoSave();
      };
      reader.readAsDataURL(file);
    }
  };

  const preventDefaults = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // --- ACTIONS: LAYER DEPTH ORDER & ELEMENT OPERATORS ---
  const duplicateSelectedBlock = () => {
    if (!selectedBlockId) return;
    const updated = [...pages];
    const page = updated[activePageIndex];
    const source = page.blocks.find(b => b.id === selectedBlockId);
    if (!source) return;

    const nextId = `${source.type}-${Date.now()}`;
    const clone: WYSIWYGBlock = {
      ...source,
      id: nextId,
      name: `${source.name} (Copia)`,
      x: Math.min(PAGE_WIDTH - source.width, source.x + 30),
      y: Math.min(PAGE_HEIGHT - source.height, source.y + 30),
      zIndex: getNextZIndex(),
      isLocked: false
    };

    // Deep clone array if table
    if (source.tableData) {
      clone.tableData = source.tableData.map(r => [...r]);
    }

    page.blocks.push(clone);
    setPages(updated);
    setSelectedBlockId(nextId);
    toast.success("Capa duplicada con desfase.");
    triggerAutoSave();
  };

  const deleteSelectedBlock = () => {
    if (!selectedBlockId) return;
    const updated = [...pages];
    const page = updated[activePageIndex];
    page.blocks = page.blocks.filter(b => b.id !== selectedBlockId);
    setPages(updated);
    setSelectedBlockId(null);
    toast.success("Capa eliminada.");
    triggerAutoSave();
  };

  const moveZIndex = (dir: 'raise' | 'lower' | 'top' | 'bottom') => {
    if (!selectedBlockId) return;
    const updated = [...pages];
    const page = updated[activePageIndex];
    const bIndex = page.blocks.findIndex(b => b.id === selectedBlockId);
    if (bIndex === -1) return;

    const block = { ...page.blocks[bIndex] };
    const allZs = page.blocks.map(b => b.zIndex);
    const maxZ = allZs.length > 0 ? Math.max(...allZs) : 1;
    const minZ = allZs.length > 0 ? Math.min(...allZs) : 1;

    if (dir === 'raise') {
      block.zIndex += 1;
    } else if (dir === 'lower') {
      block.zIndex = Math.max(1, block.zIndex - 1);
    } else if (dir === 'top') {
      block.zIndex = maxZ + 1;
    } else if (dir === 'bottom') {
      block.zIndex = Math.max(1, minZ - 1);
    }

    page.blocks[bIndex] = block;
    setPages(updated);
    triggerAutoSave();
  };

  const toggleBlockLock = () => {
    if (!selectedBlockId) return;
    const updated = [...pages];
    const page = updated[activePageIndex];
    const bIndex = page.blocks.findIndex(b => b.id === selectedBlockId);
    if (bIndex === -1) return;

    page.blocks[bIndex].isLocked = !page.blocks[bIndex].isLocked;
    setPages(updated);
    toast.success(page.blocks[bIndex].isLocked ? "Capa de fondo asegurada con candado." : "Capa desbloqueada.");
    triggerAutoSave();
  };

  // --- ACTIONS: ALIGNMENT & DESIGN BOUNDARIES ---
  const alignSelectedBlock = (alignment: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') => {
    if (!selectedBlockId) return;
    const updated = [...pages];
    const page = updated[activePageIndex];
    const bIndex = page.blocks.findIndex(b => b.id === selectedBlockId);
    if (bIndex === -1) return;

    const block = { ...page.blocks[bIndex] };
    if (block.isLocked) return;

    const PAGE_MARGIN_SAFE = 50; // Standard printed boundaries (approx 0.5")

    switch (alignment) {
      case 'left':
        block.x = PAGE_MARGIN_SAFE;
        break;
      case 'center-h':
        block.x = (PAGE_WIDTH - block.width) / 2;
        break;
      case 'right':
        block.x = PAGE_WIDTH - block.width - PAGE_MARGIN_SAFE;
        break;
      case 'top':
        block.y = PAGE_MARGIN_SAFE;
        break;
      case 'center-v':
        block.y = (PAGE_HEIGHT - block.height) / 2;
        break;
      case 'bottom':
        block.y = PAGE_HEIGHT - block.height - PAGE_MARGIN_SAFE;
        break;
    }

    page.blocks[bIndex] = block;
    setPages(updated);
    toast.success("Alineación calibrada.");
    triggerAutoSave();
  };

  // --- ACTIONS: WORD-STYLE EXECUTIVE FORMAT COMMANDS ---
  const applyRichTextCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    triggerAutoSave();
  };

  // --- TABLE CELL MODIFICATIONS ---
  const handleTableCellEdit = (pIdx: number, rowIndex: number, colIndex: number, textVal: string) => {
    if (!selectedBlockId) return;
    const updated = [...pages];
    const page = updated[pIdx];
    const bIndex = page.blocks.findIndex(b => b.id === selectedBlockId);
    if (bIndex === -1 || !page.blocks[bIndex].tableData) return;

    const block = { ...page.blocks[bIndex] };
    const grid = block.tableData!.map(row => [...row]);
    
    grid[rowIndex][colIndex] = textVal;
    block.tableData = grid;

    page.blocks[bIndex] = block;
    setPages(updated);
    triggerAutoSave();
  };

  const addTableRow = () => {
    if (!selectedBlockId) return;
    const updated = [...pages];
    const page = updated[activePageIndex];
    const bIndex = page.blocks.findIndex(b => b.id === selectedBlockId);
    if (bIndex === -1 || !page.blocks[bIndex].tableData) return;

    const block = { ...page.blocks[bIndex] };
    const grid = block.tableData!.map(row => [...row]);
    
    const colCount = grid[0]?.length || 3;
    grid.push(Array(colCount).fill('Nueva Celda'));
    block.tableData = grid;
    block.height += 28; // Adjust component canvas size gracefully

    page.blocks[bIndex] = block;
    setPages(updated);
    toast.success("Renglón insertado al fondo de la grilla.");
    triggerAutoSave();
  };

  const removeTableRow = () => {
    if (!selectedBlockId) return;
    const updated = [...pages];
    const page = updated[activePageIndex];
    const bIndex = page.blocks.findIndex(b => b.id === selectedBlockId);
    if (bIndex === -1 || !page.blocks[bIndex].tableData) return;

    const block = { ...page.blocks[bIndex] };
    const grid = block.tableData!.map(row => [...row]);
    
    if (grid.length <= 1) {
      toast.error("La tabla debe sostener al menos una fila.");
      return;
    }

    grid.pop();
    block.tableData = grid;
    block.height = Math.max(30, block.height - 28);

    page.blocks[bIndex] = block;
    setPages(updated);
    toast.success("Renglón removido.");
    triggerAutoSave();
  };

  const addTableCol = () => {
    if (!selectedBlockId) return;
    const updated = [...pages];
    const page = updated[activePageIndex];
    const bIndex = page.blocks.findIndex(b => b.id === selectedBlockId);
    if (bIndex === -1 || !page.blocks[bIndex].tableData) return;

    const block = { ...page.blocks[bIndex] };
    const grid = block.tableData!.map(row => [...row]);

    grid.forEach(row => row.push('Nueva Col'));
    block.tableData = grid;

    page.blocks[bIndex] = block;
    setPages(updated);
    toast.success("Columna insertada.");
    triggerAutoSave();
  };

  const removeTableCol = () => {
    if (!selectedBlockId) return;
    const updated = [...pages];
    const page = updated[activePageIndex];
    const bIndex = page.blocks.findIndex(b => b.id === selectedBlockId);
    if (bIndex === -1 || !page.blocks[bIndex].tableData) return;

    const block = { ...page.blocks[bIndex] };
    const grid = block.tableData!.map(row => [...row]);

    if (grid[0]?.length <= 1) {
      toast.error("La tabla requiere al menos una columna.");
      return;
    }

    grid.forEach(row => row.pop());
    block.tableData = grid;

    page.blocks[bIndex] = block;
    setPages(updated);
    toast.success("Columna eliminada.");
    triggerAutoSave();
  };

  // --- MULTIPAGE WORKBOOK OPERATORS ---
  const insertNewBlankPage = () => {
    const newPageId = `page-${Date.now()}`;
    const defaultPageBlocks: WYSIWYGBlock[] = [
      {
        id: `header-p-${Date.now()}`,
        type: 'text',
        name: 'Encabezado Pág',
        x: 50,
        y: 40,
        width: 716,
        height: 40,
        zIndex: 1,
        text: `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase;"><span>${company.name} • Diagnóstico NOM-030</span><span>Adenda del Evaluador</span></div>`,
        fontFamily: 'Arial'
      },
      {
        id: `footer-p-${Date.now()}`,
        type: 'text',
        name: 'Pie Pág',
        x: 50,
        y: PAGE_HEIGHT - 60,
        width: 716,
        height: 30,
        zIndex: 1,
        text: `<div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 8px; color: #94a3b8; font-weight: bold;"><span>PROPUESTA EN LÍNEA</span><span>Página ${pages.length + 1}</span></div>`,
        fontFamily: 'Arial'
      }
    ];

    setPages([...pages, { id: newPageId, blocks: defaultPageBlocks }]);
    setActivePageIndex(pages.length);
    setSelectedBlockId(null);
    toast.success(`Página en blanco ${pages.length + 1} insertada.`);
    triggerAutoSave();
  };

  const removeActivePage = () => {
    if (pages.length <= 1) {
      toast.error("El informe maestro debe contener al menos una página.");
      return;
    }

    const updated = pages.filter((_, idx) => idx !== activePageIndex);
    setPages(updated);
    setActivePageIndex(Math.max(0, activePageIndex - 1));
    setSelectedBlockId(null);
    toast.success("Página removida correctamente.");
    triggerAutoSave();
  };

  const movePageOrder = (direction: 'up' | 'down') => {
    if (direction === 'up' && activePageIndex === 0) return;
    if (direction === 'down' && activePageIndex === pages.length - 1) return;

    const targetIdx = direction === 'up' ? activePageIndex - 1 : activePageIndex + 1;
    const updated = [...pages];
    
    // Swap elements
    const temp = updated[activePageIndex];
    updated[activePageIndex] = updated[targetIdx];
    updated[targetIdx] = temp;

    setPages(updated);
    setActivePageIndex(targetIdx);
    toast.success("Orden de páginas reconfigurado.");
    triggerAutoSave();
  };

  const activePageObj = pages[activePageIndex];
  const selectedBlockObj = activePageObj?.blocks.find(b => b.id === selectedBlockId);

  return (
    <div className="fixed inset-0 bg-slate-900 border-t border-slate-800 z-50 flex flex-col overflow-hidden text-slate-100 font-sans" onMouseUp={handlePointerUp}>
      
      {/* 1. TOP HEADER APP-BAR */}
      <header className="h-[7vh] min-h-[55px] bg-slate-950 border-b border-slate-800 px-6 flex items-center justify-between shadow-2xl z-25">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-md shadow-indigo-900/30">
            <Layers className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-black uppercase text-indigo-400 tracking-wider">Diseñador Profesional</span>
            <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Editor WYSIWYG Estilo Word <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full uppercase font-black tracking-widest">Active</span>
            </h1>
          </div>
        </div>

        {/* Workspace controls */}
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="ghost"
            className="text-[11px] font-bold h-8 text-amber-500 hover:text-amber-400 hover:bg-slate-900 rounded-lg"
            onClick={loadDefaultWorkspaceTemplate}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restaurar Predeterminados
          </Button>
          
          <Button
            size="sm"
            onClick={() => handleSaveDesign(false)}
            className="text-[11px] font-bold h-8 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg border border-slate-700"
          >
            Guardar Borrador
          </Button>

          <Button
            size="sm"
            disabled={isExporting}
            onClick={handleDownloadWYSIWYGPDF}
            className="text-[11px] font-bold h-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-900/20"
          >
            {isExporting ? <span className="animate-spin mr-1">⚪</span> : <Download className="w-3.5 h-3.5 mr-1" />}
            Exportar PDF
          </Button>

          <div className="w-px h-6 bg-slate-800 mx-1" />

          <Button 
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="text-[11px] font-bold h-8 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg border border-slate-800"
          >
            Cerrar Editor
          </Button>
        </div>
      </header>

      {/* 2. SUB-BAR: WORD TYPE RICH TOOLBAR FOCUSED ON WRITING */}
      <div className="bg-slate-900/80 border-b border-slate-850 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 z-20">
        
        {/* Layer Addition Buttons */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
          <Button
            size="sm"
            variant="ghost"
            title="Insertar Caja de Texto"
            onClick={addNewTextBlock}
            className="h-8 text-xs font-bold text-slate-300 hover:bg-slate-850 hover:text-white rounded-lg px-2.5 flex items-center gap-1"
          >
            <Type className="w-4 h-4 text-sky-400" /> + Texto
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title="Insertar Imagen"
            onClick={addNewImageBlock}
            className="h-8 text-xs font-bold text-slate-300 hover:bg-slate-850 hover:text-white rounded-lg px-2.5 flex items-center gap-1"
          >
            <ImageIcon className="w-4 h-4 text-emerald-400" /> + Imagen
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title="Insertar Tabla Editable"
            onClick={addNewTableBlock}
            className="h-8 text-xs font-bold text-slate-300 hover:bg-slate-850 hover:text-white rounded-lg px-2.5 flex items-center gap-1"
          >
            <TableIcon className="w-4 h-4 text-purple-400" /> + Tabla
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title="Insertar Fondo o Capa Cobertura"
            onClick={addNewShapeBlock}
            className="h-8 text-xs font-bold text-slate-300 hover:bg-slate-850 hover:text-white rounded-lg px-2.5 flex items-center gap-1"
          >
            <Square className="w-4 h-4 text-amber-500" /> + Capa Shape
          </Button>
        </div>

        {/* Word Text Formatting Actions */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
          <Button
            size="icon"
            variant="ghost"
            className="w-8 h-8 text-slate-300 hover:text-white hover:bg-slate-850 rounded-lg"
            title="Negrita"
            onClick={() => applyRichTextCommand('bold')}
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="w-8 h-8 text-slate-300 hover:text-white hover:bg-slate-850 rounded-lg"
            title="Cursiva"
            onClick={() => applyRichTextCommand('italic')}
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="w-8 h-8 text-slate-300 hover:text-white hover:bg-slate-850 rounded-lg"
            title="Subrayado"
            onClick={() => applyRichTextCommand('underline')}
          >
            <Underline className="w-4 h-4" />
          </Button>
          
          <div className="w-px h-5 bg-slate-800 mx-1" />

          <Button
            size="icon"
            variant="ghost"
            className="w-8 h-8 text-slate-300 hover:text-white hover:bg-slate-850 rounded-lg"
            title="Alinear Izquierda"
            onClick={() => applyRichTextCommand('justifyLeft')}
          >
            <AlignLeft className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="w-8 h-8 text-slate-300 hover:text-white hover:bg-slate-850 rounded-lg"
            title="Centrar"
            onClick={() => applyRichTextCommand('justifyCenter')}
          >
            <AlignCenter className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="w-8 h-8 text-slate-300 hover:text-white hover:bg-slate-850 rounded-lg"
            title="Alinear Derecha"
            onClick={() => applyRichTextCommand('justifyRight')}
          >
            <AlignRight className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="w-8 h-8 text-slate-300 hover:text-white hover:bg-slate-850 rounded-lg"
            title="Justificar"
            onClick={() => applyRichTextCommand('justifyFull')}
          >
            <AlignJustify className="w-4 h-4" />
          </Button>
          
          <div className="w-px h-5 bg-slate-800 mx-1" />

          {/* Quick Predefined Color Highlighters */}
          <Button
            size="icon"
            variant="ghost"
            className="w-8 h-8 hover:bg-slate-850 rounded-lg text-red-500"
            title="Texto Rojo"
            onClick={() => applyRichTextCommand('foreColor', '#ef4444')}
          >
            <span className="font-bold text-sm">A</span>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="w-8 h-8 hover:bg-slate-850 rounded-lg text-indigo-400"
            title="Texto Índigo"
            onClick={() => applyRichTextCommand('foreColor', '#4f46e5')}
          >
            <span className="font-bold text-sm">A</span>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="w-8 h-8 hover:bg-slate-850 rounded-lg text-slate-300"
            title="Texto Slate"
            onClick={() => applyRichTextCommand('foreColor', '#334155')}
          >
            <span className="font-bold text-sm">A</span>
          </Button>
        </div>

        {/* Zoom scale, Align Page Blocks and snapping */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-850">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Escala:</span>
            <input 
              type="range" 
              min="0.4" 
              max="1.2" 
              step="0.05" 
              value={zoomScale} 
              onChange={(e) => setZoomScale(parseFloat(e.target.value))}
              className="w-16 accent-indigo-500 cursor-pointer h-1"
            />
            <span className="text-[10px] font-bold text-slate-300">{Math.round(zoomScale * 100)}%</span>
          </div>

          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded-xl border transition-all ${showGrid ? 'bg-slate-800 text-sky-400 border-sky-900/45' : 'bg-slate-950 text-slate-500 border-slate-850'}`}
            title="Mostrar Rejilla Cuadriculada"
          >
            <Grid className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`p-1.5 rounded-xl border transition-all ${snapToGrid ? 'bg-slate-800 text-amber-500 border-amber-900/45' : 'bg-slate-950 text-slate-500 border-slate-850'}`}
            title="Auto-Alineación en Grilla de 10px"
          >
            <Scale className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* 3. MAIN WORKSPACE CONTAINER */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT COLUMN: MULTIPUPOSE PAGES WORKBOX & LAYERS BAR */}
        <aside className="w-[18vw] min-w-[220px] max-w-[320px] bg-slate-950 border-r border-slate-850 p-4 flex flex-col justify-between overflow-y-auto z-10 select-none">
          
          <div className="space-y-6">
            
            {/* Pages Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Páginas de Trabajo</span>
                <span className="text-[9px] bg-slate-900 text-slate-300 rounded font-bold px-2 py-0.5">
                  Total: {pages.length}
                </span>
              </div>
              
              <div className="max-h-[25vh] overflow-y-auto space-y-1.5 pr-1">
                {pages.map((p, idx) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setActivePageIndex(idx);
                      setSelectedBlockId(null);
                      const pageEl = document.getElementById(`wysiwyg-page-canvas-${idx}`);
                      if (pageEl) {
                        pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                    className={`group w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer border ${activePageIndex === idx ? 'bg-indigo-950/60 border-indigo-500 text-white' : 'bg-slate-900/30 border-transparent text-slate-400 hover:text-slate-100'}`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-400" />
                      <span className="font-bold">Página {idx + 1}</span>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {idx > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); movePageOrder('up'); }} title="Subir orden" className="text-slate-500 hover:text-white hover:bg-slate-800 p-0.5 rounded">
                          <ChevronUp className="w-3 h-3" />
                        </button>
                      )}
                      {idx < pages.length - 1 && (
                        <button onClick={(e) => { e.stopPropagation(); movePageOrder('down'); }} title="Bajar orden" className="text-slate-500 hover:text-white hover:bg-slate-800 p-0.5 rounded">
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Book actions */}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={insertNewBlankPage}
                  className="bg-slate-900 border border-slate-800 text-[10px] font-black uppercase text-indigo-400 h-7"
                >
                  <PlusCircle className="w-3 h-3 mr-1" /> +Nueva
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={removeActivePage}
                  className="bg-slate-900 border border-slate-800 text-[10px] font-black uppercase text-red-400 hover:text-red-350 h-7"
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Borrar
                </Button>
              </div>
            </div>

            {/* Stacking Layers Section */}
            <div className="space-y-3 pt-3 border-t border-slate-900">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Capas en Página Seleccionada</span>
              
              <div className="max-h-[35vh] overflow-y-auto space-y-1.5 pr-1 font-sans">
                {activePageObj?.blocks && activePageObj.blocks.length > 0 ? (
                  [...activePageObj.blocks]
                    .sort((a,b) => b.zIndex - a.zIndex) // Top stacking item first
                    .map((block) => (
                      <div
                        key={block.id}
                        onClick={() => setSelectedBlockId(block.id)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-[11px] flex items-center justify-between transition-all cursor-pointer border ${selectedBlockId === block.id ? 'bg-slate-850 border-slate-700 text-white shadow-md' : 'bg-slate-900/10 border-transparent text-slate-400 hover:bg-slate-900/30'}`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {block.type === 'text' && <Type className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />}
                          {block.type === 'image' && <ImageIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                          {block.type === 'table' && <TableIcon className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
                          {block.type === 'shape' && <Square className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                          <span className="truncate font-semibold">{block.name}</span>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {block.isLocked ? (
                            <Lock className="w-3 h-3 text-slate-600" />
                          ) : (
                            <span className="text-[8px] bg-slate-950 px-1 py-0.5 rounded text-slate-500 font-bold">
                              Z.{block.zIndex}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-[10px] text-slate-600 italic py-2 text-center">La página de diseño está limpia.</p>
                )}
              </div>
            </div>

          </div>

          {/* Quick Hints Area */}
          <div className="bg-slate-900/40 p-3 rounded-2xl border border-slate-800 text-[10px] space-y-1.5 leading-relaxed text-slate-400">
            <span className="text-slate-300 font-bold flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-indigo-400" /> Atajos de Diseño Libre
            </span>
            <p>• Suelte archivos de imagen para añadirlos como capa.</p>
            <p>• Mueva capas con mouse drag.</p>
            <p>• Micro-ajuste posiciones usando teclas de dirección.</p>
          </div>

        </aside>

        {/* CENTER INTERACTIVE COMPLIANT SHEET CONTAINER */}
        <main 
          ref={containerRef}
          className="flex-1 bg-slate-900 flex justify-center py-10 overflow-y-auto relative cursor-grab active:cursor-grabbing select-none"
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
        >
          {/* Virtual Grid backdrop representation if activated */}
          {showGrid && (
            <div 
              className="absolute inset-0 pointer-events-none opacity-[0.03]" 
              style={{
                backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
                backgroundSize: '15px 15px'
              }}
            />
          )}

          {/* Scale Wrap element relative to zoomScale state */}
          <div 
            className="flex flex-col gap-10 items-center origin-top transition-transform duration-100 select-none pb-40"
            style={{ 
              transform: `scale(${zoomScale})`,
              width: `${PAGE_WIDTH}px`
            }}
          >
            {pages.length > 0 ? (
              pages.map((page, pIdx) => {
                const isActivePage = activePageIndex === pIdx;
                return (
                  <div
                    key={page.id}
                    id={`wysiwyg-page-canvas-${pIdx}`}
                    // Target Canvas Page element
                    className={`bg-white text-slate-900 border relative select-none transition-all duration-200 ${isActivePage ? 'ring-4 ring-indigo-500 ring-offset-4 ring-offset-slate-900 shadow-2xl' : 'border-slate-800 opacity-95 shadow-xl'}`}
                    style={{
                      width: `${PAGE_WIDTH}px`,
                      height: `${PAGE_HEIGHT}px`,
                      minHeight: `${PAGE_HEIGHT}px`
                    }}
                    onClick={() => {
                      if (activePageIndex !== pIdx) {
                        setActivePageIndex(pIdx);
                        setSelectedBlockId(null);
                      }
                    }}
                    onDragOver={preventDefaults}
                    onDragEnter={preventDefaults}
                    onDrop={handleFileDrop}
                  >
                    {/* Visual page number badge */}
                    <div className="absolute top-4 right-4 bg-slate-100 border border-slate-200 text-slate-500 text-[10px] uppercase font-black px-2.5 py-1 rounded shadow-sm z-40 select-none pointer-events-none opacity-60">
                      Página {pIdx + 1} de {pages.length}
                    </div>

                    {/* Active Layers inside this page */}
                    {page.blocks.map((block) => {
                      const isSelected = selectedBlockId === block.id;
                      
                      return (
                        <div
                          key={block.id}
                          className={`absolute select-none group/box ${isSelected ? 'ring-2 ring-indigo-500 z-50' : ''}`}
                          style={{
                            left: `${block.x}px`,
                            top: `${block.y}px`,
                            width: `${block.width}px`,
                            height: `${block.height}px`,
                            zIndex: block.zIndex,
                            backgroundColor: block.backgroundColor || 'transparent',
                            borderColor: block.borderColor || 'transparent',
                            borderWidth: block.borderWidth ? `${block.borderWidth}px` : '0px',
                            borderStyle: block.borderStyle || 'none',
                            borderRadius: block.borderRadius ? `${block.borderRadius}px` : '0px',
                            padding: block.padding ? `${block.padding}px` : '0px',
                            opacity: block.opacity !== undefined ? block.opacity : 1,
                            boxShadow: block.boxShadow || 'none'
                          }}
                          onMouseDown={(e) => handlePointerDown(e, block, 'move', null, pIdx)}
                        >

                          {/* BLOCK RENDER CONTENT ACCORDING TO SPECS */}
                          <div className="w-full h-full overflow-hidden select-text pointer-events-auto">
                            
                            {/* 1. TEXT TYPE BLOCK */}
                            {block.type === 'text' && (
                              <div
                                className="w-full h-full outline-none p-2 font-sans overflow-y-auto"
                                contentEditable={!block.isLocked}
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const updated = [...pages];
                                  const p = updated[pIdx];
                                  const bIdx = p.blocks.findIndex(b => b.id === block.id);
                                  if (bIdx !== -1) {
                                    p.blocks[bIdx].text = e.target.innerHTML;
                                    setPages(updated);
                                    triggerAutoSave();
                                  }
                                }}
                                style={{
                                  textAlign: block.textAlign || 'left',
                                  fontFamily: block.fontFamily || 'Arial, sans-serif'
                                }}
                                dangerouslySetInnerHTML={{ __html: block.text || '' }}
                              />
                            )}

                            {/* 2. IMAGE TYPE BLOCK */}
                            {block.type === 'image' && (
                              <div className="w-full h-full relative group">
                                {block.imageUrl ? (
                                  <img
                                    referrerPolicy="no-referrer"
                                    src={block.imageUrl}
                                    alt={block.name}
                                    className="w-full h-full select-none pointer-events-none"
                                    style={{ objectFit: block.imageFit || 'cover' }}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-3 text-slate-400 select-none">
                                    <ImageIcon className="w-8 h-8 mb-1" />
                                    <span className="text-[9px] uppercase font-bold">Sin Imagen</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 3. TABLE TYPE BLOCK */}
                            {block.type === 'table' && block.tableData && (
                              <table className="w-full border-collapse text-xs select-none pointer-events-auto">
                                <tbody>
                                  {block.tableData.map((row, rIdx) => {
                                    const isHeader = rIdx === 0;
                                    return (
                                      <tr 
                                        key={rIdx}
                                        style={{
                                          backgroundColor: isHeader 
                                            ? (block.tableHeaderColor || '#0f172a') 
                                            : (block.tableAlternatingRows && rIdx % 2 === 0 ? '#f8fafc' : 'white')
                                        }}
                                      >
                                        {row.map((cellText, cIdx) => (
                                          <td
                                            key={cIdx}
                                            style={{
                                              color: isHeader ? (block.tableHeaderTextColor || 'white') : '#334155',
                                              fontWeight: isHeader ? 'bold' : 'normal',
                                              padding: '6px 8px',
                                              border: '1.5px solid #e2e8f0',
                                              textAlign: 'left',
                                              width: block.tableColumnsWidths ? `${block.tableColumnsWidths[cIdx]}%` : undefined,
                                              wordBreak: 'break-word',
                                              whiteSpace: 'normal'
                                            }}
                                            contentEditable={!block.isLocked}
                                            suppressContentEditableWarning
                                            onBlur={(e) => {
                                              const txt = e.target.innerText;
                                              handleTableCellEdit(pIdx, rIdx, cIdx, txt);
                                            }}
                                          >
                                            {cellText}
                                          </td>
                                        ))}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}

                            {/* 4. COBERTURA SHAPE/CONTAINER TYPE BLOCK */}
                            {block.type === 'shape' && (
                              <div className="w-full h-full" />
                            )}

                          </div>

                          {/* SELECTION GUIDES OR LOCK OUTLINE */}
                          {isSelected && (
                            <>
                              <div className="absolute top-0 left-0 bg-indigo-600 text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-br-md pointer-events-none z-50">
                                {block.name}
                              </div>

                              {/* RESIZE HANDLE ANCHORS */}
                              {!block.isLocked && (
                                <>
                                  <div
                                    className="absolute top-0 left-0 w-3 h-3 bg-white border-2 border-indigo-500 rounded-full cursor-nwse-resize transform -translate-x-[50%] -translate-y-[50%] z-50 hover:bg-indigo-500 transition-colors"
                                    onMouseDown={(e) => handlePointerDown(e, block, 'resize', 'tl', pIdx)}
                                  />
                                  <div
                                    className="absolute top-0 right-0 w-3 h-3 bg-white border-2 border-indigo-500 rounded-full cursor-nesw-resize transform translate-x-[50%] -translate-y-[50%] z-50 hover:bg-indigo-500 transition-colors"
                                    onMouseDown={(e) => handlePointerDown(e, block, 'resize', 'tr', pIdx)}
                                  />
                                  <div
                                    className="absolute bottom-0 left-0 w-3 h-3 bg-white border-2 border-indigo-500 rounded-full cursor-nesw-resize transform -translate-x-[50%] translate-y-[50%] z-50 hover:bg-indigo-500 transition-colors"
                                    onMouseDown={(e) => handlePointerDown(e, block, 'resize', 'bl', pIdx)}
                                  />
                                  <div
                                    className="absolute bottom-0 right-0 w-3 h-3 bg-white border-2 border-indigo-500 rounded-full cursor-nwse-resize transform translate-x-[50%] translate-y-[50%] z-50 hover:bg-indigo-500 transition-colors"
                                    onMouseDown={(e) => handlePointerDown(e, block, 'resize', 'br', pIdx)}
                                  />
                                  <div
                                    className="absolute top-1/2 right-0 w-2.5 h-6 bg-white border-2 border-indigo-500 rounded-md cursor-ew-resize transform translate-x-[50%] -translate-y-[50%] z-50 hover:bg-indigo-500 transition-colors"
                                    onMouseDown={(e) => handlePointerDown(e, block, 'resize', 'r', pIdx)}
                                  />
                                  <div
                                    className="absolute bottom-0 left-1/2 w-6 h-2.5 bg-white border-2 border-indigo-505 rounded-md cursor-ns-resize transform -translate-x-[50%] translate-y-[50%] z-50 hover:bg-indigo-500 transition-colors"
                                    onMouseDown={(e) => handlePointerDown(e, block, 'resize', 'b', pIdx)}
                                  />
                                </>
                              )}
                            </>
                          )}

                        </div>
                      );
                    })}

                  </div>
                );
              })
            ) : (
              <div className="bg-slate-950 p-10 rounded-2xl border border-dashed border-slate-800 text-center text-slate-500">
                Aún no hay páginas construidas.
              </div>
            )}
          </div>
        </main>

        {/* RIGHT COLUMN: DETAILED LAYERS STYLE PANEL & STYLING CONTROLS */}
        <aside className="w-[18vw] min-w-[220px] max-w-[320px] bg-slate-950 border-l border-slate-850 p-4 space-y-5 overflow-y-auto z-10 select-none font-sans">
          
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Propiedades de Capas</span>
          
          {selectedBlockObj ? (
            <div className="space-y-5">
              
              {/* Selected block identifying details */}
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-1.5">
                <span className="text-[8px] bg-indigo-950 border border-indigo-900 text-indigo-400 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Estilo: {selectedBlockObj.type.toUpperCase()}
                </span>
                <input 
                  type="text" 
                  value={selectedBlockObj.name}
                  onChange={(e) => {
                    const updated = [...pages];
                    const p = updated[activePageIndex];
                    const idx = p.blocks.findIndex(b => b.id === selectedBlockObj.id);
                    if (idx !== -1) {
                      p.blocks[idx].name = e.target.value;
                      setPages(updated);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 outline-none"
                  title="Renombrar capa"
                />
              </div>

              {/* Exact Coordinate controls */}
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Dimensiones & Posicion</span>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-semibold text-[9px] uppercase">X (Izquierda px)</span>
                    <input 
                      type="number" 
                      value={selectedBlockObj.x} 
                      disabled={selectedBlockObj.isLocked}
                      onChange={(e) => {
                        const updated = [...pages];
                        const p = updated[activePageIndex];
                        const idx = p.blocks.findIndex(b => b.id === selectedBlockObj.id);
                        if (idx !== -1) {
                          p.blocks[idx].x = parseInt(e.target.value) || 0;
                          setPages(updated);
                        }
                      }}
                      className="bg-slate-900 border border-slate-800 px-2 py-1 text-slate-200 rounded text-center outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-semibold text-[9px] uppercase">Y (Arriba px)</span>
                    <input 
                      type="number" 
                      value={selectedBlockObj.y} 
                      disabled={selectedBlockObj.isLocked}
                      onChange={(e) => {
                        const updated = [...pages];
                        const p = updated[activePageIndex];
                        const idx = p.blocks.findIndex(b => b.id === selectedBlockObj.id);
                        if (idx !== -1) {
                          p.blocks[idx].y = parseInt(e.target.value) || 0;
                          setPages(updated);
                        }
                      }}
                      className="bg-slate-900 border border-slate-800 px-2 py-1 text-slate-200 rounded text-center outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-semibold text-[9px] uppercase">Ancho (An px)</span>
                    <input 
                      type="number" 
                      value={selectedBlockObj.width} 
                      disabled={selectedBlockObj.isLocked}
                      onChange={(e) => {
                        const updated = [...pages];
                        const p = updated[activePageIndex];
                        const idx = p.blocks.findIndex(b => b.id === selectedBlockObj.id);
                        if (idx !== -1) {
                          p.blocks[idx].width = parseInt(e.target.value) || 25;
                          setPages(updated);
                        }
                      }}
                      className="bg-slate-900 border border-slate-800 px-2 py-1 text-slate-200 rounded text-center outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-semibold text-[9px] uppercase">Alto (Al px)</span>
                    <input 
                      type="number" 
                      value={selectedBlockObj.height} 
                      disabled={selectedBlockObj.isLocked}
                      onChange={(e) => {
                        const updated = [...pages];
                        const p = updated[activePageIndex];
                        const idx = p.blocks.findIndex(b => b.id === selectedBlockObj.id);
                        if (idx !== -1) {
                          p.blocks[idx].height = parseInt(e.target.value) || 25;
                          setPages(updated);
                        }
                      }}
                      className="bg-slate-900 border border-slate-800 px-2 py-1 text-slate-200 rounded text-center outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Align relative to physical margins */}
              {!selectedBlockObj.isLocked && (
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Alineación Física</span>
                  <div className="grid grid-cols-3 gap-1">
                    <Button size="sm" variant="ghost" className="bg-slate-900 text-[9px] font-bold p-1 border border-slate-850 h-7" onClick={() => alignSelectedBlock('left')}>Izquierda</Button>
                    <Button size="sm" variant="ghost" className="bg-slate-900 text-[9px] font-bold p-1 border border-slate-850 h-7 text-indigo-400" onClick={() => alignSelectedBlock('center-h')}>Centro H</Button>
                    <Button size="sm" variant="ghost" className="bg-slate-900 text-[9px] font-bold p-1 border border-slate-850 h-7" onClick={() => alignSelectedBlock('right')}>Derecha</Button>
                    <Button size="sm" variant="ghost" className="bg-slate-900 text-[9px] font-bold p-1 border border-slate-850 h-7" onClick={() => alignSelectedBlock('top')}>Arriba</Button>
                    <Button size="sm" variant="ghost" className="bg-slate-900 text-[9px] font-bold p-1 border border-slate-850 h-7 text-indigo-400" onClick={() => alignSelectedBlock('center-v')}>Centro V</Button>
                    <Button size="sm" variant="ghost" className="bg-slate-900 text-[9px] font-bold p-1 border border-slate-850 h-7" onClick={() => alignSelectedBlock('bottom')}>Abajo</Button>
                  </div>
                </div>
              )}

              {/* LOCK & COPY ACTIONS */}
              <div className="flex gap-1.5 pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={toggleBlockLock}
                  className={`flex-1 text-[10px] font-black uppercase h-8 border ${selectedBlockObj.isLocked ? 'bg-amber-950 hover:bg-amber-900 text-amber-400 border-amber-900' : 'bg-slate-900 hover:bg-slate-800 text-slate-350 border-slate-800'}`}
                >
                  {selectedBlockObj.isLocked ? <Unlock className="w-3.5 h-3.5 mr-1" /> : <Lock className="w-3.5 h-3.5 mr-1" />}
                  {selectedBlockObj.isLocked ? "Desbloquear" : "Bloquear Capa"}
                </Button>
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={duplicateSelectedBlock}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] h-8 font-black uppercase text-slate-350"
                  title="Duplicar elemento"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* 1. TYPE TEXT STYLING INSPECT */}
              {selectedBlockObj.type === 'text' && (
                <div className="space-y-3 pt-3 border-t border-slate-900">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Estilo de Texto</span>
                  
                  <div className="space-y-2">
                    <span className="text-[8px] text-slate-500 font-semibold block uppercase">Caja de Tipografía</span>
                    <select 
                      value={selectedBlockObj.fontFamily || 'Arial'} 
                      onChange={(e) => {
                        const updated = [...pages];
                        const p = updated[activePageIndex];
                        const idx = p.blocks.findIndex(b => b.id === selectedBlockObj.id);
                        if (idx !== -1) {
                          p.blocks[idx].fontFamily = e.target.value;
                          setPages(updated);
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-850 text-slate-300 rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    >
                      <option value="Arial">Arial</option>
                      <option value="'Times New Roman'">Times New Roman</option>
                      <option value="'Courier New'">Courier New (Monospace)</option>
                      <option value="'Georgia'">Georgia (Executive Serif)</option>
                      <option value="'Trebuchet MS'">Trebuchet MS</option>
                      <option value="'Verdana'">Verdana (Wide Sans)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 2. TYPE IMAGE CONTROLS */}
              {selectedBlockObj.type === 'image' && (
                <div className="space-y-3 pt-3 border-t border-slate-900">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Control de Imagen</span>
                  
                  <div className="space-y-2">
                    <span className="text-[8px] text-slate-500 font-semibold block uppercase">URL Externa</span>
                    <input 
                      type="text" 
                      value={selectedBlockObj.imageUrl || ''} 
                      onChange={(e) => {
                        const updated = [...pages];
                        const p = updated[activePageIndex];
                        const idx = p.blocks.findIndex(b => b.id === selectedBlockObj.id);
                        if (idx !== -1) {
                          p.blocks[idx].imageUrl = e.target.value;
                          setPages(updated);
                        }
                      }}
                      placeholder="https://su-imagen.com/logo.png"
                      className="w-full bg-slate-900 border border-slate-850 text-slate-300 rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[8px] text-slate-500 font-semibold block uppercase">Ajuste de Relación</span>
                    <div className="grid grid-cols-3 gap-1">
                      {['cover', 'contain', 'fill'].map((fit) => (
                        <button
                          key={fit}
                          onClick={() => {
                            const updated = [...pages];
                            const p = updated[activePageIndex];
                            const idx = p.blocks.findIndex(b => b.id === selectedBlockObj.id);
                            if (idx !== -1) {
                              p.blocks[idx].imageFit = fit as any;
                              setPages(updated);
                            }
                          }}
                          className={`px-1.5 py-1 text-[8px] font-black uppercase rounded border transition-all ${selectedBlockObj.imageFit === fit ? 'bg-indigo-900 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-slate-850 text-slate-500 hover:text-slate-200'}`}
                        >
                          {fit}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 3. TYPE TABLE GRID WORKSPACE */}
              {selectedBlockObj.type === 'table' && (
                <div className="space-y-3 pt-3 border-t border-slate-900">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Estructura de Fila / Columna</span>
                  
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button size="sm" variant="ghost" onClick={addTableRow} className="bg-slate-900 text-[10px] font-black uppercase text-indigo-400 border border-slate-850 h-7">+Fila</Button>
                    <Button size="sm" variant="ghost" onClick={removeTableRow} className="bg-slate-900 text-[10px] font-black uppercase text-red-400 border border-slate-850 h-7">-Fila</Button>
                    <Button size="sm" variant="ghost" onClick={addTableCol} className="bg-slate-900 text-[10px] font-black uppercase text-indigo-400 border border-slate-850 h-7">+Col</Button>
                    <Button size="sm" variant="ghost" onClick={removeTableCol} className="bg-slate-900 text-[10px] font-black uppercase text-red-400 border border-slate-850 h-7">-Col</Button>
                  </div>

                  <div className="space-y-2 pt-2">
                    <span className="text-[8px] text-slate-500 font-bold block uppercase">Color de Cabecera</span>
                    <div className="grid grid-cols-5 gap-1">
                      {['#0f172a', '#991b1b', '#1e3a8a', '#065f46', '#d97706'].map(col => (
                        <button
                          key={col}
                          onClick={() => {
                            const updated = [...pages];
                            const p = updated[activePageIndex];
                            const idx = p.blocks.findIndex(b => b.id === selectedBlockObj.id);
                            if (idx !== -1) {
                              p.blocks[idx].tableHeaderColor = col;
                              setPages(updated);
                            }
                          }}
                          className="w-full h-5 rounded border border-slate-800"
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[10.5px]">
                    <span className="text-slate-400 font-bold">Renglones Alternos:</span>
                    <input 
                      type="checkbox" 
                      checked={!!selectedBlockObj.tableAlternatingRows} 
                      onChange={(e) => {
                        const updated = [...pages];
                        const p = updated[activePageIndex];
                        const idx = p.blocks.findIndex(b => b.id === selectedBlockObj.id);
                        if (idx !== -1) {
                          p.blocks[idx].tableAlternatingRows = e.target.checked;
                          setPages(updated);
                        }
                      }}
                      className="accent-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* 4. BASE LAYER SHAPING (BACKGROUNDS, OPACITY AND CARD REFINEMENTS) */}
              <div className="space-y-3 pt-3 border-t border-slate-900">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Diseño & Capas</span>
                
                {/* Background Selector */}
                <div className="space-y-2">
                  <span className="text-[8px] text-slate-500 font-bold block uppercase">Fondo / Relleno</span>
                  <div className="grid grid-cols-6 gap-1">
                    {['#ffffff', '#f1f5f9', '#4f46e5', '#3b82f6', '#0f172a', 'transparent'].map(bg => (
                      <button
                        key={bg}
                        onClick={() => {
                          const updated = [...pages];
                          const p = updated[activePageIndex];
                          const idx = p.blocks.findIndex(b => b.id === selectedBlockObj.id);
                          if (idx !== -1) {
                            p.blocks[idx].backgroundColor = bg;
                            setPages(updated);
                          }
                        }}
                        className={`h-5 rounded border ${bg === 'transparent' ? 'border-dashed border-slate-650 flex items-center justify-center text-[7px] text-slate-500' : 'border-slate-850'}`}
                        style={{ backgroundColor: bg !== 'transparent' ? bg : 'transparent' }}
                      >
                        {bg === 'transparent' && 'X'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stacking Z-index modifications */}
                <div className="space-y-2">
                  <span className="text-[8px] text-slate-500 font-bold block uppercase">Orden de Apilado (Layers)</span>
                  <div className="grid grid-cols-4 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => moveZIndex('bottom')} className="bg-slate-905 text-[8px] font-bold p-1 border border-slate-850 h-7" title="Enviar al fondo de la página">Al fondo</Button>
                    <Button size="sm" variant="ghost" onClick={() => moveZIndex('lower')} className="bg-slate-905 text-[8px] font-bold p-1 border border-slate-850 h-7" title="Bajar una capa">Bajar</Button>
                    <Button size="sm" variant="ghost" onClick={() => moveZIndex('raise')} className="bg-slate-905 text-[8px] font-bold p-1 border border-slate-850 h-7 text-indigo-400" title="Subir una capa">Subir</Button>
                    <Button size="sm" variant="ghost" onClick={() => moveZIndex('top')} className="bg-slate-905 text-[8px] font-bold p-1 border border-slate-850 h-7 text-indigo-400" title="Traer al frente">Traer al frente</Button>
                  </div>
                </div>

                {/* Corner curves */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span className="font-bold uppercase text-[8px]">Curvatura Esquinas:</span>
                    <span className="text-[9px] text-slate-300">{selectedBlockObj.borderRadius || 0}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="40" 
                    value={selectedBlockObj.borderRadius || 0}
                    onChange={(e) => {
                      const updated = [...pages];
                      const p = updated[activePageIndex];
                      const idx = p.blocks.findIndex(b => b.id === selectedBlockObj.id);
                      if (idx !== -1) {
                        p.blocks[idx].borderRadius = parseInt(e.target.value);
                        setPages(updated);
                      }
                    }}
                    className="w-full accent-indigo-500 cursor-pointer h-1"
                  />
                </div>

                {/* Opacity slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span className="font-bold uppercase text-[8px]">Opacidad de Capa:</span>
                    <span className="text-[9px] text-slate-300">{Math.round((selectedBlockObj.opacity !== undefined ? selectedBlockObj.opacity : 1) * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="1.0" 
                    step="0.05"
                    value={selectedBlockObj.opacity !== undefined ? selectedBlockObj.opacity : 1}
                    onChange={(e) => {
                      const updated = [...pages];
                      const p = updated[activePageIndex];
                      const idx = p.blocks.findIndex(b => b.id === selectedBlockObj.id);
                      if (idx !== -1) {
                        p.blocks[idx].opacity = parseFloat(e.target.value);
                        setPages(updated);
                      }
                    }}
                    className="w-full accent-indigo-500 cursor-pointer h-1"
                  />
                </div>

              </div>

            </div>
          ) : (
            <div className="bg-slate-900/30 p-10 rounded-2xl border border-dashed border-slate-850 text-center text-slate-500 py-16">
              <Layers className="w-8 h-8 mx-auto mb-2 text-slate-700" />
              <p className="text-xs italic leading-relaxed">Seleccione un elemento del lienzo o lienzo lateral para configurar coordenadas, colores, letras y alineaciones.</p>
            </div>
          )}

        </aside>

      </div>

      {/* 4. HIDDEN COMPLIANT CONTAINER FOR PRINT EXPORT - RENDERS EXACT ABSOLUTE LAYOUT AT 1:1 RESOLUTION */}
      <div className="absolute left-[1000vw] top-[1000vw] pointer-events-none no-print">
        <div id="wysiwyg-print-view" className="bg-slate-950 p-0 m-0" style={{ width: `${PAGE_WIDTH}px` }}>
          {pages.map((p, pageIdx) => (
            <div
              key={p.id}
              className="bg-white text-slate-900 relative p-0 m-0 overflow-hidden"
              style={{
                width: `${PAGE_WIDTH}px`,
                height: `${PAGE_HEIGHT}px`,
                pageBreakAfter: 'always',
                breakAfter: 'always'
              }}
            >
              {p.blocks.map((block) => (
                <div
                  key={block.id}
                  className="absolute p-0 m-0 overflow-hidden"
                  style={{
                    left: `${block.x}px`,
                    top: `${block.y}px`,
                    width: `${block.width}px`,
                    height: `${block.height}px`,
                    zIndex: block.zIndex,
                    backgroundColor: block.backgroundColor || 'transparent',
                    borderColor: block.borderColor || 'transparent',
                    borderWidth: block.borderWidth ? `${block.borderWidth}px` : '0px',
                    borderStyle: block.borderStyle || 'none',
                    borderRadius: block.borderRadius ? `${block.borderRadius}px` : '0px',
                    padding: block.padding ? `${block.padding}px` : '0px',
                    opacity: block.opacity !== undefined ? block.opacity : 1,
                    boxShadow: block.boxShadow || 'none'
                  }}
                >
                  
                  {block.type === 'text' && (
                    <div 
                      className="w-full h-full p-2 font-sans overflow-hidden" 
                      style={{ 
                        textAlign: block.textAlign || 'left',
                        fontFamily: block.fontFamily || 'Arial, sans-serif'
                      }}
                      dangerouslySetInnerHTML={{ __html: block.text || '' }}
                    />
                  )}

                  {block.type === 'image' && block.imageUrl && (
                    <img
                      referrerPolicy="no-referrer"
                      src={block.imageUrl}
                      alt={block.name}
                      className="w-full h-full select-none"
                      style={{ objectFit: block.imageFit || 'cover' }}
                    />
                  )}

                  {block.type === 'table' && block.tableData && (
                    <table className="w-full border-collapse text-xs">
                      <tbody>
                        {block.tableData.map((row, rIdx) => {
                          const isHeader = rIdx === 0;
                          return (
                            <tr 
                              key={rIdx}
                              style={{
                                backgroundColor: isHeader 
                                  ? (block.tableHeaderColor || '#0f172a') 
                                  : (block.tableAlternatingRows && rIdx % 2 === 0 ? '#f8fafc' : 'white')
                              }}
                            >
                              {row.map((cellText, cIdx) => (
                                <td
                                  key={cIdx}
                                  style={{
                                    color: isHeader ? (block.tableHeaderTextColor || 'white') : '#334155',
                                    fontWeight: isHeader ? 'bold' : 'normal',
                                    padding: '6px 8px',
                                    border: '1.5px solid #e2e8f0',
                                    textAlign: 'left',
                                    width: block.tableColumnsWidths ? `${block.tableColumnsWidths[cIdx]}%` : undefined,
                                    wordBreak: 'break-word',
                                    whiteSpace: 'normal'
                                  }}
                                >
                                  {cellText}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {block.type === 'shape' && (
                    <div className="w-full h-full" />
                  )}

                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
