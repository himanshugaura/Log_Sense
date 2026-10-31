import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  FileCode2,
  FolderTree,
  AlertTriangle,
  Flame,
  Network,
  Menu,
  X,
  Sun,
  Moon,
  FolderKanban,
  ArrowLeft,
  ChevronRight,
  Plus,
  Layers,
} from 'lucide-react';
import { UserButton, SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react';
import { useTheme } from '../../context/ThemeContext';
import { useProject } from '../../context/ProjectContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export const DashboardLayout: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  const { theme, toggleTheme } = useTheme();
  const { projects, activeProject, activeProjectId, selectProject, createProject } = useProject();
  const location = useLocation();
  const navigate = useNavigate();

  const handleProjectSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__new__') {
      setNewProjectModalOpen(true);
    } else {
      selectProject(val);
    }
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      await createProject(newProjectName.trim(), newProjectDesc.trim() || undefined);
      setNewProjectName('');
      setNewProjectDesc('');
      setNewProjectModalOpen(false);
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setCreatingProject(false);
    }
  };

  const navItems = [
    { label: 'Overview', path: '/dashboard', icon: LayoutDashboard, exact: true },
    { label: 'Log Explorer', path: '/dashboard/logs', icon: FileCode2 },
    { label: 'Log Clusters', path: '/dashboard/clusters', icon: FolderTree },
    { label: 'Anomalies', path: '/dashboard/anomalies', icon: AlertTriangle },
    { label: 'Incidents', path: '/dashboard/incidents', icon: Flame },
    { label: 'Service Map', path: '/dashboard/service-map', icon: Network },
    { label: 'Settings & Status', path: '/dashboard/settings', icon: Layers },
  ];

  const getBreadcrumbTitle = () => {
    if (location.pathname === '/dashboard') return 'Overview';
    if (location.pathname.startsWith('/dashboard/logs')) return 'Log Explorer';
    if (location.pathname.startsWith('/dashboard/clusters')) return 'Log Clusters';
    if (location.pathname.startsWith('/dashboard/anomalies')) return 'Anomalies';
    if (location.pathname.startsWith('/dashboard/incidents')) return 'Incidents';
    if (location.pathname.startsWith('/dashboard/service-map')) return 'Service Map';
    if (location.pathname.startsWith('/dashboard/settings')) return 'Settings & Status';
    return 'Dashboard';
  };

  return (
    <div className="min-h-screen bg-neutral-50/50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 flex transition-colors">
      {/* Desktop Sidebar (250px) */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121212] shrink-0">
        {/* Sidebar Brand */}
        <div className="h-16 px-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-neutral-900 dark:text-neutral-100 font-display text-lg font-bold tracking-tight"
          >
            <div className="w-7 h-7 rounded-lg bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center text-white dark:text-neutral-900">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M4 6h16M4 12h10M4 18h14" />
                <circle cx="19" cy="12" r="2" fill="#b45309" stroke="#b45309" />
              </svg>
            </div>
            <span>LogSense</span>
          </Link>
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
            v1.0
          </span>
        </div>

        {/* Real Backend Project Selector in Sidebar */}
        <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-850">
          <div className="flex items-center justify-between mb-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <FolderKanban className="w-3.5 h-3.5 text-amber-700 dark:text-amber-500" />
              <span>Project</span>
            </label>
            <button
              type="button"
              onClick={() => setNewProjectModalOpen(true)}
              className="text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 flex items-center gap-0.5 transition-colors"
              title="Create New Project"
            >
              <Plus className="w-3 h-3" />
              <span>New</span>
            </button>
          </div>
          <select
            value={activeProjectId}
            onChange={handleProjectSelect}
            className="w-full text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1.5 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-100 cursor-pointer"
          >
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id}>
                {proj.name}
              </option>
            ))}
            <option value="__new__">+ Create New Project...</option>
          </select>
        </div>

        {/* Navigation list */}
        <nav aria-label="Dashboard Sidebar" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);

            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-850'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white dark:text-neutral-900' : 'text-neutral-500 dark:text-neutral-400'}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer info */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
          <div className="p-2.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-900/80 border border-neutral-200/80 dark:border-neutral-800/80 text-xs">
            <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400 mb-1">
              <span className="font-medium">Backend Pipeline</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">ONLINE</span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-500 leading-tight">
              Drain3 tree parser + 4-factor RCA & Gemini engine active.
            </p>
          </div>

          <Link
            to="/"
            className="flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 px-2 py-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Landing Page</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 px-4 sm:px-6 lg:px-8 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121212] flex items-center justify-between gap-4 sticky top-0 z-30 transition-colors">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb trail */}
            <div className="flex items-center gap-2 text-sm">
              <Link to="/dashboard" className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200">
                LogSense
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-neutral-500 dark:text-neutral-400 hidden sm:inline">
                {activeProject?.name || 'Production'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-400 hidden sm:inline" />
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {getBreadcrumbTitle()}
              </span>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800 px-2.5 py-1 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>FastAPI & Drain3: Ready</span>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="p-2 rounded-xl text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <SignedIn>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: 'w-8 h-8 rounded-full border border-neutral-700',
                  },
                }}
              />
            </SignedIn>

            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="outline" size="sm">
                  Sign In
                </Button>
              </SignInButton>
            </SignedOut>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Sidebar Overlay Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white dark:bg-[#121212] flex flex-col h-full border-r border-neutral-200 dark:border-neutral-800 shadow-xl">
            <div className="h-16 px-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <Link
                to="/"
                onClick={() => setMobileSidebarOpen(false)}
                className="flex items-center gap-2.5 text-neutral-900 dark:text-neutral-100 font-display text-lg font-bold"
              >
                <span>LogSense</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
              <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 block mb-1">
                Active Project
              </label>
              <select
                value={activeProjectId}
                onChange={(e) => {
                  handleProjectSelect(e);
                  setMobileSidebarOpen(false);
                }}
                className="w-full text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2 py-1.5"
              >
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
              </select>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = item.exact
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                      isActive
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-850'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
              <Link
                to="/"
                onClick={() => setMobileSidebarOpen(false)}
                className="flex items-center gap-2 text-xs text-neutral-500"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Landing Page</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {newProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setNewProjectModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121212] p-6 shadow-xl text-neutral-900 dark:text-neutral-100">
            <button
              onClick={() => setNewProjectModalOpen(false)}
              className="absolute right-4 top-4 p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-display text-lg font-bold tracking-tight">Create New Project</h3>
            <p className="mt-1 text-xs text-neutral-500">
              Set up a dedicated workspace for your microservices topology and log streams.
            </p>

            <form onSubmit={handleCreateProjectSubmit} className="mt-4 space-y-4">
              <Input
                label="Project Name"
                placeholder="e.g. Staging Cluster, Payment Gateway"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                required
              />
              <Input
                label="Description (Optional)"
                placeholder="Brief description of the services monitored"
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setNewProjectModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={creatingProject || !newProjectName.trim()}>
                  {creatingProject ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
