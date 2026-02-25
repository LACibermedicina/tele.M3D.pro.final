import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import PayPalButton from "@/components/PayPalButton";
import {
  Wallet,
  Coins,
  CreditCard,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  Gift,
  History,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Check,
  Loader2,
  Info,
  Zap,
  Star,
  Shield,
  Clock,
} from "lucide-react";

function isCredit(type: string) {
  return ['credit', 'purchase', 'recharge', 'bonus', 'commission'].includes(type);
}

function TransactionIcon({ type }: { type: string }) {
  switch (type) {
    case 'credit': case 'recharge': case 'purchase':
      return <ArrowUpRight className="h-4 w-4 text-green-600" />;
    case 'debit':
      return <ArrowDownLeft className="h-4 w-4 text-red-600" />;
    case 'transfer':
      return <Send className="h-4 w-4 text-blue-600" />;
    case 'commission':
      return <Gift className="h-4 w-4 text-orange-600" />;
    case 'bonus':
      return <Star className="h-4 w-4 text-amber-500" />;
    default:
      return <Coins className="h-4 w-4 text-gray-500" />;
  }
}

function TransactionLabel({ type }: { type: string }) {
  const labels: Record<string, { text: string; color: string }> = {
    credit: { text: "Crédito", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
    debit: { text: "Débito", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
    transfer: { text: "Transferência", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
    recharge: { text: "Recarga", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
    purchase: { text: "Compra", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
    commission: { text: "Comissão", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
    bonus: { text: "Bônus", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  };
  const label = labels[type] || { text: type, color: "bg-gray-100 text-gray-700" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${label.color}`}>{label.text}</span>;
}

export default function WalletPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferUserId, setTransferUserId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);

  const { data: balance, isLoading: balanceLoading } = useQuery<{ balance: number; currency: string }>({
    queryKey: ["/api/tmc/balance"],
  });

  const { data: packages = [], isLoading: packagesLoading } = useQuery<any[]>({
    queryKey: ["/api/credits/packages"],
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<any[]>({
    queryKey: ["/api/tmc/transactions"],
  });

  const createOrderMutation = useMutation({
    mutationFn: async (packageId: string) => {
      return await apiRequest("/api/credits/purchase/create-order", {
        method: "POST",
        body: JSON.stringify({ packageId }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: (data) => {
      setPaypalOrderId(data.orderId);
      setSelectedPackage(data.package);
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: "Falha ao criar ordem: " + error.message, variant: "destructive" });
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (data: { toUserId: string; amount: number; reason: string }) => {
      const response = await fetch("/api/tmc/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Falha na transferência");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tmc/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tmc/transactions"] });
      setTransferAmount("");
      setTransferUserId("");
      setTransferReason("");
      setTransferOpen(false);
      toast({ title: "Transferência realizada", description: "Créditos TMC transferidos com sucesso!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Falha na transferência", variant: "destructive" });
    },
  });

  const handleTransfer = () => {
    if (!transferUserId || !transferAmount || parseInt(transferAmount) <= 0) {
      toast({ title: "Dados inválidos", description: "Preencha todos os campos corretamente.", variant: "destructive" });
      return;
    }
    transferMutation.mutate({ toUserId: transferUserId, amount: parseInt(transferAmount), reason: transferReason || "Transferência entre usuários" });
  };

  const totalCredits = transactions.filter((t: any) => isCredit(t.type)).reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0);
  const totalDebits = transactions.filter((t: any) => !isCredit(t.type)).reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0);
  const totalCommissions = transactions.filter((t: any) => t.type === "commission").reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0);

  const featureCosts = [
    { name: "Consulta por Vídeo", cost: 50, icon: Zap },
    { name: "Consulta WhatsApp", cost: 10, icon: Send },
    { name: "Análise de Exames IA", cost: 15, icon: Shield },
    { name: "Assistente IA", cost: 5, icon: Star },
    { name: "Assinatura Digital", cost: 20, icon: Check },
  ];

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
          <Wallet className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Carteira Digital</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus créditos TMC e realize compras via PayPal</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Saldo Atual</p>
                <p className="text-3xl font-bold text-blue-800 dark:text-blue-200 mt-1">
                  {balanceLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : `${balance?.balance || 0} TMC`}
                </p>
              </div>
              <div className="p-3 bg-blue-200/50 dark:bg-blue-800/50 rounded-full">
                <Coins className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">Total Recebido</p>
                <p className="text-3xl font-bold text-green-800 dark:text-green-200 mt-1">
                  +{totalCredits} TMC
                </p>
              </div>
              <div className="p-3 bg-green-200/50 dark:bg-green-800/50 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-950 dark:to-amber-950 border-orange-200 dark:border-orange-800 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                  {user?.role === "doctor" ? "Comissões" : "Total Gasto"}
                </p>
                <p className="text-3xl font-bold text-orange-800 dark:text-orange-200 mt-1">
                  {user?.role === "doctor" ? `+${totalCommissions}` : `-${totalDebits}`} TMC
                </p>
              </div>
              <div className="p-3 bg-orange-200/50 dark:bg-orange-800/50 rounded-full">
                {user?.role === "doctor" ? (
                  <Gift className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="comprar" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="comprar" className="flex items-center gap-1.5">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Comprar</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-1.5">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
          <TabsTrigger value="transferir" className="flex items-center gap-1.5">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Transferir</span>
          </TabsTrigger>
          <TabsTrigger value="custos" className="flex items-center gap-1.5">
            <Info className="h-4 w-4" />
            <span className="hidden sm:inline">Custos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comprar" className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Pacotes de Créditos</h2>
          </div>

          {packagesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {packages.map((pkg: any) => (
                <Card
                  key={pkg.id}
                  className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] ${
                    selectedPackage?.id === pkg.id
                      ? "ring-2 ring-primary shadow-lg"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => !paypalOrderId && createOrderMutation.mutate(pkg.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{pkg.name}</CardTitle>
                      {pkg.bonusCredits > 0 && (
                        <Badge className="bg-amber-500 text-white">+{pkg.bonusCredits} bônus</Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs">{pkg.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <span className="text-2xl font-bold text-primary">${pkg.priceUsd}</span>
                        <span className="text-sm text-muted-foreground ml-2">R$ {pkg.priceBrl}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Coins className="h-4 w-4 text-amber-500" />
                        <span className="font-medium">{pkg.credits} créditos</span>
                      </div>
                      <Button
                        className="w-full"
                        size="sm"
                        disabled={createOrderMutation.isPending || !!paypalOrderId}
                      >
                        {createOrderMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <ShoppingCart className="h-4 w-4 mr-1" />
                            Comprar
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {paypalOrderId && selectedPackage && (
            <Card className="border-primary shadow-lg mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Finalizar Pagamento
                </CardTitle>
                <CardDescription>
                  {selectedPackage.name} — {selectedPackage.credits} créditos por ${selectedPackage.priceUsd}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Complete o pagamento com PayPal para receber seus créditos instantaneamente.
                </p>
                <PayPalButton
                  amount={selectedPackage.priceUsd}
                  currency="USD"
                  intent="CAPTURE"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setPaypalOrderId(null); setSelectedPackage(null); }}
                >
                  Cancelar
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <History className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Histórico de Transações</h2>
          </div>

          {transactionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-muted-foreground">Nenhuma transação registrada</p>
                <p className="text-sm text-gray-400 mt-1">Suas movimentações de créditos aparecerão aqui.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {transactions.map((tx: any, i: number) => (
                    <div key={tx.id || i} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-full ${isCredit(tx.type) ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"}`}>
                          <TransactionIcon type={tx.type} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{tx.description || tx.reason || tx.type}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <TransactionLabel type={tx.type} />
                            <span className="text-xs text-muted-foreground">
                              {new Date(tx.createdAt).toLocaleDateString("pt-BR", {
                                day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <span className={`font-semibold ${isCredit(tx.type) ? "text-green-600" : "text-red-500"}`}>
                          {isCredit(tx.type) ? "+" : "-"}{Math.abs(tx.amount)} TMC
                        </span>
                        {tx.balanceAfter != null && (
                          <p className="text-xs text-muted-foreground">Saldo: {tx.balanceAfter} TMC</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="transferir" className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Send className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Transferir Créditos</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Enviar Créditos TMC</CardTitle>
                <CardDescription>Transfira créditos para outro usuário da plataforma</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="tr-user">ID do destinatário</Label>
                  <Input
                    id="tr-user"
                    value={transferUserId}
                    onChange={(e) => setTransferUserId(e.target.value)}
                    placeholder="Cole o ID do usuário"
                  />
                </div>
                <div>
                  <Label htmlFor="tr-amount">Quantidade de créditos</Label>
                  <Input
                    id="tr-amount"
                    type="number"
                    min={1}
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="Ex: 50"
                  />
                </div>
                <div>
                  <Label htmlFor="tr-reason">Motivo (opcional)</Label>
                  <Input
                    id="tr-reason"
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    placeholder="Ex: Pagamento de serviço"
                  />
                </div>
                <Button
                  onClick={handleTransfer}
                  disabled={transferMutation.isPending || !transferUserId || !transferAmount}
                  className="w-full"
                >
                  {transferMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  Transferir Créditos
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                    <div className="text-sm space-y-2">
                      <p className="font-medium text-blue-700 dark:text-blue-300">Como transferir créditos</p>
                      <ul className="text-blue-600 dark:text-blue-400 space-y-1 text-xs">
                        <li>1. Solicite o ID do usuário destinatário</li>
                        <li>2. Informe a quantidade de créditos desejada</li>
                        <li>3. A transferência é instantânea e irreversível</li>
                        <li>4. O saldo do destinatário é atualizado imediatamente</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-medium mb-2">Seu ID de Usuário</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-3 py-2 rounded flex-1 truncate">{user?.id || "—"}</code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(user?.id || "");
                        toast({ title: "ID copiado!" });
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Compartilhe este ID para receber transferências de outros usuários.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="custos" className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Custos das Funcionalidades</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {featureCosts.map((feature) => (
              <Card key={feature.name} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <feature.icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{feature.name}</span>
                    </div>
                    <Badge variant="secondary" className="font-bold">{feature.cost} TMC</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Coins className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-700 dark:text-amber-300 mb-1">Créditos promocionais</p>
                  <p className="text-amber-600 dark:text-amber-400 text-xs">
                    Novos usuários recebem 10 créditos promocionais ao criar a conta. 
                    Médicos recebem comissões de 30% sobre consultas realizadas. 
                    Pesquisadores podem adquirir pacotes com bônus exclusivos.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
