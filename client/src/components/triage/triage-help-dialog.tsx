import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { TRIAGE_LEVELS_ARRAY, TRIAGE_PROTOCOL_INFO } from "@/lib/triage";

interface TriageHelpDialogProps {
  trigger?: React.ReactNode;
}

export function TriageHelpDialog({ trigger }: TriageHelpDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <i className="fas fa-question-circle mr-2"></i>
            Guia de Triagem
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <i className="fas fa-tachometer-alt text-primary"></i>
            {TRIAGE_PROTOCOL_INFO.name}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm">{TRIAGE_PROTOCOL_INFO.description}</p>
              <p className="text-xs text-muted-foreground mt-2">{TRIAGE_PROTOCOL_INFO.adoption}</p>
            </div>

            <div className="flex gap-1">
              {TRIAGE_LEVELS_ARRAY.map((config) => (
                <div
                  key={config.level}
                  className="flex-1 h-2 rounded-full"
                  style={{ backgroundColor: config.color }}
                  title={config.label}
                />
              ))}
            </div>

            {TRIAGE_LEVELS_ARRAY.map((config) => (
              <div key={config.level}>
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: config.color }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{config.label}</h4>
                      <span className="text-xs text-muted-foreground">{config.maxWaitTime}</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-2 ml-8">{config.description}</p>
                <div className="ml-8 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Critérios indicativos:</p>
                  <ul className="grid grid-cols-1 gap-0.5">
                    {config.criteria.map((criterion, idx) => (
                      <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span
                          className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0"
                          style={{ backgroundColor: config.color }}
                        />
                        {criterion}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-8 italic">{config.protocol}</p>
                <Separator className="mt-4" />
              </div>
            ))}

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2">
                <i className="fas fa-book-medical mr-2 text-primary"></i>
                Referências
              </h4>
              <ul className="space-y-1">
                {TRIAGE_PROTOCOL_INFO.references.map((ref, idx) => (
                  <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <i className="fas fa-circle text-[4px] mt-1.5 text-muted-foreground"></i>
                    {ref}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-3 italic">
                {TRIAGE_PROTOCOL_INFO.fallback}
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
