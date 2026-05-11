import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import styles from './Auth.module.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.auth.login(form);
      login(token, user);
      navigate('/app/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.panel}>
        <div className={styles.panelLogo}>
          <span className={styles.panelDot} />
          <span className={styles.panelName}>STEP Lab</span>
        </div>
        <h1 className={styles.panelHeading}>Laboratorio de Tecnologías de Separación</h1>
        <p className={styles.panelSub}>Gestiona experimentos, plantillas e inventario de tu laboratorio en un solo lugar.</p>
      </div>

      <div className={styles.formPanel}>
        <div className={styles.card}>
          <h2 className={styles.title}>Iniciar sesión</h2>
          <p className={styles.subtitle}>Ingresa tus credenciales para continuar.</p>

          {error && <p className={styles.error}>{error}</p>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <label>
              Email
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required autoFocus />
            </label>
            <label>
              Contraseña
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            </label>
            <button type="submit" disabled={loading} className={styles.btn}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <p className={styles.footer}>
            ¿No tienes acceso? <Link to="/app/register">Solicitar acceso</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
