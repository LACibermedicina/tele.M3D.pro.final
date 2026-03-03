import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import WalletPayPalCheckout from "@/components/WalletPayPalCheckout";
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
  ExternalLink,
  Plus,
  Trash2,
  FileText,
  Filter,
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
  const { t } = useTranslation();
  const labels: Record<string, { textKey: string; color: string }> = {
    credit: { textKey: "wallet_page.credit", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
    debit: { textKey: "wallet_page.debit", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
    transfer: { textKey: "wallet_page.transfer_type", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
    recharge: { textKey: "wallet_page.recharge", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
    purchase: { textKey: "wallet_page.purchase", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
    commission: { textKey: "referrals.commission", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
    bonus: { textKey: "wallet_page.credit", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  };
  const label = labels[type] || { textKey: "", color: "bg-gray-100 text-gray-700" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${label.color}`}>{label.textKey ? t(label.textKey) : type}</span>;
}

export default function WalletPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("paypal");
  const [checkoutStep, setCheckoutStep] = useState<"select" | "checkout">("select");
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [pagbankData, setPagbankData] = useState<any>(null);
  const [pagbankDocument, setPagbankDocument] = useState("");
  const [pagbankName, setPagbankName] = useState("");
  const [pollingTxnId, setPollingTxnId] = useState<string | null>(null);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferUserId, setTransferUserId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);

  const [linkWalletOpen, setLinkWalletOpen] = useState(false);
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [newWalletType, setNewWalletType] = useState("");
  const [newWalletNetwork, setNewWalletNetwork] = useState("");
  const [newWalletLabel, setNewWalletLabel] = useState("");
  const [deleteWalletId, setDeleteWalletId] = useState<string | null>(null);
  const [withdrawWalletId, setWithdrawWalletId] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [auditFilterType, setAuditFilterType] = useState("all");

  const { data: balance, isLoading: balanceLoading } = useQuery<{ balance: number; currency: string }>({
    queryKey: ["/api/tmc/balance"],
  });

  const { data: packages = [], isLoading: packagesLoading } = useQuery<any[]>({
    queryKey: ["/api/credits/packages"],
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<any[]>({
    queryKey: ["/api/tmc/transactions"],
  });

  const { data: externalWallets = [], isLoading: walletsLoading } = useQuery<any[]>({
    queryKey: ["/api/external-wallets"],
  });

  const { data: withdrawals = [], isLoading: withdrawalsLoading } = useQuery<any[]>({
    queryKey: ["/api/withdrawals"],
  });

  const { data: auditLog = [], isLoading: auditLoading } = useQuery<any[]>({
    queryKey: ["/api/wallet/audit-log"],
  });

  const { data: weeklyReport, isLoading: weeklyReportLoading } = useQuery<any>({
    queryKey: ["/api/wallet/weekly-report"],
  });

  const { data: exchangeRate } = useQuery<{ rate: number }>({
    queryKey: ["/api/admin/exchange-rate"],
  });

  const linkWalletMutation = useMutation({
    mutationFn: async (data: { address: string; type: string; network: string; label?: string }) => {
      const res = await apiRequest("POST", "/api/external-wallets", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-wallets"] });
      setLinkWalletOpen(false);
      setNewWalletAddress("");
      setNewWalletType("");
      setNewWalletNetwork("");
      setNewWalletLabel("");
      toast({ title: t("wallet_page.link_wallet"), description: t("common.success") });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const deleteWalletMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/external-wallets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-wallets"] });
      setDeleteWalletId(null);
      toast({ title: t("common.remove"), description: t("common.success") });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (data: { walletId: string; amount: number }) => {
      const res = await apiRequest("POST", "/api/withdrawals", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tmc/balance"] });
      setWithdrawWalletId("");
      setWithdrawAmount("");
      toast({ title: t("wallet_page.withdrawal_request"), description: t("common.success") });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const res = await apiRequest("POST", "/api/credits/purchase/create-order", { packageId });
      return await res.json();
    },
    onSuccess: (data) => {
      setPaypalOrderId(data.orderId);
      setSelectedPackage(data.package);
      setCheckoutStep("checkout");
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const stripePaymentMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const res = await apiRequest("POST", "/api/stripe/create-payment-intent", { packageId, paymentMethod: paymentMethod === 'apple_pay' ? 'apple_pay' : 'credit_card' });
      return await res.json();
    },
    onSuccess: (data) => {
      setStripeClientSecret(data.clientSecret);
      setCheckoutStep("checkout");
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const pagbankPaymentMutation = useMutation({
    mutationFn: async ({ packageId, method }: { packageId: string; method: string }) => {
      const res = await apiRequest("POST", "/api/pagbank/create-order", {
        packageId,
        paymentMethod: method,
        document: pagbankDocument,
        name: pagbankName || user?.name,
        email: user?.email,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setPagbankData(data);
      setCheckoutStep("checkout");
      if (data.transactionId) setPollingTxnId(data.transactionId);
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const stripeConfirmMutation = useMutation({
    mutationFn: async (paymentIntentId: string) => {
      const res = await apiRequest("POST", "/api/stripe/confirm-payment", { paymentIntentId });
      return await res.json();
    },
    onSuccess: (data) => {
      resetCheckout();
      queryClient.invalidateQueries({ queryKey: ["/api/tmc/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tmc/transactions"] });
      toast({ title: t("wallet_page.credits"), description: data.message || t("common.success") });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  function resetCheckout() {
    setSelectedPackage(null);
    setPaypalOrderId(null);
    setStripeClientSecret(null);
    setPagbankData(null);
    setPollingTxnId(null);
    setCheckoutStep("select");
    setPagbankDocument("");
    setPagbankName("");
  }

  function handlePackageSelect(pkg: any) {
    if (checkoutStep === "checkout") return;
    setSelectedPackage(pkg);
    if (paymentMethod === "paypal") {
      createOrderMutation.mutate(pkg.id);
    } else if (paymentMethod === "stripe" || paymentMethod === "apple_pay") {
      stripePaymentMutation.mutate(pkg.id);
    } else if (paymentMethod === "pix" || paymentMethod === "boleto") {
      pagbankPaymentMutation.mutate({ packageId: pkg.id, method: paymentMethod });
    }
  }

  const transferMutation = useMutation({
    mutationFn: async (data: { toUserId: string; amount: number; reason: string }) => {
      const response = await fetch("/api/tmc/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t("common.error"));
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
      toast({ title: t("wallet_page.transfer"), description: t("common.success") });
    },
    onError: (error: any) => {
      toast({ title: t("common.error"), description: error.message || t("common.error"), variant: "destructive" });
    },
  });

  const handleTransfer = () => {
    if (!transferUserId || !transferAmount || parseInt(transferAmount) <= 0) {
      toast({ title: t("common.error"), description: t("common.required_field"), variant: "destructive" });
      return;
    }
    transferMutation.mutate({ toUserId: transferUserId, amount: parseInt(transferAmount), reason: transferReason || t("wallet_page.transfer") });
  };

  const isAdmin = user?.role === 'admin';

  const totalCredits = transactions.filter((t: any) => isCredit(t.type)).reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0);
  const totalDebits = transactions.filter((t: any) => !isCredit(t.type)).reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0);
  const totalCommissions = transactions.filter((t: any) => t.type === "commission").reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0);

  const featureCosts = [
    { name: t("video.title"), cost: 50, icon: Zap },
    { name: "WhatsApp", cost: 10, icon: Send },
    { name: t("medical.exam"), cost: 15, icon: Shield },
    { name: t("navigation.ai_assistant"), cost: 5, icon: Star },
    { name: t("medical.digital_signature"), cost: 20, icon: Check },
  ];

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
          <Wallet className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t("wallet_page.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("wallet_page.credits")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">{t("wallet_page.balance")}</p>
                <p className="text-3xl font-bold text-blue-800 dark:text-blue-200 mt-1">
                  {balanceLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : `${balance?.balance || 0} TM3D`}
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
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">{t("common.total")}</p>
                <p className="text-3xl font-bold text-green-800 dark:text-green-200 mt-1">
                  +{totalCredits} TM3D
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
                  {user?.role === "doctor" ? t("referrals.commission") : t("common.total")}
                </p>
                <p className="text-3xl font-bold text-orange-800 dark:text-orange-200 mt-1">
                  {user?.role === "doctor" ? `+${totalCommissions}` : `-${totalDebits}`} TM3D
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
        <TabsList className={`grid w-full max-w-3xl ${isAdmin ? 'grid-cols-6' : 'grid-cols-2'}`}>
          <TabsTrigger value="comprar" className="flex items-center gap-1.5">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">{t("wallet_page.buy_credits")}</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-1.5">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">{t("wallet_page.history")}</span>
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="transferir" className="flex items-center gap-1.5">
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">{t("wallet_page.transfer")}</span>
              </TabsTrigger>
              <TabsTrigger value="custos" className="flex items-center gap-1.5">
                <Info className="h-4 w-4" />
                <span className="hidden sm:inline">{t("admin_page.feature_costs")}</span>
              </TabsTrigger>
              <TabsTrigger value="carteira-externa" className="flex items-center gap-1.5">
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">{t("wallet_page.external_wallet")}</span>
              </TabsTrigger>
              <TabsTrigger value="auditoria" className="flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">{t("medical_records.audit_log")}</span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="comprar" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">{t("admin_page.credit_packages")}</h2>
            </div>
            <Badge variant="outline" className="text-xs">
              {t("admin_page.exchange_rates")}: 1 USD = {exchangeRate?.rate || 5} TM3D
            </Badge>
          </div>

          {checkoutStep === "select" && (
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{t("wallet_page.payment_method")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: "paypal", label: t("wallet_page.paypal"), icon: "💳" },
                    { id: "stripe", label: t("wallet_page.stripe_card"), icon: "💳" },
                    { id: "pix", label: t("wallet_page.pix"), icon: "⚡" },
                    { id: "boleto", label: t("wallet_page.boleto"), icon: "📄" },
                    { id: "apple_pay", label: "Apple Pay", icon: "🍎" },
                  ].map((pm) => (
                    <Button
                      key={pm.id}
                      variant={paymentMethod === pm.id ? "default" : "outline"}
                      size="sm"
                      className="flex items-center gap-1.5 text-xs"
                      onClick={() => setPaymentMethod(pm.id)}
                    >
                      <span>{pm.icon}</span>
                      <span>{pm.label}</span>
                    </Button>
                  ))}
                </div>
                {(paymentMethod === "pix" || paymentMethod === "boleto") && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">{t("common.type")}</Label>
                      <Input
                        placeholder="000.000.000-00"
                        value={pagbankDocument}
                        onChange={(e) => setPagbankDocument(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{t("common.name")}</Label>
                      <Input
                        placeholder={t("common.name")}
                        value={pagbankName}
                        onChange={(e) => setPagbankName(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {packagesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : checkoutStep === "select" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map((pkg: any) => {
                const totalCredits = pkg.credits + (pkg.bonusCredits || 0);
                const costPerCredit = (parseFloat(pkg.priceUsd) / totalCredits).toFixed(3);
                const isProcessing = createOrderMutation.isPending || stripePaymentMutation.isPending || pagbankPaymentMutation.isPending;
                return (
                  <Card
                    key={pkg.id}
                    className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] relative ${
                      pkg.isPromotional ? "border-amber-400 dark:border-amber-600" : ""
                    } ${
                      selectedPackage?.id === pkg.id
                        ? "ring-2 ring-primary shadow-lg"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => !isProcessing && handlePackageSelect(pkg)}
                  >
                    {pkg.isPromotional && (
                      <div className="absolute -top-2 left-4 px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded">
                        {t("wallet_page.purchase")}
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{pkg.name}</CardTitle>
                        {pkg.bonusCredits > 0 && (
                          <Badge className="bg-emerald-500 text-white">+{pkg.bonusCredits}</Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs">{pkg.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <span className="text-2xl font-bold text-primary">${pkg.priceUsd}</span>
                          {pkg.priceBrl && (
                            <span className="text-sm text-muted-foreground ml-2">R$ {pkg.priceBrl}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Coins className="h-4 w-4 text-amber-500" />
                            <span className="font-medium">{totalCredits} TM3D</span>
                          </div>
                          <span className="text-xs text-muted-foreground">${costPerCredit}/TM3D</span>
                        </div>
                        {pkg.bonusCredits > 0 && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">
                            {pkg.credits} + {pkg.bonusCredits}
                          </p>
                        )}
                        <Button
                          className="w-full"
                          size="sm"
                          variant={pkg.isPromotional ? "default" : "outline"}
                          disabled={isProcessing}
                        >
                          {isProcessing && selectedPackage?.id === pkg.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <ShoppingCart className="h-4 w-4 mr-1" />
                              {paymentMethod === "paypal" ? t("wallet_page.buy_credits") :
                               paymentMethod === "stripe" ? t("wallet_page.buy_credits") :
                               paymentMethod === "pix" ? t("wallet_page.buy_credits") :
                               paymentMethod === "boleto" ? t("wallet_page.buy_credits") :
                               paymentMethod === "apple_pay" ? t("wallet_page.buy_credits") :
                               t("wallet_page.buy_credits")}
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : null}

          {checkoutStep === "checkout" && selectedPackage && (
            <Card className="border-primary shadow-lg mt-4">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    {t("wallet_page.processing")}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={resetCheckout}>
                    {t("common.cancel")}
                  </Button>
                </div>
                <CardDescription>
                  {selectedPackage.name} — {selectedPackage.credits + (selectedPackage.bonusCredits || 0)} TM3D — ${selectedPackage.priceUsd}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {paymentMethod === "paypal" && paypalOrderId && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {t("wallet_page.processing")}
                    </p>
                    <WalletPayPalCheckout
                      amount={selectedPackage.priceUsd}
                      currency="USD"
                      orderId={paypalOrderId}
                      onSuccess={(data) => {
                        resetCheckout();
                        queryClient.invalidateQueries({ queryKey: ["/api/tmc/balance"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/tmc/transactions"] });
                        toast({
                          title: t("wallet_page.credits"),
                          description: data.message || t("common.success"),
                        });
                      }}
                      onError={(errorMsg) => {
                        toast({ title: t("common.error"), description: errorMsg, variant: "destructive" });
                      }}
                      onCancel={() => {
                        toast({ title: t("common.cancelled"), description: t("common.cancelled") });
                      }}
                    />
                  </>
                )}

                {(paymentMethod === "stripe" || paymentMethod === "apple_pay") && stripeClientSecret && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {paymentMethod === "apple_pay"
                        ? t("wallet_page.processing")
                        : t("wallet_page.processing")}
                    </p>
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <p className="text-sm font-medium mb-2">{t("wallet_page.stripe_card")}</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        {t("wallet_page.processing")}
                      </p>
                      <Button
                        className="w-full"
                        disabled={stripeConfirmMutation.isPending}
                        onClick={() => {
                          const piId = stripeClientSecret.split('_secret_')[0];
                          stripeConfirmMutation.mutate(piId);
                        }}
                      >
                        {stripeConfirmMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        {t("common.confirm")}
                      </Button>
                    </div>
                  </div>
                )}

                {paymentMethod === "pix" && pagbankData && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {t("wallet_page.pix")}
                    </p>
                    {pagbankData.pixQrCodeUrl && (
                      <div className="flex justify-center">
                        <img
                          src={pagbankData.pixQrCodeUrl}
                          alt="PIX QR Code"
                          className="w-48 h-48 border rounded-lg"
                        />
                      </div>
                    )}
                    {pagbankData.pixCode && (
                      <div className="space-y-2">
                        <Label className="text-xs">{t("wallet_page.pix")}</Label>
                        <div className="flex gap-2">
                          <Input
                            readOnly
                            value={pagbankData.pixCode}
                            className="text-xs font-mono"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(pagbankData.pixCode);
                              toast({ title: t("common.copied_to_clipboard") });
                            }}
                          >
                            {t("common.copy")}
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>30 min</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("wallet_page.processing")}
                    </p>
                  </div>
                )}

                {paymentMethod === "boleto" && pagbankData && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {t("wallet_page.boleto")}
                    </p>
                    {pagbankData.boletoBarcode && (
                      <div className="space-y-2">
                        <Label className="text-xs">{t("wallet_page.boleto")}</Label>
                        <div className="flex gap-2">
                          <Input
                            readOnly
                            value={pagbankData.boletoBarcode}
                            className="text-xs font-mono"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(pagbankData.boletoBarcode);
                              toast({ title: t("common.copied_to_clipboard") });
                            }}
                          >
                            {t("common.copy")}
                          </Button>
                        </div>
                      </div>
                    )}
                    {pagbankData.boletoUrl && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => window.open(pagbankData.boletoUrl, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {t("common.open")} PDF
                      </Button>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>3 {t("common.date")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("wallet_page.processing")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <History className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{t("wallet_page.history")}</h2>
          </div>

          {transactionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-muted-foreground">{t("wallet_page.no_transactions")}</p>
                <p className="text-sm text-gray-400 mt-1">{t("common.no_data")}</p>
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
                          {isCredit(tx.type) ? "+" : "-"}{Math.abs(tx.amount)} TM3D
                        </span>
                        {tx.balanceAfter != null && (
                          <p className="text-xs text-muted-foreground">{t("wallet_page.balance")}: {tx.balanceAfter} TM3D</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {isAdmin && (<TabsContent value="transferir" className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Send className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{t("wallet_page.transfer")}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("wallet_page.transfer")}</CardTitle>
                <CardDescription>{t("wallet_page.credits")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="tr-user">{t("wallet_page.recipient")}</Label>
                  <Input
                    id="tr-user"
                    value={transferUserId}
                    onChange={(e) => setTransferUserId(e.target.value)}
                    placeholder="ID"
                  />
                </div>
                <div>
                  <Label htmlFor="tr-amount">{t("wallet_page.amount")}</Label>
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
                  <Label htmlFor="tr-reason">{t("common.description")}</Label>
                  <Input
                    id="tr-reason"
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    placeholder={t("common.description")}
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
                  {t("wallet_page.transfer")}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                    <div className="text-sm space-y-2">
                      <p className="font-medium text-blue-700 dark:text-blue-300">{t("wallet_page.transfer")}</p>
                      <ul className="text-blue-600 dark:text-blue-400 space-y-1 text-xs">
                        <li>1. {t("wallet_page.recipient")}</li>
                        <li>2. {t("wallet_page.amount")}</li>
                        <li>3. {t("wallet_page.transfer_type")}</li>
                        <li>4. {t("wallet_page.balance")}</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-medium mb-2">ID</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-3 py-2 rounded flex-1 truncate">{user?.id || "—"}</code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(user?.id || "");
                        toast({ title: t("common.copied_to_clipboard") });
                      }}
                    >
                      {t("common.copy")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("common.share")}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>)}

        {isAdmin && (<TabsContent value="custos" className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{t("admin_page.feature_costs")}</h2>
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
                    <Badge variant="secondary" className="font-bold">{feature.cost} TM3D</Badge>
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
                  <p className="font-medium text-amber-700 dark:text-amber-300 mb-1">{t("wallet_page.credits")}</p>
                  <p className="text-amber-600 dark:text-amber-400 text-xs">
                    {t("wallet_page.buy_credits")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>)}

        {isAdmin && (<TabsContent value="carteira-externa" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">{t("wallet_page.external_wallet")}</h2>
            </div>
            <Dialog open={linkWalletOpen} onOpenChange={setLinkWalletOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  {t("wallet_page.link_wallet")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("wallet_page.link_wallet")}</DialogTitle>
                  <DialogDescription>{t("wallet_page.external_wallet")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="wallet-address">{t("wallet_page.external_wallet")}</Label>
                    <Input
                      id="wallet-address"
                      value={newWalletAddress}
                      onChange={(e) => setNewWalletAddress(e.target.value)}
                      placeholder="0x..."
                    />
                  </div>
                  <div>
                    <Label>{t("common.type")}</Label>
                    <Select value={newWalletType} onValueChange={setNewWalletType}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("common.select")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="metamask">MetaMask</SelectItem>
                        <SelectItem value="walletconnect">WalletConnect</SelectItem>
                        <SelectItem value="custom">{t("common.options")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("common.options")}</Label>
                    <Select value={newWalletNetwork} onValueChange={setNewWalletNetwork}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("common.select")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tm3d">TM3D</SelectItem>
                        <SelectItem value="ethereum">Ethereum</SelectItem>
                        <SelectItem value="polygon">Polygon</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="wallet-label">{t("common.name")}</Label>
                    <Input
                      id="wallet-label"
                      value={newWalletLabel}
                      onChange={(e) => setNewWalletLabel(e.target.value)}
                      placeholder={t("common.name")}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => linkWalletMutation.mutate({
                      address: newWalletAddress,
                      type: newWalletType,
                      network: newWalletNetwork,
                      label: newWalletLabel || undefined,
                    })}
                    disabled={linkWalletMutation.isPending || !newWalletAddress || !newWalletType || !newWalletNetwork}
                  >
                    {linkWalletMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    {t("wallet_page.link_wallet")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {walletsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : externalWallets.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ExternalLink className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-muted-foreground">{t("common.no_data")}</p>
                <p className="text-sm text-gray-400 mt-1">{t("wallet_page.link_wallet")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {externalWallets.map((w: any) => (
                <Card key={w.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium truncate">{w.label || t("wallet_page.external_wallet")}</p>
                          {w.isDefault && <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs">{t("common.active")}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate">{w.address}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs capitalize">{w.type}</Badge>
                          <Badge variant="secondary" className="text-xs capitalize">{w.network}</Badge>
                        </div>
                      </div>
                      <Dialog open={deleteWalletId === w.id} onOpenChange={(open) => !open && setDeleteWalletId(null)}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => setDeleteWalletId(w.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t("common.remove")}</DialogTitle>
                            <DialogDescription>{t("common.confirm")}</DialogDescription>
                          </DialogHeader>
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setDeleteWalletId(null)}>{t("common.cancel")}</Button>
                            <Button
                              variant="destructive"
                              onClick={() => deleteWalletMutation.mutate(w.id)}
                              disabled={deleteWalletMutation.isPending}
                            >
                              {deleteWalletMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                              {t("common.remove")}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowUpCircle className="h-5 w-5" />
                {t("wallet_page.withdrawal_request")}
              </CardTitle>
              <CardDescription>{t("wallet_page.withdrawal")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t("wallet_page.external_wallet")}</Label>
                <Select value={withdrawWalletId} onValueChange={setWithdrawWalletId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("common.select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {externalWallets.map((w: any) => (
                      <SelectItem key={w.id} value={w.id}>{w.label || w.address?.slice(0, 16) + "..."} ({w.network})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="withdraw-amount">{t("wallet_page.amount")} (TM3D)</Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  min={1}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Ex: 100"
                />
              </div>
              {withdrawAmount && parseFloat(withdrawAmount) > 0 && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4 pb-4">
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>{t("wallet_page.amount")}:</span>
                        <span className="font-medium">{parseFloat(withdrawAmount)} TM3D</span>
                      </div>
                      <div className="flex justify-between text-orange-600">
                        <span>{t("admin_page.exchange_rates")} (2%):</span>
                        <span className="font-medium">-{(parseFloat(withdrawAmount) * 0.02).toFixed(2)} TM3D</span>
                      </div>
                      <div className="border-t pt-1 flex justify-between font-semibold">
                        <span>{t("common.total")}:</span>
                        <span className="text-green-600">{(parseFloat(withdrawAmount) * 0.98).toFixed(2)} TM3D</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              <Button
                className="w-full"
                onClick={() => withdrawMutation.mutate({ walletId: withdrawWalletId, amount: parseFloat(withdrawAmount) })}
                disabled={withdrawMutation.isPending || !withdrawWalletId || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
              >
                {withdrawMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowUpCircle className="h-4 w-4 mr-1" />}
                {t("wallet_page.withdrawal_request")}
              </Button>
            </CardContent>
          </Card>

          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <History className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold">{t("wallet_page.history")}</h3>
            </div>
            {withdrawalsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : withdrawals.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Clock className="h-10 w-10 text-gray-300 mb-2" />
                  <p className="text-muted-foreground text-sm">{t("common.no_data")}</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("common.date")}</TableHead>
                        <TableHead>{t("wallet_page.amount")}</TableHead>
                        <TableHead>{t("admin_page.exchange_rates")}</TableHead>
                        <TableHead>{t("common.total")}</TableHead>
                        <TableHead>{t("common.status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawals.map((w: any) => (
                        <TableRow key={w.id}>
                          <TableCell className="text-xs">
                            {new Date(w.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          </TableCell>
                          <TableCell className="font-medium">{w.amount} TM3D</TableCell>
                          <TableCell className="text-orange-600 text-xs">{w.fee || (w.amount * 0.02).toFixed(2)} TM3D</TableCell>
                          <TableCell className="text-green-600 font-medium">{w.netAmount || (w.amount * 0.98).toFixed(2)} TM3D</TableCell>
                          <TableCell>
                            <Badge className={
                              w.status === "pending" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                              w.status === "processing" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                              w.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                              "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                            }>
                              {w.status === "pending" ? t("common.pending") :
                               w.status === "processing" ? t("wallet_page.processing") :
                               w.status === "completed" ? t("common.completed") : t("common.error")}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>)}

        {isAdmin && (<TabsContent value="auditoria" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">{t("medical_records.audit_log")}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={auditFilterType} onValueChange={setAuditFilterType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("common.filter")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="credit">{t("wallet_page.credit")}</SelectItem>
                  <SelectItem value="debit">{t("wallet_page.debit")}</SelectItem>
                  <SelectItem value="transfer">{t("wallet_page.transfer_type")}</SelectItem>
                  <SelectItem value="recharge">{t("wallet_page.recharge")}</SelectItem>
                  <SelectItem value="purchase">{t("wallet_page.purchase")}</SelectItem>
                  <SelectItem value="commission">{t("referrals.commission")}</SelectItem>
                  <SelectItem value="bonus">{t("wallet_page.credit")}</SelectItem>
                  <SelectItem value="withdrawal">{t("wallet_page.withdrawal")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!weeklyReportLoading && weeklyReport && (
            <Card className="bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-indigo-950 dark:to-purple-950 border-indigo-200 dark:border-indigo-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  {t("pharmacy_page.weekly_report")}
                </CardTitle>
                <CardDescription>{weeklyReport.period || t("common.week")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("wallet_page.credit")}</p>
                    <p className="text-lg font-bold text-green-600">+{weeklyReport.totalCredits || 0} TM3D</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("wallet_page.debit")}</p>
                    <p className="text-lg font-bold text-red-600">-{weeklyReport.totalDebits || 0} TM3D</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("common.total")}</p>
                    <p className={`text-lg font-bold ${(weeklyReport.netChange || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {(weeklyReport.netChange || 0) >= 0 ? "+" : ""}{weeklyReport.netChange || 0} TM3D
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("wallet_page.balance")}</p>
                    <p className="text-lg font-bold text-blue-600">{weeklyReport.currentBalance || 0} TM3D</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {auditLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : auditLog.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-muted-foreground">{t("common.no_data")}</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.date")}</TableHead>
                      <TableHead>{t("common.actions")}</TableHead>
                      <TableHead>{t("wallet_page.amount")}</TableHead>
                      <TableHead>{t("wallet_page.balance")}</TableHead>
                      <TableHead>{t("wallet_page.balance")}</TableHead>
                      <TableHead>{t("common.description")}</TableHead>
                      <TableHead>{t("common.name")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLog
                      .filter((entry: any) => auditFilterType === "all" || entry.action === auditFilterType)
                      .map((entry: any, i: number) => (
                        <TableRow key={entry.id || i}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(entry.createdAt).toLocaleDateString("pt-BR", {
                              day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell>
                            <TransactionLabel type={entry.action} />
                          </TableCell>
                          <TableCell className={`font-medium ${isCredit(entry.action) ? "text-green-600" : "text-red-500"}`}>
                            {isCredit(entry.action) ? "+" : "-"}{Math.abs(entry.amount)} TM3D
                          </TableCell>
                          <TableCell className="text-xs">{entry.balanceBefore ?? "—"} TM3D</TableCell>
                          <TableCell className="text-xs">{entry.balanceAfter ?? "—"} TM3D</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{entry.description || "—"}</TableCell>
                          <TableCell className="text-xs">{entry.actorRole || t("dashboard.system_status")}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>)}
      </Tabs>
    </div>
    </PageWrapper>
  );
}
