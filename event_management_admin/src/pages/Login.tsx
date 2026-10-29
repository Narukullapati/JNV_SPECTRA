import { useNavigate, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { useToast } from "@/hooks/use-toast";
import { useLogin, getToken } from "@/api/auth";
import { Calendar, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from '../assets/images/logo.png';


interface LoginData {
  email: string;
  password: string;
}

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const login = useLogin();
  const token = getToken();

  // If already authenticated, redirect to dashboard
  if (token) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (data: LoginData) => {
    try {
      await login.mutateAsync(data);
      navigate("/");
    } catch (error) {
      toast({
        title: "Error",
        description: "Invalid credentials",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(135deg,#fdf6e0_0%,#f6d87c_50%,#e0a422_100%)]">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-xl">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="relative">
              {/* Logo background with gradient */}
              <div className="absolute inset-0 bg-[linear-gradient(135deg,#e0a422,#b8841c)] rounded-full blur-xl opacity-20" />
              {/* Logo container */}
              <div className="relative rounded-2xl jnv-logo-zoom bg-[linear-gradient(135deg,#4b1248,#3d093d)] shadow-lg flex items-center justify-center px-4 py-3 border-2 border-[#e8c96a]">
                <img 
                  src={logo} 
                  alt="JNV Events Logo" 
                  className="h-32 w-auto object-contain jnv-logo-float"
                  onError={(e) => {
                    // Fallback to icon if logo fails to load
                    e.currentTarget.style.display = 'none';
                    const icon = document.createElement('div');
                    icon.className = 'w-16 h-16 flex items-center justify-center';
                    icon.innerHTML = '<svg class="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
                    e.currentTarget.parentNode?.appendChild(icon);
                  }}
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              JNV Event Management
            </h1>
            <p className="text-sm text-gray-500">
              Sign in to access the admin dashboard
            </p>
          </div>
        </div>
        
        <div className="mt-8">
          <LoginForm onSubmit={handleLogin} />
        </div>
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <div className="flex items-center justify-center space-x-2">
            <Lock className="h-4 w-4" />
            <span>Secure admin access only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
