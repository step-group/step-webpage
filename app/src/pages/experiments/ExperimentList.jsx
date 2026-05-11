import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import AppLayout from '../../layouts/AppLayout';
import styles from './Experiments.module.css';

const STATUS_LABEL = {
  running:           'En curso',
  success:           'Exitoso',
  failure:           'Fallido',
  need_to_be_redone: 'Repetir',
};
const STATUS_COLOR = {
  running:           '#3b82f6',
  success:           '#22c55e',
  failure:           '#ef4444',
  need_to_be_redone: '#f59e0b',
};

export default function ExperimentList() {
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatus]     = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (search)       params.search = search;
    setLoading(true);
    api.experiments.list(params)
      .then(setExperiments)
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  return (
    <AppLayout>
      <div className={styles.pageHeader}>
        <h2>Experimentos</h2>
        <Link to="/app/experiments/new" className={styles.btnPrimary}>+ Nuevo</Link>
      </div>

      <div className={styles.filters}>
        <input
          className={styles.searchInput}
          placeholder="Buscar por título..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className={styles.select} value={statusFilter} onChange={e => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {loading && <p className={styles.muted}>Cargando...</p>}

      {!loading && experiments.length === 0 && (
        <p className={styles.muted}>No hay experimentos. <Link to="/app/experiments/new">Crea el primero.</Link></p>
      )}

      {!loading && experiments.length > 0 && (
        <div className={styles.list}>
          {experiments.map(exp => (
            <div
              key={exp.id}
              className={styles.card}
              style={{ borderLeftColor: STATUS_COLOR[exp.status] || '#e2e8f0' }}
              onClick={() => navigate(`/app/experiments/${exp.id}`)}
            >
              <div className={styles.cardTop}>
                <span className={styles.expTitle}>{exp.title}</span>
                <span
                  className={styles.statusDot}
                  style={{ background: STATUS_COLOR[exp.status] }}
                  title={STATUS_LABEL[exp.status]}
                />
              </div>
              <div className={styles.cardMeta}>
                <span className={styles.statusLabel} style={{ color: STATUS_COLOR[exp.status] }}>
                  {STATUS_LABEL[exp.status] || exp.status}
                </span>
                <span>·</span>
                <span>{new Date(exp.date).toLocaleDateString('es-CL')}</span>
                <span>·</span>
                <span>{exp.created_by_name}</span>
                {Number(exp.steps_total) > 0 && (
                  <>
                    <span>·</span>
                    <span>{exp.steps_done}/{exp.steps_total} pasos</span>
                  </>
                )}
                {exp.tags?.length > 0 && (
                  <span className={styles.tags}>
                    {exp.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
