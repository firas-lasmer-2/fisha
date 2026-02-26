import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Link } from "wouter";
import { motion } from "framer-motion";
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
  ExternalLink,
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
import { Separator } from "@/components/ui/separator";
import type { TherapistProfile, TherapistReview, TherapistSlot, User } from "@shared/schema";
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

export default function TherapistLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [location] = useLocation();
  const isEmbed = new URLSearchParams(window.location.search).get("embed") === "true";

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
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
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
  const therapistName = formatTherapistName(user);
  const inAppUrl = `/therapist/${profile.userId}`;
  const ctaUrl = profile.landingPageCtaUrl || inAppUrl;
  const ctaText = profile.landingPageCtaText || "Book a Session";

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div
        className="relative py-16 px-4"
        style={{ background: `linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}08 100%)` }}
      >
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
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
                  <CheckCircle className="h-5 w-5 text-blue-500" aria-label="Verified therapist" />
                )}
                {profile.tier === "student" && (
                  <Badge variant="secondary">Student Therapist</Badge>
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
                  <Badge variant="outline" className="gap-1">
                    <Video className="h-3 w-3" /> Online
                  </Badge>
                )}
                {profile.acceptsInPerson && (
                  <Badge variant="outline" className="gap-1">
                    <MapPin className="h-3 w-3" /> In-person
                  </Badge>
                )}
                <Badge variant="outline" className="gap-1 font-semibold" style={{ borderColor: accentColor, color: accentColor }}>
                  {formatRateDinar(profile.rateDinar)} / session
                </Badge>
              </div>
            </div>
          </motion.div>

          <div className="mt-6 flex justify-center sm:justify-start">
            <Link href={ctaUrl}>
              <Button
                size="lg"
                style={{ background: accentColor, color: "#fff" }}
                className="shadow-md hover:opacity-90"
              >
                <Calendar className="h-4 w-4 me-2" />
                {ctaText}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
        {/* Languages */}
        {profile.languages && profile.languages.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Languages
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.languages.map((lang) => (
                <Badge key={lang} variant="secondary">
                  <Globe className="h-3 w-3 me-1" /> {lang}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {/* About */}
        {(profile.aboutMe || profile.approach) && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">About</h2>
            {profile.aboutMe && <p className="text-muted-foreground leading-relaxed">{profile.aboutMe}</p>}
            {profile.approach && (
              <>
                <h3 className="font-semibold">My Approach</h3>
                <p className="text-muted-foreground leading-relaxed">{profile.approach}</p>
              </>
            )}
          </section>
        )}

        {/* Specializations */}
        {profile.specializations && profile.specializations.length > 0 && (
          <section>
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
        )}

        {/* Education */}
        {profile.education && (
          <section>
            <h2 className="text-xl font-bold mb-2">Education</h2>
            <p className="text-muted-foreground">{profile.education}</p>
          </section>
        )}

        {/* Available Slots */}
        {openSlots.length > 0 && (
          <section id="slots">
            <h2 className="text-xl font-bold mb-4">Available Slots</h2>
            <div className="space-y-2">
              {openSlots.slice(0, 5).map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between rounded-lg border p-3 gap-3"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(slot.startsAt).toLocaleDateString("fr-TN", { weekday: "long", day: "numeric", month: "long" })}</span>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(slot.startsAt).toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{formatRateDinar(slot.priceDinar)}</span>
                    <Link href={`${inAppUrl}#slots`}>
                      <Button size="sm" style={{ background: accentColor, color: "#fff" }}>Book</Button>
                    </Link>
                  </div>
                </div>
              ))}
              {openSlots.length > 5 && (
                <Link href={`${inAppUrl}#slots`}>
                  <Button variant="ghost" size="sm">
                    +{openSlots.length - 5} more slots
                  </Button>
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4">
              Client Testimonials
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {reviews.map((review) => (
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
        )}

        {/* FAQ */}
        {profile.faqItems && Array.isArray(profile.faqItems) && profile.faqItems.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4">FAQ</h2>
            <Accordion type="single" collapsible className="space-y-2">
              {(profile.faqItems as { question: string; answer: string }[]).map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border rounded-lg px-4">
                  <AccordionTrigger className="text-sm font-medium">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}

        {/* Social Links */}
        {profile.socialLinks && typeof profile.socialLinks === "object" && Object.keys(profile.socialLinks).length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Connect
            </h2>
            <div className="flex gap-3 flex-wrap">
              {Object.entries(profile.socialLinks as Record<string, string>).map(([platform, url]) => (
                url ? (
                  <a key={platform} href={url} target="_blank" rel="noopener noreferrer">
                    <Badge variant="outline" className="gap-1 capitalize">
                      <ExternalLink className="h-3 w-3" />
                      {platform}
                    </Badge>
                  </a>
                ) : null
              ))}
            </div>
          </section>
        )}

        <Separator />

        {/* CTA Footer */}
        <div className="text-center space-y-4 py-6">
          <p className="text-lg font-semibold">Ready to start your journey?</p>
          <p className="text-muted-foreground text-sm">
            Book a session with {therapistName} today.
          </p>
          <Link href={ctaUrl}>
            <Button
              size="lg"
              style={{ background: accentColor, color: "#fff" }}
              className="shadow-md hover:opacity-90"
            >
              <Calendar className="h-4 w-4 me-2" />
              {ctaText}
            </Button>
          </Link>
        </div>

        {/* Footer branding */}
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
