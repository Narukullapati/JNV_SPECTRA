import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { lazy, Suspense } from 'react';
import ScrollToTop from "./lib/utils";
import OfferBanner from "./components/layout/OfferBanner";
import PreloadResources from './components/SEO/PreloadResources';
import ErrorBoundary from './components/ErrorBoundary';
import { useNetworkStatus } from './hooks/useNetworkStatus';

// Lazy load components
const Index = lazy(() => import("./pages/Index"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const NetworkError = lazy(() => import("./pages/NetworkError"));
const AllServicesPage = lazy(() => import("./components/services/AllServicesPage"));
const IndividualEventPage = lazy(() => import("./components/individualServicePage/IndividualEventPage"));
const GalleryPage = lazy(() => import("./components/gallery/GalleryPage"));
const AllEventsPage = lazy(() => import("./components/services/AllEventsPage"));
const IndividualVenuePage = lazy(() => import("./components/individualServicePage/IndividualVenuePage"));
const IndividualEventServicePage = lazy(() => import("./components/individualServicePage/individualEventServicePage"));

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on network errors, redirect to network error page
        if (error?.message?.includes('Network Error') ||
          error?.message?.includes('Failed to fetch') ||
          error?.code === 'NETWORK_ERROR') {
          window.location.href = '/network-error';
          return false;
        }
        // Retry other errors up to 2 times
        return failureCount < 2;
      },
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Don't retry on network errors, redirect to network error page
        if (error?.message?.includes('Network Error') ||
          error?.message?.includes('Failed to fetch') ||
          error?.code === 'NETWORK_ERROR') {
          window.location.href = '/network-error';
          return false;
        }
        // Retry other errors up to 1 time
        return failureCount < 1;
      },
    },
  },
});

const AppContent = () => {
  useNetworkStatus(); // Monitor network status

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <PreloadResources />
            <ScrollToTop />
            <OfferBanner />
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/rentals" element={<AllServicesPage />} />
                <Route path="/venues" element={<AllServicesPage />} />
                <Route path="/venues/:slug" element={<IndividualVenuePage />} />
                <Route path="/eventServices/:slug" element={<IndividualEventServicePage />} />
                <Route path="/events/:slug" element={<IndividualEventPage />} />
                <Route path="/gallery" element={<GalleryPage />} />
                <Route path="/events" element={<AllEventsPage />} />
                <Route path="/eventServices" element={<AllServicesPage />} />
                <Route path="/network-error" element={<NetworkError />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

const App = () => (
  <ErrorBoundary>
    <AppContent />
  </ErrorBoundary>
);

export default App;
