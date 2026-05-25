import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface LazyVideoProps {
  src: string;
  className?: string;
}

const LazyVideo = ({ src, className = "" }: LazyVideoProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {inView ? (
        <video
          src={src}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="h-full w-full object-cover"
        />
      ) : (
        <Skeleton className="h-full w-full" />
      )}
    </div>
  );
};

export default LazyVideo;
