import { useEffect, useState } from 'react';

export function WindowTitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const platform = window.electronAPI.app.getPlatform();

  useEffect(() => {
    window.electronAPI.window.isMaximized().then(setIsMaximized);
    return window.electronAPI.window.onStateChange((state) => {
      setIsMaximized(state.isMaximized);
    });
  }, []);

  if (platform === 'darwin') {
    return (
      <div
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          WebkitAppRegion: 'drag',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>ArcCode</span>
      </div>
    );
  }

  const controlStyle: React.CSSProperties = {
    width: 46,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    WebkitAppRegion: 'no-drag',
  };

  return (
    <div
      style={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        WebkitAppRegion: 'drag',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, paddingLeft: 12 }}>
        <img src="assets://icon.ico" alt="" width="14" height="14" style={{ display: 'block', flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>ArcCode</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch', marginLeft: 'auto', WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={() => window.electronAPI.window.minimize()}
          title="Minimize"
          style={controlStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M1 5h8" />
          </svg>
        </button>
        <button
          onClick={() => isMaximized ? window.electronAPI.window.unmaximize() : window.electronAPI.window.maximize()}
          title={isMaximized ? 'Restore' : 'Maximize'}
          style={controlStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M2 3h5v5H2z" />
              <path d="M3 2h5v5" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="1.5" y="1.5" width="7" height="7" />
            </svg>
          )}
        </button>
        <button
          onClick={() => window.electronAPI.window.close()}
          title="Close"
          style={controlStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#c42b1c'; e.currentTarget.style.color = '#ffffff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M2 2l6 6M8 2L2 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
