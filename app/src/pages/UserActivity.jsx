import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import AppLayout from '../layouts/AppLayout';
import styles from './UserActivity.module.css';

const STATUS_LABEL = {
  planned:    'Planificado',
  in_progress:'En progreso',
  completed:  'Completado',
  published:  'Publicado',
  draft:      'Borrador',
};
const STATUS_CLASS = {
  planned:    'planned',
  in_progress:'inProgress',
  completed:  'completed',
  published:  'published',
  draft:      'draft',
};

function ActivitySection({ title, count, children }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>
        {title}
        <span className={styles.sectionCount}>{count}</span>
      </h3>
      {children}
    </section>
  );
}

export default function UserActivity() {
  const { id } = useParams();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    api.admin.userActivity(id)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <AppLayout>
      <div className={styles.pageHeader}>
        <Link to="/app/admin/users" className={styles.backLink}>← Usuarios</Link>
      </div>

      {loading && <p className={styles.muted}>Cargando...</p>}
      {error   && <p className={styles.error}>{error}</p>}

      {data && (
        <>
          <div className={styles.userCard}>
            <div className={styles.avatar}>{initials(data.user.name)}</div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{data.user.name}</span>
              <span className={styles.userMeta}>{data.user.email}</span>
              <span className={styles.userMeta}>
                {data.user.role === 'admin' ? 'Administrador' : 'Miembro'} · Desde {fmtDate(data.user.created_at)}
              </span>
            </div>
          </div>

          <ActivitySection title="Experimentos" count={data.experiments.length}>
            {data.experiments.length === 0
              ? <p className={styles.empty}>Sin experimentos.</p>
              : (
                <div className={styles.list}>
                  {data.experiments.map(e => (
                    <Link key={e.id} to={`/app/experiments/${e.id}`} className={styles.card}>
                      <div className={styles.cardMain}>
                        <span className={styles.cardTitle}>{e.title}</span>
                        <span className={styles.cardMeta}>
                          {e.date && <>{fmtDate(e.date)} · </>}
                          {e.dataset_count} dataset{e.dataset_count !== 1 ? 's' : ''} ·{' '}
                          {e.steps_done}/{e.steps_total} pasos
                        </span>
                      </div>
                      <span className={`${styles.badge} ${styles[STATUS_CLASS[e.status] || 'planned']}`}>
                        {STATUS_LABEL[e.status] || e.status}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
          </ActivitySection>

          <ActivitySection title="Datasets" count={data.datasets.length}>
            {data.datasets.length === 0
              ? <p className={styles.empty}>Sin datasets.</p>
              : (
                <div className={styles.list}>
                  {data.datasets.map(d => (
                    <Link key={d.id} to={`/app/experiments/${d.experiment_id}`} className={styles.card}>
                      <div className={styles.cardMain}>
                        <span className={styles.cardTitle}>{d.title}</span>
                        <span className={styles.cardMeta}>
                          {d.equipment && <>{d.equipment} · </>}
                          {d.point_count} punto{d.point_count !== 1 ? 's' : ''}
                          {' · en '}<em>{d.experiment_title}</em>
                        </span>
                      </div>
                      <span className={styles.pointCount}>{d.point_count} pts</span>
                    </Link>
                  ))}
                </div>
              )}
          </ActivitySection>

          <ActivitySection title="Publicaciones" count={data.publications.length}>
            {data.publications.length === 0
              ? <p className={styles.empty}>Sin publicaciones.</p>
              : (
                <div className={styles.list}>
                  {data.publications.map(p => (
                    <Link key={p.id} to={`/app/publications/${p.id}`} className={styles.card}>
                      <div className={styles.cardMain}>
                        <span className={styles.cardTitle}>{p.title}</span>
                        <span className={styles.cardMeta}>{fmtDate(p.created_at)}</span>
                      </div>
                      <span className={`${styles.badge} ${styles[STATUS_CLASS[p.status] || 'draft']}`}>
                        {STATUS_LABEL[p.status] || p.status}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
          </ActivitySection>
        </>
      )}
    </AppLayout>
  );
}

function initials(name = '') {
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric' });
}
