import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { fadeUp, scrollReveal, usePrefersReducedMotion, safeVariants, safeScrollReveal } from "@/lib/motion";
import {
  Star,
  MapPin,
  Globe,
  CheckCircle,
  Video,
  Calendar,
  Clock,
  MessageCircle,
  ExternalLink,
  GraduationCap,
  Sparkles,
  PackageCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { PageSkeleton } from "@/components/page-skeleton";
import { Separator } from "@/components/ui/separator";
import type { LandingSection, TherapistProfile, TherapistReview, TherapistSlot, User } from "@shared/schema";
import { DEFAULT_LANDING_SECTIONS } from "@shared/schema";
import { getSpecializationIcon, formatTherapistName, formatRateDinar } from "@/lib/therapist-utils";

interface LandingPageData {
  profile: TherapistProfile;
  user: User | null;
  reviews: TherapistReview[];
  openSlots: TherapistSlot[];
}

function StarDisplay({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-4 w-4" : "h-3 w-3";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${cls} ${s <= Math.round(value) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`}
        />
      ))}
    </div>
  );
}

/** Convert a YouTube or Vimeo watch URL into an embed URL. Returns null if unrecognised. */
function toEmbedUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    // YouTube
    if (url.hostname.includes("youtube.com")) {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    // Vimeo
    if (url.hostname.includes("vimeo.com")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

export default function TherapistLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const isEmbed = new URLSearchParams(window.location.search).get("embed") === "true";
  const rm = usePrefersReducedMotion();
  const safeFadeUp = safeVariants(fadeUp, rm);
  const safeReveal = safeScrollReveal(rm);

  const { data, isLoading, isError } = useQuery<LandingPageData>({
    queryKey: [`/api/therapist/page/${slug}`],
    queryFn: async () => {
      const res = await fetch(`/api/therapist/page/${slug}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <PageSkeleton variant="detail" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold">Page not found</p>
          <p className="text-muted-foreground text-sm">This therapist has not enabled their public page.</p>
          <Link href="/therapists">
            <Button variant="outline" size="sm">Browse therapists</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { profile, user, reviews, openSlots } = data;
  const accentColor = profile.profileThemeColor || "#6366f1";
  const accentTextColor = (() => {
    const c = accentColor.replace("#", "");
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? "#000" : "#fff";
  })();
  const customFont = (profile.customCss as any)?.font || "Inter";
  const therapistName = formatTherapistName(user);
  const inAppUrl = `/therapist/${profile.userId}`;
  const ctaUrl = profile.landingPageCtaUrl || inAppUrl;
  const ctaText = profile.landingPageCtaText || "Book a Session";

  // Resolve ordered, enabled sections
  const sections: LandingSection[] = (
    Array.isArray(profile.landingPageSections) && profile.landingPageSections.length > 0
      ? (profile.landingPageSections as LandingSection[])
      : DEFAULT_LANDING_SECTIONS
  ).filter((s) => s.enabled);

  // ── Section render helpers ──────────────────────────────────────────────────

  function renderHero() {
    return (
      <div
        key="hero"
        className="relative py-16 px-4"
        style={{ background: `linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}08 100%)` }}
      >
        <div className="max-w-3xl mx-auto">
          <motion.div
            custom={0} initial="hidden" animate="visible" variants={safeFadeUp}
            className="flex flex-col sm:flex-row items-center sm:items-start gap-6"
          >
            <Avatar className="h-24 w-24 sm:h-32 sm:w-32 shrink-0 ring-4 ring-white shadow-lg">
              <AvatarImage src={user?.profileImageUrl || ""} alt={therapistName} />
              <AvatarFallback className="text-2xl font-bold" style={{ background: accentColor + "33" }}>
                {therapistName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 text-center sm:text-start space-y-2">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold">{therapistName}</h1>
                {profile.verified && (
                  <Badge className="gap-1 bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300/50">
                    <CheckCircle className="h-3.5 w-3.5 fill-blue-500/20" />
                    Verified
                  </Badge>
                )}
                {profile.tier === "graduated_doctor" && (
                  <Badge variant="secondary" className="gap-1">
                    <GraduationCap className="h-3.5 w-3.5" />
                    Graduated Doctor
                  </Badge>
                )}
                {profile.tier === "premium_doctor" && (
                  <Badge className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/50">
                    <Sparkles className="h-3.5 w-3.5" />
                    Premium Doctor
                  </Badge>
                )}
              </div>
              {profile.headline && (
                <p className="text-muted-foreground text-base">{profile.headline}</p>
              )}
              <div className="flex items-center justify-center sm:justify-start gap-4 flex-wrap text-sm text-muted-foreground">
                {profile.yearsExperience != null && profile.yearsExperience > 0 && (
                  <span>{profile.yearsExperience} yrs experience</span>
                )}
                {profile.rating != null && profile.rating > 0 && (
                  <span className="flex items-center gap-1">
                    <StarDisplay value={profile.rating} size="sm" />
                    <span>{profile.rating.toFixed(1)}</span>
                    {profile.reviewCount != null && <span>({profile.reviewCount})</span>}
                  </span>
                )}
                {profile.officeAddress && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {profile.officeAddress}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-2 pt-2 flex-wrap">
                {profile.acceptsOnline && (
                  <Badge variant="outline" className="gap-1"><Video className="h-3 w-3" /> Online</Badge>
                )}
                {profile.acceptsInPerson && (
                  <Badge variant="outline" className="gap-1"><MapPin className="h-3 w-3" /> In-person</Badge>
                )}
                <Badge variant="outline" className="gap-1 font-semibold" style={{ borderColor: accentColor, color: accentColor }}>
                  {formatRateDinar(profile.rateDinar)} / session
                </Badge>
              </div>
            </div>
          </motion.div>

          <div className="mt-6 flex justify-center sm:justify-start">
            <Link href={ctaUrl}>
              <Button size="lg" style={{ background: accentColor, color: accentTextColor }} className="shadow-md hover:opacity-90">
                <Calendar className="h-4 w-4 me-2" />
                {ctaText}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  function renderAbout() {
    if (!profile.aboutMe && !profile.approach && !(profile.languages?.length)) return null;
    return (
      <section key="about" className="space-y-4">
        {profile.languages && profile.languages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {profile.languages.map((lang) => (
              <Badge key={lang} variant="secondary"><Globe className="h-3 w-3 me-1" />{lang}</Badge>
            ))}
          </div>
        )}
        <h2 className="text-xl font-bold">About</h2>
        {profile.aboutMe && <p className="text-muted-foreground leading-relaxed">{profile.aboutMe}</p>}
        {profile.approach && (
          <>
            <h3 className="font-semibold">My Approach</h3>
            <p className="text-muted-foreground leading-relaxed">{profile.approach}</p>
          </>
        )}
      </section>
    );
  }

  function renderSpecializations() {
    if (!profile.specializations?.length) return null;
    return (
      <section key="specializations">
        <h2 className="text-xl font-bold mb-4">Specializations</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {profile.specializations.map((spec) => (
            <div key={spec} className="flex items-center gap-2 rounded-lg bg-muted/60 p-3">
              <span className="text-xl">{getSpecializationIcon(spec)}</span>
              <span className="text-sm font-medium capitalize">{spec.replace(/_/g, " ")}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderCertifications() {
    if (!profile.education && !profile.certifications) return null;
    return (
      <section key="certifications">
        <h2 className="text-xl font-bold mb-3">Education & Certifications</h2>
        {profile.education && <p className="text-muted-foreground mb-3">{profile.education}</p>}
        {profile.certifications && Array.isArray(profile.certifications) && (
          <ul className="space-y-1.5 mt-2">
            {(profile.certifications as { title: string; year?: number }[]).map((c, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                <span>{c.title}{c.year ? ` · ${c.year}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  function renderPricing() {
    return (
      <section key="pricing">
        <h2 className="text-xl font-bold mb-4">Pricing</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Per-session rate */}
          <Card>
            <CardContent className="p-5 space-y-2">
              <p className="font-semibold">Per Session</p>
              <p className="text-3xl font-bold" style={{ color: accentColor }}>
                {profile.tier === "graduated_doctor" ? "20" : String(Math.round(profile.rateDinar ?? 0))}{" "}
                <span className="text-base font-normal text-muted-foreground">د.ت</span>
              </p>
              {profile.tier === "graduated_doctor" && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <GraduationCap className="h-3 w-3" />
                  Capped at 20 TND
                </Badge>
              )}
              <p className="text-xs text-muted-foreground">Per 50-minute session</p>
            </CardContent>
          </Card>
          {/* Session bundle hint */}
          <Card className="border-dashed">
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center gap-2">
                <PackageCheck className="h-4 w-4 text-primary" />
                <p className="font-semibold">Session Bundles</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Save up to 20% with a multi-session subscription plan. Available after booking.
              </p>
              <Link href={inAppUrl}>
                <Button size="sm" variant="outline" className="mt-1 w-full">View plans</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  function renderSlots() {
    if (!openSlots.length) return null;
    return (
      <section key="slots" id="slots">
        <h2 className="text-xl font-bold mb-4">Available Slots</h2>
        <div className="space-y-2">
          {openSlots.slice(0, 5).map((slot) => (
            <div key={slot.id} className="flex items-center justify-between rounded-lg border p-3 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{new Date(slot.startsAt).toLocaleDateString("fr-TN", { weekday: "long", day: "numeric", month: "long" })}</span>
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{new Date(slot.startsAt).toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{formatRateDinar(slot.priceDinar)}</span>
                <Link href={`${inAppUrl}#slots`}>
                  <Button size="sm" style={{ background: accentColor, color: accentTextColor }}>Book</Button>
                </Link>
              </div>
            </div>
          ))}
          {openSlots.length > 5 && (
            <Link href={`${inAppUrl}#slots`}>
              <Button variant="ghost" size="sm">+{openSlots.length - 5} more slots</Button>
            </Link>
          )}
        </div>
      </section>
    );
  }

  function renderTestimonials(maxCount = 3) {
    const limited = reviews.slice(0, maxCount);
    if (!limited.length) return null;
    return (
      <section key="testimonials">
        <h2 className="text-xl font-bold mb-4">Client Testimonials</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {limited.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-4 space-y-2">
                <StarDisplay value={review.overallRating} size="md" />
                {review.comment && (
                  <p className="text-sm text-muted-foreground italic">"{review.comment}"</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {review.isAnonymous ? "Anonymous" : "Verified client"} ·{" "}
                  {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ""}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  function renderVideo(section: LandingSection & { type: "video" }) {
    const embedUrl = section.videoUrl ? toEmbedUrl(section.videoUrl) : null;
    if (!embedUrl) return null;
    return (
      <section key="video">
        <h2 className="text-xl font-bold mb-4">Video Introduction</h2>
        <div className="rounded-xl overflow-hidden aspect-video bg-muted">
          <iframe
            src={embedUrl}
            title="Therapist introduction"
            className="w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      </section>
    );
  }

  function renderGallery() {
    if (!profile.galleryImages?.length) return null;
    return (
      <section key="office_photos">
        <h2 className="text-xl font-bold mb-4">Office Photos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {profile.galleryImages.map((url, i) => (
            <div key={i} className="aspect-square rounded-lg overflow-hidden bg-muted">
              <img src={url} alt={`Office photo ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderFaq() {
    if (!Array.isArray(profile.faqItems) || !profile.faqItems.length) return null;
    return (
      <section key="faq">
        <h2 className="text-xl font-bold mb-4">FAQ</h2>
        <Accordion type="single" collapsible className="space-y-2">
          {(profile.faqItems as { question: string; answer: string }[]).map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border rounded-lg px-4">
              <AccordionTrigger className="text-sm font-medium">{item.question}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    );
  }

  function renderSocialLinks() {
    if (!profile.socialLinks || !Object.keys(profile.socialLinks).length) return null;
    return (
      <section key="social_links">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Connect</h2>
        <div className="flex gap-3 flex-wrap">
          {Object.entries(profile.socialLinks as Record<string, string>).map(([platform, url]) =>
            url ? (
              <a key={platform} href={url} target="_blank" rel="noopener noreferrer">
                <Badge variant="outline" className="gap-1 capitalize">
                  <ExternalLink className="h-3 w-3" />
                  {platform}
                </Badge>
              </a>
            ) : null
          )}
        </div>
      </section>
    );
  }

  function renderBanner(section: LandingSection & { type: "banner" }) {
    if (!section.imageUrl) return null;
    return (
      <div key={`banner-${section.imageUrl}`} className="rounded-xl overflow-hidden">
        <img src={section.imageUrl} alt={section.altText || ""} className="w-full object-cover max-h-64" loading="lazy" />
      </div>
    );
  }

  function renderCustomText(section: LandingSection & { type: "custom_text" }) {
    return (
      <section key={`custom-${section.title}`}>
        {section.title && <h2 className="text-xl font-bold mb-3">{section.title}</h2>}
        <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{section.content}</p>
      </section>
    );
  }

  function renderConsultationIntro() {
    if (!profile.consultationIntro) return null;
    return (
      <section key="consultation_intro" className="rounded-xl bg-muted/60 p-6">
        <h2 className="text-lg font-bold mb-2">Before Your Session</h2>
        <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{profile.consultationIntro}</p>
      </section>
    );
  }

  function renderContactForm() {
    return (
      <section key="contact_form" className="rounded-xl border p-6 text-center space-y-3">
        <MessageCircle className="h-8 w-8 mx-auto text-primary" />
        <h2 className="text-lg font-bold">Get in Touch</h2>
        <p className="text-sm text-muted-foreground">
          Have questions before booking? Send a message through the platform.
        </p>
        <Link href={inAppUrl}>
          <Button style={{ background: accentColor, color: accentTextColor }} className="mt-2">
            <MessageCircle className="h-4 w-4 me-2" />
            Send a Message
          </Button>
        </Link>
      </section>
    );
  }

  // ── Map sections to rendered elements ──────────────────────────────────────

  function renderSection(section: LandingSection) {
    switch (section.type) {
      case "hero":            return renderHero();
      case "about":           return renderAbout();
      case "specializations": return renderSpecializations();
      case "certifications":  return renderCertifications();
      case "pricing":         return renderPricing();
      case "slots":           return renderSlots();
      case "testimonials":    return renderTestimonials((section as any).maxCount ?? 3);
      case "video":           return renderVideo(section as LandingSection & { type: "video" });
      case "office_photos":   return renderGallery();
      case "gallery":         return renderGallery();
      case "faq":             return renderFaq();
      case "social_links":    return renderSocialLinks();
      case "banner":          return renderBanner(section as LandingSection & { type: "banner" });
      case "custom_text":     return renderCustomText(section as LandingSection & { type: "custom_text" });
      case "consultation_intro": return renderConsultationIntro();
      case "contact_form":    return renderContactForm();
      default:                return null;
    }
  }

  // Split: hero (if present) goes at the very top as wide block; rest inside max-w-3xl
  const heroSection = sections.find((s) => s.type === "hero");
  const bodySections = sections.filter((s) => s.type !== "hero");

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: `'${customFont}', sans-serif` }}>
      {heroSection && renderHero()}

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
        {bodySections.map((section, i) => {
          const el = renderSection(section);
          return el ? (
            <motion.div
              key={`${section.type}-${i}`}
              {...safeReveal}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              {el}
            </motion.div>
          ) : null;
        })}

        <Separator />

        {/* CTA footer */}
        <div className="text-center space-y-4 py-6">
          <p className="text-lg font-semibold">Ready to start your journey?</p>
          <p className="text-muted-foreground text-sm">Book a session with {therapistName} today.</p>
          <Link href={ctaUrl}>
            <Button size="lg" style={{ background: accentColor, color: accentTextColor }} className="shadow-md hover:opacity-90">
              <Calendar className="h-4 w-4 me-2" />
              {ctaText}
            </Button>
          </Link>
        </div>

        {!isEmbed && (
          <div className="text-center text-xs text-muted-foreground pb-4">
            <span>Powered by </span>
            <Link href="/" className="font-semibold hover:underline">Shifa — شفاء</Link>
          </div>
        )}
      </div>
    </div>
  );
}
