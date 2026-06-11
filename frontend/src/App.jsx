import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import EventDetail from './pages/EventDetail';
import Checkout from './pages/Checkout';
import MyTicket from './pages/MyTicket';
import Dashboard from './pages/dashboard/Dashboard';
import MyEvents from './pages/dashboard/MyEvents';
import CreateEvent from './pages/dashboard/CreateEvent';
import EditEvent from './pages/dashboard/EditEvent';
import Attendees from './pages/dashboard/Attendees';
import NotificationCentre from './pages/dashboard/NotificationCentre';
import BundleStore from './pages/dashboard/BundleStore';
import AdminUsers from './pages/admin/AdminUsers';
import AdminRoles from './pages/admin/AdminRoles';
import AdminBundles from './pages/admin/AdminBundles';
import AdminChurchConfig from './pages/admin/AdminChurchConfig';
import CheckIn from './pages/dashboard/CheckIn';
import Navbar from './components/Navbar';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin()) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/e/:slugOrToken" element={<EventDetail />} />
          <Route path="/e/:slugOrToken/checkout" element={<Checkout />} />
          <Route path="/tickets/:registrationId" element={<MyTicket />} />

          {/* Organiser */}
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/dashboard/events" element={<PrivateRoute><MyEvents /></PrivateRoute>} />
          <Route path="/dashboard/events/new" element={<PrivateRoute><CreateEvent /></PrivateRoute>} />
          <Route path="/dashboard/events/:id/edit" element={<PrivateRoute><EditEvent /></PrivateRoute>} />
          <Route path="/dashboard/events/:id/attendees" element={<PrivateRoute><Attendees /></PrivateRoute>} />
          <Route path="/dashboard/events/:id/notifications" element={<PrivateRoute><NotificationCentre /></PrivateRoute>} />
          <Route path="/dashboard/events/:id/checkin" element={<PrivateRoute><CheckIn /></PrivateRoute>} />
          <Route path="/dashboard/bundles" element={<PrivateRoute><BundleStore /></PrivateRoute>} />

          {/* Admin — restricted to users with the admin role */}
          <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
          <Route path="/admin/roles" element={<AdminRoute><AdminRoles /></AdminRoute>} />
          <Route path="/admin/bundles" element={<AdminRoute><AdminBundles /></AdminRoute>} />
          <Route path="/admin/church-config" element={<AdminRoute><AdminChurchConfig /></AdminRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}
