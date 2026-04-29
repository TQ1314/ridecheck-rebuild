"use client";

import { useRef, useState } from "react";
import { Camera, X, Upload, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface PhotoUploadProps {
  label: string;
  hint?: string;
  value: string;
  onChange: (url: string) => void;
  assignmentId: string;
  required?: boolean;
  fieldKey: string;
}

export function PhotoUpload({
  label,
  hint,
  value,
  onChange,
  assignmentId,
  required,
  fieldKey,
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  async function handleFile(file: File) {
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("assignmentId", assignmentId);

      const res = await fetch("/api/ridechecker/photos/upload", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "Upload failed", variant: "destructive" });
        return;
      }
      onChange(data.url);
    } catch {
      toast({ title: "Upload failed. Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function remove() {
    onChange("");
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium leading-none">{label}</span>
        {required && <span className="text-red-500 text-sm">*</span>}
      </div>
      {hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
        data-testid={`input-file-${fieldKey}`}
      />

      {!value && !uploading && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center justify-center gap-2 w-full h-24 rounded-lg border-2 border-dashed border-border bg-muted/30 hover:bg-muted/60 transition-colors text-muted-foreground text-sm"
          data-testid={`button-upload-${fieldKey}`}
        >
          <Camera className="h-5 w-5" />
          Tap to take photo
        </button>
      )}

      {uploading && (
        <div className="flex items-center justify-center gap-2 w-full h-24 rounded-lg border border-border bg-muted/20 text-muted-foreground text-sm">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Uploading…
        </div>
      )}

      {value && !uploading && (
        <div className="relative rounded-lg overflow-hidden border border-border">
          <img
            src={value}
            alt={label}
            className="w-full h-40 object-cover"
            data-testid={`img-preview-${fieldKey}`}
          />
          <div className="absolute top-2 right-2 flex gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => inputRef.current?.click()}
              data-testid={`button-retake-${fieldKey}`}
            >
              <Upload className="h-3 w-3" />
              Replace
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 w-7 p-0"
              onClick={remove}
              data-testid={`button-remove-${fieldKey}`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
