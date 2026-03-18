import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, Check, Coins, ArrowUpCircle, ArrowDownCircle, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PayPalButton from '@/components/PayPalButton';
import { useState } from 'react';
import PageWrapper from '@/components/layout/page-wrapper';
import origamiHeroImage from '@assets/image_1759773239051.png';

export default function CreditsPage() {
  const { toast } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);

  const { data: packages, isLoading: packagesLoading } = useQuery({
    queryKey: ['/api/credits/packages'],
  });

  const { data: balance } = useQuery({
    queryKey: ['/api/tmc/balance'],
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<any[]>({
    queryKey: ['/api/tmc/transactions'],
  });

  const createOrderMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const res = await apiRequest('POST', '/api/credits/purchase/create-order', { packageId });
      return await res.json();
    },
    onSuccess: (data) => {
      setPaypalOrderId(data.orderId);
      setSelectedPackage(data.package);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: 'Falha ao criar ordem de compra: ' + error.message,
        variant: 'destructive',
      });
    },
  });

  const captureOrderMutation = useMutation({
    mutationFn: async (orderID: string) => {
      const res = await apiRequest('POST', '/api/credits/purchase/capture', { orderID });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Sucesso!',
        description: 'Créditos adicionados à sua conta!',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tmc/balance'] });
      setPaypalOrderId(null);
      setSelectedPackage(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: 'Falha ao processar pagamento: ' + error.message,
        variant: 'destructive',
      });
    },
  });

  if (packagesLoading) {
    return (
      <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Comprar Créditos TM3D</h1>
          <p className="text-muted-foreground">Recarregue sua conta com créditos para usar as funcionalidades da plataforma</p>
        </div>

      {balance && (
        <Card className="mb-8 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 border-orange-200 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Saldo Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-orange-600 dark:text-orange-400">
              {balance.balance} TM3D
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {packages?.map((pkg: any) => (
          <Card 
            key={pkg.id} 
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedPackage?.id === pkg.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => !paypalOrderId && createOrderMutation.mutate(pkg.id)}
          >
            <CardHeader>
              <CardTitle className="text-xl">{pkg.name}</CardTitle>
              <CardDescription>{pkg.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-3xl font-bold text-primary">
                    ${pkg.priceUsd}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    R$ {pkg.priceBrl}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>{pkg.credits} créditos</span>
                  </div>
                  {pkg.bonusCredits > 0 && (
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-orange-600 font-semibold">
                        +{pkg.bonusCredits} bônus
                      </span>
                    </div>
                  )}
                </div>
                <Button 
                  className="w-full" 
                  disabled={createOrderMutation.isPending || !!paypalOrderId}
                  data-testid={`button-buy-${pkg.id}`}
                >
                  {createOrderMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Comprar Agora
                    </>
                  )}
                </Button>
              </div>
              </CardContent>
            </Card>
        ))}
      </div>

      {paypalOrderId && selectedPackage && (
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Finalizar Pagamento</h2>
          <p className="mb-6">
            Complete o pagamento com PayPal para receber seus créditos
          </p>
          <PayPalButton 
            amount={selectedPackage.priceUsd}
            currency="USD"
            intent="CAPTURE"
          />
        </Card>
      )}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Transações
          </CardTitle>
          <CardDescription>Todas as movimentações de créditos da sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transação registrada.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    {tx.type === 'credit' || tx.type === 'purchase' || tx.type === 'recharge' || tx.type === 'bonus' ? (
                      <ArrowUpCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <ArrowDownCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{tx.description || tx.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`font-semibold ${tx.type === 'credit' || tx.type === 'purchase' || tx.type === 'recharge' || tx.type === 'bonus' ? 'text-green-600' : 'text-red-500'}`}>
                      {tx.type === 'credit' || tx.type === 'purchase' || tx.type === 'recharge' || tx.type === 'bonus' ? '+' : '-'}{Math.abs(tx.amount)} TM3D
                    </span>
                    {tx.balanceAfter != null && (
                      <p className="text-xs text-muted-foreground">Saldo: {tx.balanceAfter} TM3D</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Custos das Funcionalidades</CardTitle>
          <CardDescription>Veja quanto custa usar cada recurso da plataforma</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Consulta por Vídeo</span>
              <span className="font-semibold">50 TM3D</span>
            </div>
            <div className="flex justify-between">
              <span>Consulta via WhatsApp</span>
              <span className="font-semibold">10 TM3D</span>
            </div>
            <div className="flex justify-between">
              <span>Análise de Exames</span>
              <span className="font-semibold">15 TM3D</span>
            </div>
            <div className="flex justify-between">
              <span>Consulta ao Assistente Virtual</span>
              <span className="font-semibold">5 TM3D</span>
            </div>
            <div className="flex justify-between">
              <span>Assinatura Digital de Prescrição</span>
              <span className="font-semibold">20 TM3D</span>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </PageWrapper>
  );
}
