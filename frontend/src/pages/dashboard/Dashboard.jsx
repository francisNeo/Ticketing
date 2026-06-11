import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { eventsApi } from '../../api/client';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventsApi.myEvents()
      .then(({ data }) => setEvents(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: events.length,
    published: events.filter((e) => e.status === 'published').length,
    totalRegistrations: events.reduce((sum, e) => sum + (e._count?.registrations || 0), 0),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back, {user?.name}</p>
        </div>
        <Link to="/dashboard/events/new" className="btn-primary">+ Create Event</Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        {[
          { label: 'Total Events', value: stats.total, icon: '🎪' },
          { label: 'Published', value: stats.published, icon: '✅' },
          { label: 'Total Registrations', value: stats.totalRegistrations, icon: '🎟️' },
        ].map((s) => (
          <div key={s.label} className="card p-6">
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="text-3xl font-bold text-gray-900">{s.value}</div>
            <div className="text-sm text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Events table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">My Events</h2>
          <Link to="/dashboard/events" className="text-sm text-brand-600 hover:underline">View all</Link>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" /></div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 mb-4">No events yet</p>
            <Link to="/dashboard/events/new" className="btn-primary">Create your first event</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {events.slice(0, 5).map((event) => (
              <div key={event.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                  <Link to={`/e/${event.slug || event.id}`} className="font-medium text-gray-900 text-sm hover:text-brand-600 hover:underline">{event.title}</Link>
                  <div className="text-xs text-gray-500 mt-0.5">{format(new Date(event.startsAt), 'MMM d, yyyy')}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">{event._count?.registrations || 0} registered</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    event.status === 'published' ? 'bg-green-100 text-green-700' :
                    event.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{event.status}</span>
                  <div className="flex gap-2">
                    <Link to={`/dashboard/events/${event.id}/attendees`} className="text-xs text-brand-600 hover:underline">Attendees</Link>
                    <Link to={`/dashboard/events/${event.id}/edit`} className="text-xs text-gray-500 hover:underline">Edit</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
