'use client';

import { useEffect, useRef, useState } from 'react';
import { CloseIcon } from './icons';
import type { DataSource, Network } from '@/lib/types';

type Meta = {
  sources: { metro: DataSource; bus: DataSource };
  generatedAt: string;
  counts: Network['meta'];
};

function serviceDateLabel(raw?: string): string {
  if (!raw || raw.length !== 8) return 'Loading';
  const date = new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00+05:30`);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function DataSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open || meta) return;
    let alive = true;
    fetch('/api/meta')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Meta | null) => {
        if (alive) setMeta(data);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [open, meta]);

  const generated = meta?.generatedAt
    ? new Date(meta.generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <dialog
      ref={dialogRef}
      className="data-dialog"
      aria-labelledby="data-title"
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="data-dialog-inner">
        <div className="data-head">
          <div>
            <p className="mono-label">Open data</p>
            <h2 id="data-title">Where this comes from</h2>
          </div>
          <button type="button" className="data-close" onClick={onClose} aria-label="Close data and privacy">
            <CloseIcon size={17} />
          </button>
        </div>

        <div className="data-section">
          <h3>Transit data</h3>
          <p>
            Schedules come from community GTFS feeds for Namma Metro (BMRCL) and BMTC buses, published under the Open
            Database License. Station and stop locations, line colours, and trip times are read from those files.
          </p>
          <dl className="data-meta">
            <dt>Metro feed</dt>
            <dd>{meta ? meta.sources.metro.feedVersion : 'Loading'}</dd>
            <dt>Bus feed</dt>
            <dd>{meta ? meta.sources.bus.feedVersion : 'Loading'}</dd>
            <dt>Index built</dt>
            <dd>{generated ?? 'Loading'}</dd>
            <dt>Stops in index</dt>
            <dd>{meta ? (meta.counts.metro.stops + meta.counts.bus.stops).toLocaleString('en-IN') : 'Loading'}</dd>
            <dt>Service date</dt>
            <dd>{meta ? serviceDateLabel(meta.counts.metro.serviceDate) : 'Loading'}</dd>
          </dl>
          <ul>
            <li>
              Metro times are approximated by the feed author from the official timetable. Bus times are interpolated
              between timepoints and can drift.
            </li>
            <li>Waits use half the published headway. Where a route has no reliable frequency, the planner uses 8 minutes and says the wait is an estimate.</li>
            <li>Bus paths are drawn stop to stop, not along roads. Walking distances use a straight line with a 1.25 detour factor.</li>
            <li>There is no live vehicle tracking. Times are planning estimates, not real-time arrivals.</li>
          </ul>
          <ul>
            <li>
              <a href="https://github.com/Vonter/bmrcl-gtfs" target="_blank" rel="noreferrer">
                BMRCL GTFS on GitHub
              </a>
            </li>
            <li>
              <a href="https://github.com/Vonter/bmtc-gtfs" target="_blank" rel="noreferrer">
                BMTC GTFS on GitHub
              </a>
            </li>
            <li>
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                Map data: OpenStreetMap contributors
              </a>
            </li>
          </ul>
        </div>

        <div className="data-section">
          <h3>Privacy</h3>
          <p>
            The planner does not ask for an account and sets no analytics or advertising cookies. Your five most
            recent places are kept in this browser so you can pick them again. Route requests carry only the two
            points and the mode, and are not logged with an identity. Location is used only when you choose to share
            it, and it is never stored on the server.
          </p>
          <p>
            Place search is sent to Photon, an OpenStreetMap geocoder. If the geocoder is unreachable, station and bus
            stop search still works from the local index.
          </p>
        </div>

        <div className="data-section">
          <h3>Map</h3>
          <p>
            Tiles come from OpenFreeMap and OpenStreetMap. The basemap follows the light or dark theme so the metro
            lines and walking links stay readable.
          </p>
        </div>
      </div>
    </dialog>
  );
}
