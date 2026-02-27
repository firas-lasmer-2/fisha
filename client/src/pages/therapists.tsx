import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Search,
  Star,
  CheckCircle,
  MessageCircle,
  Video,
  Calendar,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useOnlineTherapists } from "@/hooks/use-online-therapists";
import { motion } from "framer-motion";
import type { TherapistProfile, User } from "@shared/schema";

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
  const [, navigate] = useLocation();
  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  // Filter state — initialized from URL search params
  const getParam = (key: string) =>
    typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get(key) ?? "") : "";
  const [searchQuery, setSearchQuery] = useState("");
  const [specialization, setSpecialization] = useState<string>(() => getParam("specialization"));
  const [language, setLanguage] = useState<string>(() => getParam("language"));
  const [gender, setGender] = useState<string>(() => getParam("gender"));
  const [tier, setTier] = useState<string>(() => {
    const tierParam = getParam("tier");
    return tierParam === "graduated_doctor" || tierParam === "premium_doctor" ? tierParam : "";
  });
  const [budget, setBudget] = useState<string>(() => getParam("budget"));
  const [onlineOnly, setOnlineOnly] = useState(() => getParam("online") === "1");

  // Sync active filters back to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (specialization) params.set("specialization", specialization);
    if (language) params.set("language", language);
    if (gender) params.set("gender", gender);
    if (tier) params.set("tier", tier);
    if (budget) params.set("budget", budget);
    if (onlineOnly) params.set("online", "1");
    const qs = params.toString();
    navigate(qs ? `/therapists?${qs}` : "/therapists", { replace: true });
  }, [specialization, language, gender, tier, budget, onlineOnly]);

  const onlineTherapists = useOnlineTherapists();

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

  const specializations = [
    { value: "anxiety", label: t("specialization.anxiety") },
    { value: "depression", label: t("specialization.depression") },
    { value: "relationships", label: t("specialization.relationships") },
    { value: "trauma", label: t("specialization.trauma") },
    { value: "stress", label: t("specialization.stress") },
    { value: "self_esteem", label: t("specialization.self_esteem") },
    { value: "grief", label: t("specialization.grief") },
    { value: "family", label: t("specialization.family") },
    { value: "couples", label: t("specialization.couples") },
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

  const hasActiveFilters = !!(specialization || language || gender || tier || onlineOnly || budget);
  const totalResults = filteredTherapists?.length ?? 0;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">

        {/* ── Hero ── */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-therapists-title">
              {t("therapist.find")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t("therapist.find_subtitle")}</p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("therapist.search_placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-10 h-11 text-base"
              data-testid="input-search-therapists"
            />
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="space-y-2" data-testid="section-filters">
          {/* Single scrollable chip row */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar items-center">
            {/* Online now */}
            <button
              onClick={() => setOnlineOnly(!onlineOnly)}
              data-testid="filter-online-now"
              className={`shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
                onlineOnly
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-muted/40 border-transparent hover:border-border text-muted-foreground"
              }`}
            >
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              {t("therapist.online_now")}
            </button>

            {/* Divider */}
            <span className="shrink-0 h-4 w-px bg-border" />

            {/* Language chips */}
            {languageOptions.map((l) => (
              <button
                key={l.value}
                onClick={() => toggleFilter("language", l.value)}
                data-testid={`filter-lang-${l.value}`}
                className={`shrink-0 whitespace-nowrap text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
                  language === l.value
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted/40 border-transparent hover:border-border text-muted-foreground"
                }`}
              >
                {l.label}
              </button>
            ))}

            {/* Gender chips */}
            {genderOptions.map((g) => (
              <button
                key={g.value}
                onClick={() => toggleFilter("gender", g.value)}
                data-testid={`filter-gender-${g.value}`}
                className={`shrink-0 whitespace-nowrap text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
                  gender === g.value
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted/40 border-transparent hover:border-border text-muted-foreground"
                }`}
              >
                {g.label}
              </button>
            ))}

            {/* Divider */}
            <span className="shrink-0 h-4 w-px bg-border" />

            {/* Specialization chips */}
            {specializations.map((s, i) => (
              <motion.button
                key={s.value}
                custom={i}
                variants={filterChipVariants}
                initial="hidden"
                animate="visible"
                onClick={() => toggleFilter("specialization", s.value)}
                data-testid={`filter-spec-${s.value}`}
                className={`shrink-0 whitespace-nowrap text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
                  specialization === s.value
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted/40 border-transparent hover:border-border text-muted-foreground"
                }`}
              >
                {s.label}
              </motion.button>
            ))}

            {/* Budget chips */}
            <span className="shrink-0 h-4 w-px bg-border" />
            {budgetOptions.map((b) => (
              <button
                key={b.value}
                onClick={() => setBudget(budget === b.value ? "" : b.value)}
                data-testid={`filter-budget-${b.value}`}
                className={`shrink-0 whitespace-nowrap text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
                  budget === b.value
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted/40 border-transparent hover:border-border text-muted-foreground"
                }`}
              >
                {b.label}
              </button>
            ))}

            {/* Clear */}
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSpecialization("");
                  setLanguage("");
                  setGender("");
                  setTier("");
                  setBudget("");
                  setOnlineOnly(false);
                }}
                data-testid="button-clear-filters"
                className="shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-destructive/40 text-destructive hover:bg-destructive/5 transition-all font-medium"
              >
                <X className="h-3 w-3" />
                {t("therapist.clear_all")}
              </button>
            )}
          </div>

          {/* Result count */}
          {!isLoading && (
            <p className="text-xs text-muted-foreground">
              {totalResults} therapist{totalResults !== 1 ? "s" : ""}
              {hasActiveFilters || searchQuery ? " match your filters" : " in Tunisia"}
            </p>
          )}
        </div>

        {/* ── Therapist grid ── */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-xl border bg-card p-4 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-xl bg-muted shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <div className="h-5 bg-muted rounded-full w-16" />
                  <div className="h-5 bg-muted rounded-full w-20" />
                </div>
                <div className="h-9 bg-muted rounded-lg" />
              </div>
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
                <div
                  className="rounded-xl border bg-card hover:shadow-md hover:border-primary/30 transition-all h-full flex flex-col"
                  data-testid={`card-therapist-${tp.userId}`}
                >
                  {/* Card top */}
                  <div className="p-4 flex items-start gap-3">
                    <Link href={`/therapist/${tp.userId}`}>
                      <Avatar className="h-14 w-14 rounded-xl cursor-pointer shrink-0">
                        {tp.user.profileImageUrl && (
                          <AvatarImage src={tp.user.profileImageUrl} alt={`${tp.user.firstName || ""} ${tp.user.lastName || ""}`} />
                        )}
                        <AvatarFallback className="rounded-xl gradient-calm text-white text-xl font-bold">
                          {(tp.user.firstName?.[0] || "?").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Link>

                    <div className="min-w-0 flex-1 space-y-1">
                      <Link href={`/therapist/${tp.userId}`}>
                        <h3
                          className="font-semibold hover:text-primary transition-colors cursor-pointer leading-tight"
                          data-testid={`text-therapist-name-${tp.userId}`}
                        >
                          {tp.user.firstName} {tp.user.lastName}
                        </h3>
                      </Link>

                      {/* Badges row */}
                      <div className="flex items-center flex-wrap gap-1">
                        {tp.verified && (
                          <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle className="h-3.5 w-3.5 fill-emerald-500/20" />
                            <span className="text-[10px] font-medium">{tr("therapist.verified_badge", "Verified")}</span>
                          </span>
                        )}
                        {tp.tier === "premium_doctor" ? (
                          <Badge className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-400/50 px-1.5">
                            ✦ {t("tier.premium_doctor_therapist")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1.5">
                            {t("tier.graduated_doctor_therapist")}
                          </Badge>
                        )}
                        {onlineTherapists.has(tp.userId) && (
                          <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5">
                            ● Online
                          </Badge>
                        )}
                      </div>

                      {/* Headline */}
                      <p className="text-xs text-muted-foreground line-clamp-1 leading-snug">
                        {tp.headline || tr("therapist.simple_headline", "Warm, culturally-aware support")}
                      </p>

                      {/* Rating + reviews */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span className="font-medium text-foreground">{(tp.rating || 0).toFixed(1)}</span>
                        <span>({tp.reviewCount || 0})</span>
                        {tp.yearsExperience ? <span>· {tp.yearsExperience}y exp</span> : null}
                      </div>
                    </div>
                  </div>

                  {/* Specializations */}
                  <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                    {(tp.specializations || []).slice(0, 3).map((specializationKey) => (
                      <Badge
                        key={specializationKey}
                        variant="secondary"
                        className="text-[11px] px-2 py-0.5"
                        data-testid={`badge-spec-${tp.userId}-${specializationKey}`}
                      >
                        {specializations.find((item) => item.value === specializationKey)?.label || specializationKey}
                      </Badge>
                    ))}
                  </div>

                  {/* Availability */}
                  <div className="px-4 pb-3">
                    {tp.hasOpenSlots === true ? (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {tr("therapist.accepting_clients", "Accepting new clients")}
                      </span>
                    ) : tp.hasOpenSlots === false ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                        {tr("therapist.fully_booked", "Fully booked")}
                      </span>
                    ) : null}
                  </div>

                  {/* Footer */}
                  <div className="mt-auto border-t px-4 py-3 flex items-center justify-between gap-2 bg-muted/20 rounded-b-xl">
                    <div className="text-xs space-y-0.5" data-testid={`text-rate-${tp.userId}`}>
                      <div className="flex items-center gap-1 text-primary font-medium">
                        <MessageCircle className="h-3 w-3" />
                        {tr("therapist.free_to_message", "Free to message")}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Video className="h-3 w-3" />
                        {tp.rateDinar} {t("common.dinar")} / session
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => handleStartConversation(tp.userId)}
                        data-testid={`button-message-${tp.userId}`}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Link href={`/therapist/${tp.userId}#slots`}>
                        <Button size="sm" className="h-8" data-testid={`button-book-${tp.userId}`}>
                          <Calendar className="h-3.5 w-3.5 me-1.5" />
                          {t("therapist.book")}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="text-center py-20 text-muted-foreground space-y-3"
          >
            <Search className="h-12 w-12 mx-auto opacity-20" />
            <p data-testid="text-no-therapists">{t("therapist.no_therapists")}</p>
            {hasActiveFilters && (
              <button
                onClick={() => { setSpecialization(""); setLanguage(""); setGender(""); setTier(""); setBudget(""); setOnlineOnly(false); }}
                className="text-sm underline underline-offset-2 hover:text-foreground transition-colors"
              >
                {t("therapist.clear_all")}
              </button>
            )}
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
