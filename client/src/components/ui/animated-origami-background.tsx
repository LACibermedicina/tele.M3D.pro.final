import { useEffect, useRef } from 'react';

interface Polygon {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  points: number;
  opacity: number;
  color: string;
}

export default function AnimatedOrigamiBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const polygonsRef = useRef<Polygon[]>([]);

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

    // Cores inspiradas nas formas de origami e tema autumn
    const colors = [
      'rgba(245, 158, 11, 0.15)',  // amber
      'rgba(251, 146, 60, 0.15)',  // orange
      'rgba(251, 113, 133, 0.12)', // rose
      'rgba(52, 211, 153, 0.12)',  // emerald
      'rgba(56, 189, 248, 0.12)',  // sky
      'rgba(71, 85, 105, 0.18)',   // slate dark
    ];

    // Criar polígonos inspirados nas formas geométricas da imagem
    const createPolygons = () => {
      const count = Math.floor((window.innerWidth * window.innerHeight) / 80000);
      polygonsRef.current = [];

      for (let i = 0; i < count; i++) {
        polygonsRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.005,
          size: 30 + Math.random() * 100,
          points: 3 + Math.floor(Math.random() * 5), // 3 a 7 lados
          opacity: 0.3 + Math.random() * 0.7,
          color: colors[Math.floor(Math.random() * colors.length)]
        });
      }
    };

    createPolygons();

    // Desenhar polígono irregular (inspirado em origami)
    const drawPolygon = (polygon: Polygon) => {
      ctx.save();
      ctx.translate(polygon.x, polygon.y);
      ctx.rotate(polygon.rotation);
      ctx.globalAlpha = polygon.opacity;

      ctx.beginPath();
      
      // Criar forma poligonal irregular (mais orgânica, como origami)
      for (let i = 0; i <= polygon.points; i++) {
        const angle = (Math.PI * 2 * i) / polygon.points;
        const variance = 0.7 + Math.random() * 0.6; // Variação para forma irregular
        const radius = polygon.size * variance;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.closePath();
      ctx.fillStyle = polygon.color;
      ctx.fill();
      
      // Adicionar borda sutil
      ctx.strokeStyle = polygon.color.replace(/[\d.]+\)$/g, '0.3)');
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    };

    // Animar
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      polygonsRef.current.forEach(polygon => {
        // Atualizar posição
        polygon.x += polygon.vx;
        polygon.y += polygon.vy;
        polygon.rotation += polygon.rotationSpeed;

        // Wrap around nas bordas
        if (polygon.x < -polygon.size) polygon.x = canvas.width + polygon.size;
        if (polygon.x > canvas.width + polygon.size) polygon.x = -polygon.size;
        if (polygon.y < -polygon.size) polygon.y = canvas.height + polygon.size;
        if (polygon.y > canvas.height + polygon.size) polygon.y = -polygon.size;

        drawPolygon(polygon);
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
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
      }}
    />
  );
}
