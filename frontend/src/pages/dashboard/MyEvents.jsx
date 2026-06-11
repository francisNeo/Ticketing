import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventsApi, ticketTypesApi } from '../../api/client';
import { format } from 'date-fns';
import ShareLink from '../../components/ShareLink';

export default function MyEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sharingEventId, setSharingEventId] = useState(null);

  useEffect(() => {
    eventsApi.myEvents().then(({ data }) => setEvents(Array.isArray(data) ? data : [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Events</h1>
        <Link to="/dashboard/events/new" className="btn-primary">+ Create Event</Link>
      </div>
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" /></div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center"><p className="text-gray-400 mb-4">No events yet</p><Link to="/dashboard/events/new" className="btn-primary">Create your first event</Link></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['Event', 'Date', 'Status', 'Registrations', 'Actions'].map((h) => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link to={`/e/${event.visibility === 'private' ? event.privateToken : (event.slug || event.id)}`} className="font-medium text-gray-900 hover:text-brand-600 hover:underline">{event.title}</Link>
                      {event.visibility === 'private' && (
                        <span className="text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">🔒 Private</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{event.isFree ? 'Free' : `KES ${Math.min(...(event.ticketTypes?.map((t) => Number(t.price)) || [0])).toLocaleString()}+`}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{format(new Date(event.startsAt), 'MMM d, yyyy')}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${event.status === 'published' ? 'bg-green-100 text-green-700' : event.status === 'draft' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{event.status}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{event._count?.registrations || 0}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-3 items-center">
                      <Link to={`/dashboard/events/${event.id}/attendees`} className="text-brand-600 hover:underline text-xs">Attendees</Link>
                      <Link to={`/dashboard/events/${event.id}/checkin`} className="text-xs font-medium text-indigo-600 hover:underline">📷 Entry</Link>
                      <Link to={`/dashboard/events/${event.id}/notifications`} className="text-brand-600 hover:underline text-xs">Notify</Link>
                      <Link to={`/dashboard/events/${event.id}/edit`} className="text-gray-500 hover:underline text-xs">Edit</Link>
                      {event.status === 'published' && (
                        <button
                          onClick={() => setSharingEventId(sharingEventId === event.id ? null : event.id)}
                          className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full hover:bg-green-100 transition-colors"
                        >
                          🔗 Share
                        </button>
                      )}
                    </div>
                    {sharingEventId === event.id && (
                      <div className="mt-3 max-w-md">
                        <ShareLink
                          url={`${window.location.origin}/e/${event.visibility === 'private' ? event.privateToken : event.slug}?register=1`}
                          label="Registration link — share to invite attendees"
                          eventTitle={event.title}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
