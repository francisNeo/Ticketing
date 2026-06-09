import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import EventCard from '../components/EventCard';
import { eventsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
  { value: 'Church & Religious', label: '⛪ Church' },
  { value: 'Tech', label: '💻 Tech' },
  { value: 'Music', label: '🎵 Music' },
  { value: 'Health', label: '❤️ Health' },
  { value: 'Business', label: '💼 Business' },
  { value: 'Sports', label: '⚽ Sports' },
  { value: 'Arts', label: '🎨 Arts' },
  { value: 'Education', label: '📚 Education' },
  { value: 'Food', label: '🍽️ Food' },
  { value: 'Community', label: '🤝 Community' },
  { value: 'Charity', label: '🙏 Charity' },
];

export default function Home() {
  const { isOrganiser } = useAuth();
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');

  const category = searchParams.get('category') || '';
  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    setLoading(true);
    eventsApi.list({ page, category: category || undefined, search: search || undefined })
      .then(({ data }) => { setEvents(Array.isArray(data?.events) ? data.events : []); setTotal(data?.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, category, search]);

  const setCategory = (cat) => {
    setSearchParams(cat ? { category: cat } : {});
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
          Discover Amazing Events
        </h1>
        <p className="mt-3 text-lg text-gray-500">Register for church services, conferences, concerts, workshops & more across Kenya</p>
        <div className="mt-6 flex gap-3 justify-center">
          <div className="relative max-w-lg w-full">
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSearchParams({ q: search })}
              className="input pl-10"
            />
            <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>
          {isOrganiser() && (
            <Link to="/dashboard/events/new" className="btn-primary whitespace-nowrap">+ Create Event</Link>
          )}
        </div>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 flex-wrap mb-8">
        <button
          onClick={() => setCategory('')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!category ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'}`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${category === cat.value ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Events grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card overflow-hidden animate-pulse">
              <div className="h-44 bg-gray-200" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg">No events found</p>
          {isOrganiser() && (
            <Link to="/dashboard/events/new" className="mt-4 inline-block btn-primary">Create the first event</Link>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">{total} event{total !== 1 ? 's' : ''} found</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {events.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
          {total > 20 && (
            <div className="mt-8 flex justify-center gap-2">
              {page > 1 && (
                <button onClick={() => setSearchParams({ page: page - 1 })} className="btn-secondary">Previous</button>
              )}
              <span className="px-4 py-2 text-sm text-gray-600">Page {page}</span>
              {events.length === 20 && (
                <button onClick={() => setSearchParams({ page: page + 1 })} className="btn-primary">Next</button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
