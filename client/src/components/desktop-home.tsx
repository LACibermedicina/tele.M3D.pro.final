import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Bell, Calendar, StickyNote, Clock, Activity, Shield, Users } from "lucide-react";
import { useState } from "react";

function NotificationsWidget() {
  const { data: notifications } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
  });

  const recent = (notifications || []).slice(0, 5);

  return (
    <div className="rounded-xl p-4 bg-white/[0.06] border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-white/90">Notificações</h3>
        {recent.length > 0 && (
          <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full">
            {recent.length}
          </span>
        )}
      </div>
      {recent.length === 0 ? (
        <p className="text-xs text-white/40 italic">Nenhuma notificação recente</p>
      ) : (
        <div className="space-y-2">
          {recent.map((n: any, i: number) => (
            <div key={n.id || i} className="flex items-start gap-2 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-white/70 truncate">{n.message || n.title || "Notificação"}</p>
                <p className="text-white/30 text-[10px]">
                  {n.createdAt ? new Date(n.createdAt).toLocaleDateString("pt-BR") : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarWidget({ userRole }: { userRole: string }) {
  const { data: appointments } = useQuery<any[]>({
    queryKey: ["/api/appointments"],
    enabled: userRole === "doctor" || userRole === "admin",
  });

  const { data: patientAppointments } = useQuery<any[]>({
    queryKey: ["/api/patient-appointments"],
    enabled: userRole === "patient",
  });

  const items = userRole === "patient" ? patientAppointments : appointments;
  const today = new Date().toDateString();
  const upcoming = (items || [])
    .filter((a: any) => new Date(a.date || a.scheduledDate) >= new Date())
    .slice(0, 4);

  return (
    <div className="rounded-xl p-4 bg-white/[0.06] border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-sky-400" />
        <h3 className="text-sm font-semibold text-white/90">
          {userRole === "patient" ? "Próximas Consultas" : "Agenda de Hoje"}
        </h3>
      </div>
      {upcoming.length === 0 ? (
        <p className="text-xs text-white/40 italic">
          {userRole === "patient" ? "Nenhuma consulta agendada" : "Nenhum compromisso hoje"}
        </p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((a: any, i: number) => {
            const d = new Date(a.date || a.scheduledDate);
            const isToday = d.toDateString() === today;
            return (
              <div key={a.id || i} className="flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 bg-white/[0.04]">
                <Clock className="w-3 h-3 text-sky-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-white/70 truncate">{a.patientName || a.doctorName || "Consulta"}</p>
                  <p className="text-white/40 text-[10px]">
                    {isToday ? "Hoje" : d.toLocaleDateString("pt-BR")} — {a.time || d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NotepadWidget() {
  const STORAGE_KEY = "desktop-home-notepad";
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; }
  });

  const handleChange = (val: string) => {
    setText(val);
    try { localStorage.setItem(STORAGE_KEY, val); } catch {}
  };

  return (
    <div className="rounded-xl p-4 bg-white/[0.06] border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <StickyNote className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-white/90">Bloco de Notas</h3>
      </div>
      <textarea
        className="w-full h-28 bg-transparent text-xs text-white/70 placeholder:text-white/30 border-0 outline-none resize-none"
        placeholder="Escreva suas anotações rápidas aqui..."
        value={text}
        onChange={(e) => handleChange(e.target.value)}
      />
    </div>
  );
}

function AdminStatsWidget() {
  const { data: stats } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
  });

  return (
    <div className="rounded-xl p-4 bg-white/[0.06] border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-white/90">Sistema</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-center">
          <Users className="w-3.5 h-3.5 text-sky-300 mx-auto mb-1" />
          <p className="text-lg font-bold text-white/80">{stats?.totalUsers || "—"}</p>
          <p className="text-[10px] text-white/40">Usuários</p>
        </div>
        <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-center">
          <Activity className="w-3.5 h-3.5 text-emerald-300 mx-auto mb-1" />
          <p className="text-lg font-bold text-white/80">{stats?.activeConsultations || "—"}</p>
          <p className="text-[10px] text-white/40">Consultas Hoje</p>
        </div>
      </div>
    </div>
  );
}

export default function DesktopHome() {
  const { user } = useAuth();
  const role = user?.role || "patient";

  return (
    <div className="p-5 space-y-4">
      <div className="mb-2">
        <h2 className="text-base font-semibold text-white/90">
          Olá, {user?.name?.split(" ")[0] || "Usuário"}
        </h2>
        <p className="text-xs text-white/40">Bem-vindo ao Tele&lt;M3D&gt; Pro</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <NotificationsWidget />
        <CalendarWidget userRole={role} />
        {role === "admin" && <AdminStatsWidget />}
        <NotepadWidget />
      </div>
    </div>
  );
}
