import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PageWrapper from "@/components/layout/page-wrapper";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Filter,
  Loader2,
  Eye,
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: string; icon: any }> = {
    completed: { label: "Concluído", variant: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", icon: CheckCircle },
    pending: { label: "Pendente", variant: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300", icon: Clock },
    failed: { label: "Falhou", variant: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", icon: XCircle },
    cancelled: { label: "Cancelado", variant: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300", icon: XCircle },
    processing: { label: "Processando", variant: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", icon: Clock },
    refunded: { label: "Reembolsado", variant: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300", icon: AlertCircle },
  };
  const c = config[status] || { label: status, variant: "bg-gray-100 text-gray-700", icon: AlertCircle };
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${c.variant}`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

function ProviderBadge({ provider }: { provider: string }) {
  const labels: Record<string, string> = {
    paypal: "PayPal",
    stripe: "Stripe",
    pagbank: "PagBank",
  };
  const colors: Record<string, string> = {
    paypal: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    stripe: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    pagbank: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[provider] || "bg-gray-100 text-gray-700"}`}>
      {labels[provider] || provider}
    </span>
  );
}

export default function AdminPaymentsPage() {
  const [providerFilter, setProviderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedTxn, setSelectedTxn] = useState<any>(null);

  const queryParams = new URLSearchParams();
  if (providerFilter !== "all") queryParams.set("provider", providerFilter);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/payments", providerFilter, statusFilter, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/admin/payments?${queryParams.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
  });

  const transactions = data?.transactions || [];
  const summary = data?.summary || {};
  const providerBreakdown = data?.providerBreakdown || [];

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Monitoramento de Pagamentos</h1>
          <p className="text-sm text-muted-foreground">Painel administrativo de transações</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Transações</p>
                  <p className="text-xl font-bold">{summary.totalCount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="text-xl font-bold">${parseFloat(summary.completedAmount || '0').toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Concluídos</p>
                  <p className="text-xl font-bold">{summary.completedCount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pendentes / Falhos</p>
                  <p className="text-xl font-bold">{summary.pendingCount || 0} / {summary.failedCount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {providerBreakdown.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {providerBreakdown.map((pb: any) => (
              <Card key={pb.provider}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <ProviderBadge provider={pb.provider} />
                    <span className="text-sm font-medium">{pb.count} transações</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Total: ${parseFloat(pb.totalAmount || '0').toFixed(2)}</span>
                    <span>{pb.completedCount} concluídos</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Provedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Provedores</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="pagbank">PagBank</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                  <SelectItem value="refunded">Reembolsado</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="Data início" className="h-9" />
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="Data fim" className="h-9" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Transações</CardTitle>
            <CardDescription>{transactions.length} registros encontrados</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhuma transação encontrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs">Usuário</TableHead>
                      <TableHead className="text-xs">Provedor</TableHead>
                      <TableHead className="text-xs">Método</TableHead>
                      <TableHead className="text-xs">Valor</TableHead>
                      <TableHead className="text-xs">Créditos</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((txn: any) => (
                      <TableRow key={txn.id} className="text-xs">
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(txn.createdAt).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>{txn.userName || "N/A"}</div>
                          <div className="text-muted-foreground">{txn.userEmail}</div>
                        </TableCell>
                        <TableCell><ProviderBadge provider={txn.provider} /></TableCell>
                        <TableCell className="text-xs capitalize">{txn.paymentMethod?.replace('_', ' ')}</TableCell>
                        <TableCell className="text-xs font-medium">
                          {txn.currency === 'BRL' ? 'R$ ' : '$'}{txn.amount}
                        </TableCell>
                        <TableCell className="text-xs">{txn.creditsAmount}</TableCell>
                        <TableCell><StatusBadge status={txn.status} /></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedTxn(txn)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedTxn} onOpenChange={() => setSelectedTxn(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes da Transação</DialogTitle>
            </DialogHeader>
            {selectedTxn && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">ID:</span></div>
                  <div className="font-mono text-xs break-all">{selectedTxn.id}</div>
                  <div><span className="text-muted-foreground">Usuário:</span></div>
                  <div>{selectedTxn.userName} ({selectedTxn.userEmail})</div>
                  <div><span className="text-muted-foreground">Provedor:</span></div>
                  <div><ProviderBadge provider={selectedTxn.provider} /></div>
                  <div><span className="text-muted-foreground">Método:</span></div>
                  <div className="capitalize">{selectedTxn.paymentMethod?.replace('_', ' ')}</div>
                  <div><span className="text-muted-foreground">Valor:</span></div>
                  <div className="font-medium">{selectedTxn.currency === 'BRL' ? 'R$ ' : '$'}{selectedTxn.amount} {selectedTxn.currency}</div>
                  <div><span className="text-muted-foreground">Créditos:</span></div>
                  <div>{selectedTxn.creditsAmount}</div>
                  <div><span className="text-muted-foreground">Status:</span></div>
                  <div><StatusBadge status={selectedTxn.status} /></div>
                  {selectedTxn.providerOrderId && (
                    <>
                      <div><span className="text-muted-foreground">Order ID:</span></div>
                      <div className="font-mono text-xs break-all">{selectedTxn.providerOrderId}</div>
                    </>
                  )}
                  {selectedTxn.payerEmail && (
                    <>
                      <div><span className="text-muted-foreground">Email pagador:</span></div>
                      <div>{selectedTxn.payerEmail}</div>
                    </>
                  )}
                  {selectedTxn.errorMessage && (
                    <>
                      <div><span className="text-muted-foreground">Erro:</span></div>
                      <div className="text-red-600">{selectedTxn.errorMessage}</div>
                    </>
                  )}
                  <div><span className="text-muted-foreground">Criado em:</span></div>
                  <div>{new Date(selectedTxn.createdAt).toLocaleString("pt-BR")}</div>
                  {selectedTxn.completedAt && (
                    <>
                      <div><span className="text-muted-foreground">Concluído em:</span></div>
                      <div>{new Date(selectedTxn.completedAt).toLocaleString("pt-BR")}</div>
                    </>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageWrapper>
  );
}
