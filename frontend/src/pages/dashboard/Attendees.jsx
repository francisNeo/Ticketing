import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { eventsApi, registrationsApi } from '../../api/client';

export default function Attendees() {
  const { id } = useParams();
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    eventsApi.registrations(id).then(({ data }) => setRegistrations(data)).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const handleCheckin = async (regId) => {
    try {
      await registrationsApi.checkin(regId);
      setRegistrations((prev) => prev.map((r) => r.id === regId ? { ...r, status: 'checked_in', checkedInAt: new Date().toISOString() } : r));
    } catch (err) {
      alert(err.response?.data?.error || 'Check-in failed');
    }
  };

  const handleExport = async () => {
    const { data } = await eventsApi.export(id);
    const url = URL.createObjectURL(new Blob([data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendees-${id}.csv`;
    a.click();
  };

  const filtered = registrations.filter(
    (r) => search === '' || r.attendeeName.toLowerCase().includes(search.toLowerCase()) || r.attendeeEmail.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = { confirmed: 'text-green-600', pending: 'text-yellow-600', checked_in: 'text-blue-600', cancelled: 'text-red-500' };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Attendees</h1>
        <button onClick={handleExport} className="btn-secondary text-sm">Export CSV</button>
      </div>

      <div className="mb-4">
        <input className="input max-w-xs" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No attendees found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['Name', 'Email', 'Phone', 'Ticket', 'Payment', 'Status', 'Action'].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.attendeeName}</td>
                  <td className="px-4 py-3 text-gray-600">{r.attendeeEmail}</td>
                  <td className="px-4 py-3 text-gray-600">{r.attendeePhone}</td>
                  <td className="px-4 py-3 text-gray-600">{r.ticketType?.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.payment ? (
                      <span className={r.payment.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}>
                        {r.payment.method === 'mpesa' ? '📱' : '💳'} {r.payment.status}
                      </span>
                    ) : r.ticketType?.price == 0 ? <span className="text-green-600">Free</span> : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${statusColor[r.status]}`}>{r.status.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'confirmed' && (
                      <button onClick={() => handleCheckin(r.id)} className="text-xs text-brand-600 hover:underline font-medium">Check in</button>
                    )}
                    {r.status === 'checked_in' && <span className="text-xs text-green-600">✓ Checked in</span>}
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
