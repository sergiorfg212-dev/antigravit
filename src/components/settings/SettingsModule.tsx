import { useRef } from "react";
import { db, type Company } from "../../lib/db";
import { useDexieQuery } from "../../hooks/useDexie";
import { useAppStore } from "../../hooks/useAppStore";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { 
  Signature, 
  Settings as SettingsIcon, 
  Upload, 
  FileImage,
  Trash2,
  FileText,
  CheckCircle2,
  Building
} from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { SignaturePad } from "../shared/SignaturePad";
import { toast } from "sonner";
import { PWAInstallGuide } from "../shared/PWAInstallGuide";
import { CloudSyncBoard } from "../shared/CloudSyncBoard";

export function SettingsModule() {
  const { currentCompanyId } = useAppStore();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const letterheadInputRef = useRef<HTMLInputElement>(null);
  const sigImageInputRef = useRef<HTMLInputElement>(null);
  const coverBgInputRef = useRef<HTMLInputElement>(null);

  const company = useDexieQuery(
    () => currentCompanyId ? db.companies.get(currentCompanyId) : Promise.resolve(undefined),
    [currentCompanyId]
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: keyof Company) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      toast.error("Formato PDF no soportado para este campo. Por favor sube una imagen (PNG, JPG o WEBP).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("El archivo excede los 2MB permitidos");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      if (currentCompanyId) {
        await db.companies.update(currentCompanyId, { [field]: base64String });
        toast.success("Archivo actualizado correctamente");
        // Reset input value to allow uploading same file again
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSloganChange = async (val: string) => {
    if (currentCompanyId) {
      await db.companies.update(currentCompanyId, { slogan: val });
    }
  };

  if (!currentCompanyId) {
    return (
      <div className="space-y-6 pb-20">
        <header>
          <h1 className="text-3xl font-bold text-slate-900">Configuración global</h1>
          <p className="text-slate-500">Opciones generales e instalación de la aplicación móvil.</p>
        </header>

        <PWAInstallGuide />
        <CloudSyncBoard />

        <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 flex flex-col items-center justify-center p-6">
          <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mb-4">
            <Building className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Visualización de perfil de empresa suspendida</h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
            Para configurar logotipos, firmas de responsabilidad o fondos de portada de PDF personalizados, primero selecciona una empresa activa desde la pestaña principal <strong>"Empresas"</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
       <header>
          <h1 className="text-3xl font-bold text-slate-900">Perfil y Configuración</h1>
          <p className="text-slate-500">Gestión de identidad corporativa y firmas autorizadas.</p>
       </header>

       <PWAInstallGuide />
       <CloudSyncBoard />

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-slate-100 shadow-sm overflow-hidden">
             <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-lg flex items-center gap-2">
                   <Signature className="w-5 h-5 text-blue-600" /> Firma del Responsable
                </CardTitle>
             </CardHeader>
             <CardContent className="space-y-6 pt-6">
                <p className="text-sm text-slate-500 leading-relaxed">Esta firma se incluirá automáticamente en todos los reportes PDF generados en la sección de dictamen técnico y anexos.</p>
                
                {company?.responsibleSignature ? (
                  <div className="space-y-4">
                     <div className="relative border border-slate-200 p-8 rounded-2xl bg-white flex items-center justify-center shadow-inner group">
                        <img src={company.responsibleSignature} alt="Firma" className="max-h-32 object-contain" />
                        <div className="absolute inset-0 bg-white/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px] gap-2">
                           <Button 
                             variant="outline" 
                             size="sm" 
                             className="gap-2 bg-white"
                             onClick={() => sigImageInputRef.current?.click()}
                           >
                              <Upload className="w-4 h-4" /> Reemplazar
                           </Button>
                           <Button 
                             variant="destructive" 
                             size="sm" 
                             className="gap-2"
                             onClick={() => db.companies.update(company.id!, { responsibleSignature: null as any })}
                           >
                              <Trash2 className="w-4 h-4" /> Eliminar
                           </Button>
                        </div>
                     </div>
                     <input 
                        type="file" 
                        ref={sigImageInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'responsibleSignature')}
                     />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                       <p className="text-xs text-blue-700 font-medium flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3" /> Puedes dibujar la firma directamente o subir una foto.
                       </p>
                    </div>
                    
                    <SignaturePad 
                      onSave={async (sig) => {
                         await db.companies.update(company?.id!, { responsibleSignature: sig });
                         toast.success("Firma guardada correctamente");
                      }}
                      onClear={() => {}}
                    />

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-slate-200" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-slate-400 font-medium">O sube un archivo</span>
                      </div>
                    </div>

                    <div 
                      onClick={() => sigImageInputRef.current?.click()}
                      className="border border-dashed border-slate-300 p-6 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <Upload className="w-6 h-6 text-slate-400 mb-2" />
                      <p className="text-xs font-bold text-slate-700">Subir imagen de firma</p>
                      <input 
                        type="file" 
                        ref={sigImageInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'responsibleSignature')}
                      />
                    </div>
                  </div>
                )}
             </CardContent>
          </Card>

          <div className="space-y-8">
            <Card className="border-slate-100 shadow-sm overflow-hidden">
               <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileImage className="w-5 h-5 text-indigo-600" /> Logo Corporativo
                  </CardTitle>
               </CardHeader>
               <CardContent className="space-y-6 pt-6">
                  {company?.logo ? (
                     <div className="space-y-4">
                        <div className="relative border border-slate-200 p-8 rounded-2xl bg-white flex items-center justify-center shadow-inner group">
                           <img src={company.logo} alt="Logo" className="max-h-24 object-contain" />
                           <div className="absolute inset-0 bg-white/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px] gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-2 bg-white"
                                onClick={() => logoInputRef.current?.click()}
                              >
                                 <Upload className="w-4 h-4" /> Reemplazar
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                className="gap-2"
                                onClick={() => db.companies.update(company.id!, { logo: null as any })}
                              >
                                 <Trash2 className="w-4 h-4" /> Eliminar
                              </Button>
                           </div>
                        </div>
                        <input 
                           type="file" 
                           ref={logoInputRef} 
                           className="hidden" 
                           accept="image/*"
                           onChange={(e) => handleFileUpload(e, 'logo')}
                        />
                     </div>
                  ) : (
                     <div 
                       onClick={() => logoInputRef.current?.click()}
                       className="border-2 border-dashed border-slate-200 p-12 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-colors"
                     >
                        <Upload className="w-8 h-8 text-slate-300 mb-3" />
                        <p className="text-sm font-bold text-slate-900 uppercase tracking-tighter">Subir Logo de la Empresa</p>
                        <p className="text-xs text-slate-400 mt-2">PNG, JPG o WEBP (Recomendado fondo transparente)</p>
                        <input 
                          type="file" 
                          ref={logoInputRef} 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, 'logo')}
                        />
                     </div>
                  )}
               </CardContent>
            </Card>

            <Card className="border-slate-100 shadow-sm overflow-hidden">
               <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" /> Membrete y Encabezado
                  </CardTitle>
               </CardHeader>
               <CardContent className="space-y-6 pt-6">
                  <div className="space-y-4">
                     {company?.letterhead ? (
                        <div className="relative border border-slate-200 p-4 rounded-xl bg-white flex items-center justify-center group h-24">
                           <img src={company.letterhead} alt="Membrete" className="max-h-full object-contain" />
                           <div className="absolute inset-0 bg-white/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-2 bg-white"
                                onClick={() => letterheadInputRef.current?.click()}
                              >
                                 <Upload className="w-4 h-4" /> Reemplazar
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                className="gap-2"
                                onClick={() => db.companies.update(company.id!, { letterhead: null as any })}
                              >
                                 <Trash2 className="w-4 h-4" /> Eliminar
                              </Button>
                           </div>
                        </div>
                     ) : (
                        <div 
                          onClick={() => letterheadInputRef.current?.click()}
                          className="border border-dashed border-slate-300 p-8 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                           <Upload className="w-6 h-6 text-slate-400 mb-2" />
                           <p className="text-xs font-bold text-slate-700">Subir Imagen de Encabezado (Membrete)</p>
                           <input 
                             type="file" 
                             ref={letterheadInputRef} 
                             className="hidden" 
                             accept="image/*"
                             onChange={(e) => handleFileUpload(e, 'letterhead')}
                           />
                        </div>
                     )}
                     <input 
                        type="file" 
                        ref={letterheadInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'letterhead')}
                     />
                     
                     <div className="space-y-2">
                        <Label className="text-xs uppercase font-black text-slate-500 tracking-widest px-1">Slogan o Texto Informativo</Label>
                        <Input 
                           defaultValue={company?.slogan}
                           onBlur={(e) => handleSloganChange(e.target.value)}
                           placeholder="Ej. Juntos por la seguridad de nuestros colaboradores" 
                           className="rounded-xl border-slate-200 focus:ring-blue-500"
                        />
                        <p className="text-[10px] text-slate-400 px-1 italic">Este texto aparecerá debajo del logo o en el pie de página del reporte.</p>
                     </div>
                  </div>
               </CardContent>
            </Card>

            <Card className="border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
               <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="text-lg flex items-center gap-2 text-indigo-700">
                    <FileImage className="w-5 h-5" /> Fondo de Portada PDF
                  </CardTitle>
               </CardHeader>
               <CardContent className="space-y-4 pt-6">
                  <p className="text-xs text-slate-500 leading-relaxed">
                     Personaliza la primera página de tu informe subiendo una imagen de soporte para el fondo. Esta imagen se aplicará de fondo con una sutil transparencia para optimizar la legibilidad del texto técnico.
                  </p>
                  
                  {company?.coverBackground ? (
                     <div className="space-y-4">
                        <div className="relative border border-slate-200 p-4 rounded-xl bg-slate-50 flex items-center justify-center group h-36 overflow-hidden">
                           <img src={company.coverBackground} alt="Fondo Portada" className="w-full h-full object-cover rounded-lg" />
                           <div className="absolute inset-0 bg-white/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-2 bg-white"
                                onClick={() => coverBgInputRef.current?.click()}
                              >
                                 <Upload className="w-4 h-4" /> Reemplazar
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                className="gap-2"
                                onClick={() => db.companies.update(company.id!, { coverBackground: null as any })}
                              >
                                 <Trash2 className="w-4 h-4" /> Eliminar
                              </Button>
                           </div>
                        </div>
                     </div>
                  ) : (
                     <div 
                       onClick={() => coverBgInputRef.current?.click()}
                       className="border border-dashed border-slate-300 p-8 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-colors"
                     >
                        <Upload className="w-6 h-6 text-slate-400 mb-2" />
                        <p className="text-xs font-bold text-slate-700">Subir Imagen para Fondo de Portada</p>
                        <p className="text-[10px] text-slate-400 mt-1">PNG, JPG o WEBP (Modelos recomendados amplios)</p>
                     </div>
                  )}
                  <input 
                     type="file" 
                     ref={coverBgInputRef} 
                     className="hidden" 
                     accept="image/*"
                     onChange={(e) => handleFileUpload(e, 'coverBackground')}
                  />
               </CardContent>
            </Card>
          </div>
       </div>
    </div>
  );
}
