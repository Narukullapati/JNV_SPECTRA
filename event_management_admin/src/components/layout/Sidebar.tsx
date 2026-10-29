import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Home, 
  Package, 
  ShoppingBag, 
  Calendar, 
  Settings, 
  FileText, 
  Layers,
  User,
  ChevronRight,
  ChevronLeft,
  LogOut,
  ClipboardCheck,
  Building2,
  Image,
  MessageSquare,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useLogout } from "@/api/auth";


type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

// Main navigation items
const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Services", href: "/services", icon: Package },
  { label: "Rentals", href: "/rentals", icon: ShoppingBag },
  { label: "Venues", href: "/venues", icon: Building2 },
  { label: "Orders", href: "/orders", icon: FileText },
  { label: "Events", href: "/events", icon: Calendar },
  { label: "Events Hosted", href: "/events-hosted", icon: ClipboardCheck },
  { label: "Content", href: "/content", icon: Layers },
  { label: "Sliders", href: "/sliders", icon: Layers },
  { label: "Gallery", href: "/gallery", icon: Image },
  { label: "Testimonials", href: "/testimonials", icon: MessageSquare },
  { label: "Profile", href: "/profile", icon: User },
];

// Mobile navigation items (limited to 5 most important items)
const mobileNavItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Services", href: "/services", icon: Package },
  { label: "Orders", href: "/orders", icon: FileText },
  { label: "Events", href: "/events", icon: Calendar },
  { label: "More", href: "#", icon: Menu },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const location = useLocation();
  const logout = useLogout();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
      }
    };

    // Initial check
    checkMobile();

    // Add event listener
    window.addEventListener('resize', checkMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Desktop Sidebar
  const DesktopSidebar = () => (
    <div className={cn(
      "flex-col border-r bg-sidebar h-screen transition-all duration-300 relative hidden md:flex",
      collapsed ? "w-[70px]" : "w-[250px]"
    )}>
      <div className="flex flex-col items-center p-4 pb-3 gap-0">
        <div className="flex items-center justify-between w-full">
          <div className={cn("flex items-center gap-2", collapsed && "hidden")}>
            <h1 className="font-semibold text-lg text-sidebar-foreground">Admin Panel</h1>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setCollapsed(!collapsed)}
            className="text-sidebar-foreground"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </Button>
        </div>
        {!collapsed && (
          <p className="text-xs text-sidebar-foreground/70">Event Management System</p>
        )}
      </div>
      
      <Separator />
      
      <div className="flex-1 overflow-auto py-2">
        <nav className="grid gap-1 px-2">
          {navItems.map((item) => (
            <Link 
              key={item.href}
              to={item.href} 
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
                location.pathname === item.href && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              )}
            >
              <item.icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>
      </div>
      
      <div className="p-4">
        <Button 
          variant="ghost" 
          size={collapsed ? "icon" : "default"} 
          className={cn("w-full text-sidebar-foreground", 
            collapsed ? "justify-center" : "justify-start"
          )}
          onClick={() => logout.mutate()}
        >
          <LogOut size={20} className="mr-2" />
          {!collapsed && "Logout"}
        </Button>
      </div>
    </div>
  );

  // Mobile Bottom Navigation
  const MobileNavigation = () => (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-sidebar border-t md:hidden z-50">
        <div className="flex justify-around items-center h-16">
          {mobileNavItems.map((item) => (
            <Link
              key={item.href}
              to={item.href === "#" ? location.pathname : item.href}
              onClick={() => item.href === "#" && setShowMobileMenu(!showMobileMenu)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full px-2 text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
                location.pathname === item.href && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
            >
              <item.icon size={20} />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Full screen menu for additional items */}
      {showMobileMenu && (
        <div className="fixed inset-0 bg-background z-50 md:hidden overflow-auto">
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Menu</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMobileMenu(false)}
              >
                <ChevronLeft size={24} />
              </Button>
            </div>
            <nav className="grid gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setShowMobileMenu(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-4 py-3 text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
                    location.pathname === item.href && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </Link>
              ))}
              <Button
                variant="ghost"
                className="flex items-center gap-3 w-full justify-start mt-4"
                onClick={() => {
                  setShowMobileMenu(false);
                  logout.mutate();
                }}
              >
                <LogOut size={20} />
                <span>Logout</span>
              </Button>
            </nav>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      <DesktopSidebar />
      <MobileNavigation />
    </>
  );
}
