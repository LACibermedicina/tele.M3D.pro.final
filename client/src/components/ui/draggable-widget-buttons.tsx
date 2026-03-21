import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDraggable } from '@/hooks/use-draggable';
import { useLayoutSettings } from '@/contexts/LayoutSettingsContext';
import { GripVertical, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import QuickActionsBar from '@/components/quick-actions-bar';

function DraggableQuickActions({ userRole }: { userRole: string }) {
  const { position, onDragStart } = useDraggable({
    storageKey: 'quick-actions-panel',
    defaultPosition: { x: -1, y: -1 },
    constrainToWindow: true,
    elementSize: { w: 48, h: 48 },
  });

  return (
    <div
      data-draggable-root
      className="fixed z-40"
      style={position.x >= 0 ? { left: position.x, top: position.y } : { top: 80, left: 16 }}
    >
      <div className="relative group/qa">
        <div
          className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover/qa:opacity-70 hover:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
          title="Arrastar ações rápidas"
        >
          <GripVertical className="w-3 h-3 text-gray-400 rotate-90" />
        </div>
        <QuickActionsBar userRole={userRole} />
      </div>
    </div>
  );
}

const trayButtons = [
  {
    id: 'chatbot',
    event: 'open-chatbot-widget',
    title: 'Chatbot IA',
    gradient: 'from-blue-500 to-cyan-600',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
    ),
    roles: ['doctor', 'admin', 'patient', 'visitor', 'researcher', 'pharmacist'],
  },
  {
    id: 'study-notes',
    event: 'open-study-notes-widget',
    title: 'Notas de Estudo',
    gradient: 'from-amber-500 to-orange-600',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
    ),
    roles: ['doctor', 'admin'],
  },
  {
    id: 'ecg',
    event: 'open-ecg-widget',
    title: 'Estudo de ECG',
    gradient: 'from-red-500 to-pink-600',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
    ),
    roles: ['doctor', 'admin'],
  },
  {
    id: 'radiology',
    event: 'open-radiology-widget',
    title: 'Estudo de Imagem',
    gradient: 'from-indigo-500 to-purple-600',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" x2="22" y1="7" y2="7"/><line x1="7" x2="7" y1="2" y2="22"/><line x1="17" x2="17" y1="2" y2="22"/><line x1="2" x2="22" y1="17" y2="17"/></svg>
    ),
    roles: ['doctor', 'admin'],
  },
];

const TRAY_DETACHED_KEY = 'tray_detached_buttons';

function getDetachedIds(): string[] {
  try {
    const val = localStorage.getItem(TRAY_DETACHED_KEY);
    return val ? JSON.parse(val) : [];
  } catch { return []; }
}

function saveDetachedIds(ids: string[]) {
  try { localStorage.setItem(TRAY_DETACHED_KEY, JSON.stringify(ids)); } catch {}
}

function DetachedTrayButton({ btn, onReattach }: { btn: typeof trayButtons[0]; onReattach: (id: string) => void }) {
  const { position, onDragStart } = useDraggable({
    storageKey: `tray_btn_${btn.id}`,
    defaultPosition: { x: -1, y: -1 },
    constrainToWindow: true,
    elementSize: { w: 48, h: 48 },
  });

  return (
    <div
      data-draggable-root
      className="fixed z-40 group/detached"
      style={position.x >= 0 ? { left: position.x, top: position.y } : { bottom: 80, right: 60 }}
    >
      <div
        className="absolute -top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover/detached:opacity-80 transition-opacity flex items-center gap-0.5"
      >
        <div className="cursor-grab active:cursor-grabbing" onMouseDown={onDragStart} onTouchStart={onDragStart}>
          <GripVertical className="w-3 h-3 text-gray-400 rotate-90" />
        </div>
        <button
          className="w-4 h-4 rounded-full bg-slate-700/80 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
          onClick={() => onReattach(btn.id)}
          title="Voltar para barra"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      </div>
      <button
        onClick={() => window.dispatchEvent(new Event(btn.event))}
        className={`w-12 h-12 rounded-full bg-gradient-to-br ${btn.gradient} text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-110`}
        title={btn.title}
      >
        {btn.icon}
      </button>
    </div>
  );
}

