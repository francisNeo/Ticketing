import { Link } from 'react-router-dom';
import { format } from 'date-fns';

export default function EventCard({ event }) {
  const link = event.visibility === 'private' ? `/e/${event.privateToken}` : `/e/${event.slug}`;
  const minPrice = event.ticketTypes?.length
    ? Math.min(...event.ticketTypes.map((t) => Number(t.price)))
    : 0;

  return (
    <Link to={link} className="card overflow-hidden hover:shadow-md transition-shadow group">
      <div className="relative h-44 bg-gradient-to-br from-brand-600 to-blue-700 overflow-hidden">
        {event.bannerUrl ? (
          <img src={event.bannerUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white/30 text-6xl font-bold">{event.title[0]}</span>
          </div>
        )}
        {event.isFree && (
          <span className="absolute top-3 left-3 bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded-full">FREE</span>
        )}
        {event.category && (
          <span className="absolute top-3 right-3 bg-black/40 text-white text-xs px-2 py-1 rounded-full">
            {event.category === 'Church & Religious' ? '⛪' : ''} {event.category}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-1 group-hover:text-brand-600 transition-colors">{event.title}</h3>
        <p className="text-xs text-gray-500 mt-1">
          {format(new Date(event.startsAt), 'EEE, MMM d · h:mm a')}
        </p>
        {event.locationText && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{event.locationText}</p>
        )}
        {event.serviceType && (
          <p className="text-xs text-brand-600 mt-0.5 font-medium">{event.serviceType}</p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">{event.organiser?.name}</span>
          {event.isFree ? (
            event.category === 'Church & Religious'
              ? <span className="text-xs text-green-600 font-medium">Open to all</span>
              : null
          ) : (
            <span className="text-sm font-bold text-brand-600">KES {minPrice.toLocaleString()}+</span>
          )}
        </div>
      </div>
    </Link>
  );
}
