import { useEffect, useRef } from 'react';

interface ExpandingOverlay {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  opacity: number;
  color: string;
}

export default function AnimatedOrigamiBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const overlaysRef = useRef<ExpandingOverlay[]>([]);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Cores sutis de tecnologia e medicina
    const colors = [
      'rgba(59, 130, 246, 0.08)',   // azul tecnologia
      'rgba(16, 185, 129, 0.08)',   // verde medicina
      'rgba(139, 92, 246, 0.06)',   // roxo tech
      'rgba(249, 115, 22, 0.06)',   // laranja medical
      'rgba(6, 182, 212, 0.07)',    // cyan tech
    ];

    // Criar overlays expandindo
    const createOverlays = () => {
      overlaysRef.current = [];
      const count = 8;

      for (let i = 0; i < count; i++) {
        overlaysRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: 0,
          maxRadius: 200 + Math.random() * 300,
          speed: 0.15 + Math.random() * 0.25,
          opacity: 1,
          color: colors[Math.floor(Math.random() * colors.length)]
        });
      }
    };

    createOverlays();

    // Desenhar círculo expandindo
    const drawExpandingCircle = (overlay: ExpandingOverlay) => {
      ctx.save();
      ctx.globalAlpha = overlay.opacity;
      
      // Criar gradiente radial
      const gradient = ctx.createRadialGradient(
        overlay.x, overlay.y, 0,
        overlay.x, overlay.y, overlay.radius
      );
      gradient.addColorStop(0, overlay.color);
      gradient.addColorStop(1, overlay.color.replace(/[\d.]+\)$/g, '0)'));
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(overlay.x, overlay.y, overlay.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    // Animar
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      timeRef.current += 1;

      overlaysRef.current.forEach(overlay => {
        // Expandir
        overlay.radius += overlay.speed;
        
        // Diminuir opacidade conforme expande
        overlay.opacity = 1 - (overlay.radius / overlay.maxRadius);

        // Resetar quando atingir tamanho máximo
        if (overlay.radius >= overlay.maxRadius) {
          overlay.radius = 0;
          overlay.opacity = 1;
          overlay.x = Math.random() * canvas.width;
          overlay.y = Math.random() * canvas.height;
        }

        drawExpandingCircle(overlay);
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950"
      />
      {/* Overlay de contraste suave */}
      <div 
        className="fixed inset-0 pointer-events-none z-[1] bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.08)_100%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.05)_100%)]"
      />
    </>
  );
}
