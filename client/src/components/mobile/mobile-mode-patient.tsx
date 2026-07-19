import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Stethoscope, Coins, MessageSquare, Settings,
  ChevronRight, QrCode, Loader2, Wallet, ArrowUpRight, ArrowDownLeft
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { QRTransfer } from "@/components/wallet/qr-transfer";

interface UpcomingAppointment {
  id: string;
  doctorName?: string;
  scheduledDate?: string;
  status: string;
  videoConsultationId?: string | null;
  session?: { id: string } | null;
}

interface PendingPrescription {
  id: string;
}

interface TransactionRecord {
  id: number;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
}

interface ConsultationsData {
  upcoming: UpcomingAppointment[];
  past: UpcomingAppointment[];
  total: number;
}

export function MobileModePatient() {
  const { user } = useAuth();
  const { clearViewMode } = useViewMode();
  const [, setLocation] = useLocation();
  const [qrOpen, setQrOpen] = useState(false);

  const { data: balance, isLoading: balanceLoading } = useQuery<{ balance: number }>({
    queryKey: ["/api/tmc/balance"],
  });

  const { data: consultations } = useQuery<ConsultationsData>({
    queryKey: ["/api/my-consultations"],
    retry: false,
  });

  const { data: transactions } = useQuery<TransactionRecord[]>({
    queryKey: ["/api/tmc/transactions"],
    retry: false,
  });

  const { data: pendingFeedback } = useQuery<PendingPrescription[]>({
    queryKey: ["/api/post-consultation/patient-items"],
    retry: false,
  });

  const hasPendingFeedback = pendingFeedback && pendingFeedback.length > 0;
  const recentTransactions = transactions?.slice(0, 3) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-slate-900 dark:to-slate-800">
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 border-2 border-primary/20">
              <AvatarImage src={user?.profilePicture || undefined} />
              <AvatarFallback data-no-translate className="bg-primary/10 text-primary font-bold">
                {user?.name?.charAt(0) || "P"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 data-no-translate className="text-base font-bold">{user?.name || "Paciente"}</h1>
              <p className="text-xs text-muted-foreground">Modo Mobile</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => {
              clearViewMode();
              setLocation("/mode-selection");
            }}
          >
            <Settings className="w-3.5 h-3.5 mr-1" />
            Trocar
          </Button>
        </div>

        <Link href="/consultation-request">
          <Card className="cursor-pointer border-0 shadow-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:shadow-xl transition-all">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <Stethoscope className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold">Consultar</h2>
                <p className="text-white/80 text-sm">Solicitar consulta com médico disponível</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/60" />
            </CardContent>
          </Card>
        </Link>

        <Card
          className="cursor-pointer border-0 shadow-lg hover:shadow-xl transition-all"
          onClick={() => setLocation("/wallet")}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                <Coins className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold">Créditos Disponíveis</h2>
                <div className="flex items-center gap-2 mt-1">
                  {balanceLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span className="text-2xl font-bold text-primary">
                      {balance?.balance || 0} TM3D
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex gap-2 mt-3">
              <Link href="/wallet">
                <Button size="sm" variant="outline" className="text-xs">
                  <Wallet className="w-3.5 h-3.5 mr-1" />
                  Comprar Créditos
                </Button>
              </Link>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setQrOpen(true);
                }}
              >
                <QrCode className="w-3.5 h-3.5 mr-1" />
                QR Code
              </Button>
            </div>
            {recentTransactions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Últimas transações</p>
                <div className="space-y-1.5">
                  {recentTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        {tx.amount > 0 ? (
                          <ArrowDownLeft className="w-3 h-3 text-green-500" />
                        ) : (
                          <ArrowUpRight className="w-3 h-3 text-red-500" />
                        )}
                        <span className="truncate max-w-[140px]">{tx.description || tx.type}</span>
                      </div>
                      <span className={tx.amount > 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount} TM3D
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {hasPendingFeedback && (
          <Link href="/prescriptions">
            <Card className="cursor-pointer border-0 shadow-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border-amber-200 dark:border-amber-800 hover:shadow-xl transition-all">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-amber-800 dark:text-amber-200">
                    Feedback do Doutor
                  </h2>
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    {pendingFeedback.length} pendência{pendingFeedback.length > 1 ? "s" : ""}
                  </p>
                </div>
                <Badge className="bg-amber-500 text-white">{pendingFeedback.length}</Badge>
              </CardContent>
            </Card>
          </Link>
        )}

        {consultations?.upcoming && consultations.upcoming.length > 0 && (
          <Card className="shadow-md">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Próximas Consultas</h3>
              <div className="space-y-2">
                {consultations.upcoming.slice(0, 3).map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800"
                  >
                    <div>
                      <p className="text-sm font-medium">{apt.doctorName || `Consulta #${apt.id}`}</p>
                      <p className="text-xs text-muted-foreground">
                        {apt.scheduledDate
                          ? new Date(apt.scheduledDate).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </p>
                    </div>
                    {(apt.videoConsultationId || apt.status === "in_progress") && (
                      <Link
                        href={
                          apt.videoConsultationId
                            ? `/patient/video/${apt.videoConsultationId}`
                            : `/consultation-session/${apt.session?.id || apt.id}`
                        }
                      >
                        <Button size="sm" className="h-7 text-xs">
                          Entrar
                        </Button>
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <QRTransfer open={qrOpen} onOpenChange={setQrOpen} />
    </div>
  );
}
