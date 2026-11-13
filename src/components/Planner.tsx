'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { inBbox } from '@/lib/geo';
import { formatDistance } from '@/lib/format';
import type { LatLon, Mode, Place, RouteResponse, SuggestItem, SuggestResponse } from '@/lib/types';
import DataSheet from './DataSheet';
import LocationField from './LocationField';
import Results from './Results';
import ThemeToggle from './ThemeToggle';
import Wordmark from './Wordmark';
import { useTheme } from '@/lib/useTheme';
import {
  ArrowIcon,
  ClockIcon,
  BusIcon,
  InfoIcon,
  LayersIcon,
  MetroIcon,
  RouteIcon,
  SwapIcon,
  TargetIcon,
} from './icons';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => <div className="map-pane" />,
});

type Status = 'idle' | 'loading' | 'ready' | 'error';
type Initial = { from: Place; to: Place; mode: Mode };

function placeFromParams(params: URLSearchParams, key: string, nameKey: string): Place | null {
  const raw = params.get(key);
  if (!raw) return null;
  const [lat, lon] = raw.split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const name = params.get(nameKey) || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  return {
    id: `url:${lat.toFixed(5)},${lon.toFixed(5)}`,
    name,
    kind: 'place',
    location: { lat, lon },
  };
}

function readUrl(): Initial | null {
  const params = new URLSearchParams(window.location.search);
  const from = placeFromParams(params, 'from', 'fn');
  const to = placeFromParams(params, 'to', 'tn');
  if (!from || !to) return null;
  const rawMode = params.get('mode');
  const mode: Mode = rawMode === 'metro' || rawMode === 'bus' ? rawMode : 'best';
  return { from, to, mode };
}

function writeUrl(from: Place, to: Place, mode: Mode) {
  const params = new URLSearchParams();
  params.set('from', `${from.location.lat.toFixed(5)},${from.location.lon.toFixed(5)}`);
  params.set('to', `${to.location.lat.toFixed(5)},${to.location.lon.toFixed(5)}`);
  params.set('fn', from.name);
  params.set('tn', to.name);
  params.set('mode', mode);
  window.history.pushState({}, '', `/plan?${params.toString()}`);
}

function asPlace(item: SuggestItem): Place {
  return {
    id: item.id,
    name: item.name,
    subtitle: item.subtitle,
    kind: item.kind,
    location: item.location,
  };
}

export type PlannerFacts = { metroLines: number; metroStations: number; busStops: number };

