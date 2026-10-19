
// API configuration and base setup
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

// Base URL for API - would come from environment variables in a real app
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api/v1`
  : "https://api.jnvspectra.com/api/v1";

// API endpoints
export const ENDPOINTS = {
  rentals: "/rentals",
  events: "/event-planning",
  booking: "/booking",
  contact: "/contact/submit",
  venues: "/venues",
  eventService: "/services",
  testimonials: "/testimonials",
  gallery: "/galleries",
  sliders: "/slider-slides/name/hero_slider",
};

// Default request headers
export const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
};

// Timeout for requests (in milliseconds)
export const REQUEST_TIMEOUT = 30000;

// Error handler
export const handleApiError = (error: any) => {
  console.error("API Error:", error);

  // Check if it's a network error
  const isNetworkError =
    error?.message?.includes('Network Error') ||
    error?.message?.includes('Failed to fetch') ||
    error?.message?.includes('ERR_NETWORK') ||
    error?.message?.includes('ERR_INTERNET_DISCONNECTED') ||
    error?.code === 'NETWORK_ERROR' ||
    error?.name === 'TypeError' && error?.message?.includes('fetch');

  if (isNetworkError) {
    // Redirect to network error page for network-related errors
    window.location.href = '/network-error';
    return {
      error: 'Network error occurred',
      data: null,
    };
  }

  // Show toast notification with error message for other errors
  const errorMessage = error.message || "An unexpected error occurred";
  toast.error(errorMessage);

  // Return standardized error object
  return {
    error: errorMessage,
    data: null,
  };
};
