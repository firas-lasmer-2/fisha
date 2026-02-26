import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Layers,
} from "lucide-react";
import type { LandingSection, DEFAULT_LANDING_SECTIONS } from "@shared/schema";

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero / Header",
  about: "About Me",
  specializations: "Specializations",
  testimonials: "Client Reviews",
  faq: "FAQ",
  slots: "Book a Session",
  video: "Video Introduction",
  office_photos: "Office Photos",
  social_links: "Social Links",
  custom_text: "Custom Text Block",
};

const SECTION_ICONS: Record<string, string> = {
  hero: "🏠",
  about: "👤",
  specializations: "🎯",
  testimonials: "⭐",
  faq: "❓",
  slots: "📅",
  video: "🎥",
  office_photos: "🖼️",
  social_links: "🔗",
  custom_text: "📝",
};

const TEMPLATES: { name: string; sections: LandingSection[] }[] = [
  {
    name: "Minimal",
    sections: [
      { type: "hero", enabled: true },
      { type: "about", enabled: true },
      { type: "slots", enabled: true },
    ],
  },
  {
    name: "Professional",
    sections: [
      { type: "hero", enabled: true },
      { type: "about", enabled: true },
      { type: "specializations", enabled: true },
      { type: "slots", enabled: true },
      { type: "testimonials", enabled: true, maxCount: 3 },
      { type: "faq", enabled: false },
    ],
  },
  {
    name: "Full",
    sections: [
      { type: "hero", enabled: true },
      { type: "about", enabled: true },
      { type: "specializations", enabled: true },
      { type: "video", enabled: true },
      { type: "office_photos", enabled: true },
      { type: "slots", enabled: true },
      { type: "testimonials", enabled: true, maxCount: 5 },
      { type: "faq", enabled: true },
      { type: "social_links", enabled: true },
    ],
  },
];

interface LandingPageBuilderProps {
  sections: LandingSection[];
  onChange: (sections: LandingSection[]) => void;
}

export function LandingPageBuilder({ sections, onChange }: LandingPageBuilderProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const moveSection = (index: number, direction: "up" | "down") => {
    const next = [...sections];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= next.length) return;
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange(next);
  };

  const toggleEnabled = (index: number) => {
    const next = sections.map((s, i) =>
      i === index ? { ...s, enabled: !s.enabled } : s
    );
    onChange(next);
  };

  const updateSection = (index: number, patch: Record<string, unknown>) => {
    const next = sections.map((s, i) =>
      i === index ? ({ ...s, ...patch } as LandingSection) : s
    );
    onChange(next);
  };

  const removeSection = (index: number) => {
    onChange(sections.filter((_, i) => i !== index));
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const addCustomSection = () => {
    const newSection: LandingSection = {
      type: "custom_text",
      enabled: true,
      title: "Custom Section",
      content: "",
    };
    onChange([...sections, newSection]);
    setExpandedIndex(sections.length);
  };

  const applyTemplate = (template: { name: string; sections: LandingSection[] }) => {
    onChange(template.sections);
    setExpandedIndex(null);
  };

  return (
    <div className="space-y-4">
      {/* Template presets */}
      <div className="space-y-2">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Layers className="h-4 w-4" />
          Template Presets
        </p>
        <div className="flex gap-2 flex-wrap">
          {TEMPLATES.map((tpl) => (
            <Button
              key={tpl.name}
              size="sm"
              variant="outline"
              onClick={() => applyTemplate(tpl)}
            >
              {tpl.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="border rounded-lg divide-y">
        {sections.map((section, index) => {
          const isExpanded = expandedIndex === index;
          const isFirst = index === 0;
          const isLast = index === sections.length - 1;

          return (
            <div key={`${section.type}-${index}`} className={`p-3 ${!section.enabled ? "opacity-50" : ""}`}>
              <div className="flex items-center gap-2">
                {/* Reorder */}
                <div className="flex flex-col gap-0.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0"
                    disabled={isFirst}
                    onClick={() => moveSection(index, "up")}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0"
                    disabled={isLast}
                    onClick={() => moveSection(index, "down")}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>

                {/* Icon and label */}
                <span className="text-base">{SECTION_ICONS[section.type] ?? "📄"}</span>
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                >
                  <p className="text-sm font-medium">{SECTION_LABELS[section.type] ?? section.type}</p>
                  {section.type === "custom_text" && (
                    <p className="text-xs text-muted-foreground">{(section as any).title}</p>
                  )}
                </div>

                <Badge variant={section.enabled ? "default" : "outline"} className="text-xs">
                  {section.enabled ? "On" : "Off"}
                </Badge>

                {/* Toggle */}
                <Switch
                  checked={section.enabled}
                  onCheckedChange={() => toggleEnabled(index)}
                  className="scale-75"
                />

                {/* Delete custom sections */}
                {section.type === "custom_text" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSection(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Expanded settings */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t space-y-3">
                  {section.type === "testimonials" && (
                    <div>
                      <label className="text-xs text-muted-foreground">Max reviews to show</label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={(section as any).maxCount ?? 3}
                        onChange={(e) => updateSection(index, { maxCount: Number(e.target.value) } as any)}
                        className="mt-1 w-24"
                      />
                    </div>
                  )}

                  {section.type === "custom_text" && (
                    <>
                      <div>
                        <label className="text-xs text-muted-foreground">Section Title</label>
                        <Input
                          className="mt-1"
                          value={(section as any).title ?? ""}
                          onChange={(e) => updateSection(index, { title: e.target.value } as any)}
                          placeholder="Section title..."
                          maxLength={100}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Content</label>
                        <Textarea
                          className="mt-1"
                          rows={4}
                          value={(section as any).content ?? ""}
                          onChange={(e) => updateSection(index, { content: e.target.value } as any)}
                          placeholder="Section content..."
                          maxLength={2000}
                        />
                      </div>
                    </>
                  )}

                  {section.type !== "custom_text" && section.type !== "testimonials" && (
                    <p className="text-xs text-muted-foreground">
                      This section has no configurable settings. Toggle it on/off above.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={addCustomSection}
      >
        <Plus className="h-3.5 w-3.5" />
        Add Custom Text Section
      </Button>

      <p className="text-xs text-muted-foreground">
        Drag sections up/down to reorder. Toggle to show/hide on your public page.
      </p>
    </div>
  );
}
