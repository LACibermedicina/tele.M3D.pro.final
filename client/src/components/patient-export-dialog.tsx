import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Download, FileJson, FileText, Shield, Globe, Loader2, Check } from "lucide-react";

interface PatientExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
}

const standards = [
  {
    value: "fhir-br",
    label: "Brasil / SUS",
    description: "RNDS, RAC (DATASUS), SBIS, HL7 FHIR R4, LGPD",
    badges: ["RNDS", "RAC", "SBIS", "LGPD", "CID-10"],
    flag: "\u{1F1E7}\u{1F1F7}",
  },
  {
    value: "fhir-us",
    label: "Estados Unidos",
    description: "HL7 FHIR R4, HIPAA, ONC, USCDI v3, US Core",
    badges: ["HIPAA", "ONC", "USCDI v3", "US Core"],
    flag: "\u{1F1FA}\u{1F1F8}",
  },
  {
    value: "fhir-eu",
    label: "Europa",
    description: "HL7 FHIR R4, GDPR, EUDAMED, EU Patient Summary",
    badges: ["GDPR", "EUDAMED", "EU FHIR"],
    flag: "\u{1F1EA}\u{1F1FA}",
  },
  {
    value: "fhir-intl",
    label: "Internacional",
    description: "HL7 FHIR R4, WHO ICD-11, SNOMED CT, LOINC",
    badges: ["FHIR R4", "ICD-11", "SNOMED", "LOINC"],
    flag: "\u{1F30D}",
  },
];

export default function PatientExportDialog({ open, onOpenChange, patientId, patientName }: PatientExportDialogProps) {
  const [standard, setStandard] = useState("fhir-br");
  const [format, setFormat] = useState<"json" | "pdf">("json");
  const [deidentify, setDeidentify] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const selectedStandard = standards.find(s => s.value === standard)!;
  const needsConsent = standard === "fhir-br" || standard === "fhir-eu";
  const showDeidentify = standard === "fhir-us";

  const handleExport = async () => {
    if (needsConsent && !consentChecked) {
      toast({
        title: "Consentimento necessário",
        description: standard === "fhir-br"
          ? "Você precisa confirmar o consentimento LGPD antes de exportar."
          : "You must confirm GDPR consent before exporting.",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    try {
      const params = new URLSearchParams({
        standard,
        format,
        deidentify: deidentify.toString(),
      });

      const response = await fetch(`/api/patients/${patientId}/export?${params}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Erro desconhecido" }));
        throw new Error(error.message || "Falha na exportação");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = format === "json"
        ? `fhir-bundle-${patientId}-${standard}.json`
        : `prontuario-${patientId}-${standard}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Exportação concluída",
        description: `Prontuário exportado no padrão ${selectedStandard.label}.`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro na exportação",
        description: error.message || "Não foi possível exportar os dados.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Prontuário Digital
          </DialogTitle>
          <DialogDescription>
            Exportar dados de <strong>{patientName}</strong> em formato padronizado internacional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <div>
            <Label className="text-sm font-medium mb-2 block">Padrão de Interoperabilidade</Label>
            <RadioGroup value={standard} onValueChange={setStandard} className="space-y-2">
              {standards.map(s => (
                <label
                  key={s.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    standard === s.value ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"
                  }`}
                >
                  <RadioGroupItem value={s.value} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{s.flag}</span>
                      <span className="font-medium text-sm">{s.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {s.badges.map(b => (
                        <Badge key={b} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {b}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Formato de Exportação</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat("json")}
                className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                  format === "json" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <FileJson className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium text-sm">FHIR JSON</p>
                  <p className="text-xs text-muted-foreground">Bundle HL7 FHIR R4</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFormat("pdf")}
                className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                  format === "pdf" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <FileText className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-medium text-sm">PDF / HTML</p>
                  <p className="text-xs text-muted-foreground">Documento legível</p>
                </div>
              </button>
            </div>
          </div>

          {showDeidentify && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
              <Shield className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="deidentify"
                    checked={deidentify}
                    onCheckedChange={(checked) => setDeidentify(checked === true)}
                  />
                  <Label htmlFor="deidentify" className="text-sm font-medium cursor-pointer">
                    HIPAA Safe Harbor De-identification
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Remove all 18 HIPAA identifiers (name, dates, contact info, etc.) per 45 CFR §164.514(b).
                </p>
              </div>
            </div>
          )}

          {needsConsent && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
              <Globe className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="consent"
                    checked={consentChecked}
                    onCheckedChange={(checked) => setConsentChecked(checked === true)}
                  />
                  <Label htmlFor="consent" className="text-sm font-medium cursor-pointer">
                    {standard === "fhir-br"
                      ? "Consentimento LGPD (Lei 13.709/2018)"
                      : "GDPR Consent (EU 2016/679)"}
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {standard === "fhir-br"
                    ? "Confirmo que o titular dos dados consentiu com a exportação de seus dados pessoais sensíveis conforme Art. 11 da LGPD."
                    : "I confirm that the data subject has given explicit consent for the export of their personal health data under GDPR Article 9(2)(a)."}
                </p>
              </div>
            </div>
          )}

          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs font-medium mb-1.5">Dados incluídos na exportação:</p>
            <div className="grid grid-cols-2 gap-1">
              {[
                "Dados demográficos",
                "Prontuários médicos",
                "Prescrições",
                "Resultados de exames",
                "Inferências diagnósticas",
                "Consultas e encontros",
                "Encaminhamentos",
                "Notas clínicas",
                "Alergias",
                "Planos de cuidado",
              ].map(item => (
                <div key={item} className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={handleExport}
            disabled={exporting || (needsConsent && !consentChecked)}
            className="w-full"
            size="lg"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Exportar {format === "json" ? "FHIR Bundle" : "Prontuário PDF"} — {selectedStandard.label}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
