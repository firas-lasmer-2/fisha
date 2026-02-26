import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
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
  Palette,
  Link2,
  Send,
  CheckCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import type { TherapistProfile, TherapistReview, TherapistSlot } from "@shared/schema";

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

const THEME_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#f43f5e",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
];

export default function TherapistDashboardPage() {
  const { t, isRTL } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const [headline, setHeadline] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [approach, setApproach] = useState("");
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [videoIntroUrl, setVideoIntroUrl] = useState("");
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [slug, setSlug] = useState("");
  const [themeColor, setThemeColor] = useState("");
  const [acceptingNewClients, setAcceptingNewClients] = useState(true);
  const [respondingTo, setRespondingTo] = useState<number | null>(null);
  const [responseText, setResponseText] = useState("");
  const [formLoaded, setFormLoaded] = useState(false);
  const [slotStartsAt, setSlotStartsAt] = useState("");
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(50);
  const [slotPriceDinar, setSlotPriceDinar] = useState(20);

  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/therapist/dashboard"],
  });

  const { data: slots = [] } = useQuery<TherapistSlot[]>({
    queryKey: ["/api/therapists", user?.id, "slots"],
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (dashboardData?.profile && !formLoaded) {
      const p = dashboardData.profile;
      setHeadline(p.headline || "");
      setAboutMe(p.aboutMe || "");
      setApproach(p.approach || "");
      setFaqItems((p.faqItems as FaqItem[]) || []);
      setVideoIntroUrl(p.videoIntroUrl || "");
      setSocialLinks((p.socialLinks as SocialLinks) || {});
      setSlug(p.slug || "");
      setThemeColor(p.profileThemeColor || "");
      setAcceptingNewClients(p.acceptingNewClients ?? true);
      setSlotPriceDinar(p.rateDinar || 20);
      setFormLoaded(true);
    }
  }, [dashboardData, formLoaded]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/therapists", {
        headline,
        aboutMe,
        approach,
        faqItems,
        videoIntroUrl: videoIntroUrl || null,
        socialLinks,
        slug: slug || null,
        profileThemeColor: themeColor || null,
        acceptingNewClients,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/therapist/dashboard"] });
      toast({
        title: t("profile.save_changes"),
        description: t("therapist_dash.changes_saved"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        variant: "destructive",
      });
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

  const createSlotMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/therapist/slots", {
        startsAt: slotStartsAt,
        durationMinutes: slotDurationMinutes,
        priceDinar: slotPriceDinar,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/therapists", user?.id, "slots"] });
      setSlotStartsAt("");
      setSlotDurationMinutes(50);
      setSlotPriceDinar(profile?.rateDinar || 20);
      toast({ title: t("slots.published_success") });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const cancelSlotMutation = useMutation({
    mutationFn: async (slotId: number) => {
      await apiRequest("DELETE", `/api/therapist/slots/${slotId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/therapists", user?.id, "slots"] });
      toast({ title: t("slots.cancelled_success") });
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

  const profile = dashboardData?.profile;
  const reviews = dashboardData?.recentReviews || [];
  const totalSessions = dashboardData?.stats?.totalSessions || 0;
  const openSlots = slots.filter((slot) => slot.status === "open");

  const profileUrl = profile?.userId
    ? `/therapist/${profile.userId}`
    : null;

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
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-dashboard-title">
              {t("therapist_dash.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("therapist_dash.your_page")}
            </p>
          </div>
          {profileUrl && (
            <Link href={profileUrl}>
              <Button variant="outline" data-testid="link-preview-profile">
                <ExternalLink className="h-4 w-4 me-2" />
                {t("therapist_dash.preview_page")}
              </Button>
            </Link>
          )}
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <Card data-testid="card-stat-reviews">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-reviews">
                  {profile?.reviewCount || 0}
                </p>
                <p className="text-xs text-muted-foreground">{t("therapist_dash.total_reviews")}</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-rating">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-chart-4/10 flex items-center justify-center shrink-0">
                <BarChart3 className="h-5 w-5 text-chart-4" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-avg-rating">
                  {profile?.rating?.toFixed(1) || "0.0"}
                </p>
                <p className="text-xs text-muted-foreground">{t("therapist_dash.avg_rating")}</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-sessions">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-sessions">
                  {totalSessions}
                </p>
                <p className="text-xs text-muted-foreground">{t("therapist_dash.total_sessions")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList data-testid="tabs-dashboard">
            <TabsTrigger value="profile" data-testid="tab-profile">
              <ClipboardList className="h-4 w-4 me-1.5" />
              {t("profile.edit_profile")}
            </TabsTrigger>
            <TabsTrigger value="reviews" data-testid="tab-reviews">
              <MessageCircle className="h-4 w-4 me-1.5" />
              {t("review.title")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
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
                    {t("tier.label")}: {profile?.tier === "student" ? t("tier.student_therapist") : t("tier.professional_therapist")}
                  </Badge>
                  {profile?.tier === "student" && (
                    <Badge variant="secondary">
                      {t("tier.student_cap_20")}
                    </Badge>
                  )}
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

                <Separator />

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

                <Separator />

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

                <div className="space-y-3">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    {t("therapist_dash.theme_color")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {THEME_COLORS.map((color) => (
                      <button
                        key={color}
                        className={`w-8 h-8 rounded-md transition-all ${
                          themeColor === color
                            ? "ring-2 ring-offset-2 ring-foreground scale-110"
                            : ""
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setThemeColor(themeColor === color ? "" : color)}
                        data-testid={`button-color-${color.replace("#", "")}`}
                      />
                    ))}
                  </div>
                </div>

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

                <Separator />

                <div className="space-y-3">
                  <label className="text-sm font-medium">{t("slots.published_title")}</label>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <Input
                      type="datetime-local"
                      value={slotStartsAt}
                      onChange={(e) => setSlotStartsAt(e.target.value)}
                    />
                    <Input
                      type="number"
                      min={1}
                      value={slotDurationMinutes}
                      onChange={(e) => setSlotDurationMinutes(Number(e.target.value))}
                    />
                    <Input
                      type="number"
                      min={0}
                      value={slotPriceDinar}
                      onChange={(e) => setSlotPriceDinar(Number(e.target.value))}
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => createSlotMutation.mutate()}
                    disabled={
                      createSlotMutation.isPending
                      || !slotStartsAt
                      || slotDurationMinutes <= 0
                      || slotPriceDinar < 0
                    }
                  >
                    <Calendar className="h-4 w-4 me-2" />
                    {t("slots.publish")}
                  </Button>

                  <div className="space-y-2">
                    {openSlots.length > 0 ? (
                      openSlots.map((slot) => (
                        <div
                          key={slot.id}
                          className="border rounded-md p-3 flex items-center justify-between gap-2"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {new Date(slot.startsAt).toLocaleDateString()}{" "}
                              {new Date(slot.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 inline me-1" />
                              {slot.durationMinutes} {t("common.minutes")} • {slot.priceDinar} {t("common.dinar")}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => cancelSlotMutation.mutate(slot.id)}
                            disabled={cancelSlotMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 me-1" />
                            {t("slots.cancel")}
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("slots.none_published")}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews" className="space-y-4">
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
                  <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-reviews">
                    {t("review.no_reviews")}
                  </p>
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
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
