import { db, type SafetyProgramItem, type Company, type Finding, type SurroundingHazard, type AccidentRecord, type RiskAssessment, type AccidentEvent } from "../lib/db";
import { toast } from "sonner";

export enum Type {
  STRING = "STRING",
  NUMBER = "NUMBER",
  INTEGER = "INTEGER",
  BOOLEAN = "BOOLEAN",
  ARRAY = "ARRAY",
  OBJECT = "OBJECT"
}

async function fetchDirectGemini(modelName: string, contents: any, config: any, apiKey: string): Promise<string> {
  // Filtrar modelos ficticios o redundantes para evitar reintentos fallidos lentos
  const modelsToTry = [modelName, "gemini-2.0-flash", "gemini-1.5-flash"]
    .filter(m => m && m !== "gemini-3.5-flash" && m !== "gemini-2.5-flash");
  const uniqueModels = Array.from(new Set(modelsToTry));
  const versionsToTry = ["v1beta", "v1"];
  
  let lastError: any = null;
  
  for (const m of uniqueModels) {
    for (const ver of versionsToTry) {
      try {
        let formattedContents = contents;
        if (typeof contents === "string") {
          formattedContents = [
            {
              role: "user",
              parts: [
                {
                  text: contents
                }
              ]
            }
          ];
        } else if (!Array.isArray(contents) && contents && typeof contents === "object") {
          if (contents.parts) {
            formattedContents = [contents];
          } else {
            formattedContents = [
              {
                role: "user",
                parts: [
                  {
                    text: JSON.stringify(contents)
                  }
                ]
              }
            ];
          }
        }
        
        const url = `https://generativelanguage.googleapis.com/${ver}/models/${m}:generateContent?key=${apiKey}`;
        
        const bodyPayload: any = {
          contents: formattedContents
        };
        
        if (config) {
          bodyPayload.generationConfig = {
            responseMimeType: config.responseMimeType,
            responseSchema: config.responseSchema,
            temperature: config.temperature,
            candidateCount: config.candidateCount,
            maxOutputTokens: config.maxOutputTokens,
            stopSequences: config.stopSequences
          };
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // Límite de 60 segundos

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(bodyPayload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          const errorText = await res.text();
          let cleanMsg = `HTTP Error ${res.status}`;
          try {
            const parsed = JSON.parse(errorText);
            if (parsed.error?.message) {
              cleanMsg = parsed.error.message;
            }
          } catch (e) {
            cleanMsg = errorText || cleanMsg;
          }
          throw new Error(cleanMsg);
        }
        
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text === undefined) {
          throw new Error("La respuesta de la IA no contiene texto.");
        }
        return text;
      } catch (err: any) {
        console.warn(`Failed direct Gemini fetch with model ${m} on ${ver}: ${err.message || err}`);
        const msg = (err.message || String(err)).toLowerCase();
        if (err.name === 'AbortError' || msg.includes('aborted') || msg.includes('timeout')) {
          throw new Error("La solicitud de IA ha expirado (límite de 60 segundos). Revise su conexión a internet o intente de nuevo.");
        }
        if (
          msg.includes("quota") ||
          msg.includes("exhausted") ||
          msg.includes("limit") ||
          msg.includes("exceeded") ||
          msg.includes("key not valid") ||
          msg.includes("invalid key") ||
          msg.includes("billing")
        ) {
          throw err;
        }
        lastError = err;
      }
    }
  }
  
  throw lastError || new Error("No se pudo conectar con los servidores de Google Gemini.");
}

async function generateContent({ model, contents, config }: { model: string; contents: any; config?: any }) {
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('nom030_gemini_api_key') || '' : '';
  const envKey = process.env.GEMINI_API_KEY || '';
  const apiKey = (localKey || envKey).trim();

  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.'));

  // If in production (Vercel) and no API key is set, we throw immediately so the user knows they need to set it
  if (!apiKey && !isLocalhost) {
    const errorMsg = "La clave API de Gemini no está configurada. Por favor ve a Configuración e ingresa tu API Key para usar la IA.";
    toast.error(errorMsg, { duration: 6000 });
    throw new Error(errorMsg);
  }

  if (apiKey) {
    try {
      console.log(`[GEMINI SERVICE] Using direct client-side fetch. Model: ${model}. Key source: ${localKey ? 'localStorage' : 'environment'}`);
      const text = await fetchDirectGemini(model, contents, config, apiKey);
      return { text };
    } catch (directError: any) {
      console.error("[GEMINI SERVICE] Direct client-side fetch failed:", directError);
      
      if (!isLocalhost) {
        // In production, the proxy won't work, so throw the direct error immediately
        const cleanMessage = directError.message || String(directError);
        let userFriendlyMsg = `Error en la IA: ${cleanMessage}`;
        if (cleanMessage.includes("API key not valid")) {
          userFriendlyMsg = "La clave API de Gemini es inválida. Por favor, revísala en la sección de Configuración.";
        } else if (cleanMessage.includes("quota") || cleanMessage.includes("Quota")) {
          userFriendlyMsg = "Se ha superado el límite de cuota de tu clave de Gemini. Por favor, intenta de nuevo en unos minutos.";
        }
        toast.error(userFriendlyMsg, { duration: 6000 });
        throw new Error(userFriendlyMsg);
      }
      
      console.warn("[GEMINI SERVICE] Falling back to proxy /api/gemini...");
    }
  }

  // Fallback to Express proxy on localhost
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // Límite de 60 segundos

    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, contents, config }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to generate content from Gemini proxy");
    }
    const data = await response.json();
    return { text: data.text };
  } catch (proxyError: any) {
    console.error("[GEMINI SERVICE] Proxy fetch failed:", proxyError);
    const proxyMsg = proxyError.message || String(proxyError);
    let userMsg = `Error de IA (Proxy): ${proxyMsg}`;
    if (proxyError.name === 'AbortError' || proxyMsg.includes('aborted') || proxyMsg.includes('timeout')) {
      userMsg = "La solicitud de IA a través del servidor local ha expirado (límite de 60 segundos).";
    }
    toast.error(userMsg);
    throw new Error(userMsg);
  }
}

const ai = {
  models: {
    generateContent
  }
};

export interface HealthPromotionSuggestion {
  action: string;
  category: string;
  referenceNorm: string;
  responsible: string;
  startDate: Date;
  endDate: Date;
}

export interface AIRootResponse {
  suggestions: HealthPromotionSuggestion[];
  reminderText: string;
}

