import { Link } from 'react-router-dom';
import { FlaskConical, FileText, Package, BookOpen, ArrowRight } from 'lucide-react';
import AppLayout from '../layouts/AppLayout';
import { useAuth } from '../context/AuthContext';
import styles from './Dashboard.module.css';

const CARDS = [
  {
    to:    '/app/experiments',
    Icon:  FlaskConical,
    color: '#2563eb',
    bg:    '#eff6ff',
    title: 'Experimentos',
    desc:  'Registra y sigue el progreso de tus experimentos paso a paso.',
  },
  {
    to:    '/app/templates',
    Icon:  FileText,
    color: '#7c3aed',
    bg:    '#f5f3ff',
    title: 'Plantillas',
    desc:  'Crea protocolos reutilizables para agilizar nuevos experimentos.',
  },
  {
    to:    '/app/resources',
    Icon:  Package,
    color: '#0891b2',
    bg:    '#ecfeff',
    title: 'Inventario',
    desc:  'Consulta y actualiza el inventario de materiales del laboratorio.',
  },
  {
    to:    '/app/publications',
    Icon:  BookOpen,
    color: '#059669',
    bg:    '#ecfdf5',
    title: 'Publicaciones',
    desc:  'Gestiona publicaciones y asocia datasets experimentales a cada una.',
  },
];

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <div className={styles.hero}>
        <h2 className={styles.heading}>Bienvenida, {user?.name?.split(' ')[0]}</h2>
        <p className={styles.sub}>¿Qué quieres hacer hoy?</p>
      </div>

      <div className={styles.grid}>
        {CARDS.map(({ to, Icon, color, bg, title, desc }) => (
          <Link key={to} to={to} className={styles.card}>
            <div className={styles.cardIcon} style={{ background: bg, color }}>
              <Icon size={22} strokeWidth={1.75} />
            </div>
            <div className={styles.cardBody}>
              <span className={styles.cardTitle}>{title}</span>
              <span className={styles.cardDesc}>{desc}</span>
            </div>
            <ArrowRight size={16} className={styles.cardArrow} strokeWidth={2} />
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
