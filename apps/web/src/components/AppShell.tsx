import React, { useState } from "react";
import { useAuth } from "@/auth/use-auth";
import { useOrganization } from "@/org/use-organization";
import { navigate, usePathname } from "@/routes/navigation";
import { LogoMark } from "@haza-aios/ui";
import type { Organization } from "@/org/org.types";
import { useIsSuperAdmin } from "@/admin/use-platform-admin";
import { ModuleRuntime } from "@/modules/module-runtime";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface AppShellProps {
  children: React.ReactNode;
}

function AppShell({ children }: AppShellProps) {
  const auth = useAuth();
  const pathname = usePathname();
  const { currentOrganization, organizations, switchOrg } = useOrganization();
  const isSuperAdmin = useIsSuperAdmin();
  
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Detect admin mode by pathname
  const isAdminMode = pathname.startsWith("/admin");

  const handleLogout = async () => {
    await auth.logout();
    navigate("/login");
  };

  // Admin-specific navigation
  const adminNavItems: NavItem[] = [
    {
      label: "Overview",
      path: "/admin",
      icon: (
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </svg>
      ),
    },
    {
      label: "Organizations",
      path: "/admin/organizations",
      icon: (
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      label: "Users",
      path: "/admin/users",
      icon: (
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      label: "Module Registry",
      path: "/admin/modules",
      icon: (
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="8" height="8" x="3" y="3" rx="2" />
          <rect width="8" height="8" x="13" y="3" rx="2" />
          <rect width="8" height="8" x="3" y="13" rx="2" />
          <rect width="8" height="8" x="13" y="13" rx="2" />
        </svg>
      ),
    },
    {
      label: "Audit Log",
      path: "/admin/audit-log",
      icon: (
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      label: "System Health",
      path: "/admin/system-health",
      icon: (
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
    },
  ];

  // Data-driven navigation definition
  const baseOrgNavItems: NavItem[] = [
    {
      label: "Overview",
      path: "/workspace",
      icon: (
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </svg>
      ),
    },
    {
      label: "Members",
      path: "/workspace/members",
      icon: (
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      label: "Active Modules",
      path: "/workspace/modules",
      icon: (
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7.5 4.27 9 5.15" />
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      ),
    },
    {
      label: "Agents",
      path: "/workspace/agents",
      icon: (
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M12 8v8" />
          <path d="m8 12 4-4 4 4" />
        </svg>
      ),
    },
  ];

  // Dynamic module navigation for current organization
  const dynamicModuleNavItems: NavItem[] = currentOrganization
    ? ModuleRuntime.getActiveModuleNavigationForOrg(currentOrganization.id).map((item) => ({
        label: item.label,
        path: item.route,
        icon: <span className="text-base">{item.icon || "📦"}</span>,
      }))
    : [];

  const orgNavItems = [...baseOrgNavItems, ...dynamicModuleNavItems];
  const navItems = isAdminMode ? adminNavItems : orgNavItems;

  const bottomNavItem: NavItem = {
    label: "Settings",
    path: "/workspace/settings",
    icon: (
      <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  };

  // Check if link is active
  const isActive = (path: string) => {
    if (path === "/workspace") {
      return pathname === "/workspace" || pathname === "/dashboard" || pathname === "/app";
    }
    if (path === "/admin" && pathname === "/admin") {
      return true;
    }
    if (path !== "/admin" && pathname.startsWith(path) && path.startsWith("/admin/")) {
      return true;
    }
    if (path !== "/workspace" && pathname.startsWith(path) && path.startsWith("/workspace/")) {
      return true;
    }
    return pathname === path;
  };

  return (
    <div className="flex min-h-screen bg-[#080b11] text-white antialiased font-sans">
      
      {/* 1. DESKTOP SIDEBAR RAIL */}
      <aside
        className={`hidden md:flex flex-col items-center border-r border-white/5 bg-[#090d16] py-6 transition-all duration-300 z-30 ${
          isSidebarExpanded ? "w-64 px-4" : "w-16 px-2"
        }`}
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
      >
        {/* Brand Logo */}
        <div className="flex items-center gap-3 w-full px-2 mb-6">
          <LogoMark className="size-8 text-red-500 shrink-0" />
          {isSidebarExpanded && (
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              HAZA AIOS
            </span>
          )}
        </div>

        {/* Admin Mode Badge / Context Switcher */}
        {isAdminMode && (
          <div className="w-full px-2 mb-6">
            <div className={`flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 transition-all ${isSidebarExpanded ? 'px-3 py-2' : 'justify-center py-2'}`}>
              <svg className="size-4 text-red-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {isSidebarExpanded && (
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Admin Mode</span>
              )}
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 w-full space-y-2">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-4 w-full p-3 rounded-xl transition-all duration-200 group text-left ${
                  active
                    ? "bg-red-500/10 text-red-500 border border-red-500/20"
                    : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <div className={`shrink-0 transition-transform group-hover:scale-105 ${active ? "text-red-500" : ""}`}>
                  {item.icon}
                </div>
                {isSidebarExpanded && <span className="text-sm font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom section: Admin link + Settings */}
        <div className="w-full pt-4 border-t border-white/5 space-y-2">
          {/* Admin link (visible in org mode when user is super_admin) */}
          {!isAdminMode && isSuperAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="flex items-center gap-4 w-full p-3 rounded-xl transition-all duration-200 group text-left text-slate-400 hover:text-red-400 hover:bg-red-500/5 border border-transparent"
            >
              <div className="shrink-0">
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              {isSidebarExpanded && <span className="text-sm font-medium">Admin Panel</span>}
            </button>
          )}
          {/* Back to Dashboard link (visible in admin mode) */}
          {isAdminMode && (
            <button
              onClick={() => navigate("/workspace")}
              className="flex items-center gap-4 w-full p-3 rounded-xl transition-all duration-200 group text-left text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
            >
              <div className="shrink-0">
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 19-7-7 7-7" />
                  <path d="M19 12H5" />
                </svg>
              </div>
              {isSidebarExpanded && <span className="text-sm font-medium">Back to Dashboard</span>}
            </button>
          )}
          {/* Settings link */}
          <button
            onClick={() => navigate(bottomNavItem.path)}
            className={`flex items-center gap-4 w-full p-3 rounded-xl transition-all duration-200 group text-left ${
              isActive(bottomNavItem.path)
                ? "bg-red-500/10 text-red-500 border border-red-500/20"
                : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
          >
            <div className="shrink-0 transition-transform group-hover:rotate-45 duration-300">
              {bottomNavItem.icon}
            </div>
            {isSidebarExpanded && <span className="text-sm font-medium">{bottomNavItem.label}</span>}
          </button>
        </div>
      </aside>

      {/* 2. MOBILE HEADER BAR */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b border-white/5 bg-[#090d16]/90 backdrop-blur-md flex items-center justify-between px-4 z-40">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-400 hover:text-white"
          aria-label="Toggle menu"
        >
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <LogoMark className="size-7 text-red-500" />
          <span className="font-bold text-sm">HAZA AIOS</span>
        </div>
        <div className="w-8"></div> {/* Spacer for alignment */}
      </div>

      {/* MOBILE DRAWER NAVIGATION */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-[#080b11] z-35 flex flex-col p-4 space-y-4">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                navigate(item.path);
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center gap-4 w-full p-4 rounded-xl text-left ${
                isActive(item.path)
                  ? "bg-red-500/10 text-red-500 border border-red-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {item.icon}
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
          <button
            onClick={() => {
              navigate(bottomNavItem.path);
              setIsMobileMenuOpen(false);
            }}
            className={`flex items-center gap-4 w-full p-4 rounded-xl text-left ${
              isActive(bottomNavItem.path)
                ? "bg-red-500/10 text-red-500 border border-red-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {bottomNavItem.icon}
            <span className="text-sm font-medium">{bottomNavItem.label}</span>
          </button>
        </div>
      )}

      {/* 3. MAIN CONTENT CONTAINER LAYOUT */}
      <div className="flex-1 flex flex-col min-w-0 md:pt-0 pt-16">
        
        {/* TOP UTILITY HEADER BAR */}
        <header className="h-16 border-b border-white/5 bg-[#090d16]/30 px-6 flex items-center justify-between z-20">
          
          {/* Breadcrumb / Left Side Header */}
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold tracking-wider uppercase px-2 py-1 rounded ${isAdminMode ? 'text-red-400 bg-red-500/10' : 'text-red-500 bg-red-500/10'}`}>
              {isAdminMode ? 'Platform Admin' : 'Tenant Active'}
            </span>
            <div className="h-4 w-px bg-white/10 hidden sm:block"></div>
            {/* Organization switch dropdown */}
            {organizations.length > 0 && currentOrganization && (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <select
                    value={currentOrganization.id}
                    onChange={(e) => switchOrg(e.target.value)}
                    className="appearance-none rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 pr-8 text-xs font-medium text-white focus:outline-none focus:border-red-500/30 transition-colors"
                  >
                    {organizations.map((o: Organization) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Organization details display */}
                {!isAdminMode && (
                  <div className="hidden lg:flex items-center gap-2.5 border-l border-white/10 pl-3">
                    <div className="size-6 rounded-md bg-red-500/10 text-red-500 flex items-center justify-center font-bold text-xs">
                      {currentOrganization.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left leading-none">
                      <p className="text-[10px] text-slate-300 font-semibold">{currentOrganization.organizationType}</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">{currentOrganization.industry}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
                      currentOrganization.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}>
                      {currentOrganization.status}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Side Utilities (Search, Notifications, Profile) */}
          <div className="flex items-center gap-4">
            
            {/* Search Trigger */}
            <button className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all hidden sm:block" aria-label="Search">
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>

            {/* Notifications Trigger */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen);
                  setIsProfileOpen(false);
                }}
                className={`p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all relative ${
                  isNotificationsOpen ? "bg-white/5 text-white" : ""
                }`}
                aria-label="Notifications"
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                <span className="absolute top-1 right-1 size-2 rounded-full bg-red-500"></span>
              </button>

              {/* Notification Menu */}
              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl z-50">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                    <h4 className="text-xs font-semibold text-white">Notifications</h4>
                    <span className="text-[10px] text-red-500">1 Unread</span>
                  </div>
                  <div className="space-y-3">
                    <div className="p-2 rounded-lg bg-white/5 text-xs">
                      <p className="font-semibold text-white">System Healthy</p>
                      <p className="text-slate-400 mt-0.5">All HAZA AIOS agent nodes reporting online.</p>
                      <span className="text-[10px] text-slate-500 block mt-1">10m ago</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Avatar / Menu */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsProfileOpen(!isProfileOpen);
                  setIsNotificationsOpen(false);
                }}
                className={`flex items-center gap-2 p-1 rounded-full hover:bg-white/5 transition-all ${
                  isProfileOpen ? "bg-white/5" : ""
                }`}
                aria-label="Profile Menu"
              >
                <div className="size-8 rounded-full bg-red-500 flex items-center justify-center font-bold text-sm text-white">
                  {auth.user?.displayName ? auth.user.displayName.charAt(0).toUpperCase() : "O"}
                </div>
              </button>

              {/* Profile Dropdown */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl z-50">
                  <div className="border-b border-white/5 pb-3 mb-3">
                    <p className="text-sm font-semibold text-white">{auth.user?.displayName || "Operator"}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{auth.user?.email}</p>
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        navigate("/profile");
                        setIsProfileOpen(false);
                      }}
                      className="w-full text-left p-2 rounded-xl text-xs text-slate-300 hover:bg-white/5 hover:text-white transition-all"
                    >
                      Account Settings
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left p-2 rounded-xl text-xs text-red-400 hover:bg-red-500/10 transition-all font-semibold"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

        </header>

        {/* 4. MAIN PAGE DYNAMIC CONTENT */}
        <main className="flex-1 overflow-y-auto p-6 relative">
          {children}
        </main>

      </div>

    </div>
  );
}

export { AppShell };
