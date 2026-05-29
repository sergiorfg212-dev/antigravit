import React, { useState, useRef, useEffect } from "react";
import L from "leaflet";
import { useAppStore } from "../../hooks/useAppStore";
import { db, SurroundingHazard } from "../../lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button, buttonVariants } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Radar, Plus, Trash2, Pencil, AlertTriangle, ShieldCheck, Info, Map as MapIcon, Upload, ImageIcon, Camera, Save, Sparkles, X, FileText, MapPin, AlertCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { generateSurroundingHazardsAnalysis, suggestSurroundingHazards } from "../../services/geminiService";

const TILE_LAYERS = {
  streets: {
    name: "Estándar / Calles",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; OpenStreetMap'
  },
  satellite: {
    name: "Aéreo / Satelital",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; Esri &mdash; World Imagery'
  },
  terrain: {
    name: "Aspecto Terreno",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: '&copy; OpenTopoMap'
  },
  civil: {
    name: "Asistencia Civil / HOT",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution: '&copy; OSM Humanitarian'
  },
  cyclosm: {
    name: "Infraestructura Urbana",
    url: "https://{s}.tile-cyclosm.openapi.map/cyclosm/{z}/{x}/{y}.png",
    attribution: '&copy; CyclOSM Map'
  }
};

const OVERLAYS = {
  railway: {
    name: "Líneas de Ferrocarril",
    url: "https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png",
    attribution: '&copy; OpenRailwayMap'
  },
  transit: {
    name: "Líneas de Tránsito / Metro",
    url: "https://tile.memomaps.de/tilegen/{z}/{x}/{y}.png",
    attribution: '&copy; ÖPNV-Karte'
  }
};

const HAZARD_TYPES = [
  "Infraestructura y Energía", 
  "Geológicos e Hidrometeorológicos", 
  "Antrópicos (Humanos)", 
  "Sociales"
];

const HAZARD_EXAMPLES: Record<string, string> = {
  "Infraestructura y Energía": "Postes de luz/teléfono en mal estado, torres de alta tensión, cables colgando, gasolineras, ductos de gas, plantas de almacenamiento.",
  "Geológicos e Hidrometeorológicos": "Cercanía a barrancas, zonas de deslaves, cauces de ríos, zonas inundables, fallas geológicas.",
  "Antrópicos (Humanos)": "Fábricas con materiales tóxicos, mercados, construcciones vecinas inestables o dañadas, vías de ferrocarril, alta concentración de tráfico.",
  "Sociales": "Zonas de alto índice delictivo que puedan obstaculizar la ayuda."
};

