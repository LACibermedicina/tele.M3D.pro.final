import { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Copy, CheckCircle, Send, Loader2, Camera, CameraOff } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

interface QRTransferProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TransferResponse {
  message?: string;
}

interface BarcodeDetectorResult {
  rawValue: string;
}

interface BarcodeDetectorAPI {
  detect: (source: HTMLVideoElement | HTMLCanvasElement) => Promise<BarcodeDetectorResult[]>;
}

export function QRTransfer({ open, onOpenChange }: QRTransferProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [qrDataURL, setQrDataURL] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [recipientCode, setRecipientCode] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [mode, setMode] = useState<"show" | "send" | "scan">("show");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const userCode = user?.id ? `TM3D-${user.id}` : "";

  useEffect(() => {
    if (open && userCode) {
      QRCode.toDataURL(userCode, {
        width: 200,
        margin: 2,
        color: { dark: "#1e40af", light: "#ffffff" },
      })
        .then(setQrDataURL)
        .catch(() => setQrDataURL(""));
    }
  }, [open, userCode]);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setMode("show");
    }
  }, [open]);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
    setCameraError("");
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);

      const W = window as Record<string, unknown>;
      const hasBarcodeDetector = typeof W.BarcodeDetector === "function";

      if (hasBarcodeDetector) {
        const detector = new (W.BarcodeDetector as new (opts: { formats: string[] }) => BarcodeDetectorAPI)({
          formats: ["qr_code"],
        });

        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0) {
              const code = results[0].rawValue;
              if (code.startsWith("TM3D-")) {
                stopCamera();
                setRecipientCode(code);
                setMode("send");
                toast({ title: "QR Code lido!", description: `Código: ${code}` });
              }
            }
          } catch {}
        }, 500);
      } else {
        scanIntervalRef.current = setInterval(() => {
          if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          ctx.drawImage(videoRef.current, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qrResult = jsQR(imageData.data, imageData.width, imageData.height);
          if (qrResult && qrResult.data.startsWith("TM3D-")) {
            stopCamera();
            setRecipientCode(qrResult.data);
            setMode("send");
            toast({ title: "QR Code lido!", description: `Código: ${qrResult.data}` });
          }
        }, 500);
      }
    } catch {
      setCameraError("Não foi possível acessar a câmera. Verifique as permissões.");
      setScanning(false);
    }
  }, [stopCamera, toast]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Código copiado!" });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const transferMutation = useMutation({
    mutationFn: async (data: { toUserCode: string; amount: number; reason: string }) => {
      const userId = data.toUserCode.replace("TM3D-", "");
      const res = await apiRequest("POST", "/api/tmc/transfer-request", {
        toUserId: userId,
        amount: data.amount,
        reason: data.reason || "Transferência por QR Code",
      });
      return (await res.json()) as TransferResponse;
    },
    onSuccess: (data: TransferResponse) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tmc/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tmc/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tmc/transfers/history"] });
      setRecipientCode("");
      setTransferAmount("");
      setTransferReason("");
      toast({ title: "Transferência solicitada!", description: data.message || "Aguardando aprovação do destinatário." });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message || "Falha na transferência", variant: "destructive" });
    },
  });

  const handleTransfer = () => {
    const amount = parseInt(transferAmount);
    if (!recipientCode || !amount || amount <= 0) {
      toast({ title: "Dados incompletos", description: "Informe o código do destinatário e um valor válido.", variant: "destructive" });
      return;
    }
    transferMutation.mutate({ toUserCode: recipientCode, amount, reason: transferReason });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            Transferência por QR Code
          </DialogTitle>
          <DialogDescription>
            Compartilhe seu QR Code, escaneie o de outro usuário ou insira o código manualmente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1.5 mb-4">
          <Button
            variant={mode === "show" ? "default" : "outline"}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => { stopCamera(); setMode("show"); }}
          >
            Meu QR
          </Button>
          <Button
            variant={mode === "scan" ? "default" : "outline"}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => { setMode("scan"); startCamera(); }}
          >
            <Camera className="w-3.5 h-3.5 mr-1" />
            Escanear
          </Button>
          <Button
            variant={mode === "send" ? "default" : "outline"}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => { stopCamera(); setMode("send"); }}
          >
            Enviar
          </Button>
        </div>

        {mode === "show" && (
          <div className="flex flex-col items-center space-y-4">
            {qrDataURL && (
              <div className="bg-white p-4 rounded-xl shadow-inner">
                <img src={qrDataURL} alt="QR Code" className="w-48 h-48" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <code className="text-sm bg-muted px-3 py-1.5 rounded-md font-mono">{userCode}</code>
              <Button variant="ghost" size="icon" onClick={copyCode} className="h-8 w-8">
                {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Mostre este QR Code para outro usuário escanear e enviar créditos para você.
            </p>
          </div>
        )}

        {mode === "scan" && (
          <div className="flex flex-col items-center space-y-3">
            {cameraError ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <CameraOff className="w-10 h-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">{cameraError}</p>
                <Button variant="outline" size="sm" onClick={() => { setMode("send"); }}>
                  Inserir código manualmente
                </Button>
              </div>
            ) : (
              <>
                <div className="relative w-full aspect-square max-w-[280px] rounded-xl overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  <div className="absolute inset-0 border-2 border-cyan-400/50 rounded-xl pointer-events-none" />
                  <div className="absolute inset-[15%] border-2 border-white/60 rounded-lg pointer-events-none" />
                </div>
                <canvas ref={canvasRef} className="hidden" />
                <p className="text-xs text-muted-foreground text-center">
                  {scanning ? "Aponte a câmera para o QR Code TM3D" : "Iniciando câmera..."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => { stopCamera(); setMode("send"); }}
                >
                  Inserir código manualmente
                </Button>
              </>
            )}
          </div>
        )}

        {mode === "send" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Código do Destinatário</Label>
              <Input
                value={recipientCode}
                onChange={(e) => setRecipientCode(e.target.value)}
                placeholder="TM3D-xxx"
              />
            </div>
            <div className="space-y-2">
              <Label>Quantidade de Créditos (TM3D)</Label>
              <Input
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="Ex: 50"
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Input
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="Ex: Pagamento de consulta"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleTransfer}
              disabled={transferMutation.isPending}
            >
              {transferMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Enviar Créditos
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
