"use client";

import { useEffect, useMemo } from "react";

import { ACCEPTED_PHOTO_TYPES } from "@/features/guest-submission/constants/submission-rules";

interface PhotoPickerProps {
  photo: File | null;
  onChange: (photo: File | null) => void;
  error?: string;
}

export function PhotoPicker({ photo, onChange, error }: PhotoPickerProps) {
  const previewUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);

  // Free the blob URL when the photo changes or the picker unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">Photo (optional)</span>
      {previewUrl ? (
        <div className="relative overflow-hidden rounded-xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          <img src={previewUrl} alt="Your selected photo" className="aspect-square w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 rounded-full bg-black/70 px-3 py-1 text-sm text-white"
          >
            Remove
          </button>
        </div>
      ) : (
        // Restricting types makes iPhones convert HEIC photos to JPEG before handing them over.
        <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface text-muted hover:border-accent">
          <span className="text-3xl" aria-hidden>
            📸
          </span>
          <span className="text-sm">Tap to add a photo</span>
          <input
            type="file"
            accept={ACCEPTED_PHOTO_TYPES}
            className="sr-only"
            onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          />
        </label>
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
