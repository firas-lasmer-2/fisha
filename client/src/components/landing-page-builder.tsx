import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Layers,
  AlertTriangle,
} from "lucide-react";
import type { LandingSection } from "@shared/schema";

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
  banner: "Custom Banner Image",
  gallery: "Photo Gallery",
  certifications: "Certifications & Education",
  pricing: "Pricing Table",
  contact_form: "Contact / Inquiry Form",
  consultation_intro: "Before Your Session",
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
  banner: "🖼",
  gallery: "🗃️",
  certifications: "🎓",
  pricing: "💰",
  contact_form: "✉️",
  consultation_intro: "💬",
};

// Sections that should only appear once (structural/singleton)
const SINGLETON_TYPES = new Set([
  "hero", "about", "specializations", "faq", "slots",
  "office_photos", "gallery", "social_links", "certifications",
  "pricing", "contact_form", "consultation_intro",
]);

// Sections whose content comes from profile fields — warn if data may be missing
const PROFILE_DATA_TYPES = new Set([
  "faq", "gallery", "office_photos", "social_links",
  "certifications", "consultation_intro",
]);

// Section types that can be added (not always present by default)
const ADDABLE_SECTIONS: { type: string; label: string }[] = [
  { type: "banner", label: "Banner Image" },
  { type: "gallery", label: "Photo Gallery" },
  { type: "certifications", label: "Certifications" },
  { type: "pricing", label: "Pricing Table" },
  { type: "contact_form", label: "Contact Form" },
  { type: "consultation_intro", label: "Before Your Session" },
  { type: "custom_text", label: "Custom Text" },
];

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
  /** Optional: profile data presence flags to show empty-data warnings */
  profileData?: {
    hasAbout?: boolean;
    hasFaq?: boolean;
    hasGallery?: boolean;
    hasSocialLinks?: boolean;
    hasCertifications?: boolean;
    hasConsultationIntro?: boolean;
  };
}

