'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import {
  TemporalSequenceItem,
  AdjacentComparison,
} from '../lib/api';
import {
  MapPinIcon,
  LayersIcon,
  CompareIcon,
  EyeIcon,
  AlertCircleIcon,
  CloseIcon,
} from './Icons';

interface TemporalTrajectoryMapProps {
  sequence: TemporalSequenceItem[];
  comparisons: AdjacentComparison[];
  imageUrls: Record<number, string>;
  selectedEvidenceId?: number | null;
  onSelectEvidence?: (id: number) => void;
  onOpenPairComparison: (
    beforeId: number,
    afterId: number,
    mode: 'split' | 'heatmap' | 'region'
  ) => void;
  onOpenEvidenceDetail?: (id: number) => void;
  height?: string;
}

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'osm-raster-tiles': {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: 'osm-raster-layer',
      type: 'raster',
      source: 'osm-raster-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

function createGeoJSONCircle(
  center: [number, number],
  radiusInMeters: number,
  points = 48
): [number, number][] {
  const [lng, lat] = center;
  const coords: [number, number][] = [];
  const km = radiusInMeters / 1000;
  const distanceX = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  const distanceY = km / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }
  coords.push(coords[0]);
  return coords;
}

export function TemporalTrajectoryMap({
  sequence,
  comparisons,
  imageUrls,
  selectedEvidenceId,
  onSelectEvidence,
  onOpenPairComparison,
  onOpenEvidenceDetail,
  height = '460px',
}: TemporalTrajectoryMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activePopupItem, setActivePopupItem] = useState<{
    item: TemporalSequenceItem;
    comparisonFromPrev?: AdjacentComparison | null;
  } | null>(null);

  // Items with valid coordinates
  const geoItems = React.useMemo(() => {
    return sequence.filter(
      (item) => typeof item.latitude === 'number' && typeof item.longitude === 'number'
    );
  }, [sequence]);

  // Initial map setup
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const firstGeo = geoItems[0];
    const initialCenter: [number, number] =
      firstGeo && typeof firstGeo.longitude === 'number' && typeof firstGeo.latitude === 'number'
        ? [firstGeo.longitude, firstGeo.latitude]
        : [0, 20];

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: OSM_STYLE,
      center: initialCenter,
      zoom: geoItems.length > 0 ? 14 : 2,
      attributionControl: { compact: true },
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true, showZoom: true }),
      'top-right'
    );
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      setMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update Trajectory Line, Accuracy Envelopes, and HTML Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Remove existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Safely remove existing layers and sources if present
    ['trajectory-line-glow', 'trajectory-line', 'accuracy-envelope-fill', 'accuracy-envelope-line'].forEach(
      (id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      }
    );
    ['trajectory-source', 'accuracy-source'].forEach((id) => {
      if (map.getSource(id)) map.removeSource(id);
    });

    if (geoItems.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    const coordinates: [number, number][] = [];

    // 1. Build Accuracy Envelopes (Step 7) GeoJSON features
    const accuracyFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = [];

    geoItems.forEach((item, index) => {
      const lng = item.longitude!;
      const lat = item.latitude!;
      coordinates.push([lng, lat]);
      bounds.extend([lng, lat]);

      // Only add accuracy envelope if accuracy is known and > 0
      if (item.location_accuracy && item.location_accuracy > 0) {
        const ring = createGeoJSONCircle([lng, lat], item.location_accuracy);
        accuracyFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [ring],
          },
          properties: {
            evidence_id: item.evidence_id,
            accuracy: item.location_accuracy,
            role: item.role,
          },
        });
      }

      // 2. Custom Marker Element
      const el = document.createElement('div');
      el.className = 'eco-trajectory-marker cursor-pointer transition-transform duration-200 hover:scale-110';
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.alignItems = 'center';

      const isBaseline = item.role === 'BASELINE';
      const isCurrent = item.role === 'CURRENT';
      const isSelected = selectedEvidenceId === item.evidence_id;

      const badgeBg = isBaseline ? '#4f46e5' : isCurrent ? '#059669' : '#d97706';

      el.innerHTML = `
        <div style="background-color: ${badgeBg}; color: white; font-weight: 700; font-size: 11px; padding: 2px 7px; border-radius: 9999px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); border: 2px solid white; display: flex; align-items: center; gap: 4px; ${isSelected ? 'outline: 3px solid #6366f1; outline-offset: 1px;' : ''}">
          <span>#${index + 1}</span>
          <span style="font-size: 9px; opacity: 0.9;">${item.role}</span>
        </div>
        <div style="width: 2px; height: 6px; background-color: ${badgeBg};"></div>
        <div style="width: 6px; height: 6px; border-radius: 50%; background-color: ${badgeBg}; border: 1px solid white;"></div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onSelectEvidence) onSelectEvidence(item.evidence_id);

        // Find comparison with previous capture if index > 0
        const prevComp =
          index > 0 && comparisons[index - 1]
            ? comparisons[index - 1]
            : null;

        setActivePopupItem({ item, comparisonFromPrev: prevComp });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Add Accuracy Envelope Layer (Step 7)
    if (accuracyFeatures.length > 0) {
      map.addSource('accuracy-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: accuracyFeatures,
        },
      });

      map.addLayer({
        id: 'accuracy-envelope-fill',
        type: 'fill',
        source: 'accuracy-source',
        paint: {
          'fill-color': '#6366f1',
          'fill-opacity': 0.15,
        },
      });

      map.addLayer({
        id: 'accuracy-envelope-line',
        type: 'line',
        source: 'accuracy-source',
        paint: {
          'line-color': '#4f46e5',
          'line-width': 1.5,
          'line-dasharray': [3, 2],
        },
      });
    }

    // Add Trajectory Line Layer (Step 6)
    if (coordinates.length >= 2) {
      map.addSource('trajectory-source', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: coordinates,
          },
        },
      });

      map.addLayer({
        id: 'trajectory-line-glow',
        type: 'line',
        source: 'trajectory-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#ffffff',
          'line-width': 6,
          'line-opacity': 0.8,
        },
      });

      map.addLayer({
        id: 'trajectory-line',
        type: 'line',
        source: 'trajectory-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#4f46e5',
          'line-width': 3,
          'line-dasharray': [2, 2],
        },
      });
    }

    // Auto-fit to data bounds
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: 50,
        maxZoom: 16,
        duration: 600,
      });
    }
  }, [geoItems, comparisons, mapLoaded, selectedEvidenceId, onSelectEvidence]);

  const handleResetBounds = useCallback(() => {
    if (!mapRef.current || geoItems.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    geoItems.forEach((i) => {
      if (typeof i.longitude === 'number' && typeof i.latitude === 'number') {
        bounds.extend([i.longitude, i.latitude]);
      }
    });
    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 16, duration: 600 });
    }
  }, [geoItems]);

  if (geoItems.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
        <MapPinIcon className="h-8 w-8 text-slate-400 mx-auto mb-2 opacity-60" />
        <p className="font-semibold text-slate-700">Geospatial Coordinates Unavailable</p>
        <p className="mt-1 max-w-md mx-auto text-slate-500">
          The selected evidence captures do not possess geographic coordinates. Attach GPS coordinates or an investigation location to view spatial trajectories.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-slate-100">
      {/* Map Container */}
      <div ref={mapContainer} style={{ width: '100%', height }} className="w-full relative" />

      {/* Floating Action Controls */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <button
          onClick={handleResetBounds}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 backdrop-blur-xs px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          title="Fit trajectory into view"
        >
          <LayersIcon className="h-3.5 w-3.5 text-slate-500" />
          <span>Fit Trajectory</span>
        </button>

        <span className="rounded-md bg-indigo-600/90 text-white px-2 py-0.5 text-[10px] font-bold shadow-xs">
          {geoItems.length} Captures Mapped
        </span>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2 rounded-xl bg-white/95 backdrop-blur-xs border border-slate-200/90 px-3 py-1.5 text-[10px] text-slate-700 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 inline-block"></span>
          <span className="font-medium">Baseline</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-600 inline-block"></span>
          <span className="font-medium">Intermediate</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 inline-block"></span>
          <span className="font-medium">Current</span>
        </div>
        <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
          <span className="h-2.5 w-2.5 rounded-full border border-dashed border-indigo-600 bg-indigo-100 inline-block"></span>
          <span className="text-slate-500">Uncertainty Envelope (± accuracy)</span>
        </div>
      </div>

      {/* Interactive Selected Marker Card / Popup */}
      {activePopupItem && (
        <div className="absolute top-3 right-3 z-20 max-w-xs w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-xl text-xs space-y-2.5 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5">
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white uppercase ${
                  activePopupItem.item.role === 'BASELINE'
                    ? 'bg-indigo-600'
                    : activePopupItem.item.role === 'CURRENT'
                    ? 'bg-emerald-600'
                    : 'bg-amber-600'
                }`}
              >
                #{activePopupItem.item.sequence_index + 1} {activePopupItem.item.role}
              </span>
              <span className="text-[11px] font-semibold text-slate-700">
                Evidence #{activePopupItem.item.evidence_id}
              </span>
            </div>
            <button
              onClick={() => setActivePopupItem(null)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Thumbnail preview */}
          {imageUrls[activePopupItem.item.evidence_id] && (
            <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-900 max-h-28 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrls[activePopupItem.item.evidence_id]}
                alt={activePopupItem.item.original_filename || 'Evidence capture'}
                className="max-h-28 w-auto object-contain"
              />
            </div>
          )}

          {/* Details */}
          <div className="space-y-1 text-[11px] text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Captured:</span>
              <span className="font-medium text-slate-800">
                {activePopupItem.item.captured_at
                  ? new Date(activePopupItem.item.captured_at).toLocaleString()
                  : 'Timestamp unavailable'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Coordinates:</span>
              <span className="font-mono text-slate-800">
                {activePopupItem.item.latitude?.toFixed(5)}, {activePopupItem.item.longitude?.toFixed(5)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Source:</span>
              <span className="font-semibold text-indigo-700">
                {activePopupItem.item.location_source || 'UNAVAILABLE'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Accuracy:</span>
              <span className="font-medium text-slate-800">
                {activePopupItem.item.location_accuracy !== null && activePopupItem.item.location_accuracy !== undefined
                  ? `Location accuracy: ±${activePopupItem.item.location_accuracy.toFixed(1)} m`
                  : 'Accuracy unknown'}
              </span>
            </div>
          </div>

          {/* Trajectory Distance and Comparison from Previous Capture */}
          {activePopupItem.comparisonFromPrev && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-2.5 text-[11px] space-y-1.5">
              <div className="font-bold text-indigo-900 flex items-center justify-between">
                <span>Offset from Previous Capture</span>
                {activePopupItem.comparisonFromPrev.distance_meters !== null && activePopupItem.comparisonFromPrev.distance_meters !== undefined && (
                  <span className="rounded-md bg-white border border-indigo-200 px-1.5 py-0.2 text-[10px] text-indigo-800">
                    {activePopupItem.comparisonFromPrev.distance_meters.toFixed(1)} m
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-indigo-800">
                <span>Spatial Consistency:</span>
                <span className="font-bold uppercase text-[10px]">
                  {activePopupItem.comparisonFromPrev.spatial_consistency || 'UNKNOWN'}
                </span>
              </div>
              <div className="flex items-center justify-between text-indigo-800">
                <span>Visual Difference:</span>
                <span className="font-bold">
                  {activePopupItem.comparisonFromPrev.changed_pixel_percentage.toFixed(1)}% changed
                </span>
              </div>
            </div>
          )}

          {/* Actions: Open Evidence and Explore Comparison */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
            {onOpenEvidenceDetail && (
              <button
                type="button"
                onClick={() => onOpenEvidenceDetail(activePopupItem.item.evidence_id)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-1"
              >
                <EyeIcon className="h-3 w-3 text-slate-500" />
                <span>Open Evidence</span>
              </button>
            )}

            {activePopupItem.comparisonFromPrev && (
              <button
                type="button"
                onClick={() =>
                  onOpenPairComparison(
                    activePopupItem.comparisonFromPrev!.before_evidence_id,
                    activePopupItem.comparisonFromPrev!.after_evidence_id,
                    'split'
                  )
                }
                className="flex-1 rounded-lg bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 transition flex items-center justify-center gap-1 shadow-2xs"
              >
                <CompareIcon className="h-3 w-3" />
                <span>Explore Comparison</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
