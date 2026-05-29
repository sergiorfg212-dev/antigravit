import type { Company } from "../../lib/db";
import type { WYSIWYGBlock, WYSIWYGPage } from "./WordWysiwygEditor";

const PAGE_WIDTH = 816;
const PAGE_HEIGHT = 1056;

export function getWysiwygTemplatePages(
  company: Company,
  checklistItems: any[],
  findings: any[],
  hazards: any[], // unused or optional
  accidentEvents: any[],
  safetyProgram: any[],
  legalMatrix: any[]
): WYSIWYGPage[] {
  const defaultPages: WYSIWYGPage[] = [];

  // 1. Calculations for Safety stats
  const accidentsCount = accidentEvents.filter((e) => e.type === 'accident').length || 0;
  const daysLostCount = accidentEvents.reduce((acc, e) => acc + (e.daysLost || 0), 0) || 0;
  const hoursWorked = company.totalHoursWorked || (company.workerCount * 240 * 8) || 1;
  const statIF = ((accidentsCount * 200000) / hoursWorked).toFixed(2);
  const statIG = ((daysLostCount * 200000) / hoursWorked).toFixed(2);

  // ==================== PAGINA 1: PORTADA ====================
  const page1Blocks: WYSIWYGBlock[] = [
    {
      id: 'p1-top-banner',
      type: 'shape',
      name: 'Banner Superior de Portada',
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: 160,
      zIndex: 1,
      backgroundColor: '#0f172a',
      isLocked: true
    },
    {
      id: 'p1-top-banner-text',
      type: 'text',
      name: 'Metadatos Superiores',
      x: 60,
      y: 40,
      width: 480,
      height: 90,
      zIndex: 2,
      text: `
        <p style="margin: 0; font-size: 11px; font-weight: bold; color: #6366f1; letter-spacing: 0.15em; text-transform: uppercase;">Servicios Preventivos de Seguridad e Higiene</p>
        <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.05em;">NOM-030-STPS-2009</p>
        <p style="margin: 2px 0 0 0; font-size: 10px; color: #94a3b8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">DICTAMEN DE CUMPLIMIENTO Y PREVENCIÓN DE ACCIDENTES</p>
      `,
      fontFamily: 'Arial',
      textAlign: 'left'
    },
    {
      id: 'p1-logo-container',
      type: 'shape',
      name: 'Contenedor Flotante Logo',
      x: PAGE_WIDTH - 210,
      y: 30,
      width: 150,
      height: 100,
      zIndex: 2,
      backgroundColor: '#ffffff',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderStyle: 'solid',
      isLocked: true
    },
    {
      id: 'p1-logo',
      type: 'image',
      name: 'Logo Corporativo',
      x: PAGE_WIDTH - 195,
      y: 40,
      width: 120,
      height: 80,
      zIndex: 3,
      imageUrl: company.logo || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=140&q=80',
      imageFit: 'contain'
    },
    {
      id: 'p1-title-panel',
      type: 'text',
      name: 'Título Principal',
      x: 60,
      y: 210,
      width: 696,
      height: 190,
      zIndex: 2,
      text: `
        <h1 style="margin: 0; font-size: 32px; font-weight: 900; line-height: 1.15; color: #0f172a; tracking: -0.01em;">DIAGNÓSTICO ESTRUCTURAL<br/><span style="color: #4f46e5;">DE SEGURIDAD Y SALUD</span></h1>
        <p style="margin: 15px 0 0 0; font-size: 13px; line-height: 1.6; color: #475569; text-align: justify;">Estudio de campo analítico para la correcta identificación de peligros, evaluación sistemática de riesgos laborales y formulación del programa anual de seguridad e higiene, de plena conformidad con las directrices federales vigentes.</p>
      `,
      fontFamily: 'Arial',
      textAlign: 'left'
    },
    {
      id: 'p1-decor-bar',
      type: 'shape',
      name: 'Línea de Acento',
      x: 60,
      y: 400,
      width: 150,
      height: 6,
      zIndex: 2,
      backgroundColor: '#4f46e5',
      borderRadius: 3
    },
    {
      id: 'p1-table-card',
      type: 'table',
      name: 'Ficha Técnica de Portada',
      x: 60,
      y: 435,
      width: 696,
      height: 320,
      zIndex: 4,
      tableColumnsWidths: [38, 62],
      tableData: [
        ['DATOS GENERALES DE REGISTRO', 'INFORMACIÓN CORPORATIVA DECLARADA'],
        ['Razón Social / Organización', company.name || 'Empresa de Prueba S.A.'],
        ['Registro Federal de Contribuyentes', company.rfc || 'XAXX010101000'],
        ['Domicilio Operativo de la Planta', company.address || 'Calle Central 456, Parque Industrial'],
        ['Representante Técnico / Responsable', company.responsibleName || 'Director de Planta'],
        ['Clase de Riesgo (IMSS)', `Clase ${company.riskLevel || 'I'}`],
        ['Fecha Oficial de Emisión', company.studyDate ? new Date(company.studyDate).toLocaleDateString() : new Date().toLocaleDateString()]
      ],
      tableHeaderColor: '#0f172a',
      tableHeaderTextColor: '#ffffff',
      tableAlternatingRows: true
    },
    {
      id: 'p1-seal-bg',
      type: 'shape',
      name: 'Fondo de Sello de Validez',
      x: 60,
      y: 790,
      width: 696,
      height: 110,
      zIndex: 2,
      backgroundColor: '#f8fafc',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderStyle: 'solid',
      isLocked: true
    },
    {
      id: 'p1-seal-text',
      type: 'text',
      name: 'Declaratoria de Validez',
      x: 80,
      y: 805,
      width: 656,
      height: 80,
      zIndex: 3,
      text: `
        <div style="font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: space-between;">
          <div style="flex: 2; padding-right: 20px;">
            <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">Declaración de Validez y Certificación</p>
            <p style="margin: 4px 0 0 0; font-size: 10px; color: #64748b; line-height: 1.45;">El presente dictamen reúne las observaciones, evaluaciones y planes de control fácticos recabados por el especialista técnico asignado al centro de trabajo declarado.</p>
          </div>
          <div style="flex: 1; text-align: right; border-left: 1px solid #cbd5e1; padding-left: 20px; min-width: 180px;">
            <p style="margin: 0; font-size: 10px; font-weight: bold; color: #4f46e5; text-transform: uppercase;">ID de Verificación</p>
            <p style="margin: 2px 0 0 0; font-family: monospace; font-size: 11.5px; font-weight: bold; color: #0f172a; letter-spacing: 0.05em;">NOM030-2026-STPS</p>
          </div>
        </div>
      `,
      fontFamily: 'Arial',
      textAlign: 'left'
    },
    {
      id: 'p1-footer',
      type: 'text',
      name: 'Pie de Portada',
      x: 60,
      y: PAGE_HEIGHT - 80,
      width: 696,
      height: 35,
      zIndex: 2,
      text: `
        <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; display: flex; justify-content: space-between; font-size: 9px; font-weight: bold; color: #94a3b8; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.02em;">
          <span>Documento Técnico Oficial S.P.S.</span>
          <span>Confidencial • Copia Controlada</span>
          <span>Periodo Ciclo 2026</span>
        </div>
      `,
      fontFamily: 'Arial',
      textAlign: 'left'
    }
  ];

  // ==================== PAGINA 2: ÍNDICE DE SECCIONES ====================
  const page2Blocks: WYSIWYGBlock[] = [
    {
      id: 'p2-header',
      type: 'text',
      name: 'Cabeza Pág 2',
      x: 50,
      y: 40,
      width: 716,
      height: 40,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase;"><span>${company.name} • Diagnóstico NOM-030</span><span>Pág 2</span></div>`,
      fontFamily: 'Arial'
    },
    {
      id: 'p2-sec-title',
      type: 'text',
      name: 'Título Sección II',
      x: 50,
      y: 100,
      width: 716,
      height: 50,
      zIndex: 2,
      text: '<h2 style="margin: 0; font-size: 16px; font-weight: bold; border-left: 4px solid #0f172a; padding-left: 10px; color: #0f172a; text-transform: uppercase;">Índice General de Secciones</h2>',
      fontFamily: 'Arial'
    },
    {
      id: 'p2-index-list',
      type: 'text',
      name: 'Lista Capítulos',
      x: 50,
      y: 170,
      width: 716,
      height: 700,
      zIndex: 2,
      text: `
        <div style="font-size: 11px; line-height: 2.1; color: #334155; font-family: Arial;">
          <div style="display:flex; justify-content:space-between;"><strong>01. Portada del Dictamen de Seguridad</strong><span style="border-bottom:1px dotted #cbd5e1; flex:1; margin:0 10px;"></span><strong>Pág 1</strong></div>
          <div style="display:flex; justify-content:space-between;"><strong>02. Índice General de Secciones</strong><span style="border-bottom:1px dotted #cbd5e1; flex:1; margin:0 10px;"></span><strong>Pág 2</strong></div>
          <div style="display:flex; justify-content:space-between;"><strong>03. Objetivo General del Diagnóstico</strong><span style="border-bottom:1px dotted #cbd5e1; flex:1; margin:0 10px;"></span><strong>Pág 3</strong></div>
          <div style="display:flex; justify-content:space-between;"><strong>04. Datos Generales e Identificación Corporativa</strong><span style="border-bottom:1px dotted #cbd5e1; flex:1; margin:0 10px;"></span><strong>Pág 4</strong></div>
          <div style="display:flex; justify-content:space-between;"><strong>05. Localización Geográfica del Centro de Trabajo</strong><span style="border-bottom:1px dotted #cbd5e1; flex:1; margin:0 10px;"></span><strong>Pág 5</strong></div>
          <div style="display:flex; justify-content:space-between;"><strong>06. Infraestructura de las Instalaciones y Entorno</strong><span style="border-bottom:1px dotted #cbd5e1; flex:1; margin:0 10px;"></span><strong>Pág 6</strong></div>
          <div style="display:flex; justify-content:space-between;"><strong>07. Introducción y Contextualización del Estudio</strong><span style="border-bottom:1px dotted #cbd5e1; flex:1; margin:0 10px;"></span><strong>Pág 7</strong></div>
          <div style="display:flex; justify-content:space-between;"><strong>08. Marco Legal y Requisitos de Autoridad</strong><span style="border-bottom:1px dotted #cbd5e1; flex:1; margin:0 10px;"></span><strong>Pág 8</strong></div>
          <div style="display:flex; justify-content:space-between;"><strong>09. Normativa Oficial Mexicana Aplicable (NOM)</strong><span style="border-bottom:1px dotted #cbd5e1; flex:1; margin:0 10px;"></span><strong>Pág 9</strong></div>
          <div style="display:flex; justify-content:space-between;"><strong>10. Descripción del Proceso Operativo y Flujograma</strong><span style="border-bottom:1px dotted #cbd5e1; flex:1; margin:0 10px;"></span><strong>Pág 10</strong></div>
          <div style="display:flex; justify-content:space-between;"><strong>11. Metodología de Evaluación de Riesgos Laborales</strong><span style="border-bottom:1px dotted #cbd5e1; flex:1; margin:0 10px;"></span><strong>Pág 11</strong></div>
          <div style="display:flex; justify-content:space-between;"><strong>12. Matriz Consolidada de Riesgos y Hallazgos</strong><span style="border-bottom:1px dotted #cbd5e1; flex:1; margin:0 10px;"></span><strong>Pág 12</strong></div>
          <div style="display:flex; justify-content:space-between;"><strong>13. Accidentabilidad e Índices de Siniestralidad</strong><span style="border-bottom:1px dotted #cbd5e1; flex:1; margin:0 10px;"></span><strong>Pág 13</strong></div>
          <div style="display:flex; justify-content:space-between;"><strong>14. Programa Integral de Seguridad y Salud</strong><span style="border-bottom:1px dotted #cbd5e1; flex:1; margin:0 10px;"></span><strong>Pág 14</strong></div>
          <div style="display:flex; justify-content:space-between;"><strong>15. Bitácora de Evidencias de Cumplimiento</strong><span style="border-bottom:1px dotted #cbd5e1; flex:1; margin:0 10px;"></span><strong>Pág 15</strong></div>
          <div style="display:flex; justify-content:space-between;"><strong>16. Conclusiones Analíticas y Recomendaciones</strong><span style="border-bottom:1px dotted #cbd5e1; flex:1; margin:0 10px;"></span><strong>Pág 16</strong></div>
          <div style="display:flex; justify-content:space-between;"><strong>17. Anexos de Soporte y Carta de Responsabilidad</strong><span style="border-bottom:1px dotted #cbd5e1; flex:1; margin:0 10px;"></span><strong>Pág 17</strong></div>
        </div>
      `,
      fontFamily: 'Arial'
    },
    {
      id: 'p2-footer',
      type: 'text',
      name: 'Pie Pág 2',
      x: 50,
      y: PAGE_HEIGHT - 60,
      width: 716,
      height: 30,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 8px; color: #94a3b8; font-weight: bold;"><span>VIGILANCIA NOM-030 STPS</span><span>Página 2</span></div>`,
      fontFamily: 'Arial'
    }
  ];

  // ==================== PAGINA 3: OBJETIVO DEL ESTUDIO ====================
  const page3Blocks: WYSIWYGBlock[] = [
    {
      id: 'p3-header',
      type: 'text',
      name: 'Cabeza Pág 3',
      x: 50,
      y: 40,
      width: 716,
      height: 40,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase;"><span>${company.name} • Diagnóstico NOM-030</span><span>Pág 3</span></div>`,
      fontFamily: 'Arial'
    },
    {
      id: 'p3-sec-title',
      type: 'text',
      name: 'Título Sección III',
      x: 50,
      y: 100,
      width: 716,
      height: 50,
      zIndex: 2,
      text: '<h2 style="margin: 0; font-size: 16px; font-weight: bold; border-left: 4px solid #4f46e5; padding-left: 10px; color: #0f172a; text-transform: uppercase;">Objetivo General & Alcance</h2>',
      fontFamily: 'Arial'
    },
    {
      id: 'p3-target-body',
      type: 'text',
      name: 'Panel Objetivo',
      x: 50,
      y: 170,
      width: 716,
      height: 250,
      zIndex: 3,
      text: `<div style="background-color: #f8fafc; border-left: 5px solid #4f46e5; border-radius: 0 12px 12px 0; padding: 20px; font-size: 13px; line-height: 1.6; color: #334155; text-align: justify;"><strong style="color: #4f46e5; display: block; margin-bottom: 5px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">Declaratoria de Objetivo:</strong>${company.reportTarget || 'Consolidar un análisis sistemático de condiciones físicas, señalética, maquinaria y factores ambientales a fin de estructurar programas preventivos viables alineados con la normatividad federal.'}</div>`,
      fontFamily: 'Arial'
    },
    {
      id: 'p3-scope-body',
      type: 'text',
      name: 'Texto Alcance',
      x: 50,
      y: 460,
      width: 716,
      height: 280,
      zIndex: 2,
      text: `<p style="margin: 0 0 15px 0; font-size: 13px; line-height: 1.65; text-align: justify; color: #334155;">El alcance de este dictamen abarca todo el perímetro físico, maquinaria, materias primas y personal operativo que conforma el centro de trabajo de <strong>${company.name}</strong>. Se evalúan puntualmente las medidas de control administrativo y físico a fin de mitigar riesgos de accidentes o detrimentos en la salud de la fuerza laboral expuesta de forma directa.</p>`,
      fontFamily: 'Arial'
    },
    {
      id: 'p3-footer',
      type: 'text',
      name: 'Pie Pág 3',
      x: 50,
      y: PAGE_HEIGHT - 60,
      width: 716,
      height: 30,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 8px; color: #94a3b8; font-weight: bold;"><span>INSPECCIÓN ANUAL PREVENTIVA</span><span>Página 3</span></div>`,
      fontFamily: 'Arial'
    }
  ];

  // ==================== PAGINA 4: DATOS GENERALES DE LA EMPRESA ====================
  const page4Blocks: WYSIWYGBlock[] = [
    {
      id: 'p4-header',
      type: 'text',
      name: 'Cabeza Pág 4',
      x: 50,
      y: 40,
      width: 716,
      height: 40,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase;"><span>${company.name} • Diagnóstico NOM-030</span><span>Pág 4</span></div>`,
      fontFamily: 'Arial'
    },
    {
      id: 'p4-sec-title',
      type: 'text',
      name: 'Título Sección IV',
      x: 50,
      y: 100,
      width: 716,
      height: 50,
      zIndex: 2,
      text: '<h2 style="margin: 0; font-size: 16px; font-weight: bold; border-left: 4px solid #0f172a; padding-left: 10px; color: #0f172a; text-transform: uppercase;">Datos Generales e Identificación</h2>',
      fontFamily: 'Arial'
    },
    {
      id: 'p4-data-table',
      type: 'table',
      name: 'Tabla Identificación Empresa',
      x: 50,
      y: 170,
      width: 716,
      height: 520,
      zIndex: 3,
      tableColumnsWidths: [38, 62],
      tableData: [
        ['PARÁMETRO CORPORATIVO', 'INTEGRACIÓN REGISTRADA EN BASE DE DATOS'],
        ['Razón Social Comercial', company.name || 'Empresa de Prueba S.A.'],
        ['Registro Fiscal (RFC)', company.rfc || 'XAXX010101000'],
        ['Actividad Comercial Secundaria', company.activity || 'Industrial General'],
        ['Línea de Negocio Declarada', company.businessLine || 'Sector de Manufactura'],
        ['Trabajadores Registrados', `${company.workerCount || 10} personas activas`],
        ['Clase de Riesgo (IMSS)', `Clase ${company.riskLevel || 'I'}`],
        ['Turnos Operativos', company.shifts || '1 Turno Fijo'],
        ['Superficie del Terreno', `${company.totalPlotArea || 120} m²`],
        ['Superficie Construida', `${company.totalBuiltArea || 100} m²`],
        ['Estatus Predial', (company.propertyStatus || 'PROPIA').toUpperCase()]
      ],
      tableHeaderColor: '#1e293b',
      tableHeaderTextColor: '#ffffff',
      tableAlternatingRows: true
    },
    {
      id: 'p4-footer',
      type: 'text',
      name: 'Pie Pág 4',
      x: 50,
      y: PAGE_HEIGHT - 60,
      width: 716,
      height: 30,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 8px; color: #94a3b8; font-weight: bold;"><span>EXPEDIENTE CORPORATIVO ESTABLECIDO</span><span>Página 4</span></div>`,
      fontFamily: 'Arial'
    }
  ];

  // ==================== PAGINA 5: LOCALIZACIÓN DE LA EMPRESA ====================
  const page5Blocks: WYSIWYGBlock[] = [
    {
      id: 'p5-header',
      type: 'text',
      name: 'Cabeza Pág 5',
      x: 50,
      y: 40,
      width: 716,
      height: 40,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase;"><span>${company.name} • Diagnóstico NOM-030</span><span>Pág 5</span></div>`,
      fontFamily: 'Arial'
    },
    {
      id: 'p5-sec-title',
      type: 'text',
      name: 'Título Sección V',
      x: 50,
      y: 100,
      width: 716,
      height: 50,
      zIndex: 2,
      text: '<h2 style="margin: 0; font-size: 16px; font-weight: bold; border-left: 4px solid #0f172a; padding-left: 10px; color: #0f172a; text-transform: uppercase;">Localización Geográfica</h2>',
      fontFamily: 'Arial'
    },
    {
      id: 'p5-address-panel',
      type: 'text',
      name: 'Panel Dirección Completa',
      x: 50,
      y: 170,
      width: 350,
      height: 420,
      zIndex: 3,
      text: `
        <div style="font-size:12.5px; line-height:1.65; color:#334155; font-family:Arial;">
          <p><strong>Dirección Oficina/Planta:</strong><br/>
          ${company.address || 'Ubicación Física No Catalogada Exacta'}</p>
          <p style="margin-top:15px;"><strong>Especificaciones de Coordenadas:</strong><br/>
            • Latitud: ${company.latitude || 'No Registrada'}<br/>
            • Longitud: ${company.longitude || 'No Registrada'}<br/>
            • Altura: ${company.altitude ? `${company.altitude} m` : 'No Registrada'}
          </p>
          <p style="margin-top:15px;"><strong>Accesibilidad Vial:</strong><br/>
            ${company.accessibilityDescription || 'Vialidades con pavimentación industrial de alta carga y fácil acceso para camiones rígidos.'}
          </p>
        </div>
      `,
      fontFamily: 'Arial'
    },
    {
      id: 'p5-sketch',
      type: 'image',
      name: 'Mapa Macrolocalización',
      x: 420,
      y: 170,
      width: 346,
      height: 250,
      zIndex: 3,
      imageUrl: company.localizationSketch || 'https://images.unsplash.com/photo-1524661135339-9140b00787e3?w=400&q=80',
      imageFit: 'contain'
    },
    {
      id: 'p5-footer',
      type: 'text',
      name: 'Pie Pág 5',
      x: 50,
      y: PAGE_HEIGHT - 60,
      width: 716,
      height: 30,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 8px; color: #94a3b8; font-weight: bold;"><span>REFERENCIAS MACROGEOGRÁFICAS</span><span>Página 5</span></div>`,
      fontFamily: 'Arial'
    }
  ];

  // ==================== PAGINA 6: INFRAESTRUCTURA DE LAS INSTALACIONES ====================
  const page6Blocks: WYSIWYGBlock[] = [
    {
      id: 'p6-header',
      type: 'text',
      name: 'Cabeza Pág 6',
      x: 50,
      y: 40,
      width: 716,
      height: 40,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase;"><span>${company.name} • Diagnóstico NOM-030</span><span>Pág 6</span></div>`,
      fontFamily: 'Arial'
    },
    {
      id: 'p6-sec-title',
      type: 'text',
      name: 'Título Sección VI',
      x: 50,
      y: 100,
      width: 716,
      height: 50,
      zIndex: 2,
      text: '<h2 style="margin: 0; font-size: 16px; font-weight: bold; border-left: 4px solid #0f172a; padding-left: 10px; color: #0f172a; text-transform: uppercase;">Infraestructura Física</h2>',
      fontFamily: 'Arial'
    },
    {
      id: 'p6-infra-panel',
      type: 'text',
      name: 'Panel Infraestructura Física',
      x: 50,
      y: 170,
      width: 350,
      height: 420,
      zIndex: 3,
      text: `
        <div style="font-size:12.5px; line-height:1.65; color:#334155; font-family:Arial;">
          <p><strong>Estructura General:</strong><br/>
          ${company.infrastructureDescription || 'El centro consta de naves industriales construidas con zapatas de concreto armado, columnas y trabes metálicas de alta resistencia, y techumbre de lámina termoacústica.'}</p>
          <p style="margin-top:15px;"><strong>Áreas Técnicas Reconocidas:</strong><br/>
            Sectores de oficinas ejecutivas, línea de producción primaria, patio de carga, almacén de producto terminado y taller mecánico de mantenimiento interno.
          </p>
        </div>
      `,
      fontFamily: 'Arial'
    },
    {
      id: 'p6-layout',
      type: 'image',
      name: 'Plano de Planta',
      x: 420,
      y: 170,
      width: 346,
      height: 250,
      zIndex: 3,
      imageUrl: company.layoutUrl || 'https://images.unsplash.com/photo-1541462608141-2c5233b4e240?w=400&q=80',
      imageFit: 'contain'
    },
    {
      id: 'p6-footer',
      type: 'text',
      name: 'Pie Pág 6',
      x: 50,
      y: PAGE_HEIGHT - 60,
      width: 716,
      height: 30,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 8px; color: #94a3b8; font-weight: bold;"><span>DISTRIBUCIÓN Y ÁREAS DE SEGURIDAD</span><span>Página 6</span></div>`,
      fontFamily: 'Arial'
    }
  ];

  // ==================== PAGINA 7: INTRODUCCIÓN GENERAL DEL ESTUDIO ====================
  const page7Blocks: WYSIWYGBlock[] = [
    {
      id: 'p7-header',
      type: 'text',
      name: 'Cabeza Pág 7',
      x: 50,
      y: 40,
      width: 716,
      height: 40,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase;"><span>${company.name} • Diagnóstico NOM-030</span><span>Pág 7</span></div>`,
      fontFamily: 'Arial'
    },
    {
      id: 'p7-sec-title',
      type: 'text',
      name: 'Título Sección VII',
      x: 50,
      y: 100,
      width: 716,
      height: 50,
      zIndex: 2,
      text: '<h2 style="margin: 0; font-size: 16px; font-weight: bold; border-left: 4px solid #0f172a; padding-left: 10px; color: #0f172a; text-transform: uppercase;">Capítulo I: Introducción</h2>',
      fontFamily: 'Arial'
    },
    {
      id: 'p7-intro-body',
      type: 'text',
      name: 'Cuerpo de Introducción',
      x: 50,
      y: 170,
      width: 716,
      height: 600,
      zIndex: 2,
      text: `<div style="font-size:13.5px; line-height:1.75; text-align:justify; color:#334155; font-family:Arial;">${company.reportIntro || 'La instauración proactiva y periódica de evaluaciones de salud e higiene en el trabajo resulta medular para la viabilidad de cualquier empresa en el entorno moderno. Este diagnóstico formal y analítico bajo la NOM-030 persigue mitigar accidentes y optimizar la regularización oportuna ante dependencias públicas de inspección.'}</div>`,
      fontFamily: 'Arial'
    },
    {
      id: 'p7-footer',
      type: 'text',
      name: 'Pie Pág 7',
      x: 50,
      y: PAGE_HEIGHT - 60,
      width: 716,
      height: 30,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 8px; color: #94a3b8; font-weight: bold;"><span>NÓMINA PREVENTIVA NOM-030 STPS</span><span>Página 7</span></div>`,
      fontFamily: 'Arial'
    }
  ];

  // ==================== PAGINA 8: MARCO LEGAL Y REQUISITOS DE AUTORIDAD ====================
  const page8Blocks: WYSIWYGBlock[] = [
    {
      id: 'p8-header',
      type: 'text',
      name: 'Cabeza Pág 8',
      x: 50,
      y: 40,
      width: 716,
      height: 40,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase;"><span>${company.name} • Diagnóstico NOM-030</span><span>Pág 8</span></div>`,
      fontFamily: 'Arial'
    },
    {
      id: 'p8-sec-title',
      type: 'text',
      name: 'Título Sección VIII',
      x: 50,
      y: 100,
      width: 716,
      height: 50,
      zIndex: 2,
      text: '<h2 style="margin: 0; font-size: 16px; font-weight: bold; border-left: 4px solid #0f172a; padding-left: 10px; color: #0a2540; text-transform: uppercase;">Marco Legal y Requisitos</h2>',
      fontFamily: 'Arial'
    },
    {
      id: 'p8-legal-table',
      type: 'table',
      name: 'Tabla Matriz Legal',
      x: 50,
      y: 170,
      width: 716,
      height: 750,
      zIndex: 3,
      tableColumnsWidths: [18, 26, 56],
      tableData: legalMatrix.length > 0 ? [
        ['AUTORIDAD', 'CODIGO / REGLAMENTO', 'DESCRIPCIÓN DEL REQUISITO LEGAL PATRONAL'],
        ...legalMatrix.slice(0, 8).map(m => [m.authority || 'STPS', m.nomCode || 'General', m.requirement || 'Estudio de Previsión'])
      ] : [
        ['AUTORIDAD', 'CODIGO / REGLAMENTO', 'DESCRIPCIÓN DEL REQUISITO LEGAL PATRONAL'],
        ['STPS', 'Ley Federal del Trabajo - Art 512', 'Establece obligaciones patronales para mantener centros de trabajo libres de accidentes.'],
        ['STPS', 'Reglamento RyS - Art 17', 'Específica la obligatoriedad de sostener un diagnóstico de seguridad vigente.'],
        ['IMSS', 'Ley del Seguro Social - Art 71', 'Regula la prima de riesgo según los incidentes del período previo.'],
        ['P. Civil', 'Ley general de PC', 'Exige planes periódicos de evacuación, simulacros y brigadas con registro de control.']
      ],
      tableHeaderColor: '#0a2540',
      tableHeaderTextColor: '#ffffff',
      tableAlternatingRows: true
    },
    {
      id: 'p8-footer',
      type: 'text',
      name: 'Pie Pág 8',
      x: 50,
      y: PAGE_HEIGHT - 60,
      width: 716,
      height: 30,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 8px; color: #94a3b8; font-weight: bold;"><span>AUDITORÍA DE REGLAS DE CUMPLIMIENTO</span><span>Página 8</span></div>`,
      fontFamily: 'Arial'
    }
  ];

  // ==================== PAGINA 9: NORMATIVA OFICIAL MEXICANA ====================
  const page9Blocks: WYSIWYGBlock[] = [
    {
      id: 'p9-header',
      type: 'text',
      name: 'Cabeza Pág 9',
      x: 50,
      y: 40,
      width: 716,
      height: 40,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase;"><span>${company.name} • Diagnóstico NOM-030</span><span>Pág 9</span></div>`,
      fontFamily: 'Arial'
    },
    {
      id: 'p9-sec-title',
      type: 'text',
      name: 'Título Sección IX',
      x: 50,
      y: 100,
      width: 716,
      height: 50,
      zIndex: 2,
      text: '<h2 style="margin: 0; font-size: 16px; font-weight: bold; border-left: 4px solid #1e3a8a; padding-left: 10px; color: #1e3a8a; text-transform: uppercase;">Evaluación de Normas Oficiales (STPS)</h2>',
      fontFamily: 'Arial'
    },
    {
      id: 'p9-noms-table',
      type: 'table',
      name: 'Tabla Normas Evaluadas',
      x: 50,
      y: 170,
      width: 716,
      height: 750,
      zIndex: 3,
      tableColumnsWidths: [22, 50, 28],
      tableData: checklistItems.length > 0 ? [
        ['NORMA CLAVE STPS', 'MATERIA CONCRETA EVALUADA', 'ESTATUS COAGULADO DE COMPLIANCE'],
        ...checklistItems.slice(0, 10).map(c => [
          c.nomCode || 'NOM-STPS',
          c.requirement?.substring(0, 75) || 'Condición de salud laboral',
          c.compliance === 'compliance' ? 'CUMPLE REGISTRO' : (c.compliance === 'partial' ? 'PARCIAL' : 'NO CUMPLE')
        ])
      ] : [
        ['NORMA CLAVE STPS', 'MATERIA CONCRETA EVALUADA', 'ESTATUS COAGULADO DE COMPLIANCE'],
        ['NOM-001-STPS-2008', 'Condiciones higiénicas en techos y rampas.', 'CUMPLE REGISTRO'],
        ['NOM-002-STPS-2010', 'Extintores cargados y colocación de hidrantes.', 'PARCIAL'],
        ['NOM-017-STPS-2008', 'Uso y asignación de cascos y botas.', 'CUMPLE REGISTRO'],
        ['NOM-025-STPS-2008', 'Evaluación luxométrica en pasillos.', 'CUMPLE REGISTRO'],
        ['NOM-035-STPS-2018', 'Aplicación de cuestionarios organizacionales.', 'NO CUMPLE']
      ],
      tableHeaderColor: '#1e3a8a',
      tableHeaderTextColor: '#ffffff',
      tableAlternatingRows: true
    },
    {
      id: 'p9-footer',
      type: 'text',
      name: 'Pie Pág 9',
      x: 50,
      y: PAGE_HEIGHT - 60,
      width: 716,
      height: 30,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 8px; color: #94a3b8; font-weight: bold;"><span>MONITOR DE REGLAMENTOS FEDERALES</span><span>Página 9</span></div>`,
      fontFamily: 'Arial'
    }
  ];

  // ==================== PAGINA 10: PROCESO OPERATIVO Y FLUJOGRAMA ====================
  const page10Blocks: WYSIWYGBlock[] = [
    {
      id: 'p10-header',
      type: 'text',
      name: 'Cabeza Pág 10',
      x: 50,
      y: 40,
      width: 716,
      height: 40,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase;"><span>${company.name} • Diagnóstico NOM-030</span><span>Pág 10</span></div>`,
      fontFamily: 'Arial'
    },
    {
      id: 'p10-sec-title',
      type: 'text',
      name: 'Título Sección X',
      x: 50,
      y: 100,
      width: 716,
      height: 50,
      zIndex: 2,
      text: '<h2 style="margin: 0; font-size: 16px; font-weight: bold; border-left: 4px solid #0f172a; padding-left: 10px; color: #0f172a; text-transform: uppercase;">Procesos Operativos y Flujos</h2>',
      fontFamily: 'Arial'
    },
    {
      id: 'p10-narrative-panel',
      type: 'text',
      name: 'Panel Narrativa Flujos',
      x: 50,
      y: 170,
      width: 350,
      height: 420,
      zIndex: 3,
      text: `
        <div style="font-size:12.5px; line-height:1.65; color:#334155; font-family:Arial;">
          <p><strong>Narrativa Operativa Crítica:</strong><br/>
            ${(() => {
              if (!company.processDescription) return 'El proceso se compone de las etapas secuenciales de recibo de materiales, control de calidad, maquinado primario mediante centros CN, ensamble, embalaje final y despacho.';
              try {
                const parsed = JSON.parse(company.processDescription);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                  return parsed.customText || parsed.description || 'El proceso se compone de las etapas secuenciales de recibo de materiales, control de calidad, maquinado primario mediante centros CN, ensamble, embalaje final y despacho.';
                }
                return company.processDescription;
              } catch (e) {
                return company.processDescription;
              }
            })()}
          </p>
          <p style="margin-top:15px;"><strong>Materias Primas:</strong> ${company.rawMaterials || 'Componentes de Acero y Embalajes de Cartón'}</p>
          <p style="margin-top:10px;"><strong>Maquinaria Clave:</strong> ${company.machinery || 'Tornos CNC y Montacargas de combustión'}</p>
        </div>
      `,
      fontFamily: 'Arial'
    },
    {
      id: 'p10-flowchart',
      type: 'image',
      name: 'Diagrama del Flujograma',
      x: 420,
      y: 170,
      width: 346,
      height: 250,
      zIndex: 3,
      imageUrl: company.processFileUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&q=80',
      imageFit: 'contain'
    },
    {
      id: 'p10-footer',
      type: 'text',
      name: 'Pie Pág 10',
      x: 50,
      y: PAGE_HEIGHT - 60,
      width: 716,
      height: 30,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 8px; color: #94a3b8; font-weight: bold;"><span>NÓMINA OPERACIONAL CERTIFICADA</span><span>Página 10</span></div>`,
      fontFamily: 'Arial'
    }
  ];

  // ==================== PAGINA 11: METODOLOGÍA PARA LA EVALUACIÓN DE RIESGOS ====================
  const page11Blocks: WYSIWYGBlock[] = [
    {
      id: 'p11-header',
      type: 'text',
      name: 'Cabeza Pág 11',
      x: 50,
      y: 40,
      width: 716,
      height: 40,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase;"><span>${company.name} • Diagnóstico NOM-030</span><span>Pág 11</span></div>`,
      fontFamily: 'Arial'
    },
    {
      id: 'p11-sec-title',
      type: 'text',
      name: 'Título Sección XI',
      x: 50,
      y: 100,
      width: 716,
      height: 50,
      zIndex: 2,
      text: '<h2 style="margin: 0; font-size: 16px; font-weight: bold; border-left: 4px solid #4f46e5; padding-left: 10px; color: #0f172a; text-transform: uppercase;">Metodología William T. Fine</h2>',
      fontFamily: 'Arial'
    },
    {
      id: 'p11-formula-box',
      type: 'text',
      name: 'Caja Operador Fine',
      x: 80,
      y: 170,
      width: 656,
      height: 110,
      zIndex: 3,
      text: `
        <div style="background-color:#eef2ff; border:2px dashed #4f46e5; border-radius:12px; padding:18px; text-align:center; color:#312e81; font-family:Arial;">
          <p style="margin:0 0 8px 0; font-size:10px; font-weight:bold; uppercase; tracking-wider;">Ecuación de Grado de Peligrosidad (GP):</p>
          <h3 style="margin:0; font-size:24px; font-weight:900; font-family:'Courier New', monospace;">GP = Consecuencias &times; Exposición &times; Probabilidad</h3>
        </div>
      `,
      fontFamily: 'Arial'
    },
    {
      id: 'p11-ponderation-panel',
      type: 'text',
      name: 'Panel Ponderaciones Fine',
      x: 50,
      y: 300,
      width: 716,
      height: 400,
      zIndex: 2,
      text: `
        <div style="font-size:12.5px; line-height:1.65; color:#334155; text-align:justify; font-family:Arial;">
          <p><strong>Consecuencias (C):</strong> Califica la magnitud del percance corporal. Ponderación: Fatalidades colectivas (10), Fallecimiento único (6), Amputaciones (4), Incapacidad temporaria (1).</p>
          <p><strong>Exposición (E):</strong> Frecuencia fáctica de interacción con el foco de riesgo. Ponderación: Continua constante (10), Diaria laborable (6), Semanal ocasional (3), Anual accidental (1).</p>
          <p><strong>Probabilidad (P):</strong> Viabilidad de que se consume la catástrofe. Ponderación: Casi certeza (10), Posibilidad razonable (6), Rara coincidencia extrema (1).</p>
          <p><strong>Escalas del Grado de Peligrosidad (GP):</strong> GP mayor a 200 requiere mitigación inmediata y clausura de compuerta; GP de 85 a 200 requiere plan de control formalizado; GP menor de 85 es aceptable de vigilancia.</p>
        </div>
      `,
      fontFamily: 'Arial'
    },
    {
      id: 'p11-footer',
      type: 'text',
      name: 'Pie Pág 11',
      x: 50,
      y: PAGE_HEIGHT - 60,
      width: 716,
      height: 30,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 8px; color: #94a3b8; font-weight: bold;"><span>ESCALA DE MATRICES CIENTÍFICAS FIABLES</span><span>Página 11</span></div>`,
      fontFamily: 'Arial'
    }
  ];

  // ==================== PAGINA 12: MATRIZ CONSOLIDADA DE RIESGOS Y HALLAZGOS ====================
  const page12Blocks: WYSIWYGBlock[] = [
    {
      id: 'p12-header',
      type: 'text',
      name: 'Cabeza Pág 12',
      x: 50,
      y: 40,
      width: 716,
      height: 40,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase;"><span>${company.name} • Diagnóstico NOM-030</span><span>Pág 12</span></div>`,
      fontFamily: 'Arial'
    },
    {
      id: 'p12-sec-title',
      type: 'text',
      name: 'Título Sección XII',
      x: 50,
      y: 100,
      width: 716,
      height: 50,
      zIndex: 2,
      text: '<h2 style="margin: 0; font-size: 16px; font-weight: bold; border-left: 4px solid #ef4444; padding-left: 10px; color: #0f172a; text-transform: uppercase;">Matriz Consolidada de Riesgos</h2>',
      fontFamily: 'Arial'
    },
    {
      id: 'p12-findings-table',
      type: 'table',
      name: 'Tabla Hallazgos Críticos',
      x: 50,
      y: 170,
      width: 716,
      height: 750,
      zIndex: 3,
      tableColumnsWidths: [12, 22, 33, 33],
      tableData: findings.length > 0 ? [
        ['SCORE GP', 'UBICACIÓN RECONOCIDA', 'HALLAZGO / PELIGRO CONTRASTADO', 'MECANISMO DE CORRECCIÓN ACCIÓN'],
        ...findings.slice(0, 8).map(f => [
          String(f.riskScore || '120'),
          f.area || 'Planta Primaria',
          f.title || 'Derrame de lubricante',
          f.correctiveAction || f.description || 'Contener y limpiar con aserrín'
        ])
      ] : [
        ['SCORE GP', 'UBICACIÓN RECONOCIDA', 'HALLAZGO / PELIGRO CONTRASTADO', 'MECANISMO DE CORRECCIÓN ACCIÓN'],
        ['240', 'Línea de Ensamble 2', 'Motores servos sin carcasas protectoras frente a pellizcos.', 'Instalar compuertas metálicas abatibles.'],
        ['120', 'Calderas Central', 'Goteo de condensado caliente que humedece el tránsito.', 'Instalar bandeja canalizadora al drenaje.'],
        ['40', 'Comedor', 'Ausencia de iluminación luxométrica apropiada.', 'Sustituir tubos quemados por paneles LED.']
      ],
      tableHeaderColor: '#991b1b',
      tableHeaderTextColor: '#ffffff',
      tableAlternatingRows: true
    },
    {
      id: 'p12-footer',
      type: 'text',
      name: 'Pie Pág 12',
      x: 50,
      y: PAGE_HEIGHT - 60,
      width: 716,
      height: 30,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 8px; color: #94a3b8; font-weight: bold;"><span>REPORTE DE HALLAZGOS AUDITADOS</span><span>Página 12</span></div>`,
      fontFamily: 'Arial'
    }
  ];

  // ==================== PAGINA 13: ACCIDENTABILIDAD E ÍNDICES DE SINIESTRALIDAD ====================
  const page13Blocks: WYSIWYGBlock[] = [
    {
      id: 'p13-header',
      type: 'text',
      name: 'Cabeza Pág 13',
      x: 50,
      y: 40,
      width: 716,
      height: 40,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase;"><span>${company.name} • Diagnóstico NOM-030</span><span>Pág 13</span></div>`,
      fontFamily: 'Arial'
    },
    {
      id: 'p13-sec-title',
      type: 'text',
      name: 'Título Sección XIII',
      x: 50,
      y: 100,
      width: 716,
      height: 50,
      zIndex: 2,
      text: '<h2 style="margin: 0; font-size: 16px; font-weight: bold; border-left: 4px solid #0f172a; padding-left: 10px; color: #011627; text-transform: uppercase;">Estadísticas de Siniestralidad (IF / IG)</h2>',
      fontFamily: 'Arial'
    },
    {
      id: 'p13-stats-panel',
      type: 'text',
      name: 'Panel Estadístico Copula',
      x: 50,
      y: 170,
      width: 716,
      height: 120,
      zIndex: 3,
      text: `
        <div style="font-family:Arial; font-size:12px; display:flex; gap:15px; justify-content:space-around; background-color:#f8fafc; padding:15px; border-radius:12px; border:1px solid #e2e8f0;">
          <div style="text-align:center;">
            <span style="font-size:9.5px; font-weight:bold; color:#4f46e5; text-transform:uppercase;">Índice Frecuencia (IF)</span>
            <h1 style="margin:5px 0 0 0; font-size:28px; font-weight:900; color:#0f172a;">${statIF}</h1>
            <span style="font-size:8px; color:#64748b;">Eventos por 200,000 Horas</span>
          </div>
          <div style="text-align:center; border-left:1px solid #cbd5e1; padding-left:25px;">
            <span style="font-size:9.5px; font-weight:bold; color:#e11d48; text-transform:uppercase;">Índice Gravedad (IG)</span>
            <h1 style="margin:5px 0 0 0; font-size:28px; font-weight:900; color:#0f172a;">${statIG}</h1>
            <span style="font-size:8px; color:#64748b;">Días perdidos por 200,000 HH</span>
          </div>
        </div>
      `,
      fontFamily: 'Arial'
    },
    {
      id: 'p13-accidents-table',
      type: 'table',
      name: 'Tabla Diario de Siniestros',
      x: 50,
      y: 310,
      width: 716,
      height: 550,
      zIndex: 3,
      tableColumnsWidths: [15, 18, 52, 15],
      tableData: accidentEvents.length > 0 ? [
        ['FECHA REGISTRO', 'TIPO DE EVENTO', 'DESCRIPCIÓN DE LESIÓN / ACCIDENTE', 'DÍAS PERDIDOS'],
        ...accidentEvents.slice(0, 5).map(e => [
          new Date(e.date).toLocaleDateString(),
          e.type?.toUpperCase() || 'ACCIDENTE',
          e.description || 'Lesión leve de dedo de la mano con corte',
          String(e.daysLost || 0)
        ])
      ] : [
        ['FECHA REGISTRO', 'TIPO DE EVENTO', 'DESCRIPCIÓN DE LESIÓN / ACCIDENTE', 'DÍAS PERDIDOS'],
        ['15/02/2026', 'ACCIDENTE', 'Esguince menor en talón al descender montacargas.', '4'],
        ['05/04/2026', 'INCIDENTE', 'Falla en panel interruptor térmico sin ignición.', '0'],
        ['18/05/2026', 'ACCIDENTE', 'Cuerpo extraño en globo ocular por amolar sin linterna.', '2']
      ],
      tableHeaderColor: '#9f1239',
      tableHeaderTextColor: '#ffffff',
      tableAlternatingRows: true
    },
    {
      id: 'p13-footer',
      type: 'text',
      name: 'Pie Pág 13',
      x: 50,
      y: PAGE_HEIGHT - 60,
      width: 716,
      height: 30,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 8px; color: #94a3b8; font-weight: bold;"><span>BITACORA DIARIA DE SINIESTROS IMSS</span><span>Página 13</span></div>`,
      fontFamily: 'Arial'
    }
  ];

  // ==================== PAGINA 14: PROGRAMA INTEGRAL DE SEGURIDAD Y SALUD ====================
  const page14Blocks: WYSIWYGBlock[] = [
    {
      id: 'p14-header',
      type: 'text',
      name: 'Cabeza Pág 14',
      x: 50,
      y: 40,
      width: 716,
      height: 40,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase;"><span>${company.name} • Diagnóstico NOM-030</span><span>Pág 14</span></div>`,
      fontFamily: 'Arial'
    },
    {
      id: 'p14-sec-title',
      type: 'text',
      name: 'Título Sección XIV',
      x: 50,
      y: 100,
      width: 716,
      height: 50,
      zIndex: 2,
      text: '<h2 style="margin: 0; font-size: 16px; font-weight: bold; border-left: 4px solid #10b981; padding-left: 10px; color: #011627; text-transform: uppercase;">Programa Anual de Seguridad (SST)</h2>',
      fontFamily: 'Arial'
    },
    {
      id: 'p14-programs-table',
      type: 'table',
      name: 'Tabla del Calendario Programa',
      x: 50,
      y: 170,
      width: 716,
      height: 750,
      zIndex: 3,
      tableColumnsWidths: [40, 18, 24, 18],
      tableData: safetyProgram.length > 0 ? [
        ['MEDIDA PREVENTIVA PROGRAMADA', 'NORMA REF.', 'ENCARGADO RESPONSABLE', 'ESTATUS DE EJECUCIÓN'],
        ...safetyProgram.slice(0, 8).map(s => [
          s.action || 'Fumigar áreas y limpiar lockers',
          s.referenceNorm || 'General OHS',
          s.responsible || 'Coordinador de Higiene',
          s.status === 'completed' ? 'CUMPLIDO PLENO' : 'PENDIENTE / PROGRAMADO'
        ])
      ] : [
        ['MEDIDA PREVENTIVA PROGRAMADA', 'NORMA REF.', 'ENCARGADO RESPONSABLE', 'ESTATUS DE EJECUCIÓN'],
        ['Capacitación a operarios en el uso de candados LOTO.', 'NOM-029-STPS', 'Coordinador de Turno', 'PENDIENTE / PROGRAMADO'],
        ['Recarga trimestral de extintores de polvo biológico.', 'NOM-002-STPS', 'Servicios de Higiene', 'CUMPLIDO PLENO'],
        ['Examen médico a manipuladores de químicos pesados.', 'NOM-010-STPS', 'Médico de Planta', 'CUMPLIDO PLENO'],
        ['Simulacro periódico de repliegue sísmico de planta.', 'P. Civil', 'Comisión Mixta', 'PENDIENTE / PROGRAMADO']
      ],
      tableHeaderColor: '#065f46',
      tableHeaderTextColor: '#ffffff',
      tableAlternatingRows: true
    },
    {
      id: 'p14-footer',
      type: 'text',
      name: 'Pie Pág 14',
      x: 50,
      y: PAGE_HEIGHT - 60,
      width: 716,
      height: 30,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 8px; color: #94a3b8; font-weight: bold;"><span>CALENDARIO DE ACCIÓN ANUAL</span><span>Página 14</span></div>`,
      fontFamily: 'Arial'
    }
  ];

  // ==================== PAGINA 15: BITÁCORA DE EVIDENCIAS FOTOGRÁFICAS ====================
  const page15Blocks: WYSIWYGBlock[] = [
    {
      id: 'p15-header',
      type: 'text',
      name: 'Cabeza Pág 15',
      x: 50,
      y: 40,
      width: 716,
      height: 40,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase;"><span>${company.name} • Diagnóstico NOM-030</span><span>Pág 15</span></div>`,
      fontFamily: 'Arial'
    },
    {
      id: 'p15-sec-title',
      type: 'text',
      name: 'Título Sección XV',
      x: 50,
      y: 100,
      width: 716,
      height: 50,
      zIndex: 2,
      text: '<h2 style="margin: 0; font-size: 16px; font-weight: bold; border-left: 4px solid #0f172a; padding-left: 10px; color: #011627; text-transform: uppercase;">Bitácora de Evidencias de Campo</h2>',
      fontFamily: 'Arial'
    },
    {
      id: 'p15-evidences-grid',
      type: 'text',
      name: 'Grid Evidencias Fotográficas',
      x: 50,
      y: 170,
      width: 716,
      height: 600,
      zIndex: 3,
      text: `
        <div style="font-family: Arial; display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
          <div style="border:1px dashed #cbd5e1; padding:15px; border-radius:12px; background-color:#f8fafc; text-align:center;">
            <h4 style="margin:0 0 10px 0; font-size:12px; font-weight:bold; color:#0f172a;">Auditoría de Señaléticas</h4>
            <img src="https://images.unsplash.com/photo-1590402421685-64724d4bd94f?w=300&q=80" style="max-height:160px; max-width:100%; object-fit:contain; border-radius:8px; border:1px solid #cbd5e1;"/>
            <p style="margin:8px 0 0 0; font-size:9px; color:#64748b; font-weight:bold; text-transform:uppercase;">Estatus: CONFORME</p>
          </div>
          <div style="border:1px dashed #cbd5e1; padding:15px; border-radius:12px; background-color:#f8fafc; text-align:center;">
            <h4 style="margin:0 0 10px 0; font-size:12px; font-weight:bold; color:#0f172a;">Suministros Extintor y EPP</h4>
            <img src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=300&q=80" style="max-height:160px; max-width:100%; object-fit:contain; border-radius:8px; border:1px solid #cbd5e1;"/>
            <p style="margin:8px 0 0 0; font-size:9px; color:#64748b; font-weight:bold; text-transform:uppercase;">Estatus: CERTIFICADO</p>
          </div>
        </div>
      `,
      fontFamily: 'Arial'
    },
    {
      id: 'p15-footer',
      type: 'text',
      name: 'Pie Pág 15',
      x: 50,
      y: PAGE_HEIGHT - 60,
      width: 716,
      height: 30,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 8px; color: #94a3b8; font-weight: bold;"><span>INSPECCIONES FOTOGRÁFICAS DE PLANTA</span><span>Página 15</span></div>`,
      fontFamily: 'Arial'
    }
  ];

  // ==================== PAGINA 16: CONCLUSIONES Y RECOMENDACIONES ====================
  const page16Blocks: WYSIWYGBlock[] = [
    {
      id: 'p16-header',
      type: 'text',
      name: 'Cabeza Pág 16',
      x: 50,
      y: 40,
      width: 716,
      height: 40,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase;"><span>${company.name} • Diagnóstico NOM-030</span><span>Pág 16</span></div>`,
      fontFamily: 'Arial'
    },
    {
      id: 'p16-sec-title',
      type: 'text',
      name: 'Título Sección XVI',
      x: 50,
      y: 100,
      width: 716,
      height: 50,
      zIndex: 2,
      text: '<h2 style="margin: 0; font-size: 16px; font-weight: bold; border-left: 4px solid #ef4444; padding-left: 10px; color: #011627; text-transform: uppercase;">Conclusiones y Recomendaciones</h2>',
      fontFamily: 'Arial'
    },
    {
      id: 'p16-conclusions-body',
      type: 'text',
      name: 'Texto de Conclusiones',
      x: 50,
      y: 170,
      width: 716,
      height: 605,
      zIndex: 2,
      text: `
        <div style="font-size:13px; line-height:1.7; color:#334155; text-align:justify; font-family:Arial;">
          <strong style="color:#2563eb; text-transform:uppercase; font-size:10.5px; display:block; margin-bottom:10px;">Directrices Conclusivas de Auditoría:</strong>
          ${company.reportConclusions || 'Se concluye que el centro de trabajo dispone de un cumplimiento reglamentario y físico del 75%. Es prioritario atender las no-conformidades críticas en materia de resguardos de maquinaria y bloqueo de tableros eléctricos (lockout-tagout) para sostener la seguridad operativa.'}
          <br/><br/>
          <strong style="color:#dc2626; text-transform:uppercase; font-size:10.5px; display:block; margin-bottom:10px; margin-top:20px;">Recomendaciones de Mejora Continua:</strong>
          ${company.reportRecommendations || '• Proveer equipo EPP auditivo calificado en cabinas de soplado. <br/>• Implementar capacitaciones periódicas avaladas a través de Protección Civil. <br/>• Reemplazar urgentemente lámparas y señaléticas deslavadas en pasillos primarios.'}
        </div>
      `,
      fontFamily: 'Arial'
    },
    {
      id: 'p16-footer',
      type: 'text',
      name: 'Pie Pág 16',
      x: 50,
      y: PAGE_HEIGHT - 60,
      width: 716,
      height: 30,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 8px; color: #94a3b8; font-weight: bold;"><span>INFORME DE EVALUACIÓN ANALÍTICA IA</span><span>Página 16</span></div>`,
      fontFamily: 'Arial'
    }
  ];

  // ==================== PAGINA 17: ANEXOS Y RÚBRICA DE RESPONSABILIDAD PATRONAL ====================
  const page17Blocks: WYSIWYGBlock[] = [
    {
      id: 'p17-header',
      type: 'text',
      name: 'Cabeza Pág 17',
      x: 50,
      y: 40,
      width: 716,
      height: 40,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase;"><span>${company.name} • Diagnóstico NOM-030</span><span>Pág 17</span></div>`,
      fontFamily: 'Arial'
    },
    {
      id: 'p17-sec-title',
      type: 'text',
      name: 'Título Sección XVII',
      x: 50,
      y: 100,
      width: 716,
      height: 50,
      zIndex: 2,
      text: '<h2 style="margin: 0; font-size: 16px; font-weight: bold; border-left: 4px solid #0f172a; padding-left: 10px; color: #011627; text-transform: uppercase;">Anexos: Rúbrica y Compromisos</h2>',
      fontFamily: 'Arial'
    },
    {
      id: 'p17-acta-nombramiento',
      type: 'text',
      name: 'Nombramiento Responsable',
      x: 50,
      y: 170,
      width: 716,
      height: 250,
      zIndex: 2,
      text: `
        <div style="font-size:12.5px; line-height:1.65; color:#334155; text-align:justify; font-family:Arial;">
          <p style="text-align:center; font-weight:bold; text-transform:uppercase; text-decoration:underline;">ACTA DE DELEGACIÓN NOM-030 PATRONAL</p>
          Mediante el presente instrumento constitutivo, la dirección general de <strong>${company.name}</strong> asume el compromiso pleno de delegar la supervisión y mantenimiento preventivo de las condiciones laborales en el C. <strong>${company.responsibleName || 'Responsable Nominado'}</strong>, dotándole de presupuesto y facultades para coordinar brigadas de PC.
        </div>
      `,
      fontFamily: 'Arial'
    },
    {
      id: 'p17-signature',
      type: 'image',
      name: 'Firma Digitalizada',
      x: 283,
      y: 460,
      width: 250,
      height: 100,
      zIndex: 3,
      imageUrl: company.responsibleSignature || 'https://images.unsplash.com/photo-1578301978018-305575218a26?w=400&q=80',
      imageFit: 'contain'
    },
    {
      id: 'p17-sign-text',
      type: 'text',
      name: 'Texto de Firma',
      x: 100,
      y: 580,
      width: 616,
      height: 100,
      zIndex: 2,
      text: `
        <div style="text-align:center; font-family:Arial; font-size:11px; color:#475569;">
          <div style="width:220px; height:2px; background-color:#cbd5e1; margin:0 auto 5px auto;"></div>
          <strong>${company.responsibleName || 'Responsable de Seguridad'}</strong><br/>
          Rúbrica de Aceptación y Designación de Responsabilidad técnica
        </div>
      `,
      fontFamily: 'Arial'
    },
    {
      id: 'p17-footer',
      type: 'text',
      name: 'Pie Pág 17',
      x: 50,
      y: PAGE_HEIGHT - 60,
      width: 716,
      height: 30,
      zIndex: 2,
      text: `<div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 8px; color: #94a3b8; font-weight: bold;"><span>REGISTRO DEL DICTAMEN DE SEGURIDAD</span><span>Página 17 de 17</span></div>`,
      fontFamily: 'Arial'
    }
  ];

  defaultPages.push({ id: 'p1', blocks: page1Blocks });
  defaultPages.push({ id: 'p2', blocks: page2Blocks });
  defaultPages.push({ id: 'p3', blocks: page3Blocks });
  defaultPages.push({ id: 'p4', blocks: page4Blocks });
  defaultPages.push({ id: 'p5', blocks: page5Blocks });
  defaultPages.push({ id: 'p6', blocks: page6Blocks });
  defaultPages.push({ id: 'p7', blocks: page7Blocks });
  defaultPages.push({ id: 'p8', blocks: page8Blocks });
  defaultPages.push({ id: 'p9', blocks: page9Blocks });
  defaultPages.push({ id: 'p10', blocks: page10Blocks });
  defaultPages.push({ id: 'p11', blocks: page11Blocks });
  defaultPages.push({ id: 'p12', blocks: page12Blocks });
  defaultPages.push({ id: 'p13', blocks: page13Blocks });
  defaultPages.push({ id: 'p14', blocks: page14Blocks });
  defaultPages.push({ id: 'p15', blocks: page15Blocks });
  defaultPages.push({ id: 'p16', blocks: page16Blocks });
  defaultPages.push({ id: 'p17', blocks: page17Blocks });

  return defaultPages;
}