export function LandingPageBuilder({ sections, onChange, profileData }: LandingPageBuilderProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [templateConfirm, setTemplateConfirm] = useState<{ name: string; sections: LandingSection[] } | null>(null);

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

  const addSection = (type: string) => {
    // Prevent adding duplicate singleton sections
    if (SINGLETON_TYPES.has(type) && sections.some((s) => s.type === type)) {
      return; // already exists — button will be disabled in the UI
    }
    let newSection: LandingSection;
    if (type === "custom_text") {
      newSection = { type: "custom_text", enabled: true, title: "Custom Section", content: "" };
    } else if (type === "banner") {
      newSection = { type: "banner", enabled: true, imageUrl: "", altText: "" };
    } else {
      newSection = { type: type as LandingSection["type"], enabled: true } as LandingSection;
    }
    onChange([...sections, newSection]);
    setExpandedIndex(sections.length);
  };

  const confirmApplyTemplate = (template: { name: string; sections: LandingSection[] }) => {
    setTemplateConfirm(template);
  };

  const applyTemplate = () => {
    if (!templateConfirm) return;
    onChange(templateConfirm.sections);
    setExpandedIndex(null);
    setTemplateConfirm(null);
  };

  // Compute empty-data warning for a section
  const getEmptyWarning = (type: string): string | null => {
    if (!profileData) return null;
    if (type === "about" && profileData.hasAbout === false)
      return "Add an 'About Me' text in your Profile to populate this section.";
    if ((type === "faq") && profileData.hasFaq === false)
      return "Add FAQ items in your Profile to populate this section.";
    if ((type === "gallery" || type === "office_photos") && profileData.hasGallery === false)
      return "Upload gallery images in your Profile to populate this section.";
    if (type === "social_links" && profileData.hasSocialLinks === false)
      return "Add social links in your Profile to populate this section.";
    if (type === "certifications" && profileData.hasCertifications === false)
      return "Add certifications in your Profile to populate this section.";
    if (type === "consultation_intro" && profileData.hasConsultationIntro === false)
      return "Add a 'Before Your Session' intro in your Profile to populate this section.";
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Template presets */}
      <div className="space-y-2">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Layers className="h-4 w-4" />
          Template Presets
        </p>
        <p className="text-xs text-muted-foreground">Applying a template will replace your current section layout.</p>
        <div className="flex gap-2 flex-wrap">
          {TEMPLATES.map((tpl) => (
            <Button
              key={tpl.name}
              size="sm"
              variant="outline"
              onClick={() => confirmApplyTemplate(tpl)}
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
          const isDeletable = ["custom_text", "banner", "gallery", "certifications", "pricing", "contact_form", "consultation_intro"].includes(section.type);
          const emptyWarning = section.enabled ? getEmptyWarning(section.type) : null;

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

                {emptyWarning && (
                  <span title={emptyWarning}>
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  </span>
                )}

                <Badge variant={section.enabled ? "default" : "outline"} className="text-xs">
                  {section.enabled ? "On" : "Off"}
                </Badge>

                {/* Toggle */}
                <Switch
                  checked={section.enabled}
                  onCheckedChange={() => toggleEnabled(index)}
                  className="scale-75"
                />

                {/* Delete non-core sections */}
                {isDeletable && (
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

              {/* Empty data warning inline */}
              {emptyWarning && isExpanded && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {emptyWarning}
                </div>
              )}

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

                  {section.type === "banner" && (
                    <>
                      <div>
                        <label className="text-xs text-muted-foreground">Banner Image URL</label>
                        <Input
                          className="mt-1"
                          value={(section as any).imageUrl ?? ""}
                          onChange={(e) => updateSection(index, { imageUrl: e.target.value } as any)}
                          placeholder="https://example.com/banner.jpg"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Alt Text</label>
                        <Input
                          className="mt-1"
                          value={(section as any).altText ?? ""}
                          onChange={(e) => updateSection(index, { altText: e.target.value } as any)}
                          placeholder="Describe the image..."
                          maxLength={200}
                        />
                      </div>
                    </>
                  )}

                  {section.type === "video" && (
                    <div>
                      <label className="text-xs text-muted-foreground">YouTube / Vimeo URL</label>
                      <Input
                        className="mt-1"
                        value={(section as any).videoUrl ?? ""}
                        onChange={(e) => updateSection(index, { videoUrl: e.target.value } as any)}
                        placeholder="https://youtube.com/watch?v=..."
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Paste a YouTube or Vimeo link. It will be embedded on your page.
                      </p>
                    </div>
                  )}

                  {PROFILE_DATA_TYPES.has(section.type) && (
                    <p className="text-xs text-muted-foreground">
                      Content is pulled from your profile data. Toggle to show/hide on your page.
                    </p>
                  )}

                  {section.type === "contact_form" && (
                    <p className="text-xs text-muted-foreground">
                      Shows a "Send a message" button that links to your in-app profile so visitors can contact you.
                    </p>
                  )}

                  {!["custom_text", "testimonials", "banner", "gallery", "certifications", "pricing", "contact_form", "consultation_intro", "video"].includes(section.type)
                    && !PROFILE_DATA_TYPES.has(section.type) && (
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

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Add Section</p>
        <div className="flex flex-wrap gap-2">
          {ADDABLE_SECTIONS.map((s) => {
            const alreadyExists = SINGLETON_TYPES.has(s.type) && sections.some((sec) => sec.type === s.type);
            return (
              <Button
                key={s.type}
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => addSection(s.type)}
                disabled={alreadyExists}
                title={alreadyExists ? "This section is already in your layout" : undefined}
              >
                <Plus className="h-3 w-3" />
                {s.label}
              </Button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Reorder sections with the arrows. Toggle to show/hide on your public page.
      </p>

      {/* Template apply confirmation */}
      <AlertDialog open={!!templateConfirm} onOpenChange={(open) => { if (!open) setTemplateConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply "{templateConfirm?.name}" template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current section layout with the {templateConfirm?.name} template.
              Any custom text sections or unsaved changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my layout</AlertDialogCancel>
            <AlertDialogAction onClick={applyTemplate}>Apply template</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
