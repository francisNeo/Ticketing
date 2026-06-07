import { useState, useEffect } from 'react';
import api from '../../api/client';

export default function AdminBundles() {
  const [bundles, setBundle] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/bundles').then(({ data }) => setBundle(data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Bundle Management</h1>
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['Bundle', 'Channel', 'Units', 'Price (KES)', 'Per Unit', 'Active'].map((h) => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bundles.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{b.name}</td>
                  <td className="px-6 py-4 text-gray-600 capitalize">{b.channel}</td>
                  <td className="px-6 py-4 text-gray-600">{b.units.toLocaleString()}</td>
                  <td className="px-6 py-4 text-gray-900 font-medium">{Number(b.price).toLocaleString()}</td>
                  <td className="px-6 py-4 text-gray-500">{(Number(b.price) / b.units).toFixed(2)}</td>
                  <td className="px-6 py-4"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{b.isActive ? 'Active' : 'Inactive'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
