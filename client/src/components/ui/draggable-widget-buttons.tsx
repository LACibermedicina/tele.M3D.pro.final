import { useAuth } from '@/contexts/AuthContext';
import { useDraggable } from '@/hooks/use-draggable';
import { GripVertical } from 'lucide-react';
import QuickActionsBar from '@/components/quick-actions-bar';

export default function DraggableWidgetButtons() {
  const { user } = useAuth();

  const { position, onDragStart } = useDraggable({
    storageKey: 'widget-buttons-column',
    defaultPosition: { x: -1, y: -1 },
    constrainToWindow: true,
    elementSize: { w: 48, h: 240 },
  });

  return (
    <div
      data-draggable-root
      className="fixed z-40 flex flex-col-reverse items-center gap-3"
      style={position.x >= 0 ? { left: position.x, top: position.y } : { bottom: 16, right: 24 }}
    >
      {user && <QuickActionsBar userRole={user.role} />}

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
  );
}
