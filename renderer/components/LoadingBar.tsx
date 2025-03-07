import { useLoadingStore } from '@/renderer/stores/loadingStore';
import { useEffect, useState, useRef } from 'react';

export const LoadingBar = () => {
  const { isLoading } = useLoadingStore();
  const [progress, setProgress] = useState<number>(0);
  const progressRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const cleanupRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    // Clear any existing timers
    if (progressRef.current) clearInterval(progressRef.current);
    if (cleanupRef.current) clearTimeout(cleanupRef.current);
    
    if (isLoading) {
      setProgress(0);
      // Quick initial progress
      progressRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            if (progressRef.current) clearInterval(progressRef.current);
            return 90;
          }
          return prev + 15;
        });
      }, 100);
    } else {
      // Finish animation and cleanup
      setProgress(100);
      cleanupRef.current = setTimeout(() => {
        setProgress(0);
      }, 200);
    }

    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
      if (cleanupRef.current) clearTimeout(cleanupRef.current);
    };
  }, [isLoading]);

  if (progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-0.5 z-[9999]">
      <div
        className="h-full bg-green-500 shadow-[0_0_6px] shadow-primary transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`
        }}
      />
    </div>
  );
};
