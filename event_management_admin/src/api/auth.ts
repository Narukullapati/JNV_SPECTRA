import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchApi, uploadFile } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface LoginFormValues {
  email: string;
  password: string;
}

interface ProfileFormValues {
  username: string;
  email: string;
}

// Session management utilities
const storeSession = (token: string, profile: any) => {
  // Remove any quotes and whitespace from token
  const cleanToken = token.replace(/^"|"$/g, "").trim();
  
  // Store token
  localStorage.setItem("token", cleanToken);
  localStorage.setItem("admin_session", "true");
  localStorage.setItem("profile", JSON.stringify(profile));
  
  // Store in HTTP-only cookie
  document.cookie = `token=${cleanToken}; path=/; secure; samesite=strict; max-age=86400`;
};

export const getToken = (): string | null => {
  // Try getting from localStorage first
  const localToken = localStorage.getItem("token");
  
  if (localToken) {
    // Remove any quotes and whitespace
    return localToken.replace(/^"|"$/g, "").trim();
  }
  
  // Fallback to cookie
  const cookieToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('token='));
    
  if (cookieToken) {
    const token = cookieToken.split('=')[1];
    return token.replace(/^"|"$/g, "").trim();
  }
  
  return null;
};

const clearSession = () => {
  // Clear all session data
  localStorage.removeItem("token");
  localStorage.removeItem("admin_session");
  localStorage.removeItem("profile");
  sessionStorage.clear(); // Clear session storage as well
  
  // Clear cookie
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  document.cookie.split(";").forEach((c) => {
    document.cookie = c
      .replace(/^ +/, "")
      .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
  });
};

// Login mutation
export const useLogin = () => {
  return useMutation({
    mutationFn: (data: LoginFormValues) => {
      return fetchApi("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      // Store session data
      storeSession(data.token, data.profile);
      
      toast({
        title: "Success",
        description: "Logged in successfully",
      });
    },
  });
};

// Get profile query
export const useProfile = () => {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchApi("/api/v1/auth/profile"),
  });
};

// Update profile mutation
export const useUpdateProfile = () => {
  return useMutation({
    mutationFn: (data: ProfileFormValues) => {
      return fetchApi("/api/v1/auth/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    },
  });
};

// Logout mutation
export const useLogout = () => {
  const navigate = useNavigate();
  
  return useMutation({
    mutationFn: async () => {
      try {
        const email = (JSON.parse(localStorage.getItem('user') || localStorage.getItem('jnv_user') || '{}')?.email) || '';
        fetchApi('/api/v1/audit-logs/logoff', { method: 'POST', body: JSON.stringify({ email }) }).catch(() => {});
      } catch {}
      // Clear all session data
      clearSession();
      
      // Return true to indicate success
      return Promise.resolve(true);
    },
    onSuccess: () => {
      // Show success message
      toast({
        title: "Success",
        description: "Logged out successfully",
      });
      
      // Force redirect to login page
      window.location.href = "/login";
    },
  });
};