import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface WalletPayPalCheckoutProps {
  amount: string;
  currency: string;
  orderId: string;
  onSuccess: (captureData: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export default function WalletPayPalCheckout({
  amount,
  currency,
  orderId,
  onSuccess,
  onError,
  onCancel,
}: WalletPayPalCheckoutProps) {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const initialized = useRef(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const loadAndInit = async () => {
      try {
        if (!(window as any).paypal) {
          const script = document.createElement("script");
          const useProduction = import.meta.env.VITE_PAYPAL_MODE === 'production';
          script.src = useProduction
            ? "https://www.paypal.com/web-sdk/v6/core"
            : "https://www.sandbox.paypal.com/web-sdk/v6/core";
          script.async = true;
          await new Promise<void>((resolve, reject) => {
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load PayPal SDK"));
            document.body.appendChild(script);
          });
        }
        await initPayPal();
      } catch (e) {
        console.error("Failed to load PayPal SDK", e);
        onError("Falha ao carregar PayPal SDK");
        setLoading(false);
      }
    };

    loadAndInit();
  }, []);

  const initPayPal = async () => {
    try {
      const clientToken: string = await fetch("/paypal/setup")
        .then((res) => res.json())
        .then((data) => data.clientToken);

      const sdkInstance = await (window as any).paypal.createInstance({
        clientToken,
        components: ["paypal-payments"],
      });

      const paypalCheckout = sdkInstance.createPayPalOneTimePaymentSession({
        onApprove: async (data: any) => {
          setProcessing(true);
          try {
            const captureRes = await fetch("/api/credits/purchase/capture", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderID: data.orderId }),
            });
            const creditResult = await captureRes.json();
            if (captureRes.ok) {
              onSuccess(creditResult);
            } else {
              onError(creditResult.message || "Falha ao processar créditos");
            }
          } catch (e: any) {
            console.error("Capture error:", e);
            onError(e.message || "Erro ao capturar pagamento");
          } finally {
            setProcessing(false);
          }
        },
        onCancel: () => {
          onCancel();
        },
        onError: (data: any) => {
          console.error("PayPal error:", data);
          onError("Erro no PayPal");
        },
      });

      const walletButton = buttonRef.current?.querySelector("#wallet-paypal-btn");
      if (walletButton) {
        walletButton.addEventListener("click", async () => {
          try {
            await paypalCheckout.start(
              { paymentFlow: "auto" },
              Promise.resolve({ orderId })
            );
          } catch (e) {
            console.error(e);
          }
        });
      }

      setLoading(false);
    } catch (e) {
      console.error("PayPal init error:", e);
      onError("Falha ao inicializar PayPal");
      setLoading(false);
    }
  };

  if (processing) {
    return (
      <div className="flex items-center justify-center py-4 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm text-muted-foreground">Processando pagamento...</span>
      </div>
    );
  }

  return (
    <div ref={buttonRef}>
      {loading ? (
        <div className="flex items-center justify-center py-4 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm text-muted-foreground">Carregando PayPal...</span>
        </div>
      ) : (
        <button
          id="wallet-paypal-btn"
          type="button"
          className="w-full bg-[#0070ba] hover:bg-[#003087] text-white font-medium py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797H9.603c-.564 0-1.04.408-1.13.964L7.076 21.337z" />
          </svg>
          Pagar com PayPal — ${amount}
        </button>
      )}
    </div>
  );
}
