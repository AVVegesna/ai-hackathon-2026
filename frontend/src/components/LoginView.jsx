import React, { useState } from 'react';

export default function LoginView({ onLogin, error }) {
  const [username, setUsername] = useState('mokafor');
  const [password, setPassword] = useState('demo123');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onLogin({ username, password });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 'var(--space-5)' }}>
      <div className="blueprint" style={{ width: '100%', maxWidth: '460px', padding: 'var(--space-4)', position: 'relative' }}>
        <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>

        <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.55 }}>Fisheries monitoring portal</div>
        <h1 style={{ margin: '8px 0 18px', fontSize: '32px', lineHeight: 1 }}>Sign in</h1>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <label style={{ display: 'grid', gap: '6px', fontSize: '12px' }}>
            Username
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              required
            />
          </label>

          <label style={{ display: 'grid', gap: '6px', fontSize: '12px' }}>
            Password
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </label>

          {error && <div className="error">{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop: 'var(--space-4)', fontSize: '12px', opacity: 0.7 }}>
          Demo accounts: <strong>mokafor / demo123</strong> and <strong>jtaumata / demo123</strong>
        </div>
      </div>
    </div>
  );
}
