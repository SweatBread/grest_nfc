import React, { useRef, useEffect, useState } from 'react';

// Color map per i ruoli (Adattato per Light Mode con contrasto elevato)
const COLOR_MAP = {
  'Responsabile': {
    border: '#d97706',      // Amber-600
    fillInner: '#fef3c7',   // Amber-100
    fillOuter: '#fde68a',   // Amber-200
    glow: 'rgba(217, 119, 6, 0.12)',
    textName: '#78350f',    // Amber-900
    textHours: '#b45309'    // Amber-700
  },
  'Animatore': {
    border: '#db2777',      // Pink-600
    fillInner: '#fce7f3',   // Pink-100
    fillOuter: '#fbcfe8',   // Pink-200
    glow: 'rgba(219, 39, 119, 0.12)',
    textName: '#9d174d',    // Pink-800
    textHours: '#be185d'    // Pink-700
  },
  'Aiuto-Animatore': {
    border: '#0284c7',      // Sky-600
    fillInner: '#e0f2fe',   // Sky-100
    fillOuter: '#bae6fd',   // Sky-200
    glow: 'rgba(2, 132, 199, 0.12)',
    textName: '#075985',    // Sky-800
    textHours: '#0369a1'    // Sky-700
  },
  'Altro': {
    border: '#475569',      // Slate-600
    fillInner: '#f1f5f9',   // Slate-100
    fillOuter: '#e2e8f0',   // Slate-200
    glow: 'rgba(71, 85, 105, 0.08)',
    textName: '#1e293b',    // Slate-900
    textHours: '#334155'    // Slate-700
  }
};