export default function Planner({ facts }: { facts: PlannerFacts }) {
  const { theme, toggle } = useTheme();
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [mode, setMode] = useState<Mode>('best');
  const [status, setStatus] = useState<Status>('idle');
  const [response, setResponse] = useState<RouteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [selectedLeg, setSelectedLeg] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const booted = useRef(false);

  async function execute(nextFrom: Place, nextTo: Place, nextMode: Mode, push = true) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    setError(null);
    setMessage(null);
    setSelected(0);
    setSelectedLeg(null);
    try {
      const request = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: nextFrom, to: nextTo, mode: nextMode }),
        signal: controller.signal,
      });
      if (!request.ok) {
        const data = (await request.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? 'Route request failed');
      }
      const data = (await request.json()) as RouteResponse;
      if (controller.signal.aborted) return;
      setResponse(data);
      setStatus('ready');
      if (push) writeUrl(nextFrom, nextTo, nextMode);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(
        caught instanceof Error && caught.message !== 'Route request failed'
          ? caught.message
          : 'The planner could not calculate this route. Check your connection and try again.',
      );
      setStatus('error');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  async function resolveText(text: string, bias?: LatLon): Promise<Place | null> {
    const query = text.trim();
    if (query.length < 2) return null;
    const params = new URLSearchParams({ q: query });
    if (bias) {
      params.set('lat', String(bias.lat));
      params.set('lon', String(bias.lon));
    }
    try {
      const request = await fetch(`/api/suggest?${params.toString()}`);
      if (!request.ok) return null;
      const data = (await request.json()) as SuggestResponse;
      return data.items?.[0] ? asPlace(data.items[0]) : null;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const initial = readUrl();
    if (!initial) return;
    setFrom(initial.from);
    setTo(initial.to);
    setFromText(initial.from.name);
    setToText(initial.to.name);
    setMode(initial.mode);
    void execute(initial.from, initial.to, initial.mode, false);
  }, []);

  useEffect(() => {
    const onPop = () => {
      const initial = readUrl();
      if (!initial) {
        setStatus('idle');
        setResponse(null);
        return;
      }
      setFrom(initial.from);
      setTo(initial.to);
      setFromText(initial.from.name);
      setToText(initial.to.name);
      setMode(initial.mode);
      void execute(initial.from, initial.to, initial.mode, false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const resolvedFrom = from ?? (await resolveText(fromText, to?.location ?? undefined));
      if (!resolvedFrom) {
        setMessage('Choose a starting point from the list, or use your location.');
        return;
      }
      const resolvedTo = to ?? (await resolveText(toText, resolvedFrom.location));
      if (!resolvedTo) {
        setMessage('Choose a destination from the list.');
        return;
      }
      setFrom(resolvedFrom);
      setTo(resolvedTo);
      setFromText(resolvedFrom.name);
      setToText(resolvedTo.name);
      await execute(resolvedFrom, resolvedTo, mode);
    } finally {
      setSubmitting(false);
    }
  }

  function changeMode(next: Mode) {
    setMode(next);
    if (from && to) void execute(from, to, next);
  }

  function swap() {
    const nextFrom = to;
    const nextTo = from;
    setFrom(nextFrom);
    setTo(nextTo);
    setFromText(toText);
    setToText(fromText);
    setSwapped((value) => !value);
    if (nextFrom && nextTo) void execute(nextFrom, nextTo, mode);
  }

  function selectFrom(item: SuggestItem) {
    setFrom(asPlace(item));
    setFromText(item.name);
    setMessage(null);
  }

  function selectTo(item: SuggestItem) {
    setTo(asPlace(item));
    setToText(item.name);
    setMessage(null);
  }

  function useMyLocation() {
    setMessage(null);
    if (!('geolocation' in navigator)) {
      setMessage('This browser cannot share a location. Type a place instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const location = { lat: position.coords.latitude, lon: position.coords.longitude };
          if (!inBbox(location)) {
            setMessage('That location is outside Bengaluru. Type a place instead.');
            return;
          }
          let subtitle: string | undefined;
          try {
            const request = await fetch(`/api/reverse?lat=${location.lat}&lon=${location.lon}`);
            if (request.ok) {
              const data = (await request.json()) as { label?: string | null };
              subtitle = data.label ?? undefined;
            }
          } catch {
            subtitle = undefined;
          }
          if (position.coords.accuracy > 750) {
            subtitle = [subtitle, 'approximate position'].filter(Boolean).join(' · ');
          }
          const place: Place = {
            id: `geo:${location.lat.toFixed(5)},${location.lon.toFixed(5)}`,
            name: 'Current location',
            subtitle,
            kind: 'current_location',
            location,
          };
          setFrom(place);
          setFromText('Current location');
          if (to) void execute(place, to, mode);
        } finally {
          setLocating(false);
        }
      },
      (positionError) => {
        setLocating(false);
        setMessage(
          positionError.code === positionError.PERMISSION_DENIED
            ? 'Location permission was denied. Type a place instead.'
            : 'Your location could not be found. Type a place instead.',
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  const itinerary = response?.itineraries[selected] ?? response?.itineraries[0] ?? null;
  const legs = itinerary?.legs ?? [];
  const hasResults = status !== 'idle';

  return (
    <div className="planner-shell" data-results={hasResults}>
      <section className="planner-panel" aria-label="Trip planner">
        <header className="planner-top">
          <Link href="/" className="planner-brand" aria-label="Bengaluru Transit overview">
            <Wordmark compact />
          </Link>
          <div className="planner-top-actions">
            <ThemeToggle theme={theme} onToggle={toggle} />
            <button type="button" className="tool" onClick={() => setDataOpen(true)}>
              <LayersIcon size={16} />
              <span>Data</span>
            </button>
          </div>
        </header>

        <div className="planner-search">
          <div className="planner-search-head">
            <h1 className="planner-title">
              Plan a <em>journey</em>
            </h1>
            <span className="service-chip" title="Times come from published schedules, not live vehicles">
              <ClockIcon size={14} /> Scheduled times
            </span>
          </div>

          <form className="search-card" onSubmit={onSubmit} role="search" aria-label="Plan a trip">
            <div className="trip-fields">
              <LocationField
                id="from"
                label="From"
                placeholder="Station, stop or place"
                value={fromText}
                place={from}
                bias={to?.location}
                onChangeText={(text) => {
                  setFromText(text);
                  setFrom(null);
                }}
                onSelect={selectFrom}
              />
              <button
                type="button"
                className="swap-button"
                data-swapped={swapped}
                onClick={swap}
                aria-label="Swap start and destination"
              >
                <SwapIcon size={16} />
              </button>
              <LocationField
                id="to"
                label="To"
                placeholder="Where are you going?"
                value={toText}
                place={to}
                bias={from?.location}
                onChangeText={(text) => {
                  setToText(text);
                  setTo(null);
                }}
                onSelect={selectTo}
              />
            </div>

            <div className="modes" role="group" aria-label="Travel mode">
              {(
                [
                  ['best', 'Best', RouteIcon],
                  ['metro', 'Metro', MetroIcon],
                  ['bus', 'Bus', BusIcon],
                ] as const
              ).map(([value, label, ModeIcon]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => changeMode(value)}
                >
                  <ModeIcon size={15} />
                  {label}
                </button>
              ))}
            </div>

            <button type="submit" className="button button--primary search-submit" disabled={submitting || status === 'loading'}>
              {submitting || status === 'loading' ? (
                'Finding route'
              ) : (
                <>
                  Find route
                  <ArrowIcon size={16} />
                </>
              )}
            </button>

            {message ? (
              <div className="notice" role="status">
                <InfoIcon size={15} />
                <span>{message}</span>
              </div>
            ) : null}
          </form>

          {!from ? (
            <div className="geo-row">
              <p>Starting nearby?</p>
              <button type="button" className="geo-button" onClick={useMyLocation} disabled={locating}>
                <TargetIcon size={15} />
                {locating ? 'Locating' : 'Use my location'}
              </button>
            </div>
          ) : null}
        </div>

        {status === 'idle' ? (
          <div className="planner-empty">
            <p className="eyebrow">Ready when you are</p>
            <h2>Every line, one plan.</h2>
            <p>
              Choose a start and a destination. The map draws the route, and every step names the line, the stop and
              the walk.
            </p>
            <ul className="empty-facts">
              <li>
                <MetroIcon size={16} />
                <span>
                  <strong>{facts.metroLines} metro lines</strong>
                  {facts.metroStations.toLocaleString('en-IN')} stations in the feed
                </span>
              </li>
              <li>
                <BusIcon size={16} />
                <span>
                  <strong>{facts.busStops.toLocaleString('en-IN')} bus stops</strong>
                  BMTC routes across the city
                </span>
              </li>
              <li>
                <InfoIcon size={16} />
                <span>
                  <strong>Honest waits</strong>
                  Marked as published or estimated
                </span>
              </li>
            </ul>
          </div>
        ) : (
          <Results
            response={response}
            status={status}
            error={error}
            selected={selected}
            onSelect={setSelected}
            selectedLeg={selectedLeg}
            onSelectLeg={setSelectedLeg}
            onRetry={() => {
              if (from && to) void execute(from, to, mode);
            }}
          />
        )}

        <footer className="planner-footer">
          <p>
            BMRCL + BMTC community GTFS, ODbL. Map data from OpenStreetMap. Planned times, not live vehicles.
          </p>
          <button type="button" onClick={() => setDataOpen(true)}>
            Data and privacy
          </button>
        </footer>
      </section>

      <MapView legs={legs} selectedLeg={selectedLeg} theme={theme} />

      <DataSheet open={dataOpen} onClose={() => setDataOpen(false)} />

      <p className="sr-only" aria-live="polite">
        {status === 'loading'
          ? 'Finding routes'
          : status === 'ready' && itinerary
            ? `${response?.itineraries.length ?? 1} route options. ${itinerary.label}, ${itinerary.totalMinutes} minutes, ${formatDistance(itinerary.walkMeters)} of walking.`
            : status === 'ready'
              ? 'No route found for these points.'
              : status === 'error'
                ? 'The route request failed.'
                : ''}
      </p>
    </div>
  );
}
