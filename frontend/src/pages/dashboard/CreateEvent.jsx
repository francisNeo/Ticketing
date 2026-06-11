import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { eventsApi, ticketTypesApi } from '../../api/client';
import ShareLink from '../../components/ShareLink';

const CAPTCHA_SITE_KEY = import.meta.env.VITE_CAPTCHA_SITE_KEY || '10000000-ffff-ffff-ffff-000000000001';

const CATEGORIES = [
  { value: '', label: 'Select a category' },
  { value: 'Church & Religious', label: '⛪ Church & Religious', church: true },
  { value: 'Tech', label: '💻 Tech' },
  { value: 'Music', label: '🎵 Music' },
  { value: 'Health', label: '❤️ Health & Wellness' },
  { value: 'Business', label: '💼 Business' },
  { value: 'Sports', label: '⚽ Sports' },
  { value: 'Arts', label: '🎨 Arts & Culture' },
  { value: 'Education', label: '📚 Education' },
  { value: 'Food', label: '🍽️ Food & Drink' },
  { value: 'Community', label: '🤝 Community' },
  { value: 'Charity', label: '🙏 Charity & Fundraising' },
];

const RECURRENCE_OPTIONS = [
  { value: '', label: 'One-time event (no recurrence)' },
  { value: 'WEEKLY:SUNDAY', label: 'Every Sunday' },
  { value: 'WEEKLY:MONDAY', label: 'Every Monday' },
  { value: 'WEEKLY:TUESDAY', label: 'Every Tuesday' },
  { value: 'WEEKLY:WEDNESDAY', label: 'Every Wednesday' },
  { value: 'WEEKLY:THURSDAY', label: 'Every Thursday' },
  { value: 'WEEKLY:FRIDAY', label: 'Every Friday' },
  { value: 'WEEKLY:SATURDAY', label: 'Every Saturday' },
  { value: 'BIWEEKLY', label: 'Every two weeks' },
  { value: 'MONTHLY:FIRST_SUNDAY', label: 'First Sunday of every month' },
  { value: 'MONTHLY:LAST_SUNDAY', label: 'Last Sunday of every month' },
  { value: 'MONTHLY', label: 'Monthly (same date)' },
];

