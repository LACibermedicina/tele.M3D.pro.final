import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { QrCode, Download, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QRCodeGeneratorProps {
  url: string;
  title?: string;
  description?: string;
  size?: number;
}

export default function QRCodeGenerator({ 
  url, 
  title = "QR Code de Acesso", 
  description = "Escaneie este QR code para acessar o documento",
  size = 256 
}: QRCodeGeneratorProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    generateQRCode();
  }, [url, size]);

  const generateQRCode = async () => {
    try {
      const qrUrl = await QRCode.toDataURL(url, {
        width: size,
        margin: 2,
        color: {
          dark: '#1e40af', // Blue color
          light: '#ffffff',
        },
      });
      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handleDownload = () => {
    if (!qrCodeUrl) return;
    
    const link = document.createElement('a');
    link.download = `qrcode-${Date.now()}.png`;
    link.href = qrCodeUrl;
    link.click();

    toast({
      title: "QR Code Baixado",
      description: "O QR code foi salvo com sucesso.",
    });
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      toast({
        title: "Link Copiado",
        description: "O link de acesso foi copiado para a área de transferência.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível copiar o link.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="gap-2"
          data-testid="button-generate-qrcode"
        >
          <QrCode className="h-4 w-4" />
          QR Code
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-blue-600" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            {description}
          </p>
          
          {/* QR Code Display */}
          <div className="flex justify-center p-4 bg-white rounded-lg border-2 border-blue-100">
            {qrCodeUrl && (
              <img 
                src={qrCodeUrl} 
                alt="QR Code" 
                className="w-64 h-64"
                data-testid="img-qrcode"
              />
            )}
          </div>

          {/* URL Display */}
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Link de Acesso:</p>
            <p className="text-sm font-mono break-all">{url}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleDownload}
              className="flex-1"
              data-testid="button-download-qrcode"
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar QR Code
            </Button>
            
            <Button
              onClick={handleCopyUrl}
              variant="outline"
              className="flex-1"
              data-testid="button-copy-url"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Link
                </>
              )}
            </Button>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
              <QrCode className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                Compartilhe este QR code com o paciente ou outros profissionais para acesso rápido ao documento. 
                O acesso será validado com autenticação segura.
              </span>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
