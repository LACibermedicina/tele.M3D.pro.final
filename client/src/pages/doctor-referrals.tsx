import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import PageWrapper from "@/components/layout/page-wrapper";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Link2, Copy, CheckCircle, Users, Coins,
  TrendingUp, Share2, QrCode, UserPlus
} from "lucide-react";

interface ReferralLinkData {
  referralCode: string;
  referralLink: string;
  commissionPercent: number;
}

interface ReferralStats {
  referredDoctors: {
    id: string;
    name: string;
    specialization: string | null;
    medicalLicense: string | null;
    profilePicture: string | null;
    createdAt: string;
  }[];
  totalReferred: number;
  commissionPercent: number;
  totalEarned: number;
  recentTransactions: {
    id: string;
    amount: number;
    reason: string;
    metadata: any;
    createdAt: string;
  }[];
}

export default function DoctorReferrals() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: linkData } = useQuery<ReferralLinkData>({
    queryKey: ['/api/doctors/referral-link'],
  });

  const { data: stats } = useQuery<ReferralStats>({
    queryKey: ['/api/doctors/referral-stats'],
  });

  async function copyLink() {
    if (!linkData?.referralLink) return;
    try {
      await navigator.clipboard.writeText(linkData.referralLink);
      setCopied(true);
      toast({ title: "Link copiado!", description: "O link de indicação foi copiado para a área de transferência." });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast({ title: "Erro ao copiar", description: "Não foi possível copiar o link.", variant: "destructive" });
    }
  }

  async function shareLink() {
    if (!linkData?.referralLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Junte-se ao Tele<M3D> Pro",
          text: "Registre-se como médico na plataforma Tele<M3D> Pro usando meu link de indicação:",
          url: linkData.referralLink,
        });
      } catch {}
    } else {
      copyLink();
    }
  }

  return (
    <PageWrapper variant="origami">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
              Programa de Indicação
            </h1>
            <p className="text-sm text-muted-foreground">
              Indique médicos e ganhe comissão sobre cada consulta
            </p>
          </div>
        </div>

        <Card className="border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Link2 className="h-5 w-5 text-violet-600" />
              Seu Link de Indicação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Compartilhe este link com outros médicos. Quando eles se registrarem usando seu link, 
              você receberá <span className="font-bold text-violet-600">{linkData?.commissionPercent ?? 5}%</span> de 
              comissão sobre cada consulta que eles realizarem.
            </p>

            <div className="flex gap-2">
              <Input
                readOnly
                value={linkData?.referralLink || "Carregando..."}
                className="bg-white dark:bg-gray-900 font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyLink}
                className="shrink-0"
              >
                {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={copyLink} variant="outline" size="sm" className="gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                Copiar Link
              </Button>
              <Button onClick={shareLink} variant="outline" size="sm" className="gap-1.5">
                <Share2 className="h-3.5 w-3.5" />
                Compartilhar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalReferred ?? 0}</p>
                <p className="text-xs text-muted-foreground">Médicos Indicados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Coins className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalEarned ?? 0} TMC</p>
                <p className="text-xs text-muted-foreground">Total Ganho</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.commissionPercent ?? 5}%</p>
                <p className="text-xs text-muted-foreground">Comissão Atual</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {stats && stats.referredDoctors.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Médicos Indicados ({stats.referredDoctors.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.referredDoctors.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={doc.profilePicture || undefined} />
                      <AvatarFallback>{doc.name?.charAt(0) || "D"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.specialization || "Sem especialidade"} · CRM {doc.medicalLicense || "N/A"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {stats && stats.recentTransactions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Comissões Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <div>
                        <p className="text-sm font-medium">+{tx.amount} TMC</p>
                        <p className="text-xs text-muted-foreground">
                          Comissão de indicação
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {stats && stats.referredDoctors.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <UserPlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">Nenhuma indicação ainda</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Compartilhe seu link de indicação com outros médicos. Quando eles se registrarem e realizarem consultas, 
                você ganhará {stats.commissionPercent}% de comissão sobre cada atendimento.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}