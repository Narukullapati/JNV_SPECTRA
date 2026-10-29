import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
const LOGO_URL = "https://jnvspectra.com/jnvSpectraLogoBold.png";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background p-4 md:p-6">
        <div className="sticky top-0 z-10 flex justify-end pb-2">
          <div className="rounded-lg bg-[linear-gradient(135deg,#4b1248,#3d093d)] px-2.5 py-1.5 shadow-sm">
            <img src={LOGO_URL} alt="JNV Spectra" className="h-10 w-auto object-contain jnv-logo-flip" />
          </div>
        </div>
        <div className="max-w-full pb-20 md:pb-0">
          {children}
        </div>
      </main>
    </div>
  );
}