export function InlineTrayAnalysisButtons({ userRole }: { userRole: string }) {
  const [detachedIds, setDetachedIds] = useState<string[]>(getDetachedIds);
  const visibleButtons = trayButtons.filter(b => b.roles.includes(userRole));

  useEffect(() => {
    const onReset = () => {
      setDetachedIds([]);
      saveDetachedIds([]);
    };
    window.addEventListener('reset-tray-buttons', onReset);
    return () => window.removeEventListener('reset-tray-buttons', onReset);
  }, []);

  const handleDetach = useCallback((id: string) => {
    setDetachedIds(prev => {
      const next = [...prev, id];
      saveDetachedIds(next);
      return next;
    });
  }, []);

  const handleReattach = useCallback((id: string) => {
    setDetachedIds(prev => {
      const next = prev.filter(x => x !== id);
      saveDetachedIds(next);
      try { localStorage.removeItem(`draggable_tray_btn_${id}`); } catch {}
      return next;
    });
  }, []);

  if (visibleButtons.length === 0) return null;

  const inTray = visibleButtons.filter(b => !detachedIds.includes(b.id));
  const floating = visibleButtons.filter(b => detachedIds.includes(b.id));

  return (
    <>
      {inTray.map(btn => (
        <Tooltip key={btn.id}>
          <TooltipTrigger asChild>
            <button
              onClick={() => window.dispatchEvent(new Event(btn.event))}
              onDoubleClick={() => handleDetach(btn.id)}
              className={`w-8 h-8 rounded-lg bg-gradient-to-br ${btn.gradient} text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center hover:scale-105 shrink-0`}
              title={`${btn.title} (duplo-clique para destacar)`}
            >
              {btn.icon}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top"><p>{btn.title}</p></TooltipContent>
        </Tooltip>
      ))}
      {floating.map(btn => (
        <DetachedTrayButton key={btn.id} btn={btn} onReattach={handleReattach} />
      ))}
    </>
  );
}

export default function DraggableWidgetButtons() {
  const { user } = useAuth();
  const { navDockMode } = useLayoutSettings();

  const { position, onDragStart } = useDraggable({
    storageKey: 'widget-buttons-column',
    defaultPosition: { x: -1, y: -1 },
    constrainToWindow: true,
    elementSize: { w: 48, h: 240 },
  });

  const isBottomNav = navDockMode === 'bottom';
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (isBottomNav && !isMobile) return null;

  return (
    <>
      {user && <DraggableQuickActions userRole={user.role} />}
      <div
        data-draggable-root
        className="fixed z-40 flex flex-col-reverse items-center gap-3"
        style={position.x >= 0 ? { left: position.x, top: position.y } : { top: 140, left: 16 }}
      >
        <button
          onClick={() => window.dispatchEvent(new Event('open-chatbot-widget'))}
          className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-110"
          title="Chatbot IA"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
        </button>

        {user && ['doctor', 'admin'].includes(user.role) && (
          <button
            onClick={() => window.dispatchEvent(new Event('open-study-notes-widget'))}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-110"
            title="Notas de Estudo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          </button>
        )}

        {user && ['doctor', 'admin'].includes(user.role) && (
          <button
            onClick={() => window.dispatchEvent(new Event('open-ecg-widget'))}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-pink-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-110"
            title="Estudo de ECG"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          </button>
        )}

        {user && ['doctor', 'admin'].includes(user.role) && (
          <button
            onClick={() => window.dispatchEvent(new Event('open-radiology-widget'))}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-110"
            title="Estudo de Imagem"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" x2="22" y1="7" y2="7"/><line x1="7" x2="7" y1="2" y2="22"/><line x1="17" x2="17" y1="2" y2="22"/><line x1="2" x2="22" y1="17" y2="17"/></svg>
          </button>
        )}

        <div
          className="w-6 h-6 rounded-full bg-gray-400/50 flex items-center justify-center cursor-grab active:cursor-grabbing"
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
          title="Arrastar botões"
        >
          <GripVertical className="w-3 h-3 text-white" />
        </div>
      </div>
    </>
  );
}
