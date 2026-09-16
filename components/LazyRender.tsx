import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface LazyRenderProps {
  children: ReactNode;
  fallback?: ReactNode;
  minHeight?: number | string;
  rootMargin?: string;
  threshold?: number;
  triggerOnce?: boolean;
  className?: string;
  placeholderText?: string;
}

/**
 * کامپوننت هوشمند Lazy Loading مبتنی بر Intersection Observer API
 * برای کاهش مصرف حافظه رم، جلوگیری از لگ در اسکرول و رندر تدریجی المان‌های گرافیکی سنگین (چارت‌ها، جداول و بوم‌ها)
 */
export const LazyRender: React.FC<LazyRenderProps> = ({
  children,
  fallback,
  minHeight = 220,
  rootMargin = '150px 0px',
  threshold = 0.05,
  triggerOnce = true,
  className = '',
  placeholderText = 'در حال آماده‌سازی و رندر بهینه...'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // اگر در محیطی بدون IntersectionObserver باشیم (پشتیبانی مرورگرهای قدیمی)
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }

    const currentRef = containerRef.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce && currentRef) {
            observer.unobserve(currentRef);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      {
        root: null,
        rootMargin,
        threshold
      }
    );

    observer.observe(currentRef);

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
      observer.disconnect();
    };
  }, [rootMargin, threshold, triggerOnce]);

  const heightStyle = typeof minHeight === 'number' ? `${minHeight}px` : minHeight;

  return (
    <div
      ref={containerRef}
      className={`relative transition-opacity duration-300 ${className}`}
      style={{ minHeight: !isVisible ? heightStyle : undefined }}
    >
      {isVisible ? (
        <div className="animate-fade-in w-full h-full">
          {children}
        </div>
      ) : fallback ? (
        fallback
      ) : (
        <div 
          className="w-full flex flex-col items-center justify-center p-6 bg-slate-100/60 dark:bg-slate-900/40 rounded-3xl border border-slate-200/50 dark:border-white/5 backdrop-blur-sm select-none"
          style={{ height: heightStyle }}
        >
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold">
            <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
            <span>{placeholderText}</span>
          </div>
          <div className="w-24 h-1 bg-slate-200 dark:bg-slate-800 rounded-full mt-3 overflow-hidden">
            <div className="w-full h-full bg-teal-500/40 animate-pulse rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * کامپوننت Lazy Loading برای تصاویر سنگین
 */
interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  className?: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  fallbackSrc,
  className = '',
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      setImageSrc(src);
      return;
    }

    const currentImg = imgRef.current;
    if (!currentImg) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setImageSrc(src);
          observer.unobserve(currentImg);
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(currentImg);

    return () => {
      if (currentImg) observer.unobserve(currentImg);
      observer.disconnect();
    };
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        ref={imgRef}
        src={imageSrc || (fallbackSrc || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24'%3E%3Cpath fill='%2394a3b8' d='M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'/%3E%3C/svg%3E")}
        alt={alt}
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          setHasError(true);
          if (fallbackSrc) setImageSrc(fallbackSrc);
        }}
        className={`w-full h-full object-cover transition-all duration-300 ${
          isLoaded && !hasError ? 'opacity-100 scale-100 blur-0' : 'opacity-40 scale-95 blur-sm'
        }`}
        {...props}
      />
    </div>
  );
};
