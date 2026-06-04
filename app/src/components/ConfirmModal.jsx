import { useEffect, useState } from 'react';
import styles from './ConfirmModal.module.css';

export default function ConfirmModal({ message, confirmLabel = 'Confirmar', danger = false, onConfirm, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !loading) onCancel(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, loading]);

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message || 'Error al realizar la acción');
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={!loading ? onCancel : undefined}>
      <div className={styles.box} onClick={e => e.stopPropagation()}>
        <p className={styles.message}>{message}</p>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button
            className={danger ? styles.btnDanger : styles.btnConfirm}
            onClick={handleConfirm}
            disabled={loading}
            autoFocus
          >
            {loading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
