import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, ShieldCheck } from "lucide-react";

interface StripeCheckoutFormProps {
  amount: string;
  currency: string;
  credits: number;
  onSuccess: (paymentIntentId: string) => void;
  onError: (message: string) => void;
}

export default function StripeCheckoutForm({
  amount,
  currency,
  credits,
  onSuccess,
  onError,
}: StripeCheckoutFormProps) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (error) {
        const msg = error.message || t("common.error");
        setErrorMessage(msg);
        onError(msg);
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        onSuccess(paymentIntent.id);
      } else if (paymentIntent) {
        const msg = `Payment status: ${paymentIntent.status}`;
        setErrorMessage(msg);
        onError(msg);
      }
    } catch (err: any) {
      const msg = err.message || t("common.error");
      setErrorMessage(msg);
      onError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border p-4 bg-muted/20">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {credits} TM3D — {currency} {amount}
          </span>
        </div>
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>

      {errorMessage && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-sm text-destructive">{errorMessage}</p>
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={!stripe || !elements || isProcessing}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <ShieldCheck className="h-4 w-4 mr-2" />
        )}
        {isProcessing
          ? t("wallet_page.processing")
          : `${t("common.confirm")} — ${currency} ${amount}`}
      </Button>

      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3 w-3" />
        <span>Stripe Secure Payment</span>
      </div>
    </form>
  );
}
