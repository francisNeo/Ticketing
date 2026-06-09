import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { notificationsApi, bundlesApi } from '../../api/client';

export default function NotificationCentre() {
  const { id } = useParams();
  const [balance, setBalance] = useState(null);
  const [sends, setSends] = useState([]);
  const [form, setForm] = useState({ channel: 'sms', message: '' });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    bundlesApi.balance().then(({ data }) => setBalance(data)).catch(console.error);
    notificationsApi.list(id).then(({ data }) => setSends(Array.isArray(data) ? data : [])).catch(console.error);
  }, [id]);

  const handlePreview = async () => {
    try {
      const { data } = await notificationsApi.preview(id, form);
      setPreview(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSend = async () => {
    if (!preview) { setError('Click Preview first'); return; }
    setBusy(true); setError(''); setSuccess('');
    try {
      await notificationsApi.send(id, form);
      setSuccess(`Notification queued to ${preview.recipientCount} attendees!`);
      setPreview(null);
      setForm({ channel: 'sms', message: '' });
      notificationsApi.list(id).then(({ data }) => setSends(Array.isArray(data) ? data : [])).catch(console.error);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Notification Centre</h1>

      {balance && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="card p-4">
            <div className="text-2xl font-bold text-gray-900">{balance.smsUnits}</div>
            <div className="text-sm text-gray-500 mt-1">SMS units remaining</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold text-gray-900">{balance.emailUnits}</div>
            <div className="text-sm text-gray-500 mt-1">Email units remaining</div>
          </div>
        </div>
      )}

      <div className="card p-6 mb-8">
        <h2 className="font-semibold text-gray-900 mb-4">Send Notification</h2>
        {error && <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
        {success && <div className="mb-3 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Channel</label>
            <div className="flex gap-3">
              {[{ v: 'sms', l: '📱 SMS' }, { v: 'email', l: '📧 Email' }, { v: 'both', l: '📱+📧 Both' }].map((o) => (
                <button type="button" key={o.v} onClick={() => setForm({ ...form, channel: o.v })}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${form.channel === o.v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
            <textarea className="input min-h-[100px] resize-none" placeholder="Hi! Just a reminder that our event starts tomorrow at 10am..." value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">{form.message.length} characters</p>
          </div>

          {preview && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
              <div className="font-medium text-blue-800">Preview</div>
              <div className="text-blue-700 mt-1">{preview.recipientCount} recipients · {preview.estimatedUnits} units required</div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handlePreview} className="btn-secondary">Preview</button>
            <button onClick={handleSend} disabled={busy || !preview} className="btn-primary">
              {busy ? 'Sending...' : `Send to ${preview?.recipientCount || '?'} attendees`}
            </button>
          </div>
        </div>
      </div>

      {sends.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 font-semibold text-gray-900">Send History</div>
          <div className="divide-y divide-gray-50">
            {sends.map((s) => (
              <div key={s.id} className="px-6 py-4 flex items-center justify-between text-sm">
                <div>
                  <div className="text-gray-800 line-clamp-1">{s.message}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.channel} · {s.recipientCount} recipients</div>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-medium ${s.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`}>{s.status}</div>
                  <div className="text-xs text-gray-400">{s.deliveredCount}/{s.recipientCount} delivered</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
