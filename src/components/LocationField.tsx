'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { formatDistance } from '@/lib/format';
import type { LatLon, Place, SuggestItem } from '@/lib/types';
import { BusIcon, CloseIcon, MetroIcon, PinIcon, SearchIcon } from './icons';

type Props = {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  place: Place | null;
  bias?: LatLon;
  onChangeText: (text: string) => void;
  onSelect: (place: SuggestItem) => void;
};

const RECENTS_KEY = 'blr-recent-places';
const responseCache = new Map<string, SuggestItem[]>();

function readRecents(): SuggestItem[] {
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SuggestItem[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.location).slice(0, 5) : [];
  } catch {
    return [];
  }
}

function remember(item: SuggestItem) {
  try {
    const next = [item, ...readRecents().filter((entry) => entry.id !== item.id)].slice(0, 5);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // A browser with storage disabled still gets search; it just loses recents.
  }
}

function PlaceIcon({ item }: { item: SuggestItem }) {
  if (item.mode === 'metro') return <MetroIcon size={18} />;
  if (item.mode === 'bus') return <BusIcon size={18} />;
  return <PinIcon size={18} />;
}

function typeLabel(item: SuggestItem): string {
  if (item.mode === 'metro') return item.lines?.length ? item.lines.map((line) => `${line} Line`).join(' · ') : 'Metro station';
  if (item.mode === 'bus') return 'BMTC bus stop';
  return item.subtitle || 'Place';
}

function Highlight({ text, query }: { text: string; query: string }) {
  const token = query.trim().split(/\s+/)[0] ?? '';
  if (token.length < 2) return <>{text}</>;
  const at = text.toLocaleLowerCase().indexOf(token.toLocaleLowerCase());
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + token.length)}</mark>
      {text.slice(at + token.length)}
    </>
  );
}

export default function LocationField({
  id,
  label,
  placeholder,
  value,
  place,
  bias,
  onChangeText,
  onSelect,
}: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SuggestItem[]>([]);
  const [recents, setRecents] = useState<SuggestItem[]>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = value.trim();
  const settled = place !== null && value === place.name;
  const showRecents = open && query.length < 2 && recents.length > 0;
  const showResults = open && query.length >= 2 && !settled;
  const expanded = showRecents || showResults;
  const visibleItems = showRecents ? recents : items;

  useEffect(() => {
    if (!showResults) {
      setItems([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const key = `${query.toLocaleLowerCase()}|${bias ? `${bias.lat.toFixed(2)},${bias.lon.toFixed(2)}` : 'blr'}`;
    const cached = responseCache.get(key);
    if (cached) {
      setItems(cached);
      setOffline(false);
      setActive(cached.length ? 0 : -1);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query });
        if (bias) {
          params.set('lat', String(bias.lat));
          params.set('lon', String(bias.lon));
        }
        const response = await fetch(`/api/suggest?${params.toString()}`, { signal: controller.signal });
        const data = (await response.json()) as { items?: SuggestItem[]; geocoder?: string };
        if (controller.signal.aborted) return;
        const next = data.items ?? [];
        responseCache.set(key, next);
        setItems(next);
        setOffline(data.geocoder === 'unavailable');
        setActive(next.length ? 0 : -1);
      } catch {
        if (!controller.signal.aborted) {
          setItems([]);
          setOffline(true);
          setActive(-1);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 170);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, bias?.lat, bias?.lon, showResults, bias]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function choose(item: SuggestItem) {
    remember(item);
    setRecents(readRecents());
    onSelect(item);
    setOpen(false);
    setItems([]);
    setActive(-1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((current) => (visibleItems.length ? Math.min(current + 1, visibleItems.length - 1) : -1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter' && expanded && visibleItems.length) {
      event.preventDefault();
      choose(visibleItems[active >= 0 ? active : 0]);
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'Tab') setOpen(false);
  }

  const stops = visibleItems.filter((item) => item.source === 'stop' || item.mode);
  const places = visibleItems.filter((item) => !(item.source === 'stop' || item.mode));

  function renderGroup(group: SuggestItem[], startIndex: number) {
    if (!group.length) return null;
    return group.map((item, groupIndex) => {
      const index = startIndex + groupIndex;
      return (
        <button
          key={`${item.id}-${index}`}
          id={`${listId}-${index}`}
          type="button"
          role="option"
          aria-selected={index === active}
          className="combobox-option"
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => setActive(index)}
          onClick={() => choose(item)}
        >
          <span className={`combobox-icon combobox-icon--${item.mode ?? 'place'}`} aria-hidden="true">
            <PlaceIcon item={item} />
          </span>
          <span className="combobox-text">
            <span className="combobox-name">
              <Highlight text={item.name} query={showRecents ? '' : query} />
            </span>
            <span className="combobox-detail">
              {typeLabel(item)}
              {item.distanceMeters !== undefined ? ` · ${formatDistance(item.distanceMeters)} away` : ''}
            </span>
          </span>
          {item.source === 'geocoder' ? <span className="combobox-badge">Place</span> : null}
        </button>
      );
    });
  }

  return (
    <div className="field" ref={wrapperRef}>
      <span className="field-icon" aria-hidden="true">
        <SearchIcon size={18} />
      </span>
      <div className="field-body">
        <label htmlFor={id}>{label}</label>
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(event) => {
            onChangeText(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setRecents(readRecents());
          }}
          onKeyDown={onKeyDown}
        />
        {place?.subtitle || place?.kind === 'current_location' ? (
          <span className="field-sub">{place.subtitle ?? 'Using this device location'}</span>
        ) : null}
      </div>
      {value ? (
        <button
          type="button"
          className="field-clear"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => {
            onChangeText('');
            setOpen(false);
            inputRef.current?.focus();
          }}
        >
          <CloseIcon size={14} />
        </button>
      ) : null}

      {expanded ? (
        <div className="combobox" id={listId} role="listbox" aria-label={`${label} suggestions`}>
          {showRecents ? <p className="combobox-group">Recent</p> : null}
          {showRecents ? renderGroup(stops, 0) : null}
          {showRecents ? renderGroup(places, stops.length) : null}

          {showResults && stops.length ? <p className="combobox-group">Stations and stops</p> : null}
          {showResults ? renderGroup(stops, 0) : null}
          {showResults && places.length ? <p className="combobox-group">Places</p> : null}
          {showResults ? renderGroup(places, stops.length) : null}

          {showResults && loading && items.length === 0 ? (
            <div className="combobox-loading" aria-label="Searching">
              <span />
              <span />
              <span />
            </div>
          ) : null}
          {showResults && !loading && items.length === 0 ? (
            <div className="combobox-empty">
              <p>No match yet.</p>
              <span>Try an area, landmark, metro station or bus stop.</span>
            </div>
          ) : null}
          {showResults && offline ? (
            <p className="combobox-note">Place search is offline. Stations and bus stops still work.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
