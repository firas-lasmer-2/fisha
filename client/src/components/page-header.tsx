import { motion } from "framer-motion";
import { headerSlideDown, usePrefersReducedMotion, safeVariants } from "@/lib/motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  testId?: string;
}

export function PageHeader({ title, subtitle, icon: Icon, action, testId }: PageHeaderProps) {
  const rm = usePrefersReducedMotion();
  const safeHeader = safeVariants(headerSlideDown, rm);
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={safeHeader}
      className="flex items-start justify-between gap-4"
    >
      <div className="space-y-0.5">
        <h1
          className="text-2xl font-bold flex items-center gap-2"
          data-testid={testId}
        >
          {Icon && <Icon className="h-6 w-6 text-primary shrink-0" aria-hidden />}
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </motion.div>
  );
}
