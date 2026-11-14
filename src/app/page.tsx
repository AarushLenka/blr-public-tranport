import { examplePlan, networkFacts } from '@/lib/facts';
import Landing from './Landing';

export default function Page() {
  return <Landing facts={networkFacts()} example={examplePlan()} />;
}
