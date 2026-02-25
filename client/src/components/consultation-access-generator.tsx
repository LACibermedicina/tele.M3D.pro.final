import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  QrCode,
  Link2,
  Send,
  Copy,
  CheckCircle,
  Loader2,
  Smartphone,
  ExternalLink,
  Share2,
} from "lucide-react";

interface ConsultationAccessGeneratorProps {
  patientId: string;
  patientName: string;
  consultationId?: string;
  appointmentId?: string;
  scheduledAt?: string;
  trigger?: React.ReactNode;
}

export default function ConsultationAccessGenerator({
  patientId,
  patientName,
  consultationId,
  appointmentId,
  scheduledAt,
  trigger,
}: ConsultationAccessGeneratorProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [generated, setGenerated] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/consultation-access/generate", {
        patientId,
        consultationId,
        appointmentId,
        scheduledAt,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setGenerated(data);
      toast({ title: "Link de acesso gerado!", description: `Código: ${data.shortCode}` });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const sendWhatsAppMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/consultation-access/send-whatsapp", {
        patientId,
        shortCode: generated.shortCode,
        accessLink: generated.accessLink,
        message: generated.whatsappMessage,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.sent) {
        toast({ title: "Enviado via WhatsApp!", description: `Link enviado para ${patientName}` });
      } else {
        toast({ title: "Aviso", description: "WhatsApp API indisponível. Use o link direto ou QR Code.", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao enviar WhatsApp. Use o link ou QR Code.", variant: "destructive" });
    },
  });

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
      toast({ title: "Copiado!" });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  }

  function openWhatsAppWeb() {
    if (!generated) return;
    const encodedMsg = encodeURIComponent(generated.whatsappMessage);
    window.open(`https://wa.me/?text=${encodedMsg}`, "_blank");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setGenerated(null); setCopied(null); } }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <QrCode className="h-4 w-4" />
            Gerar Acesso
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-indigo-600" />
            Acesso Direto — {patientName}
          </DialogTitle>
          <DialogDescription>
            Gere um QR Code e link de acesso direto à consulta. O paciente entra sem precisar de login.
          </DialogDescription>
        </DialogHeader>

        {!generated ? (
          <div className="space-y-4 pt-2">
            <div className="bg-indigo-50 dark:bg-indigo-950 rounded-lg p-4 text-sm space-y-2">
              <p className="font-medium text-indigo-700 dark:text-indigo-300">Como funciona:</p>
              <ul className="text-indigo-600 dark:text-indigo-400 space-y-1 text-xs">
                <li>1. Um código único de 6 caracteres será gerado</li>
                <li>2. O paciente acessa o link ou digita o código</li>
                <li>3. A plataforma autentica automaticamente</li>
                <li>4. Você recebe notificação quando o paciente entrar</li>
              </ul>
            </div>

            {scheduledAt && (
              <div className="text-sm text-muted-foreground">
                Agendamento: {new Date(scheduledAt).toLocaleDateString("pt-BR", {
                  weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
                })}
              </div>
            )}

            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <QrCode className="h-4 w-4 mr-2" />
              )}
              Gerar QR Code e Link
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {generated.qrCodeDataUrl && (
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-xl shadow-md">
                  <img src={generated.qrCodeDataUrl} alt="QR Code de acesso" className="w-48 h-48" />
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Código de acesso</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={generated.shortCode}
                    readOnly
                    className="font-mono text-xl text-center tracking-[0.3em] font-bold"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(generated.shortCode, "code")}
                  >
                    {copied === "code" ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Link de acesso</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={generated.accessLink}
                    readOnly
                    className="text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(generated.accessLink, "link")}
                  >
                    {copied === "link" ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => sendWhatsAppMutation.mutate()}
                disabled={sendWhatsAppMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {sendWhatsAppMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                Enviar via API
              </Button>
              <Button
                variant="outline"
                onClick={openWhatsAppWeb}
                className="border-green-300 text-green-700 hover:bg-green-50"
              >
                <Smartphone className="h-4 w-4 mr-1" />
                WhatsApp Web
              </Button>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => copyToClipboard(generated.whatsappMessage, "msg")}
            >
              {copied === "msg" ? (
                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <Share2 className="h-4 w-4 mr-1" />
              )}
              Copiar Mensagem Completa
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Válido por 48 horas. Uso único. O paciente será autenticado automaticamente.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
