import Link from 'next/link';
import ThemeSwitch from '@/components/ThemeSwitch';
import Wordmark from '@/components/Wordmark';
import { ArrowIcon, ArrowUpRightIcon, CheckIcon } from '@/components/icons';
import {
  ArrowDoodle,
  BusDoodle,
  CommuterDoodle,
  PlantDoodle,
  PlusDoodle,
  RouteDoodle,
  StarDoodle,
} from '@/components/illustrations';
import type { ExamplePlan, NetworkFacts } from '@/lib/facts';
import type { DataSource } from '@/lib/types';

const count = (value: number) => value.toLocaleString('en-IN');

function feedDate(version: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(version);
  if (!match) return version;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function SourceItem({ title, source }: { title: string; source: DataSource }) {
  return (
    <li>
      <h3>{title}</h3>
      <p>
        {source.name}. Feed version {feedDate(source.feedVersion)}, licence {source.licence}.
      </p>
      <a href={source.url} target="_blank" rel="noreferrer">
        View the feed on GitHub <ArrowUpRightIcon size={14} />
      </a>
    </li>
  );
}

export default function Landing({ facts, example }: { facts: NetworkFacts; example: ExamplePlan | null }) {
  const lineCount = facts.lines.length;

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="site-nav-wrap">
        <header className="site-nav">
          <Link href="/" className="wordmark-link" aria-label="Bengaluru Transit home">
            <Wordmark />
          </Link>
          <nav className="site-nav-links" aria-label="Sections">
            <a href="#how">How it works</a>
            <a href="#data">Data</a>
          </nav>
          <div className="site-nav-actions">
            <ThemeSwitch />
            <Link href="/plan" className="button button--secondary">
              <span className="nav-cta-long">Open planner</span>
              <span className="nav-cta-short">Planner</span>
            </Link>
          </div>
        </header>
      </div>

      <main id="main" className="page">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow" data-enter style={{ ['--i' as string]: 0 }}>
              Namma Metro + BMTC
            </p>
            <h1 id="hero-title" className="display" data-enter style={{ ['--i' as string]: 1 }}>
              Metro and bus, planned as <em>one journey.</em>
            </h1>
            <p className="lede" data-enter style={{ ['--i' as string]: 2 }}>
              Pick two points in Bengaluru. The planner joins metro lines, BMTC buses and the walks between them into a
              single route you can follow step by step.
            </p>
            <div className="hero-actions" data-enter style={{ ['--i' as string]: 3 }}>
              <Link href="/plan" className="button button--primary">
                Plan a journey <ArrowIcon size={16} />
              </Link>
              <a href="#how" className="button button--ghost">
                See how it works
              </a>
            </div>
            <ul className="checklist" data-enter style={{ ['--i' as string]: 4 }}>
              <li>
                <CheckIcon size={18} />
                Every step names the line, the stop and the walk
              </li>
              <li>
                <CheckIcon size={18} />
                Scheduled times, labelled as scheduled
              </li>
              <li>
                <CheckIcon size={18} />
                No account, no ads, no tracking cookies
              </li>
            </ul>
          </div>

          <div className="scene" data-enter style={{ ['--i' as string]: 2 }}>
            <StarDoodle className="scene-star" />
            <PlusDoodle className="scene-plus" />
            <div className="frame">
              <div className="frame-bar" aria-hidden="true">
                <i />
                <i />
                <i />
                <span>{example ? 'Example plan' : 'The network'}</span>
              </div>
              {example ? (
                <div className="frame-body">
                  <ul className="plan-ends">
                    <li>
                      <small>From</small>
                      {example.from}
                    </li>
                    <li>
                      <small>To</small>
                      {example.to}
                    </li>
                  </ul>
                  <p className="plan-total">
                    <strong>{example.minutes}</strong>
                    <span>
                      min, {example.transfers === 0 ? 'no changes' : `${example.transfers} ${example.transfers === 1 ? 'change' : 'changes'}`}
                    </span>
                  </p>
                  <div className="plan-rides">
                    {example.rides.map((ride, index) => (
                      <span key={`${ride.name}-${index}`} style={{ display: 'contents' }}>
                        <b className="plan-chip" style={{ background: ride.colour, color: ride.textColour }}>
                          {ride.name}
                        </b>
                        <span>
                          {ride.stops} {ride.stops === 1 ? 'stop' : 'stops'}
                        </span>
                      </span>
                    ))}
                  </div>
                  <p className="plan-source">
                    Worked out from the published metro schedule. Your times depend on when you travel.
                  </p>
                  <Link href={example.href} className="plan-link">
                    Open this route in the planner <ArrowIcon size={14} />
                  </Link>
                </div>
              ) : (
                <div className="frame-body">
                  <div className="line-tags">
                    {facts.lines.map((line) => (
                      <span className="line-tag" key={line.id}>
                        <i style={{ background: line.colour }} aria-hidden="true" />
                        {line.name}
                      </span>
                    ))}
                  </div>
                  <Link href="/plan" className="plan-link">
                    Open the planner <ArrowIcon size={14} />
                  </Link>
                </div>
              )}
            </div>
            <PlantDoodle className="scene-plant" />
            <CommuterDoodle className="scene-commuter" />
          </div>
        </section>

        <ul className="stat-strip" aria-label="What the planner covers">
          <li>
            {count(lineCount)} metro {lineCount === 1 ? 'line' : 'lines'}
          </li>
          <li>{count(facts.metroStations)} metro stations</li>
          <li>{count(facts.busStops)} bus stops</li>
          <li>Open data, {facts.sources.metro.licence}</li>
        </ul>

        <section className="section" id="how" aria-labelledby="how-title">
          <div className="section-head">
            <p className="eyebrow eyebrow--rose">How it works</p>
            <h2 id="how-title" className="heading">
              Three steps from <em>here to there.</em>
            </h2>
          </div>
          <div className="steps">
            <article className="card card--warm card--feature">
              <div className="card-copy">
                <p className="card-step">Step 1</p>
                <h3>Say where you are going</h3>
                <p>
                  Search for a metro station, a bus stop or any place in the city, or start from your current location.
                  Stations and stops are matched from the transit feeds themselves.
                </p>
              </div>
              <div className="card-art">
                <BusDoodle className="art-bus" />
                <ArrowDoodle className="art-arrow" />
              </div>
            </article>
            <article className="card">
              <p className="card-step">Step 2</p>
              <h3>Compare metro, bus or both</h3>
              <p>
                See the recommended route beside the alternatives, with total time, walking distance and the number of
                changes for each.
              </p>
            </article>
            <article className="card">
              <p className="card-step">Step 3</p>
              <h3>Follow it stop by stop</h3>
              <p>
                The map draws each leg in its line colour. The list tells you where to board, where to change and how
                far to walk.
              </p>
              <div className="card-art">
                <RouteDoodle className="art-route" />
              </div>
            </article>
          </div>
        </section>

        <section className="section" id="data" aria-labelledby="data-title">
          <div className="data-grid">
            <div className="data-copy">
              <p className="eyebrow">Data and honesty</p>
              <h2 id="data-title" className="heading">
                Scheduled times, <em>clearly labelled.</em>
              </h2>
              <p>
                Routes are built from community GTFS feeds for Namma Metro and BMTC. There is no live vehicle tracking,
                so every time is a planning estimate from the published schedule, and the planner says so wherever a
                wait is estimated.
              </p>
              <div className="line-tags" aria-label="Metro lines in the feed">
                {facts.lines.map((line) => (
                  <span className="line-tag" key={line.id}>
                    <i style={{ background: line.colour }} aria-hidden="true" />
                    {line.name}
                  </span>
                ))}
              </div>
            </div>
            <ul className="sources">
              <SourceItem title="Namma Metro schedules" source={facts.sources.metro} />
              <SourceItem title="BMTC bus schedules" source={facts.sources.bus} />
              <li>
                <h3>Map and place search</h3>
                <p>Map tiles from OpenFreeMap, map data from OpenStreetMap contributors, place search by Photon.</p>
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                  OpenStreetMap copyright <ArrowUpRightIcon size={14} />
                </a>
              </li>
            </ul>
          </div>
        </section>

        <section className="closing" aria-labelledby="closing-title">
          <PlantDoodle className="closing-plant" />
          <StarDoodle className="closing-star" />
          <h2 id="closing-title" className="heading">
            Where to <em>next?</em>
          </h2>
          <p className="lede">Two points are enough to get a route.</p>
          <Link href="/plan" className="button button--primary">
            Plan a journey <ArrowIcon size={16} />
          </Link>
        </section>

        <footer className="site-footer">
          <div>
            <Wordmark compact />
            <p>
              An independent planner, not affiliated with BMRCL or BMTC. Transit data from community GTFS feeds under{' '}
              {facts.sources.metro.licence}. Map data from OpenStreetMap contributors.
            </p>
          </div>
          <nav aria-label="Footer">
            <Link href="/plan">Planner</Link>
            <a href="#how">How it works</a>
            <a href="#data">Data</a>
          </nav>
        </footer>
      </main>
    </>
  );
}
