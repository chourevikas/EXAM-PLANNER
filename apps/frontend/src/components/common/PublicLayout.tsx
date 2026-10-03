import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

/**
 * Shared public chrome for SPA pages visible to guests (e.g. a shared challenge link).
 * The marketing pages themselves live in apps/marketing; Login/Signup go to the
 * `/signin` & `/signup` AuthPage entries.
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
