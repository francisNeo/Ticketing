import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { eventsApi, otpApi, registrationsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ShareLink from '../components/ShareLink';

const RECURRENCE_LABELS = {
  'WEEKLY:SUNDAY': 'Every Sunday', 'WEEKLY:MONDAY': 'Every Monday',
  'WEEKLY:TUESDAY': 'Every Tuesday', 'WEEKLY:WEDNESDAY': 'Every Wednesday',
  'WEEKLY:THURSDAY': 'Every Thursday', 'WEEKLY:FRIDAY': 'Every Friday',
  'WEEKLY:SATURDAY': 'Every Saturday', 'BIWEEKLY': 'Every two weeks',
  'MONTHLY:FIRST_SUNDAY': 'First Sunday of every month',
  'MONTHLY:LAST_SUNDAY': 'Last Sunday of every month',
  'MONTHLY': 'Monthly',
};
const recurrenceLabel = (rule) => RECURRENCE_LABELS[rule] || rule;

export default function EventDetail() {
  const { slugOrToken } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAdmin } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  // ?register=1 in URL jumps straight to the registration form
  const [step, setStep] = useState(searchParams.get('register') === '1' ? 'register' : 'info'); // info | register | bulk
  const [form, setForm] = useState({ name: '', email: '', phone: '', ticketTypeId: '', quantity: 1 });
  const [attendeeNames, setAttendeeNames] = useState(['']); // one entry per ticket slot
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkPreview, setBulkPreview] = useState(null); // parsed rows for preview
  const [bulkError, setBulkError] = useState('');
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const fileInputRef = useRef(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    eventsApi.get(slugOrToken)
      .then(({ data }) => { setEvent(data); if (data.ticketTypes?.[0]) setForm((f) => ({ ...f, ticketTypeId: data.ticketTypes[0].id })); })
      .catch(() => setLoading(false))
      .finally(() => setLoading(false));
  }, [slugOrToken]);

  const selectedTicketType = event?.ticketTypes?.find((t) => t.id === form.ticketTypeId);
  const isNamed = !!selectedTicketType?.isNamed;

  // Bulk upload is restricted to: platform admins or the event's own organiser
  const canBulkUpload = isAdmin() || (user && event && event.organiser?.id === user.id);

  // Keep attendeeNames array in sync with quantity
  const syncNames = (qty) => {
    setAttendeeNames((prev) => {
      const arr = [...prev];
      while (arr.length < qty) arr.push('');
      return arr.slice(0, qty);
    });
  };

  const setQty = (qty) => {
    setForm((f) => ({ ...f, quantity: qty }));
    syncNames(qty);
  };

  const setTicketType = (id) => {
    setForm((f) => ({ ...f, ticketTypeId: id }));
    syncNames(form.quantity);
  };

  const handleRegister = async () => {
    setError('');
    if (!form.name || !form.email || !form.phone) { setError('Please fill in your name, email and phone number'); return; }
    // Use selected ticket type or fall back to first available
    const ticketTypeId = form.ticketTypeId || event?.ticketTypes?.[0]?.id;
    if (isNamed) {
      const empty = attendeeNames.findIndex((n) => !n.trim());
      if (empty !== -1) { setError(`Please enter the name for attendee ${empty + 1}`); return; }
    }
    setBusy(true);
    try {
      const { data: tokenData } = await otpApi.autoVerify({ phone: form.phone, eventId: event.id });

      if (event.isFree) {
        // Free event — register immediately, skip checkout
        const { data: reg } = await registrationsApi.create({
          eventId: event.id,
          ticketTypeId,
          quantity: form.quantity,
          attendeeName: form.name,
          attendeeEmail: form.email,
          attendeePhone: form.phone,
          attendeeNames: isNamed ? attendeeNames : [],
          verifiedToken: tokenData.verifiedToken,
        });
        navigate(`/tickets/${reg.registration.id}`, { state: { confirmed: true } });
      } else {
        // Paid event — go to checkout
        navigate(`/e/${slugOrToken}/checkout`, {
          state: {
            form: { ...form, ticketTypeId },
            attendeeNames: isNamed ? attendeeNames : [],
            verifiedToken: tokenData.verifiedToken,
            eventId: event.id,
          },
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ── Excel / CSV bulk upload ──────────────────────────────────────────────

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFile(file);
    setBulkError('');
    setBulkResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const sheetName = wb.SheetNames.includes('Attendees') ? 'Attendees' : wb.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
        setBulkPreview(rows.slice(0, 5)); // show first 5 as preview
        if (rows.length === 0) setBulkError('No rows found in the file.');
      } catch {
        setBulkError('Could not read the file. Make sure it is a valid .xlsx or .csv.');
        setBulkPreview(null);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) return;
    setBulkUploading(true);
    setBulkError('');
    const fd = new FormData();
    fd.append('file', bulkFile);
    // Only send contact fields when present — backend stores null when absent
    if (form.email) fd.append('registrantEmail', form.email);
    if (form.phone) fd.append('registrantPhone', form.phone);
    try {
      const { data } = await registrationsApi.bulkRegister(event.id, fd);
      setBulkResult(data);
    } catch (err) {
      setBulkError(err.message);
      const errors = err.response?.data?.errors;
      if (Array.isArray(errors) && errors.length) setBulkPreview(errors.map((e) => ({ error: e })));
    } finally {
      setBulkUploading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>;
  if (!event) return <div className="text-center py-20 text-gray-400">Event not found</div>;

  const selectedTicket = selectedTicketType;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 lg:grid lg:grid-cols-3 lg:gap-10">
      {/* Event info */}
      <div className="lg:col-span-2 space-y-6">
        <div className="rounded-xl overflow-hidden h-64 bg-gradient-to-br from-brand-600 to-blue-700">
          {event.bannerUrl && <img src={event.bannerUrl} alt={event.title} className="w-full h-full object-cover" />}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {event.category && <span className="text-xs font-medium text-brand-600 uppercase tracking-wide">{event.category}</span>}
            {event.visibility === 'private' && (
              <span className="text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full">
                🔒 Private Event — invite only
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mt-1">{event.title}</h1>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1.5">
              📅 {format(new Date(event.startsAt), 'EEEE, MMMM d, yyyy · h:mm a')}
            </span>
            {event.endsAt && (
              <span className="flex items-center gap-1.5">
                🕐 Until {format(new Date(event.endsAt), 'h:mm a')}
              </span>
            )}
            {event.locationText && <span className="flex items-center gap-1.5">📍 {event.locationText}</span>}
            <span className="flex items-center gap-1.5">👤 {event.organiser?.name}</span>
          </div>

          {/* Church-specific details */}
          {event.category === 'Church & Religious' && (
            <div className="mt-5 grid grid-cols-2 gap-3">
              {event.serviceType && (
                <div className="bg-brand-50 rounded-lg px-4 py-3">
                  <div className="text-xs font-semibold text-brand-600 uppercase tracking-wide mb-0.5">Service Type</div>
                  <div className="text-sm font-medium text-gray-900">{event.serviceType}</div>
                </div>
              )}
              {event.denomination && (
                <div className="bg-purple-50 rounded-lg px-4 py-3">
                  <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-0.5">Denomination</div>
                  <div className="text-sm font-medium text-gray-900">{event.denomination}</div>
                </div>
              )}
              {event.ministry && (
                <div className="bg-blue-50 rounded-lg px-4 py-3">
                  <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-0.5">Ministry</div>
                  <div className="text-sm font-medium text-gray-900">{event.ministry}</div>
                </div>
              )}
              {event.dressCode && (
                <div className="bg-amber-50 rounded-lg px-4 py-3">
                  <div className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-0.5">Dress Code</div>
                  <div className="text-sm font-medium text-gray-900">{event.dressCode}</div>
                </div>
              )}
              {event.recurrenceRule && (
                <div className="bg-green-50 rounded-lg px-4 py-3 col-span-2">
                  <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-0.5">Recurrence</div>
                  <div className="text-sm font-medium text-gray-900">{recurrenceLabel(event.recurrenceRule)}</div>
                </div>
              )}
              {(event.minAge || event.maxAge) && (
                <div className="bg-gray-50 rounded-lg px-4 py-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Age Group</div>
                  <div className="text-sm font-medium text-gray-900">
                    {event.minAge && event.maxAge ? `${event.minAge}–${event.maxAge} years`
                      : event.minAge ? `${event.minAge}+ years` : `Up to ${event.maxAge} years`}
                  </div>
                </div>
              )}
            </div>
          )}

          {event.description && <p className="mt-6 text-gray-600 leading-relaxed whitespace-pre-wrap">{event.description}</p>}
        </div>

        {event.sponsors?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Sponsors</h3>
            <div className="flex gap-4 flex-wrap">
              {event.sponsors.map((s) => (
                <div key={s.id} className="text-sm text-gray-600">{s.name}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Registration panel */}
      <div className="mt-8 lg:mt-0">
        <div className="card p-6 sticky top-24">
          <h2 className="font-bold text-gray-900 text-lg mb-4">
            {event.category === 'Church & Religious'
              ? (event.isFree ? '⛪ Register to Attend' : '🎟️ Get Tickets')
              : (event.isFree ? 'Free Registration' : 'Get Tickets')}
          </h2>

          {step === 'info' && (
            <div className="space-y-3">
              {event.ticketTypes?.map((t) => (
                <div key={t.id} className="p-3 border rounded-lg text-sm">
                  <div className="font-medium text-gray-800">{t.name}</div>
                  <div className="text-brand-600 font-bold mt-0.5">
                    {Number(t.price) === 0 ? 'Free' : `KES ${Number(t.price).toLocaleString()}`}
                  </div>
                  {t.description && <div className="text-gray-500 text-xs mt-0.5">{t.description}</div>}
                </div>
              ))}
              {!event.isFree && (!event.ticketTypes || event.ticketTypes.length === 0) && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                  Ticket types have not been configured for this event yet. Please contact the organiser.
                </div>
              )}
              <button
                onClick={() => setStep('register')}
                disabled={!event.isFree && (!event.ticketTypes || event.ticketTypes.length === 0)}
                className="btn-primary w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Register Now
              </button>

              {/* Share this event */}
              <div className="pt-2 border-t border-gray-100">
                <details className="group">
                  <summary className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-700 list-none select-none py-1">
                    <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    Share this event
                  </summary>
                  <div className="mt-3">
                    <ShareLink
                      url={`${window.location.origin}/e/${slugOrToken}?register=1`}
                      label="Share registration link"
                      eventTitle={event.title}
                    />
                  </div>
                </details>
              </div>
            </div>
          )}

          {step === 'register' && (
            <div className="space-y-4">
              {/* Your details */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Your Full Name</label>
                <input className="input text-sm" placeholder="Jane Doe" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="input text-sm" placeholder="you@example.com" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" className="input text-sm" placeholder="+254700000000" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>

              {/* Ticket selection — show for paid events only */}
              {event.ticketTypes?.some((t) => Number(t.price) > 0) && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Ticket Type</label>
                  {event.ticketTypes.map((t) => (
                    <label key={t.id} className={`flex items-center justify-between p-3 border rounded-lg mb-2 cursor-pointer transition-colors ${form.ticketTypeId === t.id ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <input type="radio" name="ticket" value={t.id} checked={form.ticketTypeId === t.id}
                          onChange={() => setTicketType(t.id)} className="text-brand-600 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-gray-800">{t.name}</span>
                          {t.isNamed && <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Named</span>}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-brand-600 shrink-0 ml-2">
                        {Number(t.price) === 0 ? 'Free' : `KES ${Number(t.price).toLocaleString()}`}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* Quantity — only show for paid events */}
              {Number(selectedTicketType?.price) > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
                  <select className="input text-sm" value={form.quantity}
                    onChange={(e) => setQty(parseInt(e.target.value))}>
                    {[1,2,3,4,5,6,7,8,9,10].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              )}

              {/* Named-ticket: attendee name fields */}
              {isNamed && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-amber-700">
                      Attendee Names <span className="text-red-500">*</span>
                    </label>
                    {form.quantity > 3 && canBulkUpload && (
                      <button
                        type="button"
                        onClick={() => setStep('bulk')}
                        className="text-xs text-brand-600 hover:underline font-medium"
                      >
                        Upload Excel instead →
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-amber-600 bg-amber-50 rounded px-3 py-2">
                    This is a named ticket. Enter the full name for each attendee.
                  </p>
                  {attendeeNames.map((name, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5 text-right shrink-0">{idx + 1}</span>
                      <input
                        className="input text-sm flex-1"
                        placeholder={idx === 0 ? `${form.name || 'Attendee 1'} (you)` : `Attendee ${idx + 1} name`}
                        value={name}
                        onChange={(e) => {
                          const arr = [...attendeeNames];
                          arr[idx] = e.target.value;
                          setAttendeeNames(arr);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {selectedTicket && Number(selectedTicket.price) > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-bold">KES {(Number(selectedTicket.price) * form.quantity).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {error && <p className="text-red-600 text-xs">{error}</p>}
              <button onClick={handleRegister} disabled={busy} className="btn-primary w-full text-sm">
                {busy ? 'Please wait...' : event.isFree ? 'Confirm Registration' : 'Proceed to Payment'}
              </button>

              {/* Bulk upload link — only visible to admins and the event organiser */}
              {canBulkUpload && (
                <button
                  type="button"
                  onClick={() => setStep('bulk')}
                  className="text-xs text-gray-500 w-full text-center hover:underline"
                >
                  Registering a group? Upload Excel file →
                </button>
              )}
              <button onClick={() => setStep('info')} className="text-xs text-gray-400 w-full text-center hover:underline">Back</button>
            </div>
          )}

          {/* ── Bulk Upload Step ── */}
          {step === 'bulk' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm">Bulk Registration</h3>
                <button onClick={() => { setStep('register'); setBulkFile(null); setBulkPreview(null); setBulkResult(null); setBulkError(''); }}
                  className="text-xs text-gray-400 hover:text-gray-600">← Back</button>
              </div>

              {!bulkResult ? (
                <>
                  {/* Step 1: Download template */}
                  <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                    <p className="text-xs font-semibold text-blue-800">Step 1 — Download the template</p>
                    <p className="text-xs text-blue-600">Fill in one attendee per row. Ticket Type must match exactly.</p>
                    <a
                      href={registrationsApi.templateUrl(event.id)}
                      download
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded px-3 py-1.5 hover:bg-blue-50 transition-colors"
                    >
                      ⬇️ Download Template (.xlsx)
                    </a>
                  </div>

                  {/* Step 2: Upload */}
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center space-y-2">
                    <p className="text-xs font-semibold text-gray-700">Step 2 — Upload filled template</p>
                    <p className="text-xs text-gray-400">.xlsx or .csv · max 500 rows · 5 MB</p>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-secondary text-xs py-1.5 px-4"
                    >
                      {bulkFile ? `📄 ${bulkFile.name}` : 'Choose File'}
                    </button>
                  </div>

                  {/* Preview */}
                  {bulkPreview && !bulkError && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Preview (first {bulkPreview.length} rows)</p>
                      <div className="overflow-x-auto border border-gray-100 rounded-lg">
                        <table className="text-xs w-full">
                          <thead className="bg-gray-50">
                            <tr>{Object.keys(bulkPreview[0]).map((k) => <th key={k} className="px-3 py-2 text-left text-gray-500 font-medium">{k}</th>)}</tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {bulkPreview.map((row, i) => (
                              <tr key={i}>{Object.values(row).map((v, j) => <td key={j} className="px-3 py-2 text-gray-700">{String(v)}</td>)}</tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {bulkError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 space-y-1">
                      <p className="font-semibold">{bulkError}</p>
                      {Array.isArray(bulkPreview) && bulkPreview[0]?.error && (
                        <ul className="list-disc list-inside space-y-0.5">
                          {bulkPreview.map((e, i) => <li key={i}>{e.error}</li>)}
                        </ul>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleBulkUpload}
                    disabled={!bulkFile || bulkUploading}
                    className="btn-primary w-full text-sm"
                  >
                    {bulkUploading ? 'Uploading & registering...' : 'Upload & Register Attendees'}
                  </button>
                </>
              ) : (
                /* Result summary */
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
                    <p className="font-semibold text-green-800 mb-2">Upload complete!</p>
                    <div className="flex gap-4">
                      <div className="text-center"><div className="text-2xl font-bold text-green-700">{bulkResult.summary.created}</div><div className="text-xs text-green-600">Registered</div></div>
                      {bulkResult.summary.skipped > 0 && <div className="text-center"><div className="text-2xl font-bold text-amber-600">{bulkResult.summary.skipped}</div><div className="text-xs text-amber-600">Skipped</div></div>}
                    </div>
                  </div>
                  {bulkResult.skipped?.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
                      <p className="font-semibold text-amber-800 mb-1">Skipped attendees:</p>
                      {bulkResult.skipped.map((s, i) => <p key={i} className="text-amber-700">{s.name} — {s.reason}</p>)}
                    </div>
                  )}
                  <button onClick={() => setStep('info')} className="btn-secondary w-full text-sm">Done</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
