import { Home, Image, BookOpen, Users, Settings as SettingsIcon, Mic, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useLanguage } from "@/contexts/LanguageContext";

const navItems = [
  { title: "Home", url: "/", icon: Home, key: "app.title" },
  { title: "Record", url: "/record", icon: Mic, key: "record.title" },
  { title: "Notes", url: "/notes", icon: BookOpen, key: "notes.title" },
  { title: "Gallery", url: "/drawings", icon: Image, key: "drawings.title" },
  { title: "Analyze", url: "/analyze", icon: Sparkles, key: "analysis.savedAnalyses" },
  { title: "Children", url: "/children", icon: Users, key: "children.title" },
  { title: "Settings", url: "/settings", icon: SettingsIcon, key: "settings.title" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { t } = useLanguage();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar className="border-r border-border bg-white">
      <SidebarContent className="bg-white">
        <SidebarGroup>
          <div className="px-4 py-6">
            <h1 className={`font-semibold text-foreground transition-all ${isCollapsed ? 'text-sm text-center' : 'text-xl'}`}>
              {isCollapsed ? "🏠" : t('app.title')}
            </h1>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                          isActive
                            ? "bg-secondary text-foreground font-medium"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!isCollapsed && <span>{t(item.key)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
