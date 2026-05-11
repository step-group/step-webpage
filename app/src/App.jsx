import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login            from './pages/Login';
import Register         from './pages/Register';
import Dashboard        from './pages/Dashboard';
import AdminUsers       from './pages/AdminUsers';
import ExperimentList   from './pages/experiments/ExperimentList';
import ExperimentDetail from './pages/experiments/ExperimentDetail';
import ExperimentForm   from './pages/experiments/ExperimentForm';
import TemplateList     from './pages/templates/TemplateList';
import TemplateForm     from './pages/templates/TemplateForm';
import ResourceList     from './pages/resources/ResourceList';
import ResourceForm     from './pages/resources/ResourceForm';
import Profile             from './pages/Profile';
import PublicationList    from './pages/publications/PublicationList';
import PublicationDetail  from './pages/publications/PublicationDetail';
import PublicationForm    from './pages/publications/PublicationForm';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>;
  return user ? children : <Navigate to="/app/login" replace />;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/app/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/app/dashboard" replace />;
  return children;
}

function P({ children }) { return <PrivateRoute>{children}</PrivateRoute>; }

function AppRoutes() {
  return (
    <Routes>
      <Route path="/app/login"    element={<Login />} />
      <Route path="/app/register" element={<Register />} />

      <Route path="/app/dashboard"            element={<P><Dashboard /></P>} />
      <Route path="/app/admin/users"          element={<AdminRoute><AdminUsers /></AdminRoute>} />

      <Route path="/app/experiments"          element={<P><ExperimentList /></P>} />
      <Route path="/app/experiments/new"      element={<P><ExperimentForm /></P>} />
      <Route path="/app/experiments/:id"      element={<P><ExperimentDetail /></P>} />
      <Route path="/app/experiments/:id/edit" element={<P><ExperimentForm /></P>} />

      <Route path="/app/templates"            element={<P><TemplateList /></P>} />
      <Route path="/app/templates/new"        element={<P><TemplateForm /></P>} />
      <Route path="/app/templates/:id/edit"   element={<P><TemplateForm /></P>} />

      <Route path="/app/resources"            element={<P><ResourceList /></P>} />
      <Route path="/app/resources/new"        element={<P><ResourceForm /></P>} />
      <Route path="/app/resources/:id/edit"   element={<P><ResourceForm /></P>} />

      <Route path="/app/profile"              element={<P><Profile /></P>} />

      <Route path="/app/publications"             element={<P><PublicationList /></P>} />
      <Route path="/app/publications/new"         element={<P><PublicationForm /></P>} />
      <Route path="/app/publications/:id"         element={<P><PublicationDetail /></P>} />
      <Route path="/app/publications/:id/edit"    element={<P><PublicationForm /></P>} />

      <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="*"    element={<Navigate to="/app/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
