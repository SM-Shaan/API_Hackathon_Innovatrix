'use client';

import React from 'react';
import { ArrowRight, ArrowDown, ArrowUp } from 'lucide-react';

interface FlowArrowProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  active?: boolean;
  type?: 'request' | 'response' | 'event';
  label?: string;
}

export function FlowArrow({ from, to, active = false, type = 'request', label }: FlowArrowProps) {
  // Calculate arrow position and direction
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  
  // Position arrow in the middle of the path
  const midX = from.x + deltaX / 2;
  const midY = from.y + deltaY / 2;

  const getArrowColor = () => {
    if (!active) return 'text-gray-300';
    
    switch (type) {
      case 'request':
        return 'text-primary-500';
      case 'response':
        return 'text-success-500';
      case 'event':
        return 'text-purple-500';
      default:
        return 'text-primary-500';
    }
  };

  const getArrowIcon = () => {
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? ArrowRight : ArrowRight;
    } else {
      return deltaY > 0 ? ArrowDown : ArrowUp;
    }
  };

  const ArrowIcon = getArrowIcon();

  return (
    <div className="absolute pointer-events-none">
      {/* SVG Line */}
      <svg
        className="absolute top-0 left-0"
        style={{
          width: Math.abs(deltaX) + 40,
          height: Math.abs(deltaY) + 40,
          left: Math.min(from.x, to.x) - 20,
          top: Math.min(from.y, to.y) - 20,
        }}
      >
        <defs>
          <marker
            id={`arrowhead-${type}`}
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill={active ? (type === 'request' ? '#3b82f6' : type === 'response' ? '#22c55e' : '#a855f7') : '#d1d5db'}
            />
          </marker>
        </defs>
        
        <line
          x1={from.x < to.x ? 20 : Math.abs(deltaX) + 20}
          y1={from.y < to.y ? 20 : Math.abs(deltaY) + 20}
          x2={to.x < from.x ? 20 : Math.abs(deltaX) + 20}
          y2={to.y < from.y ? 20 : Math.abs(deltaY) + 20}
          stroke={active ? (type === 'request' ? '#3b82f6' : type === 'response' ? '#22c55e' : '#a855f7') : '#d1d5db'}
          strokeWidth={active ? '2' : '1'}
          strokeDasharray={type === 'event' ? '5,5' : 'none'}
          markerEnd={`url(#arrowhead-${type})`}
          className={active ? 'animate-pulse' : ''}
        />
      </svg>

      {/* Arrow Icon */}
      <div
        className={`absolute ${getArrowColor()} ${active ? 'animate-flow' : ''}`}
        style={{
          left: midX - 12,
          top: midY - 12,
          transform: `rotate(${angle}deg)`,
        }}
      >
        <ArrowIcon className="w-6 h-6" />
      </div>

      {/* Label */}
      {label && active && (
        <div
          className="absolute bg-white px-2 py-1 text-xs border rounded shadow-sm"
          style={{
            left: midX - 30,
            top: midY + 15,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}