export async function generateHealthPromotionProgram(
  company: Company,
  accidents: AccidentRecord[],
  findings: Finding[],
  hazards: SurroundingHazard[]
): Promise<AIRootResponse> {
  const model = "gemini-2.0-flash";
  
  const prompt = `
    Como experto en Seguridad y Salud en el Trabajo bajo la normativa mexicana (NOM-030-STPS-2009), genera un programa de "Promoción de la Salud" (Sección 7.1.b) para la siguiente empresa:
    
    INFORMACIÓN DE LA EMPRESA:
    - Actividad: ${company.activity}
    - Giro: ${company.businessLine || 'No especificado'}
    - Ubicación: ${company.address} (Importante para normativa sanitaria local)
    - Trabajadores: ${company.workerCount}
    - Nivel de Riesgo: ${company.riskLevel}
    - Proceso: ${company.processDescription || 'No especificado'}
    - Maquinaria/Herramientas: ${company.machinery || 'No especificado'}
    - Materias Primas: ${company.rawMaterials || 'No especificado'}
    
    HISTORIAL DE ACCIDENTES:
    ${accidents.length > 0 ? accidents.map(a => `- Año ${a.year}, Mes ${a.month}: ${a.accidentCount} accidentes, ${a.daysLost} días perdidos. ${a.description || ''}`).join('\n') : 'Sin registros de accidentes.'}
    
    RIESGOS Y PELIGROS IDENTIFICADOS:
    ${findings.length > 0 ? findings.map(f => `- ${f.title}: ${f.description} (Severidad: ${f.severity})`).join('\n') : 'Sin hallazgos específicos.'}
    ${hazards.length > 0 ? hazards.map(h => `- Peligro Externo: ${h.source} (Nivel de Riesgo: ${h.riskLevel})`).join('\n') : 'Sin peligros externos.'}
    
    REQUERIMIENTOS DEL PROGRAMA:
    1. Identificar Procedimientos Operativos Estándar (POE) necesarios para cuidar al trabajador.
    2. Referenciar las Normas Oficiales Mexicanas (NOM) aplicables (Ej: NOM-010-STPS, NOM-011-STPS, NOM-047-SSA1).
    3. Sugerir campañas de salud laboral y normativa sanitaria vigente según la ubicación mencionada.
    4. El programa debe ser detallado y distribuido en un cronograma anual (2026).
    5. Incluir exámenes médicos específicos según los riesgos de exposición.
    6. Incluir un texto corto que recuerde la importancia de la implementación de este programa para la salud del trabajador y la productividad.
    
    RESPONDE ÚNICAMENTE CON UN JSON que cumpla con el siguiente esquema:
    {
      "suggestions": [
        {
          "action": "Descripción detallada de la acción (campaña, examen, capacitación)",
          "category": "Campaña de Salud" | "Examen Médico" | "Capacitación" | "Prevención Adicciones",
          "referenceNorm": "Ej. NOM-010-STPS-2014",
          "responsible": "Puesto sugerido (Ej. Médico de Empresa, RH)",
          "isoStartDate": "YYYY-MM-DD",
          "isoEndDate": "YYYY-MM-DD"
        }
      ],
      "reminderText": "Texto de importancia"
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                action: { type: Type.STRING },
                category: { type: Type.STRING },
                referenceNorm: { type: Type.STRING },
                responsible: { type: Type.STRING },
                isoStartDate: { type: Type.STRING },
                isoEndDate: { type: Type.STRING }
              },
              required: ["action", "category", "referenceNorm", "responsible", "isoStartDate", "isoEndDate"]
            }
          },
          reminderText: { type: Type.STRING }
        },
        required: ["suggestions", "reminderText"]
      }
    }
  });

  const raw = JSON.parse(response.text);
  
  return {
    suggestions: raw.suggestions.map((s: any) => ({
      ...s,
      startDate: new Date(s.isoStartDate),
      endDate: new Date(s.isoEndDate)
    })),
    reminderText: raw.reminderText
  };
}

export async function generateEmergencyProgram(
  company: Company,
  accidents: AccidentRecord[],
  findings: Finding[],
  hazards: SurroundingHazard[]
): Promise<AIRootResponse> {
  const model = "gemini-2.0-flash";
  
  const prompt = `
    Como experto en Seguridad y Salud en el Trabajo bajo la normativa mexicana (NOM-030-STPS-2009 y Ley General de Protección Civil), genera un programa para la "Atención de Emergencias y Contingencias Sanitarias" (Sección 7.1.c) para la siguiente empresa:
    
    INFORMACIÓN DE LA EMPRESA:
    - Actividad: ${company.activity}
    - Giro: ${company.businessLine || 'No especificado'}
    - Ubicación: ${company.address} (Relevante para Atlas de Riesgos Local y Protección Civil Estatal)
    - Trabajadores: ${company.workerCount}
    - Nivel de Riesgo: ${company.riskLevel}
    - Proceso: ${company.processDescription || 'No especificado'}
    - Maquinaria/Herramientas: ${company.machinery || 'No especificado'}
    
    RIESGOS Y PELIGROS IDENTIFICADOS:
    ${findings.length > 0 ? findings.map(f => `- ${f.title}: ${f.description} (Severidad: ${f.severity})`).join('\n') : 'Sin hallazgos específicos.'}
    ${hazards.length > 0 ? hazards.map(h => `- Peligro Externo: ${h.source} (Nivel de Riesgo: ${h.riskLevel})`).join('\n') : 'Sin peligros externos.'}
    
    REQUERIMIENTOS DEL PROGRAMA (Sección 7.1.c, d, e de la NOM-030 y PC):
    1. Sugerir protocolos de Protección Civil (Ej: Evacuación, Primeros Auxilios, Prevención de Incendios).
    2. Identificar riesgos de incendios, fugas, derrames o desastres naturales relevantes al proceso y UBICACIÓN GEOGRÁFICA.
    3. Cronograma ampliado con fechas de inicio y término para instrumentar las acciones durante el año (2026).
    4. Designar responsables específicos (ej. Coordinador de Brigada, Jefe de Mantenimiento).
    5. Referenciar normativas aplicables (NOM-002-STPS-2010, Normas Técnicas de Protección Civil local).
    6. Incluir contingencias sanitarias dictadas por autoridades competentes.
    7. Incluir un texto corto resaltando la importancia de la preparación ante emergencias para la continuidad del negocio y protección civil.
    
    RESPONDE ÚNICAMENTE CON UN JSON que cumpla con el siguiente esquema:
    {
      "suggestions": [
        {
          "action": "Descripción detallada del protocolo, simulacro o equipo",
          "category": "Plan de Respuesta" | "Simulacro" | "Equipo de Emergencia" | "Capacitación Brigadas" | "Contingencia Sanitaria",
          "referenceNorm": "Ej. NOM-002-STPS / Ley General PC",
          "responsible": "Responsable específico sugerido",
          "isoStartDate": "YYYY-MM-DD",
          "isoEndDate": "YYYY-MM-DD"
        }
      ],
      "reminderText": "Texto de importancia"
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                action: { type: Type.STRING },
                category: { type: Type.STRING },
                referenceNorm: { type: Type.STRING },
                responsible: { type: Type.STRING },
                isoStartDate: { type: Type.STRING },
                isoEndDate: { type: Type.STRING }
              },
              required: ["action", "category", "referenceNorm", "responsible", "isoStartDate", "isoEndDate"]
            }
          },
          reminderText: { type: Type.STRING }
        },
        required: ["suggestions", "reminderText"]
      }
    }
  });

  const raw = JSON.parse(response.text);
  
  return {
    suggestions: raw.suggestions.map((s: any) => ({
      ...s,
      startDate: new Date(s.isoStartDate),
      endDate: new Date(s.isoEndDate)
    })),
    reminderText: raw.reminderText
  };
}

