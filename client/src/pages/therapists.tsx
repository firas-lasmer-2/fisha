import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Search,
  Star,
  Globe,
  Shield,
  CheckCircle,
  Users,
  Brain,
  Filter,
  Sparkles,
  MessageCircle,
  Video,
  Calendar,
  ArrowRight,
  ArrowLeft,
  WandSparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useOnlineTherapists } from "@/hooks/use-online-therapists";
import { motion } from "framer-motion";
import type { OnboardingResponse, TherapistProfile, User } from "@shared/schema";

const filterChipVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4 },
  }),
};

export default function TherapistsPage() {
  const { t, isRTL } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [specialization, setSpecialization] = useState<string>("");
  const [language, setLanguage] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [tier, setTier] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const tierParam = new URLSearchParams(window.location.search).get("tier");
    return tierParam === "graduated_doctor" || tierParam === "premium_doctor" ? tierParam : "";
  });
  const [budget, setBudget] = useState<string>("");
  const [onlineOnly, setOnlineOnly] = useState(false);

  const onlineTherapists = useOnlineTherapists();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const queryStr = new URLSearchParams();
  if (specialization && specialization !== "all")
    queryStr.set("specialization", specialization);
  if (language && language !== "all") queryStr.set("language", language);
  if (gender && gender !== "all") queryStr.set("gender", gender);
  if (tier && tier !== "all") queryStr.set("tier", tier);

  const queryStrString = queryStr.toString();
  const therapistsUrl = queryStrString
    ? `/api/therapists?${queryStrString}`
    : "/api/therapists";

  const { data: therapists, isLoading } = useQuery<
    (TherapistProfile & { user: User })[]
  >({
    queryKey: [therapistsUrl],
  });

  const { data: onboarding } = useQuery<OnboardingResponse | null>({
    queryKey: ["/api/onboarding"],
    enabled: !!user && user.role === "client",
  });

  const specializations = [
    { value: "anxiety", label: t("specialization.anxiety"), icon: Brain },
    {
      value: "depression",
      label: t("specialization.depression"),
      icon: Brain,
    },
    {
      value: "relationships",
      label: t("specialization.relationships"),
      icon: Users,
    },
    { value: "trauma", label: t("specialization.trauma"), icon: Shield },
    { value: "stress", label: t("specialization.stress"), icon: Brain },
    {
      value: "self_esteem",
      label: t("specialization.self_esteem"),
      icon: Sparkles,
    },
    { value: "grief", label: t("specialization.grief"), icon: Brain },
    { value: "family", label: t("specialization.family"), icon: Users },
    { value: "couples", label: t("specialization.couples"), icon: Users },
  ];

  const languageOptions = [
    { value: "ar", label: "العربية" },
    { value: "fr", label: "Français" },
  ];

  const genderOptions = [
    { value: "male", label: t("common.male") },
    { value: "female", label: t("common.female") },
  ];

  const tierOptions = [
    { value: "graduated_doctor", label: t("tier.graduated_doctor_therapist") },
    { value: "premium_doctor", label: t("tier.premium_doctor_therapist") },
  ];

  const budgetOptions = [
    { value: "0-80", label: `< 80 ${t("common.dinar")}` },
    { value: "80-120", label: `80-120 ${t("common.dinar")}` },
    { value: "120+", label: `120+ ${t("common.dinar")}` },
  ];

  const handleStartConversation = async (therapistId: string) => {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    try {
      const res = await apiRequest("POST", "/api/conversations", {
        therapistId,
      });
      const conv = await res.json();
      window.location.href = `/messages?conv=${conv.id}`;
    } catch (e) {
      toast({
        title: t("common.error"),
        variant: "destructive",
      });
    }
  };

  const toggleFilter = (
    type: "specialization" | "language" | "gender" | "tier",
    value: string,
  ) => {
    if (type === "specialization") {
      setSpecialization(specialization === value ? "" : value);
    } else if (type === "language") {
      setLanguage(language === value ? "" : value);
    } else if (type === "tier") {
      setTier(tier === value ? "" : value);
    } else {
      setGender(gender === value ? "" : value);
    }
  };

  const filteredTherapists = therapists?.filter((tp) => {
    if (onlineOnly && !onlineTherapists.has(tp.userId)) return false;
    if (budget) {
      const rate = tp.rateDinar ?? 0;
      if (budget === "0-80" && rate >= 80) return false;
      if (budget === "80-120" && (rate < 80 || rate > 120)) return false;
      if (budget === "120+" && rate <= 120) return false;
    }
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name =
      `${tp.user.firstName || ""} ${tp.user.lastName || ""}`.toLowerCase();
    const specs = tp.specializations?.join(" ").toLowerCase() || "";
    return name.includes(query) || specs.includes(query);
  });

  const recommendedMatches = useMemo(() => {
    const list = filteredTherapists || [];
    if (list.length === 0) return [];

    const concerns = onboarding?.primaryConcerns || [];
    const concernSet = new Set(concerns);
    const preferredLang = onboarding?.preferredLanguage || "";
    const budgetRange = onboarding?.budgetRange || "";

    let minBudget = 0;
    let maxBudget = Number.POSITIVE_INFINITY;
    if (budgetRange.includes("-")) {
      const [min, max] = budgetRange.split("-");
      minBudget = Number(min) || 0;
      maxBudget = Number(max) || Number.POSITIVE_INFINITY;
    } else if (budgetRange.endsWith("+")) {
      minBudget = Number(budgetRange.replace("+", "")) || 0;
    }

    const scored = list.map((therapist) => {
      let score = 30;

      const specializationHits = (therapist.specializations || []).filter((spec) => concernSet.has(spec)).length;
      score += specializationHits * 18;

      if (preferredLang && therapist.languages?.includes(preferredLang)) {
        score += 12;
      }

      if (Number.isFinite(therapist.rateDinar || 0)) {
        const rate = therapist.rateDinar || 0;
        if (rate >= minBudget && rate <= maxBudget) score += 10;
        else if (Math.abs(rate - minBudget) <= 20 || Math.abs(rate - maxBudget) <= 20) score += 5;
      }

      score += Math.min(20, (therapist.rating || 0) * 4);
      score += Math.min(8, Math.floor((therapist.reviewCount || 0) / 5));

      if (onlineTherapists.has(therapist.userId)) score += 8;

      if (therapist.tier === "graduated_doctor" && maxBudget <= 80) score += 5;
      if (therapist.tier === "premium_doctor" && specializationHits >= 2) score += 3;

      return {
        therapist,
        score: Math.min(99, Math.max(30, Math.round(score))),
      };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [filteredTherapists, onboarding?.primaryConcerns, onboarding?.preferredLanguage, onboarding?.budgetRange, onlineTherapists]);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-2"
        >
          <h1
            className="text-2xl sm:text-3xl font-bold"
            data-testid="text-therapists-title"
          >
            {t("therapist.find")}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {t("therapist.find_subtitle")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative"
        >
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("therapist.search_placeholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-10"
            data-testid="input-search-therapists"
          />
        </motion.div>

        <div className="space-y-2" data-testid="section-filters">
          {/* Row 1: specialization chips */}
          <ScrollArea className="w-full">
            <div className="flex items-center gap-2 pb-1">
              <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {specializations.map((s, i) => (
                <motion.div
                  key={s.value}
                  custom={i}
                  variants={filterChipVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <Badge
                    variant={specialization === s.value ? "default" : "secondary"}
                    className="cursor-pointer shrink-0 whitespace-nowrap"
                    onClick={() => toggleFilter("specialization", s.value)}
                    data-testid={`filter-spec-${s.value}`}
                  >
                    {s.label}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </ScrollArea>

          {/* Row 2: quick toggles — language, online, gender */}
          <div className="flex flex-wrap items-center gap-2">
            {languageOptions.map((l) => (
              <Badge
                key={l.value}
                variant={language === l.value ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleFilter("language", l.value)}
                data-testid={`filter-lang-${l.value}`}
              >
                <Globe className="h-3 w-3 me-1" />
                {l.label}
              </Badge>
            ))}

            <Badge
              variant={onlineOnly ? "default" : "outline"}
              className={`cursor-pointer gap-1.5 ${onlineOnly ? "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 border-emerald-600" : ""}`}
              onClick={() => setOnlineOnly(!onlineOnly)}
              data-testid="filter-online-now"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              {t("therapist.online_now")}
              {onlineTherapists.size > 0 && (
                <span className="text-xs opacity-80">({onlineTherapists.size})</span>
              )}
            </Badge>

            {genderOptions.map((g) => (
              <Badge
                key={g.value}
                variant={gender === g.value ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleFilter("gender", g.value)}
                data-testid={`filter-gender-${g.value}`}
              >
                <Users className="h-3 w-3 me-1" />
                {g.label}
              </Badge>
            ))}

            {tierOptions.map((tierOption) => (
              <Badge
                key={tierOption.value}
                variant={tier === tierOption.value ? "default" : "outline"}
                className="cursor-pointer whitespace-nowrap"
                onClick={() => toggleFilter("tier", tierOption.value)}
                data-testid={`filter-tier-${tierOption.value}`}
              >
                {tierOption.label}
              </Badge>
            ))}

            {budgetOptions.map((b) => (
              <Badge
                key={b.value}
                variant={budget === b.value ? "default" : "outline"}
                className="cursor-pointer whitespace-nowrap"
                onClick={() => setBudget(budget === b.value ? "" : b.value)}
                data-testid={`filter-budget-${b.value}`}
              >
                {b.label}
              </Badge>
            ))}

            {(specialization || language || gender || tier || onlineOnly || budget) && (
              <Badge
                variant="outline"
                className="cursor-pointer text-destructive border-destructive/40"
                onClick={() => {
                  setSpecialization("");
                  setLanguage("");
                  setGender("");
                  setTier("");
                  setBudget("");
                  setOnlineOnly(false);
                }}
                data-testid="button-clear-filters"
              >
                {t("therapist.clear_all")}
              </Badge>
            )}
          </div>
        </div>

        {recommendedMatches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Card className="safe-surface" data-testid="card-best-match">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <WandSparkles className="h-4 w-4 text-safe" />
                      {tr("therapist.best_match", "Best match for you")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tr(
                        "therapist.best_match_desc",
                        "Personalized from your onboarding concerns, language, and budget.",
                      )}
                    </p>
                  </div>
                  {onboarding?.primaryConcerns?.length ? (
                    <Badge variant="outline" className="text-xs">
                      {onboarding.primaryConcerns.length} {tr("therapist.concern_signals", "concern signals")}
                    </Badge>
                  ) : null}
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {recommendedMatches.map(({ therapist, score }) => (
                    <Link key={`best-match-${therapist.userId}`} href={`/therapist/${therapist.userId}`}>
                      <div className="rounded-lg border bg-background/70 p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar className="h-10 w-10 rounded-lg">
                            {therapist.user.profileImageUrl && (
                              <AvatarImage src={therapist.user.profileImageUrl} alt={`${therapist.user.firstName || ""} ${therapist.user.lastName || ""}`} />
                            )}
                            <AvatarFallback className="rounded-lg gradient-calm text-white">
                              {(therapist.user.firstName?.[0] || "?").toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {therapist.user.firstName} {therapist.user.lastName}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">{therapist.headline || t("therapist.find_subtitle")}</p>
                          </div>
                          <Badge className="text-[10px] bg-primary/10 text-primary hover:bg-primary/10">
                            {score}%
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="truncate">{(therapist.specializations || []).slice(0, 2).map((spec) => specializations.find((item) => item.value === spec)?.label || spec).join(" • ") || "-"}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-xl bg-muted animate-pulse shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="h-5 bg-muted rounded-full animate-pulse w-16" />
                    <div className="h-5 bg-muted rounded-full animate-pulse w-20" />
                  </div>
                  <div className="h-3 bg-muted rounded animate-pulse w-full" />
                  <div className="flex justify-between items-center">
                    <div className="h-5 bg-muted rounded animate-pulse w-16" />
                    <div className="flex gap-2">
                      <div className="h-8 bg-muted rounded animate-pulse w-8" />
                      <div className="h-8 bg-muted rounded animate-pulse w-24" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTherapists && filteredTherapists.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTherapists.map((tp, index) => (
              <motion.div
                key={tp.id}
                custom={index}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
              >
                <Card
                  className="hover-elevate transition-all h-full"
                  data-testid={`card-therapist-${tp.userId}`}
                >
                  <CardContent className="p-4 flex flex-col h-full">
                    <div className="flex items-start gap-3">
                      <Link href={`/therapist/${tp.userId}`}>
                        <Avatar className="h-14 w-14 rounded-xl cursor-pointer">
                          {tp.user.profileImageUrl && (
                            <AvatarImage src={tp.user.profileImageUrl} alt={`${tp.user.firstName || ""} ${tp.user.lastName || ""}`} />
                          )}
                          <AvatarFallback className="rounded-xl gradient-calm text-white text-lg font-bold">
                            {(tp.user.firstName?.[0] || "?").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Link>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link href={`/therapist/${tp.userId}`}>
                            <h3 className="font-semibold truncate hover:text-primary transition-colors cursor-pointer" data-testid={`text-therapist-name-${tp.userId}`}>
                              {tp.user.firstName} {tp.user.lastName}
                            </h3>
                          </Link>
                          {tp.verified && (
                            <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400" title="Verified professional">
                              <CheckCircle className="h-3.5 w-3.5 fill-emerald-500/20" />
                              <span className="text-[10px] font-medium hidden sm:inline">{tr("therapist.verified_badge", "Verified")}</span>
                            </span>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            {tp.tier === "graduated_doctor" ? t("tier.graduated_doctor_therapist") : t("tier.premium_doctor_therapist")}
                          </Badge>
                          {tp.hasOpenSlots === true && (
                            <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                              • {tr("therapist.accepting_clients", "Accepting clients")}
                            </Badge>
                          )}
                          {tp.hasOpenSlots === false && (
                            <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                              • {tr("therapist.fully_booked", "Fully booked")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {tp.headline || tr("therapist.simple_headline", "Warm, culturally-aware mental health support.")}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <Star className="h-3.5 w-3.5 fill-chart-4 text-chart-4" />
                            {(tp.rating || 0).toFixed(1)}
                          </span>
                          <span>({tp.reviewCount || 0})</span>
                          {onlineTherapists.has(tp.userId) && (
                            <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                              {tr("therapist.online_badge", "Online")}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-3 mb-3">
                      {(tp.specializations || []).slice(0, 2).map((specializationKey) => (
                        <Badge key={specializationKey} variant="secondary" className="text-xs" data-testid={`badge-spec-${tp.userId}-${specializationKey}`}>
                          {specializations.find((item) => item.value === specializationKey)?.label || specializationKey}
                        </Badge>
                      ))}
                    </div>

                    <div className="mt-auto pt-3 border-t flex items-center justify-between gap-2">
                      <div data-testid={`text-rate-${tp.userId}`}>
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="flex items-center gap-1 text-primary font-medium">
                            <MessageCircle className="h-3 w-3" /> {tr("therapist.free_to_message", "Free to message")}
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Video className="h-3 w-3" /> {tp.rateDinar} {t("common.dinar")} / {tr("therapist.video_session", "video session")}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleStartConversation(tp.userId)}
                          data-testid={`button-message-${tp.userId}`}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        <Link href={`/therapist/${tp.userId}#slots`}>
                          <Button size="sm" data-testid={`button-book-${tp.userId}`}>
                            <Calendar className="h-3.5 w-3.5 me-1.5" />
                            {t("therapist.book")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="text-center py-16 text-muted-foreground"
          >
            <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p data-testid="text-no-therapists">
              {t("therapist.no_therapists")}
            </p>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
