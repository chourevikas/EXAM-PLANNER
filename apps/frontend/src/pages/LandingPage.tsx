import React, { useState } from 'react';
import { Navbar } from '../components/common/Navbar';
import { HeroSection } from '../components/landing/HeroSection';
import { WorkflowSection } from '../components/landing/WorkflowSection';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { WhySection } from '../components/landing/WhySection';
import { ExamsSection } from '../components/landing/ExamsSection';
import { StatsSection } from '../components/landing/StatsSection';
import { Testimonials } from '../components/landing/Testimonials';
import { CTASection } from '../components/landing/CTASection';
import { Footer } from '../components/common/Footer';
import { AuthModal, AuthMode } from '../components/auth/AuthModal';

export function LandingPage() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');

  const handleOpenLogin = () => {
    setAuthMode('login');
    setAuthModalOpen(true);
  };

  const handleOpenSignup = () => {
    setAuthMode('signup');
    setAuthModalOpen(true);
  };

  return (
    <div className="landing-page">
      <Navbar onLogin={handleOpenLogin} onSignup={handleOpenSignup} />
      <HeroSection onLogin={handleOpenLogin} onSignup={handleOpenSignup} />
      <WorkflowSection />
      <FeaturesSection />
      <WhySection />
      <ExamsSection />
      <StatsSection />
      <Testimonials />
      <CTASection onLogin={handleOpenLogin} onSignup={handleOpenSignup} />
      <Footer />

      <AuthModal
        isOpen={authModalOpen}
        mode={authMode}
        onClose={() => setAuthModalOpen(false)}
        onSwitchMode={(mode) => setAuthMode(mode)}
      />
    </div>
  );
}
