"use client";

import * as React from "react";
import QRCodeLib from "qrcode";
import { cn } from "@/lib/utils";

export interface QRCodeProps extends React.SVGProps<SVGSVGElement> {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
}

/** Dotted modules with rounded finder eyes. The four-module quiet zone is intentional. */
export function QRCode({ value, size = 268, fgColor = "var(--foreground)", bgColor = "var(--background)", errorCorrectionLevel = "M", className, ...props }: QRCodeProps) {
  const qr = React.useMemo(() => {
    try { return QRCodeLib.create(value, { errorCorrectionLevel }); }
    catch { return null; }
  }, [value, errorCorrectionLevel]);
  if (!qr) return null;
  const count = qr.modules.size;
  const extent = count + 8;
  // Small/dense codes need fuller dots to survive rasterization and camera sampling.
  const dotRadius = size / extent < 6 ? 0.5 : 1 / 3;
  const finders = [[0, 0], [0, count - 7], [count - 7, 0]];
  const dots: React.ReactNode[] = [];
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      const finder = (row < 7 && col < 7) || (row < 7 && col >= count - 7) || (row >= count - 7 && col < 7);
      if (!finder && qr.modules.get(row, col)) {
        // Keep timing/alignment metadata solid so dense invites remain decodable.
        dots.push(qr.modules.isReserved(row, col)
          ? <rect key={`${row}-${col}`} x={col + 4} y={row + 4} width="1" height="1" fill={fgColor}/>
          : <circle key={`${row}-${col}`} cx={col + 4.5} cy={row + 4.5} r={dotRadius} fill={fgColor}/>);
      }
    }
  }
  return <svg width={size} height={size} viewBox={`0 0 ${extent} ${extent}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="QR code" className={cn("block", className)} {...props}>
    <rect width={extent} height={extent} fill={bgColor}/>
    {finders.map(([row, col]) => <g key={`${row}-${col}`} transform={`translate(${col + 4} ${row + 4})`}>
      <rect width="7" height="7" rx="1.5" fill={fgColor}/>
      <rect x="1" y="1" width="5" height="5" rx="1" fill={bgColor}/>
      <rect x="2" y="2" width="3" height="3" rx=".4" fill={fgColor}/>
    </g>)}
    {dots}
  </svg>;
}
