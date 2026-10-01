import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import GlobalLoadingScreen from "@/components/GlobalLoadingScreen";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "next-themes"
import { TooltipProvider } from "@/components/ui/tooltip"
import ErrorBoundary from "@/components/ErrorBoundary"
import { installGlobalErrorReporting } from "@/services/errorReporting"

installGlobalErrorReporting();

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data remains "fresh" for 5 minutes before checking for background updates
      staleTime: 1000 * 60 * 5, 
      retry: (failureCount, error: unknown) => {
        const status =
          typeof error === "object" && error !== null && "status" in error
            ? (error as { status?: unknown }).status
            : undefined;
        if (status === 401 || status === 403) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <App />
            <GlobalLoadingScreen />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
