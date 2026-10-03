import { CTASection } from '@app/components/landing/CTASection';

export default function CTA() {
  return (
    <CTASection
      onSignup={() => window.location.assign('/signup')}
      onLogin={() => window.location.assign('/signin')}
    />
  );
}
