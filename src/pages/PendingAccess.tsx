import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, LogOut } from "lucide-react";

export default function PendingAccess() {
  const { logout, hasRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If user somehow gets another role, maybe redirect them to home
    if (!hasRole("PENDING_USER") && hasRole("SUPER_ADMIN")) {
      navigate("/purchasing/requests");
    }
  }, [hasRole, navigate]);

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-zinc-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
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
              Access Pending
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-zinc-400 font-medium">
              Your account has been created successfully, but requires administrator approval for access.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-slate-600 dark:text-slate-400 pb-8">
            <p>Please contact your system administrator to assign the appropriate roles and permissions to your account.</p>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 justify-center pb-8 pt-4 border-t border-slate-100 dark:border-zinc-800/50 mt-2 bg-slate-50/50 dark:bg-zinc-950/30">
             <Button 
                variant="outline"
                className="w-full h-12 rounded-xl border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
