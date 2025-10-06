import { useEffect, useState } from 'react';

interface Shape {
  id: number;
  type: 'triangle' | 'diamond' | 'pentagon';
  left: number;
  duration: number;
  delay: number;
  size: number;
  color: string;
  opacity: number;
}

export default function FloatingOrigamiShapes() {
  const [shapes, setShapes] = useState<Shape[]>([]);

  useEffect(() => {
    const colors = [
      'rgb(245, 158, 11)',  // amber
      'rgb(251, 146, 60)',  // orange
      'rgb(251, 113, 133)', // rose
      'rgb(52, 211, 153)',  // emerald
      'rgb(56, 189, 248)',  // sky
      'rgb(71, 85, 105)',   // slate
    ];

    const shapeTypes: Array<'triangle' | 'diamond' | 'pentagon'> = ['triangle', 'diamond', 'pentagon'];

    const newShapes: Shape[] = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      type: shapeTypes[Math.floor(Math.random() * shapeTypes.length)],
      left: Math.random() * 100,
      duration: 20 + Math.random() * 30,
      delay: Math.random() * 10,
      size: 30 + Math.random() * 80,
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: 0.15 + Math.random() * 0.15 // Mais opaco
    }));

    setShapes(newShapes);
  }, []);

  const getShapePath = (type: string, size: number) => {
    switch (type) {
      case 'triangle':
        return `polygon(50% 0%, 0% 100%, 100% 100%)`;
      case 'diamond':
        return `polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)`;
      case 'pentagon':
        return `polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)`;
      default:
        return `polygon(50% 0%, 0% 100%, 100% 100%)`;
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {shapes.map((shape) => (
        <div
          key={shape.id}
          className="absolute animate-float-up"
          style={{
            left: `${shape.left}%`,
            bottom: '-150px',
            width: `${shape.size}px`,
            height: `${shape.size}px`,
            clipPath: getShapePath(shape.type, shape.size),
            backgroundColor: shape.color,
            opacity: shape.opacity,
            animation: `floatUp ${shape.duration}s linear ${shape.delay}s infinite`,
            transform: `rotate(${Math.random() * 360}deg)`
          }}
        />
      ))}
      
      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: var(--shape-opacity, 0.15);
          }
          90% {
            opacity: var(--shape-opacity, 0.15);
          }
          100% {
            transform: translateY(-120vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
