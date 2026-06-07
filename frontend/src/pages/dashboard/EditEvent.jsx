import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi } from '../../api/client';
import api from '../../api/client';

export default function EditEvent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/events/${id}`).then(({ data }) => setForm({
      title: data.title || '', description: data.description || '',
      startsAt: data.startsAt?.slice(0, 16) || '', endsAt: data.endsAt?.slice(0, 16) || '',
      locationType: data.locationType || 'physical', locationText: data.locationText || '',
      category: data.category || '', tags: (data.tags || []).join(', '),
      maxCapacity: data.maxCapacity || '',
    })).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await eventsApi.update(id, { ...form, tags: form.tags ? form.tags.split(',').map((t) => t.trim()) : [], maxCapacity: form.maxCapacity ? parseInt(form.maxCapacity) : null });
      navigate('/dashboard/events');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Edit Event</h1>
      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      <div className="card p-6 space-y-5">
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags (comma-separated)</label>
            <input className="input" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate('/dashboard/events')} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}