export async function generateSurroundingHazardsAnalysis(company: Company): Promise<string> {
  const model = "gemini-2.0-flash";
  
  const prompt = `
    Como experto en Gestión de Riesgos y Protección Civil en México, analiza los peligros potenciales en el entorno de la siguiente ubicación:
    - Dirección: ${company.address}
    - Latitud/Longitud: ${company.latitude}, ${company.longitude}
    - Giro: ${company.businessLine}
    
    Considera datos históricos y geográficos de México (CENAPRED, Atlas Nacional de Riesgos) para identificar:
    1. Riesgos Geológicos (Fallas, sismicidad, hundimientos).
    2. Riesgos Hidrometeorológicos (Inundaciones, ciclones, granizadas).
    3. Riesgos Químico-Tecnológicos (Gasolineras cercanas, industrias químicas, ductos).
    4. Riesgos Socio-Organizativos (Manifestaciones, vandalismo en la zona).
    5. Riesgos Sanitarios (Contaminación de mantos, basureros).

    Redacta una descripción técnica pero clara de 3 a 4 párrafos que el usuario pueda usar en su informe de seguridad. No uses formato markdown pesado, solo texto plano profesional.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt
  });

  return response.text;
}

export async function generateAccessibilityAnalysis(company: Company): Promise<string> {
  const model = "gemini-2.0-flash";
  
  const prompt = `
    Como consultor en Seguridad Industrial, redacta una descripción detallada de la accesibilidad y referencias de ubicación para el siguiente inmueble:
    - Dirección: ${company.address}
    - Latitud/Longitud: ${company.latitude}, ${company.longitude}
    - Actividad: ${company.activity}

    La descripción debe incluir:
    1. Vías de acceso principales y secundarias (Avenidas, calles).
    2. Referencias visuales para servicios de emergencia (Ej. "Frente a un parque", "Cerca de una estación de bomberos").
    3. Facilidad de acceso para vehículos pesados o de emergencia.
    4. Colindancias inmediatas (Norte, Sur, Este, Oeste).

    Redacta un texto profesional de 2 a 3 párrafos listo para ser editado por el usuario. No uses markdown, solo texto plano.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt
  });

  return response.text;
}

export async function generateLegalNormsSuggestions(company: Company): Promise<Array<{ authority: string, nomCode: string, requirement: string }>> {
  const model = "gemini-2.0-flash";
  
  const prompt = `
    Como experto en Normativa Laboral y Seguridad Industrial en México, sugiere una lista de Normas Oficiales Mexicanas (NOM-STPS), estándares internacionales (ISO, OSHA) y leyes federales aplicables a la siguiente empresa:
    - Actividad: ${company.activity}
    - Giro: ${company.businessLine || 'No especificado'}
    - Proceso: ${company.processDescription || 'No especificado'}
    - Riesgos detectados: ${company.riskLevel || 'No especificado'}

    Identifica y sugiere al menos 10 normas relevantes.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            authority: { type: Type.STRING },
            nomCode: { type: Type.STRING },
            requirement: { type: Type.STRING }
          },
          required: ["authority", "nomCode", "requirement"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Error parsing legal norms:", e);
    return [];
  }
}

export async function analyzeSTPSQuestionnaire(
  company: Company, 
  answers: Record<string, boolean>
): Promise<Array<{ authority: string, nomCode: string, requirement: string }>> {
  const model = "gemini-2.0-flash";
  
  const prompt = `
    Como experto en Normativa Laboral y Seguridad Industrial en México (STPS), analiza las respuestas al cuestionario de autogestión y sugiere la matriz legal aplicable.

    DATOS DE LA EMPRESA:
    - Actividad: ${company.activity}
    - Giro: ${company.businessLine || 'No especificado'}
    - Proceso: ${company.processDescription || 'No especificado'}

    RESPUESTAS AL CUESTIONARIO (Guía de Autogestión STPS):
    ${Object.entries(answers).map(([q, a]) => `- ${q}: ${a ? 'SÍ' : 'NO'}`).join('\n')}

    INSTRUCCIONES:
    1. Basado en las respuestas con "SÍ", identifica las Normas Oficiales Mexicanas (NOM-STPS) que se vuelven obligatorias.
    2. Considera también normas de SEMARNAT, IMSS y Protección Civil si las respuestas lo sugieren (ej. manejo de químicos implica NOM-005-STPS y LGPGIR de SEMARNAT).
    3. Si la empresa tiene más de 100 trabajadores o es de alto riesgo, asegura incluir NOM-030-STPS y NOM-019-STPS con rigor.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            authority: { type: Type.STRING },
            nomCode: { type: Type.STRING },
            requirement: { type: Type.STRING }
          },
          required: ["authority", "nomCode", "requirement"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Error parsing questionnaire analysis:", e);
    return [];
  }
}

export async function explainLegalNorm(normCode: string, requirement: string, businessLine?: string): Promise<string> {
  const model = "gemini-2.0-flash";
  const prompt = `Como experto en Seguridad Industrial, explica de forma breve y clara la aplicación de la norma ${normCode} (${requirement})${businessLine ? ` para una empresa de giro ${businessLine}` : ''}. 
  Indica qué debe hacer la empresa para cumplirla puntualmente. Responde en 2-3 viñetas concisas. Texto plano sin markdown complejo.`;
  
  const response = await ai.models.generateContent({
    model,
    contents: prompt
  });
  
  return response.text;
}

export async function explainQuestionTechnicalTerm(questionText: string, area: string): Promise<string> {
  const model = "gemini-2.0-flash";
  const prompt = `Como asesor experto en Seguridad Laboral (STPS México), explica de forma técnica pero sencilla el concepto relativo a la siguiente pregunta del diagnóstico de autogestión:
  Área: ${area}
  Pregunta: ${questionText}

  Explica qué significa el término técnico (ej. energía estática, recipientes sujetos a presión), cómo se genera el riesgo y un ejemplo de cuándo aplicaría en un centro de trabajo. 
  Usa un tono profesional y amable. Responde en un solo párrafo conciso (máximo 400 caracteres). Texto plano.`;
  
  const response = await ai.models.generateContent({
    model,
    contents: prompt
  });
  
  return response.text;
}

