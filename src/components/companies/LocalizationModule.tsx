import React, { useState, useEffect } from "react";
import { useAppStore } from "../../hooks/useAppStore";
import { db } from "../../lib/db";
import { useDexieQuery } from "../../hooks/useDexie";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Globe, MapPin, Compass, Navigation, ExternalLink, Upload, Trash2, Image as ImageIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { generateAccessibilityAnalysis } from "../../services/geminiService";
import { cn } from "../../lib/utils";

export function LocalizationModule() {
  const { currentCompanyId } = useAppStore();
  const company = useDexieQuery(
    () => currentCompanyId ? db.companies.get(currentCompanyId) : Promise.resolve(undefined),
    [currentCompanyId]
  );

  const [formData, setFormData] = useState({
    latitude: 0,
    longitude: 0,
    altitude: 0,
    accessibilityDescription: ""
  });
  const [sketch, setSketch] = useState<string | null>(null);
  const [isGeneratingIA, setIsGeneratingIA] = useState(false);

  useEffect(() => {
    if (company) {
      setFormData({
        latitude: company.latitude || 0,
        longitude: company.longitude || 0,
        altitude: company.altitude || 0,
        accessibilityDescription: company.accessibilityDescription || ""
      });
      setSketch(company.localizationSketch || null);
    }
  }, [company]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización");
      return;
    }

    toast.info("Obteniendo ubicación...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude || 0
        }));
        toast.success("Ubicación obtenida");
      },
      (error) => {
        toast.error("Error al obtener ubicación: " + error.message);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSave = async () => {
    if (!currentCompanyId) return;
    try {
      await db.companies.update(currentCompanyId, {
        ...formData,
        localizationSketch: sketch || undefined,
        updatedAt: new Date()
      });
      toast.success("Localización guardada correctamente");
    } catch (e) {
      toast.error("Error al guardar");
    }
  };

  const handleSketchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      toast.error("Formato PDF no soportado para croquis. Por favor sube una imagen (PNG, JPG o WEBP) para que se renderice correctamente en los reportes.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSketch(reader.result as string);
      toast.success("Croquis cargado temporalmente. No olvides guardar cambios.");
    };
    reader.readAsDataURL(file);
  };

  const handleAyudaIA = async () => {
    if (!company) return;
    setIsGeneratingIA(true);
    try {
      const text = await generateAccessibilityAnalysis(company);
      setFormData(prev => ({ ...prev, accessibilityDescription: text }));
      toast.success("Descripción generada por IA");
    } catch (e) {
      toast.error("Error al generar ayuda IA");
    } finally {
      setIsGeneratingIA(false);
    }
  };

  if (!currentCompanyId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
        <Globe className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-lg font-medium tracking-tight">Selecciona una empresa para gestionar su localización</p>
      </div>
    );
  }

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${formData.latitude},${formData.longitude}`;

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Macro y Micro Localización</h1>
          <p className="text-[10px] text-slate-500 font-medium">Define la ubicación geográfica exacta y accesos del centro de trabajo.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-2 h-8 text-[10px] uppercase font-bold" 
            onClick={getCurrentLocation}
          >
            <Navigation className="w-3.5 h-3.5" />
            Vía GPS
          </Button>
          <Button 
            size="sm" 
            className="bg-blue-600 hover:bg-blue-700 h-8 text-[10px] uppercase font-bold text-white shadow-sm" 
            onClick={handleSave}
          >
            Guardar Cambios
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-200 py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
              <Globe className="w-4 h-4 text-blue-600" />
              Coordenadas Geográficas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Latitud</Label>
                <div className="relative">
                  <Input 
                    type="number" 
                    step="0.000001"
                    className="pl-8 text-xs font-mono h-10"
                    value={formData.latitude}
                    onChange={(e) => setFormData({...formData, latitude: parseFloat(e.target.value) || 0})}
                  />
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Longitud</Label>
                <div className="relative">
                  <Input 
                    type="number" 
                    step="0.000001"
                    className="pl-8 text-xs font-mono h-10"
                    value={formData.longitude}
                    onChange={(e) => setFormData({...formData, longitude: parseFloat(e.target.value) || 0})}
                  />
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Altitud (m.s.n.m)</Label>
              <div className="relative">
                <Input 
                  type="number" 
                  step="0.1"
                  className="pl-8 text-xs font-mono h-10 w-full md:w-1/2"
                  value={formData.altitude}
                  onChange={(e) => setFormData({...formData, altitude: parseFloat(e.target.value) || 0})}
                />
                <Compass className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <Button 
                variant="outline" 
                className="w-full h-12 flex items-center justify-center gap-3 border-blue-100 bg-blue-50/30 hover:bg-blue-50 text-blue-700 font-bold uppercase text-xs tracking-widest transition-all"
                onClick={() => window.open(googleMapsUrl, '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
                Ver Ubicación Exacta en Google Maps
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="bg-slate-50 border-b border-slate-200 py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
              <Navigation className="w-4 h-4 text-blue-600" />
              Accesibilidad y Referencias
            </CardTitle>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-7 text-[10px] font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              onClick={handleAyudaIA}
              disabled={isGeneratingIA}
            >
              <Sparkles className={cn("w-3 h-3 mr-1", isGeneratingIA && "animate-spin")} /> {isGeneratingIA ? "Generando..." : "IA"}
            </Button>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col space-y-6">
            <div className="space-y-1.5 flex-1">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Descripción Detallada de Accesos</Label>
              <Textarea 
                placeholder="Describa las vías principales de acceso, colindancias (norte, sur, este, oeste) y puntos de referencia cercanos..."
                className="min-h-[120px] text-xs leading-relaxed resize-none"
                value={formData.accessibilityDescription}
                onChange={(e) => setFormData({...formData, accessibilityDescription: e.target.value})}
              />
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Croquis de Macro/Micro Localización</Label>
                {sketch && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-red-500 hover:text-red-600 p-0"
                    onClick={() => setSketch(null)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Eliminar
                  </Button>
                )}
              </div>
              
              <div className="relative border-2 border-dashed border-slate-200 rounded-xl overflow-hidden bg-slate-50 min-h-[150px] flex items-center justify-center group">
                {sketch ? (
                  <img src={sketch} alt="Croquis" className="max-w-full max-h-[200px] object-contain" />
                ) : (
                  <div className="text-center p-4">
                    <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-[10px] text-slate-400 font-medium tracking-tight">JPEG, PNG hasta 5MB</p>
                  </div>
                )}
                <input 
                  type="file" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  accept="image/*"
                  onChange={handleSketchUpload}
                />
                {!sketch && (
                  <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-colors pointer-events-none" />
                )}
              </div>
              <p className="text-[9px] text-slate-400 italic">Puedes subir una captura de Google Maps o un croquis dibujado.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

