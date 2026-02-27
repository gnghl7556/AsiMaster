"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
    } else if (wasOffline.current) {
      wasOffline.current = false;
      toast.success("다시 연결되었습니다");
    }
  }, [isOnline]);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-amber-500/90 text-white text-xs font-medium overflow-hidden"
        >
          <div className="flex items-center justify-center gap-2 py-1.5 px-4">
            <WifiOff className="h-3.5 w-3.5" />
            <span>오프라인 상태입니다. 캐시된 데이터를 표시합니다.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
