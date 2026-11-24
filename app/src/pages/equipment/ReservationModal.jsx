import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../../components/ConfirmModal';
import styles from './Equipment.module.css';

const INPUT_FORMAT = "yyyy-MM-dd'T'HH:mm"; // what <input type="datetime-local"> expects

export default function ReservationModal({ equipment, reservation, initialStart, initialEnd, onClose, onChanged }) {
  const { user } = useAuth();
  const isNew = !reservation;
  const canEdit = isNew || reservation.user_id === user?.id || user?.role === 'admin';

  const [title, setTitle]   = useState(reservation?.title ?? '');
  const [notes, setNotes]   = useState(reservation?.notes ?? '');
  const [start, setStart]   = useState(format(initialStart, INPUT_FORMAT));
  const [end, setEnd]       = useState(format(initialEnd, INPUT_FORMAT));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !confirmDelete) onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, confirmDelete]);

  async function save(e) {
    e.preventDefault();
    setError('');
    const starts = new Date(start);
    const ends = new Date(end);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) return setError('Fechas inválidas');
    if (ends <= starts) return setError('El término debe ser posterior al inicio');

    const body = { title, notes, starts_at: starts.toISOString(), ends_at: ends.toISOString() };
    setSaving(true);
    try {
      if (isNew) await api.equipment.reserve(equipment.id, body);
      else await api.equipment.updateReservation(reservation.id, body);
      onChanged();
    } catch (err) {
      setError(err.message); // includes the "ya está reservado por ..." message on conflicts
      setSaving(false);
    }
  }

  return (
    <>
    <div className={styles.overlay} onClick={onClose}>
      <form className={styles.modal} onClick={e => e.stopPropagation()} onSubmit={save}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>
              {isNew ? 'Nueva reserva' : canEdit ? 'Editar reserva' : 'Reserva'}
            </h3>
            <p className={styles.modalSub}>
              {equipment.name}
              {!isNew && ` · Reservado por ${reservation.user_name}`}
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className={styles.modalBody}>
          <label className={styles.field}>
            <span>Título</span>
            <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ej. Digestión de muestras" required disabled={!canEdit} autoFocus />
          </label>

          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span>Inicio</span>
              <input className={styles.input} type="datetime-local" value={start}
                onChange={e => setStart(e.target.value)} required disabled={!canEdit} />
            </label>
            <label className={styles.field}>
              <span>Término</span>
              <input className={styles.input} type="datetime-local" value={end}
                onChange={e => setEnd(e.target.value)} required disabled={!canEdit} />
            </label>
          </div>

          <label className={styles.field}>
            <span>Notas (opcional)</span>
            <textarea className={styles.input} rows={3} value={notes}
              onChange={e => setNotes(e.target.value)} disabled={!canEdit} />
          </label>

          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.modalActions}>
          {!isNew && canEdit && (
            <button type="button" className={styles.btnDanger} onClick={() => setConfirmDelete(true)}>
              Cancelar reserva
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className={styles.btnSecondary} onClick={onClose}>
            Cerrar
          </button>
          {canEdit && (
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          )}
        </div>
      </form>
    </div>

    {/* Outside the overlay so clicks on the confirm dialog don't also close this modal. */}
    {confirmDelete && (
      <ConfirmModal
        message="¿Cancelar esta reserva? El equipo quedará libre en ese horario."
        confirmLabel="Cancelar reserva"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await api.equipment.deleteReservation(reservation.id);
          onChanged();
        }}
      />
    )}
    </>
  );
}
