import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import AppLayout from '../../layouts/AppLayout';
import styles from './Experiments.module.css';

const STATUSES = [
  { value: '',                  label: 'Todos' },
  { value: 'running',           label: 'En curso' },
  { value: 'success',           label: 'Completados' },
  { value: 'failure',           label: 'Fallidos' },
  { value: 'need_to_be_redone', label: 'Repetir' },
];

const STATUS_COLOR = {
  running:           '#3b82f6',
  success:           '#22c55e',
  failure:           '#ef4444',
  need_to_be_redone: '#f59e0b',
};

const STATUS_LABEL = {
  running:           'En curso',
  success:           'Completado',
  failure:           'Fallido',
  need_to_be_redone: 'Repetir',
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
        <div className={styles.filterTabs}>
          {STATUSES.map(s => (
            <button
              key={s.value}
              className={`${styles.filterTab} ${statusFilter === s.value ? styles.filterTabActive : ''}`}
              style={statusFilter === s.value && s.value
                ? { borderColor: STATUS_COLOR[s.value], color: STATUS_COLOR[s.value], background: STATUS_COLOR[s.value] + '15' }
                : {}}
              onClick={() => setStatus(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
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
                  className={styles.statusBadge}
                  style={{
                    background: (STATUS_COLOR[exp.status] || '#64748b') + '18',
                    color: STATUS_COLOR[exp.status] || '#64748b',
                  }}
                >
                  {STATUS_LABEL[exp.status] || exp.status}
                </span>
              </div>
              <div className={styles.cardMeta}>
                <span>{new Date(exp.date).toLocaleDateString('es-CL')}</span>
                <span>·</span>
                <span>{exp.created_by_name}</span>
                {Number(exp.steps_total) > 0 && (
                  <>
                    <span>·</span>
                    <span>{exp.steps_done}/{exp.steps_total} pasos</span>
                  </>
                )}
                {Number(exp.dataset_count) > 0 && (
                  <>
                    <span>·</span>
                    <span>
                      {exp.dataset_count} dataset{Number(exp.dataset_count) !== 1 ? 's' : ''}
                      {Number(exp.total_rows) > 0 && `, ${exp.total_rows} fila${Number(exp.total_rows) !== 1 ? 's' : ''}`}
                    </span>
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
