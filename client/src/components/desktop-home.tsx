import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bell, Calendar, StickyNote, Clock, Activity, Shield, Users, Stethoscope, Circle, Plus, Pin, Trash2, MessageCircle, Video, MessageSquare, BellRing } from "lucide-react";
import { useState, useRef, useCallback } from "react";

function NotificationsWidget() {
  const { data: notifications } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
  });

  const recent = (notifications || []).slice(0, 5);

  return (
    <div className="rounded-xl p-4 bg-white/[0.08] border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notificações</h3>
        {recent.length > 0 && (
          <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full">
            {recent.length}
          </span>
        )}
      </div>
      {recent.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">Nenhuma notificação recente</p>
      ) : (
        <div className="space-y-2">
          {recent.map((n: any, i: number) => (
            <div key={n.id || i} className="flex items-start gap-2 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-slate-700 dark:text-slate-200 truncate">{n.message || n.title || "Notificação"}</p>
                <p className="text-slate-500 dark:text-slate-400 text-[10px]">
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
    <div className="rounded-xl p-4 bg-white/[0.08] border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-sky-400" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {userRole === "patient" ? "Próximas Consultas" : "Agenda de Hoje"}
        </h3>
      </div>
      {upcoming.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
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
                  <p className="text-slate-700 dark:text-slate-200 truncate">{a.patientName || a.doctorName || "Consulta"}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-[10px]">
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

const NOTE_COLORS: Record<string, string> = {
  default: "bg-white/[0.06] border-white/10",
  yellow: "bg-amber-500/10 border-amber-500/20",
  green: "bg-emerald-500/10 border-emerald-500/20",
  blue: "bg-sky-500/10 border-sky-500/20",
  red: "bg-rose-500/10 border-rose-500/20",
  purple: "bg-violet-500/10 border-violet-500/20",
};

const NOTE_DOT_COLORS: Record<string, string> = {
  default: "bg-white/30",
  yellow: "bg-amber-400",
  green: "bg-emerald-400",
  blue: "bg-sky-400",
  red: "bg-rose-400",
  purple: "bg-violet-400",
};

function NotepadWidget() {
  const { data: notes } = useQuery<any[]>({
    queryKey: ["/api/notes"],
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/notes', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notes"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest('PATCH', `/api/notes/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notes"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/notes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notes"] }),
  });

  const handleAutoSave = useCallback((id: string, field: string, value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateMutation.mutate({ id, [field]: value });
    }, 800);
  }, [updateMutation]);

  const allNotes = notes || [];

  return (
    <div className="rounded-xl p-4 bg-white/[0.08] border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <StickyNote className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Bloco de Notas</h3>
        <button
          className="ml-auto w-5 h-5 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-slate-600 dark:text-slate-300 hover:text-white transition-colors"
          onClick={() => createMutation.mutate({ title: "", content: "" })}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
      {allNotes.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">Clique em + para criar uma nota</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-none">
          {allNotes.map((note: any) => {
            const colorClass = NOTE_COLORS[note.color] || NOTE_COLORS.default;
            const dotClass = NOTE_DOT_COLORS[note.color] || NOTE_DOT_COLORS.default;
            const isEditing = editingId === note.id;
            return (
              <div key={note.id} className={`rounded-lg p-2 border ${colorClass} group relative`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
                  {isEditing ? (
                    <input
                      className="flex-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-transparent border-0 outline-none placeholder:text-slate-500"
                      value={editTitle}
                      placeholder="Título..."
                      onChange={(e) => { setEditTitle(e.target.value); handleAutoSave(note.id, 'title', e.target.value); }}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="flex-1 text-xs font-medium text-slate-700 dark:text-slate-200 truncate cursor-pointer"
                      onClick={() => { setEditingId(note.id); setEditTitle(note.title || ''); setEditContent(note.content || ''); }}
                    >
                      {note.title || "Sem título"}
                    </span>
                  )}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="w-4 h-4 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-amber-400"
                      onClick={() => updateMutation.mutate({ id: note.id, pinned: !note.pinned })}
                    >
                      <Pin className={`w-2.5 h-2.5 ${note.pinned ? 'text-amber-400' : ''}`} />
                    </button>
                    <select
                      className="w-4 h-4 bg-transparent text-[8px] appearance-none cursor-pointer"
                      value={note.color}
                      onChange={(e) => updateMutation.mutate({ id: note.id, color: e.target.value })}
                      title="Cor"
                    >
                      {Object.keys(NOTE_COLORS).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button
                      className="w-4 h-4 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-red-400"
                      onClick={() => deleteMutation.mutate(note.id)}
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
                {isEditing ? (
                  <textarea
                    className="w-full h-16 bg-transparent text-[11px] text-slate-700 dark:text-slate-300 placeholder:text-slate-500 border-0 outline-none resize-none"
                    value={editContent}
                    placeholder="Conteúdo..."
                    onChange={(e) => { setEditContent(e.target.value); handleAutoSave(note.id, 'content', e.target.value); }}
                    onBlur={() => setEditingId(null)}
                  />
                ) : (
                  <p
                    className="text-[11px] text-slate-500 dark:text-slate-400 truncate cursor-pointer"
                    onClick={() => { setEditingId(note.id); setEditTitle(note.title || ''); setEditContent(note.content || ''); }}
                  >
                    {note.content || "Clique para editar..."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminStatsWidget() {
  const { data: stats } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
  });

  return (
    <div className="rounded-xl p-4 bg-white/[0.08] border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Sistema</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-center">
          <Users className="w-3.5 h-3.5 text-sky-300 mx-auto mb-1" />
          <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{stats?.totalUsers || "—"}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Usuários</p>
        </div>
        <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-center">
          <Activity className="w-3.5 h-3.5 text-emerald-300 mx-auto mb-1" />
          <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{stats?.activeConsultations || "—"}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Consultas Hoje</p>
        </div>
      </div>
    </div>
  );
}

function AvailableDoctorsWidget() {
  const { data: doctors } = useQuery<any[]>({
    queryKey: ["/api/doctors/available"],
    refetchInterval: 15000,
  });

  const allDoctors = doctors || [];
  const online = allDoctors.filter((d: any) => d.isOnline);
  const offline = allDoctors.filter((d: any) => !d.isOnline);

  return (
    <div className="rounded-xl p-4 bg-white/[0.08] border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <Stethoscope className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Médicos</h3>
        {online.length > 0 && (
          <span className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full">
            {online.length} online
          </span>
        )}
      </div>
      {allDoctors.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">Nenhum médico cadastrado</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-none">
          {online.map((doc: any) => (
            <div key={doc.id} className="flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 bg-emerald-500/5 border border-emerald-500/10 group">
              <Circle className="w-2 h-2 text-emerald-400 fill-emerald-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="text-slate-700 dark:text-slate-200 truncate">{doc.name}</p>
                  {doc.priorAttendance && (
                    <span className="text-[8px] bg-sky-500/20 text-sky-300 px-1 py-0.5 rounded shrink-0">já te atendeu</span>
                  )}
                </div>
                {doc.specialization && (
                  <p className="text-slate-500 dark:text-slate-400 text-[10px] truncate">{doc.specialization}</p>
                )}
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  className="w-5 h-5 flex items-center justify-center rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30"
                  title="Chat"
                  onClick={() => window.location.href = '/chatbot'}
                >
                  <MessageSquare className="w-2.5 h-2.5" />
                </button>
                <button
                  className="w-5 h-5 flex items-center justify-center rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                  title="Consulta imediata"
                  onClick={() => window.location.href = '/immediate-consultation'}
                >
                  <Video className="w-2.5 h-2.5" />
                </button>
                <button
                  className="w-5 h-5 flex items-center justify-center rounded bg-violet-500/20 text-violet-300 hover:bg-violet-500/30"
                  title="Agendar consulta"
                  onClick={() => window.location.href = '/consultation-request'}
                >
                  <Calendar className="w-2.5 h-2.5" />
                </button>
                <button
                  className="w-5 h-5 flex items-center justify-center rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                  title="Solicitar notificação"
                  onClick={() => window.location.href = '/waiting-room'}
                >
                  <BellRing className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          ))}
          {offline.length > 0 && online.length > 0 && (
            <div className="border-t border-white/5 pt-1 mt-1" />
          )}
          {offline
            .sort((a: any, b: any) => (b.priorAttendance ? 1 : 0) - (a.priorAttendance ? 1 : 0))
            .filter((doc: any, i: number) => doc.priorAttendance || i < 5)
            .map((doc: any) => (
            <div key={doc.id} className="flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 bg-white/[0.02] group">
              <Circle className="w-2 h-2 text-slate-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="text-slate-500 dark:text-slate-400 truncate">{doc.name}</p>
                  {doc.priorAttendance && (
                    <span className="text-[8px] bg-white/5 text-slate-500 px-1 py-0.5 rounded shrink-0">já te atendeu</span>
                  )}
                </div>
                {doc.specialization && (
                  <p className="text-slate-500 text-[10px] truncate">{doc.specialization}</p>
                )}
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  className="w-5 h-5 flex items-center justify-center rounded bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-white/10"
                  title="Agendar consulta"
                  onClick={() => window.location.href = '/consultation-request'}
                >
                  <Calendar className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          ))}
          {offline.filter((d: any) => !d.priorAttendance).length > 5 && (
            <p className="text-[10px] text-slate-500 text-center pt-1">+{offline.filter((d: any) => !d.priorAttendance).length - 5} médicos offline</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function DesktopHome() {
  const { user } = useAuth();
  const role = user?.role || "patient";

  return (
    <div className="p-5 space-y-4">
      <div className="mb-2">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          Olá, {user?.name?.split(" ")[0] || "Usuário"}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Bem-vindo ao Tele&lt;M3D&gt; Pro</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <NotificationsWidget />
        <CalendarWidget userRole={role} />
        {(role === "patient" || role === "visitor") && <AvailableDoctorsWidget />}
        {role === "admin" && <AdminStatsWidget />}
        <NotepadWidget />
      </div>
    </div>
  );
}
