import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshPermissions } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const hasProcessedLogin = useRef(false);

  useEffect(() => {
    const handleSsoCallback = async () => {
      if (hasProcessedLogin.current) return;

      const error = searchParams.get("error");
      const status = searchParams.get("status");

      if (error === "account_not_found") {
        hasProcessedLogin.current = true;
        setTimeout(() => {
          toast.error("Account does not exist. Please contact your administrator to be added.");
        }, 100);
        navigate("/login", { replace: true });
        return;
      }

      if (error === "account_deactivated") {
        hasProcessedLogin.current = true;
        setTimeout(() => {
          toast.error("Your account is deactivated");
        }, 100);
        navigate("/login", { replace: true });
        return;
      }

      if (status === "success") {
        hasProcessedLogin.current = true;
        setIsLoading(true);
        try {
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("user");
          sessionStorage.removeItem("ms_id_token");
          const token = searchParams.get("token");
          if (token) {
            sessionStorage.setItem("token", token);
          }
          await refreshPermissions();
          toast.success("Successfully logged in");
          window.history.replaceState({}, document.title, window.location.pathname);
          navigate("/dashboard");
        } catch (error) {
          console.error("Failed to process SSO login", error);
          toast.error("Failed to process login");
        } finally {
          setIsLoading(false);
        }
      }

    };

    handleSsoCallback();
  }, [searchParams, navigate, refreshPermissions]);

  const handleLogin = () => {
    // Redirect to backend Microsoft SSO endpoint
    const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
    const baseUrl = rawBaseUrl.endsWith("/") ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
    window.location.href = `${baseUrl}/api/auth/microsoft/login`;
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-zinc-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-600/20 to-transparent dark:from-blue-900/20 pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-400/20 dark:bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
        <div className="flex justify-center mb-8">
          <div className="h-16 w-16 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl flex items-center justify-center border border-slate-200 dark:border-zinc-800">
            <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-500" />
          </div>
        </div>

        <Card className="border-slate-200/60 dark:border-zinc-800/60 shadow-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[24px] overflow-hidden">
          <CardHeader className="space-y-2 text-center pt-8 pb-6">
            <CardTitle className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              Welcome
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-zinc-400 font-medium">
              Sign in with your @zenatech.com account
            </CardDescription>
          </CardHeader>
                    <CardContent className="space-y-4">
            <Button
              onClick={handleLogin}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md hover:shadow-lg transition-all"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in with Microsoft"
              )}
            </Button>
          </CardContent>
          <CardFooter className="flex justify-center pb-8 pt-4 border-t border-slate-100 dark:border-zinc-800/50 mt-2 bg-slate-50/50 dark:bg-zinc-950/30">
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Having trouble?{" "}
              <a href="#" className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
                Contact your administrator
              </a>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
