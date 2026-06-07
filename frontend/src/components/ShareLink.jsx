import { useState, useCallback } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';

export default function ShareLink({ url, label = 'Registration link', eventTitle = '' }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const downloadQr = useCallback(() => {
    const canvas = document.getElementById('qr-download-canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${(eventTitle || 'event').replace(/\s+/g, '-').toLowerCase()}-qr-code.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [eventTitle]);

  const printQr = () => {
    const svg = document.getElementById('qr-print-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>${eventTitle || 'Event'} — Registration QR Code</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 40px; background: #fff; }
        h2 { font-size: 22px; margin-bottom: 6px; color: #111; }
        .sub { color: #555; font-size: 15px; margin-bottom: 28px; }
        .qr { display: inline-block; padding: 16px; border: 1px solid #ddd; border-radius: 12px; margin-bottom: 16px; }
        .url { font-size: 11px; color: #888; word-break: break-all; margin-top: 12px; }
        button { margin-top: 24px; padding: 10px 28px; font-size: 15px; cursor: pointer; border: none; background: #2563eb; color: #fff; border-radius: 8px; }
        @media print { button { display: none; } }
      </style></head>
      <body>
        ${eventTitle ? `<h2>${eventTitle}</h2>` : ''}
        <p class="sub">Scan to register</p>
        <div class="qr">${svgData}</div>
        <p class="url">${url}</p>
        <br/><button onclick="window.print()">🖨️ Print</button>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const smsBody = encodeURIComponent(`Register for ${eventTitle || 'this event'}: ${url}`);

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>

      {/* URL + copy */}
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 truncate min-w-0"
          onFocus={(e) => e.target.select()}
        />
        <button
          onClick={copy}
          className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            copied ? 'bg-green-500 text-white' : 'bg-brand-600 hover:bg-brand-700 text-white'
          }`}
        >
          {copied ? '✓ Copied!' : 'Copy'}
        </button>
      </div>

      {/* Share buttons */}
      <div className="flex gap-2 flex-wrap">
        {/* WhatsApp */}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Register for ${eventTitle || 'this event'}: ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full hover:bg-green-100 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          WhatsApp
        </a>
        {/* SMS */}
        <a
          href={`sms:?body=${smsBody}`}
          className="flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          SMS
        </a>
        {/* Email */}
        <a
          href={`mailto:?subject=${encodeURIComponent(`You're invited: ${eventTitle || 'Event'}`)}&body=${encodeURIComponent(`Register here: ${url}`)}`}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          Email
        </a>
        {/* QR toggle */}
        <button
          onClick={() => setShowQr((v) => !v)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${showQr ? 'bg-gray-200 border-gray-300 text-gray-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
          {showQr ? 'Hide QR' : 'QR Code'}
        </button>
      </div>

      {/* QR Code Panel */}
      {showQr && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-center space-y-4">
          {eventTitle && (
            <p className="text-sm font-semibold text-gray-800">{eventTitle}</p>
          )}
          <p className="text-xs text-gray-500">Scan with your phone camera to register</p>

          {/* Visible SVG QR */}
          <div className="flex justify-center">
            <div className="p-4 bg-white border-2 border-gray-100 rounded-xl shadow-sm inline-block">
              <QRCodeSVG
                id="qr-print-svg"
                value={url}
                size={200}
                level="M"
                includeMargin={false}
              />
            </div>
          </div>

          {/* Hidden canvas for PNG download */}
          <div className="hidden">
            <QRCodeCanvas
              id="qr-download-canvas"
              value={url}
              size={512}
              level="M"
              includeMargin
            />
          </div>

          <div className="flex justify-center gap-2 flex-wrap">
            <button
              onClick={downloadQr}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download PNG
            </button>
            <button
              onClick={printQr}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print / Bulletin
            </button>
          </div>

          <p className="text-xs text-gray-400 break-all font-mono">{url}</p>
        </div>
      )}
    </div>
  );
}
