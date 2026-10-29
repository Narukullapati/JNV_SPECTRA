import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Services from "./pages/Services";
import Orders from "./pages/Orders";
import AuditLogs from "@/pages/AuditLogs";
import Rentals from "./pages/Rentals";
import Events from "./pages/Events";
import EventsHosted from "./pages/EventsHosted";
import Sliders from "./pages/Sliders";
import StaticContent from "./pages/StaticContent";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Venues from "./pages/Venues";
import OrderConfirmation from "@/pages/OrderConfirmation";
import Gallery from './pages/Gallery';
import Testimonials from './pages/Testimonials';
import Checkout from './pages/Checkout';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          
          {/* Protected routes - page components already include DashboardLayout */}
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />
          <Route path="/rentals" element={<ProtectedRoute><Rentals /></ProtectedRoute>} />
          <Route path="/venues" element={<ProtectedRoute><Venues /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
          <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
          <Route path="/events-hosted" element={<ProtectedRoute><EventsHosted /></ProtectedRoute>} />
          <Route path="/sliders" element={<ProtectedRoute><Sliders /></ProtectedRoute>} />
          <Route path="/content" element={<ProtectedRoute><StaticContent /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/orders/:orderId" element={<OrderConfirmation />} />
          <Route path="/gallery" element={<ProtectedRoute><Gallery /></ProtectedRoute>} />
          <Route path="/testimonials" element={<ProtectedRoute><Testimonials /></ProtectedRoute>} />
          <Route path="/checkout/:orderId" element={<Checkout />} />
          
          {/* 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