export async function suggestSurroundingHazards(company: Company): Promise<Array<Partial<SurroundingHazard>>> {
  const model = "gemini-2.0-flash";
  
  const prompt = `
    Como experto en Gestión de Riesgos y Protección Civil en México, analiza los peligros potenciales en el entorno de la siguiente ubicación para sugerir riesgos específicos:
    
    INFORMACIÓN:
    - Empresa: ${company.name}
    - Dirección: ${company.address}
    - Latitud/Longitud: ${company.latitude}, ${company.longitude}
    - Giro: ${company.businessLine || 'No especificado'}
    - Proceso: ${company.processDescription || 'No especificado'}
    
    Considera datos del Atlas Nacional de Riesgos (CENAPRED) y geografía de la zona.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            hazardType: { type: Type.STRING },
            source: { type: Type.STRING },
            distance: { type: Type.STRING },
            probability: { type: Type.INTEGER },
            impact: { type: Type.INTEGER },
            mitigationMeasures: { type: Type.STRING }
          },
          required: ["hazardType", "source", "distance", "probability", "impact", "mitigationMeasures"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Error parsing hazard suggestions:", e);
    return [];
  }
}

export async function suggestRiskAssessments(company: Company): Promise<Array<Partial<RiskAssessment & { possibleConsequence: string }>>> {
  const model = "gemini-2.0-flash";
  
  const prompt = `
    Como experto en Seguridad y Salud en el Trabajo (NOM-030-STPS y NOM-002-STPS en México), analiza la siguiente empresa para sugerir riesgos internos potenciales:
    
    DETALLES DE LA EMPRESA:
    - Actividad: ${company.activity}
    - Giro: ${company.businessLine || 'No especificado'}
    - Proceso: ${company.processDescription || 'No especificado'}
    - Materias Primas/Herramientas: ${company.rawMaterials || 'No especificadas'}
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            processName: { type: Type.STRING },
            activity: { type: Type.STRING },
            hazard: { type: Type.STRING },
            possibleConsequence: { type: Type.STRING },
            probability: { type: Type.INTEGER },
            severity: { type: Type.INTEGER },
            controls: { type: Type.STRING },
            responsible: { type: Type.STRING }
          },
          required: ["category", "processName", "activity", "hazard", "possibleConsequence", "probability", "severity", "controls", "responsible"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Error parsing risk assessment suggestions:", e);
    return [];
  }
}

export async function extractProcessAssets(processDescription: string): Promise<{ machinery: string, rawMaterials: string }> {
  const model = "gemini-2.0-flash";
  
  const prompt = `
    Analiza la siguiente descripción de un proceso industrial e identifica la maquinaria/equipos y las materias primas mencionadas o implícitas.
    
    PROCESO: "${processDescription}"
    
    RESPONDE ÚNICAMENTE CON UN JSON con este formato:
    {
      "machinery": "Lista separada por comas de maquinaria y equipo",
      "rawMaterials": "Lista separada por comas de materias primas e insumos"
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          machinery: { type: Type.STRING },
          rawMaterials: { type: Type.STRING }
        },
        required: ["machinery", "rawMaterials"]
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Error parsing process assets:", e);
    return { machinery: "", rawMaterials: "" };
  }
}

export async function generateFinalAnalysis(
  company: Company,
  findings: Finding[],
  accidents: AccidentEvent[],
  program: SafetyProgramItem[]
): Promise<{ conclusions: string, recommendations: string }> {
  const model = "gemini-2.0-flash";
  
  const prompt = `
    Como consultor experto en Seguridad y Salud en el Trabajo (SST) y especialista en la NOM-030-STPS-2009 en México, genera un análisis final para el reporte de diagnóstico de seguridad de la siguiente empresa:
    
    EMPRESA: ${company.name}
    ACTIVIDAD: ${company.activity}
    PROCESO: ${company.processDescription || 'No especificado'}
    
    DATOS PARA ANÁLISIS:
    - RIESGOS/HALLAZGOS: ${findings.length > 0 ? findings.map(f => `${f.title} (${f.severity})`).join(', ') : 'Sin riesgos directos registrados. Se requiere vigilancia de cumplimiento normativo general.'}
    - ACCIDENTALIDAD: ${accidents.length > 0 ? accidents.map(a => `${a.type}: ${a.daysLost} días perdidos`).join(', ') : 'Cero accidentes reportados. Mantener cultura de prevención.'}
    - PROGRAMA DE SEGURIDAD: ${program.length > 0 ? program.map(p => p.action).join(', ') : 'Acciones preventivas básicas según NOM-030.'}
    
    REQUERIMIENTOS DE REDACCIÓN:
    1. "3 Conclusiones Técnicas": Un resumen profesional del estado legal y operativo de la empresa respecto a la NOM-030.
    2. "3 Recomendaciones Legales": Acciones clave priorizadas para asegurar el cumplimiento normativo conforme a la NOM-030-STPS.
    
    Analiza estos datos de seguridad (Procesos, Riesgos, Accidentes) y redacta 3 Conclusiones Técnicas y 3 Recomendaciones Legales conforme a la NOM-030-STPS.
    
    RESPONDE ÚNICAMENTE CON UN JSON que cumpla con el siguiente esquema:
    {
      "conclusions": "Texto de las 3 conclusiones técnicas...",
      "recommendations": "Texto de las 3 recomendaciones legales..."
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          conclusions: { type: Type.STRING },
          recommendations: { type: Type.STRING }
        },
        required: ["conclusions", "recommendations"]
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Error parsing final analysis:", e);
    return { 
      conclusions: "Se recomienda la implementación inmediata de los procedimientos descritos en la NOM-030-STPS-2009 para asegurar un entorno laboral seguro y cumplir con la legislación mexicana vigente.",
      recommendations: "1. Realizar diagnósticos periódicos de seguridad.\n2. Capacitar al personal en prevención de riesgos.\n3. Mantener actualizada la matriz de riesgos y cumplimiento legal."
    };
  }
}

