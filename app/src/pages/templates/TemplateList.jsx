import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../../layouts/AppLayout';
import styles from './Templates.module.css';

export default function TemplateList() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.templates.list()
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!confirm('¿Eliminar esta plantilla?')) return;
    await api.templates.delete(id);
    setTemplates(t => t.filter(x => x.id !== id));
  }

  return (
    <AppLayout>
      <div className={styles.pageHeader}>
        <h2>Plantillas de experimento</h2>
        <Link to="/app/templates/new" className={styles.btnPrimary}>+ Nueva plantilla</Link>
      </div>

      {loading && <p className={styles.muted}>Cargando...</p>}

      {!loading && templates.length === 0 && (
        <p className={styles.muted}>No hay plantillas. <Link to="/app/templates/new">Crea la primera.</Link></p>
      )}

      {!loading && (
        <div className={styles.list}>
          {templates.map(t => (
            <div key={t.id} className={styles.card} onClick={() => navigate(`/app/templates/${t.id}/edit`)}>
              <div className={styles.cardTop}>
                <span className={styles.tmplTitle}>{t.title}</span>
                <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
                  <Link to={`/app/templates/${t.id}/edit`} className={styles.btnSecondary}>Editar</Link>
                  {user?.role === 'admin' && (
                    <button className={styles.btnDanger} onClick={(e) => handleDelete(t.id, e)}>Eliminar</button>
                  )}
                  <Link
                    to={`/app/experiments/new?template=${t.id}`}
                    className={styles.btnPrimary}
                    onClick={e => e.stopPropagation()}
                  >
                    Usar
                  </Link>
                </div>
              </div>
              <div className={styles.cardMeta}>
                <span>{t.steps_count} pasos</span>
                <span>{t.created_by_name}</span>
                {t.tags?.length > 0 && (
                  <span className={styles.tags}>
                    {t.tags.map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
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
