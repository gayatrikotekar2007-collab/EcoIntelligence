'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as maplibregl from 'maplibre-gl';
import { GeoJSONFeature } from '../lib/api';
import {
  MapPinIcon,
  ShieldCheckIcon,
  AlertCircleIcon,
  LayersIcon,
} from './Icons';

interface EnvironmentalMapProps {
  features: GeoJSONFeature[];
  selectedFeatureId?: number | null;
  onSelectFeature?: (feature: GeoJSONFeature | null) => void;
  initialCenter?: [number, number]; // [longitude, latitude]
  initialZoom?: number;
  height?: string;
  showControls?: boolean;
  interactive?: boolean;
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

function getCategoryColor(category: string): string {
  switch (category.toLowerCase()) {
    case 'water_pollution':
    case 'water pollution':
      return '#0284c7'; // blue-600
    case 'vegetation_loss':
    case 'vegetation':
      return '#059669'; // emerald-600
    case 'waste_accumulation':
    case 'waste':
      return '#d97706'; // amber-600
    case 'air_quality':
    case 'air pollution':
      return '#7c3aed'; // violet-600
    case 'soil_contamination':
    case 'soil':
      return '#b45309'; // amber-700
    default:
      return '#475569'; // slate-600
  }
}

export function EnvironmentalMap({
  features,
  selectedFeatureId,
  onSelectFeature,
  initialCenter = [0, 20],
  initialZoom = 2,
  height = '580px',
  showControls = true,
  interactive = true,
}: EnvironmentalMapProps) {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainer.current) return;
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: OSM_STYLE,
      center: initialCenter,
      zoom: initialZoom,
      interactive: interactive,
      attributionControl: { compact: true },
    });

    if (showControls) {
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: true, showZoom: true }),
        'top-right'
      );
      map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    }

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
  }, [interactive, showControls]);

  // Update Markers when features or map changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Remove existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (features.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();

    features.forEach((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      if (isNaN(lng) || isNaN(lat)) return;

      bounds.extend([lng, lat]);

      const isSelected = feature.properties.id === selectedFeatureId;
      const color = getCategoryColor(feature.properties.category);

      // Create Custom HTML Marker element
      const el = document.createElement('div');
      el.className = 'eco-map-marker cursor-pointer group';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.width = isSelected ? '34px' : '26px';
      el.style.height = isSelected ? '34px' : '26px';
      el.style.backgroundColor = color;
      el.style.borderRadius = '50%';
      el.style.border = isSelected ? '3px solid #ffffff' : '2px solid #ffffff';
      el.style.boxShadow = isSelected
        ? '0 0 0 3px rgba(16, 185, 129, 0.6), 0 4px 10px rgba(0,0,0,0.3)'
        : '0 2px 6px rgba(0,0,0,0.25)';
      el.style.transition = 'all 0.2s ease';

      // Inner pin icon
      el.innerHTML = `
        <svg width="${isSelected ? '16' : '13'}" height="${isSelected ? '16' : '13'}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onSelectFeature) {
          onSelectFeature(feature);
        }
      });

      // Add to map
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Auto-fit to data bounds if multiple features or initial load
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: 60,
        maxZoom: 13,
        duration: 800,
      });
    }
  }, [features, mapLoaded, selectedFeatureId, onSelectFeature]);

  // Center on Selected Feature if selected externally
  useEffect(() => {
    if (!mapRef.current || !selectedFeatureId) return;
    const target = features.find((f) => f.properties.id === selectedFeatureId);
    if (target) {
      mapRef.current.flyTo({
        center: target.geometry.coordinates,
        zoom: Math.max(mapRef.current.getZoom(), 11),
        duration: 800,
      });
    }
  }, [selectedFeatureId, features]);

  // User Geolocation Handler
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoNotice('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoNotice(null);
        if (mapRef.current) {
          mapRef.current.flyTo({
            center: [pos.coords.longitude, pos.coords.latitude],
            zoom: 12,
            duration: 1000,
          });
        }
      },
      (err) => {
        setGeoNotice(
          err.code === 1
            ? 'Location access was denied. You can still navigate the map manually.'
            : 'Unable to retrieve location.'
        );
      },
      { timeout: 8000 }
    );
  }, []);

  const handleResetView = useCallback(() => {
    if (!mapRef.current) return;
    if (features.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      features.forEach((f) => bounds.extend(f.geometry.coordinates));
      mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 800 });
    } else {
      mapRef.current.flyTo({ center: initialCenter, zoom: initialZoom, duration: 800 });
    }
  }, [features, initialCenter, initialZoom]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-slate-100">
      <div
        ref={mapContainer}
        style={{ width: '100%', height }}
        className="w-full relative"
      />

      {/* Floating Map Action Controls */}
      {showControls && (
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          <button
            onClick={handleLocateMe}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 backdrop-blur-xs px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            title="Locate me (Browser Geolocation)"
          >
            <MapPinIcon className="h-3.5 w-3.5 text-emerald-600" />
            <span>My Location</span>
          </button>

          <button
            onClick={handleResetView}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 backdrop-blur-xs px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            title="Reset Map Bounds"
          >
            <LayersIcon className="h-3.5 w-3.5 text-slate-500" />
            <span>Fit Bounds</span>
          </button>
        </div>
      )}

      {/* Geolocation Notification */}
      {geoNotice && (
        <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-10 rounded-xl border border-amber-200 bg-amber-50/95 p-3 text-xs text-amber-800 shadow-md flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="h-4 w-4 text-amber-600 shrink-0" />
            <span>{geoNotice}</span>
          </div>
          <button
            onClick={() => setGeoNotice(null)}
            className="text-amber-800 hover:text-amber-950 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
