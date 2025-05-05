import React from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Layout: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  
  // Define navigation items
  const navItems = [
    { name: 'Projects', path: '/' },
    { name: 'Add Project', path: '/add-project' },
    { name: 'Settings', path: '/settings' },
    { name: 'Activity', path: '/activity' },
  ];
  
  // Add user management for admins
  if (isAdmin()) {
    navItems.push({ name: 'User Management', path: '/user-management' });
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-200">
      {/* Top Navigation Bar */}
      <header className="bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 py-2">
        <div className="flex items-center">
          <button 
            onClick={() => navigate('/')} 
            className="text-lg font-semibold mr-6"
          >
            VFX Launcher
          </button>
          
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <NavLink 
                key={item.path} 
                to={item.path} 
                className={({ isActive }) => 
                  `px-3 py-1 rounded text-sm ${isActive ? 'bg-blue-600' : 'hover:bg-gray-700'}`
                }
              >
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="text-sm">
            <span className="text-gray-400 mr-1">{user?.role}:</span>
            <span className="font-medium">{user?.username}</span>
          </div>
          
          <button 
            onClick={handleLogout}
            className="text-sm px-3 py-1 rounded hover:bg-gray-700 text-red-400 hover:text-red-300"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden bg-gray-900">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
