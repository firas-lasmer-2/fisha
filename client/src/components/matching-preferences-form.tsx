import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { MatchingPreferences } from "@shared/schema";

const SPECIALIZATIONS = [
  "Anxiety", "Depression", "Trauma", "Relationships",
  "Family", "Addiction", "Grief", "Stress", "Sleep", "Self-esteem",
];

const LANGUAGES: { value: string; label: string }[] = [
  { value: "ar", label: "العربية" },
  { value: "fr", label: "Français" },
  { value: "darija", label: "الدارجة" },
  { value: "en", label: "English" },
];

const SESSION_TYPES: { value: string; label: string }[] = [
  { value: "online", label: "Online only" },
  { value: "in_person", label: "In person only" },
  { value: "any", label: "No preference" },
];

const GENDERS: { value: string; label: string }[] = [
  { value: "male", label: "Male therapist" },
  { value: "female", label: "Female therapist" },
  { value: "any", label: "No preference" },
];

export function MatchingPreferencesForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: saved, isLoading } = useQuery<MatchingPreferences | null>({
    queryKey: ["/api/matching/preferences"],
  });

  const [specs, setSpecs] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>([]);
  const [gender, setGender] = useState<string>("any");
  const [sessionType, setSessionType] = useState<string>("any");
  const [maxBudget, setMaxBudget] = useState<number>(200);

  useEffect(() => {
    if (saved) {
      setSpecs(saved.preferredSpecializations ?? []);
      setLangs(saved.preferredLanguages ?? []);
      setGender(saved.preferredGender ?? "any");
      setSessionType(saved.sessionTypePreference ?? "any");
      setMaxBudget(saved.maxBudgetDinar ?? 200);
    }
  }, [saved]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("PUT", "/api/matching/preferences", {
        preferredSpecializations: specs.length ? specs : undefined,
        preferredLanguages: langs.length ? langs : undefined,
        preferredGender: gender !== "any" ? gender : undefined,
        sessionTypePreference: sessionType !== "any" ? sessionType : undefined,
        maxBudgetDinar: maxBudget,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matching/preferences"] });
      toast({ title: "Preferences saved", description: "Your matching preferences have been updated." });
    },
    onError: () => {
      toast({ title: "Save failed", variant: "destructive" });
    },
  });

  const toggleChip = (list: string[], setList: (v: string[]) => void, val: string) => {
    setList(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  };

  if (isLoading) {
    return <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="space-y-5">
      {/* Specializations */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Preferred topics</Label>
        <div className="flex flex-wrap gap-2">
          {SPECIALIZATIONS.map((s) => (
            <Badge
              key={s}
              variant={specs.includes(s) ? "default" : "outline"}
              className="cursor-pointer select-none"
              onClick={() => toggleChip(specs, setSpecs, s)}
            >
              {specs.includes(s) && <X className="h-3 w-3 mr-1" />}
              {s}
            </Badge>
          ))}
        </div>
      </div>

      {/* Languages */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Preferred languages</Label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <Badge
              key={l.value}
              variant={langs.includes(l.value) ? "default" : "outline"}
              className="cursor-pointer select-none"
              onClick={() => toggleChip(langs, setLangs, l.value)}
            >
              {langs.includes(l.value) && <X className="h-3 w-3 mr-1" />}
              {l.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Gender preference */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Therapist gender</Label>
        <div className="flex gap-2 flex-wrap">
          {GENDERS.map((g) => (
            <Badge
              key={g.value}
              variant={gender === g.value ? "default" : "outline"}
              className="cursor-pointer select-none"
              onClick={() => setGender(g.value)}
            >
              {g.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Session type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Session type</Label>
        <div className="flex gap-2 flex-wrap">
          {SESSION_TYPES.map((st) => (
            <Badge
              key={st.value}
              variant={sessionType === st.value ? "default" : "outline"}
              className="cursor-pointer select-none"
              onClick={() => setSessionType(st.value)}
            >
              {st.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Max budget */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Max session price</Label>
          <span className="text-sm font-semibold text-primary">{maxBudget} د.ت</span>
        </div>
        <Slider
          min={20}
          max={300}
          step={10}
          value={[maxBudget]}
          onValueChange={([v]) => setMaxBudget(v)}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>20 د.ت</span>
          <span>300 د.ت</span>
        </div>
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full"
      >
        {saveMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Save preferences
          </>
        )}
      </Button>
    </div>
  );
}
