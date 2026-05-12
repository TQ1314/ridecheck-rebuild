"use client";

import { useRef, useState, useCallback } from "react";
import { Camera, RefreshCw, RotateCcw, CheckCircle2, AlertCircle, X, ZoomIn } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type UploadState = "idle" | "compressing" | "uploading" | "uploaded" | "failed" | "retrying";

export interface MobilePhotoCaptureProps {
  label: string;
  hint?: string;
  value: string;
  onChange: (url: string) => void;
  assignmentId: string;
  orderId: string;
  stepKey: string;
  slotKey: string;       // "wide" | "close"
  required?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_DIMENSION = 1400;
const JPEG_QUALITY  = 0.78;
const MAX_RETRIES   = 3;
const RETRY_DELAY   = 1500;

// ─────────────────────────────────────────────────────────────────────────────
// Image compression — canvas-based, runs in browser, no external libs
// ─────────────────────────────────────────────────────────────────────────────

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth  * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas unavailable")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("toBlob returned null")),
        "image/jpeg",
        JPEG_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("image load failed")); };
    img.src = objectUrl;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload to server (with structured path)
// ─────────────────────────────────────────────────────────────────────────────

async function uploadBlob(
  blob: Blob,
  assignmentId: string,
  orderId: string,
  stepKey: string,
  slotKey: string,
): Promise<string> {
  const fd = new FormData();
  fd.append("file", blob, `${slotKey}_${Date.now()}.jpg`);
  fd.append("assignmentId", assignmentId);
  fd.append("orderId", orderId);
  fd.append("stepKey", stepKey);
  fd.append("slotKey", slotKey);

  const res = await fetch("/api/ridechecker/photos/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as { error?: string }).error || `Upload failed (${res.status})`);
  }
  const d = await res.json() as { url: string };
  return d.url;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function MobilePhotoCapture({
  label, hint, value, onChange,
  assignmentId, orderId, stepKey, slotKey,
  required = false,
}: MobilePhotoCaptureProps) {
  const inputRef      = useRef<HTMLInputElement>(null);
  const blobRef       = useRef<Blob | null>(null);
  const [state, setState]             = useState<UploadState>(value ? "uploaded" : "idle");
  const [error, setError]             = useState("");
  const [localPreview, setLocalPreview] = useState("");
  const [lightbox, setLightbox]       = useState(false);

  // ── Upload with auto-retry ────────────────────────────────────────────────

  const doUpload = useCallback(async (blob: Blob, attempt = 1) => {
    setState(attempt === 1 ? "uploading" : "retrying");
    setError("");
    try {
      const url = await uploadBlob(blob, assignmentId, orderId, stepKey, slotKey);
      blobRef.current = null;
      setState("uploaded");
      onChange(url);
    } catch (err: unknown) {
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY));
        doUpload(blob, attempt + 1);
      } else {
        blobRef.current = blob;
        setState("failed");
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    }
  }, [assignmentId, orderId, stepKey, slotKey, onChange]);

  // ── Handle file from camera/gallery ──────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    setState("compressing");
    setError("");
    // Show local preview immediately — best mobile UX
    const localUrl = URL.createObjectURL(file);
    setLocalPreview(localUrl);
    try {
      const compressed = await compressImage(file);
      await doUpload(compressed);
    } catch {
      setState("failed");
      setError("Could not read photo. Please try again.");
    }
  }, [doUpload]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ""; // allow re-selecting same file
  }

  function handleRetry() {
    if (blobRef.current) {
      doUpload(blobRef.current);
    } else {
      inputRef.current?.click();
    }
  }

  function handleRemove() {
    setState("idle");
    setLocalPreview("");
    blobRef.current = null;
    setError("");
    onChange("");
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const displayUrl = value || localPreview;
  const isLoading  = state === "compressing" || state === "uploading" || state === "retrying";

  const stateLabel: Record<UploadState, string> = {
    idle:        "",
    compressing: "Compressing…",
    uploading:   "Uploading…",
    retrying:    "Retrying…",
    failed:      "Upload failed",
    uploaded:    "Uploaded",
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Hidden camera input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
        data-testid={`input-camera-${stepKey}-${slotKey}`}
      />

      <div className="space-y-1.5" data-testid={`photo-slot-${stepKey}-${slotKey}`}>
        {/* Label row */}
        <div className="flex items-center justify-between min-h-[20px]">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold">{label}</span>
            {required && <span className="text-red-500 text-sm">*</span>}
          </div>
          {state === "uploaded" && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </span>
          )}
          {state === "failed" && (
            <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
              <AlertCircle className="h-3.5 w-3.5" /> Failed
            </span>
          )}
          {isLoading && (
            <span className="text-xs text-muted-foreground">{stateLabel[state]}</span>
          )}
        </div>

        {hint && (
          <p className="text-xs text-muted-foreground leading-snug">{hint}</p>
        )}

        {/* ── Empty state — tap to capture ─────────────────────────────── */}
        {!displayUrl && !isLoading && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 w-full rounded-2xl border-2 border-dashed transition-colors active:scale-[0.98] select-none ${
              state === "failed"
                ? "border-red-400 bg-red-50 dark:bg-red-950/20"
                : "border-border bg-muted/20 active:bg-muted/40"
            }`}
            style={{ minHeight: 168 }}
            data-testid={`button-capture-${stepKey}-${slotKey}`}
          >
            {state === "failed" ? (
              <>
                <AlertCircle className="h-9 w-9 text-red-500" />
                <div className="text-center px-4 space-y-0.5">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                    {error || "Upload failed"}
                  </p>
                  <p className="text-xs text-red-500">Tap to try again</p>
                </div>
              </>
            ) : (
              <>
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Camera className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center space-y-0.5">
                  <p className="text-base font-semibold">Tap to take photo</p>
                  <p className="text-xs text-muted-foreground">Opens rear camera</p>
                </div>
              </>
            )}
          </button>
        )}

        {/* ── Loading overlay ───────────────────────────────────────────── */}
        {isLoading && (
          <div
            className="relative flex flex-col items-center justify-center gap-2 w-full rounded-2xl border border-border overflow-hidden bg-muted/10"
            style={{ minHeight: 168 }}
          >
            {localPreview && (
              <img
                src={localPreview}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-30"
              />
            )}
            <RefreshCw className="relative h-8 w-8 animate-spin text-muted-foreground" />
            <p className="relative text-sm font-medium text-muted-foreground">{stateLabel[state]}</p>
          </div>
        )}

        {/* ── Preview — uploaded / failed with preview ──────────────────── */}
        {displayUrl && !isLoading && (
          <div
            className={`relative rounded-2xl overflow-hidden border-2 ${
              state === "uploaded"
                ? "border-green-400 dark:border-green-600"
                : state === "failed"
                ? "border-red-400"
                : "border-border"
            }`}
          >
            <img
              src={displayUrl}
              alt={label}
              className="w-full object-cover"
              style={{ maxHeight: 220 }}
              data-testid={`img-preview-${stepKey}-${slotKey}`}
            />

            {/* Gradient overlay with actions */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-3">
              <div className="flex items-center gap-2">
                {/* Status chip */}
                {state === "uploaded" ? (
                  <span className="flex items-center gap-1 text-xs text-white font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> Uploaded
                  </span>
                ) : state === "failed" ? (
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-1 text-xs text-white font-semibold bg-amber-500 rounded-full px-2.5 py-1"
                    data-testid={`button-retry-${stepKey}-${slotKey}`}
                  >
                    <RotateCcw className="h-3 w-3" /> Retry
                  </button>
                ) : null}

                <div className="flex gap-2 ml-auto">
                  {/* Zoom preview */}
                  <button
                    onClick={() => setLightbox(true)}
                    className="flex items-center justify-center h-8 w-8 bg-white/20 backdrop-blur-sm rounded-full"
                    data-testid={`button-zoom-${stepKey}-${slotKey}`}
                  >
                    <ZoomIn className="h-4 w-4 text-white" />
                  </button>
                  {/* Retake */}
                  <button
                    onClick={() => inputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-white font-semibold bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5"
                    data-testid={`button-retake-${stepKey}-${slotKey}`}
                  >
                    <RotateCcw className="h-3 w-3" /> Retake
                  </button>
                  {/* Remove */}
                  <button
                    onClick={handleRemove}
                    className="flex items-center justify-center h-8 w-8 bg-red-500/80 rounded-full"
                    data-testid={`button-remove-${stepKey}-${slotKey}`}
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      {lightbox && displayUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-white/20 flex items-center justify-center"
            onClick={() => setLightbox(false)}
            data-testid={`button-lightbox-close-${stepKey}-${slotKey}`}
          >
            <X className="h-5 w-5 text-white" />
          </button>
          <img
            src={displayUrl}
            alt={label}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
