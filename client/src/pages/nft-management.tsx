import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Gem,
  Plus,
  Eye,
  Edit,
  ShoppingCart,
  ChevronDown,
  Loader2,
  Shield,
  FileText,
  Users,
  Coins,
  BarChart3,
} from "lucide-react";

interface Nft {
  id: string;
  title: string;
  description?: string;
  nftType: string;
  dataCategory: string;
  anonymizedData?: any;
  valueTmc: number;
  totalShares: number;
  availableShares: number;
  dataSourceCount?: number;
  status: string;
  creatorId: string;
  createdAt: string;
  ownership?: NftOwnership[];
  lgpdConsents?: LgpdConsent[];
}

interface NftOwnership {
  id: string;
  userId: string;
  userName?: string;
  shares: number;
  acquiredAt: string;
}

interface LgpdConsent {
  id: string;
  userId: string;
  userName?: string;
  consentType: string;
  consentedAt: string;
  status: string;
}

const nftTypeLabels: Record<string, string> = {
  epidemiological_insight: "Insight Epidemiológico",
  clinical_pattern: "Padrão Clínico",
  research_dataset: "Dataset de Pesquisa",
  diagnostic_model: "Modelo Diagnóstico",
};

const dataCategoryLabels: Record<string, string> = {
  symptoms: "Sintomas",
  diagnoses: "Diagnósticos",
  treatments: "Tratamentos",
  outcomes: "Resultados",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  sold_out: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  inactive: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
};

const statusLabels: Record<string, string> = {
  active: "Ativo",
  pending: "Pendente",
  sold_out: "Esgotado",
  inactive: "Inativo",
};