export async function generateStudioTargetAndIntroduction(
  company: Company,
  findings: Finding[],
  hazards: SurroundingHazard[]
): Promise<{ target: string, introduction: string }> {
  const model = "gemini-2.0-flash";
  
  const prompt = `
    Como experto consultor en Seguridad y Salud en el Trabajo bajo la normativa mexicana (NOM-030-STPS-2009), genera dos apartados para un informe técnico corporativo oficial:
    
    1. OBJETIVO DEL ESTUDIO (un objetivo técnico redactado con extrema formalidad y precisión de unos 1-2 párrafos para diagnosticar el cumplimiento legal del centro de trabajo).
    2. INTRODUCCIÓN DEL ESTUDIO (un bloque técnico introductorio de unos 1-2 párrafos que contextualiza la importancia de los servicios preventivos de seguridad y salud, vinculando la actividad industrial de la empresa y la NOM-030-STPS-2009).
    
    INFORMACIÓN DEL CENTRO DE TRABAJO:
    - Nombre: ${company.name}
    - Actividad/Giro: ${company.activity} / ${company.businessLine || 'Operación general'}
    - Ubicación: ${company.address}
    - Personal expuesto: ${company.workerCount} trabajadores
    - Nivel de Riesgo adjudicado: Clase ${company.riskLevel}
    - Procesos declarados: ${company.processDescription || 'Actividad operativa regular'}
    
    INFORMACIÓN DE RIESGOS ENCONTRADOS:
    ${findings.length > 0 ? findings.map(f => `- Hallazgo: ${f.title} (Severidad: ${f.severity})`).join('\n') : 'Sin hallazgos severos registrados.'}
    ${hazards.length > 0 ? hazards.map(h => `- Peligro Circunstancial/Externo: ${h.source} (Nivel Riesgo: ${h.riskLevel})`).join('\n') : 'Sin riesgos circunstanciales severos.'}
    
    RESPONDE EXCLUSIVAMENTE CON UN OBJETO JSON BAJO EL SIGUIENTE ESQUEMA:
    {
      "target": "Redacción detallada en un párrafo formal del Objetivo del estudio...",
      "introduction": "Redacción detallada en uno o dos párrafos de la Introducción técnica del estudio..."
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          target: { type: Type.STRING },
          introduction: { type: Type.STRING }
        },
        required: ["target", "introduction"]
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Error parsing target and intro:", e);
    return {
      target: "Establecer e instrumentar un diagnóstico estructural e integral de las condiciones de seguridad y salud en el centro de trabajo " + company.name + ", que permita identificar agentes y condiciones de peligro para cumplir con los lineamientos de la NOM-030-STPS-2009.",
      introduction: "El presente informe técnico representa la evaluación diagnóstica de los servicios preventivos de seguridad y salud en el trabajo para " + company.name + ". La prevención de accidentes laborales y el control de enfermedades ocupacionales forman parte de los pilares indispensables para el desarrollo productivo e industrial sustentable."
    };
  }
}

export interface AreaConstructionDetails {
  name: string;
  walls: string;
  roof: string;
  floors: string;
}

export interface InfrastructureAnalyzeAnswers {
  areas: AreaConstructionDetails[];
  installations: string[];
  constructionYear: string;
  hasCracks: boolean;
  hasDeformations: boolean;
  hasSettlements: boolean;
  structuralObservations: string;
  customDetails?: string;
}

export async function analyzeMaterialFromImage(
  imageBase64: string
): Promise<{
  suggestedMaterials: Array<{ materialName: string; confidence: string; description: string }>
}> {
  const model = "gemini-2.0-flash";
  let contents: any[] = [];

  if (imageBase64.startsWith("data:image/")) {
    const commaIndex = imageBase64.indexOf(",");
    if (commaIndex !== -1) {
      const mimePart = imageBase64.substring(5, commaIndex);
      const mimeType = mimePart.split(";")[0];
      const base64Data = imageBase64.substring(commaIndex + 1);

      contents.push({
        inlineData: {
          mimeType,
          data: base64Data
        }
      });
    }
  }

  const prompt = `
    Analiza detalladamente esta fotografía de un elemento de construcción (pared, techumbre, piso o instalación física).
    Identifica el material o materiales predominantes mostrados en la imagen (por ejemplo, block de concreto de alta resistencia, lámina pintro de acero galvanizado, tablaroca, panel termoacústico con espuma de poliuretano, firme de concreto hidráulico, losa de concreto preforzada, etc.) y proporciona hasta 3 opciones ordenadas por nivel de aproximación o probabilidad de acierto.

    RESPONDE EXCLUSIVAMENTE CON UN OBJETO JSON BAJO EL SIGUIENTE ESQUEMA:
    {
      "suggestedMaterials": [
        {
          "materialName": "Nombre breve del material (ej. Block de Concreto Hueco)",
          "confidence": "Alta, Media o Baja",
          "description": "Explicación breve de por qué se detecta este material y sus propiedades generales de resistencia."
        }
      ],
      "technicalDescription": "Una descripción técnica detallada y formal (de 1-2 párrafos) del material o estructura identificada en la foto, evaluando su resistencia, durabilidad e idoneidad para un centro de trabajo."
    }
  `;

  contents.push({ text: prompt });

  const response = await ai.models.generateContent({
    model,
    contents: { parts: contents },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestedMaterials: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                materialName: { type: Type.STRING },
                confidence: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["materialName", "confidence", "description"]
            }
          },
          technicalDescription: { type: Type.STRING }
        },
        required: ["suggestedMaterials", "technicalDescription"]
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Error parsing material analysis json:", e);
    return {
      suggestedMaterials: [
        { materialName: "Block o Concreto", confidence: "Media", description: "Material rígido con textura rugosa detectado según la textura de la imagen." },
        { materialName: "Acabado de Yeso o Panel Tablaroca", confidence: "Media", description: "Superficie de apariencia lisa y homogénea." },
        { materialName: "Lámina o Metal Estructurado", confidence: "Baja", description: "En caso de apreciarse perfiles metálicos o corrugaciones." }
      ],
      technicalDescription: "Material sólido estructural de block de concreto o panel rígido con acabado superficial liso. Apto para delimitación de áreas con resistencia al fuego moderada y soporte de cargas de viento y peso estándar."
    };
  }
}

export async function generateInfrastructureAnalyze(
  company: Company,
  uploadedImage: string | null,
  answers: InfrastructureAnalyzeAnswers
): Promise<{ infrastructureDescription: string, identifiedAreas: Array<{ name: string, description: string }> }> {
  const model = "gemini-2.0-flash";
  
  let contents: any[] = [];
  
  if (uploadedImage && uploadedImage.startsWith("data:image/")) {
    const commaIndex = uploadedImage.indexOf(",");
    if (commaIndex !== -1) {
      const mimePart = uploadedImage.substring(5, commaIndex);
      const mimeType = mimePart.split(";")[0];
      const base64Data = uploadedImage.substring(commaIndex + 1);
      
      contents.push({
        inlineData: {
          mimeType,
          data: base64Data
        }
      });
    }
  }

  // Format area details for prompt
  const formattedAreas = answers.areas.map(a => `
    - ÁREA: ${a.name}
      * Muros/Paredes: ${a.walls}
      * Techo/Cubierta: ${a.roof}
      * Pisos/Superficie: ${a.floors}
  `).join("\n");

  const prompt = `
    Como consultor experto en Seguridad Laboral, Ingeniería Estructural, Protección Civil y normatividad mexicana (NOM-030-STPS-2009 / NOM-002-STPS-2010), analiza la información de construcción de cada área detallada y la imagen satelital/croquis adjunta (si se proporciona) para redactar una memoria descriptiva técnica pormenorizada de la infraestructura del centro de trabajo y listar las áreas operativas clave identificadas.

    DATOS DE LA EMPRESA:
    - Nombre del Centro: ${company.name}
    - Actividad/Giro: ${company.activity} / ${company.businessLine || 'Operación general'}

    DATOS ESTRUCTURALES GENERALES:
    - Año de Construcción/Antigüedad del Centro de Trabajo: ${answers.constructionYear || 'No especificado'}
    - Presencia de Grietas visibles en muros: ${answers.hasCracks ? 'SÍ, manifestadas en la estructura' : 'NO detectadas a simple vista'}
    - Presencia de Deformaciones (flechas en vigas/columnas): ${answers.hasDeformations ? 'SÍ, detectadas' : 'NO detectadas a simple vista'}
    - Presencia de Asentamientos o deformaciones en pisos/firme: ${answers.hasSettlements ? 'SÍ, detectados' : 'NO detectados'}
    - Observaciones estructurales adicionales: ${answers.structuralObservations || 'Ninguna especificada'}

    DETALLES DE CONSTRUCCIÓN POR ÁREA CLAVE EXPRESADOS POR EL USUARIO:
    ${formattedAreas}

    INSTALACIONES DE SEGURIDAD Y SERVICIO ACTIVAS:
    - Instalaciones: ${answers.installations.join(", ") || 'Ninguna especificada'}
    - Detalles técnicos complementarios: ${answers.customDetails || 'Ninguno'}

    INSTRUCCIONES DE REDACCIÓN TÉCNICA (SÉ SUMAMENTE ESPECÍFICO, ORDENADO Y RIGUROSO):
    Elabora una "Memoria de Infraestructura y Diagnóstico Estructural" de alto nivel científico-industrial, de lectura sumamente limpia y profesional, en idioma español para la empresa ${company.name}. 

    REGLAS DE FORMATO Y REDACCIÓN IMPRESCINDIBLES:
    - Utiliza un estilo de redacción claro, secuencial, estructurado y con excelente uso de la puntuación en español (usa puntos y aparte para separar ideas, comas para incisos y puntos y comas [;] para enlistar características de manera clara).
    - Evita párrafos excesivamente largos o apelmazados; cada párrafo debe contener un máximo de 4 a 5 líneas para asegurar una lectura ágil y comprensible.
    - Emplea formato Markdown elegante para dar jerarquía (p. ej., usa '**1. INTRODUCCIÓN Y ANTECEDENTES DE LA CONSTRUCCIÓN**' en mayúsculas como títulos principales, y listas con viñetas con sangría para desglosar especificaciones).
    - El texto final debe lucir impecablemente ordenado, secuencial y fácil de interpretar tanto para un inspector de Protección Civil como para la alta dirección de la empresa.

    ORGANIZA EL TEXTO SIGUIENDO ESTOS APARTADOS FORMALES EXACTOS:
    
    **1. INTRODUCCIÓN Y ANTECEDENTES DE LA CONSTRUCCIÓN**
    Redacta una contextualización formal sobre la antigüedad del inmueble (construido en el año ${answers.constructionYear}), analizando el impacto del tiempo en la materialidad estructural de cara a su giro industrial (${company.activity}). Usa oraciones estructuradas con punto y coma para separar ideas complejas de estabilidad física.
    
    **2. DESCRIPCIÓN DETALLADA ESTRUCTURAL DE LA INFRAESTRUCTURA POR ÁREAS**
    Redacta un sub-apartado específico, limpio y bien desglosado para cada una de las áreas ingresadas por el usuario (${answers.areas.map(a => a.name).join(", ")}):
       - Identifica claramente el área en negritas (ej: *Área: [Nombre]*).
       - Describe puntualmente los materiales de muros, techumbres y pisos indicados por el usuario. Evalúa su idoneidad, resistencia al desgaste mecánico u operativo, resistencia al fuego y aislamiento térmico/acústico general, empleando viñetas claras separadas por punto y coma.
       
    **3. DIAGNÓSTICO DE CONDICIONES FÍSICAS Y RIESGOS DETECTADOS (GRIETAS Y DEFORMACIONES)**
    Lleva a cabo una evaluación clínica y de ingeniería sobre la presencia o ausencia de patologías en el inmueble:
       - Si existen fallas (Grietas: ${answers.hasCracks ? 'SÍ' : 'NO'}, Deformaciones: ${answers.hasDeformations ? 'SÍ' : 'NO'}, Asentamientos: ${answers.hasSettlements ? 'SÍ' : 'NO'}), elabora un análisis pormenorizado del riesgo estructural, explicando el potencial peligro de colapso parcial, fractura severa o pérdida de estabilidad.
       - Si no se reportan signos visibles, describe de manera asertiva la idoneidad actual del estado físico de carga y fundamenta la necesidad de instrumentar planes de inspección y conservación constantes.
    
    **4. PROPUESTAS Y RECOMENDACIONES TÉCNICAS REQUERIDAS (NORMATIVAS)**
    Aporta una lista numerada impecable con sugerencias y medidas preventivas/correctivas de ingeniería sumamente completas y específicas:
       - Detalla actividades de mitigación como: inyección de resinas en fisuras, impermeabilización con membranas termo-fusionadas, aplicación de acabados epóxicos autonivelantes, y colocación de recubrimientos retardantes al fuego (pintura intumescente/ignífuga) según los materiales declarados.
       - Cada recomendación debe iniciar con un verbo de acción en infinitivo (ej: *Efectuar*, *Implementar*, *Inspeccionar*); seguido de una justificación normativa o física detallada y ordenada.

    **5. CONCLUSIÓN GENERAL DEL LEVANTAMIENTO**
    Aporta un resumen asertivo de la viabilidad estructural del centro laboral frente a la NOM-030-STPS.

    RESPONDE EXCLUSIVAMENTE CON UN OBJETO JSON BAJO EL SIGUIENTE ESQUEMA:
    {
      "infrastructureDescription": "TEXTO DETALLADO REDACTADO EN APARTADOS CON LOS NOMBRES EXACTOS DE LAS ÁREAS E INFORMACIÓN REQUERIDA...",
      "identifiedAreas": [
        {
          "name": "Nombre exacto del área física (ej. Nave de Fabricación Mecánica o Almacén de Logística)",
          "description": "Detalle técnico de prevención sugerido para este espacio físico según los materiales indicados (orden, ventilación, pasillos, etc.)."
        }
      ]
    }
  `;

  contents.push({ text: prompt });

  const response = await ai.models.generateContent({
    model,
    contents: { parts: contents },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          infrastructureDescription: { type: Type.STRING },
          identifiedAreas: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["name", "description"]
            }
          }
        },
        required: ["infrastructureDescription", "identifiedAreas"]
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Error parsing infrastructure analysis json:", e);
    return {
      infrastructureDescription: `El centro de trabajo de la empresa ${company.name} (año ${answers.constructionYear || 'no especificado'}) cuenta con la materialidad detallada por áreas específicas. En el aspecto estructural, se reportan condiciones generales de estabilidad con atención a desviaciones registradas. Cuenta con servicios generales y sistemas de seguridad como: ${answers.installations.join(", ") || 'servicios básicos'}.`,
      identifiedAreas: [
        { name: "Área de Oficinas Administrativas", description: "Área de gestión corporativa con muros de panel acústico y buena iluminación." },
        { name: "Área de Nave de Producción", description: "Espacio amplio con piso de concreto hidráulico pulido de alta capacidad." },
        { name: "Área de Almacén de Producto Terminado", description: "Delimitado físicamente con ventilación reglamentaria de uso general." }
      ]
    };
  }
}

export async function generateSpecificRiskAnalysis(
  category: string,
  processName: string,
  activity: string,
  company: Company
): Promise<{ hazard: string; possibleConsequence: string; controls: string; responsible: string }> {
  const model = "gemini-2.0-flash";
  
  const prompt = `
    Como experto en Seguridad y Salud en el Trabajo bajo la normativa mexicana (NOM-030-STPS-2009), genera un análisis de riesgo específico para la siguiente condición o actividad.

    INFORMACIÓN DE LA EMPRESA:
    - Actividad/Giro: ${company.activity} / ${company.businessLine || 'Operación general'}

    DATOS DE ENTRADA DE LA IDENTIFICACIÓN:
    - Categoría del Peligro: ${category}
    - Proceso o Área: ${processName}
    - Actividad: ${activity}

    INSTRUCCIONES DE REDACCIÓN TÉCNICA (SÉ SUMAMENTE ESPECÍFICO, ORDENADO Y RIGUROSO):
    Genera un Análisis de Riesgo Específico que conste de:
    1. Descripción del Peligro / Riesgo (hazard): Redacta de forma clara, técnica y muy entendible en español un peligro específico para esta actividad en este proceso. Utiliza una redacción excelente con puntos y comas.
    2. Consecuencia Posible / Efecto a la salud o daño material (possibleConsequence): Describe cuáles serían los efectos en la salud del trabajador o daños materiales de forma profesional.
    3. Acción Correctiva / Medida Preventiva recomendada (controls): Recomendaciones específicas e implementaciones técnicas concretas para mitigar o controlar este riesgo.
    4. Responsable sugerido (responsible): El rol o puesto de trabajo que se encargaría de dar seguimiento a esta medida (ej. "Coordinador de Seguridad", "Jefe de Mantenimiento", etc.).

    RESPONDE ÚNICAMENTE CON UN JSON que cumpla con el siguiente esquema:
    {
      "hazard": "La descripción técnica del peligro o riesgo detectado.",
      "possibleConsequence": "El efecto posible a la salud o daño.",
      "controls": "La medida preventiva o control recomendado.",
      "responsible": "El puesto del responsable recomendado."
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          hazard: { type: Type.STRING },
          possibleConsequence: { type: Type.STRING },
          controls: { type: Type.STRING },
          responsible: { type: Type.STRING }
        },
        required: ["hazard", "possibleConsequence", "controls", "responsible"]
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Error parsing specific risk analysis:", e);
    return {
      hazard: `Peligro por ${category} durante ${activity} en ${processName}.`,
      possibleConsequence: "Efecto adverso a la salud del personal expuesto.",
      controls: "Implementar protecciones físicas and control administrativo.",
      responsible: "Responsable de Seguridad e Higiene"
    };
  }
}

