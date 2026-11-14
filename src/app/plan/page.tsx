import type { Metadata } from 'next';
import Planner from '@/components/Planner';
import { networkFacts } from '@/lib/facts';

export const metadata: Metadata = {
  title: 'Plan a journey',
  description:
    'Plan a Namma Metro and BMTC journey across Bengaluru, with alternatives, changes, walk times and a route map.',
};

export default function PlanPage() {
  const facts = networkFacts();
  return (
    <Planner
      facts={{ metroLines: facts.lines.length, metroStations: facts.metroStations, busStops: facts.busStops }}
    />
  );
}