export default function NftManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [selectedNft, setSelectedNft] = useState<Nft | null>(null);
  const [buyAmount, setBuyAmount] = useState("1");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    nftType: "",
    dataCategory: "",
    anonymizedData: "",
    valueTmc: "",
    totalShares: "",
    dataSourceCount: "",
  });

  const [editData, setEditData] = useState({
    title: "",
    description: "",
    nftType: "",
    dataCategory: "",
    valueTmc: "",
    totalShares: "",
    dataSourceCount: "",
  });

  const { data: nfts = [], isLoading } = useQuery<Nft[]>({
    queryKey: ["/api/nfts"],
  });

  const { data: nftDetail, isLoading: detailLoading } = useQuery<Nft>({
    queryKey: ["/api/nfts", selectedNft?.id],
    enabled: !!selectedNft?.id && detailOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/nfts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nfts"] });
      setCreateOpen(false);
      resetForm();
      toast({ title: "NFT criado", description: "NFT de dados de saúde criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/nfts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nfts"] });
      if (selectedNft) queryClient.invalidateQueries({ queryKey: ["/api/nfts", selectedNft.id] });
      setEditOpen(false);
      toast({ title: "NFT atualizado", description: "Dados do NFT atualizados com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const buySharesMutation = useMutation({
    mutationFn: async ({ id, shares }: { id: string; shares: number }) => {
      const res = await apiRequest("POST", `/api/nfts/${id}/buy-shares`, { shares });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nfts"] });
      if (selectedNft) queryClient.invalidateQueries({ queryKey: ["/api/nfts", selectedNft.id] });
      setBuyOpen(false);
      setBuyAmount("1");
      toast({ title: "Compra realizada", description: "Cotas adquiridas com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setFormData({ title: "", description: "", nftType: "", dataCategory: "", anonymizedData: "", valueTmc: "", totalShares: "", dataSourceCount: "" });
  }

  function handleCreate() {
    let parsedAnonymizedData = null;
    if (formData.anonymizedData.trim()) {
      try {
        parsedAnonymizedData = JSON.parse(formData.anonymizedData);
      } catch {
        toast({ title: "Erro", description: "JSON de dados anonimizados inválido", variant: "destructive" });
        return;
      }
    }
    createMutation.mutate({
      title: formData.title,
      description: formData.description || undefined,
      nftType: formData.nftType,
      dataCategory: formData.dataCategory,
      anonymizedData: parsedAnonymizedData,
      valueTmc: parseInt(formData.valueTmc),
      totalShares: parseInt(formData.totalShares),
      dataSourceCount: formData.dataSourceCount ? parseInt(formData.dataSourceCount) : undefined,
    });
  }

  function handleEdit() {
    if (!selectedNft) return;
    editMutation.mutate({
      id: selectedNft.id,
      data: {
        title: editData.title,
        description: editData.description || undefined,
        nftType: editData.nftType,
        dataCategory: editData.dataCategory,
        valueTmc: parseInt(editData.valueTmc),
        totalShares: parseInt(editData.totalShares),
        dataSourceCount: editData.dataSourceCount ? parseInt(editData.dataSourceCount) : undefined,
      },
    });
  }

  function openDetail(nft: Nft) {
    setSelectedNft(nft);
    setDetailOpen(true);
  }

  function openEdit(nft: Nft) {
    setSelectedNft(nft);
    setEditData({
      title: nft.title,
      description: nft.description || "",
      nftType: nft.nftType,
      dataCategory: nft.dataCategory,
      valueTmc: String(nft.valueTmc),
      totalShares: String(nft.totalShares),
      dataSourceCount: nft.dataSourceCount ? String(nft.dataSourceCount) : "",
    });
    setEditOpen(true);
  }

  function openBuy(nft: Nft) {
    setSelectedNft(nft);
    setBuyAmount("1");
    setBuyOpen(true);
  }

  const costPerShare = selectedNft ? (selectedNft.valueTmc / selectedNft.totalShares) : 0;
  const totalCost = costPerShare * parseInt(buyAmount || "0");
  const isOwnerOrAdmin = selectedNft && (selectedNft.creatorId === user?.id || user?.role === "admin");

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
            <Gem className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Gestão de NFTs de Saúde</h1>
            <p className="text-sm text-muted-foreground">Tokenização de dados epidemiológicos e clínicos</p>
          </div>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Criar NFT
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Novo NFT de Dados</DialogTitle>
              <DialogDescription>Tokenize dados de saúde anonimizados como NFT</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="nft-title">Título</Label>
                <Input id="nft-title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Ex: Análise Epidemiológica COVID-19 Regional" />
              </div>
              <div>
                <Label htmlFor="nft-desc">Descrição</Label>
                <Textarea id="nft-desc" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descreva os dados contidos neste NFT..." rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de NFT</Label>
                  <Select value={formData.nftType} onValueChange={(v) => setFormData({ ...formData, nftType: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="epidemiological_insight">Insight Epidemiológico</SelectItem>
                      <SelectItem value="clinical_pattern">Padrão Clínico</SelectItem>
                      <SelectItem value="research_dataset">Dataset de Pesquisa</SelectItem>
                      <SelectItem value="diagnostic_model">Modelo Diagnóstico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria de Dados</Label>
                  <Select value={formData.dataCategory} onValueChange={(v) => setFormData({ ...formData, dataCategory: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="symptoms">Sintomas</SelectItem>
                      <SelectItem value="diagnoses">Diagnósticos</SelectItem>
                      <SelectItem value="treatments">Tratamentos</SelectItem>
                      <SelectItem value="outcomes">Resultados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="nft-json">Dados Anonimizados (JSON)</Label>
                <Textarea id="nft-json" value={formData.anonymizedData} onChange={(e) => setFormData({ ...formData, anonymizedData: e.target.value })} placeholder='{"registros": 1500, "periodo": "2024-Q1", ...}' rows={4} className="font-mono text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="nft-value">Valor (TMC)</Label>
                  <Input id="nft-value" type="number" min={1} value={formData.valueTmc} onChange={(e) => setFormData({ ...formData, valueTmc: e.target.value })} placeholder="1000" />
                </div>
                <div>
                  <Label htmlFor="nft-shares">Total de Cotas</Label>
                  <Input id="nft-shares" type="number" min={1} value={formData.totalShares} onChange={(e) => setFormData({ ...formData, totalShares: e.target.value })} placeholder="100" />
                </div>
                <div>
                  <Label htmlFor="nft-sources">Fontes de Dados</Label>
                  <Input id="nft-sources" type="number" min={0} value={formData.dataSourceCount} onChange={(e) => setFormData({ ...formData, dataSourceCount: e.target.value })} placeholder="50" />
                </div>
              </div>
              <Button onClick={handleCreate} disabled={createMutation.isPending || !formData.title || !formData.nftType || !formData.dataCategory || !formData.valueTmc || !formData.totalShares} className="w-full">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Criar NFT
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : nfts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Gem className="h-16 w-16 text-gray-300 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhum NFT encontrado</p>
            <p className="text-sm text-gray-400 mt-1">Crie o primeiro NFT de dados de saúde tokenizados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {nfts.map((nft) => (
            <Card key={nft.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base line-clamp-2">{nft.title}</CardTitle>
                  <Badge className={statusColors[nft.status] || statusColors.inactive}>
                    {statusLabels[nft.status] || nft.status}
                  </Badge>
                </div>
                <CardDescription className="text-xs mt-1">
                  {nftTypeLabels[nft.nftType] || nft.nftType} • {dataCategoryLabels[nft.dataCategory] || nft.dataCategory}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5" /> Valor
                    </span>
                    <span className="font-bold text-primary">{nft.valueTmc} TMC</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> Cotas disponíveis
                    </span>
                    <span className="font-medium">{nft.availableShares}/{nft.totalShares}</span>
                  </div>
                  {nft.dataSourceCount != null && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <BarChart3 className="h-3.5 w-3.5" /> Fontes
                      </span>
                      <span>{nft.dataSourceCount}</span>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openDetail(nft)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Detalhes
                    </Button>
                    {nft.availableShares > 0 && (
                      <Button size="sm" className="flex-1" onClick={() => openBuy(nft)}>
                        <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Comprar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gem className="h-5 w-5 text-primary" />
              {selectedNft?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedNft && (nftTypeLabels[selectedNft.nftType] || selectedNft.nftType)} • {selectedNft && (dataCategoryLabels[selectedNft.dataCategory] || selectedNft.dataCategory)}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : nftDetail ? (
            <div className="space-y-6 mt-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="text-lg font-bold text-primary">{nftDetail.valueTmc} TMC</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Cotas Totais</p>
                  <p className="text-lg font-bold">{nftDetail.totalShares}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Disponíveis</p>
                  <p className="text-lg font-bold text-green-600">{nftDetail.availableShares}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Preço/Cota</p>
                  <p className="text-lg font-bold">{(nftDetail.valueTmc / nftDetail.totalShares).toFixed(2)} TMC</p>
                </div>
              </div>

              {nftDetail.description && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Descrição</h4>
                  <p className="text-sm text-muted-foreground">{nftDetail.description}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Users className="h-4 w-4" /> Proprietários de Cotas
                </h4>
                {nftDetail.ownership && nftDetail.ownership.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Cotas</TableHead>
                        <TableHead>Data de Aquisição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nftDetail.ownership.map((own) => (
                        <TableRow key={own.id}>
                          <TableCell className="font-medium">{own.userName || own.userId}</TableCell>
                          <TableCell>{own.shares}</TableCell>
                          <TableCell>{new Date(own.acquiredAt).toLocaleDateString("pt-BR")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum proprietário registrado</p>
                )}
              </div>

              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Registros de Consentimento LGPD
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  {nftDetail.lgpdConsents && nftDetail.lgpdConsents.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {nftDetail.lgpdConsents.map((consent) => (
                          <TableRow key={consent.id}>
                            <TableCell>{consent.userName || consent.userId}</TableCell>
                            <TableCell>{consent.consentType}</TableCell>
                            <TableCell>
                              <Badge variant={consent.status === "granted" ? "default" : "secondary"}>
                                {consent.status === "granted" ? "Concedido" : consent.status === "revoked" ? "Revogado" : consent.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{new Date(consent.consentedAt).toLocaleDateString("pt-BR")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro de consentimento encontrado</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              <div className="flex gap-2">
                {nftDetail.availableShares > 0 && (
                  <Button onClick={() => { setDetailOpen(false); openBuy(nftDetail); }} className="flex-1">
                    <ShoppingCart className="h-4 w-4 mr-2" /> Comprar Cotas
                  </Button>
                )}
                {(nftDetail.creatorId === user?.id || user?.role === "admin") && (
                  <Button variant="outline" onClick={() => { setDetailOpen(false); openEdit(nftDetail); }}>
                    <Edit className="h-4 w-4 mr-2" /> Editar
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comprar Cotas</DialogTitle>
            <DialogDescription>{selectedNft?.title}</DialogDescription>
          </DialogHeader>
          {selectedNft && (
            <div className="space-y-4 mt-2">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Preço por cota:</span>
                  <span className="font-bold">{costPerShare.toFixed(2)} TMC</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Cotas disponíveis:</span>
                  <span className="font-bold">{selectedNft.availableShares}</span>
                </div>
              </div>
              <div>
                <Label htmlFor="buy-amount">Quantidade de Cotas</Label>
                <Input
                  id="buy-amount"
                  type="number"
                  min={1}
                  max={selectedNft.availableShares}
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                />
              </div>
              <div className="bg-primary/10 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Custo total</p>
                <p className="text-2xl font-bold text-primary">{isNaN(totalCost) ? 0 : totalCost.toFixed(2)} TMC</p>
              </div>
              <Button
                onClick={() => selectedNft && buySharesMutation.mutate({ id: selectedNft.id, shares: parseInt(buyAmount) })}
                disabled={buySharesMutation.isPending || !buyAmount || parseInt(buyAmount) < 1 || parseInt(buyAmount) > selectedNft.availableShares}
                className="w-full"
              >
                {buySharesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
                Confirmar Compra
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar NFT</DialogTitle>
            <DialogDescription>Atualizar dados do NFT (somente proprietário/admin)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="edit-title">Título</Label>
              <Input id="edit-title" value={editData.title} onChange={(e) => setEditData({ ...editData, title: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="edit-desc">Descrição</Label>
              <Textarea id="edit-desc" value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de NFT</Label>
                <Select value={editData.nftType} onValueChange={(v) => setEditData({ ...editData, nftType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="epidemiological_insight">Insight Epidemiológico</SelectItem>
                    <SelectItem value="clinical_pattern">Padrão Clínico</SelectItem>
                    <SelectItem value="research_dataset">Dataset de Pesquisa</SelectItem>
                    <SelectItem value="diagnostic_model">Modelo Diagnóstico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria de Dados</Label>
                <Select value={editData.dataCategory} onValueChange={(v) => setEditData({ ...editData, dataCategory: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="symptoms">Sintomas</SelectItem>
                    <SelectItem value="diagnoses">Diagnósticos</SelectItem>
                    <SelectItem value="treatments">Tratamentos</SelectItem>
                    <SelectItem value="outcomes">Resultados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit-value">Valor (TMC)</Label>
                <Input id="edit-value" type="number" min={1} value={editData.valueTmc} onChange={(e) => setEditData({ ...editData, valueTmc: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="edit-shares">Total de Cotas</Label>
                <Input id="edit-shares" type="number" min={1} value={editData.totalShares} onChange={(e) => setEditData({ ...editData, totalShares: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="edit-sources">Fontes</Label>
                <Input id="edit-sources" type="number" min={0} value={editData.dataSourceCount} onChange={(e) => setEditData({ ...editData, dataSourceCount: e.target.value })} />
              </div>
            </div>
            <Button onClick={handleEdit} disabled={editMutation.isPending || !editData.title || !editData.nftType || !editData.dataCategory || !editData.valueTmc || !editData.totalShares} className="w-full">
              {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Edit className="h-4 w-4 mr-2" />}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </PageWrapper>
  );
}