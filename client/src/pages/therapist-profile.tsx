import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Link } from "wouter";
import {
  Star,
  MapPin,
  Globe,
  CheckCircle,
  Video,
  Calendar,
  Clock,
  MessageCircle,
  Shield,
  Brain,
  Users,
  Sparkles,
  GraduationCap,
  Heart,
  Send,
  Play,
  Image,
  Share2,
  CreditCard,
  Receipt,
} from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PaymentDialog } from "@/components/payment-dialog";
import { useToast } from "@/hooks/use-toast";
import { useOnlineTherapists } from "@/hooks/use-online-therapists";
import { motion } from "framer-motion";
import type { Appointment, TherapistProfile, TherapistSlot, User, TherapistReview, UserSubscription } from "@shared/schema";

const sectionVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const DAYS_MAP: Record<string, { ar: string; fr: string }> = {
  monday: { ar: "الإثنين", fr: "Lundi" },
  tuesday: { ar: "الثلاثاء", fr: "Mardi" },
  wednesday: { ar: "الأربعاء", fr: "Mercredi" },
  thursday: { ar: "الخميس", fr: "Jeudi" },
  friday: { ar: "الجمعة", fr: "Vendredi" },
  saturday: { ar: "السبت", fr: "Samedi" },
  sunday: { ar: "الأحد", fr: "Dimanche" },
};

const ALL_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-6 w-6" : "h-5 w-5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={readonly ? "cursor-default" : "cursor-pointer"}
          onClick={() => onChange?.(star)}
          data-testid={readonly ? undefined : `star-${star}`}
        >
          <Star
            className={`${sizeClass} ${
              star <= value
                ? "fill-chart-4 text-chart-4"
                : "text-muted-foreground/30"
            } transition-colors`}
          />
        </button>
      ))}
    </div>
  );
}