export async function analyzeProcessFile(
  fileBase64: string
): Promise<{
  rawMaterials: string;
  machinery: string;
  description: string;
  steps: Array<{ text: string; type: "START" | "PROCESS" | "DECISION" | "INPUT" | "OUTPUT" | "END" }>;
}> {
  const model = "gemini-2.0-flash";
  let contents: any[] = [];

  const commaIndex = fileBase64.indexOf(",");
  if (commaIndex !== -1) {
    const mimePart = fileBase64.substring(5, commaIndex);
    const mimeType = mimePart.split(";")[0];
    const base64Data = fileBase64.substring(commaIndex + 1);

    contents.push({
      inlineData: {
        mimeType,
        data: base64Data
      }
    });
  } else {
    contents.push({
      inlineData: {
        mimeType: "image/png",
        data: fileBase64
      }
    });
  }

  const prompt = `
    Analiza minuciosamente este documento de proceso (que puede ser un diagrama de flujo en imagen o un manual/documento operativo en formato PDF).
    Extrae e interpreta de forma detallada la siguiente información:
    
    1. Las materias primas e insumos principales mencionados o implícitos en el proceso bajo un formato legible de lista separada por comas.
    2. La maquinaria, herramientas importantes y equipos de trabajo utilizados a lo largo de este proceso para mitigar riesgos, bajo un formato de lista separada por comas.
    3. Una interpretación y descripción narrativa detallada, formal y redactada técnicamente en español sobre cómo opera y se desarrolla este proceso industrial de principio a fin.
    4. Una secuencia de pasos lógicos y ordenados secuencialmente que representen el proceso industrial para construir un diagrama de flujo de alta precisión.
    
    Cada paso del diagrama de flujo debe ser clasificado en uno de los siguientes tipos:
    - START: Inicio o recibo de insumos/diseño.
    - PROCESS: Operación estándar, maquinado, transformación o ensamble.
    - DECISION: Pruebas de control de calidad, inspección de tolerancias, aprobación o control condicional.
    - INPUT: Alimentación de insumos clave o reactivos químicos.
    - OUTPUT: Salida de desechos peligrosos, remanentes, mermas o vaporizaciones, o entrega de productos intermedios.
    - END: Conclusión física, empaque o entrega del producto final.

    RESPONDE EXCLUSIVAMENTE CON UN OBJETO JSON BAJO EL SIGUIENTE ESQUEMA DE RESPUESTA:
    {
      "rawMaterials": "Lista de materias primas separadas por comas",
      "machinery": "Lista de maquinaria y equipos de trabajo separados por comas",
      "description": "Una descripción textual narrativa completa e interpretación en español del proceso industrial y el flujo que se observa en el documento",
      "steps": [
        {
          "text": "Nombre de la etapa sumamente descriptivo y sintetizado (máximo 45 caracteres)",
          "type": "START" | "PROCESS" | "DECISION" | "INPUT" | "OUTPUT" | "END"
        }
      ]
    }
  `;

  contents.push({ text: prompt });

  const response = await ai.models.generateContent({
    model,
    contents: { parts: contents },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          rawMaterials: { type: Type.STRING },
          machinery: { type: Type.STRING },
          description: { type: Type.STRING },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                type: { 
                  type: Type.STRING,
                  enum: ["START", "PROCESS", "DECISION", "INPUT", "OUTPUT", "END"]
                }
              },
              required: ["text", "type"]
            }
          }
        },
        required: ["rawMaterials", "machinery", "description", "steps"]
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Error parsing process file analysis json:", e);
    return {
      rawMaterials: "Lámina metálica, polímeros de recubrimiento, lubricantes industriales",
      machinery: "Líneas de corte, prensa de embutido, mesa neumática de ensamble",
      description: "El proceso inicia con el recibo y control de calidad de la materia prima metálica. Posteriormente se realiza el corte y troquelado para dar forma a las piezas. Finalmente se ensambla y empaca para su entrega de producto terminado.",
      steps: [
        { text: "Recepción de rollos de lámina", type: "START" },
        { text: "Inspección de espesor de chapa", type: "DECISION" },
        { text: "Maquinado de piezas troqueladas", type: "PROCESS" },
        { text: "Entrega de ensamble estructural", type: "END" }
      ]
    };
  }
}

