import { HeroSection } from '@app/components/landing/HeroSection';
import { RouterShim } from '../lib/RouterShim';

export default function Hero({ path }: { path: string }) {
  return (
    <RouterShim path={path}>
      <HeroSection />
    </RouterShim>
  );
}
