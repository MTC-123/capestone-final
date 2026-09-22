'use client';

import { useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useTranslation } from '@/hooks/useTranslation';
import { useIsMobile } from '@/hooks/useBreakpoint';

const MAX_PHOTOS = 3;
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.7;

interface PhotoUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

export function PhotoUpload({ images, onChange }: PhotoUploadProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_PHOTOS - images.length;
    const toProcess = files.slice(0, remaining);

    const compressed: string[] = [];
    for (const file of toProcess) {
      try {
        compressed.push(await compressImage(file));
      } catch {
        // skip failed compressions
      }
    }
    onChange([...images, ...compressed]);
    // Reset input so the same file can be selected again
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const canAddMore = images.length < MAX_PHOTOS;

  return (
    <div className="space-y-3">
      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((src, i) => (
            <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white shadow-sm"
                aria-label={t('removePhoto')}
              >
                <Icon name="close" size={12} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {canAddMore && (
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-4 py-3 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary">
          <Icon name="camera" aria-hidden size={18} />
          <span>{isMobile ? t('takePhoto') : t('addPhotos')}</span>
          <span className="text-xs">({images.length}/{MAX_PHOTOS})</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture={isMobile ? 'environment' : undefined}
            multiple={!isMobile}
            onChange={handleFiles}
            className="sr-only"
          />
        </label>
      )}

      {images.length >= MAX_PHOTOS && (
        <p className="text-xs text-muted-foreground">{t('maxPhotos')}</p>
      )}
    </div>
  );
}
