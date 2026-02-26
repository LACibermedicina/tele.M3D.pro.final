import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Plus,
  X,
  Loader2,
  BookOpen,
  History,
  ClipboardList,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Database,
  Edit,
} from "lucide-react";

interface BrokerOrder {
  id: string;
  userId: string;
  userName?: string;
  side: "buy" | "sell";
  assetType: "nft_share" | "tm3d";
  nftId?: string;
  nftName?: string;
  quantity: number;
  pricePerUnit: number;
  total: number;
  status: "open" | "filled" | "partial" | "cancelled";
  filledQuantity?: number;
  createdAt: string;
}

interface BrokerTrade {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  buyerName?: string;
  sellerName?: string;
  assetType: "nft_share" | "tm3d";
  nftName?: string;
  quantity: number;
  pricePerUnit: number;
  total: number;
  executedAt: string;
}

interface TM3DSupply {
  totalSupply: number;
  circulatingSupply: number;
  reserveSupply: number;
  pricePerToken: number;
  lastUpdated: string;
}

export default function BrokerPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [editSupplyOpen, setEditSupplyOpen] = useState(false);

  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [assetType, setAssetType] = useState<"nft_share" | "tm3d">("tm3d");
  const [nftId, setNftId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");

  const [supplyTotal, setSupplyTotal] = useState("");
  const [supplyCirculating, setSupplyCirculating] = useState("");
  const [supplyReserve, setSupplyReserve] = useState("");
  const [supplyPrice, setSupplyPrice] = useState("");

  const total = useMemo(() => {
    const q = parseFloat(quantity) || 0;
    const p = parseFloat(pricePerUnit) || 0;
    return (q * p).toFixed(2);
  }, [quantity, pricePerUnit]);

  const { data: openOrders = [], isLoading: ordersLoading } = useQuery<BrokerOrder[]>({
    queryKey: ["/api/broker/orders", "open"],
    queryFn: async () => {
      const res = await fetch("/api/broker/orders?status=open");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: myOrders = [], isLoading: myOrdersLoading } = useQuery<BrokerOrder[]>({
    queryKey: ["/api/broker/orders", "mine"],
    queryFn: async () => {
      const res = await fetch("/api/broker/orders?mine=true");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: trades = [], isLoading: tradesLoading } = useQuery<BrokerTrade[]>({
    queryKey: ["/api/broker/trades"],
    queryFn: async () => {
      const res = await fetch("/api/broker/trades");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: tm3dSupply, isLoading: supplyLoading } = useQuery<TM3DSupply>({
    queryKey: ["/api/broker/tm3d-supply"],
    queryFn: async () => {
      const res = await fetch("/api/broker/tm3d-supply");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/broker/orders", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broker/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/broker/trades"] });
      setCreateOpen(false);
      setQuantity("");
      setPricePerUnit("");
      setNftId("");
      toast({ title: "Ordem criada", description: "Sua ordem foi registrada com sucesso." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message || "Falha ao criar ordem.", variant: "destructive" });
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest("DELETE", `/api/broker/orders/${orderId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broker/orders"] });
      toast({ title: "Ordem cancelada", description: "A ordem foi cancelada com sucesso." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message || "Falha ao cancelar ordem.", variant: "destructive" });
    },
  });

  const updateSupplyMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/broker/tm3d-supply", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broker/tm3d-supply"] });
      setEditSupplyOpen(false);
      toast({ title: "Atualizado", description: "Dados do TM3D atualizados com sucesso." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message || "Falha ao atualizar.", variant: "destructive" });
    },
  });

  const handleCreateOrder = () => {
    const q = parseFloat(quantity);
    const p = parseFloat(pricePerUnit);
    if (!q || q <= 0 || !p || p <= 0) {
      toast({ title: "Dados inválidos", description: "Informe quantidade e preço válidos.", variant: "destructive" });
      return;
    }
    const payload: any = { side: orderSide, assetType, quantity: q, pricePerUnit: p };
    if (assetType === "nft_share" && nftId) payload.nftId = nftId;
    createOrderMutation.mutate(payload);
  };

  const handleUpdateSupply = () => {
    const data: any = {};
    if (supplyTotal) data.totalSupply = parseFloat(supplyTotal);
    if (supplyCirculating) data.circulatingSupply = parseFloat(supplyCirculating);
    if (supplyReserve) data.reserveSupply = parseFloat(supplyReserve);
    if (supplyPrice) data.pricePerToken = parseFloat(supplyPrice);
    updateSupplyMutation.mutate(data);
  };

  const buyOrders = openOrders.filter((o) => o.side === "buy").sort((a, b) => b.pricePerUnit - a.pricePerUnit);
  const sellOrders = openOrders.filter((o) => o.side === "sell").sort((a, b) => a.pricePerUnit - b.pricePerUnit);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
            <BarChart3 className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Corretora Digital</h1>
            <p className="text-sm text-muted-foreground">Negocie cotas de NFT e tokens TM3D</p>
          </div>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Ordem
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Ordem</DialogTitle>
              <DialogDescription>Preencha os dados para criar uma nova ordem de compra ou venda.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Tipo de Ordem</Label>
                <Select value={orderSide} onValueChange={(v) => setOrderSide(v as "buy" | "sell")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Compra</SelectItem>
                    <SelectItem value="sell">Venda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Ativo</Label>
                <Select value={assetType} onValueChange={(v) => setAssetType(v as "nft_share" | "tm3d")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tm3d">Token TM3D</SelectItem>
                    <SelectItem value="nft_share">Cota de NFT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {assetType === "nft_share" && (
                <div>
                  <Label>ID do NFT</Label>
                  <Input value={nftId} onChange={(e) => setNftId(e.target.value)} placeholder="Informe o ID do NFT" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantidade</Label>
                  <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label>Preço por Unidade</Label>
                  <Input type="number" min={0.01} step={0.01} value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Total Estimado:</span>
                <span className="text-lg font-bold text-primary">{total} TMC</span>
              </div>
              <Button onClick={handleCreateOrder} disabled={createOrderMutation.isPending} className="w-full">
                {createOrderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {orderSide === "buy" ? "Criar Ordem de Compra" : "Criar Ordem de Venda"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="orderbook" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="orderbook" className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Livro</span>
          </TabsTrigger>
          <TabsTrigger value="myorders" className="flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Minhas</span>
          </TabsTrigger>
          <TabsTrigger value="trades" className="flex items-center gap-1.5">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
          <TabsTrigger value="supply" className="flex items-center gap-1.5">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">TM3D</span>
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-1.5 sm:hidden">
            <Plus className="h-4 w-4" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orderbook" className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Livro de Ofertas</h2>
          </div>

          {ordersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-green-200 dark:border-green-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
                    <ArrowUpRight className="h-4 w-4" />
                    Ordens de Compra
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ativo</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Preço/Un</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {buyOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                            Nenhuma ordem de compra
                          </TableCell>
                        </TableRow>
                      ) : (
                        buyOrders.map((order) => (
                          <TableRow key={order.id} className="bg-green-50/50 dark:bg-green-950/20">
                            <TableCell>
                              <Badge variant="outline" className="text-green-700 border-green-300 dark:text-green-400 dark:border-green-700">
                                {order.assetType === "tm3d" ? "TM3D" : order.nftName || "NFT"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-700 dark:text-green-400">{order.quantity}</TableCell>
                            <TableCell className="text-right text-green-700 dark:text-green-400">{order.pricePerUnit.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-semibold text-green-700 dark:text-green-400">{order.total.toFixed(2)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="border-red-200 dark:border-red-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-400">
                    <ArrowDownLeft className="h-4 w-4" />
                    Ordens de Venda
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ativo</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Preço/Un</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sellOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                            Nenhuma ordem de venda
                          </TableCell>
                        </TableRow>
                      ) : (
                        sellOrders.map((order) => (
                          <TableRow key={order.id} className="bg-red-50/50 dark:bg-red-950/20">
                            <TableCell>
                              <Badge variant="outline" className="text-red-700 border-red-300 dark:text-red-400 dark:border-red-700">
                                {order.assetType === "tm3d" ? "TM3D" : order.nftName || "NFT"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium text-red-700 dark:text-red-400">{order.quantity}</TableCell>
                            <TableCell className="text-right text-red-700 dark:text-red-400">{order.pricePerUnit.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-semibold text-red-700 dark:text-red-400">{order.total.toFixed(2)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="myorders" className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Minhas Ordens</h2>
          </div>

          {myOrdersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : myOrders.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ClipboardList className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-muted-foreground">Nenhuma ordem registrada</p>
                <p className="text-sm text-gray-400 mt-1">Crie uma nova ordem para começar a negociar.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Preço/Un</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Badge className={order.side === "buy" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}>
                            {order.side === "buy" ? "Compra" : "Venda"}
                          </Badge>
                        </TableCell>
                        <TableCell>{order.assetType === "tm3d" ? "TM3D" : order.nftName || "NFT"}</TableCell>
                        <TableCell className="text-right">{order.quantity}</TableCell>
                        <TableCell className="text-right">{order.pricePerUnit.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">{order.total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={order.status === "open" ? "default" : order.status === "filled" ? "secondary" : "outline"}>
                            {order.status === "open" ? "Aberta" : order.status === "filled" ? "Executada" : order.status === "partial" ? "Parcial" : "Cancelada"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          {order.status === "open" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancelOrderMutation.mutate(order.id)}
                              disabled={cancelOrderMutation.isPending}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="trades" className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <History className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Histórico de Negociações</h2>
          </div>

          {tradesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : trades.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <History className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-muted-foreground">Nenhuma negociação realizada</p>
                <p className="text-sm text-gray-400 mt-1">As negociações aparecerão aqui quando ordens forem executadas.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ativo</TableHead>
                      <TableHead>Comprador</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Preço/Un</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trades.map((trade) => (
                      <TableRow key={trade.id}>
                        <TableCell>
                          <Badge variant="outline">{trade.assetType === "tm3d" ? "TM3D" : trade.nftName || "NFT"}</Badge>
                        </TableCell>
                        <TableCell className="text-green-600 dark:text-green-400">{trade.buyerName || "—"}</TableCell>
                        <TableCell className="text-red-600 dark:text-red-400">{trade.sellerName || "—"}</TableCell>
                        <TableCell className="text-right">{trade.quantity}</TableCell>
                        <TableCell className="text-right">{trade.pricePerUnit.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">{trade.total.toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(trade.executedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="supply" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Painel de Oferta TM3D</h2>
            </div>
            {user?.role === "admin" && (
              <Dialog open={editSupplyOpen} onOpenChange={(open) => {
                setEditSupplyOpen(open);
                if (open && tm3dSupply) {
                  setSupplyTotal(String(tm3dSupply.totalSupply || ""));
                  setSupplyCirculating(String(tm3dSupply.circulatingSupply || ""));
                  setSupplyReserve(String(tm3dSupply.reserveSupply || ""));
                  setSupplyPrice(String(tm3dSupply.pricePerToken || ""));
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Edit className="h-4 w-4" />
                    Editar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editar Oferta TM3D</DialogTitle>
                    <DialogDescription>Atualize os dados de oferta do token TM3D.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <Label>Oferta Total</Label>
                      <Input type="number" value={supplyTotal} onChange={(e) => setSupplyTotal(e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <Label>Em Circulação</Label>
                      <Input type="number" value={supplyCirculating} onChange={(e) => setSupplyCirculating(e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <Label>Reserva</Label>
                      <Input type="number" value={supplyReserve} onChange={(e) => setSupplyReserve(e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <Label>Preço por Token (TMC)</Label>
                      <Input type="number" step={0.01} value={supplyPrice} onChange={(e) => setSupplyPrice(e.target.value)} placeholder="0.00" />
                    </div>
                    <Button onClick={handleUpdateSupply} disabled={updateSupplyMutation.isPending} className="w-full">
                      {updateSupplyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Salvar Alterações
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {supplyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-purple-950 dark:to-indigo-950 border-purple-200 dark:border-purple-800">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Oferta Total</p>
                      <p className="text-2xl font-bold text-purple-800 dark:text-purple-200 mt-1">
                        {tm3dSupply?.totalSupply?.toLocaleString("pt-BR") || "0"}
                      </p>
                    </div>
                    <div className="p-3 bg-purple-200/50 dark:bg-purple-800/50 rounded-full">
                      <Coins className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-cyan-100 dark:from-blue-950 dark:to-cyan-950 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Em Circulação</p>
                      <p className="text-2xl font-bold text-blue-800 dark:text-blue-200 mt-1">
                        {tm3dSupply?.circulatingSupply?.toLocaleString("pt-BR") || "0"}
                      </p>
                    </div>
                    <div className="p-3 bg-blue-200/50 dark:bg-blue-800/50 rounded-full">
                      <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950 dark:to-orange-950 border-amber-200 dark:border-amber-800">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Reserva</p>
                      <p className="text-2xl font-bold text-amber-800 dark:text-amber-200 mt-1">
                        {tm3dSupply?.reserveSupply?.toLocaleString("pt-BR") || "0"}
                      </p>
                    </div>
                    <div className="p-3 bg-amber-200/50 dark:bg-amber-800/50 rounded-full">
                      <Database className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium">Preço/Token</p>
                      <p className="text-2xl font-bold text-green-800 dark:text-green-200 mt-1">
                        {tm3dSupply?.pricePerToken?.toFixed(2) || "0.00"} TMC
                      </p>
                    </div>
                    <div className="p-3 bg-green-200/50 dark:bg-green-800/50 rounded-full">
                      <TrendingDown className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {tm3dSupply?.lastUpdated && (
            <p className="text-xs text-muted-foreground text-right mt-2">
              Última atualização: {formatDate(tm3dSupply.lastUpdated)}
            </p>
          )}
        </TabsContent>

        <TabsContent value="create" className="space-y-4 sm:hidden">
          <Card>
            <CardHeader>
              <CardTitle>Criar Nova Ordem</CardTitle>
              <CardDescription>Preencha os dados para negociar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Tipo de Ordem</Label>
                <Select value={orderSide} onValueChange={(v) => setOrderSide(v as "buy" | "sell")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Compra</SelectItem>
                    <SelectItem value="sell">Venda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Ativo</Label>
                <Select value={assetType} onValueChange={(v) => setAssetType(v as "nft_share" | "tm3d")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tm3d">Token TM3D</SelectItem>
                    <SelectItem value="nft_share">Cota de NFT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {assetType === "nft_share" && (
                <div>
                  <Label>ID do NFT</Label>
                  <Input value={nftId} onChange={(e) => setNftId(e.target.value)} placeholder="Informe o ID do NFT" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantidade</Label>
                  <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label>Preço/Un</Label>
                  <Input type="number" min={0.01} step={0.01} value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Total:</span>
                <span className="text-lg font-bold text-primary">{total} TMC</span>
              </div>
              <Button onClick={handleCreateOrder} disabled={createOrderMutation.isPending} className="w-full">
                {createOrderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Criar Ordem
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}