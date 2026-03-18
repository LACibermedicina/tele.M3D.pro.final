import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useDraggable } from '@/hooks/use-draggable';
import {
  BookOpen, X, Plus, Trash2, Save, Minimize2, Maximize2,
  StickyNote, Search, Pin, PinOff, GripVertical
} from 'lucide-react';

interface StudyNote {
  id: string;
  title: string;
  content: string;
  folder: string;
  color: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function FloatingStudyNotes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const { position: notesPos, onDragStart: onNotesDragStart } = useDraggable({
    storageKey: 'study-notes-widget',
    defaultPosition: { x: -1, y: -1 },
    constrainToWindow: true,
    elementSize: { w: 340, h: 400 },
  });

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('open-study-notes-widget', handler);
    return () => window.removeEventListener('open-study-notes-widget', handler);
  }, []);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedNote, setSelectedNote] = useState<StudyNote | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { data: notes = [], isLoading } = useQuery<StudyNote[]>({
    queryKey: ['/api/doctor-notes', 'ecg_study'],
    queryFn: () => fetch('/api/doctor-notes?folder=ecg_study').then(r => r.json()),
    enabled: isOpen && !!user && ['doctor', 'admin'].includes(user.role),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string; title: string; content: string }) => {
      if (data.id) {
        return apiRequest('PATCH', `/api/doctor-notes/${data.id}`, {
          title: data.title,
          content: data.content,
        });
      }
      return apiRequest('POST', '/api/doctor-notes', {
        title: data.title,
        content: data.content,
        folder: 'ecg_study',
        color: 'blue',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/doctor-notes'] });
      toast({ title: 'Nota salva' });
      setIsCreating(false);
    },
    onError: () => {
      toast({ title: 'Erro ao salvar nota', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/doctor-notes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/doctor-notes'] });
      setSelectedNote(null);
      toast({ title: 'Nota removida' });
    },
  });

  const pinMutation = useMutation({
    mutationFn: async (note: StudyNote) =>
      apiRequest('PATCH', `/api/doctor-notes/${note.id}`, { isPinned: !note.isPinned }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/doctor-notes'] });
    },
  });

  if (!user || !['doctor', 'admin'].includes(user.role)) return null;

  const selectNote = (note: StudyNote) => {
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setIsCreating(false);
  };

  const startNewNote = () => {
    setSelectedNote(null);
    setEditTitle('');
    setEditContent('');
    setIsCreating(true);
  };

  const saveCurrentNote = () => {
    if (!editTitle.trim()) return;
    saveMutation.mutate({
      id: selectedNote?.id,
      title: editTitle.trim(),
      content: editContent,
    });
    if (selectedNote) {
      setSelectedNote({ ...selectedNote, title: editTitle, content: editContent });
    }
  };

  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  if (!isOpen) {
    return null;
  }

  const panelWidth = isExpanded ? 'w-[480px]' : 'w-[340px]';
  const panelHeight = isExpanded ? 'max-h-[85vh]' : 'max-h-[60vh]';

  return (
    <div
      data-draggable-root
      className={`fixed z-50 ${panelWidth} ${panelHeight} flex flex-col`}
      style={notesPos.x >= 0 ? { left: notesPos.x, top: notesPos.y } : { bottom: 16, right: 412 }}
    >
      <Card className="flex flex-col h-full border-amber-500/30 shadow-2xl bg-background/95 backdrop-blur-sm">
        <CardHeader
          className="p-3 pb-2 flex flex-row items-center justify-between border-b shrink-0 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={onNotesDragStart}
          onTouchStart={onNotesDragStart}
        >
          <CardTitle className="text-sm flex items-center gap-2 pointer-events-none">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
            <BookOpen className="h-4 w-4 text-amber-500" />
            Study Notes
            <Badge variant="secondary" className="text-[10px]">{notes.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-1" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={startNewNote}>
              <Plus className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
          {(selectedNote || isCreating) ? (
            <div className="flex flex-col h-full">
              <div className="p-2 border-b flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setSelectedNote(null); setIsCreating(false); }}>
                  ← Voltar
                </Button>
                <div className="flex-1" />
                {selectedNote && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => deleteMutation.mutate(selectedNote.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={saveCurrentNote}
                  disabled={saveMutation.isPending || !editTitle.trim()}
                >
                  <Save className="h-3 w-3 mr-1" />
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
              <div className="p-2 space-y-2 flex-1 flex flex-col">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Título da nota..."
                  className="h-8 text-sm font-medium"
                />
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Conteúdo da nota de estudo..."
                  className="flex-1 min-h-[200px] text-xs resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar notas..."
                    className="h-6 pl-7 text-xs"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1.5">
                  {isLoading ? (
                    <p className="text-xs text-center text-muted-foreground py-4">Carregando...</p>
                  ) : sortedNotes.length === 0 ? (
                    <div className="text-center py-6">
                      <StickyNote className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-xs text-muted-foreground">Nenhuma nota de estudo</p>
                      <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={startNewNote}>
                        <Plus className="h-3 w-3 mr-1" /> Nova Nota
                      </Button>
                    </div>
                  ) : (
                    sortedNotes.map(note => (
                      <div
                        key={note.id}
                        onClick={() => selectNote(note)}
                        className="p-2 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              {note.isPinned && <Pin className="h-2.5 w-2.5 text-amber-500 shrink-0" />}
                              <p className="text-xs font-medium truncate">{note.title}</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                              {note.content || 'Sem conteúdo'}
                            </p>
                            <p className="text-[9px] text-muted-foreground/60 mt-1">
                              {new Date(note.updatedAt).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0"
                            onClick={(e) => { e.stopPropagation(); pinMutation.mutate(note); }}
                          >
                            {note.isPinned ? <PinOff className="h-2.5 w-2.5" /> : <Pin className="h-2.5 w-2.5" />}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}