import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import api, { eventsApi, registrationsApi } from '../../api/client';

const STATUS_STYLES = {
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  checked_in: 'bg-blue-100 text-blue-800 border-blue-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

export default function CheckIn() {
  const { id: eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState(null); // { ok, attendee, message, status }
  const [manualCode, setManualCode] = useState('');
  const [stats, setStats] = useState({ checkedIn: 0, total: 0 });
  const [history, setHistory] = useState([]);
  const scannerRef = useRef(null);
  const scannerDivId = 'qr-reader-div';
  const processingRef = useRef(false);

  // Load event info
  useEffect(() => {
    eventsApi.get(eventId)
      .then(({ data }) => setEvent(data))
      .catch(console.error);
    loadStats();
  }, [eventId]);

  const loadStats = async () => {
    try {
      const { data } = await api.get(`/events/${eventId}/registrations`);
      const all = Array.isArray(data) ? data : (data.registrations || []);
      setStats({
        checkedIn: all.filter((r) => r.status === 'checked_in').length,
        total: all.filter((r) => r.status !== 'cancelled').length,
      });
    } catch { /* ignore */ }
  };

  // Resolve barcode → registration ID
  // Barcode format: EH-XXXXXXXXXXXX (12 hex chars = first 12 of uuid without hyphens)
  const resolveBarcode = async (raw) => {
    const trimmed = raw.trim();

    // If it looks like a full URL (QR code), extract the registration ID from path
    if (trimmed.startsWith('http')) {
      const match = trimmed.match(/\/tickets\/([0-9a-f-]{36})/i);
      if (match) return match[1];
    }

    // If it's our barcode format EH-XXXX...
    const barcodeMatch = trimmed.match(/^EH-([0-9A-F]{12})$/i);
    if (barcodeMatch) {
      const shortHex = barcodeMatch[1].toLowerCase();
      // Look up the registration by the short code
      try {
        const { data } = await api.get(`/events/${eventId}/registrations`);
        const all = Array.isArray(data) ? data : (data.registrations || []);
        const reg = all.find((r) => r.id.replace(/-/g, '').slice(0, 12).toLowerCase() === shortHex);
        if (reg) return reg.id;
      } catch { /* fall through */ }
    }

    // If it's a plain UUID already
    if (/^[0-9a-f-]{36}$/i.test(trimmed)) return trimmed;

    return null;
  };

  const processCode = useCallback(async (raw) => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      const regId = await resolveBarcode(raw);
      if (!regId) {
        setLastResult({ ok: false, message: `Unrecognised code: ${raw.slice(0, 40)}` });
        return;
      }

      const { data } = await registrationsApi.checkin(regId);

      const entry = {
        id: regId,
        name: data.attendeeName,
        ticketType: data.ticketType?.name,
        status: data.status,
        time: new Date().toLocaleTimeString(),
        ok: data.status === 'checked_in',
      };

      setLastResult({
        ok: entry.ok,
        message: entry.ok ? `✅ Checked in!` : `ℹ️ Already checked in`,
        attendee: entry,
      });
      setHistory((h) => [entry, ...h].slice(0, 50));
      loadStats();
    } catch (err) {
      const msg = err.response?.data?.error || 'Check-in failed';
      setLastResult({ ok: false, message: `❌ ${msg}` });
    } finally {
      // Allow next scan after 2 seconds
      setTimeout(() => { processingRef.current = false; }, 2000);
    }
  }, [eventId]);

  const startScanner = async () => {
    setScanning(true);
    setLastResult(null);
    try {
      const html5Qr = new Html5Qrcode(scannerDivId);
      scannerRef.current = html5Qr;
      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 100 } },
        (decodedText) => processCode(decodedText),
        () => {} // ignore errors
      );
    } catch (err) {
      console.error('Camera error', err);
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => () => { stopScanner(); }, []);

  const handleManual = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      processCode(manualCode.trim());
      setManualCode('');
    }
  };

  const pct = stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Entry Scanner</h1>
        {event && <p className="text-gray-500 mt-1 text-sm">{event.title}</p>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-brand-600">{stats.checkedIn}</div>
          <div className="text-xs text-gray-500 mt-1">Checked In</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-gray-700">{stats.total}</div>
          <div className="text-xs text-gray-500 mt-1">Total Registered</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{pct}%</div>
          <div className="text-xs text-gray-500 mt-1">Attendance</div>
          <div className="mt-2 bg-gray-200 rounded-full h-1.5">
            <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Last result banner */}
      {lastResult && (
        <div className={`mb-5 px-5 py-4 rounded-xl border text-sm font-medium ${lastResult.ok ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
          <div className="text-base font-bold mb-1">{lastResult.message}</div>
          {lastResult.attendee && (
            <div className="space-y-0.5 text-sm opacity-80">
              <div>{lastResult.attendee.name}</div>
              <div>{lastResult.attendee.ticketType}</div>
            </div>
          )}
        </div>
      )}

      {/* Camera scanner */}
      <div className="card p-5 mb-5">
        <h2 className="font-semibold text-gray-800 mb-3">Camera Scanner</h2>
        <div id={scannerDivId} className={scanning ? 'rounded-lg overflow-hidden' : 'hidden'} />
        {!scanning && (
          <div className="bg-gray-50 rounded-lg h-36 flex items-center justify-center text-gray-400 text-sm">
            Camera inactive
          </div>
        )}
        <div className="flex gap-3 mt-4">
          {!scanning ? (
            <button onClick={startScanner} className="btn-primary flex-1">📷 Start Camera</button>
          ) : (
            <button onClick={stopScanner} className="btn-secondary flex-1">⏹ Stop Camera</button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">Point camera at the CODE128 barcode or QR code on the ticket</p>
      </div>

      {/* Manual entry */}
      <div className="card p-5 mb-6">
        <h2 className="font-semibold text-gray-800 mb-3">Manual Entry</h2>
        <form onSubmit={handleManual} className="flex gap-2">
          <input
            className="input flex-1 font-mono text-sm"
            placeholder="EH-XXXXXXXXXXXX or paste full ticket URL"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
          />
          <button type="submit" className="btn-primary px-5">Check In</button>
        </form>
        <p className="text-xs text-gray-400 mt-2">Enter the barcode shown on the ticket (e.g. EH-A1B2C3D4E5F6) or paste a ticket URL</p>
      </div>

      {/* Recent history */}
      {history.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 text-sm">Recent Scans</h2>
            <button onClick={() => setHistory([])} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
          </div>
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <span className="text-lg">{h.ok ? '✅' : 'ℹ️'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{h.name}</div>
                  <div className="text-xs text-gray-500">{h.ticketType}</div>
                </div>
                <div className="text-xs text-gray-400 shrink-0">{h.time}</div>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${STATUS_STYLES[h.status] || 'bg-gray-100 text-gray-600'}`}>
                  {h.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
