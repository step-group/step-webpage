import { Link } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import { useAuth } from '../context/AuthContext';
import styles from './Dashboard.module.css';

const CARDS = [
  {
    to:    '/app/experiments',
    icon:  '🧪',
    title: 'Experimentos',
    desc:  'Registra y sigue el progreso de tus experimentos paso a paso.',
  },
  {
    to:    '/app/templates',
    icon:  '📄',
    title: 'Plantillas',
    desc:  'Crea protocolos reutilizables para agilizar nuevos experimentos.',
  },
  {
    to:    '/app/resources',
    icon:  '📦',
    title: 'Inventario',
    desc:  'Consulta y actualiza el inventario de materiales del laboratorio.',
  },
];

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Bienvenido/a, {user?.name}</h2>
      <p style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem', marginBottom: '2rem' }}>
        Selecciona una sección para comenzar.
      </p>

      <div className={styles.grid}>
        {CARDS.map(({ to, icon, title, desc }) => (
          <Link key={to} to={to} className={styles.card} style={{ textDecoration: 'none' }}>
            <span className={styles.cardIcon}>{icon}</span>
            <h3>{title}</h3>
            <p>{desc}</p>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
