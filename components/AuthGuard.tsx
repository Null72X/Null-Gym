'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getCurrentUser, onAuthChange, initAuth, AppUser } from '@/lib/authService';

const PUBLIC_ROUTES = ['/login', '/auth/callback'];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(getCurrentUser());
  const [isChecking, setIsChecking] = useState<boolean>(true);

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route));

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const currentUser = await initAuth();
        if (isMounted) {
          setUser(currentUser);
          setIsChecking(false);
        }
      } catch (err) {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    }

    checkSession();

    const unsubscribe = onAuthChange((updatedUser) => {
      if (isMounted) {
        setUser(updatedUser);
        setIsChecking(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isChecking) return;

    if (!user && !isPublicRoute) {
      // User is not authenticated and trying to access protected route
      const nextParam = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${nextParam}`);
    } else if (user && (pathname === '/login' || pathname === '/auth/callback')) {
      // User is already authenticated and visits /login or /auth/callback
      if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        const nextUrl = searchParams.get('next') || '/';
        window.location.replace(nextUrl);
      } else {
        router.replace('/');
      }
    }
  }, [user, isChecking, pathname, isPublicRoute, router]);

  // While checking auth on protected routes, show branded splash screen with zero content flash
  if (isChecking && !isPublicRoute) {
    return (
      <div className="auth-splash-screen" role="status" aria-label="Loading Null Gym">
        <div className="auth-splash-logo">
          <span style={{ color: 'var(--accent-red)' }}>//</span>
          <span>NULL GYM</span>
        </div>
        <div className="auth-spinner" />
      </div>
    );
  }

  // If unauthenticated on a protected route, keep splash screen while redirect triggers
  if (!user && !isPublicRoute) {
    return (
      <div className="auth-splash-screen" role="status" aria-label="Redirecting to login">
        <div className="auth-splash-logo">
          <span style={{ color: 'var(--accent-red)' }}>//</span>
          <span>NULL GYM</span>
        </div>
        <div className="auth-spinner" />
      </div>
    );
  }

  // If authenticated or on public route, render content
  return <>{children}</>;
}
