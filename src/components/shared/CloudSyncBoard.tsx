import { useState, useEffect } from "react";
import { useAppStore } from "../../hooks/useAppStore";
import { 
  syncLocalStorageWithCloud, 
  pushAllFromDexieToFirestore, 
  pullAllFromFirestoreToDexie 
} from "../../lib/sync";
import { auth } from "../../lib/firebase";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent 
} from "../ui/card";
import { Button } from "../ui/button";
import { 
  Cloud, 
  RefreshCw, 
  CloudLightning, 
  ArrowUp, 
  ArrowDown, 
  Wifi, 
  WifiOff, 
  Loader2, 
  ShieldCheck,
  Smartphone,
  Laptop,
  Database,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

export function CloudSyncBoard() {
  const { currentUser } = useAppStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [syncStats, setSyncStats] = useState<{ pushed: number; pulled: number; lastSynced: string | null }>({
    pushed: 0,
    pulled: 0,
    lastSynced: localStorage.getItem("last_explicit_sync_time") || null
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const fbUser = auth.currentUser;
  const isOfflineLocalUser = currentUser?.email?.endsWith(".local@nom030.com") || false;

  const handleFullSync = async () => {
    if (!fbUser) {
      toast.error("Para sincronizar los datos debes iniciar sesión con una cuenta de Google u otra credencial en la nube.");
      return;
    }
    if (!isOnline) {
      toast.error("No se puede sincronizar sin conexión a internet. Revisa tu conexión de datos de celular o Wi-Fi.");
      return;
    }

    setIsSyncing(true);
    const toastId = toast.loading("Estableciendo canal con la nube y uniendo bases de datos...");

    try {
      const { pushedCount, pulledCount } = await syncLocalStorageWithCloud(fbUser.uid);
      
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + 
                     " del " + new Date().toLocaleDateString([], { day: '2-digit', month: '2-digit' });
      
      localStorage.setItem("last_explicit_sync_time", nowStr);
      setSyncStats({
        pushed: pushedCount,
        pulled: pulledCount,
        lastSynced: nowStr
      });

      toast.success(
        `¡Sincronización Completa! Se guardaron exitosamente en la nube ${pushedCount} registros locales y se descargó todo tu avance de forma equilibrada.`,
        { id: toastId, duration: 6000 }
      );
    } catch (err: any) {
      console.error(err);
      toast.error("Falló la conciliación de bases de datos en la nube. Revisa los permisos e intenta de nuevo.", { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOnlyPush = async () => {
    if (!fbUser) return;
    if (!isOnline) {
      toast.error("Operación no disponible fuera de línea.");
      return;
    }

    setIsSyncing(true);
    const toastId = toast.loading("Guardando respaldo de base de datos local en la nube...");
    try {
      await pushAllFromDexieToFirestore(fbUser.uid);
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      localStorage.setItem("last_explicit_sync_time", `${nowStr} (Respaldo)`);
      toast.success("Respaldo completado. Toda la información de este dispositivo ahora se encuentra segura en el servidor de Google.", { id: toastId });
    } catch (err) {
      toast.error("No se pudo completar el respaldo.", { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOnlyPull = async () => {
    if (!fbUser) return;
    if (!isOnline) {
      toast.error("Operación no disponible fuera de línea.");
      return;
    }

    const confirmed = window.confirm(
      "¿Estás seguro de que deseas forzar la descarga de los datos desde la nube?\n\n¡ADVERTENCIA!: Esto borrará cualquier registro nuevo de este dispositivo que no haya sido guardado en la nube antes."
    );
    if (!confirmed) return;

    setIsSyncing(true);
    const toastId = toast.loading("Descargando base de datos limpia de la nube...");
    try {
      await pullAllFromFirestoreToDexie(fbUser.uid);
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      localStorage.setItem("last_explicit_sync_time", `${nowStr} (Descarga)`);
      toast.success("Base de datos local re-establecida y descargada desde la nube con éxito.", { id: toastId });
      // Reload page to reflect updated local DB stores immediately
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error("No se pudo descargar la base de datos.", { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-100 shadow-sm overflow-hidden border-2 border-slate-100 bg-white">
        <CardHeader className="bg-slate-50 border-b border-slate-100 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2 text-slate-900 font-bold">
                <Cloud className="w-5 h-5 text-blue-600 animate-pulse" /> Sincronización en la Nube (Celular ⇄ PC)
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Garantiza que toda la información recolectada en tu celular se guarde en la nube y aparezca inmediatamente en tu computadora.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {isOnline ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" /> Dispositivo En Línea
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 animate-pulse">
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" /> Modo Fuera de Línea
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {isOfflineLocalUser ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-900 flex items-start gap-3">
              <span className="text-xl shrink-0">⚠️</span>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-amber-950">Usando una cuenta local sin conexión</h4>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Estás utilizando el sistema en modo local o temporal. Para que la información de tu teléfono móvil se sincronice con tu computadora de forma automática, debes <strong>Cerrar sesión</strong> e ingresar por medio de tu cuenta registrada en Google correo electrónico corporativo.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 text-slate-800 space-y-4">
              <div className="flex gap-3 items-start">
                <span className="text-2xl mt-0.5 shrink-0">🚀</span>
                <div className="space-y-1.5">
                  <h4 className="font-bold text-sm text-slate-900 animate-pulse">¿Por qué mis datos no aparecen en la computadora?</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Los navegadores guardan de forma temporal los datos de forma local para poder operar sin conexión en plantas industriales (dentro de sótanos o áreas sin red). Para sincronizar la información del celular con tu computadora en tiempo real:
                  </p>
                  <ol className="list-decimal pl-5 space-y-1.5 text-xs text-slate-600 mt-2 font-medium">
                    <li>Asegúrate de haber iniciado sesión con el <strong>mismo correo electrónico</strong> en ambos dispositivos (<span className="text-blue-700 bg-blue-100/50 px-1.5 py-0.5 rounded font-mono text-[10px]">{currentUser?.email}</span>).</li>
                    <li>Pulsa el botón de <strong>Sincronización Inteligente de Doble Vía</strong>. Esto subirá lo que cargaste en el teléfono y descargará cualquier cambio hecho en la computadora.</li>
                  </ol>
                </div>
              </div>

              {syncStats.lastSynced && (
                <div className="border-t border-blue-100/70 pt-3 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-slate-500 gap-2">
                  <span>Última sincronización manual: <strong className="text-slate-700">{syncStats.lastSynced}</strong></span>
                  {syncStats.pulled > 0 || syncStats.pushed > 0 ? (
                    <span className="text-[10px] bg-slate-100 text-slate-600 rounded px-2 py-0.5 font-mono">
                      ↑ {syncStats.pushed} subidos / ↓ {syncStats.pulled} descargados
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {!isOfflineLocalUser && fbUser && (
            <div className="space-y-4">
              <div className="p-4 border border-slate-100 bg-slate-50/70 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center md:text-left">
                  <h5 className="font-bold text-sm text-slate-900 flex items-center gap-1.5 justify-center md:justify-start">
                    <RefreshCw className={`w-4 h-4 text-blue-600 ${isSyncing ? "animate-spin" : ""}`} /> Sincronización Inteligente (Recomendado)
                  </h5>
                  <p className="text-xs text-slate-500 max-w-md">
                    Combina de forma segura toda la información de ambos dispositivos sin borrar lo que has avanzado en tu celular.
                  </p>
                </div>
                <Button 
                  onClick={handleFullSync}
                  disabled={isSyncing || !isOnline}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl shadow-xs transition-all w-full md:w-auto text-xs shrink-0"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Sincronizando...
                    </>
                  ) : (
                    "Sincronizar Celular y PC"
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-slate-100 rounded-2xl p-4 flex flex-col justify-between space-y-3 bg-white hover:bg-slate-50/20 transition-all">
                  <div className="space-y-1">
                    <h6 className="font-bold text-xs text-slate-800 flex items-center gap-1">
                      <ArrowUp className="w-3.5 h-3.5 text-slate-500" /> Respaldar Datos en la Nube
                    </h6>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Solo sube el contenido de este dispositivo al servidor de la base de datos sin descargar nada externo.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleOnlyPush}
                    disabled={isSyncing || !isOnline}
                    className="w-full text-slate-700 hover:text-slate-900 hover:bg-slate-100 text-xs py-2 rounded-xl"
                  >
                    Subir todo a la nube
                  </Button>
                </div>

                <div className="border border-slate-100 rounded-2xl p-4 flex flex-col justify-between space-y-3 bg-white hover:bg-slate-50/20 transition-all">
                  <div className="space-y-1">
                    <h6 className="font-bold text-xs text-red-800 flex items-center gap-1">
                      <ArrowDown className="w-3.5 h-3.5 text-red-500" /> Forzar Descarga Completa
                    </h6>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Borra la base de datos local y vuelve a descargar un duplicado limpio desde la nube. Útil si deseas limpiar el almacenamiento del celular.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={handleOnlyPull}
                    disabled={isSyncing || !isOnline}
                    className="w-full bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-950 text-xs py-2 rounded-xl"
                  >
                    Descargar todo de la nube
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tarjeta de Explicación de la Sincronización Inteligente de Doble Vía */}
      <Card className="border-blue-100 shadow-sm border bg-gradient-to-br from-blue-50/40 via-white to-blue-50/20 overflow-hidden rounded-3xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-md font-black text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" /> Sincronización Inteligente de Doble Vía (Doble Respaldo)
          </CardTitle>
          <p className="text-xs text-slate-500">
            Para garantizar que tu información esté siempre protegida, no se borre al actualizar la aplicación y esté disponible en tiempo real tanto en tu computadora como en tu teléfono móvil.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Columna 1 */}
            <div className="bg-white/95 border border-slate-100 rounded-2xl p-4 space-y-2 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Database className="w-4.5 h-4.5 text-blue-600" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">1. Base de Datos Central en la Nube</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Toda la información que registras (usuarios, empresas, avances de NOM-030 e informes) se guarda de manera centralizada en el servidor de Internet de la aplicación. Al estar alojada en la red, tu computadora y tu teléfono se conectan al mismo servidor, permitiéndoles compartir e integrar la misma información al instante.
              </p>
            </div>

            {/* Columna 2 */}
            <div className="bg-white/95 border border-slate-100 rounded-2xl p-4 space-y-2 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <ShieldCheck className="w-4.5 h-4.5 text-emerald-600" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">2. Respaldo Local Silencioso</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Al mismo tiempo, el navegador de tu computadora y de tu teléfono guardan de forma independiente un respaldo continuo con una copia exacta de los usuarios y las empresas en su propia memoria interna (IndexedDB). Esto asegura que puedas seguir consultando y editando incluso en sótanos u obras sin cobertura.
              </p>
            </div>

            {/* Columna 3 */}
            <div className="bg-white/95 border border-slate-100 rounded-2xl p-4 space-y-2 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center animate-pulse">
                <CloudLightning className="w-4.5 h-4.5 text-indigo-600" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">3. Auto-Restauración Inteligente</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Si al actualizar la aplicación o reiniciarse el sistema en la nube, la base de datos temporal del servidor del hosting se restableciera, el primer dispositivo de los dos (tu teléfono o tu PC) que abra la aplicación y detecte que el servidor está vacío, <strong>volverá a subir y restaurar automáticamente todos tus datos</strong> y avances desde su copia de respaldo local hacia la nube.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white border-2 border-white text-xs">
                <Smartphone className="w-3.5 h-3.5" />
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white border-2 border-white text-xs">
                <Laptop className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xs font-semibold text-slate-800">Tus datos están protegidos contra caídas y desincronizaciones.</p>
              <p className="text-[10px] text-slate-500">Ambos extremos de tu ecosistema NOM-030 operan bajo el mismo esquema de protección bidireccional permanente.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
