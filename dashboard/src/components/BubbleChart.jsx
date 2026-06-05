import React, { useRef, useEffect, useState } from 'react';

// Color map per i ruoli
const COLOR_MAP = {
  'Responsabile': {
    border: '#fbbf24', // Giallo/Ambra
    fillInner: 'rgba(251, 191, 36, 0.4)',
    fillOuter: 'rgba(120, 53, 15, 0.15)',
    glow: 'rgba(251, 191, 36, 0.3)',
    textHours: '#fde047'
  },
  'Animatore': {
    border: '#ec4899', // Rosa
    fillInner: 'rgba(236, 72, 153, 0.4)',
    fillOuter: 'rgba(80, 7, 36, 0.15)',
    glow: 'rgba(236, 72, 153, 0.3)',
    textHours: '#fbcfe8'
  },
  'Aiuto-Animatore': {
    border: '#06b6d4', // Azzurro/Ciano
    fillInner: 'rgba(6, 182, 212, 0.4)',
    fillOuter: 'rgba(8, 51, 68, 0.15)',
    glow: 'rgba(6, 182, 212, 0.3)',
    textHours: '#cffafe'
  },
  'Altro': {
    border: '#94a3b8', // Grigio/Ardesia
    fillInner: 'rgba(148, 163, 184, 0.4)',
    fillOuter: 'rgba(15, 23, 42, 0.15)',
    glow: 'rgba(148, 163, 184, 0.2)',
    textHours: '#f1f5f9'
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
      // Imposta un'altezza minima ragionevole
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
      if (maxHours === minHours) return 42; // Raggio uniforme se tutti hanno le stesse ore
      const minR = 32;
      const maxR = 75;
      return minR + ((ore - minHours) / (maxHours - minHours)) * (maxR - minR);
    };

    // Mantieni le bolle esistenti per continuità visiva (senza riazzerare la fisica ad ogni render)
    const existingBubbles = new Map(bubblesRef.current.map(b => [b.id, b]));

    bubblesRef.current = data.map((item) => {
      const radius = mapHoursToRadius(item.ore);
      const existing = existingBubbles.get(item.id);

      if (existing) {
        // Aggiorna solo raggio e info, conserva posizione e velocità
        return {
          ...existing,
          nome: item.nome,
          cognome: item.cognome,
          ruolo: item.ruolo,
          ore: item.ore,
          radius: radius
        };
      } else {
        // Nuova bolla: posizionala al centro con una leggera perturbazione casuale
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

      // 1. FORZE DI ATTRAZIONE AL CENTRO (Gravità)
      const gravity = 0.03;
      bubbles.forEach(b => {
        if (b === draggedBubble) return;
        const dx = centerX - b.x;
        const dy = centerY - b.y;
        b.vx += dx * gravity;
        b.vy += dy * gravity;
      });

      // 2. RISOLUZIONE DELLE COLLISIONI (Evita la sovrapposizione)
      // Esegui 3 passaggi per un'approssimazione solida
      for (let step = 0; step < 3; step++) {
        for (let i = 0; i < bubbles.length; i++) {
          for (let j = i + 1; j < bubbles.length; j++) {
            const b1 = bubbles[i];
            const b2 = bubbles[j];
            const dx = b2.x - b1.x;
            const dy = b2.y - b1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = b1.radius + b2.radius + 6; // Spaziatura di 6px tra le bolle

            if (dist < minDist) {
              const overlap = minDist - dist;
              // Direzione della repulsione (gestisce centri identici)
              const angle = dist === 0 ? Math.random() * Math.PI * 2 : Math.atan2(dy, dx);
              
              const forceX = Math.cos(angle) * overlap * 0.5;
              const forceY = Math.sin(angle) * overlap * 0.5;

              // Sposta le bolle in base allo stato del drag
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
      const friction = 0.88; // Rallentamento progressivo delle bolle
      bubbles.forEach(b => {
        if (b === draggedBubble) {
          // Segui il mouse in modo fluido (damping)
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

        // Limiti del Canvas (Collisioni con i bordi)
        const padding = b.radius + 10;
        if (b.x < padding) { b.x = padding; b.vx *= -0.5; }
        if (b.x > width - padding) { b.x = width - padding; b.vx *= -0.5; }
        if (b.y < padding) { b.y = padding; b.vy *= -0.5; }
        if (b.y > height - padding) { b.y = height - padding; b.vy *= -0.5; }
      });

      // 4. RENDERING SUL CANVAS
      ctx.clearRect(0, 0, width, height);

      // Sfondo sfumato scuro premium (Slate-900 / Slate-800)
      const bgGrad = ctx.createRadialGradient(centerX, centerY, 50, centerX, centerY, Math.max(width, height));
      bgGrad.addColorStop(0, '#1e293b'); // bg-slate-800
      bgGrad.addColorStop(1, '#0f172a'); // bg-slate-900
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Disegna una leggera griglia tecnologica sullo sfondo (effetto premium)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
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
        ctx.shadowBlur = isHovered ? 22 : 12;

        // Riempimento radiale sfumato per dare volume sferico
        const bubbleGrad = ctx.createRadialGradient(b.x - b.radius * 0.15, b.y - b.radius * 0.15, 0, b.x, b.y, b.radius);
        bubbleGrad.addColorStop(0, colors.fillInner);
        bubbleGrad.addColorStop(1, colors.fillOuter);
        ctx.fillStyle = bubbleGrad;
        ctx.fill();

        // Contorno colorato
        ctx.shadowBlur = 0; // Disattiva ombra per i dettagli del bordo
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = isHovered ? 3.5 : 2;
        ctx.stroke();
        ctx.restore();

        // Scrittura testi all'interno della bolla
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 1. Iniziali o Nome
        const nameFontSize = Math.max(11, Math.floor(b.radius * 0.25));
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${nameFontSize}px system-ui, sans-serif`;
        // Disegna leggermente in alto se ci sono le ore sotto
        ctx.fillText(b.nome, b.x, b.y - b.radius * 0.12);

        // 2. Ore totali
        const hoursFontSize = Math.max(9, Math.floor(b.radius * 0.19));
        ctx.fillStyle = colors.textHours;
        ctx.font = `500 ${hoursFontSize}px ui-monospace, monospace`;
        ctx.fillText(`${b.ore.toFixed(1)} h`, b.x, b.y + b.radius * 0.25);

        ctx.restore();
      });

      // Disegna il Tooltip per l'elemento in Hover
      if (hoveredBubble) {
        ctx.save();
        const ttW = 190;
        const ttH = 80;
        let ttX = mouseRef.current.x + 18;
        let ttY = mouseRef.current.y + 18;

        // Limita il tooltip all'interno dei bordi del canvas
        if (ttX + ttW > width) ttX = mouseRef.current.x - ttW - 18;
        if (ttY + ttH > height) ttY = mouseRef.current.y - ttH - 18;

        const colors = COLOR_MAP[hoveredBubble.ruolo] || COLOR_MAP['Altro'];

        // Box del Tooltip sfocato e semitrasparente
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'; // Deep Slate
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1.5;
        
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 10;

        // Disegna rettangolo arrotondato
        drawRoundedRect(ctx, ttX, ttY, ttW, ttH, 12);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.stroke();

        // Nome Completo
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText(`${hoveredBubble.nome} ${hoveredBubble.cognome}`, ttX + 14, ttY + 22);

        // Ruolo
        ctx.fillStyle = '#94a3b8'; // Slate 400
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

  // Utility per rettangoli arrotondati
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

  // Rilevamento coordinate mouse relative al Canvas
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

    // Cerca se il mouse si trova sopra una bolla
    let found = null;
    const bubbles = bubblesRef.current;
    
    // Controlla a ritroso per rilevare prima le bolle disegnate in primo piano
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
      // Aggancia la bolla per il trascinamento
      draggedBubbleRef.current = hoveredBubble;
    }
  };

  const handleMouseUpOrLeave = () => {
    draggedBubbleRef.current = null;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl w-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
        <div>
          <h4 className="font-bold text-slate-100">Presenza Individuale Operatori</h4>
          <p className="text-xs text-slate-500 mt-0.5">Bolle interattive con raggio basato sulle ore totali lavorate</p>
        </div>
        
        {/* Legenda dei Ruoli */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold select-none">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24] border border-[#fbbf24]/50 shadow-[0_0_8px_#fbbf24] inline-block"></span>
            <span className="text-[#fbbf24]">Responsabili</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ec4899] border border-[#ec4899]/50 shadow-[0_0_8px_#ec4899] inline-block"></span>
            <span className="text-[#ec4899]">Animatori</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4] border border-[#06b6d4]/50 shadow-[0_0_8px_#06b6d4] inline-block"></span>
            <span className="text-[#06b6d4]">Aiuto-Animatori</span>
          </div>
        </div>
      </div>
      
      {/* Container di avvolgimento per ResizeObserver */}
      <div ref={containerRef} className="flex-1 w-full relative min-h-[380px] bg-slate-950">
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
