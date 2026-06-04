import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../../layouts/AppLayout';
import ConfirmModal from '../../components/ConfirmModal';
import styles from './Templates.module.css';

export default function TemplateList() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.templates.list()
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, []);

  function handleDelete(id, e) {
    e.stopPropagation();
    setModal({
      id,
      message: '¿Eliminar esta plantilla?',
    });
  }

  return (
    <AppLayout>
      <div className={styles.pageHeader}>
        <h2>Plantillas de experimento</h2>
        <Link to="/app/templates/new" className={styles.btnSecondary}>+ Nueva plantilla</Link>
      </div>

      {loading && <p className={styles.muted}>Cargando...</p>}

      {!loading && templates.length === 0 && (
        <div className={styles.emptyState}>
          <p>No hay plantillas todavía.</p>
          <Link to="/app/templates/new" className={styles.btnPrimary}>Crear primera plantilla</Link>
        </div>
      )}

      {!loading && templates.length > 0 && (
        <div className={styles.list}>
          {templates.map(t => (
            <div key={t.id} className={styles.card}>
              <div
                className={styles.cardContent}
                onClick={() => navigate(`/app/templates/${t.id}/edit`)}
              >
                <div className={styles.tmplTitle}>{t.title}</div>
                {t.body && <p className={styles.cardBody}>{t.body}</p>}
                <div className={styles.cardMeta}>
                  <span>{t.steps_count} {t.steps_count === 1 ? 'paso' : 'pasos'}</span>
                  <span>{t.created_by_name}</span>
                  {t.tags?.length > 0 && (
                    <span className={styles.tags}>
                      {t.tags.map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
                <Link
                  to={`/app/experiments/new?template=${t.id}`}
                  className={styles.usarBtn}
                >
                  Usar →
                </Link>
                <Link to={`/app/templates/${t.id}/edit`} className={styles.btnSecondary}>
                  Editar
                </Link>
                {user?.role === 'admin' && (
                  <button className={styles.btnDanger} onClick={e => handleDelete(t.id, e)}>
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ConfirmModal
          message={modal.message}
          confirmLabel="Eliminar"
          danger
          onConfirm={async () => {
            await api.templates.delete(modal.id);
            setTemplates(t => t.filter(x => x.id !== modal.id));
            setModal(null);
          }}
          onCancel={() => setModal(null)}
        />
      )}
    </AppLayout>
  );
}
