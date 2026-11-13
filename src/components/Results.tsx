'use client';

import { useEffect, useRef, useState } from 'react';
import { arrivalClock, formatDistance } from '@/lib/format';
import type { Itinerary, Leg, RouteResponse } from '@/lib/types';
import { ArrowIcon, InfoIcon, WalkIcon } from './icons';

type Status = 'idle' | 'loading' | 'ready' | 'error';

type Props = {
  response: RouteResponse | null;
  status: Status;
  error: string | null;
  selected: number;
  onSelect: (index: number) => void;
  selectedLeg: number | null;
  onSelectLeg: (index: number | null) => void;
  onRetry: () => void;
};

function LineChip({ leg }: { leg: Extract<Leg, { type: 'metro' | 'bus' }> }) {
  return (
    <span className="line-chip" style={{ background: leg.line.colour, color: leg.line.textColour }}>
      {leg.line.name}
    </span>
  );
}

function RouteStrip({ legs }: { legs: Leg[] }) {
  return (
    <div className="strip" aria-label="Route at a glance">
      {legs.map((leg, index) => (
        <span className="strip-item" key={`${leg.type}-${index}`}>
          {index > 0 ? <span className="strip-sep" aria-hidden="true" /> : null}
          {leg.type === 'walk' ? (
            <>
              <WalkIcon size={13} />
              {leg.minutes} min
            </>
          ) : (
            <span
              className="line-chip"
              style={{ background: leg.line.colour, color: leg.line.textColour }}
              title={`${leg.line.name} towards ${leg.line.headsign}`}
            >
              {leg.line.name}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function WalkStep({ leg, transfer, last }: { leg: Extract<Leg, { type: 'walk' }>; transfer: boolean; last: boolean }) {
  return (
    <li className="step">
      <span className="step-dot step-dot--walk" aria-hidden="true" />
      <div className="step-walk">
        <WalkIcon size={16} />
        <p>
          <strong>{transfer ? 'Change: walk' : last ? 'Walk to your destination' : 'Walk'}</strong>
          {transfer ? ` to ${leg.to.name}` : last ? '' : ` to ${leg.to.name}`}
          <br />
          {leg.minutes} min · {formatDistance(leg.meters)} · straight line estimate
        </p>
      </div>
    </li>
  );
}

function TransitStep({
  leg,
  index,
  active,
  onSelectLeg,
}: {
  leg: Extract<Leg, { type: 'metro' | 'bus' }>;
  index: number;
  active: boolean;
  onSelectLeg: (index: number | null) => void;
}) {
  const intermediate = leg.stops.slice(1, -1);
  const stopCount = leg.stops.length - 1;
  return (
    <li className="step">
      <span className="step-dot" style={{ background: leg.line.colour }} aria-hidden="true" />
      <div className="step-head">
        <div className="step-line">
          <LineChip leg={leg} />
          <span>towards {leg.line.headsign}</span>
        </div>
        <button
          type="button"
          className="step-map"
          aria-pressed={active}
          onClick={() => onSelectLeg(active ? null : index)}
        >
          {active ? 'Showing' : 'Map'}
        </button>
      </div>
      <h3 className="step-title">
        Board at <span>{leg.board.name}</span>
      </h3>
      <p className="step-meta">
        {leg.minutes} min · {stopCount} {stopCount === 1 ? 'stop' : 'stops'} ·{' '}
        {leg.waitKnown ? `about ${leg.waitMinutes} min wait` : 'wait not published'}
      </p>
      <h3 className="step-title">
        Get off at <span>{leg.alight.name}</span>
      </h3>
      {intermediate.length > 0 ? (
        <details className="intermediate">
          <summary>
            {intermediate.length} {intermediate.length === 1 ? 'stop' : 'stops'} in between
          </summary>
          <ol>
            {intermediate.map((stop) => (
              <li key={stop.id}>{stop.name}</li>
            ))}
          </ol>
        </details>
      ) : null}
    </li>
  );
}

function Timeline({
  itinerary,
  selectedLeg,
  onSelectLeg,
}: {
  itinerary: Itinerary;
  selectedLeg: number | null;
  onSelectLeg: (index: number | null) => void;
}) {
  return (
    <ol className="timeline">
      {itinerary.legs.map((leg, index) => {
        const previous = itinerary.legs[index - 1];
        const next = itinerary.legs[index + 1];
        if (leg.type === 'walk') {
          return (
            <WalkStep
              key={`walk-${index}`}
              leg={leg}
              transfer={Boolean(previous && previous.type !== 'walk' && next && next.type !== 'walk')}
              last={!next}
            />
          );
        }
        return (
          <TransitStep
            key={`transit-${index}`}
            leg={leg}
            index={index}
            active={selectedLeg === index}
            onSelectLeg={onSelectLeg}
          />
        );
      })}
    </ol>
  );
}

export default function Results({
  response,
  status,
  error,
  selected,
  onSelect,
  selectedLeg,
  onSelectLeg,
  onRetry,
}: Props) {
  const itinerary = response?.itineraries[selected] ?? response?.itineraries[0] ?? null;
  const [sheetHeight, setSheetHeight] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null);

  useEffect(() => {
    if (!itinerary) return;
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setSheetHeight(Math.round(window.innerHeight * 0.46));
    } else {
      setSheetHeight(null);
    }
  }, [itinerary?.id]);

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    const startHeight = sheetHeight ?? Math.round(window.innerHeight * 0.46);
    dragRef.current = { startY: event.clientY, startHeight, moved: false };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = drag.startY - event.clientY;
    if (Math.abs(delta) > 4) drag.moved = true;
    const max = Math.round(window.innerHeight * 0.92);
    setSheetHeight(Math.min(Math.max(drag.startHeight + delta, 128), max));
  }

  function onPointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!drag) return;
    const current = sheetHeight ?? Math.round(window.innerHeight * 0.46);
    if (!drag.moved) {
      const expanded = current > window.innerHeight * 0.7;
      setSheetHeight(Math.round(window.innerHeight * (expanded ? 0.46 : 0.9)));
      return;
    }
    const stops = [0.24, 0.46, 0.9].map((ratio) => Math.round(window.innerHeight * ratio));
    const nearest = stops.reduce((best, value) => (Math.abs(value - current) < Math.abs(best - current) ? value : best), stops[0]);
    setSheetHeight(nearest);
  }

  const style = sheetHeight ? ({ '--sheet-h': `${sheetHeight}px` } as React.CSSProperties) : undefined;

  return (
    <aside className="results" style={style} data-dragging={dragging} aria-label="Route results">
      <button
        type="button"
        className="sheet-handle"
        aria-label="Expand or collapse route panel"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          const current = sheetHeight ?? Math.round(window.innerHeight * 0.46);
          const expanded = current > window.innerHeight * 0.7;
          setSheetHeight(Math.round(window.innerHeight * (expanded ? 0.46 : 0.9)));
        }}
      >
        <span aria-hidden="true" />
      </button>
      <div className="results-scroll">
        {status === 'loading' ? (
          <div className="result-loading" aria-busy="true" aria-label="Finding the best route">
            <div className="skeleton skeleton--short" />
            <div className="skeleton skeleton--time" />
            <div className="skeleton skeleton--line" />
            <div className="skeleton skeleton--line" />
            <div className="skeleton skeleton--row" />
            <div className="skeleton skeleton--row" />
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="state" role="alert">
            <p className="mono-label">Request failed</p>
            <h2>That route did not come through.</h2>
            <p>{error ?? 'Check your connection and try again.'}</p>
            <button type="button" className="button button--primary" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : null}

        {status === 'ready' && response && !itinerary ? (
          <div className="state" role="status">
            <p className="mono-label">No connection</p>
            <h2>No route found.</h2>
            <p>{response.notFound?.reason ?? 'These two points could not be connected.'}</p>
            {response.notFound?.suggestions.length ? (
              <ul>
                {response.notFound.suggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            ) : null}
            <button type="button" className="button button--primary" onClick={onRetry}>
              Try the search again
            </button>
          </div>
        ) : null}

        {status === 'ready' && itinerary ? (
          <>
            <div className="summary">
              <div className="summary-top">
                <span className="mono-label">{itinerary.label}</span>
                <span className="summary-arrive">Arrive {arrivalClock(itinerary.totalMinutes)}</span>
              </div>
              <p className="summary-time">
                <strong>{itinerary.totalMinutes}</strong>
                <span>min</span>
              </p>
              <p className="summary-facts">
                {itinerary.transfers === 0
                  ? 'No changes'
                  : `${itinerary.transfers} ${itinerary.transfers === 1 ? 'change' : 'changes'}`}{' '}
                · {formatDistance(itinerary.walkMeters)} walk
              </p>
              <RouteStrip legs={itinerary.legs} />
            </div>

            {response && response.itineraries.length > 1 ? (
              <div className="alts" role="group" aria-label="Alternative routes">
                {response.itineraries.map((option, index) => (
                  <button
                    key={`${option.id}-${index}`}
                    type="button"
                    className="alt"
                    aria-pressed={index === selected}
                    onClick={() => onSelect(index)}
                  >
                    <span className="alt-name">{option.label}</span>
                    <span className="alt-time">{option.totalMinutes} min</span>
                    <span className="alt-meta">
                      {option.transfers === 0 ? 'No changes' : `${option.transfers} change${option.transfers === 1 ? '' : 's'}`}
                      <br />
                      {formatDistance(option.walkMeters)} walk
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            <section className="steps-section" aria-label="Step by step">
              <div className="section-title">
                <span className="mono-label">Step by step</span>
                <span>
                  {itinerary.legs.filter((leg) => leg.type !== 'walk').length}{' '}
                  {itinerary.legs.filter((leg) => leg.type !== 'walk').length === 1 ? 'ride' : 'rides'}
                </span>
              </div>
              <Timeline itinerary={itinerary} selectedLeg={selectedLeg} onSelectLeg={onSelectLeg} />
            </section>

            {itinerary.warnings.length ? (
              <div className="warnings">
                {itinerary.warnings.map((warning) => (
                  <p className="warning" key={warning}>
                    <InfoIcon size={14} />
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}

            <ShareRow />
          </>
        ) : null}
      </div>
    </aside>
  );
}

function ShareRow() {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Bengaluru Transit route', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="share-row">
      <button type="button" className="share-button" onClick={share}>
        {copied ? 'Link copied' : 'Share this route'}
        <ArrowIcon size={14} />
      </button>
      <span className="share-note">Keeps both points</span>
    </div>
  );
}
