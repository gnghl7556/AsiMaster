"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

interface Props {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard({ children, className, hover = false }: Props) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      whileHover={hover ? { scale: 1.01 } : undefined}
      className={cn("glass-card", className)}
    >
      {children}
    </motion.div>
  );
}
