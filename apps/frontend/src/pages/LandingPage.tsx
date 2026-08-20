import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/common/Navbar';
import { HeroSection } from '../components/landing/HeroSection';
import { WorkflowSection } from '../components/landing/WorkflowSection';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { WhySection } from '../components/landing/WhySection';
import { StatsSection } from '../components/landing/StatsSection';
import { Testimonials } from '../components/landing/Testimonials';
import { CTASection } from '../components/landing/CTASection';
import { Footer } from '../components/common/Footer';
import { AuthModal, AuthMode } from '../components/auth/AuthModal';

interface LandingPageProps {
  initialAuthMode?: AuthMode | null;
}

export function LandingPage({ initialAuthMode }: LandingPageProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const getInitialOpen = () => {
    if (initialAuthMode) return true;
    const p = location.pathname;
    if (p === '/signin' || p === '/login' || p === '/signup' || p === '/register') return true;
    return false;
  };

  const getInitialMode = (): AuthMode => {
    if (initialAuthMode) return initialAuthMode;
    const p = location.pathname;
    if (p === '/signin' || p === '/login') return 'login';
    return 'signup';
  };

  const [authModalOpen, setAuthModalOpen] = useState(getInitialOpen());
  const [authMode, setAuthMode] = useState<AuthMode>(getInitialMode());

  useEffect(() => {
    const p = location.pathname;
    if (initialAuthMode) {
      setAuthMode(initialAuthMode);
      setAuthModalOpen(true);
    } else if (p === '/signin' || p === '/login') {
      setAuthMode('login');
      setAuthModalOpen(true);
    } else if (p === '/signup' || p === '/register') {
      setAuthMode('signup');
      setAuthModalOpen(true);
    }
  }, [location.pathname, initialAuthMode]);

  const handleOpenLogin = () => {
    setAuthMode('login');
    setAuthModalOpen(true);
  };

  const handleOpenSignup = () => {
    setAuthMode('signup');
    setAuthModalOpen(true);
  };

  const handleCloseModal = () => {
    setAuthModalOpen(false);
    const p = location.pathname;
    if (p === '/signin' || p === '/login' || p === '/signup' || p === '/register') {
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="landing-page">
      <Navbar onLogin={handleOpenLogin} onSignup={handleOpenSignup} />
      <HeroSection onLogin={handleOpenLogin} onSignup={handleOpenSignup} />
      <WorkflowSection />
      <FeaturesSection />
      <WhySection />
      <StatsSection />
      <Testimonials />
      <CTASection onLogin={handleOpenLogin} onSignup={handleOpenSignup} />
      <Footer />

      <AuthModal
        isOpen={authModalOpen}
        mode={authMode}
        onClose={handleCloseModal}
        onSwitchMode={(mode) => setAuthMode(mode)}
      />
    </div>
  );
}
