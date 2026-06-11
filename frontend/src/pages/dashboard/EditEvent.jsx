import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi, ticketTypesApi } from '../../api/client';
import api from '../../api/client';

export default function EditEvent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ttError, setTtError] = useState('');
  const [newTt, setNewTt] = useState({ name: '', price: '', quantity: '', description: '' });
  const [addingTt, setAddingTt] = useState(false);
  const [showTtForm, setShowTtForm] = useState(false);

  useEffect(() => {
    api.get(`/events/${id}`)
      .then(({ data }) => {
        setForm({
          title: data.title || '',
          description: data.description || '',
          startsAt: data.startsAt?.slice(0, 16) || '',
          endsAt: data.endsAt?.slice(0, 16) || '',
          locationType: data.locationType || 'physical',
          locationText: data.locationText || '',
          category: data.category || '',
          tags: (data.tags || []).join(', '),
          maxCapacity: data.maxCapacity || '',
        });
        setTicketTypes(data.ticketTypes || []);
      })
      .catch(() => setError('Failed to load event. Please go back and try again.'))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await eventsApi.update(id, {
        ...form,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()) : [],
        maxCapacity: form.maxCapacity ? parseInt(form.maxCapacity) : null,
      });
      navigate('/dashboard/events');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTicketType = async () => {
    if (!newTt.name) { setTtError('Ticket type name is required'); return; }
    if (newTt.price === '') { setTtError('Price is required (use 0 for free)'); return; }
    setAddingTt(true); setTtError('');
    try {
      const { data } = await ticketTypesApi.create(id, {
        name: newTt.name,
        price: parseFloat(newTt.price),
        quantity: newTt.quantity ? parseInt(newTt.quantity) : undefined,
        description: newTt.description || undefined,
      });
      setTicketTypes((prev) => [...prev, data]);
      setNewTt({ name: '', price: '', quantity: '', description: '' });
      setShowTtForm(false);
    } catch (err) {
      setTtError(err.message);
    } finally {
      setAddingTt(false);
    }
  };

  const handleDeleteTicketType = async (ttId) => {
    if (!confirm('Delete this ticket type?')) return;
    try {
      await ticketTypesApi.remove(ttId);
      setTicketTypes((prev) => prev.filter((t) => t.id !== ttId));
    } catch (err) {
      setTtError(err.message);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" /></div>;

  if (!form) return (
    <div className="max-w-2xl mx-auto px-4 py-10 text-center">
      <p className="text-red-500 mb-4">{error || 'Event not found.'}</p>
      <button onClick={() => navigate('/dashboard/events')} className="btn-secondary">Back to My Events</button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/dashboard/events')} className="text-gray-400 hover:text-gray-600">← Back</button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Event</h1>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Event Details */}
      <div className="card p-6 space-y-5 mb-6">
        <h2 className="font-semibold text-gray-800">Event Details</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
          <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <textarea className="input min-h-[100px] resize-none" value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Start</label>
            <input type="datetime-local" className="input" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">End</label>
            <input type="datetime-local" className="input" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
          <input className="input" value={form.locationText} onChange={(e) => set('locationText', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
            <input className="input" value={form.category} onChange={(e) => set('category', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Capacity</label>
            <input type="number" className="input" value={form.maxCapacity} onChange={(e) => set('maxCapacity', e.target.value)} placeholder="Unlimited" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={() => navigate('/dashboard/events')} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>

      {/* Ticket Types */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Ticket Types</h2>
          <button onClick={() => setShowTtForm((v) => !v)} className="text-sm text-brand-600 hover:underline font-medium">
            {showTtForm ? 'Cancel' : '+ Add Ticket Type'}
          </button>
        </div>

        {ttError && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{ttError}</div>}

        {/* Existing ticket types */}
        {ticketTypes.length === 0 ? (
          <p className="text-sm text-gray-400 mb-4">No ticket types yet. Add one below.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {ticketTypes.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-800">{t.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {Number(t.price) === 0 ? 'Free' : `KES ${Number(t.price).toLocaleString()}`}
                    {t.quantity ? ` · ${t.soldCount || 0}/${t.quantity} sold` : ' · Unlimited'}
                  </div>
                  {t.description && <div className="text-xs text-gray-400 mt-0.5">{t.description}</div>}
                </div>
                <button onClick={() => handleDeleteTicketType(t.id)} className="text-xs text-red-500 hover:underline ml-4">Delete</button>
              </div>
            ))}
          </div>
        )}

        {/* Add new ticket type form */}
        {showTtForm && (
          <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-700">New Ticket Type</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                <input className="input text-sm" placeholder="e.g. General, VIP" value={newTt.name} onChange={(e) => setNewTt((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Price (KES) *</label>
                <input type="number" min="0" className="input text-sm" placeholder="0 for free" value={newTt.price} onChange={(e) => setNewTt((f) => ({ ...f, price: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Quantity (leave blank for unlimited)</label>
                <input type="number" min="1" className="input text-sm" placeholder="Unlimited" value={newTt.quantity} onChange={(e) => setNewTt((f) => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
                <input className="input text-sm" placeholder="What's included?" value={newTt.description} onChange={(e) => setNewTt((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <button onClick={handleAddTicketType} disabled={addingTt} className="btn-primary w-full text-sm">
              {addingTt ? 'Adding...' : 'Add Ticket Type'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
