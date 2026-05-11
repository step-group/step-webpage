import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../layouts/AppLayout';
import styles from './Profile.module.css';

export default function Profile() {
  const { user, login } = useAuth();

  const [name, setName]               = useState(user?.name || '');
  const [nameMsg, setNameMsg]         = useState('');
  const [nameErr, setNameErr]         = useState('');
  const [savingName, setSavingName]   = useState(false);

  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdMsg, setPwdMsg]   = useState('');
  const [pwdErr, setPwdErr]   = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  async function saveName(e) {
    e.preventDefault();
    setNameErr(''); setNameMsg('');
    if (!name.trim()) return setNameErr('El nombre no puede estar vacío');
    setSavingName(true);
    try {
      const { user: updated, token } = await api.auth.updateProfile({ name });
      login(token, updated);
      setNameMsg('Nombre actualizado correctamente');
    } catch (err) {
      setNameErr(err.message);
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwdErr(''); setPwdMsg('');
    if (pwd.next !== pwd.confirm) return setPwdErr('Las contraseñas no coinciden');
    if (pwd.next.length < 8) return setPwdErr('Mínimo 8 caracteres');
    setSavingPwd(true);
    try {
      const { user: updated, token } = await api.auth.updateProfile({
        current_password: pwd.current,
        new_password: pwd.next,
      });
      login(token, updated);
      setPwd({ current: '', next: '', confirm: '' });
      setPwdMsg('Contraseña actualizada correctamente');
    } catch (err) {
      setPwdErr(err.message);
    } finally {
      setSavingPwd(false);
    }
  }

  return (
    <AppLayout>
      <h2 className={styles.heading}>Mi perfil</h2>

      <div className={styles.sections}>
        {/* Nombre */}
        <section className={styles.card}>
          <h3 className={styles.sectionTitle}>Información personal</h3>
          <form onSubmit={saveName} className={styles.form}>
            <label className={styles.label}>
              Nombre completo
              <input
                className={styles.input}
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </label>
            <label className={styles.label}>
              Email
              <input className={styles.input} value={user?.email || ''} disabled />
            </label>
            {nameErr && <p className={styles.error}>{nameErr}</p>}
            {nameMsg && <p className={styles.success}>{nameMsg}</p>}
            <button className={styles.btnPrimary} type="submit" disabled={savingName}>
              {savingName ? 'Guardando...' : 'Guardar nombre'}
            </button>
          </form>
        </section>

        {/* Contraseña */}
        <section className={styles.card}>
          <h3 className={styles.sectionTitle}>Cambiar contraseña</h3>
          <form onSubmit={savePassword} className={styles.form}>
            <label className={styles.label}>
              Contraseña actual
              <input
                className={styles.input}
                type="password"
                value={pwd.current}
                onChange={e => setPwd(p => ({ ...p, current: e.target.value }))}
                required
              />
            </label>
            <label className={styles.label}>
              Nueva contraseña
              <input
                className={styles.input}
                type="password"
                value={pwd.next}
                onChange={e => setPwd(p => ({ ...p, next: e.target.value }))}
                required
                minLength={8}
              />
            </label>
            <label className={styles.label}>
              Confirmar contraseña
              <input
                className={styles.input}
                type="password"
                value={pwd.confirm}
                onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))}
                required
              />
            </label>
            {pwdErr && <p className={styles.error}>{pwdErr}</p>}
            {pwdMsg && <p className={styles.success}>{pwdMsg}</p>}
            <button className={styles.btnPrimary} type="submit" disabled={savingPwd}>
              {savingPwd ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </form>
        </section>
      </div>
    </AppLayout>
  );
}
