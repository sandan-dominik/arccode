import type { LayoutType } from '../types';

interface LayoutSelectorProps {
  layout: LayoutType;
  onChange: (layout: LayoutType) => void;
}

const LAYOUTS: { type: LayoutType; label: string; icon: string }[] = [
  { type: 'single', label: 'Single', icon: '[ ]' },
  { type: 'hsplit', label: 'Horizontal Split', icon: '[-]' },
  { type: 'vsplit', label: 'Vertical Split', icon: '[|]' },
  { type: 'three', label: '3 Pane', icon: '[+|]' },
  { type: 'grid', label: '2x2 Grid', icon: '[#]' },
];

export function LayoutSelector({ layout, onChange }: LayoutSelectorProps) {
  return (
    <div style={{
      display: 'flex',
      gap: 4,
      padding: '4px 8px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
    }}>
      {LAYOUTS.map(({ type, label, icon }) => (
        <button
          key={type}
          title={label}
          onClick={() => onChange(type)}
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 12,
            fontFamily: 'monospace',
            background: layout === type ? 'var(--accent)' : 'var(--bg-surface)',
            color: layout === type ? 'var(--accent-text)' : 'var(--text-secondary)',
          }}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
