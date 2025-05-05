import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet
} from 'react-router-dom';
import Layout from './components/Layout'; 
import LoginPage from './pages/LoginPage'; 
import ProjectsPage from './pages/ProjectsPage'; 
import ProjectDetailPage from './pages/ProjectDetailPage'; 
import AddProjectPage from './pages/AddProjectPage'; 
import SettingsPage from './pages/SettingsPage'; 
import UserManagementPage from './pages/UserManagementPage';
import ActivityPage from './pages/ActivityPage'; 
import { AuthProvider, useAuth } from './context/AuthContext';

import './index.css';

// Protected route wrapper component
const ProtectedRoute: React.FC = () => {
  const { user, isLoading } = useAuth();
  
  // Show loading indicator while checking auth
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  
  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <Outlet />;
};

// Admin route for admin-only sections
const AdminRoute: React.FC = () => {
  const { user, isAdmin, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (!isAdmin()) {
    return <Navigate to="/" replace />; // Redirect non-admins to home
  }
  
  return <Outlet />;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<LoginPage />} />
      
      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/add-project" element={<AddProjectPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          
          {/* Admin-only route */}
          <Route element={<AdminRoute />}>
            <Route path="/user-management" element={<UserManagementPage />} />
          </Route>
        </Route>
      </Route>
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="h-screen bg-gray-900 text-gray-200">
          <AppRoutes />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
