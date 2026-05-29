import React, { useRef } from 'react';
import { Company } from '../../lib/db';
import { Button } from '../ui/button';
import { Printer, Download, FileText, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DesignationLetterProps {
  company: Company;
  onClose: () => void;
}

export function DesignationLetter({ company, onClose }: DesignationLetterProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    const windowUrl = 'about:blank';
    const uniqueName = new Date().getTime();
    const windowName = 'Print' + uniqueName;
    const printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=0,height=0');
    
    if (printWindow && printContent) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Carta de Designación - ${company.name}</title>
            <style>
              body { font-family: 'Arial', sans-serif; padding: 40px; color: #333; line-height: 1.6; }
              .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px; }
              .date { text-align: right; margin-bottom: 30px; }
              .content { text-align: justify; margin-bottom: 40px; }
              ul { margin-bottom: 20px; padding-left: 30px; }
              li { margin-bottom: 10px; font-style: italic; font-size: 14px; }
              .footer { margin-top: 60px; display: flex; justify-content: space-around; text-align: center; }
              .signature-line { border-top: 1px solid #000; width: 200px; margin-top: 50px; }
              @media print {
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  const today = format(new Date(), "PP", { locale: es });

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[95vh]">
        <div className="p-4 border-b flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-900">Designación de Responsable</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8" ref={printRef}>
          <div className="header">
            <h1 className="text-xl font-bold uppercase">{company.name}</h1>
            <p className="text-sm text-slate-500">{company.address}</p>
            <p className="text-sm font-bold mt-2">CONSTANCIA DE DESIGNACIÓN DEL RESPONSABLE DE SEGURIDAD Y SALUD EN EL TRABAJO</p>
          </div>

          <div className="date">
            <p>Ciudad de México, a {today}</p>
          </div>

          <div className="content space-y-4">
            <p className="font-bold">A QUIEN CORRESPONDA:</p>
            
            <p>
              Por medio de la presente, la empresa <span className="font-bold">{company.name}</span>, 
              con RFC <span className="font-bold">{company.rfc}</span> y actividad económica en 
              <span className="font-bold"> {company.activity}</span>, hace constar la designación formal de:
            </p>

            <div className="py-4 text-center">
              <p className="text-xl font-black underline">{company.responsibleName}</p>
              <p className="text-sm text-slate-500 uppercase mt-1">Como Responsable de Seguridad y Salud en el Trabajo</p>
            </div>

            <p>
              Lo anterior, en estricto cumplimiento con lo establecido en la <span className="font-bold">Norma Oficial Mexicana NOM-030-STPS-2009</span>, 
              Servicios preventivos de seguridad y salud en el trabajo-Funciones y actividades.
            </p>

            <p>
              El designado tendrá las facultades y responsabilidades de planear, organizar, coordinar y vigilar el cumplimiento de 
              los programas de seguridad y salud, así como de realizar el diagnóstico de seguridad y salud en el centro de trabajo. 
              Para tal efecto, la empresa le otorga:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-sm italic">
              <li>Las facilidades para ingresar a las diferentes áreas del centro de trabajo para identificar los factores de peligro y la exposición de los trabajadores.</li>
              <li>La información relacionada con la seguridad y salud en el trabajo de los procesos, puestos de trabajo y actividades desarrolladas por los trabajadores.</li>
              <li>Los medios y facilidades necesarios para establecer las medidas de seguridad y salud en el trabajo para la prevención de los accidentes y enfermedades de trabajo.</li>
            </ul>

            <p>
              Asimismo, se le faculta para proponer las medidas preventivas y correctivas necesarias para evitar riesgos de trabajo, 
              asegurando que se mantengan las condiciones óptimas de seguridad en todo momento.
            </p>

            <p>
              La empresa se compromete a proporcionar los recursos y el apoyo necesario para que el responsable designado pueda 
              desempeñar sus funciones de manera ética, profesional y efectiva.
            </p>
          </div>

          <div className="footer">
            <div className="flex flex-col items-center">
              <div className="signature-line"></div>
              <p className="text-xs font-bold mt-2 uppercase">Representante Legal</p>
              <p className="text-[10px] text-slate-500">{company.name}</p>
            </div>
            <div className="flex flex-col items-center">
              {company.responsibleSignature ? (
                <div className="h-20 flex items-end">
                  <img src={company.responsibleSignature} alt="Firma" className="max-h-full" />
                </div>
              ) : (
                <div className="signature-line"></div>
              )}
              <p className="text-xs font-bold mt-2 uppercase">Acepta Comisión</p>
              <p className="text-[10px] text-slate-500">{company.responsibleName}</p>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-slate-100 text-[10px] text-slate-400 text-center italic">
            Este documento es para uso interno y cumplimiento ante la autoridad laboral (STPS). No sustituye trámites legales oficiales si se requieren.
          </div>
        </div>
      </div>
    </div>
  );
}
