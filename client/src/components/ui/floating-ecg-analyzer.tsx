import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Heart, X, Upload, Zap, Loader2, Minimize2, Maximize2,
  Activity, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const DX_COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#F97316', '#8B5CF6', '#EC4899'];

interface ECGResult {
  ecg_metrics: {
    heart_rate: string;
    rhythm: string;
    qrs_width: string;
    atrial_activity: string;
    signal_quality: string;
  };
  diagnosis_probabilities: Record<string, string>;
  technical_summary: string;
  simple_summary: string;
  disclaimer: string;
}

export default function FloatingECGAnalyzer() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [ecgImage, setEcgImage] = useState<string | null>(null);
  const [ecgPreview, setEcgPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ECGResult | null>(null);
  const [showMetrics, setShowMetrics] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user || !['doctor', 'admin'].includes(user.role)) return null;

  const ecgMutation = useMutation({
    mutationFn: async () => {
      if (!ecgImage) throw new Error('No image');
      const res = await apiRequest('POST', '/api/ecg/analyze', {
        imageBase64: ecgImage,
        patientContext: {},
      });
      return res.json();
    },
    onSuccess: (data: ECGResult) => {
      setResult(data);
      toast({ title: 'ECG analisado com sucesso' });
    },
    onError: () => {
      toast({ title: 'Erro na análise ECG', variant: 'destructive' });
    },
  });

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(',')[1];
      setEcgImage(base64);
      setEcgPreview(e.target?.result as string);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const clearAll = () => {
    setEcgImage(null);
    setEcgPreview(null);
    setResult(null);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-20 z-40 w-12 h-12 rounded-full bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-110"
        title="Quick ECG Analyzer"
      >
        <Heart className="h-5 w-5" />
      </button>
    );
  }

  const panelWidth = isExpanded ? 'w-[520px]' : 'w-[380px]';
  const panelHeight = isExpanded ? 'max-h-[85vh]' : 'max-h-[60vh]';

  return (
    <div className={`fixed bottom-24 right-20 z-50 ${panelWidth} ${panelHeight} flex flex-col`}>
      <Card className="flex flex-col h-full border-red-500/30 shadow-2xl bg-background/95 backdrop-blur-sm">
        <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between border-b shrink-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <Heart className="h-4 w-4 text-red-500" />
            Quick ECG Analyzer
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <CardContent className="p-3 space-y-3">
            {!ecgPreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-red-500/30 rounded-lg p-6 text-center cursor-pointer hover:border-red-500/50 hover:bg-red-500/5 transition-colors"
              >
                <Upload className="h-8 w-8 mx-auto text-red-400 mb-2" />
                <p className="text-sm font-medium">Arraste ou clique para upload</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG - Imagem ECG</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative rounded-lg overflow-hidden border">
                  <img src={ecgPreview} alt="ECG" className="w-full h-auto max-h-32 object-contain bg-white" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={clearAll}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                <Button
                  onClick={() => ecgMutation.mutate()}
                  disabled={ecgMutation.isPending}
                  className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700"
                  size="sm"
                >
                  {ecgMutation.isPending ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Analisando...</>
                  ) : (
                    <><Zap className="h-3 w-3 mr-1" /> Analisar ECG</>
                  )}
                </Button>
              </div>
            )}

            {result && (
              <div className="space-y-3">
                <button
                  onClick={() => setShowMetrics(!showMetrics)}
                  className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <span className="flex items-center gap-1">
                    <Activity className="h-3 w-3" /> Métricas ECG
                  </span>
                  {showMetrics ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {showMetrics && (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(result.ecg_metrics).map(([key, val]) => (
                      <div key={key} className="p-2 rounded-lg bg-muted/50 border">
                        <p className="text-[10px] text-muted-foreground uppercase">{key.replace(/_/g, ' ')}</p>
                        <p className="text-xs font-medium">{val}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={Object.entries(result.diagnosis_probabilities).map(([name, prob]) => ({
                        name: name.replace(/_/g, ' '),
                        probability: parseFloat(prob) || 0,
                      }))}
                      layout="vertical"
                      margin={{ left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 9 }} />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 9 }} />
                      <Tooltip formatter={(val: number) => `${val}%`} />
                      <Bar dataKey="probability" radius={[0, 4, 4, 0]}>
                        {Object.entries(result.diagnosis_probabilities).map((_, idx) => (
                          <Cell key={idx} fill={DX_COLORS[idx % DX_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <Card className="border-green-500/20">
                  <CardContent className="p-2">
                    <p className="text-xs font-medium mb-1">Resumo</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{result.simple_summary}</p>
                  </CardContent>
                </Card>

                {isExpanded && (
                  <Card className="border-blue-500/20">
                    <CardContent className="p-2">
                      <p className="text-xs font-medium mb-1">Resumo Técnico</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{result.technical_summary}</p>
                    </CardContent>
                  </Card>
                )}

                <div className="flex items-start gap-1.5 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-muted-foreground">{result.disclaimer}</p>
                </div>
              </div>
            )}
          </CardContent>
        </ScrollArea>
      </Card>
    </div>
  );
}