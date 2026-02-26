import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, CreditCard, Loader2 } from "lucide-react";

export interface PaymentDialogSlot {
  id: number;
  startsAt: string;
  durationMinutes: number;
  priceDinar: number;
}

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  slot: PaymentDialogSlot | null;
  therapistName: string;
  onConfirm: (paymentMethod: "flouci" | "konnect") => Promise<void>;
  isPending?: boolean;
}

export function PaymentDialog({
  open,
  onClose,
  slot,
  therapistName,
  onConfirm,
  isPending,
}: PaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<"flouci" | "konnect">("flouci");
  const [termsAccepted, setTermsAccepted] = useState(false);

  if (!slot) return null;

  const startDate = new Date(slot.startsAt);
  const isFree = slot.priceDinar === 0;

  const handleConfirm = async () => {
    await onConfirm(paymentMethod);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm booking</DialogTitle>
          <DialogDescription>
            Review your session details before confirming.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Session details */}
          <div className="rounded-lg bg-muted/60 p-4 space-y-2">
            <p className="text-sm font-semibold">{therapistName}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {startDate.toLocaleDateString("fr-TN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {startDate.toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" })}
                {" · "}
                {slot.durationMinutes} min
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total</span>
              <span className="text-lg font-bold">
                {isFree ? (
                  <Badge variant="secondary">Free</Badge>
                ) : (
                  `${slot.priceDinar} د.ت`
                )}
              </span>
            </div>
          </div>

          {/* Payment method selection */}
          {!isFree && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Payment method</p>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as "flouci" | "konnect")}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 rounded-lg border p-3">
                  <RadioGroupItem value="flouci" id="pay-flouci" />
                  <Label htmlFor="pay-flouci" className="flex-1 cursor-pointer">
                    <p className="font-medium">Flouci</p>
                    <p className="text-xs text-muted-foreground">Card, mobile wallet</p>
                  </Label>
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex items-center space-x-3 rounded-lg border p-3">
                  <RadioGroupItem value="konnect" id="pay-konnect" />
                  <Label htmlFor="pay-konnect" className="flex-1 cursor-pointer">
                    <p className="font-medium">Konnect</p>
                    <p className="text-xs text-muted-foreground">D17, bank transfer</p>
                  </Label>
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Terms */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={(v) => setTermsAccepted(v === true)}
            />
            <Label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
              I agree to the session cancellation policy. Sessions may not be refunded within 24 hours of the start time.
            </Label>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              className="flex-1"
              disabled={!termsAccepted || isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isFree ? (
                "Confirm booking"
              ) : (
                "Confirm & Pay"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
