import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { ShieldCheck, FileText, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "../ui/button";

export function LegalModule() {
  const legalFramework = [
    {
      title: "Constitución Política de los Estados Unidos Mexicanos",
      content: "Artículo 123, Apartado A, Fracción XV: El patrón estará obligado a observar, de acuerdo con la naturaleza de su negociación, los preceptos legales sobre higiene y seguridad en las instalaciones...",
      level: "Nivel Federal"
    },
    {
      title: "Ley Federal del Trabajo",
      content: "Artículos 132 Fracción XVI y XVII, 475 Bis, 512, 512-D, 512-F y 527. Establece obligaciones patronales en materia de seguridad e higiene.",
      level: "Legislación Nacional"
    },
    {
      title: "Reglamento Federal de Seguridad y Salud en el Trabajo",
      content: "Artículos 7, 8, 17, 30. Establece las disposiciones generales para la prevención de riesgos de trabajo.",
      level: "Reglamento"
    },
    {
      title: "NOM-030-STPS-2009",
      content: "Servicios preventivos de seguridad y salud en el trabajo - Funciones y actividades. Obliga a elaborar el diagnóstico de seguridad y salud.",
      level: "Norma Oficial Mexicana",
      highlight: true
    },
    {
      title: "NOM-019-STPS-2011",
      content: "Constitución, integración, organización y funcionamiento de las comisiones de seguridad e higiene.",
      level: "Norma Oficial Mexicana"
    }
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Marco Legal</h1>
        <p className="text-[10px] text-slate-500 font-medium">Fundamentación jurídica del diagnóstico de seguridad y salud en el trabajo.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-200 py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Fundamentación Jurídica
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {legalFramework.map((item, index) => (
                  <div key={index} className={`p-4 hover:bg-slate-50/50 transition-colors ${item.highlight ? 'bg-blue-50/20' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-blue-600 bg-blue-100/50 px-1.5 py-0.5 rounded-full mb-1 inline-block">
                          {item.level}
                        </span>
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">{item.title}</h3>
                      </div>
                      {item.highlight && (
                        <div className="bg-blue-600 text-white p-1 rounded-full">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-600 leading-relaxed font-medium">
                      "{item.content}"
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-blue-600 text-white border-none">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="w-8 h-8 text-blue-200" />
                <h3 className="text-xl font-bold">NOM-030-STPS</h3>
              </div>
              <p className="text-sm text-blue-100 leading-relaxed mb-6">
                Esta norma es el eje rector del presente diagnóstico. Establece que todos los centros de trabajo en territorio nacional deben contar con un diagnóstico integral o por área de las condiciones de seguridad y salud.
              </p>
              <Button 
                variant="secondary" 
                className="w-full bg-white text-blue-600 hover:bg-blue-50"
                onClick={() => window.open("https://www.gob.mx/stps/documentos/norma-oficial-mexicana-nom-030-stps-2009-servicios-preventivos-de-seguridad-y-salud-en-el-trabajo-funciones-y-actividades", "_blank")}
              >
                Consultar Norma <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Importancia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 leading-relaxed">
                El cumplimiento del marco legal no solo evita sanciones por parte de la STPS, sino que fundamenta técnicamente las acciones de prevención para salvaguardar la integridad de los trabajadores y la productividad de la empresa.
              </p>
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs text-slate-500 font-medium italic">
                  "La seguridad no es un gasto, es una inversión en el activo más valioso: el capital humano."
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
