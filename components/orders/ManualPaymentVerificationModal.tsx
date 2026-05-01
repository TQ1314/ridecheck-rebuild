"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, Upload, X, ExternalLink, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";

interface ManualPaymentVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  onSuccess: () => void;
}

export function ManualPaymentVerificationModal({
  open,
  onOpenChange,
  orderId,
  onSuccess,
}: ManualPaymentVerificationModalProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [stripeReference, setStripeReference] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 16));
  const [note, setNote] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setStripeReference("");
    setPayerEmail("");
    setAmount("");
    setPaymentDate(new Date().toISOString().slice(0, 16));
    setNote("");
    setEvidenceUrl("");
    setUploadedUrl(null);
    setUploadedFileName(null);
  };

  const handleClose = () => {
    if (submitting || uploading) return;
    resetForm();
    onOpenChange(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`/api/admin/orders/${orderId}/verify-payment/upload`, {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Upload failed", description: data.error, variant: "destructive" });
        return;
      }
      setUploadedUrl(data.url);
      setUploadedFileName(file.name);
      setEvidenceUrl(data.url);
      toast({ title: "Screenshot uploaded" });
    } catch {
      toast({ title: "Upload failed", description: "Could not upload file.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    // Client-side validation
    const errors: string[] = [];
    if (!stripeReference.trim()) errors.push("Stripe Reference ID");
    if (!payerEmail.trim()) errors.push("Payer Email");
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) errors.push("Amount");
    if (!paymentDate.trim()) errors.push("Payment Date & Time");
    if (!note.trim()) errors.push("Evidence Note");

    if (errors.length > 0) {
      toast({
        title: "Required fields missing",
        description: errors.join(", "),
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stripe_reference: stripeReference.trim(),
          payer_email: payerEmail.trim(),
          amount: parseFloat(amount),
          payment_date: new Date(paymentDate).toISOString(),
          note: note.trim(),
          evidence_url: uploadedUrl || evidenceUrl.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Verification failed",
          description: data.error || "Something went wrong.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Payment manually verified",
        description: `Verified by ${data.verified_by}. Order updated.`,
      });
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch {
      toast({ title: "Verification failed", description: "Request error.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="modal-manual-verify">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Manually Verify Payment
          </DialogTitle>
          <DialogDescription>
            Use only when Stripe webhook confirmation is unavailable. All fields are logged to the audit trail.
          </DialogDescription>
        </DialogHeader>

        {/* Warning banner */}
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <span>
            This action is logged and cannot be reversed. Only use if Stripe dashboard confirms the payment succeeded.
          </span>
        </div>

        <div className="space-y-4">
          {/* Stripe Reference */}
          <div className="space-y-1.5">
            <Label htmlFor="stripe-ref" className="text-sm font-medium">
              Stripe Payment Reference <span className="text-destructive">*</span>
            </Label>
            <Input
              id="stripe-ref"
              placeholder="pi_3... or cs_..."
              value={stripeReference}
              onChange={(e) => setStripeReference(e.target.value)}
              data-testid="input-stripe-reference"
            />
            <p className="text-xs text-muted-foreground">
              Payment Intent ID (pi_…) or Checkout Session ID (cs_…) from the Stripe dashboard.
            </p>
          </div>

          {/* Payer Email */}
          <div className="space-y-1.5">
            <Label htmlFor="payer-email" className="text-sm font-medium">
              Payer Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="payer-email"
              type="email"
              placeholder="buyer@example.com"
              value={payerEmail}
              onChange={(e) => setPayerEmail(e.target.value)}
              data-testid="input-payer-email"
            />
          </div>

          {/* Amount + Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-sm font-medium">
                Amount (USD) <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="139.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7"
                  data-testid="input-amount"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payment-date" className="text-sm font-medium">
                Payment Date/Time <span className="text-destructive">*</span>
              </Label>
              <Input
                id="payment-date"
                type="datetime-local"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                data-testid="input-payment-date"
              />
            </div>
          </div>

          {/* Evidence Note */}
          <div className="space-y-1.5">
            <Label htmlFor="note" className="text-sm font-medium">
              Evidence Note <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="note"
              placeholder="Describe what you observed in Stripe (e.g. 'Stripe dashboard shows pi_xxx succeeded for $139 on 5/1/26. Buyer email matches. Screenshot attached.')"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              data-testid="input-evidence-note"
            />
          </div>

          {/* Evidence: screenshot upload OR URL */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Evidence (optional)</Label>

            {/* File upload */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                data-testid="button-upload-screenshot"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                )}
                {uploading ? "Uploading…" : "Upload Screenshot"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
              {uploadedFileName && (
                <div className="flex items-center gap-1 text-xs text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[160px]">{uploadedFileName}</span>
                  <button
                    onClick={() => { setUploadedUrl(null); setUploadedFileName(null); setEvidenceUrl(""); }}
                    className="text-muted-foreground hover:text-destructive"
                    data-testid="button-remove-screenshot"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* URL input (alternative) */}
            {!uploadedUrl && (
              <div className="space-y-1">
                <Input
                  placeholder="Or paste evidence URL (Google Drive, Dropbox, etc.)"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  data-testid="input-evidence-url"
                />
              </div>
            )}

            {(uploadedUrl || evidenceUrl) && !uploadedFileName && (
              <a
                href={uploadedUrl || evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View evidence
              </a>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={submitting}
            data-testid="button-cancel-verify"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="button-confirm-verify"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Confirm Manual Verification
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
