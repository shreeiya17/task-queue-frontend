import React from 'react';

const colorScheme = {
  waiting:   { bg: '#FFF8ED', text: '#B45309', border: '#F59E0B' },
  active:    { bg: '#EFF6FF', text: '#1D4ED8', border: '#3B82F6' },
  completed: { bg: '#F0FDF4', text: '#15803D', border: '#22C55E' },
  failed:    { bg: '#FEF2F2', text: '#B91C1C', border: '#EF4444' },
  delayed:   { bg: '#F5F3FF', text: '#6D28D9', border: '#8B5CF6' },
  dead:      { bg: '#FFF1F2', text: '#BE123C', border: '#FB7185' },
};

export function StatsCard({ label, value, color, sub, onClick, active }) {
  const c = colorScheme[color] || colorScheme.waiting;
  
  return (
    <div 
      onClick={onClick} 
      style={{
        background: '#fff',
        border: `2px solid ${active ? c.border : '#E5E7EB'}`,
        borderRadius: 12,
        padding: '14px 18px',
        flex: 1,
        minWidth: 110,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color .15s',
        boxShadow: active ? `0 0 0 3px ${c.border}22` : 'none',
      }}
    >
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: active ? c.text : '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 6
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 30,
        fontWeight: 700,
        color: c.text,
        lineHeight: 1
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10,
        color: '#9CA3AF',
        marginTop: 5
      }}>
        {sub}
      </div>
    </div>
  );
}
