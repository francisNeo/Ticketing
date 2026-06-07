import { useState, useEffect } from 'react';
import { churchConfigApi } from '../../api/client';

const KIND_META = {
  service_type: {
    label: 'Service / Event Types',
    desc: 'Types of church services and events organisers can select when creating an event',
    icon: '⛪',
    color: 'brand',
  },
  denomination: {
    label: 'Denominations',
    desc: 'Church denominations displayed to event organisers and attendees',
    icon: '✝️',
    color: 'purple',
  },
  dress_code: {
    label: 'Dress Codes',
    desc: 'Dress code options available when setting up a church event',
    icon: '👔',
    color: 'amber',
  },
};

const KINDS = Object.keys(KIND_META);

function AddItemModal({ kind, onClose, onAdded }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    setError('');
    if (!value.trim()) { setError('Value is required'); return; }
    setSaving(true);
    try {
      const { data } = await churchConfigApi.create({ kind, value: value.trim() });
      onAdded(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add item');
    } finally {
      setSaving(false);
    }
  };

  const meta = KIND_META[kind];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Add {meta.label.replace(/s$/, '')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
            <input
              autoFocus
              className="input"
              placeholder={kind === 'service_type' ? 'e.g. Sunday Service' : kind === 'denomination' ? 'e.g. Pentecostal' : 'e.g. Smart Casual'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleAdd} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditItemModal({ item, onClose, onSaved }) {
  const [value, setValue] = useState(item.value);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError('');
    if (!value.trim()) { setError('Value is required'); return; }
    setSaving(true);
    try {
      const { data } = await churchConfigApi.update(item.id, { value: value.trim() });
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Edit</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
            <input autoFocus className="input" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminChurchConfig() {
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeKind, setActiveKind] = useState('service_type');
  const [modal, setModal] = useState(null); // null | { type: 'add' } | { type: 'edit', item }
  const [toggling, setToggling] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  const load = () => {
    setLoading(true);
    churchConfigApi.getAll()
      .then(({ data }) => {
        // Group by kind
        const grouped = data.reduce((acc, item) => {
          if (!acc[item.kind]) acc[item.kind] = [];
          acc[item.kind].push(item);
          return acc;
        }, {});
        setItems(grouped);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (item) => {
    setToggling(item.id);
    try {
      await churchConfigApi.update(item.id, { isActive: !item.isActive });
      load();
    } catch { /* ignore */ } finally {
      setToggling(null);
    }
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`Delete "${item.value}"? This cannot be undone.`)) return;
    setDeleting(item.id);
    try {
      await churchConfigApi.delete(item.id);
      load();
    } catch { /* ignore */ } finally {
      setDeleting(null);
    }
  };

  const activeItems = (items[activeKind] || []).filter((i) => showInactive || i.isActive);
  const meta = KIND_META[activeKind];

  const tabColor = {
    brand: 'border-brand-500 text-brand-700 bg-brand-50',
    purple: 'border-purple-500 text-purple-700 bg-purple-50',
    amber: 'border-amber-500 text-amber-700 bg-amber-50',
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Church Event Configuration</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage the dropdown options available to organisers when creating Church &amp; Religious events.
          Only platform admins can modify these settings.
        </p>
      </div>

      {/* Kind tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {KINDS.map((kind) => {
          const m = KIND_META[kind];
          const active = activeKind === kind;
          const count = (items[kind] || []).filter((i) => i.isActive).length;
          return (
            <button
              key={kind}
              onClick={() => setActiveKind(kind)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                active ? tabColor[m.color] : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-white/60' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div className="card overflow-hidden">
        {/* Panel header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">{meta.label}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{meta.desc}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
              <input type="checkbox" className="accent-brand-600" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Show inactive
            </label>
            <button
              onClick={() => setModal({ type: 'add' })}
              className="btn-primary text-sm py-1.5 px-4"
            >
              + Add
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-10 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" /></div>
        ) : activeItems.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            {showInactive ? 'No items yet.' : 'No active items.'} Click <strong>+ Add</strong> to create one.
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {activeItems.map((item, idx) => (
              <li key={item.id} className={`flex items-center gap-4 px-6 py-3.5 ${!item.isActive ? 'opacity-50' : ''}`}>
                <span className="text-xs text-gray-300 w-5 text-right">{idx + 1}</span>
                <span className={`flex-1 text-sm font-medium ${item.isActive ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                  {item.value}
                </span>
                {!item.isActive && (
                  <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Inactive</span>
                )}
                <div className="flex items-center gap-2">
                  {/* Toggle active */}
                  <button
                    onClick={() => toggleActive(item)}
                    disabled={toggling === item.id}
                    title={item.isActive ? 'Deactivate' : 'Activate'}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${
                      item.isActive
                        ? 'border-green-200 bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                        : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-green-50 hover:text-green-700 hover:border-green-200'
                    }`}
                  >
                    {toggling === item.id ? '…' : item.isActive ? 'Active' : 'Inactive'}
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => setModal({ type: 'edit', item })}
                    className="text-xs text-brand-600 hover:underline font-medium"
                  >
                    Edit
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => deleteItem(item)}
                    disabled={deleting === item.id}
                    className="text-xs text-red-400 hover:text-red-600 font-medium"
                  >
                    {deleting === item.id ? '…' : 'Delete'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Summary footer */}
        {!loading && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            {(items[activeKind] || []).filter((i) => i.isActive).length} active ·{' '}
            {(items[activeKind] || []).filter((i) => !i.isActive).length} inactive ·{' '}
            {(items[activeKind] || []).length} total
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg px-5 py-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">How this works</p>
        <ul className="list-disc list-inside space-y-1 text-blue-600 text-xs">
          <li><strong>Active</strong> items appear in the dropdowns when an organiser creates a Church &amp; Religious event.</li>
          <li><strong>Inactive</strong> items are hidden from organisers but not deleted — existing events using them are unaffected.</li>
          <li><strong>Deleting</strong> permanently removes an item. Only do this if it was added by mistake.</li>
          <li>Changes take effect immediately for all new events.</li>
        </ul>
      </div>

      {/* Modals */}
      {modal?.type === 'add' && (
        <AddItemModal
          kind={activeKind}
          onClose={() => setModal(null)}
          onAdded={() => { setModal(null); load(); }}
        />
      )}
      {modal?.type === 'edit' && (
        <EditItemModal
          item={modal.item}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
