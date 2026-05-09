import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../../layouts/AppLayout';
import styles from './Experiments.module.css';

const STATUS_LABEL = {
  running: 'En curso', success: 'Exitoso',
  failure: 'Fallido', need_to_be_redone: 'Repetir',
};
const STATUS_COLOR = {
  running: '#2563eb', success: '#16a34a',
  failure: '#dc2626', need_to_be_redone: '#d97706',
};

export default function ExperimentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exp, setExp]           = useState(null);
  const [loading, setLoading]   = useState(true);
  const [newStep, setNewStep]   = useState('');
  const [comment, setComment]   = useState('');
  const [allResources, setAll]  = useState([]);
  const [linkId, setLinkId]     = useState('');
  const [error, setError]       = useState('');

  useEffect(() => {
    Promise.all([
      api.experiments.get(id),
      api.resources.list(),
    ]).then(([expData, res]) => {
      setExp(expData);
      setAll(res);
    }).catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleStep(step) {
    const updated = await api.experiments.updateStep(id, step.id, { finished: !step.finished });
    setExp(e => ({ ...e, steps: e.steps.map(s => s.id === updated.id ? updated : s) }));
  }

  async function addStep() {
    if (!newStep.trim()) return;
    const maxOrd = exp.steps.reduce((m, s) => Math.max(m, s.ordering), -1);
    const step = await api.experiments.addStep(id, { body: newStep.trim(), ordering: maxOrd + 1 });
    setExp(e => ({ ...e, steps: [...e.steps, step] }));
    setNewStep('');
  }

  async function deleteStep(stepId) {
    await api.experiments.deleteStep(id, stepId);
    setExp(e => ({ ...e, steps: e.steps.filter(s => s.id !== stepId) }));
  }

  async function addComment() {
    if (!comment.trim()) return;
    const c = await api.experiments.addComment(id, comment.trim());
    setExp(e => ({ ...e, comments: [...e.comments, c] }));
    setComment('');
  }

  async function deleteComment(cid) {
    await api.experiments.deleteComment(id, cid);
    setExp(e => ({ ...e, comments: e.comments.filter(c => c.id !== cid) }));
  }

  async function addLink() {
    if (!linkId) return;
    await api.experiments.addLink(id, Number(linkId));
    const resource = allResources.find(r => r.id === Number(linkId));
    setExp(e => ({ ...e, resource_links: [...e.resource_links, resource] }));
    setLinkId('');
  }

  async function removeLink(rid) {
    await api.experiments.removeLink(id, rid);
    setExp(e => ({ ...e, resource_links: e.resource_links.filter(r => r.id !== rid) }));
  }

  async function archive() {
    if (!confirm('¿Archivar este experimento?')) return;
    await api.experiments.archive(id, 'archived');
    navigate('/app/experiments');
  }

  if (loading) return <AppLayout><p className={styles.muted}>Cargando...</p></AppLayout>;
  if (error || !exp) return <AppLayout><p className={styles.error}>{error || 'No encontrado'}</p></AppLayout>;

  const linkedIds = new Set(exp.resource_links.map(r => r.id));
  const availableResources = allResources.filter(r => !linkedIds.has(r.id) && r.state === 'normal');

  return (
    <AppLayout>
      <div className={styles.detailHeader}>
        <div>
          <div className={styles.detailTitle}>{exp.title}</div>
          <div className={styles.detailMeta}>
            <span
              className={styles.statusBadge}
              style={{ background: STATUS_COLOR[exp.status] + '20', color: STATUS_COLOR[exp.status] }}
            >
              {STATUS_LABEL[exp.status]}
            </span>
            <span>{new Date(exp.date).toLocaleDateString('es-CL')}</span>
            <span>{exp.created_by_name}</span>
            {exp.template_title && <span>Plantilla: {exp.template_title}</span>}
            {exp.tags?.length > 0 && (
              <span className={styles.tags}>
                {exp.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
              </span>
            )}
          </div>
        </div>
        <div className={styles.detailActions}>
          <Link to={`/app/experiments/${id}/edit`} className={styles.btnSecondary}>Editar</Link>
          {user?.role === 'admin' && (
            <button onClick={archive} className={styles.btnDanger}>Archivar</button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Descripción / Protocolo</div>
        <div className={styles.body}>{exp.body || <span style={{ color: 'var(--color-text-muted)' }}>Sin contenido</span>}</div>
      </div>

      {/* Steps */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          Pasos ({exp.steps.filter(s => s.finished).length}/{exp.steps.length})
        </div>
        <div className={styles.stepsList}>
          {exp.steps.map(s => (
            <div key={s.id} className={`${styles.stepItem} ${s.finished ? styles.done : ''}`}>
              <input
                type="checkbox"
                className={styles.stepCheck}
                checked={s.finished}
                onChange={() => toggleStep(s)}
              />
              <span className={styles.stepBody}>{s.body}</span>
              {s.finished && s.finished_at && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {new Date(s.finished_at).toLocaleDateString('es-CL')}
                </span>
              )}
              <button className={styles.stepDelete} onClick={() => deleteStep(s.id)} title="Eliminar">×</button>
            </div>
          ))}
        </div>
        <div className={styles.addStepRow}>
          <input
            className={styles.addStepInput}
            placeholder="Agregar paso..."
            value={newStep}
            onChange={e => setNewStep(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addStep()}
          />
          <button className={styles.btnPrimary} onClick={addStep}>Agregar</button>
        </div>
      </div>

      {/* Resource links */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Recursos utilizados</div>
        <div className={styles.resourceLinks}>
          {exp.resource_links.map(r => (
            <span key={r.id} className={styles.resourceChip}>
              {r.name} {r.quantity > 0 && `(${r.quantity} ${r.unit})`}
              <button onClick={() => removeLink(r.id)} title="Desvincular">×</button>
            </span>
          ))}
        </div>
        {availableResources.length > 0 && (
          <div className={styles.linkSelect}>
            <select value={linkId} onChange={e => setLinkId(e.target.value)}>
              <option value="">Seleccionar recurso...</option>
              {availableResources.map(r => (
                <option key={r.id} value={r.id}>{r.name} ({r.quantity} {r.unit})</option>
              ))}
            </select>
            <button className={styles.btnSecondary} onClick={addLink}>Vincular</button>
          </div>
        )}
      </div>

      {/* Comments */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Comentarios ({exp.comments.length})</div>
        <div className={styles.commentsList}>
          {exp.comments.map(c => (
            <div key={c.id} className={styles.comment}>
              <div className={styles.commentMeta}>
                <span>{c.created_by_name} · {new Date(c.created_at).toLocaleString('es-CL')}</span>
                {(c.created_by === user?.id || user?.role === 'admin') && (
                  <button className={styles.btnDanger} onClick={() => deleteComment(c.id)} style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem' }}>Eliminar</button>
                )}
              </div>
              <div className={styles.commentBody}>{c.body}</div>
            </div>
          ))}
        </div>
        <div className={styles.commentForm}>
          <textarea
            className={styles.commentInput}
            rows={2}
            placeholder="Escribe un comentario..."
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
          <button className={styles.btnPrimary} onClick={addComment}>Enviar</button>
        </div>
      </div>
    </AppLayout>
  );
}
