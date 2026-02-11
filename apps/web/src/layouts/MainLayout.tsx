import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole, USER_ROLE_LABELS } from '@saga/shared';
import {
  Home,
  Target,
  Calendar,
  FileText,
  ClipboardCheck,
  Users,
  GraduationCap,
  Download,
  Settings,
  LogOut,
  Menu,
  X,
  BookOpen,
  MessageSquare,
  Shield,
} from 'lucide-react';
import { useState } from 'react';
import NotificationBell from '../components/NotificationBell';

const navigation = [
  { name: 'Översikt', href: '/', icon: Home, roles: 'all' },
  { name: 'Delmål', href: '/delmal', icon: Target, roles: [UserRole.ST_BT] },
  { name: 'Kalender', href: '/kalender', icon: Calendar, roles: [UserRole.ST_BT] },
  { name: 'Intyg', href: '/intyg', icon: FileText, roles: [UserRole.ST_BT] },
  { name: 'Bedömningar', href: '/bedomningar', icon: ClipboardCheck, roles: [UserRole.ST_BT, UserRole.HANDLEDARE] },
  { name: 'Handledarsamtal', href: '/handledarsamtal', icon: Users, roles: [UserRole.ST_BT, UserRole.HANDLEDARE] },
  { name: 'Schema', href: '/schema', icon: Calendar, roles: [UserRole.HANDLEDARE, UserRole.STUDIEREKTOR] },
  { name: 'Kurser', href: '/kurser', icon: GraduationCap, roles: [UserRole.ST_BT] },
  { name: 'Feedback', href: '/feedback', icon: MessageSquare, roles: [UserRole.ST_BT] },
  { name: 'Studierektor', href: '/studierektor', icon: BookOpen, roles: [UserRole.STUDIEREKTOR] },
  { name: 'Administration', href: '/admin', icon: Shield, roles: [UserRole.ADMIN] },
  { name: 'Export', href: '/export', icon: Download, roles: [UserRole.ST_BT] },
];

export default function MainLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredNav = navigation.filter((item) => {
    if (item.roles === 'all') return true;
    return item.roles.includes(user!.role);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <span className="font-semibold text-lg text-gray-900">SAGA</span>
            </div>
            <button
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User info */}
          <div className="px-4 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 truncate">{user?.name}</p>
                <p className="text-sm text-gray-500">{USER_ROLE_LABELS[user?.role as UserRole]}</p>
              </div>
              <div className="hidden lg:block">
                <NotificationBell />
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {filteredNav.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </NavLink>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div className="p-2 border-t border-gray-200">
            <NavLink
              to="/installningar"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === '/installningar'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Settings className="w-5 h-5" />
              Inställningar
            </NavLink>
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Logga ut
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200 lg:hidden">
          <div className="flex items-center">
            <button
              className="p-2 text-gray-500 hover:text-gray-700"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-4 font-semibold text-lg text-gray-900">SAGA</span>
          </div>
          <NotificationBell />
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
