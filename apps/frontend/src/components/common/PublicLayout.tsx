import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

/**
 * Shared chrome for standalone public marketing pages (Plans, About Us, Contact Us).
 * Login/Signup route to the existing `/signin` & `/signup` entries, which mount
 * LandingPage with the auth modal pre-opened - there's no separate full-page
 * sign-in/sign-up screen in this app.
 */
export function PublicLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <Navbar onLogin={() => navigate('/signin')} onSignup={() => navigate('/signup')} />
      {children}
      <Footer />
    </div>
  );
}
