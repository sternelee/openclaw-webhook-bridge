/**
 * ConfigSidebar component - Collapsible sidebar with section navigation
 * Ported from ui/src/ui/views/config.ts sidebar section
 */

"use client";

import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ConfigSection {
  key: string;
  label: string;
}

const SECTIONS: ConfigSection[] = [
  { key: "env", label: "Environment" },
  { key: "update", label: "Updates" },
  { key: "agents", label: "Agents" },
  { key: "auth", label: "Authentication" },
  { key: "channels", label: "Channels" },
  { key: "messages", label: "Messages" },
  { key: "commands", label: "Commands" },
  { key: "hooks", label: "Hooks" },
  { key: "skills", label: "Skills" },
  { key: "tools", label: "Tools" },
  { key: "gateway", label: "Gateway" },
  { key: "wizard", label: "Setup Wizard" },
];

const SECTION_ICONS: Record<string, keyof typeof Icons> = {
  all: "grid",
  env: "cpu",
  update: "download",
  agents: "bot",
  auth: "lock",
  channels: "link",
  messages: "messageSquare",
  commands: "terminal",
  hooks: "link",
  skills: "star",
  tools: "wrench",
  gateway: "network",
  wizard: "wand2",
};

interface ConfigSidebarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeSection: string | null;
  onSectionChange: (section: string | null) => void;
  formMode: "form" | "raw";
  onFormModeChange: (mode: "form" | "raw") => void;
  validity: "valid" | "invalid" | "unknown";
  schemaLoading: boolean;
  availableSections?: string[];
}

export function ConfigSidebar({
  searchQuery,
  onSearchChange,
  activeSection,
  onSectionChange,
  formMode,
  onFormModeChange,
  validity,
  schemaLoading,
  availableSections,
}: ConfigSidebarProps) {
  const getSectionIcon = (key: string): keyof typeof Icons => {
    return SECTION_ICONS[key] ?? "fileText";
  };

  // Filter sections based on availability
  const filteredSections = availableSections
    ? SECTIONS.filter((s) => availableSections.includes(s.key))
    : SECTIONS;

  const ValidityBadge = () => {
    const getBadgeClass = () => {
      switch (validity) {
        case "valid":
          return "bg-ok/10 text-ok border-ok/20";
        case "invalid":
          return "bg-danger/10 text-danger border-danger/20";
        default:
          return "bg-muted/50 text-muted-foreground border-border/50";
      }
    };

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getBadgeClass()}`}>
        {validity}
      </span>
    );
  };

  const IconComponent = ({ iconName }: { iconName: keyof typeof Icons }) => {
    const Icon = Icons[iconName];
    return <Icon className="h-4 w-4 flex-shrink-0" />;
  };

  return (
    <aside className="w-full md:w-64 lg:w-72 border-r border-border/50 bg-card/50 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Settings</h2>
          <ValidityBadge />
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border/50">
        <div className="relative">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
            >
              <Icons.x className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Section Nav */}
      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-1">
          {/* All Settings */}
          <button
            type="button"
            onClick={() => onSectionChange(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
              activeSection === null
                ? "bg-accent/10 text-accent"
                : "text-muted-foreground hover:bg-card hover:text-foreground"
            }`}
          >
            <IconComponent iconName={getSectionIcon("all")} />
            <span className="truncate">All Settings</span>
          </button>

          {/* Individual sections */}
          {filteredSections.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => onSectionChange(section.key)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                activeSection === section.key
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:bg-card hover:text-foreground"
              }`}
            >
              <IconComponent iconName={getSectionIcon(section.key)} />
              <span className="truncate">{section.label}</span>
            </button>
          ))}
        </nav>
      </ScrollArea>

      {/* Mode Toggle */}
      <div className="p-3 border-t border-border/50">
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
          <button
            type="button"
            onClick={() => onFormModeChange("form")}
            disabled={schemaLoading}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              formMode === "form"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            } ${schemaLoading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Form
          </button>
          <button
            type="button"
            onClick={() => onFormModeChange("raw")}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              formMode === "raw"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Raw
          </button>
        </div>
      </div>
    </aside>
  );
}
