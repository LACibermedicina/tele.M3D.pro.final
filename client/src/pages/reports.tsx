import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { FileDown, Calendar, Stethoscope, Users, DollarSign, UserCheck } from 'lucide-react';
import PageWrapper from '@/components/layout/page-wrapper';
import origamiHeroImage from '@assets/image_1759773239051.png';

interface ConsultationsReport {
  totalConsultations: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byPeriod: { period: string; count: number }[];
}

interface PatientsReport {
  totalPatients: number;
  byGender: Record<string, number>;
  byAgeGroup: Record<string, number>;
  byHealthStatus: Record<string, number>;
}

interface FinancialReport {
  totalCredits: number;
  totalDebits: number;
  netFlow: number;
  transactions: { type: string; amount: number; reason: string; date: string }[];
}

interface DoctorsReport {
  totalDoctors: number;
  bySpecialization: Record<string, number>;
  performance: { doctorName: string; consultations: number; avgRating: number; completionRate: number }[];
}

function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function StatCard({ title, value, icon: Icon, subtitle }: { title: string; value: string | number; icon: any; subtitle?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
            <CardContent><Skeleton className="h-8 w-16" /></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function ConsultationsTab({ data, onExport }: { data: ConsultationsReport | undefined; onExport: () => void }) {
  if (!data) return <LoadingSkeleton />;
  const statusEntries = Object.entries(data.byStatus || {});
  const typeEntries = Object.entries(data.byType || {});

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onExport}>
          <FileDown className="h-4 w-4 mr-2" />Exportar CSV
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total de Consultas" value={data.totalConsultations} icon={Stethoscope} />
        <StatCard title="Agendadas" value={data.byStatus?.scheduled || 0} icon={Calendar} />
        <StatCard title="Concluídas" value={data.byStatus?.completed || 0} icon={UserCheck} />
        <StatCard title="Canceladas" value={data.byStatus?.cancelled || 0} icon={Users} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-lg">Por Status</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statusEntries.map(([status, count]) => (
                  <TableRow key={status}>
                    <TableCell><Badge variant="outline">{status}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{count}</TableCell>
                  </TableRow>
                ))}
                {statusEntries.length === 0 && (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Por Tipo</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {typeEntries.map(([type, count]) => (
                  <TableRow key={type}>
                    <TableCell><Badge variant="secondary">{type}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{count}</TableCell>
                  </TableRow>
                ))}
                {typeEntries.length === 0 && (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      {data.byPeriod && data.byPeriod.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Por Período</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Consultas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byPeriod.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>{item.period}</TableCell>
                    <TableCell className="text-right font-mono">{item.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PatientsTab({ data, onExport }: { data: PatientsReport | undefined; onExport: () => void }) {
  if (!data) return <LoadingSkeleton />;
  const genderEntries = Object.entries(data.byGender || {});
  const ageEntries = Object.entries(data.byAgeGroup || {});
  const healthEntries = Object.entries(data.byHealthStatus || {});

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onExport}>
          <FileDown className="h-4 w-4 mr-2" />Exportar CSV
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total de Pacientes" value={data.totalPatients} icon={Users} />
        <StatCard title="Masculino" value={data.byGender?.masculino || data.byGender?.male || 0} icon={Users} />
        <StatCard title="Feminino" value={data.byGender?.feminino || data.byGender?.female || 0} icon={Users} />
        <StatCard title="Outros" value={data.byGender?.outro || data.byGender?.other || 0} icon={Users} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-lg">Faixa Etária</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Faixa</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ageEntries.map(([group, count]) => (
                  <TableRow key={group}>
                    <TableCell>{group}</TableCell>
                    <TableCell className="text-right font-mono">{count}</TableCell>
                  </TableRow>
                ))}
                {ageEntries.length === 0 && (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Estado de Saúde</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {healthEntries.map(([status, count]) => (
                  <TableRow key={status}>
                    <TableCell><Badge variant="outline">{status}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{count}</TableCell>
                  </TableRow>
                ))}
                {healthEntries.length === 0 && (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FinancialTab({ data, onExport }: { data: FinancialReport | undefined; onExport: () => void }) {
  if (!data) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onExport}>
          <FileDown className="h-4 w-4 mr-2" />Exportar CSV
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Créditos" value={`${data.totalCredits} TM3D`} icon={DollarSign} subtitle="Entradas no período" />
        <StatCard title="Total Débitos" value={`${data.totalDebits} TM3D`} icon={DollarSign} subtitle="Saídas no período" />
        <StatCard title="Fluxo Líquido" value={`${data.netFlow} TM3D`} icon={DollarSign} subtitle={data.netFlow >= 0 ? 'Positivo' : 'Negativo'} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-lg">Transações Recentes</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.transactions || []).map((tx, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Badge variant={tx.type === 'credit' ? 'default' : 'destructive'}>{tx.type}</Badge>
                  </TableCell>
                  <TableCell>{tx.reason}</TableCell>
                  <TableCell className="text-right font-mono">{tx.amount} TM3D</TableCell>
                  <TableCell>{tx.date ? new Date(tx.date).toLocaleDateString('pt-BR') : '-'}</TableCell>
                </TableRow>
              ))}
              {(!data.transactions || data.transactions.length === 0) && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem transações no período</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function DoctorsTab({ data, onExport }: { data: DoctorsReport | undefined; onExport: () => void }) {
  if (!data) return <LoadingSkeleton />;
  const specEntries = Object.entries(data.bySpecialization || {});

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onExport}>
          <FileDown className="h-4 w-4 mr-2" />Exportar CSV
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total de Médicos" value={data.totalDoctors} icon={UserCheck} />
        <StatCard title="Especialidades" value={specEntries.length} icon={Stethoscope} />
        <StatCard title="Com Avaliações" value={(data.performance || []).filter(d => d.avgRating > 0).length} icon={Users} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-lg">Por Especialização</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Especialização</TableHead>
                  <TableHead className="text-right">Médicos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {specEntries.map(([spec, count]) => (
                  <TableRow key={spec}>
                    <TableCell>{spec || 'Não informado'}</TableCell>
                    <TableCell className="text-right font-mono">{count}</TableCell>
                  </TableRow>
                ))}
                {specEntries.length === 0 && (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Desempenho</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Médico</TableHead>
                  <TableHead className="text-right">Consultas</TableHead>
                  <TableHead className="text-right">Avaliação</TableHead>
                  <TableHead className="text-right">Conclusão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.performance || []).map((doc, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{doc.doctorName}</TableCell>
                    <TableCell className="text-right font-mono">{doc.consultations}</TableCell>
                    <TableCell className="text-right font-mono">{doc.avgRating > 0 ? doc.avgRating.toFixed(1) : '-'} ⭐</TableCell>
                    <TableCell className="text-right font-mono">{(doc.completionRate * 100).toFixed(0)}%</TableCell>
                  </TableRow>
                ))}
                {(!data.performance || data.performance.length === 0) && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Reports() {
  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [activeTab, setActiveTab] = useState('consultations');

  const queryParams = `?startDate=${startDate}&endDate=${endDate}`;

  const { data: consultationsData, isLoading: loadingConsultations } = useQuery<ConsultationsReport>({
    queryKey: ['/api/reports/consultations', startDate, endDate],
    queryFn: () => fetch(`/api/reports/consultations${queryParams}`).then(r => r.json()),
  });

  const { data: patientsData, isLoading: loadingPatients } = useQuery<PatientsReport>({
    queryKey: ['/api/reports/patients', startDate, endDate],
    queryFn: () => fetch(`/api/reports/patients${queryParams}`).then(r => r.json()),
  });

  const { data: financialData, isLoading: loadingFinancial } = useQuery<FinancialReport>({
    queryKey: ['/api/reports/financial', startDate, endDate],
    queryFn: () => fetch(`/api/reports/financial${queryParams}`).then(r => r.json()),
  });

  const { data: doctorsData, isLoading: loadingDoctors } = useQuery<DoctorsReport>({
    queryKey: ['/api/reports/doctors', startDate, endDate],
    queryFn: () => fetch(`/api/reports/doctors${queryParams}`).then(r => r.json()),
  });

  const handleExportConsultations = () => {
    if (!consultationsData) return;
    const rows = [
      ...Object.entries(consultationsData.byStatus || {}).map(([k, v]) => ({ categoria: 'Status', item: k, quantidade: v })),
      ...Object.entries(consultationsData.byType || {}).map(([k, v]) => ({ categoria: 'Tipo', item: k, quantidade: v })),
      ...(consultationsData.byPeriod || []).map(p => ({ categoria: 'Período', item: p.period, quantidade: p.count })),
    ];
    exportToCSV(rows, `relatorio-consultas-${startDate}-${endDate}`);
  };

  const handleExportPatients = () => {
    if (!patientsData) return;
    const rows = [
      ...Object.entries(patientsData.byGender || {}).map(([k, v]) => ({ categoria: 'Gênero', item: k, quantidade: v })),
      ...Object.entries(patientsData.byAgeGroup || {}).map(([k, v]) => ({ categoria: 'Faixa Etária', item: k, quantidade: v })),
      ...Object.entries(patientsData.byHealthStatus || {}).map(([k, v]) => ({ categoria: 'Saúde', item: k, quantidade: v })),
    ];
    exportToCSV(rows, `relatorio-pacientes-${startDate}-${endDate}`);
  };

  const handleExportFinancial = () => {
    if (!financialData) return;
    const rows = (financialData.transactions || []).map(tx => ({
      tipo: tx.type,
      motivo: tx.reason,
      valor: tx.amount,
      data: tx.date,
    }));
    if (rows.length === 0) rows.push({ tipo: 'resumo', motivo: 'Total', valor: financialData.netFlow, data: '' });
    exportToCSV(rows, `relatorio-financeiro-${startDate}-${endDate}`);
  };

  const handleExportDoctors = () => {
    if (!doctorsData) return;
    const rows = (doctorsData.performance || []).map(d => ({
      medico: d.doctorName,
      consultas: d.consultations,
      avaliacao: d.avgRating,
      conclusao: `${(d.completionRate * 100).toFixed(0)}%`,
    }));
    exportToCSV(rows, `relatorio-medicos-${startDate}-${endDate}`);
  };

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
    <div className="container mx-auto p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Relatórios</h1>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="startDate" className="text-sm">Data Início</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="endDate" className="text-sm">Data Fim</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="consultations" className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            <span className="hidden sm:inline">Consultas</span>
          </TabsTrigger>
          <TabsTrigger value="patients" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Pacientes</span>
          </TabsTrigger>
          <TabsTrigger value="financial" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Financeiro</span>
          </TabsTrigger>
          <TabsTrigger value="doctors" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Médicos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="consultations">
          {loadingConsultations ? <LoadingSkeleton /> : <ConsultationsTab data={consultationsData} onExport={handleExportConsultations} />}
        </TabsContent>

        <TabsContent value="patients">
          {loadingPatients ? <LoadingSkeleton /> : <PatientsTab data={patientsData} onExport={handleExportPatients} />}
        </TabsContent>

        <TabsContent value="financial">
          {loadingFinancial ? <LoadingSkeleton /> : <FinancialTab data={financialData} onExport={handleExportFinancial} />}
        </TabsContent>

        <TabsContent value="doctors">
          {loadingDoctors ? <LoadingSkeleton /> : <DoctorsTab data={doctorsData} onExport={handleExportDoctors} />}
        </TabsContent>
      </Tabs>
    </div>
    </PageWrapper>
  );
}