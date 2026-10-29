
import { Search, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ThemePicker } from "@/components/layout/ThemePicker";
import logo from "@/assets/images/logo.png";

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-6">
      <div className="flex flex-1 items-center gap-4 md:gap-8">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-full pl-8 bg-background md:w-60 lg:w-80"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <ThemePicker />
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-red-500" />
        </Button>
        
        <Avatar className="h-8 w-8">
          <AvatarImage src="/placeholder.svg" alt="Avatar" />
          <AvatarFallback>AD</AvatarFallback>
        </Avatar>
        <div className="rounded-lg bg-[linear-gradient(135deg,#4b1248,#3d093d)] px-2.5 py-1.5 shadow-sm">
          <img src={logo} alt="JNV Spectra" className="h-10 w-auto object-contain" />
        </div>
      </div>
    </header>
  );
}
