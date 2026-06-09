import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { registrationsApi, paymentsApi } from '../api/client';

export default function Checkout() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState('card'); // card | mpesa
  const [registration, setRegistration] = useState(null);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [status, setStatus] = useState('idle'); // idle | creating | polling | done | error
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!state?.verifiedToken) { navigate('/'); return; }
    // Create registration on mount
    setStatus('creating');
    registrationsApi.create({
      eventId: state.eventId,
      ticketTypeId: state.form.ticketTypeId,
      quantity: state.form.quantity,
      attendeeName: state.form.name,
      attendeeEmail: state.form.email,
      attendeePhone: state.form.phone,
      attendeeNames: state.attendeeNames || [],
      verifiedToken: state.verifiedToken,
    })
      .then(({ data }) => {
        if (!data.requiresPayment) {
          // Free event — go straight to the ticket
          navigate(`/tickets/${data.registration.id}`, { state: { confirmed: true } });
        } else {
          setRegistration(data.registration);
          setStatus('idle');
        }
      })
      .catch((err) => { setError(err.message); setStatus('error'); });
  }, []);

  const pollStatus = (registrationId) => {
    setStatus('polling');
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const { data } = await paymentsApi.pollStatus(registrationId);
        if (data.status === 'completed') {
          clearInterval(interval);
          navigate(`/tickets/${registrationId}`, { state: { confirmed: true } });
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setError('Payment failed or was cancelled. Please try again.');
          setStatus('idle');
        } else if (attempts >= 30) {
          clearInterval(interval);
          setError('Payment timed out. Check your M-PESA messages and try again.');
          setStatus('idle');
        }
      } catch { clearInterval(interval); setStatus('idle'); }
    }, 3000);
  };

  const payMpesa = async () => {
    if (!mpesaPhone.match(/^2547\d{8}$/)) { setError('Enter phone as 2547XXXXXXXX'); return; }
    setError('');
    setStatus('creating');
    try {
      await paymentsApi.mpesaStkPush({ registrationId: registration.id, phone: mpesaPhone });
      setMessage('Check your phone — enter your M-PESA PIN to complete payment.');
      pollStatus(registration.id);
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  if (status === 'creating' && !registration) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>;
  }

  if (status === 'error' && !registration) {
    return <div className="text-center py-20 text-red-500">{error}</div>;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Complete Payment</h1>

      <div className="card p-6 mb-6">
        <div className="text-sm text-gray-500">Registration ID</div>
        <div className="font-mono font-medium text-gray-800">{registration?.id?.slice(0, 8).toUpperCase()}</div>
      </div>

      <div className="card overflow-hidden">
        {/* Tab switcher */}
        <div className="flex border-b border-gray-100">
          {[{ id: 'card', label: '💳 Pay by Card' }, { id: 'mpesa', label: '📱 M-PESA' }].map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(''); setMessage(''); }}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors ${tab === t.id ? 'border-b-2 border-brand-600 text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
          {message && <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">{message}</div>}

          {tab === 'card' && (
            <div className="text-center py-6">
              <p className="text-gray-500 text-sm mb-4">Stripe card payment integration requires the Stripe publishable key to be configured in your .env file.</p>
              <p className="text-xs text-gray-400">VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...</p>
              <div className="mt-4 bg-gray-50 rounded-lg p-4 text-xs text-gray-500">
                Supports Visa, Mastercard. Card details handled securely by Stripe.
              </div>
            </div>
          )}

          {tab === 'mpesa' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Enter your Safaricom M-PESA number to receive an STK Push prompt.</p>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">M-PESA Phone Number</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="2547XXXXXXXX"
                  value={mpesaPhone}
                  onChange={(e) => setMpesaPhone(e.target.value.replace(/\D/g, ''))}
                  maxLength={12}
                />
                <p className="text-xs text-gray-400 mt-1">Format: 2547XXXXXXXX (no + sign)</p>
              </div>

              {status === 'polling' ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">Waiting for payment confirmation...</p>
                  <p className="text-xs text-gray-400 mt-1">Enter your M-PESA PIN on your phone</p>
                </div>
              ) : (
                <button onClick={payMpesa} disabled={status !== 'idle'} className="btn-primary w-full">
                  Send STK Push
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
