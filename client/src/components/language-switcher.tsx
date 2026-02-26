import { useI18n, type Language, languageNames } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";

export function LanguageSwitcher({ variant = "default" }: { variant?: "default" | "ghost" | "outline" }) {
  const { language, setLanguage } = useI18n();

  const languages: { code: Language; name: string; label: string }[] = [
    { code: "ar", name: "العربية", label: "ع" },
    { code: "fr", name: "Français", label: "Fr" },
    { code: "darija", name: "تونسي", label: "تو" },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" className="gap-2" data-testid="button-language-switcher">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{languageNames[language]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={language === lang.code ? "bg-accent" : ""}
            data-testid={`menu-item-lang-${lang.code}`}
          >
            <span className="me-2 font-semibold text-xs w-5 h-5 rounded bg-muted flex items-center justify-center">{lang.label}</span>
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
