import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LanguageProvider } from "@/hooks/useLanguage";
import Auth from "./pages/Auth";
import GroupsListPage from "./pages/groups/GroupsListPage";
import GroupDetailPage from "./pages/groups/GroupDetailPage";
import CreateGroup from "./pages/captain/CreateTeam";
import CreateTask from "./pages/captain/CreateTask";
import TaskDetail from "./pages/tasks/TaskDetail";
import TeamManagement from "./pages/captain/TeamManagement";
import ProfilePage from "./pages/profile/ProfilePage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading, isAdmin } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Auth */}
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      
      {/* Main: Groups List (WhatsApp-like home) */}
      <Route path="/" element={
        <ProtectedRoute>
          {isAdmin ? <Navigate to="/admin" replace /> : <GroupsListPage />}
        </ProtectedRoute>
      } />
      
      {/* Group Routes */}
      <Route path="/groups/create" element={<ProtectedRoute><CreateGroup /></ProtectedRoute>} />
      <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDetailPage /></ProtectedRoute>} />
      <Route path="/groups/:groupId/create-task" element={<ProtectedRoute><CreateTask /></ProtectedRoute>} />
      <Route path="/groups/:groupId/tasks/:taskId" element={<ProtectedRoute><TaskDetail /></ProtectedRoute>} />
      <Route path="/groups/:groupId/settings" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
      
      {/* Profile */}
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      
      {/* Admin */}
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      
      {/* Legacy redirects */}
      <Route path="/team" element={<Navigate to="/" replace />} />
      <Route path="/team/create" element={<Navigate to="/groups/create" replace />} />
      <Route path="/team/:teamId" element={<Navigate to="/" replace />} />
      <Route path="/tasks" element={<Navigate to="/" replace />} />
      <Route path="/tasks/create" element={<Navigate to="/" replace />} />
      <Route path="/review" element={<Navigate to="/" replace />} />
      
      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
