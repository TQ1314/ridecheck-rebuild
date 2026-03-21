"use client";

import { useState } from "react";
import Image from "next/image";
import { X, ZoomIn } from "lucide-react";
import type { GalleryImage } from "@/lib/blog/types";

interface EvidenceGalleryProps {
  images: GalleryImage[];
  title?: string;
}

export function EvidenceGallery({ images, title = "Evidence Gallery" }: EvidenceGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const open = (index: number) => setLightboxIndex(index);
  const close = () => setLightboxIndex(null);
  const prev = () =>
    setLightboxIndex((i) => (i !== null ? (i - 1 + images.length) % images.length : null));
  const next = () =>
    setLightboxIndex((i) => (i !== null ? (i + 1) % images.length : null));

  const gridClass =
    images.length === 1
      ? "grid-cols-1 max-w-lg"
      : images.length === 2
      ? "grid-cols-2"
      : images.length === 3
      ? "grid-cols-3"
      : "grid-cols-2 sm:grid-cols-4";

  return (
    <div className="my-6">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
        {title}
      </p>
      <div className={`grid gap-2 ${gridClass}`}>
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => open(i)}
            className="group relative aspect-video overflow-hidden rounded-xl bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            aria-label={img.alt || `View image ${i + 1}`}
            data-testid={`gallery-image-${i}`}
          >
            <Image
              src={img.src}
              alt={img.alt || `Evidence photo ${i + 1}`}
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, 25vw"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
              <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        ))}
      </div>
      {images.some((img) => img.caption) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {images.map(
            (img, i) =>
              img.caption && (
                <p key={i} className="text-xs text-gray-500 italic">
                  {i + 1}. {img.caption}
                </p>
              )
          )}
        </div>
      )}

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Image lightbox"
        >
          <button
            onClick={close}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            aria-label="Close lightbox"
            data-testid="lightbox-close"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className="relative max-h-[85vh] max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl">
              <Image
                src={images[lightboxIndex].src}
                alt={images[lightboxIndex].alt || `Evidence photo ${lightboxIndex + 1}`}
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>
            {images[lightboxIndex].caption && (
              <p className="mt-3 text-center text-sm text-gray-300 italic">
                {images[lightboxIndex].caption}
              </p>
            )}
            <p className="mt-1 text-center text-xs text-gray-500">
              {lightboxIndex + 1} / {images.length}
            </p>
          </div>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-white text-lg hover:bg-white/20 transition-colors"
                aria-label="Previous image"
              >
                ‹
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-white text-lg hover:bg-white/20 transition-colors"
                aria-label="Next image"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
