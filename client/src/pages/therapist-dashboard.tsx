import { useI18n } from "@/lib/i18n";
import { FeatureHint } from "@/components/feature-hint";
import { FeatureTour } from "@/components/feature-tour";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { EmptyState } from "@/components/empty-state";
import { PageError } from "@/components/page-error";
import { DashboardSidebarLayout } from "@/components/dashboard-sidebar-layout";
import type { DashboardNavGroup, DashboardNavItem } from "@/components/dashboard-sidebar-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { SlotCalendar } from "@/components/slot-calendar";
import { FileUpload } from "@/components/file-upload";
import { LandingPageBuilder } from "@/components/landing-page-builder";
import {
  Star,
  Save,
  ExternalLink,
  Plus,
  Trash2,
  MessageCircle,
  BarChart3,
  Users,
  ClipboardList,
  Calendar,
  Clock,
  Video,
  Link2,
  Send,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Globe,
  Copy,
  ToggleLeft,
  FileText,
  ShieldCheck,
  Upload,
  UserCircle,
  GraduationCap,
  DollarSign,
  BookOpen,
  Loader2,
  X,
  SmilePlus,
  ArrowUpCircle,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import type { TherapistProfile, TherapistReview, TherapistSlot, TherapistVerification, Appointment, User, DoctorPayout, SessionHomework, TierUpgradeRequest } from "@shared/schema";

interface DashboardData {
  profile: TherapistProfile;
  stats: {
    totalReviews: number;
    avgRating: number;
    totalSessions: number;
  };
  recentReviews: (TherapistReview & { client?: { firstName: string; lastName: string } })[];
}

interface FaqItem {
  question: string;
  answer: string;
}

interface SocialLinks {
  facebook?: string;
  instagram?: string;
  linkedin?: string;
}

export default function TherapistDashboardPage() {
  const { t, isRTL } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const [headline, setHeadline] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [approach, setApproach] = useState("");
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [videoIntroUrl, setVideoIntroUrl] = useState("");
  const [officePhotosInput, setOfficePhotosInput] = useState("");
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [slug, setSlug] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [acceptingNewClients, setAcceptingNewClients] = useState(true);
  const [respondingTo, setRespondingTo] = useState<number | null>(null);
  const [selectedSessionNotesId, setSelectedSessionNotesId] = useState<number | null>(null);
  const [responseText, setResponseText] = useState("");
  const [formLoaded, setFormLoaded] = useState(false);
  const [landingEnabled, setLandingEnabled] = useState(false);
  const [landingCtaText, setLandingCtaText] = useState("");
  const [landingCtaUrl, setLandingCtaUrl] = useState("");
  const [landingFormLoaded, setLandingFormLoaded] = useState(false);
  const [landingSections, setLandingSections] = useState<import("@shared/schema").LandingSection[]>([]);
  const [themeColor, setThemeColor] = useState("#6366f1");
  const [themeFont, setThemeFont] = useState("Inter");
  const [customBannerUrl, setCustomBannerUrl] = useState("");
  const [consultationIntro, setConsultationIntro] = useState("");
  const [verificationDocUrl, setVerificationDocUrl] = useState("");
  const [verificationDocType, setVerificationDocType] = useState<"license" | "diploma" | "id_card" | "cv">("license");

  const { data: dashboardData, isLoading, isError, error, refetch } = useQuery<DashboardData>({
    queryKey: ["/api/therapist/dashboard"],
  });

  const { data: slots = [] } = useQuery<TherapistSlot[]>({
    queryKey: ["/api/therapists", user?.id, "slots"],
    enabled: !!user?.id,
  });

  const { data: verifications = [] } = useQuery<TherapistVerification[]>({
    queryKey: ["/api/therapist/verification"],
  });

  const { data: appointments = [] } = useQuery<(Appointment & { otherUser: User })[]>({
    queryKey: ["/api/appointments"],
    enabled: !!user?.id,
  });

  const { data: payouts = [] } = useQuery<DoctorPayout[]>({
    queryKey: ["/api/doctor/payouts"],
    enabled: !!user?.id,
  });

  const { data: myTierUpgradeRequests = [] } = useQuery<TierUpgradeRequest[]>({
    queryKey: ["/api/doctor/tier-upgrade"],
    enabled: !!user?.id,
  });

  const [upgradePortfolioUrl, setUpgradePortfolioUrl] = useState("");
  const [upgradeJustification, setUpgradeJustification] = useState("");
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);

  const tierUpgradeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/doctor/tier-upgrade", {
        portfolioUrl: upgradePortfolioUrl || null,
        justification: upgradeJustification || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/tier-upgrade"] });
      toast({ title: t("therapist_dash.upgrade_submitted") });
      setShowUpgradeForm(false);
      setUpgradePortfolioUrl("");
      setUpgradeJustification("");
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  // Clients who have appointments with this therapist, grouped with session count
  const clientSummaries = (() => {
    const therapistAppointments = appointments.filter(
      (a) => a.therapistId === user?.id,
    );
    const map = new Map<string, { user: User; count: number; lastDate: string | null; statuses: string[] }>();
    for (const apt of therapistAppointments) {
      const existing = map.get(apt.clientId);
      if (existing) {
        existing.count++;
        existing.statuses.push(apt.status);
        if (!existing.lastDate || (apt.scheduledAt && apt.scheduledAt > existing.lastDate)) {
          existing.lastDate = apt.scheduledAt;
        }
      } else {
        map.set(apt.clientId, {
          user: apt.otherUser,
          count: 1,
          lastDate: apt.scheduledAt,
          statuses: [apt.status],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      (b.lastDate || "") > (a.lastDate || "") ? 1 : -1,
    );
  })();

  useEffect(() => {
    if (dashboardData?.profile && !formLoaded) {
      const p = dashboardData.profile;
      setHeadline(p.headline || "");
      setAboutMe(p.aboutMe || "");
      setApproach(p.approach || "");
      setFaqItems((p.faqItems as FaqItem[]) || []);
      setVideoIntroUrl(p.videoIntroUrl || "");
      setOfficePhotosInput(((p.officePhotos as string[] | null) || []).join("\n"));
      setSocialLinks((p.socialLinks as SocialLinks) || {});
      setSlug(p.slug || "");
      setAcceptingNewClients(p.acceptingNewClients ?? true);
      setFormLoaded(true);
    }
    if (dashboardData?.profile && !landingFormLoaded) {
      const p = dashboardData.profile;
      setLandingEnabled(p.landingPageEnabled ?? false);
      setLandingCtaText(p.landingPageCtaText || "");
      setLandingCtaUrl(p.landingPageCtaUrl || "");
      setThemeColor(p.profileThemeColor || "#6366f1");
      setThemeFont((p.customCss as any)?.font || "Inter");
      setCustomBannerUrl(p.customBannerUrl || "");
      setConsultationIntro(p.consultationIntro || "");
      const secs = Array.isArray(p.landingPageSections) && p.landingPageSections.length > 0
        ? p.landingPageSections
        : [
            { type: "hero", enabled: true },
            { type: "about", enabled: true },
            { type: "specializations", enabled: true },
            { type: "slots", enabled: true },
            { type: "testimonials", enabled: true, maxCount: 3 },
          ];
      setLandingSections(secs as import("@shared/schema").LandingSection[]);
      setLandingFormLoaded(true);
    }
  }, [dashboardData, formLoaded, landingFormLoaded]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/therapists", {
        headline,
        aboutMe,
        approach,
        faqItems,
        videoIntroUrl: videoIntroUrl || null,
        officePhotos: officePhotosInput
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
        socialLinks,
        slug: slug || null,
        acceptingNewClients,
      });
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/therapist/dashboard"] });
      const previous = queryClient.getQueryData<DashboardData>(["/api/therapist/dashboard"]);
      queryClient.setQueryData<DashboardData>(["/api/therapist/dashboard"], (old) => {
        if (!old) return old;
        return {
          ...old,
          profile: {
            ...old.profile,
            headline,
            aboutMe,
            approach,
            acceptingNewClients,
          },
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["/api/therapist/dashboard"], context.previous);
      }
      toast({
        title: t("common.error"),
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: t("profile.save_changes"),
        description: t("therapist_dash.changes_saved"),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/therapist/dashboard"] });
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ reviewId, response }: { reviewId: number; response: string }) => {
      await apiRequest("POST", `/api/reviews/${reviewId}/respond`, { response });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/therapist/dashboard"] });
      setRespondingTo(null);
      setResponseText("");
      toast({
        title: t("therapist_dash.response_sent"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        variant: "destructive",
      });
    },
  });

  const saveLandingMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/therapists", {
        landingPageEnabled: landingEnabled,
        landingPageCtaText: landingCtaText || null,
        landingPageCtaUrl: landingCtaUrl || null,
        landingPageSections: landingSections,
        profileThemeColor: themeColor,
        customCss: { font: themeFont },
        customBannerUrl: customBannerUrl || null,
        consultationIntro: consultationIntro || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/therapist/dashboard"] });
      toast({ title: t("therapist_dash.landing_saved") });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const uploadVerificationMutation = useMutation({
    mutationFn: async ({ docType, docUrl }: { docType: string; docUrl: string }) => {
      await apiRequest("POST", "/api/therapist/verification/upload", {
        documentType: docType,
        documentUrl: docUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/therapist/verification"] });
      setVerificationDocUrl("");
      toast({ title: t("therapist_dash.verification_submitted") });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const addFaqItem = () => {
    setFaqItems([...faqItems, { question: "", answer: "" }]);
  };

  const removeFaqItem = (index: number) => {
    setFaqItems(faqItems.filter((_, i) => i !== index));
  };

  const updateFaqItem = (index: number, field: "question" | "answer", value: string) => {
    const updated = [...faqItems];
    updated[index] = { ...updated[index], [field]: value };
    setFaqItems(updated);
  };

  const [activeSection, setActiveSection] = useState("overview");

  const profile = dashboardData?.profile;
  const reviews = dashboardData?.recentReviews || [];
  const totalSessions = dashboardData?.stats?.totalSessions || 0;
  const openSlots = slots.filter((slot) => slot.status === "open");

  const profileUrl = profile?.userId
    ? `/therapist/${profile.userId}`
    : null;

  const navGroups: DashboardNavGroup[] = useMemo(() => [
    {
      label: t("therapist_dash.group_overview"),
      items: [
        { id: "overview", label: t("therapist_dash.overview"), icon: LayoutDashboard },
        { id: "availability", label: t("therapist_dash.availability_tab"), icon: Calendar },
        { id: "sessions", label: t("therapist_dash.sessions_tab"), icon: BookOpen },
        { id: "clients", label: t("therapist_dash.clients_tab"), icon: Users },
      ]
    },
    {
      label: t("therapist_dash.group_profile"),
      items: [
        { id: "profile", label: t("therapist_dash.profile_tab"), icon: ClipboardList },
        { id: "landing", label: t("therapist_dash.landing_tab"), icon: Globe },
        { id: "verification", label: t("therapist_dash.verification_tab"), icon: ShieldCheck },
      ]
    },
    {
      label: t("therapist_dash.group_availability"),
      items: [
        { id: "earnings", label: t("therapist_dash.earnings_tab"), icon: DollarSign },
        { id: "reviews", label: t("therapist_dash.reviews_tab"), icon: MessageCircle },
        { id: "settings", label: t("therapist_dash.settings_tab"), icon: Settings },
      ]
    },
  ], [t]);

  if (isError) return <AppLayout><div className="max-w-4xl mx-auto p-4 sm:p-6"><PageError error={error as Error} resetFn={refetch} /></div></AppLayout>;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid sm:grid-cols-3 gap-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <FeatureTour role="therapist" />
      <DashboardSidebarLayout
        groups={navGroups}
        activeId={activeSection}
        onNavigate={setActiveSection}
        title={t("therapist_dash.title")}
        subtitle={t("therapist_dash.your_page")}
        headerAction={profileUrl ? (
          <Link href={profileUrl}>
            <Button variant="outline" size="sm" data-testid="link-preview-profile">
              <ExternalLink className="h-4 w-4 me-1" />
              {t("therapist_dash.preview_page")}
            </Button>
          </Link>
        ) : undefined}
      >
        <div className="space-y-6">

        {/* Overview section — Mission Control */}
        {activeSection === "overview" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{t("therapist_dash.mission_control")}</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{t("therapist_dash.accepting_clients")}</span>
                <Switch 
                  checked={acceptingNewClients} 
                  onCheckedChange={setAcceptingNewClients} 
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Left Column: Today's Schedule */}
              <div className="md:col-span-2 space-y-4">
                <Card>
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      {t("therapist_dash.today_schedule")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {appointments.filter(a => new Date(a.scheduledAt).toDateString() === new Date().toDateString()).length > 0 ? (
                      <div className="divide-y">
                        {appointments
                          .filter(a => new Date(a.scheduledAt).toDateString() === new Date().toDateString())
                          .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                          .map((apt) => (
                          <div key={apt.id} className="p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors">
                            <div className="w-16 text-center shrink-0">
                              <p className="text-lg font-bold">{new Date(apt.scheduledAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                            </div>
                            <div className="w-1.5 h-12 bg-primary/20 rounded-full" />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{apt.otherUser.firstName} {apt.otherUser.lastName}</p>
                              <p className="text-sm text-muted-foreground">{apt.durationMinutes} {t("common.minutes")}</p>
                            </div>
                            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setSelectedSessionNotesId(apt.id)}>
                              {t("therapist_dash.view_notes")}
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={Calendar}
                        title={t("therapist_dash.no_appointments_today")}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Quick Stats & Actions */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("therapist_dash.action_items")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {reviews.some(r => !r.therapistResponse) && (
                      <div className="flex items-start gap-2 text-sm">
                        <div className="w-2 h-2 mt-1.5 rounded-full bg-amber-500" />
                        <span className="flex-1 cursor-pointer hover:underline" onClick={() => setActiveSection("reviews")}>
                          {reviews.filter(r => !r.therapistResponse).length} {t("therapist_dash.pending_reviews")}
                        </span>
                      </div>
                    )}
                    {!profile?.videoIntroUrl && (
                      <div className="flex items-start gap-2 text-sm">
                        <div className="w-2 h-2 mt-1.5 rounded-full bg-primary" />
                        <span className="flex-1 cursor-pointer hover:underline" onClick={() => setActiveSection("landing")}>
                          {t("therapist_dash.missing_video")}
                        </span>
                      </div>
                    )}
                    {openSlots.length === 0 && (
                      <div className="flex items-start gap-2 text-sm">
                        <div className="w-2 h-2 mt-1.5 rounded-full bg-destructive" />
                        <span className="flex-1 cursor-pointer hover:underline" onClick={() => setActiveSection("availability")}>
                          {t("therapist_dash.no_open_slots")}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-3">
                  <Card className="bg-primary/5 border-primary/10">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-primary">{totalSessions}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t("therapist_dash.total_sessions")}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-chart-4/5 border-chart-4/10">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-chart-4">{profile?.rating?.toFixed(1) || "0.0"}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t("therapist_dash.avg_rating")}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profile Section */}
        {activeSection === "profile" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
                <CardTitle className="text-lg">{t("profile.edit_profile")}</CardTitle>
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  data-testid="button-save-profile"
                >
                  <Save className="h-4 w-4 me-2" />
                  {saveMutation.isPending
                    ? t("common.loading")
                    : t("profile.save_changes")}
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="headline">
                    {t("profile.headline")}
                  </label>
                  <Input
                    id="headline"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder={t("therapist_dash.headline_placeholder")}
                    data-testid="input-headline"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {t("tier.label")}: {profile?.tier === "graduated_doctor" ? t("tier.graduated_doctor_therapist") : t("tier.premium_doctor_therapist")}
                  </Badge>
                  {profile?.badgeType === "verified" && (
                    <Badge className="gap-1 bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300/50">
                      {t("tier.badge_verified")}
                    </Badge>
                  )}
                  {profile?.badgeType === "premium" && (
                    <Badge className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/50">
                      {t("tier.badge_premium")}
                    </Badge>
                  )}
                  {profile?.tier === "graduated_doctor" && (
                    <Badge variant="secondary">
                      {t("tier.graduated_doctor_cap_20")}
                    </Badge>
                  )}
                </div>

                {/* Tier upgrade request for graduated doctors */}
                {profile?.tier === "graduated_doctor" && (() => {
                  const pendingRequest = myTierUpgradeRequests.find((r) => r.status === "pending");
                  const approvedRequest = myTierUpgradeRequests.find((r) => r.status === "approved");
                  if (approvedRequest) return null;
                  return (
                    <div className="rounded-lg border border-dashed p-3 space-y-2">
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <ArrowUpCircle className="h-4 w-4 text-primary" />
                        Request Premium Upgrade
                      </p>
                      {pendingRequest ? (
                        <p className="text-xs text-muted-foreground">
                          Your upgrade request is under review. Submitted {new Date(pendingRequest.createdAt).toLocaleDateString()}.
                        </p>
                      ) : !showUpgradeForm ? (
                        <Button size="sm" variant="outline" onClick={() => setShowUpgradeForm(true)}>
                          Apply for Premium Tier
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            placeholder="Portfolio URL (optional)"
                            value={upgradePortfolioUrl}
                            onChange={(e) => setUpgradePortfolioUrl(e.target.value)}
                            className="text-sm"
                          />
                          <Textarea
                            placeholder="Why do you want to upgrade? Describe your experience, clientele, and specializations..."
                            value={upgradeJustification}
                            onChange={(e) => setUpgradeJustification(e.target.value)}
                            rows={3}
                            maxLength={2000}
                            className="text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => tierUpgradeMutation.mutate()}
                              disabled={tierUpgradeMutation.isPending}
                            >
                              {tierUpgradeMutation.isPending && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
                              Submit Request
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setShowUpgradeForm(false)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <Separator />

                {/* Video sessions */}
                <div className="space-y-1">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Video className="h-4 w-4 text-primary" />
                    Video Sessions
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Each slot gets a unique Jitsi Meet link automatically — no setup needed. Share the link with your client before the session.
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="aboutMe">
                    {t("profile.about_me")}
                  </label>
                  <Textarea
                    id="aboutMe"
                    value={aboutMe}
                    onChange={(e) => setAboutMe(e.target.value)}
                    rows={5}
                    placeholder={t("therapist_dash.about_placeholder")}
                    data-testid="input-about-me"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="approach">
                    {t("profile.my_approach")}
                  </label>
                  <Textarea
                    id="approach"
                    value={approach}
                    onChange={(e) => setApproach(e.target.value)}
                    rows={4}
                    placeholder={t("therapist_dash.approach_placeholder")}
                    data-testid="input-approach"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="slug">
                    {t("therapist_dash.custom_slug")}
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">/therapist/</span>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ""))}
                      placeholder={t("therapist_dash.slug_placeholder")}
                      className="max-w-xs"
                      data-testid="input-slug"
                    />
                  </div>
                </div>

                <Separator />

                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      data-testid="button-toggle-advanced-profile"
                    >
                      {t("therapist_dash.advanced_options")}
                      {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2" htmlFor="videoIntroUrl">
                        <Video className="h-4 w-4" />
                        {t("profile.video_intro")}
                      </label>
                      <Input
                        id="videoIntroUrl"
                        value={videoIntroUrl}
                        onChange={(e) => setVideoIntroUrl(e.target.value)}
                        placeholder="https://youtube.com/watch?v=..."
                        type="url"
                        data-testid="input-video-url"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("profile.office_gallery")}</label>
                      <Textarea
                        value={officePhotosInput}
                        onChange={(e) => setOfficePhotosInput(e.target.value)}
                        rows={4}
                        placeholder={t("therapist_dash.office_photos_placeholder")}
                        data-testid="textarea-office-photos"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        {t("therapist_dash.social_links")}
                      </label>
                      <div className="grid sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">{t("social.facebook")}</label>
                          <Input
                            value={socialLinks.facebook || ""}
                            onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })}
                            placeholder="https://facebook.com/..."
                            data-testid="input-social-facebook"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">{t("social.instagram")}</label>
                          <Input
                            value={socialLinks.instagram || ""}
                            onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                            placeholder="https://instagram.com/..."
                            data-testid="input-social-instagram"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">{t("social.linkedin")}</label>
                          <Input
                            value={socialLinks.linkedin || ""}
                            onChange={(e) => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
                            placeholder="https://linkedin.com/in/..."
                            data-testid="input-social-linkedin"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <label className="text-sm font-medium">{t("profile.faq")}</label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addFaqItem}
                          data-testid="button-add-faq"
                        >
                          <Plus className="h-4 w-4 me-1" />
                          {t("therapist_dash.add_question")}
                        </Button>
                      </div>
                      {faqItems.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          {t("therapist_dash.no_faq")}
                        </p>
                      )}
                      {faqItems.map((item, index) => (
                        <Card key={index} className="p-4 space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 space-y-2">
                              <Input
                                value={item.question}
                                onChange={(e) => updateFaqItem(index, "question", e.target.value)}
                                placeholder={t("common.question")}
                                data-testid={`input-faq-question-${index}`}
                              />
                              <Textarea
                                value={item.answer}
                                onChange={(e) => updateFaqItem(index, "answer", e.target.value)}
                                placeholder={t("common.answer")}
                                rows={2}
                                data-testid={`input-faq-answer-${index}`}
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFaqItem(index)}
                              className="text-destructive shrink-0"
                              data-testid={`button-remove-faq-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <label className="text-sm font-medium">
                      {t("profile.accepting_new")}
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {acceptingNewClients
                        ? t("profile.accepting_new")
                        : t("profile.not_accepting")}
                    </p>
                  </div>
                  <Switch
                    checked={acceptingNewClients}
                    onCheckedChange={setAcceptingNewClients}
                    data-testid="switch-accepting-clients"
                  />
                </div>

              </CardContent>
            </Card>
          </div>
        )}

        {/* Reviews Section */}
        {activeSection === "reviews" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  {t("review.all_reviews")}
                  <Badge variant="secondary" className="ms-1">
                    {reviews.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {reviews.length === 0 ? (
                  <EmptyState
                    icon={Star}
                    title={t("review.no_reviews")}
                    description="Your client reviews will appear here after completed sessions."
                  />
                ) : (
                  reviews.map((review) => (
                    <div key={review.id} className="space-y-3 pb-4 border-b last:border-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium" data-testid={`text-reviewer-${review.id}`}>
                              {review.isAnonymous
                                ? t("common.anonymous")
                                : review.client
                                  ? `${review.client.firstName || ""} ${review.client.lastName || ""}`.trim()
                                  : t("common.client")}
                            </span>
                            {!review.isAnonymous && (
                              <Badge variant="secondary" className="text-xs">
                                <CheckCircle className="h-3 w-3 me-0.5" />
                                {t("review.verified_client")}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`h-3.5 w-3.5 ${
                                  s <= review.overallRating
                                    ? "fill-chart-4 text-chart-4"
                                    : "text-muted-foreground/30"
                                }`}
                              />
                            ))}
                            <span className="text-xs text-muted-foreground ms-1">
                              {review.overallRating}/5
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {review.createdAt
                            ? new Date(review.createdAt).toLocaleDateString(isRTL ? "ar-TN" : "fr-TN")
                            : ""}
                        </span>
                      </div>

                      {review.helpfulnessRating || review.communicationRating ? (
                        <div className="flex gap-4 flex-wrap text-xs text-muted-foreground">
                          {review.helpfulnessRating && (
                            <span>
                              {t("review.helpfulness")}: {review.helpfulnessRating}/5
                            </span>
                          )}
                          {review.communicationRating && (
                            <span>
                              {t("review.communication")}: {review.communicationRating}/5
                            </span>
                          )}
                        </div>
                      ) : null}

                      {review.comment && (
                        <p className="text-sm" data-testid={`text-review-comment-${review.id}`}>
                          {review.comment}
                        </p>
                      )}

                      {review.therapistResponse ? (
                        <div className="bg-muted/50 rounded-md p-3 ms-4">
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            {t("review.response")}
                          </p>
                          <p className="text-sm" data-testid={`text-response-${review.id}`}>
                            {review.therapistResponse}
                          </p>
                        </div>
                      ) : respondingTo === review.id ? (
                        <div className="ms-4 space-y-2">
                          <Textarea
                            value={responseText}
                            onChange={(e) => setResponseText(e.target.value)}
                            placeholder={t("therapist_dash.response_placeholder")}
                            rows={3}
                            data-testid={`input-response-${review.id}`}
                          />
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              size="sm"
                              onClick={() =>
                                respondMutation.mutate({
                                  reviewId: review.id,
                                  response: responseText,
                                })
                              }
                              disabled={!responseText.trim() || respondMutation.isPending}
                              data-testid={`button-submit-response-${review.id}`}
                            >
                              <Send className="h-3.5 w-3.5 me-1" />
                              {respondMutation.isPending ? t("common.loading") : t("review.respond")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setRespondingTo(null);
                                setResponseText("");
                              }}
                              data-testid={`button-cancel-response-${review.id}`}
                            >
                              {t("common.cancel")}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRespondingTo(review.id);
                            setResponseText("");
                          }}
                          data-testid={`button-respond-${review.id}`}
                        >
                          <MessageCircle className="h-3.5 w-3.5 me-1" />
                          {t("review.respond")}
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Landing Page Section */}
        {activeSection === "landing" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
                <CardTitle className="text-lg">{t("therapist_dash.landing_tab")}</CardTitle>
                <Button
                  onClick={() => saveLandingMutation.mutate()}
                  disabled={saveLandingMutation.isPending}
                  data-testid="button-save-landing"
                >
                  <Save className="h-4 w-4 me-2" />
                  {saveLandingMutation.isPending ? t("common.loading") : t("profile.save_changes")}
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg bg-muted/60 p-3">
                  <div>
                    <p className="text-sm font-medium">{t("therapist_dash.enable_landing")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("therapist_dash.enable_landing_hint")}
                    </p>
                  </div>
                  <Switch
                    checked={landingEnabled}
                    onCheckedChange={setLandingEnabled}
                    data-testid="switch-landing-enabled"
                  />
                </div>

                {profile?.slug && landingEnabled && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">{t("therapist_dash.shareable_link")}</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-muted px-2 py-1 rounded flex-1 truncate">
                        {window.location.origin}/p/{profile.slug}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/p/${profile?.slug}`);
                          toast({ title: t("common.copied") });
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <a
                        href={`/p/${profile.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    </div>
                  </div>
                )}

                {!profile?.slug && (
                  <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    {t("therapist_dash.slug_required")}
                  </div>
                )}

                {/* Style Customization */}
                <div className="rounded-lg border p-4 space-y-4">
                  <p className="text-sm font-semibold">{t("therapist_dash.style_appearance")}</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{t("therapist_dash.accent_color")}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={themeColor}
                          onChange={(e) => setThemeColor(e.target.value)}
                          className="h-9 w-16 rounded border cursor-pointer bg-transparent p-0.5"
                          data-testid="input-theme-color"
                        />
                        <code className="text-xs text-muted-foreground">{themeColor}</code>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Font</label>
                      <select
                        value={themeFont}
                        onChange={(e) => setThemeFont(e.target.value)}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        data-testid="select-theme-font"
                      >
                        <option value="Inter">Inter (Default)</option>
                        <option value="Tajawal">Tajawal (Arabic)</option>
                        <option value="Playfair Display">Playfair Display (Elegant)</option>
                        <option value="DM Sans">DM Sans (Modern)</option>
                        <option value="Nunito">Nunito (Friendly)</option>
                      </select>
                    </div>
                  </div>

                  {profile?.slug && (
                    <a
                      href={`/p/${profile.slug}?embed=false`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t("therapist_dash.preview_public_page")}
                    </a>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t("therapist_dash.cta_text")}
                  </label>
                  <Input
                    value={landingCtaText}
                    onChange={(e) => setLandingCtaText(e.target.value)}
                    placeholder={t("therapist_dash.cta_text_placeholder")}
                    maxLength={80}
                    data-testid="input-cta-text"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t("therapist_dash.cta_url")}
                  </label>
                  <Input
                    value={landingCtaUrl}
                    onChange={(e) => setLandingCtaUrl(e.target.value)}
                    placeholder="https://calendly.com/yourname"
                    maxLength={255}
                    data-testid="input-cta-url"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("therapist_dash.cta_url_hint")}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Before Your Session
                  </label>
                  <Textarea
                    value={consultationIntro}
                    onChange={(e) => setConsultationIntro(e.target.value)}
                    placeholder="What should clients know or prepare before their first session with you?"
                    rows={4}
                    maxLength={1000}
                    data-testid="textarea-consultation-intro"
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown on your public page when the "Before Your Session" section is enabled.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t("therapist_dash.page_sections")}
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {t("therapist_dash.page_sections_desc")}
                  </p>
                  <LandingPageBuilder
                    sections={landingSections}
                    onChange={setLandingSections}
                    profileData={{
                      hasAbout: !!(dashboardData?.profile?.aboutMe),
                      hasFaq: Array.isArray(dashboardData?.profile?.faqItems) && (dashboardData.profile.faqItems as unknown[]).length > 0,
                      hasGallery: Array.isArray(dashboardData?.profile?.galleryImages) && (dashboardData.profile.galleryImages as unknown[]).length > 0,
                      hasSocialLinks: !!dashboardData?.profile?.socialLinks && Object.values(dashboardData.profile.socialLinks as Record<string, string>).some(Boolean),
                      hasCertifications: Array.isArray(dashboardData?.profile?.certifications) && (dashboardData.profile.certifications as unknown[]).length > 0,
                      hasConsultationIntro: !!consultationIntro.trim(),
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Verification Section */}
        {activeSection === "verification" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FeatureHint id="verification-upload" content={t("hint.verification_upload")} side="right">
                    <ShieldCheck className="h-5 w-5" />
                  </FeatureHint>
                  {t("therapist_dash.verification_tab")}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t("therapist_dash.verification_hint")}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {(["license", "diploma", "id_card", "cv"] as const).map((docType) => {
                  const existing = verifications.find((v) => v.documentType === docType);
                  const labelMap: Record<string, string> = {
                    license: t("verification.license"),
                    diploma: t("verification.diploma"),
                    id_card: t("verification.id_card"),
                    cv: t("verification.cv"),
                  };
                  const isUploading =
                    uploadVerificationMutation.isPending && verificationDocType === docType;

                  return (
                    <div
                      key={docType}
                      className="rounded-lg border p-4 space-y-3"
                      data-testid={`verification-card-${docType}`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{labelMap[docType]}</span>
                        </div>
                        {existing ? (
                          <Badge
                            variant={
                              existing.status === "approved"
                                ? "default"
                                : existing.status === "rejected"
                                  ? "destructive"
                                  : "secondary"
                            }
                            data-testid={`badge-status-${docType}`}
                          >
                            {existing.status === "approved"
                              ? t("verification.approved")
                              : existing.status === "rejected"
                                ? t("verification.rejected")
                                : t("verification.pending")}
                          </Badge>
                        ) : (
                          <Badge variant="outline">{t("verification.not_submitted")}</Badge>
                        )}
                      </div>

                      {existing?.reviewerNotes && (
                        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2 text-sm text-destructive">
                          <p className="font-medium text-xs mb-1">{t("verification.reviewer_notes")}</p>
                          {existing.reviewerNotes}
                        </div>
                      )}

                      {existing?.status !== "approved" && (
                        <div className="space-y-2">
                          <FileUpload
                            bucket="verification-documents"
                            folder="docs"
                            accept=".pdf,.jpg,.jpeg,.png"
                            maxSizeMB={10}
                            onUploadComplete={(url) => {
                              uploadVerificationMutation.mutate({ docType, docUrl: url });
                            }}
                            onError={(msg) => toast({ title: msg, variant: "destructive" })}
                          />
                        </div>
                      )}

                      {existing?.status === "approved" && (
                        <p className="text-xs text-muted-foreground">
                          {t("verification.approved_desc")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Availability Section */}
        {activeSection === "availability" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t("therapist_dash.availability_tab")}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t("therapist_dash.slots_calendar_desc")}
                </p>
              </CardHeader>
              <CardContent>
                <SlotCalendar
                  slots={slots}
                  therapistId={user?.id ?? ""}
                  defaultPriceDinar={profile?.rateDinar || 20}
                  defaultDurationMinutes={50}
                  invalidateKey={["/api/therapists", user?.id, "slots"]}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Clients Section */}
        {activeSection === "clients" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t("therapist_dash.clients_tab")}
                  <Badge variant="secondary" className="ms-1">{clientSummaries.length}</Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t("therapist_dash.clients_desc")}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {clientSummaries.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title={t("therapist_dash.no_clients")}
                    description="Clients who book sessions with you will appear here."
                  />
                ) : (
                  clientSummaries.map((summary) => {
                    const completedCount = summary.statuses.filter((s) => s === "completed").length;
                    const upcomingCount = summary.statuses.filter((s) => s === "pending" || s === "confirmed").length;
                    const clientName =
                      `${summary.user.firstName || ""} ${summary.user.lastName || ""}`.trim() ||
                      t("common.client");

                    return (
                      <div
                        key={summary.user.id}
                        className="flex items-center justify-between gap-3 rounded-lg border p-3 flex-wrap"
                        data-testid={`client-row-${summary.user.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <UserCircle className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{clientName}</p>
                            {summary.lastDate && (
                              <p className="text-xs text-muted-foreground">
                                {t("therapist_dash.last_session")}{" "}
                                {new Date(summary.lastDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {completedCount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle className="h-3 w-3 me-1" />
                              {completedCount} {t("therapist_dash.completed")}
                            </Badge>
                          )}
                          {upcomingCount > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Calendar className="h-3 w-3 me-1" />
                              {upcomingCount} {t("therapist_dash.upcoming")}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Earnings Section */}
        {activeSection === "earnings" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  {t("therapist_dash.earnings_tab")}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t("therapist_dash.earnings_desc")}
                </p>
              </CardHeader>
              <CardContent>
                {payouts.length === 0 ? (
                  <EmptyState
                    icon={DollarSign}
                    title={t("therapist_dash.no_payouts")}
                    description="Your payout history will appear here."
                  />
                ) : (
                  <div className="space-y-3">
                    {payouts.map((payout) => (
                      <div key={payout.id} className="rounded-lg border p-4 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <p className="text-sm font-medium">
                              {new Date(payout.periodStart).toLocaleDateString()} — {new Date(payout.periodEnd).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-muted-foreground">{payout.totalSessions} sessions</p>
                          </div>
                          <Badge
                            variant={payout.status === "paid" ? "default" : payout.status === "failed" ? "destructive" : "secondary"}
                            className="capitalize"
                          >
                            {payout.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">{t("payout.gross")}</p>
                            <p className="font-medium">{payout.totalAmountDinar} د.ت</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{t("payout.fee")}</p>
                            <p className="font-medium text-red-500">-{payout.platformFeeDinar} د.ت</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{t("payout.net")}</p>
                            <p className="font-semibold text-emerald-600">{payout.netAmountDinar} د.ت</p>
                          </div>
                        </div>
                        {payout.paidAt && (
                          <p className="text-xs text-muted-foreground">
                            {t("payout.paid_on")} {new Date(payout.paidAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Sessions Section */}
        {activeSection === "sessions" && (
          <SessionsTab appointments={appointments} userId={user?.id || ""} t={t} toast={toast} onOpenNotes={setSelectedSessionNotesId} />
        )}

        </div>
        {/* Session Notes Drawer */}
        <Sheet open={selectedSessionNotesId !== null} onOpenChange={(open) => !open && setSelectedSessionNotesId(null)}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto sm:border-l border-border p-0">
            <div className="p-6 h-full flex flex-col">
              <SheetHeader className="pb-4 border-b mb-4">
                <SheetTitle>{t("therapist_dash.session_notes")}</SheetTitle>
                <SheetDescription>
                  {t("therapist_dash.session_notes_desc")}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-6">
                {selectedSessionNotesId && (
                  <>
                    <SessionNotesPanel 
                      appointmentId={selectedSessionNotesId} 
                      therapistId={user?.id || ""} 
                      clientId={appointments.find(a => a.id === selectedSessionNotesId)?.clientId || ""} 
                      toast={toast} 
                      t={t} 
                    />
                    <PrepViewPanel appointmentId={selectedSessionNotesId} t={t} />
                  </>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </DashboardSidebarLayout>
    </AppLayout>
  );
}

// ---- Sessions Tab Component ----
function SessionsTab({
  appointments,
  userId,
  t,
  toast,
  onOpenNotes,
}: {
  appointments: (Appointment & { otherUser: User })[];
  userId: string;
  t: (k: string) => string;
  toast: any;
  onOpenNotes?: (id: number) => void;
}) {
  const therapistAppointments = appointments
    .filter((a) => a.therapistId === userId)
    .sort((a, b) => (b.scheduledAt > a.scheduledAt ? 1 : -1));

  if (therapistAppointments.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title={t("therapist_dash.no_sessions")}
        description="Completed sessions will appear here for note-taking."
      />
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          {t("therapist_dash.sessions_tab")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {therapistAppointments.map((apt) => (
          <div key={apt.id} className="rounded-lg border overflow-hidden">
            <div className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                  {(apt.otherUser.firstName?.[0] || "?").toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {apt.otherUser.firstName} {apt.otherUser.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(apt.scheduledAt).toLocaleDateString()} · {apt.status}
                  </p>
                </div>
              </div>
              {onOpenNotes && (
                <Button size="sm" variant="outline" onClick={() => onOpenNotes(apt.id)}>
                  {t("therapist_dash.view_notes")}
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Session notes + homework panel for therapist
function SessionNotesPanel({
  appointmentId,
  therapistId,
  clientId,
  toast,
  t,
}: {
  appointmentId: number;
  therapistId: string;
  clientId: string;
  toast: any;
  t: (k: string) => string;
}) {
  const [keyTopics, setKeyTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState("");
  const [therapistNotes, setTherapistNotes] = useState("");
  const [clientVisible, setClientVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [newHwDesc, setNewHwDesc] = useState("");
  const [newHwDue, setNewHwDue] = useState("");

  const { data: summary, refetch: refetchSummary } = useQuery<any>({
    queryKey: [`/api/session-summaries/${appointmentId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/session-summaries/${appointmentId}`);
      return res.json();
    },
  });

  const { data: homework = [], refetch: refetchHw } = useQuery<SessionHomework[]>({
    queryKey: [`/api/session-summaries/${appointmentId}/homework`],
    queryFn: async () => {
      if (!summary) return [];
      const res = await apiRequest("GET", `/api/session-summaries/${summary.id}/homework`);
      return res.json();
    },
    enabled: !!summary?.id,
  });

  useEffect(() => {
    if (summary && !loaded) {
      setKeyTopics(summary.keyTopics ?? []);
      setTherapistNotes(summary.therapistNotes ?? "");
      setClientVisible(summary.clientVisible ?? false);
      setLoaded(true);
    }
  }, [summary, loaded]);

  const saveSummaryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/session-summaries/${appointmentId}`, {
        keyTopics,
        therapistNotes,
        clientVisible,
      });
    },
    onSuccess: () => {
      refetchSummary();
      toast({ title: t("therapist_dash.notes_saved") });
    },
    onError: () => toast({ title: t("common.error"), variant: "destructive" }),
  });

  const addHwMutation = useMutation({
    mutationFn: async () => {
      if (!summary?.id) throw new Error("No summary");
      await apiRequest("POST", `/api/session-summaries/${summary.id}/homework`, {
        description: newHwDesc,
        dueDate: newHwDue || null,
      });
    },
    onSuccess: () => {
      refetchHw();
      setNewHwDesc("");
      setNewHwDue("");
      toast({ title: t("therapist_dash.homework_added") });
    },
    onError: () => toast({ title: t("common.error"), variant: "destructive" }),
  });

  const deleteHwMutation = useMutation({
    mutationFn: async (hwId: number) => {
      await apiRequest("DELETE", `/api/homework/${hwId}`);
    },
    onSuccess: () => refetchHw(),
  });

  return (
    <div className="space-y-4">
      {/* Session Notes */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("therapist_dash.session_notes")}</p>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("therapist_dash.key_topics")}</label>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {keyTopics.map((topic, i) => (
              <Badge key={i} variant="secondary" className="gap-1 text-xs">
                {topic}
                <button type="button" onClick={() => setKeyTopics(keyTopics.filter((_, j) => j !== i))}>
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && topicInput.trim()) {
                  setKeyTopics([...keyTopics, topicInput.trim()]);
                  setTopicInput("");
                }
              }}
              placeholder={t("therapist_dash.add_topic_placeholder")}
              className="text-xs h-8"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("therapist_dash.therapist_notes_private")}</label>
          <Textarea
            value={therapistNotes}
            onChange={(e) => setTherapistNotes(e.target.value)}
            rows={3}
            maxLength={5000}
            className="text-xs"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={clientVisible}
              onChange={(e) => setClientVisible(e.target.checked)}
              className="rounded"
            />
            {t("therapist_dash.share_with_client")}
          </label>
          <Button size="sm" onClick={() => saveSummaryMutation.mutate()} disabled={saveSummaryMutation.isPending}>
            {saveSummaryMutation.isPending && <Loader2 className="h-3 w-3 me-1.5 animate-spin" />}
            <Save className="h-3 w-3 me-1.5" />
            {t("therapist_dash.save_notes")}
          </Button>
        </div>
      </div>

      {/* Homework */}
      {summary?.id && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("therapist_dash.homework_assignments")}</p>

          {homework.length > 0 && (
            <div className="space-y-1.5">
              {homework.map((hw) => (
                <div key={hw.id} className={`flex items-start gap-2 rounded-md border p-2 text-xs ${hw.completed ? "opacity-60" : ""}`}>
                  <span className="mt-0.5">{hw.completed ? "✅" : "📝"}</span>
                  <div className="flex-1 min-w-0">
                    <p className={hw.completed ? "line-through text-muted-foreground" : ""}>{hw.description}</p>
                    {hw.dueDate && <p className="text-muted-foreground">{t("therapist_dash.due_label")} {new Date(hw.dueDate).toLocaleDateString()}</p>}
                    {hw.clientNotes && <p className="text-muted-foreground italic">{t("therapist_dash.client_note")} {hw.clientNotes}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteHwMutation.mutate(hw.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={newHwDesc}
              onChange={(e) => setNewHwDesc(e.target.value)}
              placeholder={t("therapist_dash.assign_homework_placeholder")}
              className="text-xs h-8 flex-1"
            />
            <Input
              type="date"
              value={newHwDue}
              onChange={(e) => setNewHwDue(e.target.value)}
              className="text-xs h-8 w-36"
            />
            <Button
              size="sm"
              className="h-8"
              onClick={() => addHwMutation.mutate()}
              disabled={!newHwDesc || addHwMutation.isPending}
            >
              {addHwMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Consultation prep viewer for therapist
function PrepViewPanel({ appointmentId, t }: { appointmentId: number; t: (k: string) => string }) {
  const { data: prep } = useQuery<any>({
    queryKey: [`/api/appointments/${appointmentId}/prep`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/appointments/${appointmentId}/prep`);
      return res.json();
    },
  });

  const MOOD_EMOJIS = ["😢", "😔", "😐", "🙂", "😊"];

  return (
    <div className="rounded-lg border border-dashed p-3 space-y-2 bg-muted/10">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <ClipboardList className="h-3.5 w-3.5" />
        {t("therapist_dash.client_session_prep")}
      </p>
      {!prep ? (
        <p className="text-xs text-muted-foreground italic">No prep submitted yet.</p>
      ) : (
        <>
          <p className="text-xs"><span className="font-medium">{t("therapist_dash.whats_on_mind")}</span> {prep.whatsOnMind}</p>
          {prep.goalsForSession && <p className="text-xs"><span className="font-medium">{t("therapist_dash.goals_label")}</span> {prep.goalsForSession}</p>}
          {prep.currentMood && (
            <p className="text-xs"><span className="font-medium">{t("therapist_dash.pre_session_mood")}</span> {MOOD_EMOJIS[prep.currentMood - 1]} ({prep.currentMood}/5)</p>
          )}
        </>
      )}
    </div>
  );
}
