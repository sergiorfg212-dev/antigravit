import { useState, useEffect } from "react";
import { usePWA } from "../../hooks/usePWA";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { 
  Smartphone, 
  Laptop, 
  Download, 
  CheckCircle2, 
  Info, 
  Share, 
  Plus, 
  HelpCircle,
  Monitor,
  Chrome,
  Check
} from "lucide-react";
import { toast } from "sonner";

export function PWAInstallGuide() {
  const { isInstallable, isInstalled, installApp } = usePWA();
  const [activeTab, setActiveTab] = useState<"android" | "ios" | "desktop">("android");
  const [detectOS, setDetectOS] = useState<string>("");
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    // Check if inside iframe
    setIsIframe(typeof window !== "undefined" && window.self !== window.top);

    // Basic OS detection to set default tab
    if (typeof window !== "undefined" && window.navigator) {
      const userAgent = window.navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(userAgent)) {
        setActiveTab("ios");
        setDetectOS("iOS");
      } else if (/android/.test(userAgent)) {
        setActiveTab("android");
        setDetectOS("Android");
      } else {
        setActiveTab("desktop");
        setDetectOS("Escritorio");
      }
    }
  }, []);

  const handleInstallClick = async () => {
    try {
      const success = await installApp();
      if (success) {
        toast.success("¡Aplicación instalada con éxito!");
      } else {
        toast.info("Instalación cancelada por el usuario");
      }
    } catch (e) {
      toast.error("Error al iniciar instalación");
    }
  };

  return (
    <Card className="border-slate-100 shadow-sm overflow-hidden border-2 border-blue-50">
      <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/20 border-b border-separate border-blue-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2 text-blue-900 font-bold">
              <Smartphone className="w-5 h-5 text-blue-600" /> Descargar e Instalar en Celular / PC
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Lleva el sistema de la NOM-030 contigo y continúa tu avance en cualquier momento con sincronización automática en la nube.
            </p>
          </div>
          
          <div>
            {isInstalled ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <Check className="w-3.5 h-3.5" /> Instalada (Modo App)
              </span>
            ) : isInstallable ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 animate-pulse">
                <Download className="w-3.5 h-3.5" /> ¡Listo para Instalar!
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                <Info className="w-3.5 h-3.5" /> Disponible para Móviles
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        {/* If running inside iframe, show the link-out warning */}
        {isIframe && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-900 space-y-4">
            <div className="flex gap-3 items-start">
              <span className="text-2xl mt-0.5 shrink-0">⚠️</span>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-amber-950">Restricción de seguridad del navegador</h4>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Estás viendo esta aplicación dentro de un recuadro de vista previa (iframe). Los navegadores modernos (Chrome y Safari) **bloquean** cualquier intento de descargar o instalar aplicaciones web cuando se encuentran dentro de un iframe.
                </p>
                <p className="text-xs font-semibold text-amber-900 mt-2">
                  Para poder descargar e instalar la app en tu celular, haz clic en el siguiente enlace para abrirla en una pestaña libre de tu navegador:
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Button 
                onClick={() => window.open(window.location.href, "_blank")}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs"
              >
                <Share className="w-4 h-4" /> Abrir en nueva pestaña independiente
              </Button>
              <div className="bg-white/60 border border-amber-200 rounded-xl px-4 py-2 flex items-center justify-between text-[11px] font-mono text-slate-600 break-all w-full select-all">
                <span>{typeof window !== "undefined" ? window.location.href : ""}</span>
              </div>
            </div>
          </div>
        )}

        {/* Call to action for direct install */}
        {!isInstalled && isInstallable && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-md shadow-blue-200">
            <div className="space-y-2 text-center md:text-left">
              <h4 className="text-lg font-bold">Instalación directa disponible</h4>
              <p className="text-blue-100 text-sm max-w-xl">
                Tu navegador es compatible con la instalación directa de un solo clic. Instala para añadirla a tu pantalla de inicio y ocultar la barra del navegador.
              </p>
            </div>
            <Button 
              onClick={handleInstallClick}
              className="bg-white text-blue-900 hover:bg-blue-50 font-bold px-6 py-5 rounded-xl flex items-center gap-2 text-sm shrink-0 shadow-lg shadow-blue-800/20"
            >
              <Download className="w-4 h-4" /> Instalar Ahora
            </Button>
          </div>
        )}

        {/* Informative message for Standalone already installed */}
        {isInstalled && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl p-5 flex gap-4 items-start">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Estás ejecutando la aplicación nativa</h4>
              <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                ¡Excelente! Ya estás utilizando la aplicación desde tu dispositivo móvil o computadora. Todas tus configuraciones y cambios en los diagnósticos se sincronizan en la nube en tiempo real cuando tienes Internet.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs uppercase font-black text-slate-400 tracking-wider flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" /> Guía de instalación paso a paso
            </h4>
            {detectOS && (
              <span className="text-[10px] text-slate-400">Sistema detectado: <strong className="text-slate-600">{detectOS}</strong></span>
            )}
          </div>

          {/* Tab selectors */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setActiveTab("android")}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 text-center flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === "android" 
                  ? "border-blue-600 text-blue-600" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <Smartphone className="w-4 h-4" /> Android (Chrome)
            </button>
            <button
              onClick={() => setActiveTab("ios")}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 text-center flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === "ios" 
                  ? "border-pink-600 text-pink-600" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <Smartphone className="w-4 h-4" /> iPhone / iPad
            </button>
            <button
              onClick={() => setActiveTab("desktop")}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 text-center flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === "desktop" 
                  ? "border-slate-800 text-slate-800" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <Monitor className="w-4 h-4" /> Computadora
            </button>
          </div>

          {/* Tab contents */}
          <div className="pt-4 min-h-[160px] rounded-2xl bg-slate-50/50 p-5 border border-slate-100">
            {activeTab === "android" && (
              <div className="space-y-3 text-sm text-slate-600">
                <p className="font-medium text-slate-800 mb-2">Para instalar en cualquier celular o tablet Android usando Google Chrome:</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Abre esta página web en el navegador <strong>Google Chrome</strong> de tu teléfono.</li>
                  <li>Busca un banner flotante en la parte inferior que diga <strong>"Agregar Diagnosticando su empresa 030 a la pantalla principal"</strong>.</li>
                  <li>Si no aparece el banner, pulsa el botón del menú de Chrome (los <strong>tres puntos verticales <strong className="text-slate-900">:</strong></strong>) en la esquina superior derecha.</li>
                  <li>Selecciona la opción de la lista que indica <strong>"Instalar aplicación"</strong> o bien <strong>"Agregar a la pantalla de inicio"</strong>.</li>
                  <li>Confirma la pantalla y la aplicación se descargará e instalará automáticamente en el cajón de apps de tu teléfono. ¡Listo!</li>
                </ol>
              </div>
            )}

            {activeTab === "ios" && (
              <div className="space-y-3 text-sm text-slate-600">
                <p className="font-medium text-slate-800 mb-2">Para instalar en tu iPhone o iPad usando el navegador Safari oficial:</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Abe esta página web desde tu iPhone exclusivamente en el navegador <strong>Safari</strong> de Apple.</li>
                  <li>En la barra de herramientas inferior de Safari, pulsa el ícono de <strong>Compartir <Share className="w-4 h-4 inline-block text-blue-500 mx-1 align-middle" /></strong> (el cuadrado con la flecha hacia arriba).</li>
                  <li>Desplázate hacia abajo en el menú de opciones desplegado y selecciona <strong>"Agregar a pantalla de inicio" <Plus className="w-4 h-4 inline-block text-slate-700 mx-1 align-middle" /></strong>.</li>
                  <li>Modifica el nombre si deseas (ej. <em className="text-slate-800 font-medium">NOM 030</em>) y presiona el botón <strong>"Agregar"</strong> en la esquina superior derecha.</li>
                  <li>El ícono personalizado de la app aparecerá de inmediato en la pantalla de inicio de tu iPhone, abriendo como una app aislada limpia de navegador.</li>
                </ol>
              </div>
            )}

            {activeTab === "desktop" && (
              <div className="space-y-3 text-sm text-slate-600">
                <p className="font-medium text-slate-800 mb-2">Para instalar de forma local en tu computadora Windows, Mac o Linux:</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>En tu navegador compatible (como <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong>), busca el ícono de descargas en la barra de direcciones de arriba (una computadora pequeña con una flecha hacia abajo <Download className="w-4 h-4 inline-block text-blue-500 mx-1 align-middle" />).</li>
                  <li>Haz clic en él y pulsa <strong>"Instalar"</strong>.</li>
                  <li>O bien, ingresa al menú del navegador (los tres puntos de arriba a la derecha) y presiona la opción <strong>"Guardar y compartir"</strong> &gt; <strong>"Instalar Diag030"</strong>.</li>
                  <li>Se creará un acceso directo nativo en tu escritorio de computadora para abrirla al instante sin ingresar una URL manualmente.</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Benefits banner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="flex gap-3 items-start p-4 border border-slate-100 rounded-xl bg-white shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-sm">
              ☁️
            </div>
            <div>
              <h5 className="font-bold text-xs text-slate-900 uppercase">Respaldo Automático</h5>
              <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                Dado que Firestore guarda todo tu avance online, puedes saltar del celular a la computadora conservando todo intacto.
              </p>
            </div>
          </div>
          
          <div className="flex gap-3 items-start p-4 border border-slate-100 rounded-xl bg-white shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 font-bold text-sm">
              📶
            </div>
            <div>
              <h5 className="font-bold text-xs text-slate-900 uppercase">Funcionamiento Desconectado</h5>
              <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                Sigue ingresando hallazgos o consultando la matriz legal aun sin señal en el centro de trabajo; se sincronizará cuando vuelvas a tener señal.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
