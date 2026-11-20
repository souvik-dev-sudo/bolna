import {
  BookOpenText,
  Bot,
  GitBranch,
  LayoutDashboard,
  PhoneCall,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Match only the exact path (used for "/"). */
  end?: boolean;
  badge?: string;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const navigation: NavGroup[] = [
  { label: null, items: [{ to: "/", label: "Overview", icon: LayoutDashboard, end: true }] },
  {
    label: "Build",
    items: [
      { to: "/agents", label: "Agent Studio", icon: Bot },
      { to: "/graphs", label: "Graph Agent", icon: GitBranch },
      { to: "/knowledge-base", label: "Knowledge Base", icon: BookOpenText },
    ],
  },
  {
    label: "Monitor",
    items: [{ to: "/calls", label: "Call History", icon: PhoneCall }],
  },
  {
    label: "Workspace",
    items: [{ to: "/settings", label: "Settings", icon: Settings }],
  },
];
