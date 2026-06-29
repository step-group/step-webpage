import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../layouts/AppLayout';
import styles from './Profile.module.css';

const STATUS_LABEL = {
  planned: 'Planificado', in_progress: 'En progreso', completed: 'Completado',
  published: 'Publicado', draft: 'Borrador',
};
const STATUS_CLASS = {
  planned: 'planned', in_progress: 'inProgress', completed: 'completed',
  published: 'published', draft: 'draft',
};

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric' });
}

function ActivityBlock({ title, items, empty, renderItem }) {
  return (
    <section className={styles.actSection}>
      <h3 className={styles.actSectionTitle}>
        {title}
        <span className={styles.actCount}>{items.length}</span>
      </h3>
      {items.length === 0
        ? <p className={styles.actEmpty}>{empty}</p>
        : <div className={styles.actList}>{items.map(renderItem)}</div>}
    </section>
  );
}

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

  const [activity, setActivity] = useState(null);
  useEffect(() => {
    api.auth.activity().then(setActivity).catch(() => {});
  }, []);

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

      <div className={styles.columns}>
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

      {/* Activity */}
      {activity && (
        <div className={styles.activity}>
          <ActivityBlock
            title="Mis experimentos"
            empty="Aún no has creado experimentos."
            items={activity.experiments}
            renderItem={e => (
              <Link key={e.id} to={`/app/experiments/${e.id}`} className={styles.actCard}>
                <div className={styles.actMain}>
                  <span className={styles.actTitle}>{e.title}</span>
                  <span className={styles.actMeta}>
                    {e.date && <>{fmtDate(e.date)} · </>}
                    {e.dataset_count} dataset{e.dataset_count !== 1 ? 's' : ''} · {e.steps_done}/{e.steps_total} pasos
                  </span>
                </div>
                <span className={`${styles.badge} ${styles[STATUS_CLASS[e.status] || 'planned']}`}>
                  {STATUS_LABEL[e.status] || e.status}
                </span>
              </Link>
            )}
          />
          <ActivityBlock
            title="Mis datasets"
            empty="Aún no has creado datasets."
            items={activity.datasets}
            renderItem={d => (
              <Link key={d.id} to={`/app/experiments/${d.experiment_id}`} className={styles.actCard}>
                <div className={styles.actMain}>
                  <span className={styles.actTitle}>{d.title}</span>
                  <span className={styles.actMeta}>
                    {d.equipment && <>{d.equipment} · </>}
                    {d.row_count} punto{d.row_count !== 1 ? 's' : ''} · <em>{d.experiment_title}</em>
                  </span>
                </div>
                <span className={styles.pointCount}>{d.row_count} pts</span>
              </Link>
            )}
          />
          <ActivityBlock
            title="Mis publicaciones"
            empty="Aún no has creado publicaciones."
            items={activity.publications}
            renderItem={p => (
              <Link key={p.id} to={`/app/publications/${p.id}`} className={styles.actCard}>
                <div className={styles.actMain}>
                  <span className={styles.actTitle}>{p.title}</span>
                  <span className={styles.actMeta}>{fmtDate(p.created_at)}</span>
                </div>
                <span className={`${styles.badge} ${styles[STATUS_CLASS[p.status] || 'draft']}`}>
                  {STATUS_LABEL[p.status] || p.status}
                </span>
              </Link>
            )}
          />
        </div>
      )}
    </AppLayout>
  );
}
