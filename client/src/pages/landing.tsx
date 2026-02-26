import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Heart, MessageCircle, Brain, Shield, Sparkles, BookOpen,
  Users, Star, Phone, ArrowRight, ArrowLeft, Smile,
  Calendar, Bot, Lock, HandHeart, Moon, ChevronDown,
  UserPlus, TrendingUp, Wind, CheckCircle, Clock, Zap,
} from "lucide-react";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
};

const scrollReveal = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

export default function LandingPage() {
  const { t, isRTL } = useI18n();
  const { user, isLoading } = useAuth();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const currentYear = new Date().getFullYear();

  const quizCards = [
    { key: "anxiety", icon: Brain, label: t("onboarding.feeling_anxious"), spec: "anxiety" },
    { key: "depression", icon: Moon, label: t("onboarding.feeling_depressed"), spec: "depression" },
    { key: "stress", icon: Zap, label: t("onboarding.stress"), spec: "stress" },
    { key: "exploring", icon: Sparkles, label: t("onboarding.just_exploring"), spec: "" },
  ];

  const handleQuizClick = (spec: string) => {
    if (user) {
      if (spec) {
        window.location.href = `/therapists?specialization=${spec}`;
      } else {
        window.location.href = "/therapists";
      }
    } else {
      // Guests go to self-care (breathing exercise) — no login wall for exploration
      window.location.href = "/self-care";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 glass-effect border-b" data-testid="nav-bar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 h-16">
            <Link href="/" className="flex items-center gap-2" data-testid="link-home">
              <div className="w-9 h-9 rounded-xl gradient-calm flex items-center justify-center">
                <Heart className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gradient">{t("app.name")}</span>
            </Link>

            <div className="hidden md:flex items-center gap-6">
              <Link href="/therapists" className="text-sm text-muted-foreground hover-elevate rounded-md px-3 py-1.5" data-testid="link-nav-therapists">
                {t("nav.therapists")}
              </Link>
              <Link href="/resources" className="text-sm text-muted-foreground hover-elevate rounded-md px-3 py-1.5" data-testid="link-nav-resources">
                {t("nav.resources")}
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LanguageSwitcher variant="ghost" />
              {!isLoading && (
                user ? (
                  <Link href="/dashboard">
                    <Button size="sm" data-testid="button-dashboard">{t("nav.dashboard")}</Button>
                  </Link>
                ) : (
                  <a href="/login">
                    <Button size="sm" data-testid="button-login">{t("nav.login")}</Button>
                  </a>
                )
              )}
            </div>
          </div>
        </div>
      </nav>

      <section className="pt-28 pb-20 px-4 relative overflow-hidden gradient-hero" data-testid="section-hero">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 start-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 end-10 w-96 h-96 bg-chart-2/10 rounded-full blur-3xl animate-float-delayed" />
          <div className="absolute top-1/2 start-1/2 w-64 h-64 bg-chart-3/10 rounded-full blur-3xl animate-float-slow" />
        </div>

        <motion.div
          className="max-w-4xl mx-auto text-center relative z-10"
          initial="initial"
          animate="animate"
          variants={stagger}
        >
          <motion.div variants={fadeIn}>
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm">
              <Sparkles className="h-3.5 w-3.5 me-1.5" />
              {t("landing.badge_first_platform")}
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeIn}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6"
          >
            <span className="text-gradient">{t("landing.hero.title")}</span>
          </motion.h1>

          <motion.p
            variants={fadeIn}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            {t("landing.hero.subtitle")}
          </motion.p>

          <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href={user ? "/dashboard" : "/login"}>
              <Button size="lg" className="text-base gap-2 w-full sm:w-auto" data-testid="button-hero-cta">
                {t("landing.hero.cta")}
                <Arrow className="h-4 w-4" />
              </Button>
            </a>
            <Link href="/therapists">
              <Button variant="outline" size="lg" className="text-base w-full sm:w-auto" data-testid="button-hero-secondary">
                {t("landing.hero.secondary")}
              </Button>
            </Link>
          </motion.div>

          <motion.div
            variants={fadeIn}
            className="mt-14 max-w-3xl mx-auto"
          >
            <p className="text-sm text-muted-foreground mb-5 font-medium">{t("onboarding.what_brings")}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quizCards.map((card) => (
                <Card
                  key={card.key}
                  className="cursor-pointer hover-elevate transition-all duration-200"
                  onClick={() => handleQuizClick(card.spec)}
                  data-testid={`card-quiz-${card.key}`}
                >
                  <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <card.icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{card.label}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          className="flex justify-center mt-14"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          <ChevronDown className="h-6 w-6 text-muted-foreground animate-bounce" />
        </motion.div>
      </section>

      <section className="py-12 px-4 border-b" data-testid="section-trust">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Lock, label: t("landing.trust.encrypted") },
              { icon: CheckCircle, label: t("landing.trust.verified") },
              { icon: Clock, label: t("landing.trust.support") },
              { icon: Zap, label: t("landing.trust.free_start") },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-3"
                {...scrollReveal}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <div className="trust-icon bg-primary/10 shrink-0">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm font-medium">{item.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4" data-testid="section-how-it-works">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            className="text-3xl sm:text-4xl font-bold text-center mb-16"
            {...scrollReveal}
          >
            {t("landing.how.title")}
          </motion.h2>

          <div className="relative">
            <div className="hidden lg:block absolute top-14 start-[12.5%] end-[12.5%] h-0.5 bg-border" />

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
              {[
                { step: 1, icon: UserPlus, title: t("landing.how.step1.title"), desc: t("landing.how.step1.desc") },
                { step: 2, icon: Brain, title: t("landing.how.step2.title"), desc: t("landing.how.step2.desc") },
                { step: 3, icon: MessageCircle, title: t("landing.how.step3.title"), desc: t("landing.how.step3.desc") },
                { step: 4, icon: TrendingUp, title: t("landing.how.step4.title"), desc: t("landing.how.step4.desc") },
              ].map((step, i) => (
                <motion.div
                  key={i}
                  className="text-center relative"
                  {...scrollReveal}
                  transition={{ delay: i * 0.15, duration: 0.5 }}
                >
                  <div className="w-14 h-14 rounded-full gradient-calm flex items-center justify-center mx-auto mb-4 relative z-10">
                    <span className="text-white font-bold text-lg">{step.step}</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-card/50 pattern-dots" data-testid="section-features">
        <div className="max-w-6xl mx-auto">
          <motion.div className="text-center mb-16" {...scrollReveal}>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("landing.features.title")}</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              {t("landing.features.subtitle")}
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Brain, title: t("landing.feature.matching.title"), desc: t("landing.feature.matching.desc"), color: "bg-primary/10 text-primary" },
              { icon: MessageCircle, title: t("landing.feature.chat.title"), desc: t("landing.feature.chat.desc"), color: "bg-chart-2/10 text-chart-2" },
              { icon: Smile, title: t("landing.feature.mood.title"), desc: t("landing.feature.mood.desc"), color: "bg-chart-3/10 text-chart-3" },
              { icon: Lock, title: t("landing.feature.privacy.title"), desc: t("landing.feature.privacy.desc"), color: "bg-chart-5/10 text-chart-5" },
              { icon: Heart, title: t("landing.feature.affordable.title"), desc: t("landing.feature.affordable.desc"), color: "bg-destructive/10 text-destructive" },
              { icon: Bot, title: t("landing.feature.ai.title"), desc: t("landing.feature.ai.desc"), color: "bg-chart-4/10 text-chart-4" },
            ].map((feature, i) => (
              <motion.div
                key={i}
                {...scrollReveal}
                transition={{ delay: i * 0.08, duration: 0.5 }}
              >
                <Card className="h-full hover-elevate transition-all duration-200">
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-4`}>
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4" data-testid="section-selfcare-preview">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-12" {...scrollReveal}>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("landing.selfcare_preview.title")}</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              {t("landing.selfcare_preview.desc")}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            <motion.div {...scrollReveal} transition={{ delay: 0.1, duration: 0.5 }}>
              <Card className="h-full">
                <CardContent className="p-8 flex flex-col items-center text-center">
                  <div className="breathing-circle mb-6">
                    <Wind className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{t("selfcare.breathing")}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{t("selfcare.breathing.desc")}</p>
                  <div className="flex gap-4 text-sm text-muted-foreground mb-4">
                    <span>{t("selfcare.inhale")} 4s</span>
                    <span>{t("selfcare.hold")} 7s</span>
                    <span>{t("selfcare.exhale")} 8s</span>
                  </div>
                  <Link href="/self-care">
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Wind className="h-4 w-4" />
                      Try a breathing exercise
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div {...scrollReveal} transition={{ delay: 0.2, duration: 0.5 }}>
              <Card className="h-full">
                <CardContent className="p-8 flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-full bg-chart-3/10 flex items-center justify-center mb-6">
                    <HandHeart className="h-10 w-10 text-chart-3" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{t("selfcare.grounding")}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{t("selfcare.grounding.desc")}</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <Badge key={n} variant="secondary">{n}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <motion.div
            className="flex justify-center mt-8"
            {...scrollReveal}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Link href="/self-care">
              <Button size="lg" className="gap-2" data-testid="button-selfcare-try">
                {t("landing.selfcare_preview.try")}
                <Arrow className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="py-20 px-4 bg-card/50" data-testid="section-testimonials">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            className="text-3xl sm:text-4xl font-bold text-center mb-12"
            {...scrollReveal}
          >
            {t("landing.testimonials.title")}
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                text: t("landing.testimonial.1.text"),
                name: t("landing.testimonial.1.name"),
                location: t("landing.testimonial.1.location"),
                rating: 5,
              },
              {
                text: t("landing.testimonial.2.text"),
                name: t("landing.testimonial.2.name"),
                location: t("landing.testimonial.2.location"),
                rating: 5,
              },
              {
                text: t("landing.testimonial.3.text"),
                name: t("landing.testimonial.3.name"),
                location: t("landing.testimonial.3.location"),
                rating: 5,
              },
            ].map((testimonial, i) => (
              <motion.div
                key={i}
                {...scrollReveal}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <Card className="h-full" data-testid={`card-testimonial-${i}`}>
                  <CardContent className="p-6">
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: testimonial.rating }).map((_, s) => (
                        <Star key={s} className="h-4 w-4 fill-chart-4 text-chart-4" />
                      ))}
                    </div>
                    <p className="text-muted-foreground mb-4 leading-relaxed italic">"{testimonial.text}"</p>
                    <div>
                      <div className="font-semibold text-sm">{testimonial.name}</div>
                      <div className="text-xs text-muted-foreground">{testimonial.location}</div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4" data-testid="section-cta">
        <div className="max-w-3xl mx-auto">
          <motion.div
            className="gradient-calm rounded-md p-10 sm:p-14 text-center text-white relative overflow-hidden"
            {...scrollReveal}
          >
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <div className="absolute top-0 end-0 w-48 h-48 bg-white rounded-full blur-3xl" />
              <div className="absolute bottom-0 start-0 w-64 h-64 bg-white rounded-full blur-3xl" />
            </div>
            <div className="relative z-10">
              <Moon className="h-10 w-10 mx-auto mb-6 opacity-80" />
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">{t("landing.cta.title")}</h2>
              <p className="text-white/80 mb-8 max-w-lg mx-auto">{t("landing.cta.desc")}</p>
              <a href={user ? "/dashboard" : "/login"}>
                <Button size="lg" variant="secondary" className="text-primary font-semibold" data-testid="button-cta-signup">
                  {t("landing.cta.button")}
                  <Arrow className="h-4 w-4 ms-2" />
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-12 px-4 bg-destructive/5 border-t border-destructive/20" data-testid="section-crisis">
        <div className="max-w-3xl mx-auto text-center">
          <Phone className="h-8 w-8 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-destructive mb-2">{t("landing.crisis.title")}</h3>
          <p className="text-muted-foreground mb-4">{t("landing.crisis.desc")}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Badge variant="destructive" className="text-base px-6 py-2" data-testid="badge-crisis-samu">
              {t("landing.crisis.samu")}
            </Badge>
            <Badge variant="destructive" className="text-base px-6 py-2" data-testid="badge-crisis-police">
              {t("landing.crisis.police")}
            </Badge>
          </div>
        </div>
      </section>

      <footer className="py-12 px-4 border-t bg-card/50" data-testid="footer">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-calm flex items-center justify-center">
                <Heart className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-gradient">{t("app.name")}</span>
            </div>

            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <Link href="/about" className="hover:text-foreground transition-colors">{t("footer.about")}</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">{t("footer.privacy")}</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">{t("footer.terms")}</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">{t("footer.contact")}</Link>
            </div>

            <div className="text-sm text-muted-foreground">
              © {currentYear} Shifa. {t("footer.rights")}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
