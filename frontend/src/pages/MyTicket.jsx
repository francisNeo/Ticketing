import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';
import { format } from 'date-fns';
import { registrationsApi } from '../api/client';

export default function MyTicket() {
  const { registrationId } = useParams();
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    registrationsApi.get(registrationId)
      .then(({ data }) => setRegistration(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [registrationId]);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>;
  if (!registration) return <div className="text-center py-20 text-gray-400">Ticket not found</div>;

  const statusColor = {
    confirmed: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    checked_in: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  // Short barcode value: prefix + first 12 chars of UUID (no hyphens)
  const barcodeValue = 'EH-' + registrationId.replace(/-/g, '').slice(0, 12).toUpperCase();

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-blue-700 p-6 text-white">
          <div className="text-xs uppercase tracking-wide opacity-75 mb-1">EventHub Ticket</div>
          <h1 className="text-xl font-bold">{registration.event?.title}</h1>
          <p className="text-sm opacity-90 mt-1">
            {registration.event?.startsAt && format(new Date(registration.event.startsAt), 'EEE, MMM d, yyyy · h:mm a')}
          </p>
        </div>

        {/* Barcode — primary scan target at entry point */}
        <div className="flex flex-col items-center py-6 bg-white border-b border-dashed border-gray-200">
          <Barcode
            value={barcodeValue}
            format="CODE128"
            width={1.8}
            height={72}
            displayValue
            fontSize={11}
            margin={8}
            background="#ffffff"
            lineColor="#111827"
          />
          <p className="text-xs text-gray-400 mt-1">Scan at entry</p>
        </div>

        {/* QR Code — backup / mobile wallets */}
        <div className="flex flex-col items-center py-6 bg-gray-50 border-b border-gray-100">
          <QRCodeSVG
            value={`${window.location.origin}/tickets/${registrationId}`}
            size={140}
            level="H"
            includeMargin
          />
          <p className="text-xs text-gray-400 mt-1">QR (backup)</p>
        </div>

        {/* Details */}
        <div className="p-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Ticket ID</span>
            <span className="font-mono font-medium">{barcodeValue}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Name</span>
            <span className="font-medium">{registration.attendeeName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Ticket Type</span>
            <span className="font-medium">{registration.ticketType?.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Quantity</span>
            <span className="font-medium">{registration.quantity}</span>
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-gray-500">Status</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor[registration.status]}`}>
              {registration.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          {registration.event?.locationText && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Location</span>
              <span className="font-medium text-right max-w-[60%]">{registration.event.locationText}</span>
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-4 text-xs text-center text-gray-400">
          Present this ticket at the entrance — barcode or QR code accepted
        </div>
      </div>

      <button
        onClick={() => window.print()}
        className="w-full mt-4 btn-secondary text-sm py-2.5"
      >
        🖨️ Print Ticket
      </button>
    </div>
  );
}
