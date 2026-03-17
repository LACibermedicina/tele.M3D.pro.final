import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  Pin,
  PinOff,
  Trash2,
  MoreHorizontal,
  FolderOpen,
  FileText,
  Stethoscope,
  User,
  BookOpen,
  StickyNote,
  Clock,
  ChevronDown,
  Palette,
  ArrowLeft,
} from "lucide-react";
import { useLocation } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DoctorNote {
  id: string;
  doctorId: string;
  patientId: string | null;
  title: string;
  content: string;
  folder: string;
  color: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

const FOLDERS = [
  { id: "all", label: "Todas", icon: StickyNote },
  { id: "clinical", label: "Clínicas", icon: Stethoscope },
  { id: "patients", label: "Pacientes", icon: User },
  { id: "study", label: "Estudos", icon: BookOpen },
  { id: "personal", label: "Pessoais", icon: FileText },
];

const COLORS: { id: string; label: string; bg: string; border: string; sidebar: string }[] = [
  { id: "default", label: "Padrão", bg: "bg-white dark:bg-zinc-900", border: "border-zinc-200 dark:border-zinc-700", sidebar: "border-l-zinc-300" },
  { id: "yellow", label: "Amarelo", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", sidebar: "border-l-amber-400" },
  { id: "green", label: "Verde", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", sidebar: "border-l-emerald-400" },
  { id: "blue", label: "Azul", bg: "bg-sky-50 dark:bg-sky-950/30", border: "border-sky-200 dark:border-sky-800", sidebar: "border-l-sky-400" },
  { id: "purple", label: "Roxo", bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200 dark:border-violet-800", sidebar: "border-l-violet-400" },
  { id: "pink", label: "Rosa", bg: "bg-pink-50 dark:bg-pink-950/30", border: "border-pink-200 dark:border-pink-800", sidebar: "border-l-pink-400" },
  { id: "red", label: "Urgente", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", sidebar: "border-l-red-400" },
];

function getColorConfig(colorId: string) {
  return COLORS.find((c) => c.id === colorId) || COLORS[0];
}

export default function DoctorNotesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFolder, setActiveFolder] = useState("all");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const { data: notes = [], isLoading } = useQuery<DoctorNote[]>({
    queryKey: ["/api/doctor-notes"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<DoctorNote>) => {
      const res = await apiRequest("POST", "/api/doctor-notes", data);
      return await res.json();
    },
    onSuccess: (newNote: DoctorNote) => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor-notes"] });
      setSelectedNoteId(newNote.id);
      setEditTitle(newNote.title);
      setEditContent(newNote.content);
      setTimeout(() => titleInputRef.current?.focus(), 100);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<DoctorNote>) => {
      const res = await apiRequest("PATCH", `/api/doctor-notes/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor-notes"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/doctor-notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor-notes"] });
      setSelectedNoteId(null);
      setEditTitle("");
      setEditContent("");
      toast({ title: "Nota excluída" });
    },
  });

  const autoSave = useCallback(
    (noteId: string, title: string, content: string) => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        updateMutation.mutate({ id: noteId, title, content });
      }, 800);
    },
    [updateMutation]
  );

  const handleTitleChange = (val: string) => {
    setEditTitle(val);
    if (selectedNoteId) autoSave(selectedNoteId, val, editContent);
  };

  const handleContentChange = (val: string) => {
    setEditContent(val);
    if (selectedNoteId) autoSave(selectedNoteId, editTitle, val);
  };

  const handleSelectNote = (note: DoctorNote) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      if (selectedNoteId) {
        const currentNote = notes.find((n) => n.id === selectedNoteId);
        if (currentNote && (editTitle !== currentNote.title || editContent !== currentNote.content)) {
          updateMutation.mutate({ id: selectedNoteId, title: editTitle, content: editContent });
        }
      }
    }
    setSelectedNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const handleCreateNote = () => {
    createMutation.mutate({
      title: "",
      content: "",
      folder: activeFolder === "all" ? "clinical" : activeFolder,
    });
  };

  const handleTogglePin = (note: DoctorNote) => {
    updateMutation.mutate({ id: note.id, isPinned: !note.isPinned });
  };

  const handleChangeColor = (noteId: string, color: string) => {
    updateMutation.mutate({ id: noteId, color });
  };

  const handleChangeFolder = (noteId: string, folder: string) => {
    updateMutation.mutate({ id: noteId, folder });
  };

  const filteredNotes = notes.filter((n) => {
    if (activeFolder !== "all" && n.folder !== activeFolder) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        n.title.toLowerCase().includes(term) || n.content.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const pinnedNotes = filteredNotes.filter((n) => n.isPinned);
  const unpinnedNotes = filteredNotes.filter((n) => !n.isPinned);

  const selectedNote = notes.find((n) => n.id === selectedNoteId);

  useEffect(() => {
    if (!selectedNoteId && filteredNotes.length > 0) {
      const first = filteredNotes[0];
      setSelectedNoteId(first.id);
      setEditTitle(first.title);
      setEditContent(first.content);
    }
  }, [filteredNotes.length]);

  const getPreview = (content: string) => {
    if (!content) return "Nota vazia";
    const lines = content.split("\n").filter((l) => l.trim());
    return lines[0]?.substring(0, 80) || "Nota vazia";
  };

  const folderCounts = FOLDERS.map((f) => ({
    ...f,
    count: f.id === "all" ? notes.length : notes.filter((n) => n.folder === f.id).length,
  }));

  if (!user || (user.role !== "doctor" && user.role !== "admin")) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <p className="text-muted-foreground">Acesso restrito a médicos.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-background overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
        <Button variant="ghost" size="sm" onClick={() => window.history.length > 1 ? window.history.back() : navigate('/')} className="gap-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <span className="text-sm font-medium text-muted-foreground">Notas Clínicas</span>
      </div>
      <div className="flex flex-1 overflow-hidden">
      {/* Sidebar - Folders & Notes List */}
      <div
        className={`flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/50 transition-all duration-300 ${
          sidebarOpen ? "w-80" : "w-0 overflow-hidden"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-sm bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleCreateNote}
            disabled={createMutation.isPending}
            title="Nova nota"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Folder Tabs */}
        <div className="px-2 py-2 border-b border-zinc-200 dark:border-zinc-800">
          <ScrollArea className="w-full">
            <div className="flex gap-1 pb-0.5">
              {folderCounts.map((f) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.id}
                    onClick={() => setActiveFolder(f.id)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                      activeFolder === f.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {f.label}
                    {f.count > 0 && (
                      <span className={`ml-0.5 text-[10px] ${activeFolder === f.id ? "opacity-80" : "opacity-60"}`}>
                        {f.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Notes List */}
        <ScrollArea className="flex-1">
          <div className="p-1.5">
            {isLoading && (
              <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
            )}

            {!isLoading && filteredNotes.length === 0 && (
              <div className="text-center py-12 px-4">
                <StickyNote className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground mb-2">Nenhuma nota</p>
                <Button variant="outline" size="sm" onClick={handleCreateNote} className="text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Criar nota
                </Button>
              </div>
            )}

            {pinnedNotes.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <Pin className="h-2.5 w-2.5" />
                  Fixadas
                </div>
                {pinnedNotes.map((note) => (
                  <NoteListItem
                    key={note.id}
                    note={note}
                    isSelected={note.id === selectedNoteId}
                    onClick={() => handleSelectNote(note)}
                    getPreview={getPreview}
                  />
                ))}
              </>
            )}

            {pinnedNotes.length > 0 && unpinnedNotes.length > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 mt-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                <Clock className="h-2.5 w-2.5" />
                Recentes
              </div>
            )}

            {unpinnedNotes.map((note) => (
              <NoteListItem
                key={note.id}
                note={note}
                isSelected={note.id === selectedNoteId}
                onClick={() => handleSelectNote(note)}
                getPreview={getPreview}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Sidebar Footer */}
        <div className="p-2 border-t border-zinc-200 dark:border-zinc-800 text-center">
          <p className="text-[10px] text-muted-foreground">
            {notes.length} nota{notes.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedNote ? (
          <>
            {/* Editor Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden h-8 px-2"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>

                {/* Folder selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                      {FOLDERS.find((f) => f.id === selectedNote.folder)?.label || "Pasta"}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {FOLDERS.filter((f) => f.id !== "all").map((f) => {
                      const Icon = f.icon;
                      return (
                        <DropdownMenuItem
                          key={f.id}
                          onClick={() => handleChangeFolder(selectedNote.id, f.id)}
                        >
                          <Icon className="h-3.5 w-3.5 mr-2" />
                          {f.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Color selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                      <Palette className="h-3 w-3" />
                      <div
                        className={`w-3 h-3 rounded-full border ${
                          getColorConfig(selectedNote.color).border
                        } ${getColorConfig(selectedNote.color).bg}`}
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {COLORS.map((c) => (
                      <DropdownMenuItem
                        key={c.id}
                        onClick={() => handleChangeColor(selectedNote.id, c.id)}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full border mr-2 ${c.border} ${c.bg}`} />
                        {c.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {selectedNote.isPinned && (
                  <Badge variant="secondary" className="text-[10px] h-5 gap-0.5">
                    <Pin className="h-2.5 w-2.5" />
                    Fixada
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground mr-2">
                  {updateMutation.isPending ? "Salvando..." : "Salvo"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleTogglePin(selectedNote)}
                  title={selectedNote.isPinned ? "Desafixar" : "Fixar"}
                >
                  {selectedNote.isPinned ? (
                    <PinOff className="h-3.5 w-3.5" />
                  ) : (
                    <Pin className="h-3.5 w-3.5" />
                  )}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleTogglePin(selectedNote)}>
                      {selectedNote.isPinned ? (
                        <>
                          <PinOff className="h-3.5 w-3.5 mr-2" />
                          Desafixar
                        </>
                      ) : (
                        <>
                          <Pin className="h-3.5 w-3.5 mr-2" />
                          Fixar nota
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => deleteMutation.mutate(selectedNote.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Excluir nota
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Editor Content */}
            <div className={`flex-1 flex flex-col overflow-hidden ${getColorConfig(selectedNote.color).bg}`}>
              <div className="px-6 pt-5 pb-2">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={editTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Título da nota..."
                  className="w-full text-2xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/40 text-foreground"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {format(new Date(selectedNote.updatedAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              </div>
              <div className="flex-1 px-6 pb-6 overflow-hidden">
                <textarea
                  ref={contentRef}
                  value={editContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Comece a escrever..."
                  className="w-full h-full resize-none bg-transparent border-none outline-none text-sm leading-relaxed placeholder:text-muted-foreground/30 text-foreground"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <StickyNote className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
              <p className="text-lg font-medium text-muted-foreground/60 mb-2">Notas do Médico</p>
              <p className="text-sm text-muted-foreground/40 mb-4 max-w-sm">
                Crie e organize suas anotações clínicas, observações de pacientes e estudos
              </p>
              <Button onClick={handleCreateNote} disabled={createMutation.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Nota
              </Button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function NoteListItem({
  note,
  isSelected,
  onClick,
  getPreview,
}: {
  note: DoctorNote;
  isSelected: boolean;
  onClick: () => void;
  getPreview: (content: string) => string;
}) {
  const colorConfig = getColorConfig(note.color);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-2.5 rounded-lg mb-0.5 transition-all border-l-[3px] ${colorConfig.sidebar} ${
        isSelected
          ? "bg-primary/10 dark:bg-primary/20"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
      }`}
    >
      <div className="flex items-start gap-1">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
            {note.title || "Sem título"}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {getPreview(note.content)}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true, locale: ptBR })}
          </p>
        </div>
        {note.isPinned && <Pin className="h-3 w-3 text-primary/60 mt-0.5 shrink-0" />}
      </div>
    </button>
  );
}