export default function BubbleChart({ data = [] }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [hoveredBubble, setHoveredBubble] = useState(null);

  // Stato interno per la fisica delle bolle
  const bubblesRef = useRef([]);
  const draggedBubbleRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  // Gestione del ridimensionamento dinamico del canvas
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({
        width: Math.max(300, width),
        height: Math.max(350, height || 400)
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Inizializza o aggiorna le bolle in base ai dati in ingresso
  useEffect(() => {
    if (data.length === 0) {
      bubblesRef.current = [];
      return;
    }

    const { width, height } = dimensions;
    const centerX = width / 2;
    const centerY = height / 2;

    const maxHours = Math.max(...data.map(d => d.ore), 1);
    const minHours = Math.min(...data.map(d => d.ore));

    // Mappa le ore in raggio (tra 30px e 75px)
    const mapHoursToRadius = (ore) => {
      if (maxHours === minHours) return 42; 
      const minR = 32;
      const maxR = 75;
      return minR + ((ore - minHours) / (maxHours - minHours)) * (maxR - minR);
    };

    const existingBubbles = new Map(bubblesRef.current.map(b => [b.id, b]));

    bubblesRef.current = data.map((item) => {
      const radius = mapHoursToRadius(item.ore);
      const existing = existingBubbles.get(item.id);

      if (existing) {
        return {
          ...existing,
          nome: item.nome,
          cognome: item.cognome,
          ruolo: item.ruolo,
          ore: item.ore,
          radius: radius
        };
      } else {
        return {
          id: item.id,
          nome: item.nome,
          cognome: item.cognome,
          ruolo: item.ruolo,
          ore: item.ore,
          radius: radius,
          x: centerX + (Math.random() - 0.5) * 80,
          y: centerY + (Math.random() - 0.5) * 80,
          vx: 0,
          vy: 0
        };
      }
    });

  }, [data, dimensions]);

  // Loop di fisica e rendering Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId;
    
    const runSimulation = () => {
      const { width, height } = dimensions;
      const centerX = width / 2;
      const centerY = height / 2;
      const bubbles = bubblesRef.current;
      const draggedBubble = draggedBubbleRef.current;

      // 1. FORZE DI ATTRAZIONE AL CENTRO
      const gravity = 0.03;
      bubbles.forEach(b => {
        if (b === draggedBubble) return;
        const dx = centerX - b.x;
        const dy = centerY - b.y;
        b.vx += dx * gravity;
        b.vy += dy * gravity;
      });

      // 2. RISOLUZIONE DELLE COLLISIONI (Evita la sovrapposizione)
      for (let step = 0; step < 3; step++) {
        for (let i = 0; i < bubbles.length; i++) {
          for (let j = i + 1; j < bubbles.length; j++) {
            const b1 = bubbles[i];
            const b2 = bubbles[j];
            const dx = b2.x - b1.x;
            const dy = b2.y - b1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = b1.radius + b2.radius + 6; 

            if (dist < minDist) {
              const overlap = minDist - dist;
              const angle = dist === 0 ? Math.random() * Math.PI * 2 : Math.atan2(dy, dx);
              
              const forceX = Math.cos(angle) * overlap * 0.5;
              const forceY = Math.sin(angle) * overlap * 0.5;

              if (b1 !== draggedBubble) {
                b1.x -= forceX;
                b1.y -= forceY;
                b1.vx -= forceX * 0.2;
                b1.vy -= forceY * 0.2;
              }
              if (b2 !== draggedBubble) {
                b2.x += forceX;
                b2.y += forceY;
                b2.vx += forceX * 0.2;
                b2.vy += forceY * 0.2;
              }
            }
          }
        }
      }

      // 3. AGGIORNAMENTO POSIZIONI E ATTRITO
      const friction = 0.88;
      bubbles.forEach(b => {
        if (b === draggedBubble) {
          b.x += (mouseRef.current.x - b.x) * 0.25;
          b.y += (mouseRef.current.y - b.y) * 0.25;
          b.vx = 0;
          b.vy = 0;
        } else {
          b.vx *= friction;
          b.vy *= friction;
          b.x += b.vx;
          b.y += b.vy;
        }

        const padding = b.radius + 10;
        if (b.x < padding) { b.x = padding; b.vx *= -0.5; }
        if (b.x > width - padding) { b.x = width - padding; b.vx *= -0.5; }
        if (b.y < padding) { b.y = padding; b.vy *= -0.5; }
        if (b.y > height - padding) { b.y = height - padding; b.vy *= -0.5; }
      });

      // 4. RENDERING SUL CANVAS (Sfondo Light Mode)
      ctx.clearRect(0, 0, width, height);

      // Sfondo sfumato chiaro e pulito (White to soft gray Slate-50)
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#ffffff');
      bgGrad.addColorStop(1, '#f8fafc'); 
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Disegna una griglia chiara sullo sfondo per richiamare lo stile dei grafici
      ctx.strokeStyle = '#f1f5f9'; // Slate-100
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Disegna ciascuna bolla
      bubbles.forEach(b => {
        const colors = COLOR_MAP[b.ruolo] || COLOR_MAP['Altro'];
        const isHovered = hoveredBubble && hoveredBubble.id === b.id;

        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);

        // Effetto di bagliore (Shadow Glow)
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = isHovered ? 20 : 10;

        // Riempimento radiale sfumato per dare volume
        const bubbleGrad = ctx.createRadialGradient(b.x - b.radius * 0.15, b.y - b.radius * 0.15, 0, b.x, b.y, b.radius);
        bubbleGrad.addColorStop(0, colors.fillInner);
        bubbleGrad.addColorStop(1, colors.fillOuter);
        ctx.fillStyle = bubbleGrad;
        ctx.fill();

        // Contorno colorato
        ctx.shadowBlur = 0; 
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = isHovered ? 3.5 : 2;
        ctx.stroke();
        ctx.restore();

        // Testi (con contrasto elevato per Light Mode)
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 1. Nome
        const nameFontSize = Math.max(11, Math.floor(b.radius * 0.25));
        ctx.fillStyle = colors.textName;
        ctx.font = `bold ${nameFontSize}px system-ui, sans-serif`;
        ctx.fillText(b.nome, b.x, b.y - b.radius * 0.12);

        // 2. Ore totali
        const hoursFontSize = Math.max(9, Math.floor(b.radius * 0.19));
        ctx.fillStyle = colors.textHours;
        ctx.font = `600 ${hoursFontSize}px ui-monospace, monospace`;
        ctx.fillText(`${b.ore.toFixed(1)} h`, b.x, b.y + b.radius * 0.25);

        ctx.restore();
      });

      // Tooltip per l'elemento in Hover (Light Mode)
      if (hoveredBubble) {
        ctx.save();
        const ttW = 190;
        const ttH = 80;
        let ttX = mouseRef.current.x + 18;
        let ttY = mouseRef.current.y + 18;

        if (ttX + ttW > width) ttX = mouseRef.current.x - ttW - 18;
        if (ttY + ttH > height) ttY = mouseRef.current.y - ttH - 18;

        const colors = COLOR_MAP[hoveredBubble.ruolo] || COLOR_MAP['Altro'];

        // Box del Tooltip chiaro con bordo del colore del ruolo e ombra morbida
        ctx.fillStyle = 'rgba(255, 255, 255, 0.98)'; 
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1.5;
        
        ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
        ctx.shadowBlur = 10;

        drawRoundedRect(ctx, ttX, ttY, ttW, ttH, 12);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.stroke();

        // Nome Completo
        ctx.fillStyle = '#0f172a'; // Slate-900
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText(`${hoveredBubble.nome} ${hoveredBubble.cognome}`, ttX + 14, ttY + 22);

        // Ruolo
        ctx.fillStyle = '#475569'; // Slate-600
        ctx.font = '500 11px system-ui, sans-serif';
        ctx.fillText(hoveredBubble.ruolo, ttX + 14, ttY + 41);

        // Ore Totali
        ctx.fillStyle = colors.border;
        ctx.font = 'bold 12px ui-monospace, monospace';
        ctx.fillText(`Presenza: ${hoveredBubble.ore.toFixed(1)} ore`, ttX + 14, ttY + 60);

        ctx.restore();
      }

      animationId = requestAnimationFrame(runSimulation);
    };

    animationId = requestAnimationFrame(runSimulation);
    return () => cancelAnimationFrame(animationId);
  }, [dimensions, hoveredBubble]);

  const drawRoundedRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (dimensions.width / rect.width),
      y: (e.clientY - rect.top) * (dimensions.height / rect.height)
    };
  };

  const handleMouseMove = (e) => {
    const pos = getMousePos(e);
    mouseRef.current = pos;

    if (draggedBubbleRef.current) return;

    let found = null;
    const bubbles = bubblesRef.current;
    
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      const dx = pos.x - b.x;
      const dy = pos.y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < b.radius) {
        found = b;
        break;
      }
    }
    setHoveredBubble(found);
  };

  const handleMouseDown = (e) => {
    const pos = getMousePos(e);
    if (hoveredBubble) {
      draggedBubbleRef.current = hoveredBubble;
    }
  };

  const handleMouseUpOrLeave = () => {
    draggedBubbleRef.current = null;
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 w-full flex flex-col mt-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Presenza Individuale Operatori</h3>
          <p className="text-sm text-gray-500 mt-1">Bolle interattive con raggio basato sulle ore totali lavorate</p>
        </div>
        
        {/* Legenda dei Ruoli */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold select-none">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#d97706] inline-block"></span>
            <span className="text-gray-600">Responsabili</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#db2777] inline-block"></span>
            <span className="text-gray-600">Animatori</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7] inline-block"></span>
            <span className="text-gray-600">Aiuto-Animatori</span>
          </div>
        </div>
      </div>
      
      {/* Canvas Container */}
      <div ref={containerRef} className="flex-1 w-full relative min-h-[380px] bg-slate-50 border border-slate-100 rounded-xl overflow-hidden">
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className="block w-full h-full cursor-grab active:cursor-grabbing select-none"
        />
      </div>
    </div>
  );
}