export default function CreateEvent() {
  const navigate = useNavigate();

  // Church config — fetched from API, falls back to empty arrays gracefully
  const [churchConfig, setChurchConfig] = useState({ service_type: [], denomination: [], dress_code: [] });
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    api.get('/church-config')
      .then(({ data }) => setChurchConfig({
        service_type: data.service_type || [],
        denomination: data.denomination || [],
        dress_code: data.dress_code || [],
      }))
      .catch(() => { /* use empty arrays — form still works */ })
      .finally(() => setConfigLoading(false));
  }, []);

  const [form, setForm] = useState({
    title: '', description: '', startsAt: '', endsAt: '',
    locationType: 'physical', locationText: '', visibility: 'public',
    isFree: true, currency: 'KES', category: '', tags: '',
    maxCapacity: '', registrationDeadline: '',
    // Church-specific
    serviceType: '', ministry: '', denomination: '', dressCode: '', recurrenceRule: '',
  });
  const [ticketTypes, setTicketTypes] = useState([{ name: 'General Admission', price: 0, quantity: '', isNamed: false }]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: details, 2: tickets, 3: review, 4: success
  const [publishedEvent, setPublishedEvent] = useState(null);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const isChurch = form.category === 'Church & Religious';

  const addTicket = () => setTicketTypes([...ticketTypes, { name: '', price: 0, quantity: '' }]);
  const updateTicket = (i, key, val) => setTicketTypes(ticketTypes.map((t, idx) => idx === i ? { ...t, [key]: val } : t));
  const removeTicket = (i) => setTicketTypes(ticketTypes.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    const captchaToken = window._captchaToken || '10000000-aaaa-bbbb-cccc-000000000001';
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        maxCapacity: form.maxCapacity ? parseInt(form.maxCapacity) : undefined,
        isFree: form.isFree === true,
        captchaToken,
        serviceType: form.serviceType || undefined,
        ministry: form.ministry || undefined,
        denomination: form.denomination || undefined,
        dressCode: form.dressCode || undefined,
        recurrenceRule: form.recurrenceRule || undefined,
      };

      const { data: event } = await eventsApi.create(payload);

      if (!form.isFree) {
        for (const tt of ticketTypes) {
          await ticketTypesApi.create(event.id, {
            ...tt,
            price: Number(tt.price),
            quantity: tt.quantity ? parseInt(tt.quantity) : undefined,
            isNamed: !!tt.isNamed,
          });
        }
      }

      const { data: published } = await eventsApi.publish(event.id);
      setPublishedEvent(published);
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Event</h1>
      <p className="text-gray-500 text-sm mb-8">Fill in the details to publish your event</p>

      {/* Steps */}
      <div className="flex gap-4 mb-8">
        {['Event Details', 'Tickets', 'Review & Publish'].map((s, i) => (
          <div key={s} className={`flex-1 text-center text-xs font-medium py-2 rounded-lg transition-colors ${step === i + 1 ? 'bg-brand-600 text-white' : step > i + 1 ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-400'}`}>
            {i + 1}. {s}
          </div>
        ))}
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* ─── STEP 1: Event Details ─── */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="card p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Event Category *</label>
              <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Event Title *</label>
              <input className="input" placeholder={isChurch ? 'Sunday Morning Service' : 'My Awesome Event'} value={form.title} onChange={(e) => set('title', e.target.value)} required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea className="input min-h-[100px] resize-none"
                placeholder={isChurch ? "Join us for worship, word and fellowship…" : "What's this event about?"}
                value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date & Time *</label>
                <input type="datetime-local" className="input" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date & Time</label>
                <input type="datetime-local" className="input" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Location Type</label>
              <div className="flex gap-3">
                {[{ v: 'physical', l: '📍 Physical' }, { v: 'virtual', l: '💻 Virtual / Online' }].map((o) => (
                  <button type="button" key={o.v} onClick={() => set('locationType', o.v)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${form.locationType === o.v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{form.locationType === 'virtual' ? 'Meeting / Stream Link' : 'Venue / Address'}</label>
              <input className="input"
                placeholder={form.locationType === 'virtual' ? 'https://youtube.com/live/...' : isChurch ? 'St. Paul\'s Cathedral, Nairobi CBD' : 'KICC, Nairobi'}
                value={form.locationText} onChange={(e) => set('locationText', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Visibility</label>
                <select className="input" value={form.visibility} onChange={(e) => set('visibility', e.target.value)}>
                  <option value="public">Public — Listed on portal</option>
                  <option value="private">Private — Link only</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Capacity</label>
                <input type="number" className="input" placeholder="Unlimited" value={form.maxCapacity} onChange={(e) => set('maxCapacity', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags <span className="text-gray-400 text-xs">(comma-separated)</span></label>
              <input className="input" placeholder={isChurch ? 'worship, prayer, youth' : 'networking, ai, startup'} value={form.tags} onChange={(e) => set('tags', e.target.value)} />
            </div>
          </div>

          {/* ─── Church-specific section ─── */}
          {isChurch && (
            <div className="card p-6 space-y-5 border-2 border-brand-100">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">⛪</span>
                <h2 className="font-semibold text-gray-900">Church Event Details</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Service / Event Type</label>
                  <select className="input" value={form.serviceType} onChange={(e) => set('serviceType', e.target.value)} disabled={configLoading}>
                    <option value="">{configLoading ? 'Loading…' : 'Select type'}</option>
                    {churchConfig.service_type.map((t) => <option key={t.id} value={t.value}>{t.value}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Denomination</label>
                  <select className="input" value={form.denomination} onChange={(e) => set('denomination', e.target.value)} disabled={configLoading}>
                    <option value="">{configLoading ? 'Loading…' : 'Select denomination'}</option>
                    {churchConfig.denomination.map((d) => <option key={d.id} value={d.value}>{d.value}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Ministry / Department</label>
                  <input className="input" placeholder="e.g. Youth Ministry, Choir" value={form.ministry} onChange={(e) => set('ministry', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Dress Code</label>
                  <select className="input" value={form.dressCode} onChange={(e) => set('dressCode', e.target.value)} disabled={configLoading}>
                    <option value="">{configLoading ? 'Loading…' : 'Not specified'}</option>
                    {churchConfig.dress_code.map((d) => <option key={d.id} value={d.value}>{d.value}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Recurrence</label>
                <select className="input" value={form.recurrenceRule} onChange={(e) => set('recurrenceRule', e.target.value)}>
                  {RECURRENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {form.recurrenceRule && (
                  <p className="text-xs text-blue-600 mt-1.5 bg-blue-50 rounded px-3 py-2">
                    ℹ️ This creates a single event instance. You can re-use this form for each occurrence, or duplicate the event later.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Age Group</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: 'All Ages', min: undefined, max: undefined },
                    { label: 'Children (0–12)', min: 0, max: 12 },
                    { label: 'Youth (13–25)', min: 13, max: 25 },
                    { label: 'Adults (18+)', min: 18, max: undefined },
                    { label: 'Seniors (60+)', min: 60, max: undefined },
                  ].map((ag) => {
                    const active = form.minAge === ag.min && form.maxAge === ag.max;
                    return (
                      <button type="button" key={ag.label}
                        onClick={() => { set('minAge', ag.min); set('maxAge', ag.max); }}
                        className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-colors ${active ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600 hover:border-brand-400'}`}>
                        {ag.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              if (!form.title || !form.startsAt) { setError('Title and start date are required'); return; }
              setError(''); setStep(2);
            }}
            className="btn-primary w-full"
          >
            Next: Ticket Setup →
          </button>
        </div>
      )}

      {/* ─── STEP 2: Tickets ─── */}
      {step === 2 && (
        <div className="card p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Pricing</label>
            <div className="flex gap-3">
              {[
                { v: true, l: isChurch ? '🙏 Free / Offering' : '🎁 Free Event' },
                { v: false, l: '💰 Paid Event' },
              ].map((o) => (
                <button type="button" key={String(o.v)} onClick={() => set('isFree', o.v)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${form.isFree === o.v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {o.l}
                </button>
              ))}
            </div>
            {isChurch && form.isFree && (
              <p className="text-xs text-gray-500 mt-2">Attendance is free. Offerings or donations can be collected at the venue.</p>
            )}
          </div>

          {!form.isFree && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Ticket Types</label>
                <button type="button" onClick={addTicket} className="text-xs text-brand-600 hover:underline">+ Add type</button>
              </div>
              {ticketTypes.map((tt, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Ticket {i + 1}</span>
                    {ticketTypes.length > 1 && <button type="button" onClick={() => removeTicket(i)} className="text-xs text-red-500 hover:underline">Remove</button>}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block text-xs text-gray-600 mb-1">Name</label>
                      <input className="input text-sm" placeholder="VIP" value={tt.name} onChange={(e) => updateTicket(i, 'name', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Price (KES)</label>
                      <input type="number" min="0" className="input text-sm" value={tt.price} onChange={(e) => updateTicket(i, 'price', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Qty (blank=∞)</label>
                      <input type="number" min="1" className="input text-sm" placeholder="∞" value={tt.quantity} onChange={(e) => updateTicket(i, 'quantity', e.target.value)} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer mt-1 w-fit">
                    <input type="checkbox" className="accent-brand-600"
                      checked={!!tt.isNamed} onChange={(e) => updateTicket(i, 'isNamed', e.target.checked)} />
                    <span className="text-xs text-gray-700 font-medium">Named ticket — require attendee names at registration</span>
                  </label>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Registration Deadline</label>
            <input type="datetime-local" className="input" value={form.registrationDeadline} onChange={(e) => set('registrationDeadline', e.target.value)} />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>
            <button onClick={() => setStep(3)} className="btn-primary flex-1">Review & Publish →</button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: Review ─── */}
      {step === 3 && (
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Review before publishing</h2>
          <div className="divide-y divide-gray-50 text-sm">
            {[
              ['Title', form.title],
              ['Category', form.category || '—'],
              ['Date', form.startsAt],
              ['Location', form.locationText || '—'],
              ['Visibility', form.visibility],
              ['Pricing', form.isFree ? (isChurch ? 'Free / Offering' : 'Free') : `${ticketTypes.length} ticket type(s)`],
              ...(isChurch ? [
                ['Service Type', form.serviceType || '—'],
                ['Ministry', form.ministry || '—'],
                ['Denomination', form.denomination || '—'],
                ['Dress Code', form.dressCode || 'Not specified'],
                ['Recurrence', RECURRENCE_OPTIONS.find((o) => o.value === form.recurrenceRule)?.label || 'One-time'],
              ] : []),
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between py-2">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-right max-w-[60%]">{val}</span>
              </div>
            ))}
          </div>

          {/* hCaptcha sandbox */}
          <div className="h-captcha" data-sitekey={CAPTCHA_SITE_KEY} data-callback="onCaptchaSuccess" />
          <script dangerouslySetInnerHTML={{ __html: `function onCaptchaSuccess(t){window._captchaToken=t;}` }} />

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="btn-secondary flex-1">← Back</button>
            <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1">
              {loading ? 'Publishing...' : '🚀 Publish Event'}
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 4: Success ─── */}
      {step === 4 && publishedEvent && (() => {
        const shareUrl = `${window.location.origin}/e/${publishedEvent.visibility === 'private' ? publishedEvent.privateToken : publishedEvent.slug}`;
        return (
          <div className="card p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Event Published!</h2>
              <p className="text-gray-500 mt-1">Share this link with your congregation so they can register.</p>
            </div>
            <ShareLink url={shareUrl} label="Attendee registration link" />
            <div className="flex gap-3 pt-2">
              <Link to="/dashboard/events" className="btn-secondary flex-1">Go to Dashboard</Link>
              <Link to={`/e/${publishedEvent.visibility === 'private' ? publishedEvent.privateToken : publishedEvent.slug}`} className="btn-primary flex-1">Preview Event</Link>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
