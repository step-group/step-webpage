import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import {
  format, parse, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfDay, endOfDay, getDay, setHours,
} from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../../layouts/AppLayout';
import ReservationModal from './ReservationModal';
import styles from './Equipment.module.css';

const localizer = dateFnsLocalizer({
  format, parse, getDay, locales: { es },
  startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 1 }),
});

const MESSAGES = {
  today: 'Hoy', previous: 'Anterior', next: 'Siguiente',
  month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Agenda',
  date: 'Fecha', time: 'Hora', event: 'Reserva',
  allDay: 'Todo el día', noEventsInRange: 'No hay reservas en este rango',
  showMore: (n) => `+${n} más`,
};

// The date range the calendar currently shows (month view includes spillover days).
function visibleRange(date, view) {
  const opts = { weekStartsOn: 1 };
  if (view === 'month') return { from: startOfWeek(startOfMonth(date), opts), to: endOfWeek(endOfMonth(date), opts) };
  if (view === 'day')   return { from: startOfDay(date), to: endOfDay(date) };
  return { from: startOfWeek(date, opts), to: endOfWeek(date, opts) };
}

export default function EquipmentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [reservations, setReservations] = useState([]);
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState('week');
  const [modal, setModal] = useState(null); // { reservation, start, end }
  const [showAdd, setShowAdd] = useState(false);
  const [newEq, setNewEq] = useState({ name: '', location: '' });

  const current = equipment.find(e => String(e.id) === id);

  useEffect(() => {
    api.equipment.list()
      .then(setEquipment)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // /app/equipment (or an unknown id) lands on the first tab.
  useEffect(() => {
    if (!loading && equipment.length && !current) {
      navigate(`/app/equipment/${equipment[0].id}`, { replace: true });
    }
  }, [loading, equipment, current, navigate]);

  const range = useMemo(() => visibleRange(date, view), [date, view]);

  // Bumped after a save or cancel so the effect below refetches.
  const [reloadKey, setReloadKey] = useState(0);
  const currentId = current?.id;

  useEffect(() => {
    if (!currentId) return;
    // A slower earlier response (previous tab or week) must never overwrite a newer one.
    let ignore = false;
    setReservations([]);
    api.equipment
      .reservations(currentId, { from: range.from.toISOString(), to: range.to.toISOString() })
      .then(rows => { if (!ignore) setReservations(rows); })
      .catch(err => { if (!ignore) setError(err.message); });
    return () => { ignore = true; };
  }, [currentId, range, reloadKey]);

  const events = useMemo(() => reservations.map(r => ({
    id: r.id,
    title: `${r.title} — ${r.user_name}`,
    start: new Date(r.starts_at),
    end: new Date(r.ends_at),
    resource: r,
  })), [reservations]);

  function onSelectSlot({ start, end }) {
    // In month view a click selects whole days, so offer a sensible one-hour default instead.
    if (view === 'month') {
      const s = setHours(startOfDay(start), 9);
      return setModal({ reservation: null, start: s, end: setHours(s, 10) });
    }
    setModal({ reservation: null, start, end });
  }

  function eventStyle(event) {
    const mine = event.resource.user_id === user?.id;
    return { style: { background: mine ? 'var(--color-primary)' : '#64748b', border: 'none' } };
  }

  async function addEquipment(e) {
    e.preventDefault();
    setError('');
    try {
      const created = await api.equipment.create({ name: newEq.name, location: newEq.location });
      setEquipment(list => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewEq({ name: '', location: '' });
      setShowAdd(false);
      navigate(`/app/equipment/${created.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AppLayout>
      <div className={styles.pageHeader}>
        <h2>Equipos</h2>
        {isAdmin && (
          <button className={styles.btnSecondary} onClick={() => setShowAdd(s => !s)}>
            {showAdd ? 'Cerrar' : '+ Nuevo equipo'}
          </button>
        )}
      </div>

      {showAdd && (
        <form className={styles.addForm} onSubmit={addEquipment}>
          <input className={styles.input} placeholder="Nombre (ej. Microondas)" required
            value={newEq.name} onChange={e => setNewEq(n => ({ ...n, name: e.target.value }))} />
          <input className={styles.input} placeholder="Ubicación (opcional)"
            value={newEq.location} onChange={e => setNewEq(n => ({ ...n, location: e.target.value }))} />
          <button className={styles.btnPrimary} type="submit">Agregar</button>
        </form>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <p className={styles.muted}>Cargando...</p>
      ) : equipment.length === 0 ? (
        <p className={styles.muted}>No hay equipos reservables{isAdmin ? '. Agrega el primero con "+ Nuevo equipo".' : '.'}</p>
      ) : (
        <>
          <div className={styles.tabs} role="tablist">
            {equipment.map(e => (
              <Link key={e.id} to={`/app/equipment/${e.id}`} role="tab"
                aria-selected={String(e.id) === id}
                className={`${styles.tab} ${String(e.id) === id ? styles.tabActive : ''}`}>
                {e.name}
              </Link>
            ))}
          </div>

          {current && (
            <>
              {(current.location || current.description) && (
                <p className={styles.equipMeta}>
                  {[current.location, current.description].filter(Boolean).join(' · ')}
                </p>
              )}
              <div className={styles.calendarWrap}>
                <Calendar
                  localizer={localizer}
                  culture="es"
                  messages={MESSAGES}
                  events={events}
                  date={date} onNavigate={setDate}
                  view={view} onView={setView}
                  views={['day', 'week', 'month']}
                  step={30} timeslots={2}
                  showMultiDayTimes
                  scrollToTime={setHours(startOfDay(new Date()), 8)}
                  selectable
                  onSelectSlot={onSelectSlot}
                  onSelectEvent={ev => setModal({ reservation: ev.resource, start: ev.start, end: ev.end })}
                  eventPropGetter={eventStyle}
                  formats={{ eventTimeRangeFormat: ({ start, end }, c, l) =>
                    `${l.format(start, 'HH:mm', c)} – ${l.format(end, 'HH:mm', c)}` }}
                />
              </div>
              <p className={styles.legend}>
                <span className={`${styles.dot} ${styles.dotMine}`} /> Tus reservas
                <span className={`${styles.dot} ${styles.dotOthers}`} /> Reservas de otros
                · Arrastra sobre el calendario para reservar.
              </p>
            </>
          )}
        </>
      )}

      {modal && current && (
        <ReservationModal
          equipment={current}
          reservation={modal.reservation}
          initialStart={modal.start}
          initialEnd={modal.end}
          onClose={() => setModal(null)}
          onChanged={() => { setModal(null); setReloadKey(k => k + 1); }}
        />
      )}
    </AppLayout>
  );
}