export default function TherapistProfilePage() {
  const { t, isRTL, language } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const onlineTherapists = useOnlineTherapists();

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [overallRating, setOverallRating] = useState(0);
  const [helpfulnessRating, setHelpfulnessRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState(0);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [selectedSessionType, setSelectedSessionType] = useState<"chat" | "video" | "audio">("chat");
  const [bookingNotes, setBookingNotes] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"flouci" | "konnect" | null>(null);
  const [paymentRedirectUrl, setPaymentRedirectUrl] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<{ appointment: Appointment; slot: TherapistSlot; paymentUrl?: string | null } | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [quickBookSlot, setQuickBookSlot] = useState<TherapistSlot | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery<
    TherapistProfile & { user: User }
  >({
    queryKey: ["/api/therapists", userId],
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery<
    (TherapistReview & { client?: User })[]
  >({
    queryKey: ["/api/therapists", userId, "reviews"],
  });

  const { data: slots = [], isLoading: slotsLoading } = useQuery<TherapistSlot[]>({
    queryKey: ["/api/therapists", userId, "slots"],
    enabled: !!userId,
  });

  const { data: userSubscriptions = [] } = useQuery<UserSubscription[]>({
    queryKey: ["/api/subscriptions/mine"],
    enabled: !!user,
  });
  const activeSub = userSubscriptions.find(
    (s) => s.status === "active" && s.sessionsRemaining > 0,
  ) ?? null;

  const { data: allTherapists = [] } = useQuery<(TherapistProfile & { user: User })[]>({
    queryKey: ["/api/therapists"],
    enabled: !!profile,
  });

  // Gate reviews: only users who have had a confirmed/completed appointment with this therapist can review
  const { data: myAppointments = [] } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
    enabled: !!user,
  });
  const hasInteractedWithTherapist = myAppointments.some(
    (a) => a.therapistId === userId && ["confirmed", "completed"].includes(a.status),
  );

  const confirmBookingMutation = useMutation({
    mutationFn: async (payMethod?: "flouci" | "konnect" | "subscription") => {
      if (!selectedSlotId) throw new Error("No slot selected");
      const res = await apiRequest("POST", `/api/appointments/from-slot/${selectedSlotId}`, {
        sessionType: selectedSessionType,
        notes: bookingNotes || null,
        paymentMethod: payMethod || "flouci",
      });
      return res.json() as Promise<{ appointment: Appointment; slot: TherapistSlot; paymentUrl?: string | null }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/therapists", userId, "slots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setBookingResult(result);
      if (result.paymentUrl) {
        setPaymentRedirectUrl(result.paymentUrl);
        setBookingStep(2);
      } else {
        setBookingStep(2);
      }
      toast({ title: t("slots.booked_success") });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (method: "flouci" | "konnect") => {
      if (!bookingResult) throw new Error("No booking result");
      const endpoint = method === "flouci"
        ? "/api/payments/flouci/initiate"
        : "/api/payments/konnect/initiate";
      const amount = bookingResult.appointment.priceDinar || bookingResult.slot.priceDinar;
      const response = await apiRequest("POST", endpoint, {
        appointmentId: bookingResult.appointment.id,
        therapistId: bookingResult.appointment.therapistId,
        amount,
      });
      return response.json() as Promise<{ redirectUrl?: string }>;
    },
    onSuccess: (result, method) => {
      setSelectedPaymentMethod(method);
      setPaymentRedirectUrl(result.redirectUrl || null);
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const isTherapistOnline = userId ? onlineTherapists.has(userId) : false;
  const openSlots = slots.filter((slot) => slot.status === "open");
  const selectedSlot = openSlots.find((slot) => slot.id === selectedSlotId) || bookingResult?.slot || null;

  const openBookingFlow = (slotId?: number) => {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setBookingDialogOpen(true);
    setBookingStep(0);
    setSelectedSlotId(slotId || openSlots[0]?.id || null);
    setSelectedSessionType("chat");
    setBookingNotes("");
    setBookingResult(null);
    setSelectedPaymentMethod(null);
    setPaymentRedirectUrl(null);
  };

  const closeBookingFlow = (open: boolean) => {
    setBookingDialogOpen(open);
    if (!open) {
      setBookingStep(0);
      setSelectedPaymentMethod(null);
      setPaymentRedirectUrl(null);
      setBookingResult(null);
      setBookingNotes("");
    }
  };

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/therapists/${userId}/reviews`, {
        therapistId: userId,
        overallRating,
        helpfulnessRating,
        communicationRating,
        comment: reviewComment || undefined,
        isAnonymous,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/therapists", userId, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/therapists", userId] });
      setReviewDialogOpen(false);
      setOverallRating(0);
      setHelpfulnessRating(0);
      setCommunicationRating(0);
      setReviewComment("");
      setIsAnonymous(true);
      toast({
        title: t("review.thank_you"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        variant: "destructive",
      });
    },
  });

  const specializations = [
    { value: "anxiety", label: t("specialization.anxiety"), icon: Brain },
    { value: "depression", label: t("specialization.depression"), icon: Brain },
    { value: "relationships", label: t("specialization.relationships"), icon: Users },
    { value: "trauma", label: t("specialization.trauma"), icon: Shield },
    { value: "stress", label: t("specialization.stress"), icon: Brain },
    { value: "self_esteem", label: t("specialization.self_esteem"), icon: Sparkles },
    { value: "grief", label: t("specialization.grief"), icon: Brain },
    { value: "family", label: t("specialization.family"), icon: Users },
    { value: "couples", label: t("specialization.couples"), icon: Users },
    { value: "addiction", label: t("specialization.addiction"), icon: Shield },
  ];

  const getSpecLabel = (val: string) =>
    specializations.find((s) => s.value === val)?.label || val;

  const getDayLabel = (day: string) => {
    const d = DAYS_MAP[day.toLowerCase()];
    if (!d) return day;
    return language === "fr" ? d.fr : d.ar;
  };

  const faqItems = (profile?.faqItems as { question: string; answer: string }[] | null) || [];

  if (profileLoading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
          <div className="flex items-start gap-4">
            <Skeleton className="w-20 h-20 rounded-xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-4 sm:p-6 text-center py-20">
          <p className="text-muted-foreground" data-testid="text-profile-not-found">
            {t("profile.not_found")}
          </p>
        </div>
      </AppLayout>
    );
  }

  const fullName = `${profile.user.firstName || ""} ${profile.user.lastName || ""}`.trim();
  const avgRating = profile.rating || 0;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-28 sm:pb-6 space-y-8">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          className="relative"
        >
          <Card data-testid="section-hero">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start gap-5">
                <Avatar className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl">
                  {profile.user.profileImageUrl && (
                    <AvatarImage src={profile.user.profileImageUrl} alt={fullName} />
                  )}
                  <AvatarFallback className="rounded-xl gradient-calm text-white text-2xl font-bold">
                    {(profile.user.firstName?.[0] || "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1
                      className="text-2xl sm:text-3xl font-bold"
                      data-testid="text-therapist-name"
                    >
                      {fullName}
                    </h1>
                    {profile.verified && (
                      <Badge
                        variant="secondary"
                        className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        data-testid="badge-verified"
                      >
                        <CheckCircle className="h-3 w-3 me-0.5" />
                        {t("therapist.verified")}
                      </Badge>
                    )}
                    {profile.tier === "premium_doctor" ? (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-400/50 gap-1">
                        ✦ {t("tier.premium_doctor_therapist")}
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        {t("tier.graduated_doctor_therapist")}
                      </Badge>
                    )}
                  </div>

                  {profile.headline && (
                    <p
                      className="text-muted-foreground"
                      data-testid="text-headline"
                    >
                      {profile.headline}
                    </p>
                  )}

                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <StarRating value={Math.round(avgRating)} readonly size="sm" />
                      <span className="text-sm font-medium">{avgRating.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">
                        ({profile.reviewCount || 0} {t("therapist.reviews")})
                      </span>
                    </div>

                    {profile.yearsExperience && profile.yearsExperience > 0 && (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {profile.yearsExperience} {t("profile.years_exp")}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {isTherapistOnline && (
                      <Badge
                        variant="secondary"
                        className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1.5"
                        data-testid="badge-online-now"
                      >
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        {t("therapist.online_now")}
                      </Badge>
                    )}

                    {profile.acceptingNewClients ? (
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" data-testid="badge-accepting">
                        <CheckCircle className="h-3 w-3 me-1" />
                        {t("profile.accepting_new")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-muted-foreground" data-testid="badge-not-accepting">
                        {t("profile.not_accepting")}
                      </Badge>
                    )}

                    {profile.acceptsOnline && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Video className="h-3 w-3 text-primary" />
                        {t("therapist.online")}
                      </span>
                    )}
                    {profile.acceptsInPerson && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 text-primary" />
                        {t("therapist.in_person")}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-0.5" data-testid="text-rate">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {t("therapist.free_to_message") === "therapist.free_to_message" ? "Free to message" : t("therapist.free_to_message")}
                    </span>
                    {profile.rateDinar && (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Video className="h-3.5 w-3.5" />
                        {profile.rateDinar} {t("common.dinar")} / {t("therapist.per_session")}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <Link href={`/messages?therapist=${userId}`}>
                      <Button size="sm" className="gap-1.5" data-testid="button-message-hero">
                        <MessageCircle className="h-3.5 w-3.5" />
                        {t("profile.send_message")}
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => openBookingFlow()}
                      data-testid="button-book-session-hero"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      {profile.rateDinar
                        ? `${t("profile.book_session")} · ${profile.rateDinar} ${t("common.dinar")}`
                        : t("profile.book_session")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      data-testid="button-share-profile"
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href).then(() => {
                          toast({
                            title: t("profile.link_copied"),
                          });
                        });
                      }}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      {t("profile.share_profile")}
                    </Button>
                  </div>

                  {/* Ecosystem value strip */}
                  <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> Free messages</span>
                    <span className="text-muted-foreground/40">→</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Book when ready</span>
                    <span className="text-muted-foreground/40">→</span>
                    <span className="flex items-center gap-1"><Star className="h-3 w-3" /> Leave a review</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {(profile.aboutMe || profile.approach || profile.education) && (
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            <Card data-testid="section-about">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-primary" />
                  {t("profile.about_me")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {profile.aboutMe && (
                  <div data-testid="text-about-me">
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                      {profile.aboutMe}
                    </p>
                  </div>
                )}

                {profile.approach && (
                  <>
                    <Separator />
                    <div data-testid="text-approach">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Brain className="h-4 w-4 text-primary" />
                        {t("profile.my_approach")}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                        {profile.approach}
                      </p>
                    </div>
                  </>
                )}

                {profile.education && (
                  <>
                    <Separator />
                    <div data-testid="text-education">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-primary" />
                        {t("profile.education_cert")}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                        {profile.education}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {profile.specializations && profile.specializations.length > 0 && (
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            <Card data-testid="section-specializations">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  {t("therapist.specialization")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="flex flex-wrap gap-2"
                >
                  {profile.specializations.map((spec, i) => {
                    const specInfo = specializations.find((s) => s.value === spec);
                    const Icon = specInfo?.icon || Brain;
                    return (
                      <motion.div
                        key={spec}
                        variants={{
                          hidden: { opacity: 0, scale: 0.8 },
                          visible: { opacity: 1, scale: 1 },
                        }}
                      >
                        <Badge
                          variant="secondary"
                          className="gap-1.5 text-sm"
                          data-testid={`badge-specialization-${spec}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {getSpecLabel(spec)}
                        </Badge>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* How it works — ecosystem strip */}
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          <div className="safe-surface rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">How it works</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="space-y-1">
                <div className="mx-auto h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xs font-medium">Message for free</p>
                <p className="text-xs text-muted-foreground">Start a conversation, no commitment</p>
              </div>
              <div className="space-y-1">
                <div className="mx-auto h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xs font-medium">Book a live session</p>
                <p className="text-xs text-muted-foreground">20 TND via Jitsi Meet, when you're ready</p>
              </div>
              <div className="space-y-1">
                <div className="mx-auto h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Star className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xs font-medium">Share feedback</p>
                <p className="text-xs text-muted-foreground">Help others find the right therapist</p>
              </div>
            </div>
          </div>
        </motion.div>

        {profile.availableDays && profile.availableDays.length > 0 && (
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            <Card data-testid="section-availability">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  {t("profile.availability")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  {profile.acceptsOnline && (
                    <Badge variant="secondary" data-testid="badge-online">
                      <Video className="h-3 w-3 me-1" />
                      {t("therapist.online")}
                    </Badge>
                  )}
                  {profile.acceptsInPerson && (
                    <Badge variant="secondary" data-testid="badge-in-person">
                      <MapPin className="h-3 w-3 me-1" />
                      {t("therapist.in_person")}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {ALL_DAYS.map((day) => {
                    const isAvailable = profile.availableDays?.includes(day);
                    return (
                      <div
                        key={day}
                        className={`text-center p-2 sm:p-3 rounded-md text-xs sm:text-sm transition-colors ${
                          isAvailable
                            ? "bg-primary/10 text-primary font-medium border border-primary/20"
                            : "bg-muted/50 text-muted-foreground/50"
                        }`}
                        data-testid={`day-${day}`}
                      >
                        <div className="font-medium truncate">{getDayLabel(day)}</div>
                        {isAvailable && (
                          <div className="text-[10px] sm:text-xs mt-1 text-muted-foreground">
                            {profile.availableHoursStart} - {profile.availableHoursEnd}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {profile.officeAddress && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground mt-2">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <span data-testid="text-office-address">{profile.officeAddress}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div
          id="slots"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          <Card data-testid="section-slots">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {t("slots.available_title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {slotsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : openSlots.length > 0 ? (
                <div className="space-y-2">
                  {openSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="border rounded-md p-3 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(slot.startsAt).toLocaleDateString()}{" "}
                          {new Date(slot.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {slot.durationMinutes} {t("common.minutes")} • {slot.priceDinar} {t("common.dinar")}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!user) { window.location.href = "/login"; return; }
                          setQuickBookSlot(slot);
                          setSelectedSlotId(slot.id);
                          setPaymentDialogOpen(true);
                        }}
                        data-testid={`button-book-slot-${slot.id}`}
                      >
                        {t("profile.book_session")}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("slots.no_open_now")}</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <Dialog open={bookingDialogOpen} onOpenChange={closeBookingFlow}>
          <DialogContent className="sm:max-w-2xl" data-testid="dialog-booking-flow">
            <DialogHeader>
              <DialogTitle>{tr("booking.title", "Book your session")}</DialogTitle>
              <DialogDescription>
                {tr("booking.subtitle", "Pick a slot, confirm details, then complete payment.")}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2 text-xs">
              {[
                tr("booking.step_pick", "Pick slot"),
                tr("booking.step_confirm", "Confirm"),
                tr("booking.step_pay", "Pay"),
              ].map((label, index) => (
                <Badge
                  key={label}
                  variant={bookingStep >= index ? "secondary" : "outline"}
                  className="text-[11px]"
                >
                  {index + 1}. {label}
                </Badge>
              ))}
            </div>

            {bookingStep === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {tr("booking.pick_prompt", "Choose one available slot.")}
                </p>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {openSlots.length > 0 ? (
                    openSlots.map((slot) => {
                      const selected = selectedSlotId === slot.id;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setSelectedSlotId(slot.id)}
                          className={`w-full text-start rounded-md border p-3 transition-colors ${selected ? "bg-primary/10 border-primary/30" : "hover:bg-muted/40"}`}
                        >
                          <p className="text-sm font-medium">
                            {new Date(slot.startsAt).toLocaleDateString()}{" "}
                            {new Date(slot.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {slot.durationMinutes} {t("common.minutes")} • {slot.priceDinar} {t("common.dinar")}
                          </p>
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("slots.no_open_now")}</p>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => setBookingStep(1)}
                    disabled={!selectedSlotId}
                    data-testid="button-booking-next-step"
                  >
                    {t("common.next")}
                  </Button>
                </div>
              </div>
            )}

            {bookingStep === 1 && selectedSlot && (
              <div className="space-y-4">
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium">
                    {new Date(selectedSlot.startsAt).toLocaleDateString()}{" "}
                    {new Date(selectedSlot.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedSlot.durationMinutes} {t("common.minutes")} • {selectedSlot.priceDinar} {t("common.dinar")}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">{tr("booking.session_type", "Session type")}</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "chat", label: t("appointment.chat") },
                      { value: "video", label: t("appointment.video") },
                      { value: "audio", label: t("appointment.audio") },
                    ].map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        size="sm"
                        variant={selectedSessionType === option.value ? "default" : "outline"}
                        onClick={() => setSelectedSessionType(option.value as "chat" | "video" | "audio")}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">{tr("booking.notes_optional", "Notes (optional)")}</p>
                  <Textarea
                    value={bookingNotes}
                    onChange={(event) => setBookingNotes(event.target.value)}
                    rows={3}
                    placeholder={tr("booking.notes_placeholder", "Share anything the therapist should know before the session.")}
                  />
                </div>

                <div className="flex justify-between gap-2">
                  <Button variant="outline" onClick={() => setBookingStep(0)}>
                    {t("common.back")}
                  </Button>
                  <Button
                    onClick={() => confirmBookingMutation.mutate("flouci")}
                    disabled={confirmBookingMutation.isPending}
                    data-testid="button-booking-confirm"
                  >
                    {confirmBookingMutation.isPending ? t("common.loading") : tr("booking.confirm", "Confirm details")}
                  </Button>
                </div>
              </div>
            )}

            {bookingStep === 2 && bookingResult && (
              <div className="space-y-4">
                <div className="rounded-lg border p-3 bg-muted/40">
                  <p className="text-sm font-medium">
                    {tr("booking.payment_prompt", "Complete payment to finalize your booking.")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {tr("booking.amount_due", "Amount due")}: {bookingResult.appointment.priceDinar || bookingResult.slot.priceDinar} {t("common.dinar")}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    variant={selectedPaymentMethod === "flouci" ? "default" : "outline"}
                    className="justify-start gap-2"
                    onClick={() => paymentMutation.mutate("flouci")}
                    disabled={paymentMutation.isPending}
                    data-testid="button-pay-flouci"
                  >
                    <CreditCard className="h-4 w-4" />
                    Flouci
                  </Button>
                  <Button
                    variant={selectedPaymentMethod === "konnect" ? "default" : "outline"}
                    className="justify-start gap-2"
                    onClick={() => paymentMutation.mutate("konnect")}
                    disabled={paymentMutation.isPending}
                    data-testid="button-pay-konnect"
                  >
                    <Receipt className="h-4 w-4" />
                    Konnect
                  </Button>
                </div>

                {paymentRedirectUrl ? (
                  <div className="space-y-2 rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{tr("booking.redirect_ready", "Payment link is ready.")}</p>
                    <a href={paymentRedirectUrl} target="_blank" rel="noreferrer">
                      <Button className="w-full" data-testid="button-open-payment-link">
                        {tr("booking.open_payment", "Open payment page")}
                      </Button>
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {tr("booking.select_provider", "Select a payment provider to continue.")}
                  </p>
                )}

                <div className="flex justify-between gap-2">
                  <Button variant="outline" onClick={() => setBookingStep(1)}>
                    {t("common.back")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setBookingDialogOpen(false)}
                    data-testid="button-booking-finish-later"
                  >
                    {tr("booking.finish_later", "Finish later")}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {profile.officePhotos && profile.officePhotos.length > 0 && (
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            <Card data-testid="section-gallery">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5 text-primary" />
                  {t("profile.office_gallery")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {profile.officePhotos.map((photo, i) => (
                    <div
                      key={i}
                      className="aspect-video rounded-md overflow-hidden bg-muted"
                      data-testid={`img-gallery-${i}`}
                    >
                      <img
                        src={photo}
                        alt={`${fullName} office ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {profile.videoIntroUrl && (
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            <Card data-testid="section-video">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5 text-primary" />
                  {t("profile.video_intro")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video rounded-md overflow-hidden bg-muted">
                  <iframe
                    src={profile.videoIntroUrl}
                    title={`${fullName} intro`}
                    className="w-full h-full"
                    allowFullScreen
                    data-testid="video-intro"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {faqItems.length > 0 && (
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            <Card data-testid="section-faq">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  {t("profile.faq")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple">
                  {faqItems.map((item, i) => (
                    <AccordionItem key={i} value={`faq-${i}`}>
                      <AccordionTrigger
                        className="text-sm text-start"
                        data-testid={`faq-trigger-${i}`}
                      >
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent data-testid={`faq-content-${i}`}>
                        <p className="text-sm text-muted-foreground">{item.answer}</p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          <Card data-testid="section-reviews">
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                {t("review.all_reviews")}
                {profile.reviewCount ? (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({profile.reviewCount})
                  </span>
                ) : null}
              </CardTitle>

              {user && hasInteractedWithTherapist && (
                <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-write-review">
                      <Send className="h-3.5 w-3.5 me-1.5" />
                      {t("review.write_review")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent data-testid="dialog-review">
                    <DialogHeader>
                      <DialogTitle>{t("review.write_review")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5 pt-2">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-sm font-medium">{t("review.overall")}</label>
                          <StarRating value={overallRating} onChange={setOverallRating} />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-sm font-medium">{t("review.helpfulness")}</label>
                          <StarRating value={helpfulnessRating} onChange={setHelpfulnessRating} />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-sm font-medium">{t("review.communication")}</label>
                          <StarRating value={communicationRating} onChange={setCommunicationRating} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("review.comment")}</label>
                        <Textarea
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          placeholder={t("review.comment_placeholder")}
                          rows={4}
                          data-testid="textarea-review-comment"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{t("review.anonymous")}</p>
                          <p className="text-xs text-muted-foreground">{t("review.anonymous_desc")}</p>
                        </div>
                        <Switch
                          checked={isAnonymous}
                          onCheckedChange={setIsAnonymous}
                          data-testid="switch-anonymous"
                        />
                      </div>

                      <Button
                        className="w-full"
                        disabled={overallRating === 0 || reviewMutation.isPending}
                        onClick={() => reviewMutation.mutate()}
                        data-testid="button-submit-review"
                      >
                        {reviewMutation.isPending ? (
                          <span className="animate-spin me-2">
                            <Star className="h-4 w-4" />
                          </span>
                        ) : (
                          <Send className="h-4 w-4 me-2" />
                        )}
                        {t("review.submit")}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              {user && !hasInteractedWithTherapist && (
                <p className="text-xs text-muted-foreground italic">
                  Book a session to leave a review.
                </p>
              )}
            </CardHeader>
            <CardContent>
              {reviewsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  ))}
                </div>
              ) : reviews && reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="space-y-2"
                      data-testid={`review-${review.id}`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="text-xs">
                              {review.isAnonymous
                                ? "?"
                                : (review.client?.firstName?.[0] || "?").toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium" data-testid={`text-reviewer-name-${review.id}`}>
                              {review.isAnonymous
                                ? t("common.anonymous")
                                : `${review.client?.firstName || ""} ${review.client?.lastName || ""}`.trim() || t("common.user")}
                            </p>
                            {review.createdAt && (
                              <p className="text-xs text-muted-foreground">
                                {new Date(review.createdAt).toLocaleDateString(
                                  isRTL ? "ar-TN" : "fr-TN"
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        <StarRating value={review.overallRating} readonly size="sm" />
                      </div>

                      {(review.helpfulnessRating || review.communicationRating) && (
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
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
                      )}

                      {review.comment && (
                        <p className="text-sm text-muted-foreground" data-testid={`text-review-comment-${review.id}`}>
                          {review.comment}
                        </p>
                      )}

                      {review.therapistResponse && (
                        <div className="ms-6 p-3 rounded-md bg-muted/50 border-s-2 border-primary/30" data-testid={`text-therapist-response-${review.id}`}>
                          <p className="text-xs font-medium text-primary mb-1">
                            {t("review.response")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {review.therapistResponse}
                          </p>
                        </div>
                      )}

                      <Separator />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-reviews">
                  {t("review.no_reviews")}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Similar Therapists */}
      {(() => {
        const similar = allTherapists
          .filter((t) => t.userId !== userId && t.verified)
          .filter((t) =>
            profile?.specializations?.some((s) => t.specializations?.includes(s))
          )
          .slice(0, 3);
        if (similar.length === 0) return null;
        return (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-6">
            <h2 className="text-lg font-semibold mb-3">Similar therapists</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {similar.map((t) => (
                <Link key={t.userId} href={`/therapists/${t.userId}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="p-4 space-y-1">
                      <p className="font-medium text-sm truncate">
                        {t.user.firstName} {t.user.lastName}
                      </p>
                      {t.specializations && t.specializations.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate">
                          {t.specializations.slice(0, 2).join(" · ")}
                        </p>
                      )}
                      {t.rateDinar && (
                        <p className="text-xs font-medium text-primary">{t.rateDinar} TND / session</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="fixed bottom-0 left-0 right-0 sm:hidden z-40 glass-effect border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" data-testid="sticky-cta-bar">
        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          <Link href={`/messages?therapist=${userId}`} className="flex-1">
            <Button
              variant="outline"
              className="w-full gap-1.5"
              data-testid="button-cta-message"
            >
              <MessageCircle className="h-4 w-4" />
              {t("profile.send_message")}
            </Button>
          </Link>
          <Button
            className="w-full gap-1.5 flex-1"
            onClick={() => openBookingFlow()}
            data-testid="button-cta-book"
          >
            <Calendar className="h-4 w-4" />
            {t("profile.book_session")}
          </Button>
        </div>
      </div>

      <div className="hidden sm:block fixed bottom-6 end-6 z-40" data-testid="desktop-cta-buttons">
        <div className="flex items-center gap-2">
          <Link href={`/messages?therapist=${userId}`}>
            <Button
              variant="outline"
              className="gap-1.5 shadow-lg"
              data-testid="button-desktop-message"
            >
              <MessageCircle className="h-4 w-4" />
              {t("profile.send_message")}
            </Button>
          </Link>
          <Button
            className="gap-1.5 shadow-lg"
            onClick={() => openBookingFlow()}
            data-testid="button-desktop-book"
          >
            <Calendar className="h-4 w-4" />
            {t("profile.book_session")}
          </Button>
        </div>
      </div>
      {/* Quick-book payment dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onClose={() => { setPaymentDialogOpen(false); setQuickBookSlot(null); }}
        slot={quickBookSlot}
        therapistName={
          profile
            ? [profile.user?.firstName, profile.user?.lastName].filter(Boolean).join(" ") || "Therapist"
            : "Therapist"
        }
        therapistTier={profile?.tier}
        activeSubscription={activeSub}
        isPending={confirmBookingMutation.isPending}
        onConfirm={async (method) => {
          const result = await confirmBookingMutation.mutateAsync(method);
          setPaymentDialogOpen(false);
          setQuickBookSlot(null);
          if (result.paymentUrl) {
            window.location.href = result.paymentUrl;
          }
        }}
      />
    </AppLayout>
  );
}
