import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import styles from './Auth.module.css';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      return setError('Las contraseñas no coinciden');
    }
    setLoading(true);
    try {
      await api.auth.register({ name: form.name, email: form.email, password: form.password });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.successIcon}>✓</div>
          <h2 className={styles.title}>Solicitud enviada</h2>
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
            Un administrador revisará tu solicitud y te dará acceso pronto.
          </p>
          <p className={styles.footer} style={{ marginTop: '1.5rem' }}>
            <Link to="/app/login">← Volver al login</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <img src="/images/logopic/step_logo.png" alt="STEP Lab" onError={e => e.target.style.display='none'} />
          <h1>STEP Lab</h1>
        </div>

        <h2 className={styles.title}>Solicitar acceso</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center', marginBottom: '1rem' }}>
          Un administrador debe aprobar tu solicitud antes de que puedas ingresar.
        </p>

        {error && <p className={styles.error}>{error}</p>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <label>
            Nombre completo
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              autoFocus
            />
          </label>
          <label>
            Email institucional
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
              minLength={8}
            />
          </label>
          <label>
            Confirmar contraseña
            <input
              type="password"
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              required
            />
          </label>
          <button type="submit" disabled={loading} className={styles.btn}>
            {loading ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </form>

        <p className={styles.footer}>
          ¿Ya tienes acceso? <Link to="/app/login">Iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}
