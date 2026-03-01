import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";
import { fadeUp, skeletonToContent, usePrefersReducedMotion, safeVariants } from "@/lib/motion";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { Library, Clock, BookOpen, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import type { Resource } from "@shared/schema";
import { PageSkeleton } from "@/components/page-skeleton";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function ResourcesPage() {
  const { t, isRTL, language } = useI18n();
  const rm = usePrefersReducedMotion();
  const [category, setCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  const queryStr = category ? `?category=${category}` : "";
  const { data: resourceList, isLoading } = useQuery<Resource[]>({
    queryKey: ["/api/resources", queryStr],
  });

  const categories = [
    { value: "anxiety", label: t("specialization.anxiety") },
    { value: "depression", label: t("specialization.depression") },
    { value: "stress", label: t("specialization.stress") },
    { value: "relationships", label: t("specialization.relationships") },
    { value: "self_esteem", label: t("specialization.self_esteem") },
    { value: "grief", label: t("specialization.grief") },
  ];

  const getTitle = (r: Resource) => {
    if (language === "fr") return r.titleFr;
    return r.titleAr;
  };

  const getContent = (r: Resource) => {
    if (language === "fr") return r.contentFr;
    return r.contentAr;
  };

  return (
    <AppLayout>
      <motion.div
        className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6"
        initial="hidden"
        animate="visible"
        variants={safeVariants(fadeUp, rm)}
      >
        <PageHeader title={t("nav.resources")} testId="text-resources-title" />

        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("common.search")}
            className="ps-9 pe-16"
            data-testid="input-search-resources"
          />
          <kbd
            className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground"
            aria-label="Press Ctrl+K to open search palette"
          >
            ⌘K
          </kbd>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={!category ? "default" : "outline"}
            size="sm"
            onClick={() => setCategory("")}
            data-testid="button-category-all"
          >
            {t("resources.all")}
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.value}
              variant={category === cat.value ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(cat.value)}
              data-testid={`button-category-${cat.value}`}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <PageSkeleton variant="grid" count={6} />
        ) : resourceList && resourceList.length > 0 ? (
          <motion.div
            className="grid sm:grid-cols-2 gap-4"
            initial="loading"
            animate="loaded"
            variants={safeVariants(skeletonToContent, rm)}
          >
            {resourceList.filter((resource) => {
              if (!searchQuery.trim()) return true;
              const title = getTitle(resource).toLowerCase();
              const content = getContent(resource).toLowerCase();
              const q = searchQuery.toLowerCase();
              return title.includes(q) || content.includes(q);
            }).map((resource) => (
              <Card
                key={resource.id}
                className="hover-elevate cursor-pointer"
                data-testid={`resource-card-${resource.id}`}
                onClick={() => setSelectedResource(resource)}
              >
                <CardContent className="p-5">
                  <Badge variant="secondary" className="mb-3 text-xs">
                    {categories.find((c) => c.value === resource.category)?.label || resource.category}
                  </Badge>
                  <h3 className="font-semibold mb-2">{getTitle(resource)}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                    {getContent(resource)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {resource.readTimeMinutes} {t("resources.min_read")}
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        ) : (
          <EmptyState
            icon={Library}
            title={t("resources.no_resources")}
            description={t("resources.no_resources_desc") !== "resources.no_resources_desc" ? t("resources.no_resources_desc") : undefined}
          />
        )}
      </motion.div>

      <Sheet open={!!selectedResource} onOpenChange={(open) => { if (!open) setSelectedResource(null); }}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
          {selectedResource && (
            <>
              <SheetHeader className="mb-4">
                <Badge variant="secondary" className="w-fit text-xs mb-1">
                  {categories.find((c) => c.value === selectedResource.category)?.label || selectedResource.category}
                </Badge>
                <SheetTitle className="text-start leading-snug">{getTitle(selectedResource)}</SheetTitle>
              </SheetHeader>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {getContent(selectedResource)}
              </p>
              {selectedResource.readTimeMinutes && (
                <div className="flex items-center gap-1.5 mt-4 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {selectedResource.readTimeMinutes} {t("resources.min_read")}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
