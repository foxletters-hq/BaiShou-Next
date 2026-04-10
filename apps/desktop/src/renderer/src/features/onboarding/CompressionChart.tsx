import React, { useEffect, useRef } from 'react';

export const CompressionChart: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let time = 0;

        const render = () => {
            time += 0.05;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const width = canvas.width;
            const height = canvas.height;
            const centerY = height / 2;

            // Draw Original Line (Top)
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
            ctx.lineWidth = 2;
            for (let x = 0; x < width; x++) {
                const y = 30 + Math.sin(x * 0.05 + time) * 10;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Draw Compression Curves
            const drawWave = (offset: number, color: string, amplitude: number, speed: number) => {
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                for (let x = 0; x < width; x++) {
                    const y = centerY + offset + Math.sin(x * 0.02 + time * speed) * amplitude;
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            };

            // Blue wave (Soul/Intelligence)
            drawWave(0, '#5BA8F5', 15, 0.8);
            // Lighter blue (Echo/Memory)
            drawWave(10, 'rgba(91, 168, 245, 0.4)', 12, 0.5);

            // Draw "Compressed" Points
            for (let i = 0; i < 5; i++) {
                const x = (width / 6) * (i + 1);
                const y = centerY + Math.sin(x * 0.02 + time * 0.8) * 15;
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#5BA8F5';
                ctx.fill();
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#5BA8F5';
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    return (
        <canvas 
            ref={canvasRef} 
            width={400} 
            height={200} 
            style={{ width: '100%', height: '100%', borderRadius: '12px' }} 
        />
    );
};
