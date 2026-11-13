'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import { BLR_CENTER } from '@/lib/geo';
import type { Leg } from '@/lib/types';
import type { Theme } from '@/lib/useTheme';
import { BusIcon, MetroIcon, WalkIcon } from './icons';

type Props = {
  legs: Leg[];
  selectedLeg: number | null;
  theme: Theme;
};

/* Basemap and overlay colours per theme. Line colours always come from the feed. */
const MAP_THEME: Record<Theme, { style: string; casing: string; walk: string }> = {
  light: { style: 'https://tiles.openfreemap.org/styles/positron', casing: '#f2f8f7', walk: '#47595f' },
  dark: { style: 'https://tiles.openfreemap.org/styles/dark', casing: '#0a2022', walk: '#a9c6c7' },
};

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

const EMPTY: FeatureCollection<LineString> = { type: 'FeatureCollection', features: [] };

/**
 * Some metro line colours (Yellow = #FFDF00) are too light to see on a pale basemap
 * when rendered at reduced opacity. We darken them for use as context lines by mixing
 * with black at 35%, so the hue is preserved but the value drops enough to be legible.
 */
function darkenForContext(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const factor = 0.65; // mix 65% original + 35% black
  const dr = Math.round(r * factor);
  const dg = Math.round(g * factor);
  const db = Math.round(b * factor);
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}

function legColour(leg: Leg): string {
  return leg.type === 'walk' ? '#47595f' : leg.line.colour;
}

function toFeature(leg: Leg, index: number): Feature<LineString> {
  return {
    type: 'Feature',
    properties: { leg: index, type: leg.type, colour: legColour(leg) },
    geometry: { type: 'LineString', coordinates: leg.geometry },
  };
}

function padding() {
  if (window.innerWidth < 1024) {
    return { top: 96, bottom: Math.min(Math.round(window.innerHeight * 0.55), 500), left: 36, right: 36 };
  }
  return { top: 64, bottom: 72, left: 56, right: 56 };
}

function markerElement(kind: 'start' | 'end' | 'stop' | 'change', colour?: string, title?: string, leg?: number) {
  const element = document.createElement('div');
  element.className = `map-marker map-marker--${kind}`;
  if (kind === 'start') element.textContent = 'A';
  if (kind === 'end') element.textContent = 'B';
  if (colour) {
    if (kind !== 'change') element.style.background = colour;
    if (kind === 'change' || kind === 'stop') element.style.borderColor = colour;
  }
  if (title) {
    element.title = title;
    element.setAttribute('aria-label', title);
    element.setAttribute('role', 'img');
  }
  if (leg !== undefined) element.dataset.leg = String(leg);
  return element;
}

