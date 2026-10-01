import { useEffect, useRef } from 'react';
import { apiClient } from '../services/apiClient';

export function useHeartbeat(isAuthenticated: boolean) {
  const lastActiveTimeRef = useRef<number>(0);

  useEffect(() => {
    lastActiveTimeRef.current = Date.now();
    if (!isAuthenticated) return;

    // Track user activity
    const updateActivity = () => {
      lastActiveTimeRef.current = Date.now();
    };

    // Listen for common activity events
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);

    // Send heartbeat every 60 seconds
    const interval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActiveTimeRef.current;
      
      // If the user has been completely inactive in the browser for more than 15 minutes,
      // stop sending heartbeats (the backend will log them out on the next request).
      // Otherwise, we send a heartbeat as long as they are active or have been active within 15 minutes.
      if (timeSinceLastActivity < 15 * 60 * 1000) {
        apiClient.post('/api/auth/heartbeat').catch(() => {
          // Ignore heartbeat errors (e.g., if they are already logged out)
        });
      }
    }, 60000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, [isAuthenticated]);
}
