/*
  Processing-style Interactive Map (JS Canvas Edition)
  -----------------------------------------------------
  This file ports your Processing workflow to browser JavaScript:
  - zoom / pan
  - hover preview
  - click to select
  - river + soft basin background + info panel

  Beginner tip:
  We keep a fixed 'world' coordinate system (1200x800),
  then convert to canvas pixels using scale + offset.
*/
(function () {
    const host = document.getElementById('interactiveMap');
    if (!host) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    host.appendChild(canvas);

    const WORLD_W = 1200;
    const WORLD_H = 800;

    // Interaction states
    let zoomScale = 1.0;
    let offsetX = 0;
    let offsetY = 0;

    let dragging = false;
    let movedWhileDrag = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    let hoveredNode = null;
    let selectedNode = null;
    let frameCount = 0;

    // River polyline (your Processing coordinates)
    const river = [
        { x: 160, y: 530 }, { x: 220, y: 500 }, { x: 290, y: 470 },
        { x: 360, y: 450 }, { x: 430, y: 430 }, { x: 510, y: 420 },
        { x: 590, y: 410 }, { x: 670, y: 400 }, { x: 740, y: 385 },
        { x: 810, y: 365 }, { x: 885, y: 340 }, { x: 960, y: 320 },
        { x: 1040, y: 300 }, { x: 1110, y: 280 }
    ];

    // Node data (English labels requested)
    const nodes = [
        {
            name: 'Chongqing', x: 380, y: 442,
            category: 'Upper Yangtze',
            description: 'A major inland city and one of the key upstream centres of the Yangtze corridor.',
            isTemple: false
        },
        {
            name: 'Xiluodu Dam', x: 515, y: 418,
            category: 'Hydropower Landmark',
            description: 'A major dam in the upper reaches of the Jinsha / Yangtze system.',
            isTemple: false
        },
        {
            name: 'Three Gorges Dam', x: 760, y: 375,
            category: 'Hydropower Landmark',
            description: 'One of the world\'s best-known hydropower engineering projects.',
            isTemple: false
        },
        {
            name: 'Yichang', x: 830, y: 362,
            category: 'Gateway City',
            description: 'A strategic city near the Three Gorges region and the middle Yangtze.',
            isTemple: false
        },
        {
            name: 'Wuhan', x: 955, y: 325,
            category: 'Middle Yangtze Metropolis',
            description: 'A major urban and transport hub on the middle reaches of the Yangtze.',
            isTemple: false
        },
        {
            name: 'Nanjing', x: 1090, y: 285,
            category: 'Dabao\'en Temple',
            description: 'Nanjing is the historic location connected with the Bao\'en Temple and its famous pagoda.',
            isTemple: true
        },
        {
            name: 'Shanghai', x: 1160, y: 225,
            category: 'River Mouth / Coast',
            description: 'The Yangtze reaches the East China Sea through the Shanghai region.',
            isTemple: false
        }
    ];

    function resizeCanvas() {
        const rect = host.getBoundingClientRect();
        const w = Math.max(760, Math.floor(rect.width));
        const h = Math.floor(w * (WORLD_H / WORLD_W));
        canvas.width = w;
        canvas.height = h;

        // First-time fit: center world slightly for better composition
        if (offsetX === 0 && offsetY === 0 && zoomScale === 1) {
            offsetX = canvas.width * 0.03;
            offsetY = canvas.height * 0.02;
        }
    }

    // Coordinate helpers
    function worldToScreenX(x) { return x * zoomScale + offsetX; }
    function worldToScreenY(y) { return y * zoomScale + offsetY; }
    function screenToWorldX(x) { return (x - offsetX) / zoomScale; }
    function screenToWorldY(y) { return (y - offsetY) / zoomScale; }

    function drawBackground() {
        // soft sky-like gradient background
        const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
        g.addColorStop(0, 'rgb(242,247,250)');
        g.addColorStop(1, 'rgb(232,240,246)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // subtle horizontal mist bands (similar to your Processing loop)
        for (let i = 0; i < canvas.height; i += 2) {
            const t = i / canvas.height;
            const r = Math.round(240 - 8 * t);
            const gg = Math.round(246 - 6 * t);
            const b = Math.round(250 - 2 * t);
            ctx.fillStyle = `rgba(${r},${gg},${b},0.12)`;
            ctx.fillRect(0, i, canvas.width, 2);
        }
    }

    function drawSoftRegion() {
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(zoomScale, zoomScale);

        ctx.beginPath();
        ctx.moveTo(90, 620);
        ctx.bezierCurveTo(180, 560, 260, 530, 330, 520);
        ctx.bezierCurveTo(450, 500, 530, 500, 630, 470);
        ctx.bezierCurveTo(760, 430, 860, 410, 960, 350);
        ctx.bezierCurveTo(1040, 300, 1120, 260, 1190, 220);
        ctx.lineTo(1190, 470);
        ctx.bezierCurveTo(1090, 500, 1000, 520, 920, 545);
        ctx.bezierCurveTo(790, 575, 680, 595, 530, 620);
        ctx.bezierCurveTo(390, 640, 230, 650, 90, 620);
        ctx.closePath();
        ctx.fillStyle = 'rgba(220,232,238,0.55)';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(130, 580);
        ctx.bezierCurveTo(250, 530, 420, 500, 580, 475);
        ctx.bezierCurveTo(760, 450, 920, 370, 1110, 255);
        ctx.lineTo(1160, 320);
        ctx.bezierCurveTo(1010, 405, 820, 485, 620, 530);
        ctx.bezierCurveTo(430, 575, 250, 600, 130, 580);
        ctx.closePath();
        ctx.fillStyle = 'rgba(210,225,232,0.35)';
        ctx.fill();

        ctx.restore();
    }

    // Draw smooth-ish river using quadratic segments
    function drawPath(points, strokeStyle, lineWidth) {
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(zoomScale, zoomScale);

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
            const xc = (points[i].x + points[i + 1].x) / 2;
            const yc = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        const last = points[points.length - 1];
        ctx.lineTo(last.x, last.y);

        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
    }

    function drawRiver() {
        // Glow -> main -> highlight
        drawPath(river, 'rgba(126,199,230,0.32)', 18 * zoomScale);
        drawPath(river, 'rgb(70,156,210)', 6 * zoomScale);
        drawPath(river, 'rgba(180,226,245,0.75)', 2 * zoomScale);

        // Labels stay screen-space for readability
        ctx.fillStyle = 'rgba(70,156,210,0.95)';
        ctx.font = 'italic 700 28px Arial';
        ctx.fillText('Yangtze River Basin', worldToScreenX(450), worldToScreenY(525));
        ctx.font = 'italic 700 24px Arial';
        ctx.fillText('Yangtze River', worldToScreenX(735), worldToScreenY(455));
    }

    function nearestRiverPoint(x, y) {
        let best = river[0];
        let bestDist = Infinity;
        for (const p of river) {
            const d = Math.hypot(x - p.x, y - p.y);
            if (d < bestDist) {
                bestDist = d;
                best = p;
            }
        }
        return best;
    }

    function drawConnections() {
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(zoomScale, zoomScale);

        for (const n of nodes) {
            const rp = nearestRiverPoint(n.x, n.y);
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(rp.x, rp.y);
            ctx.strokeStyle = 'rgba(120,140,160,0.45)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        ctx.restore();
    }

    function isMouseOverNode(node, mx, my) {
        const sx = worldToScreenX(node.x);
        const sy = worldToScreenY(node.y);
        return Math.hypot(mx - sx, my - sy) < 14;
    }

    function getNodeUnderMouse(mx, my) {
        for (const n of nodes) {
            if (isMouseOverNode(n, mx, my)) return n;
        }
        return null;
    }

    function drawTooltip(node) {
        const sx = worldToScreenX(node.x);
        const sy = worldToScreenY(node.y);
        const tip = node.isTemple ? 'Dabao\'en Temple site' : node.category;

        ctx.font = '13px Arial';
        const tw = ctx.measureText(tip).width + 24;
        const th = 30;
        const tx = sx + 18;
        const ty = sy - 46;

        ctx.fillStyle = 'rgba(30,42,56,0.9)';
        roundRect(tx, ty, tw, th, 12, true, false);

        ctx.fillStyle = '#fff';
        ctx.fillText(tip, tx + 12, ty + 19);
    }

    function drawNodes() {
        for (const n of nodes) {
            const sx = worldToScreenX(n.x);
            const sy = worldToScreenY(n.y);
            const pulse = 1 + 0.12 * Math.sin(frameCount * 0.07);
            const isHovered = hoveredNode === n;
            const isSelected = selectedNode === n;

            // halo
            ctx.fillStyle = n.isTemple ? 'rgba(60,145,220,0.2)' : 'rgba(80,110,130,0.16)';
            ctx.beginPath();
            ctx.arc(sx, sy, 17 * pulse, 0, Math.PI * 2);
            ctx.fill();

            if (isHovered || isSelected) {
                ctx.fillStyle = n.isTemple ? 'rgba(60,145,220,0.38)' : 'rgba(120,150,170,0.30)';
                ctx.beginPath();
                ctx.arc(sx, sy, 24 * pulse, 0, Math.PI * 2);
                ctx.fill();
            }

            // core node
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.fillStyle = n.isTemple ? 'rgb(35,120,205)' : 'rgb(56,68,84)';
            ctx.beginPath();
            ctx.arc(sx, sy, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // temple ring
            if (n.isTemple) {
                ctx.strokeStyle = 'rgba(35,120,205,0.6)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(sx, sy, 12, 0, Math.PI * 2);
                ctx.stroke();
            }

            // label
            ctx.fillStyle = 'rgb(48,62,80)';
            ctx.font = n.isTemple ? '700 18px Arial' : '600 16px Arial';
            ctx.fillText(n.name, sx + 14, sy + 5);

            if (isHovered) drawTooltip(n);
        }
    }

    function drawTitle() {
        ctx.fillStyle = 'rgb(38,56,74)';
        ctx.font = '700 30px Arial';
        ctx.fillText('Yangtze River Interactive Map', 26, 38);

        ctx.fillStyle = 'rgb(95,115,135)';
        ctx.font = '15px Arial';
        ctx.fillText('Stylised JS version for the Dabao\'en Temple website', 26, 66);
    }

    function drawInstructions() {
        ctx.fillStyle = 'rgba(90,110,130,0.9)';
        ctx.font = '13px Arial';
        const msg = 'Hover: preview   Click: open card   Drag: move   Mouse wheel: zoom';
        const w = ctx.measureText(msg).width;
        ctx.fillText(msg, canvas.width - w - 26, 34);
    }

    function drawInfoPanel() {
        const shown = selectedNode || hoveredNode;
        if (!shown) return;

        const panelW = Math.min(500, canvas.width - 40);
        const panelH = 160;
        const x = 20;
        const y = canvas.height - panelH - 20;

        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        roundRect(x + 8, y + 8, panelW, panelH, 18, true, false);

        // panel body
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        roundRect(x, y, panelW, panelH, 18, true, false);

        // left accent
        ctx.fillStyle = shown.isTemple ? 'rgb(40,125,205)' : 'rgb(110,145,170)';
        roundRect(x, y, 10, panelH, 12, true, false);

        ctx.fillStyle = 'rgb(40,56,75)';
        ctx.font = '700 26px Arial';
        ctx.fillText(shown.name, x + 24, y + 36);

        ctx.fillStyle = 'rgb(70,130,180)';
        ctx.font = '700 14px Arial';
        ctx.fillText(shown.category, x + 24, y + 58);

        ctx.fillStyle = 'rgb(75,90,105)';
        ctx.font = '16px Arial';
        wrapText(shown.description, x + 24, y + 84, panelW - 48, 22);

        if (selectedNode) {
            ctx.fillStyle = 'rgb(120,135,150)';
            ctx.font = '12px Arial';
            const msg = 'Click empty area to clear selection';
            const w = ctx.measureText(msg).width;
            ctx.fillText(msg, x + panelW - w - 14, y + 20);
        }
    }

    // Helper: rounded rectangle
    function roundRect(x, y, w, h, r, fill, stroke) {
        const rr = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + w, y, x + w, y + h, rr);
        ctx.arcTo(x + w, y + h, x, y + h, rr);
        ctx.arcTo(x, y + h, x, y, rr);
        ctx.arcTo(x, y, x + w, y, rr);
        ctx.closePath();
        if (fill) ctx.fill();
        if (stroke) ctx.stroke();
    }

    // Helper: multiline text in info panel
    function wrapText(text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let yy = y;
        for (let i = 0; i < words.length; i++) {
            const test = line + words[i] + ' ';
            if (ctx.measureText(test).width > maxWidth && i > 0) {
                ctx.fillText(line, x, yy);
                line = words[i] + ' ';
                yy += lineHeight;
            } else {
                line = test;
            }
        }
        ctx.fillText(line, x, yy);
    }

    function drawFrame() {
        frameCount += 1;
        drawBackground();
        drawSoftRegion();
        drawRiver();
        drawConnections();
        drawNodes();
        drawTitle();
        drawInstructions();
        drawInfoPanel();
        requestAnimationFrame(drawFrame);
    }

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        if (dragging) {
            const dx = mx - lastMouseX;
            const dy = my - lastMouseY;
            offsetX += dx;
            offsetY += dy;
            lastMouseX = mx;
            lastMouseY = my;
            movedWhileDrag = true;
        } else {
            hoveredNode = getNodeUnderMouse(mx, my);
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        lastMouseX = e.clientX - rect.left;
        lastMouseY = e.clientY - rect.top;
        dragging = true;
        movedWhileDrag = false;
    });

    window.addEventListener('mouseup', (e) => {
        if (!dragging) return;

        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        if (!movedWhileDrag) {
            const clicked = getNodeUnderMouse(mx, my);
            selectedNode = clicked || null;
        }
        dragging = false;
    });

    // Zoom around cursor position (same idea as Processing version)
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const worldXBefore = screenToWorldX(mx);
        const worldYBefore = screenToWorldY(my);

        const zoomFactor = 1 - Math.sign(e.deltaY) * 0.06;
        zoomScale *= zoomFactor;
        zoomScale = Math.max(0.65, Math.min(2.4, zoomScale));

        offsetX = mx - worldXBefore * zoomScale;
        offsetY = my - worldYBefore * zoomScale;
    }, { passive: false });

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    requestAnimationFrame(drawFrame);
})();