export interface IdentifiedPhotoRisk {
  category: "unsafe_condition" | "physical_agent" | "chemical_agent" | "biological_agent" | "hazard";
  processName: string;
  activity: string;
  hazard: string;
  possibleConsequence: string;
  probability: number; // Matrix probability (1-5)
  severity: number;    // Matrix severity (1-5)
  consequence: number; // Fine consequence (1, 4, 6, 15, 40, 100)
  exposure: number;    // Fine exposure (0.5, 1, 2, 3, 6, 10)
  likelihood: number;  // Fine likelihood (0.1, 0.5, 1, 3, 6, 10)
  controls: string;
  responsible: string;
}

export async function analyzeRiskFromPhoto(
  imageBase64: string,
  companyContext?: string
): Promise<IdentifiedPhotoRisk[]> {
  const model = "gemini-2.0-flash";
  let contents: any[] = [];

  if (imageBase64.startsWith("data:image/")) {
    const commaIndex = imageBase64.indexOf(",");
    if (commaIndex !== -1) {
      const mimePart = imageBase64.substring(5, commaIndex);
      const mimeType = mimePart.split(";")[0];
      const base64Data = imageBase64.substring(commaIndex + 1);

      contents.push({
        inlineData: {
          mimeType,
          data: base64Data
        }
      });
    }
  } else {
    contents.push({
      inlineData: {
        mimeType: "image/png",
        data: imageBase64
      }
    });
  }

  const prompt = `
    Analiza esta fotografía tomada en un centro de trabajo industrial, comercial u operativo.
    Identifica de 1 a 4 riesgos, peligros o condiciones inseguras que se puedan observar de manera explícita o implícita en la imagen (por ejemplo: cables sueltos, falta de vallas, falta de equipo de protección personal, desorden, químicos sin etiqueta, postura inadecuada, mala ventilación, obstrucción de rutas de evacuación, etc.).

    ${companyContext ? `CONTEXTO DE LA EMPRESA:\n${companyContext}` : ""}

    Para cada riesgo o condición detectada, genera un análisis completo y evalúalo bajo ambas metodologías:
    1. William Fine:
       - Consecuencias (C) elegida obligatoriamente de los siguientes números: 100 (Catastrófico), 40 (Desastre), 15 (Muy Grave), 6 (Grave), 4 (Serio), 1 (Leve)
       - Exposición (E) elegida obligatoriamente de los siguientes números: 10 (Continua), 6 (Frecuente), 3 (Ocasional), 2 (Inusual), 1 (Rara), 0.5 (Muy rara)
       - Probabilidad/Likelihood (P) elegida obligatoriamente de los siguientes números: 10 (Casi seguro), 6 (Muy posible), 3 (Inusual pero posible), 1 (Remotamente posible), 0.5 (Extremadamente remoto), 0.1 (Prácticamente imposible)
    2. Matriz de Riesgo 5x5:
       - Probabilidad en escala de 1 a 5 (siendo 5 la más alta/probable)
       - Severidad en escala de 1 a 5 (siendo 5 la de mayor daño)

    RESPONDE EXCLUSIVAMENTE CON UN OBJETO JSON BAJO EL SIGUIENTE ESQUEMA:
    {
      "risks": [
        {
          "category": "unsafe_condition" | "physical_agent" | "chemical_agent" | "biological_agent" | "hazard",
          "processName": "Nombre lógico del Área o Proceso que se aprecia (ej. Taller de soldadura, Línea de ensamble, Almacén de carga)",
          "activity": "Nombre breve de la actividad que se realiza en ese puesto de trabajo",
          "hazard": "Descripción clara, detallada y comprensible sobre el peligro o riesgo observado (ej. Presencia de cables de alta tensión expuestos sin aislamiento)",
          "possibleConsequence": "Efectos probables a la salud del trabajador o daños materiales (ej. Quemaduras de tercer grado, cortocircuito e incendio)",
          "probability": Número entero entre 1 y 5 para la matriz 5x5,
          "severity": Número entero entre 1 y 5 para la matriz 5x5,
          "consequence": Número exacto seleccionado del set [1, 4, 6, 15, 40, 100],
          "exposure": Número exacto seleccionado del set [0.5, 1, 2, 3, 6, 10],
          "likelihood": Número exacto seleccionado del set [0.1, 0.5, 1, 3, 6, 10],
          "controls": "Acción correctiva o medida preventiva específica para mitigar o anular este riesgo",
          "responsible": "Puesto sugerido para dar seguimiento (ej. Coordinador de Mantenimiento, Supervisor de Seguridad, Jefe de Planta)"
        }
      ]
    }
  `;

  contents.push({ text: prompt });

  const response = await ai.models.generateContent({
    model,
    contents: { parts: contents },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          risks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: {
                  type: Type.STRING,
                  enum: ["unsafe_condition", "physical_agent", "chemical_agent", "biological_agent", "hazard"]
                },
                processName: { type: Type.STRING },
                activity: { type: Type.STRING },
                hazard: { type: Type.STRING },
                possibleConsequence: { type: Type.STRING },
                probability: { type: Type.INTEGER },
                severity: { type: Type.INTEGER },
                consequence: { type: Type.NUMBER },
                exposure: { type: Type.NUMBER },
                likelihood: { type: Type.NUMBER },
                controls: { type: Type.STRING },
                responsible: { type: Type.STRING }
              },
              required: [
                "category", "processName", "activity", "hazard", "possibleConsequence",
                "probability", "severity", "consequence", "exposure", "likelihood",
                "controls", "responsible"
              ]
            }
          }
        },
        required: ["risks"]
      }
    }
  });

  try {
    const raw = JSON.parse(response.text);
    return raw.risks || [];
  } catch (e) {
    console.error("Error parsing vision risk analysis:", e);
    return [];
  }
}





