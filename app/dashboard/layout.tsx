'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Camera, Activity, BarChart3, Menu, X } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Facial Verification',
      href: '/dashboard/facial-verification',
      icon: Camera,
    },
    {
      label: 'Behavioral Monitoring',
      href: '/dashboard/behavioral-monitoring',
      icon: Activity,
    },
    {
      label: 'Risk Analytics',
      href: '/dashboard/risk-analytics',
      icon: BarChart3,
    },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:relative lg:translate-x-0 scan-effect`}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-20 px-6 border-b border-sidebar-border bg-gradient-to-r from-sidebar to-sidebar/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center neon-pulse">
              <span className="text-primary-foreground text-sm font-bold glow">●</span>
            </div>
            <span className="text-sidebar-foreground font-bold text-sm glow">SECURED</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-sidebar-foreground hover:text-sidebar-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 relative overflow-hidden group ${
                  isActive
                    ? 'bg-sidebar-primary/20 border border-sidebar-primary text-sidebar-primary neon-pulse'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/10 hover:text-sidebar-accent border border-transparent hover:border-sidebar-accent/30'
                }`}
              >
                <div className={`absolute inset-0 transition-all duration-300 ${isActive ? 'bg-gradient-to-r from-sidebar-primary/10 to-transparent' : 'bg-transparent group-hover:bg-gradient-to-r group-hover:from-sidebar-accent/5 group-hover:to-transparent'}`} />
                <Icon size={20} className="relative z-10" />
                <span className="text-sm font-medium relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          <div className="text-xs text-sidebar-foreground/60 space-y-1">
            <p>● System Status: Active</p>
            <p>● Security Level: Maximum</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-20 border-b border-border bg-gradient-to-r from-card via-card/50 to-card/30 backdrop-blur-sm flex items-center px-6 scan-effect">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-foreground hover:text-primary mr-4 transition-colors"
          >
            <Menu size={24} />
          </button>
          <div className="flex-1 flex items-center gap-4">
            <h1 className="text-2xl font-bold text-primary glow hidden sm:block">
              Cybersecurity Dashboard
            </h1>
          </div>
          <div className="text-xs text-muted-foreground space-y-1 text-right">
            <p className="font-semibold text-foreground">● Live System</p>
            <p>AI-Powered Analysis</p>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