export default function MapView({ legs, selectedLeg, theme }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const styleThemeRef = useRef<Theme>('light');
  const routeDataRef = useRef<FeatureCollection<LineString>>(EMPTY);
  const contextDataRef = useRef<FeatureCollection<LineString> | null>(null);
  const selectedLegRef = useRef<number | null>(selectedLeg);
  selectedLegRef.current = selectedLeg;

  useEffect(() => {
    if (!containerRef.current) return;
    // The bundler's worker URL is unreliable in production; this asset ships in /public.
    maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_THEME[currentTheme()].style,
      center: [BLR_CENTER.lon, BLR_CENTER.lat],
      zoom: 11.1,
      minZoom: 9,
      maxZoom: 17.5,
      maxBounds: [
        [77.0, 12.35],
        [78.25, 13.65],
      ],
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      renderWorldCopies: false,
    });
    mapRef.current = map;
    styleThemeRef.current = currentTheme();
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    const failTimer = window.setTimeout(() => {
      if (!map.loaded()) setFailed(true);
    }, 9000);

    const addContext = () => {
      const data = contextDataRef.current;
      if (!data || map.getSource('metro-context') || !map.getLayer('route-casing')) return;
      map.addSource('metro-context', { type: 'geojson', data });
      map.addLayer(
        {
          id: 'metro-context',
          type: 'line',
          source: 'metro-context',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ['get', 'colour'], 'line-width': 3, 'line-opacity': 0.55 },
        },
        'route-casing',
      );
    };

    // Runs on first load and again after every basemap swap, because setStyle drops custom layers.
    const install = () => {
      if (map.getSource('route')) return;
      const colours = MAP_THEME[styleThemeRef.current];
      map.addSource('route', { type: 'geojson', data: routeDataRef.current });
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': colours.casing, 'line-width': 9 },
      });
      map.addLayer({
        id: 'route-walk',
        type: 'line',
        source: 'route',
        filter: ['==', ['get', 'type'], 'walk'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': colours.walk, 'line-width': 3, 'line-dasharray': [1.4, 1.6] },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        filter: ['!=', ['get', 'type'], 'walk'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'colour'],
          'line-width': ['case', ['==', ['get', 'leg'], selectedLegRef.current ?? -1], 7.5, 5],
        },
      });
      addContext();
    };

    map.on('style.load', install);

    map.on('load', () => {
      window.clearTimeout(failTimer);
      setLoaded(true);
      setFailed(false);
      install();

      fetch('/api/network', { cache: 'no-cache' })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { lines?: { colour: string; coordinates: [number, number][] }[] } | null) => {
          if (!data?.lines?.length || !mapRef.current) return;
          const features: Feature<LineString>[] = data.lines.map((line) => ({
            type: 'Feature',
            // Darken light colours (e.g. Yellow #FFDF00) so they're visible at reduced opacity
            properties: { colour: darkenForContext(line.colour) },
            geometry: { type: 'LineString', coordinates: line.coordinates },
          }));
          contextDataRef.current = { type: 'FeatureCollection', features };
          addContext();
        })
        .catch(() => undefined);
    });

    return () => {
      window.clearTimeout(failTimer);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || styleThemeRef.current === theme) return;
    styleThemeRef.current = theme;
    map.setStyle(MAP_THEME[theme].style);
  }, [theme, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    // During a basemap swap the source is briefly gone; routeDataRef carries the data across.
    const setRoute = (data: FeatureCollection<LineString>) => {
      routeDataRef.current = data;
      (map.getSource('route') as GeoJSONSource | undefined)?.setData(data);
    };

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (!legs.length) {
      setRoute(EMPTY);
      map.easeTo({ center: [BLR_CENTER.lon, BLR_CENTER.lat], zoom: 11.1, duration: 0 });
      return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const features = legs.map(toFeature);

    const bounds = new maplibregl.LngLatBounds();
    for (const leg of legs) for (const coordinate of leg.geometry) bounds.extend(coordinate as [number, number]);
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: padding(), maxZoom: 15.5, duration: reduced ? 0 : 700 });
    }

    const addMarker = (lon: number, lat: number, kind: 'start' | 'end' | 'stop' | 'change', colour?: string, title?: string, legIndex?: number) => {
      const marker = new maplibregl.Marker({ element: markerElement(kind, colour, title, legIndex), anchor: 'center' })
        .setLngLat([lon, lat])
        .addTo(map);
      markersRef.current.push(marker);
    };

    const first = legs[0];
    const last = legs[legs.length - 1];
    const startPoint = first.type === 'walk' ? first.from : first.board;
    const endPoint = last.type === 'walk' ? last.to : last.alight;
    addMarker(startPoint.location.lon, startPoint.location.lat, 'start', undefined, 'Start point');
    addMarker(endPoint.location.lon, endPoint.location.lat, 'end', undefined, 'Destination');

    const seen = new Set<string>();
    legs.forEach((leg, index) => {
      if (leg.type === 'walk') return;
      const boardKey = `${leg.board.location.lat.toFixed(5)}:${leg.board.location.lon.toFixed(5)}`;
      if (!seen.has(boardKey)) {
        seen.add(boardKey);
        const isChange = index > 0;
        addMarker(
          leg.board.location.lon,
          leg.board.location.lat,
          isChange ? 'change' : 'stop',
          leg.line.colour,
          `${isChange ? 'Change at' : 'Board at'} ${leg.board.name} (${leg.line.name})`,
          index,
        );
      }
      const alightKey = `${leg.alight.location.lat.toFixed(5)}:${leg.alight.location.lon.toFixed(5)}`;
      if (!seen.has(alightKey)) {
        seen.add(alightKey);
        addMarker(leg.alight.location.lon, leg.alight.location.lat, 'stop', leg.line.colour, `Get off at ${leg.alight.name}`, index);
      }
    });

    let timer = 0;
    if (reduced) {
      setRoute({ type: 'FeatureCollection', features });
    } else {
      let drawn = 0;
      const drawNext = () => {
        drawn += 1;
        setRoute({ type: 'FeatureCollection', features: features.slice(0, drawn) });
        if (drawn < features.length) timer = window.setTimeout(drawNext, 150);
      };
      drawNext();
    }

    return () => window.clearTimeout(timer);
  }, [legs, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    if (map.getLayer('route-line')) {
      map.setPaintProperty('route-line', 'line-width', [
        'case',
        ['==', ['get', 'leg'], selectedLeg ?? -1],
        7.5,
        5,
      ]);
    }
    if (selectedLeg !== null && legs[selectedLeg]) {
      const leg = legs[selectedLeg];
      const bounds = new maplibregl.LngLatBounds();
      for (const coordinate of leg.geometry) bounds.extend(coordinate as [number, number]);
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: { top: 110, bottom: 120, left: 60, right: 60 },
          maxZoom: 16,
          duration: 550,
        });
      }
    }
    const markers = containerRef.current?.parentElement?.querySelectorAll<HTMLElement>('[data-leg]');
    markers?.forEach((element) => {
      element.classList.toggle('map-marker--active', Number(element.dataset.leg) === selectedLeg);
    });
  }, [selectedLeg, loaded, legs]);

  const legend = new Map<string, { colour: string; label: string; type: 'metro' | 'bus' }>();
  for (const leg of legs) {
    if (leg.type === 'walk') continue;
    legend.set(leg.line.name, { colour: leg.line.colour, label: leg.line.name, type: leg.type });
  }
  const hasWalk = legs.some((leg) => leg.type === 'walk');

  return (
    <div className="map-pane" role="region" aria-label="Route map">
      <div className="map-canvas" ref={containerRef} />
      {failed ? (
        <div className="map-fallback" role="status">
          <p>
            The map could not load. The step by step list has the full route, including every station and bus stop.
          </p>
        </div>
      ) : null}
      {legs.length ? (
        <div className="legend" aria-label="Lines on this route">
          <p className="legend-title">On this route</p>
          <ul className="legend-list">
            {[...legend.values()].map((item) => (
              <li className="legend-item" key={item.label}>
                <span className="legend-swatch" style={{ background: item.colour }} aria-hidden="true" />
                {item.type === 'metro' ? <MetroIcon size={13} /> : <BusIcon size={13} />}
                {item.label}
              </li>
            ))}
            {hasWalk ? (
              <li className="legend-item">
                <span className="legend-swatch legend-swatch--walk" aria-hidden="true" />
                <WalkIcon size={13} />
                Walk
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