export function SurroundingHazardsModule() {
  const { currentCompanyId } = useAppStore();
  const [showAtlas, setShowAtlas] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isGeneratingIA, setIsGeneratingIA] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Estados para el visor alternativo de mapas y geolocalización resiliente de OpenStreetMap/Leaflet
  const [mapQuery, setMapQuery] = useState("");
  const [osmCoords, setOsmCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [mapInputVal, setMapInputVal] = useState("");

  // Controladores de Capas (Terreno, Satélite, Calles, Tráfico)
  const [selectedLayerType, setSelectedLayerType] = useState<"streets" | "satellite" | "terrain" | "civil" | "cyclosm">("streets");
  const [toggleOverlays, setToggleOverlays] = useState({
    railway: false,
    transit: false
  });

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerInstanceRef = useRef<L.Marker | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const railwayOverlayRef = useRef<L.TileLayer | null>(null);
  const transitOverlayRef = useRef<L.TileLayer | null>(null);

  const hazards = useLiveQuery(
    () => currentCompanyId ? db.surroundingHazards.where("companyId").equals(currentCompanyId).toArray() : Promise.resolve([]),
    [currentCompanyId, refreshTrigger]
  ) || [];

  // Immediate filtering for instant UI response
  const visibleHazards = hazards.filter(h => h.id && !deletedIds.has(h.id));
  const sortedHazards = [...visibleHazards].sort((a, b) => (a.id || 0) - (b.id || 0));

  const [formData, setFormData] = useState<{
    hazardType: string;
    source: string;
    distance: string;
    probability: number;
    impact: number;
    riskLevel: number;
    mitigationMeasures: string;
    evidenceUrls: string[];
  }>({
    hazardType: "Infraestructura y Energía",
    source: "",
    distance: "",
    probability: 1,
    impact: 1,
    riskLevel: 1,
    mitigationMeasures: "",
    evidenceUrls: []
  });

  const activeCompany = useLiveQuery(
    () => currentCompanyId ? db.companies.get(currentCompanyId) : Promise.resolve(null),
    [currentCompanyId]
  );

  const activeCompanyId = activeCompany?.id;
  const activeCompanyAddress = activeCompany?.address;
  const activeCompanyLat = activeCompany?.latitude;
  const activeCompanyLon = activeCompany?.longitude;

  React.useEffect(() => {
    if (activeCompanyId) {
      const address = activeCompanyAddress || "";
      setMapQuery(address);
      setMapInputVal(prev => prev ? prev : address);
      if (activeCompanyLat && activeCompanyLon) {
        setOsmCoords({ lat: activeCompanyLat, lon: activeCompanyLon });
      } else {
        setOsmCoords(null);
      }
    }
  }, [currentCompanyId, activeCompanyId, activeCompanyAddress, activeCompanyLat, activeCompanyLon]);

  // Inicialización de Leaflet e interactividad
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const startLat = osmCoords ? osmCoords.lat : 23.6345;
    const startLon = osmCoords ? osmCoords.lon : -102.5528;
    const startZoom = osmCoords ? 15 : 5;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [startLat, startLon],
        zoom: startZoom,
        zoomControl: false
      });
      L.control.zoom({ position: "topright" }).addTo(map);
      mapInstanceRef.current = map;

      // Click sobre el mapa para reposicionar pin
      map.on("click", async (e: L.LeafletMouseEvent) => {
        const { lat: clickLat, lng: clickLon } = e.latlng;
        setOsmCoords({ lat: clickLat, lon: clickLon });
        
        if (currentCompanyId) {
          await db.companies.update(currentCompanyId, {
            latitude: clickLat,
            longitude: clickLon,
            updatedAt: new Date()
          });
        }

        try {
          const revUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${clickLat}&lon=${clickLon}`;
          const response = await fetch(revUrl, {
            headers: {
              'Accept-Language': 'es',
              'User-Agent': 'ProteccionCivilManager/1.0'
            }
          });
          const item = await response.json();
          if (item && item.display_name) {
            setMapQuery(item.display_name);
            setMapInputVal(item.display_name);
            toast.success("Ubicación ajustada manualmente.");
          }
        } catch (err) {
          console.error(err);
        }
      });
    }

    const map = mapInstanceRef.current;

    // Cambiar capa base
    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
    }
    const tileSpec = TILE_LAYERS[selectedLayerType];
    const baseTile = L.tileLayer(tileSpec.url, {
      attribution: tileSpec.attribution,
      maxZoom: 19
    });
    baseTile.addTo(map);
    baseTileLayerRef.current = baseTile;

    // Colocar o reubicar marcador
    if (markerInstanceRef.current) {
      map.removeLayer(markerInstanceRef.current);
    }

    if (osmCoords) {
      const pinHtml = `
        <div class="relative flex items-center justify-center w-10 h-10">
          <div class="absolute w-8 h-8 rounded-full bg-red-500/30 animate-pulse"></div>
          <div class="relative w-8 h-8 rounded-full bg-red-600 border-2 border-white flex items-center justify-center shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
        </div>
      `;

      const pinIcon = L.divIcon({
        className: 'custom-div-icon',
        html: pinHtml,
        iconSize: [40, 40],
        iconAnchor: [20, 36]
      });

      const marker = L.marker([osmCoords.lat, osmCoords.lon], { icon: pinIcon, draggable: true });
      marker.addTo(map);
      markerInstanceRef.current = marker;

      marker.on("dragend", async (e: any) => {
        const nextLatLng = e.target.getLatLng();
        const nextLat = nextLatLng.lat;
        const nextLon = nextLatLng.lng;
        setOsmCoords({ lat: nextLat, lon: nextLon });

        if (currentCompanyId) {
          await db.companies.update(currentCompanyId, {
            latitude: nextLat,
            longitude: nextLon,
            updatedAt: new Date()
          });
        }

        try {
          const revUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${nextLat}&lon=${nextLon}`;
          const response = await fetch(revUrl, {
            headers: {
              'Accept-Language': 'es',
              'User-Agent': 'ProteccionCivilManager/1.0'
            }
          });
          const item = await response.json();
          if (item && item.display_name) {
            setMapQuery(item.display_name);
            setMapInputVal(item.display_name);
            toast.success("Coordenadas actualizadas por arrastre.");
          }
        } catch (err) {
          console.error(err);
        }
      });
    }

    return () => {};
  }, [selectedLayerType]);

  // Sincronizar coordenadas externas
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !osmCoords) return;
    map.setView([osmCoords.lat, osmCoords.lon], map.getZoom() < 12 ? 15 : map.getZoom());
  }, [osmCoords?.lat, osmCoords?.lon]);

  // Habilitar / Deshabilitar capas superpuestas
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (toggleOverlays.railway) {
      if (!railwayOverlayRef.current) {
        railwayOverlayRef.current = L.tileLayer(OVERLAYS.railway.url, {
          attribution: OVERLAYS.railway.attribution,
          maxZoom: 19
        });
      }
      railwayOverlayRef.current.addTo(map);
    } else {
      if (railwayOverlayRef.current && map.hasLayer(railwayOverlayRef.current)) {
        map.removeLayer(railwayOverlayRef.current);
      }
    }

    if (toggleOverlays.transit) {
      if (!transitOverlayRef.current) {
        transitOverlayRef.current = L.tileLayer(OVERLAYS.transit.url, {
          attribution: OVERLAYS.transit.attribution,
          maxZoom: 19
        });
      }
      transitOverlayRef.current.addTo(map);
    } else {
      if (transitOverlayRef.current && map.hasLayer(transitOverlayRef.current)) {
        map.removeLayer(transitOverlayRef.current);
      }
    }
  }, [toggleOverlays.railway, toggleOverlays.transit]);

  const handleSearchLocation = async (customQuery?: string) => {
    const query = customQuery || mapInputVal;
    if (!query.trim()) {
      toast.error("Por favor ingrese una dirección o ubicación para buscar.");
      return;
    }
    setIsSearchingMap(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'es',
          'User-Agent': 'ProteccionCivilManager/1.0'
        }
      });
      const data = await response.json();
      if (data && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        setOsmCoords({ lat, lon });
        setMapQuery(item.display_name);
        setMapInputVal(item.display_name);
        
        if (currentCompanyId) {
          await db.companies.update(currentCompanyId, {
            latitude: lat,
            longitude: lon,
            updatedAt: new Date()
          });
        }
        toast.success(`Ubicación localizada: ${item.display_name}`);
      } else {
        toast.error("No se pudo encontrar la ubicación especificada de forma automática.");
      }
    } catch (e) {
      console.error("Map search error:", e);
      toast.error("Error al conectar con el servicio de mapas.");
    } finally {
      setIsSearchingMap(false);
    }
  };

  const getOsmEmbedUrl = () => {
    if (!osmCoords) {
      return "https://www.openstreetmap.org/export/embed.html?bbox=-103.45%2C20.6%2C-103.25%2C20.75&layer=mapnik";
    }
    const delta = 0.005; 
    const minLon = osmCoords.lon - delta;
    const minLat = osmCoords.lat - delta;
    const maxLon = osmCoords.lon + delta;
    const maxLat = osmCoords.lat + delta;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${osmCoords.lat}%2C${osmCoords.lon}`;
  };

  const syncHazardsDescription = async (companyId: number) => {
    const list = await db.surroundingHazards.where("companyId").equals(companyId).toArray();
    const description = list.map(h => `• ${h.source} (${h.hazardType}): Riesgo ${getRiskLabel(h.riskLevel)} a ${h.distance}.`).join('\n');
    await db.companies.update(companyId, { 
      surroundingHazardsDescription: description,
      updatedAt: new Date()
    });
  };

  const handleAyudaIA = async () => {
    if (!activeCompany || !currentCompanyId) return;
    setIsGeneratingIA(true);
    try {
      // 1. Generate textual analysis
      const analysisResult = await generateSurroundingHazardsAnalysis(activeCompany);
      
      // 2. Generate specific hazard objects
      const suggestedItems = await suggestSurroundingHazards(activeCompany);
      
      // 3. Batch add suggested hazards to the database (excluding duplicates)
      const existingHazards = await db.surroundingHazards.where("companyId").equals(currentCompanyId).toArray();
      const existingSources = new Set(existingHazards.map(h => h.source.trim().toLowerCase()));

      let addedCount = 0;

      for (const item of suggestedItems) {
        const sourceText = (item.source || "").trim().toLowerCase();
        if (existingSources.has(sourceText)) continue; // Skip to prevent duplicate

        const riskLevel = calculateRisk(item.probability, item.impact);
        const newEntry: SurroundingHazard = {
          companyId: currentCompanyId,
          hazardType: item.hazardType || "Tecnológico/Industrial",
          source: (item.source || "").trim(),
          distance: item.distance || "Mediano plazo",
          probability: item.probability || 3,
          impact: item.impact || 3,
          riskLevel,
          mitigationMeasures: item.mitigationMeasures || "Mantener monitoreo constante",
          updatedAt: new Date(),
          evidenceUrls: []
        };
        
        await db.surroundingHazards.add(newEntry);
        addedCount++;
        
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (riskLevel >= 21) severity = 'critical';
        else if (riskLevel >= 13) severity = 'high';
        else if (riskLevel >= 6) severity = 'medium';

        await db.findings.add({
          companyId: currentCompanyId,
          diagnosisId: 0,
          title: `Peligro Externo (IA): ${newEntry.source}`,
          description: `Tipo: ${newEntry.hazardType}. Distancia: ${newEntry.distance}. Riesgo: ${riskLevel}. Provisto por análisis inteligente.`,
          correctiveAction: newEntry.mitigationMeasures,
          severity,
          priority: severity === 'critical' ? 'very_high' : severity === 'high' ? 'high' : severity === 'medium' ? 'medium' : 'low',
          status: 'pending',
          responsible: 'Responsable Seguridad',
          commitmentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          evidenceUrls: [],
          nomReference: ['NOM-030-STPS'],
          category: 'hazard',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // 4. Update company records
      await db.companies.update(currentCompanyId, {
        surroundingHazardsDescription: analysisResult,
        atlasRiesgosNotes: analysisResult,
        updatedAt: new Date()
      });

      await syncHazardsDescription(currentCompanyId);
      setRefreshTrigger(prev => prev + 1);

      if (addedCount > 0) {
        toast.success(`IA: Se han generado el análisis y ${addedCount} nuevos riesgos correctamente.`);
      } else {
        toast.info("IA: El análisis textual se actualizó. Todos los peligros sugeridos ya se encontraban registrados.");
      }
    } catch (e) {
      console.error("AI Generation error:", e);
      toast.error("Error al generar análisis completo con IA");
    } finally {
      setIsGeneratingIA(false);
    }
  };

  const calculateRisk = (prob: number, imp: number) => prob * imp;

  const handleSave = async (id?: number) => {
    if (!currentCompanyId) return;
    if (!formData.source?.trim()) {
      toast.error("La fuente del riesgo es obligatoria");
      return;
    }

    try {
      const riskLevel = calculateRisk(formData.probability, formData.impact);
      const newEntry: SurroundingHazard = {
        companyId: currentCompanyId,
        hazardType: formData.hazardType,
        source: formData.source.trim(),
        distance: formData.distance,
        probability: formData.probability,
        impact: formData.impact,
        riskLevel,
        mitigationMeasures: formData.mitigationMeasures,
        updatedAt: new Date(),
        evidenceUrls: formData.evidenceUrls
      };

      if (id || editingId) {
        const targetId = (id || editingId)!;
        const original = await db.surroundingHazards.get(targetId);
        await db.surroundingHazards.update(targetId, newEntry as any);
        
        if (original) {
          const relatedFindings = await db.findings
            .where("title")
            .equals(`Peligro Externo: ${original.source}`)
            .filter(f => f.category === 'hazard')
            .toArray();
          
          for (const f of relatedFindings) {
            if (f.id) {
              await db.findings.update(f.id, {
                title: `Peligro Externo: ${newEntry.source}`,
                description: `Tipo: ${newEntry.hazardType}. Distancia: ${newEntry.distance}. Riesgo: ${riskLevel}.`,
                correctiveAction: newEntry.mitigationMeasures,
                updatedAt: new Date()
              });
            }
          }
        }
      } else {
        const newId = await db.surroundingHazards.add(newEntry);
        
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (riskLevel >= 21) severity = 'critical';
        else if (riskLevel >= 13) severity = 'high';
        else if (riskLevel >= 6) severity = 'medium';

        await db.findings.add({
          companyId: currentCompanyId,
          diagnosisId: 0,
          title: `Peligro Externo: ${newEntry.source}`,
          description: `Tipo: ${newEntry.hazardType}. Distancia: ${newEntry.distance}. Riesgo: ${riskLevel}.`,
          correctiveAction: newEntry.mitigationMeasures,
          severity,
          priority: severity === 'critical' ? 'very_high' : severity === 'high' ? 'high' : severity === 'medium' ? 'medium' : 'low',
          status: 'pending',
          responsible: 'Responsable Seguridad',
          commitmentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          evidenceUrls: [],
          nomReference: ['NOM-030-STPS'],
          category: 'hazard',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      await syncHazardsDescription(currentCompanyId);
      toast.success("Registro guardado con éxito");
      setEditingId(null);
      setIsAdding(false);
      setRefreshTrigger(p => p + 1);
    } catch (e) {
      toast.error("Error al guardar registro");
    }
  };

  const handleEdit = (h: SurroundingHazard) => {
    setEditingId(h.id || null);
    setIsAdding(false);
    setFormData({
      hazardType: h.hazardType,
      source: h.source,
      distance: h.distance,
      probability: h.probability,
      impact: h.impact,
      riskLevel: h.riskLevel,
      mitigationMeasures: h.mitigationMeasures,
      evidenceUrls: h.evidenceUrls || []
    });
  };

  const handleDelete = async (id: number) => {
    // 1. Interceptar el ID y aplicar filtro inmediato en la interfaz (Optimistic UI)
    setDeletedIds(prev => new Set([...prev, id]));

    try {
      // 2. Ejecutar eliminación en la base de datos local (Persistencia)
      await db.surroundingHazards.delete(id);
      
      // Sincronización de descripción de la empresa
      if (currentCompanyId) {
        await syncHazardsDescription(currentCompanyId);
      }
      
      toast.success("Riesgo eliminado inmediatamente");
    } catch (e) {
      // 3. Reversión del estado local en caso de error de persistencia
      setDeletedIds(prev => {
        const rollback = new Set(prev);
        rollback.delete(id);
        return rollback;
      });
      console.error("Error de eliminación:", e);
      toast.error("No se pudo completar la eliminación en la base de datos");
    }
  };

  const updateMapNotes = async (val: string) => {
    if (!currentCompanyId) return;
    try {
      await db.companies.update(currentCompanyId, { atlasRiesgosNotes: val, updatedAt: new Date() });
      setRefreshTrigger(p => p + 1);
    } catch (e) { toast.error("Error al actualizar notas"); }
  };

  const getRiskColor = (level: number) => {
    if (level <= 5) return "bg-green-100 text-green-700";
    if (level <= 12) return "bg-yellow-100 text-yellow-700";
    if (level <= 20) return "bg-orange-100 text-orange-700";
    return "bg-red-100 text-red-700";
  };

  const getRiskLabel = (level: number) => {
    if (level <= 5) return "Bajo";
    if (level <= 12) return "Medio";
    if (level <= 20) return "Alto";
    return "Muy Alto";
  };

  const InlineForm = ({ onCancel, isNew = false }: { onCancel: () => void, isNew?: boolean }) => (
    <Card className="border-blue-300 shadow-md bg-blue-50/20 mb-4 animate-in fade-in duration-300">
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-slate-500">Tipo</Label>
            <select 
              className="w-full h-9 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-400"
              value={formData.hazardType}
              onChange={(e) => setFormData({...formData, hazardType: e.target.value})}
            >
              {HAZARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label className="text-[10px] uppercase font-bold text-slate-500">Fuente / Origen</Label>
            <Input 
              className="h-9 text-sm"
              placeholder="Nombre del peligro..."
              value={formData.source}
              onChange={(e) => setFormData({...formData, source: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-slate-500">Distancia</Label>
            <Input 
              className="h-9 text-sm"
              placeholder="Ej. 100m"
              value={formData.distance}
              onChange={(e) => setFormData({...formData, distance: e.target.value})}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-slate-500">Probabilidad (1-5)</Label>
            <Input 
              className="h-9"
              type="number" min="1" max="5"
              value={formData.probability}
              onChange={(e) => setFormData({...formData, probability: parseInt(e.target.value) || 1})}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-slate-500">Impacto (1-5)</Label>
            <Input 
              className="h-9"
              type="number" min="1" max="5"
              value={formData.impact}
              onChange={(e) => setFormData({...formData, impact: parseInt(e.target.value) || 1})}
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label className="text-[10px] uppercase font-bold text-slate-500">Mitigación</Label>
            <Input 
              className="h-9 text-sm"
              placeholder="Acciones preventivas..."
              value={formData.mitigationMeasures}
              onChange={(e) => setFormData({...formData, mitigationMeasures: e.target.value})}
            />
          </div>
        </div>
        <div className="flex justify-between items-center pt-2">
          <Badge className={getRiskColor(calculateRisk(formData.probability, formData.impact))}>
            Riesgo: {calculateRisk(formData.probability, formData.impact)}
          </Badge>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-slate-500 h-8">Cancelar</Button>
            <Button size="sm" onClick={() => handleSave()} className="bg-blue-600 hover:bg-blue-700 h-8 px-4">
              <Save className="w-3.5 h-3.5 mr-2" /> Guardar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!currentCompanyId) return <div className="p-20 text-center text-slate-400">Selecciona una empresa</div>;

  return (
    <div className="space-y-8 pb-20">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Análisis de Peligros Circundantes</h1>
          <p className="text-slate-500 text-sm">Entorno externo y análisis del Atlas Nacional de Riesgos.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleAyudaIA} 
            disabled={isGeneratingIA}
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold"
          >
            <Sparkles className={cn("w-4 h-4 mr-2", isGeneratingIA && "animate-spin")} />
            {isGeneratingIA ? "Generando..." : "Generar con IA"}
          </Button>
          <Button size="sm" onClick={() => {
            setIsAdding(true);
            setEditingId(null);
            setFormData({ hazardType: "Infraestructura y Energía", source: "", distance: "", probability: 1, impact: 1, riskLevel: 1, mitigationMeasures: "", evidenceUrls: [] });
          }} className="bg-blue-600">
            <Plus className="w-4 h-4 mr-2" /> Agregar Riesgo
          </Button>
        </div>
      </header>

      <div className="space-y-4">
        {isAdding && <InlineForm onCancel={() => setIsAdding(false)} isNew />}
        
        {sortedHazards.length === 0 && !isAdding && (
          <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Radar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No se han registrado peligros específicos.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {sortedHazards.map((h) => (
            <React.Fragment key={h.id}>
              {editingId === h.id ? (
                <InlineForm onCancel={() => setEditingId(null)} />
              ) : (
                <Card className="hover:shadow-md transition-all border-l-4" style={{ borderLeftColor: h.riskLevel > 20 ? '#ef4444' : h.riskLevel > 12 ? '#f97316' : h.riskLevel > 5 ? '#eab308' : '#22c55e' }}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[9px] uppercase font-bold py-0 h-4">{h.hazardType}</Badge>
                        <h3 className="font-bold text-slate-800 truncate">{h.source}</h3>
                        <span className="text-slate-400 text-xs italic">({h.distance})</span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">{h.mitigationMeasures || "Ver detalles..."}</p>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Status</p>
                        <Badge className={cn("text-[10px] font-bold h-5", getRiskColor(h.riskLevel))}>
                          {getRiskLabel(h.riskLevel)} ({h.riskLevel})
                        </Badge>
                      </div>
                      <div className="flex gap-1 border-l border-slate-100 pl-4">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => handleEdit(h)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => h.id && handleDelete(h.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <Card className="border-slate-200 overflow-hidden shadow-sm">
        <CardHeader className="bg-slate-900 py-3 flex flex-row items-center justify-between">
          <CardTitle className="text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <Radar className="w-4 h-4 text-red-500" />
            Atlas Nacional de Riesgos (CENAPRED) y Centro Cartográfico
          </CardTitle>
          <div className="flex gap-2">
            <a 
              href="https://www.atlasnacionalderiesgos.gob.mx/archivo/visor-capas.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "bg-red-600 hover:bg-red-700 text-white border-none font-bold text-[10px] uppercase h-7")}
            >
              Abrir Atlas Oficial ↗
            </a>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Panel de Ayuda y Enlaces Oficiales del Atlas */}
          <div className="lg:col-span-4 p-5 bg-slate-50 border-r border-slate-100 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex gap-2.5 items-start bg-blue-50 text-blue-900 p-3 rounded-lg border border-blue-100">
                <Info className="w-5 h-5 shrink-0 mt-0.5 text-blue-700" />
                <div className="text-xs space-y-1">
                  <p className="font-bold">Aviso de Compatibilidad</p>
                  <p className="text-blue-800 leading-relaxed">
                    Los servidores del Gobierno de México (<code className="bg-blue-100 px-1 py-0.5 rounded">.gob.mx</code>) bloquean la visualización del Atlas interactivo dentro de ventanas secundarias (iframes) por políticas de seguridad del navegador.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase">Enlaces Oficiales CENAPRED</h4>
                <div className="space-y-1.5 text-xs">
                  <a 
                    href="https://www.atlasnacionalderiesgos.gob.mx/archivo/visor-capas.html" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-2 text-blue-600 hover:underline hover:text-blue-800 font-medium"
                  >
                    <MapIcon className="w-3.5 h-3.5" /> Visor de Capas Multiamenazas
                  </a>
                  <a 
                    href="https://www.atlasnacionalderiesgos.gob.mx/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-2 text-blue-600 hover:underline hover:text-blue-800 font-medium"
                  >
                    <Radar className="w-3.5 h-3.5" /> Portal General del Atlas Nacional
                  </a>
                  <a 
                    href="https://cenapred.unam.mx/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-2 text-blue-600 hover:underline hover:text-blue-800 font-medium"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> Página Oficial de CENAPRED
                  </a>
                </div>
              </div>

              {/* Buscador de Mapa local */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-red-500" />
                  Buscador de Ubicación Integrado
                </h4>
                <div className="flex gap-1.5">
                  <Input 
                    placeholder="Calle, Ciudad, Código Postal..." 
                    value={mapInputVal} 
                    onChange={(e) => setMapInputVal(e.target.value)}
                    className="h-8 text-xs font-medium"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearchLocation();
                    }}
                  />
                  <Button 
                    size="sm" 
                    onClick={() => handleSearchLocation()} 
                    disabled={isSearchingMap} 
                    className="bg-blue-600 hover:bg-blue-700 h-8 shrink-0 px-2.5 text-xs"
                  >
                    {isSearchingMap ? "Buscando..." : "Buscar"}
                  </Button>
                </div>

                {osmCoords && (
                  <div className="bg-slate-100 p-2.5 rounded border border-slate-200 text-[11px] font-mono grid grid-cols-2 gap-2 text-slate-600">
                    <div>
                      <span className="text-slate-400 font-sans block text-[9px] uppercase font-bold leading-none mb-0.5">Latitud</span>
                      <span>{osmCoords.lat.toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans block text-[9px] uppercase font-bold leading-none mb-0.5">Longitud</span>
                      <span>{osmCoords.lon.toFixed(6)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Espacio para Notas o Hallazgos del Atlas de Riesgos */}
            <div className="pt-3 border-t border-slate-200">
              <Label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Notas y Minutas de Georreferencia</Label>
              <Textarea 
                placeholder="Escriba aquí los riesgos detectados en el área según el Atlas de Protección Civil..."
                className="text-xs h-28 resize-none bg-white font-medium"
                value={activeCompany?.atlasRiesgosNotes || ""}
                onChange={(e) => updateMapNotes(e.target.value)}
              />
              <span className="text-[9px] text-slate-400 mt-1 block italic-medium">Se almacena automáticamente en el expediente de la empresa.</span>
            </div>
          </div>

          {/* Visor Satelital y de Mapa Respaldo (OSM / Leaflet Interactivo) */}
          <div className="lg:col-span-8 bg-slate-100 relative min-h-[550px] flex flex-col">
            {/* Control de Capas y Superposiciones */}
            <div className="bg-slate-900 text-slate-100 p-2.5 border-b border-slate-800 flex flex-wrap gap-2.5 items-center justify-between z-10 relative">
              <div className="flex gap-1.5 items-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 mr-2 flex items-center gap-1.5">
                  <Radar className="w-3.5 h-3.5 text-blue-400 animate-pulse" /> Capa Base:
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {(Object.keys(TILE_LAYERS) as Array<keyof typeof TILE_LAYERS>).map((key) => (
                    <button
                      key={key}
                      onClick={() => setSelectedLayerType(key)}
                      className={cn(
                        "text-[10px] font-bold px-2 w-auto py-1 rounded transition-all cursor-pointer",
                        selectedLayerType === key 
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                      )}
                    >
                      {TILE_LAYERS[key].name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-400" /> Capas Especiales:
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setToggleOverlays(prev => ({ ...prev, railway: !prev.railway }))}
                    className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 transition-all cursor-pointer",
                      toggleOverlays.railway
                        ? "bg-orange-600 text-white shadow"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    )}
                  >
                    {toggleOverlays.railway ? <Eye className="w-3 h-3 text-white" /> : <EyeOff className="w-3 h-3" />}
                    Ferrocarril
                  </button>
                  <button
                    onClick={() => setToggleOverlays(prev => ({ ...prev, transit: !prev.transit }))}
                    className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 transition-all cursor-pointer",
                      toggleOverlays.transit
                        ? "bg-purple-600 text-white shadow"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    )}
                  >
                    {toggleOverlays.transit ? <Eye className="w-3 h-3 text-white" /> : <EyeOff className="w-3 h-3" />}
                    Tránsito / Metro
                  </button>
                </div>
              </div>
            </div>

            <div className="absolute top-16 left-3 z-10 flex flex-col gap-1.5 pointer-events-none">
              <span className="bg-slate-950/85 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded shadow-md flex items-center gap-1.5 w-fit">
                <MapIcon className="w-3.5 h-3.5 text-blue-400" />
                {osmCoords ? "Ubicación Geocodificada" : "Vista General de México"}
              </span>
              <span className="bg-blue-950/85 backdrop-blur-sm text-blue-100 text-[9px] font-medium px-2 py-0.5 rounded shadow-sm w-fit border border-blue-900/30">
                Arrastra el marcador o pulsa sobre el mapa para ajustar la ubicación
              </span>
            </div>

            {/* Contenedor del Mapa Leaflet */}
            <div 
              ref={mapContainerRef} 
              className="w-full h-full min-h-[500px] flex-1 base-map-container z-0" 
              style={{ minHeight: "500px" }}
            />

            {!osmCoords && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-6 text-white z-20">
                <MapPin className="w-12 h-12 text-red-500 mb-3 animate-bounce" />
                <h4 className="font-bold text-base mb-1">Geolocalización Inactiva</h4>
                <p className="text-slate-300 text-xs max-w-sm mb-4 leading-relaxed">
                  Ingrese la dirección física de su empresa en el buscador de la izquierda o verifique el perfil de la compañía para georreferenciarla automáticamente en el mapa interactivo.
                </p>
                <Button 
                  size="sm" 
                  onClick={() => handleSearchLocation()} 
                  disabled={isSearchingMap} 
                  className="bg-red-600 hover:bg-red-700 text-white font-bold h-9 px-5"
                >
                  Intentar Geolocalizar Dirección de Empresa
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
