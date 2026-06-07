import { useState, useEffect } from 'react';
import { bundlesApi } from '../../api/client';

export default function BundleStore() {
  const [bundles, setBundles] = useState([]);
  const [balance, setBalance] = useState(null);
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [payMethod, setPayMethod] = useState('mpesa');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    bundlesApi.list().then(({ data }) => setBundles(data)).catch(console.error);
    bundlesApi.balance().then(({ data }) => setBalance(data)).catch(console.error);
  }, []);

  const purchase = async () => {
    if (!selectedBundle) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (payMethod === 'mpesa') {
        if (!mpesaPhone.match(/^2547\d{8}$/)) { setError('Phone format: 2547XXXXXXXX'); setBusy(false); return; }
        await bundlesApi.purchaseMpesa(selectedBundle.id, mpesaPhone);
        setMessage('STK Push sent! Enter M-PESA PIN to complete purchase. Units will be credited within minutes.');
      } else {
        setMessage('Stripe card payment for bundles requires the full Stripe Elements integration. Check your .env for VITE_STRIPE_PUBLISHABLE_KEY.');
      }
      setSelectedBundle(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Purchase failed');
    } finally {
      setBusy(false);
    }
  };

  const smsBundles = bundles.filter((b) => b.channel === 'sms');
  const emailBundles = bundles.filter((b) => b.channel === 'email');

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Bundle Store</h1>
      <p className="text-gray-500 text-sm mb-8">Purchase SMS or email units to send notifications to your attendees</p>

      {balance && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="card p-4 border-l-4 border-blue-500">
            <div className="text-2xl font-bold text-gray-900">{balance.smsUnits}</div>
            <div className="text-sm text-gray-500">SMS units available</div>
          </div>
          <div className="card p-4 border-l-4 border-purple-500">
            <div className="text-2xl font-bold text-gray-900">{balance.emailUnits}</div>
            <div className="text-sm text-gray-500">Email units available</div>
          </div>
        </div>
      )}

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {message && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{message}</div>}

      {[{ label: '📱 SMS Bundles', bundles: smsBundles }, { label: '📧 Email Bundles', bundles: emailBundles }].map(({ label, bundles: list }) => (
        <div key={label} className="mb-8">
          <h2 className="font-semibold text-gray-900 mb-4">{label}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {list.map((b) => (
              <div key={b.id} className={`card p-5 cursor-pointer transition-all ${selectedBundle?.id === b.id ? 'ring-2 ring-brand-500' : 'hover:shadow-md'}`}
                onClick={() => setSelectedBundle(b)}>
                <div className="font-semibold text-gray-900">{b.name}</div>
                <div className="text-2xl font-bold text-brand-600 mt-2">{b.units.toLocaleString()}</div>
                <div className="text-sm text-gray-500">units</div>
                <div className="mt-3 text-lg font-bold text-gray-900">KES {Number(b.price).toLocaleString()}</div>
                <div className="text-xs text-gray-400">~KES {(Number(b.price) / b.units).toFixed(2)} per unit</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {selectedBundle && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Purchase: {selectedBundle.name} — KES {Number(selectedBundle.price).toLocaleString()}</h3>
          <div className="flex gap-3 mb-4">
            {[{ v: 'mpesa', l: '📱 M-PESA' }, { v: 'card', l: '💳 Card' }].map((o) => (
              <button key={o.v} onClick={() => setPayMethod(o.v)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${payMethod === o.v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600'}`}>
                {o.l}
              </button>
            ))}
          </div>
          {payMethod === 'mpesa' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">M-PESA Phone</label>
              <input className="input max-w-xs" placeholder="2547XXXXXXXX" value={mpesaPhone} onChange={(e) => setMpesaPhone(e.target.value.replace(/\D/g, ''))} maxLength={12} />
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => setSelectedBundle(null)} className="btn-secondary">Cancel</button>
            <button onClick={purchase} disabled={busy} className="btn-primary">{busy ? 'Processing...' : 'Pay Now'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
