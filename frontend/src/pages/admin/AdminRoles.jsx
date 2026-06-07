import { useState, useEffect } from 'react';
import api from '../../api/client';

// Group permissions by resource prefix for a cleaner UI
const PERM_GROUPS = {
  'Events': ['events:view_any', 'events:create', 'events:edit_own', 'events:edit_any', 'events:delete_any', 'events:publish'],
  'Registrations': ['registrations:view_own', 'registrations:view_any', 'registrations:checkin', 'registrations:cancel_any'],
  'Users': ['users:view_any', 'users:edit_any', 'users:delete_any'],
  'Roles': ['roles:view', 'roles:create', 'roles:edit', 'roles:delete', 'roles:assign'],
  'Payments': ['payments:view_own', 'payments:view_any', 'payments:refund'],
  'Analytics': ['analytics:view_own', 'analytics:view_any'],
  'Notifications': ['notifications:send_own', 'notifications:send_any'],
};

function RoleModal({ role, allPermissions, onClose, onSaved }) {
  const isEdit = !!role;
  const currentKeys = role?.permissions?.map((rp) => rp.permission.key) || [];

  const [form, setForm] = useState({
    name: role?.name || '',
    displayName: role?.displayName || '',
    description: role?.description || '',
    permissionKeys: currentKeys,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const togglePerm = (key) => {
    setForm((f) => ({
      ...f,
      permissionKeys: f.permissionKeys.includes(key)
        ? f.permissionKeys.filter((k) => k !== key)
        : [...f.permissionKeys, key],
    }));
  };

  const toggleGroup = (keys) => {
    const allSelected = keys.every((k) => form.permissionKeys.includes(k));
    setForm((f) => ({
      ...f,
      permissionKeys: allSelected
        ? f.permissionKeys.filter((k) => !keys.includes(k))
        : [...new Set([...f.permissionKeys, ...keys])],
    }));
  };

  const handleSave = async () => {
    setError('');
    if (!form.displayName) { setError('Display name is required'); return; }
    if (!isEdit && !form.name) { setError('Role name (slug) is required'); return; }

    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/roles/${role.id}`, {
          displayName: form.displayName,
          description: form.description,
          permissionKeys: form.permissionKeys,
        });
      } else {
        await api.post('/roles', form);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  // Build a flat list of known permission keys from allPermissions for the checkboxes
  const knownKeys = allPermissions.map((p) => p.key);
  const ungrouped = knownKeys.filter((k) => !Object.values(PERM_GROUPS).flat().includes(k));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? `Edit "${role.displayName}"` : 'Create Custom Role'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            {!isEdit && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Role slug <span className="text-gray-400 text-xs">(lowercase, no spaces)</span></label>
                <input className="input" placeholder="e.g. event_manager" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })} />
              </div>
            )}
            <div className={isEdit ? 'col-span-2' : ''}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Display Name</label>
              <input className="input" placeholder="e.g. Event Manager" value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description <span className="text-gray-400 text-xs">(optional)</span></label>
            <textarea className="input" rows={2} placeholder="What can this role do?" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">Permissions</label>
              <span className="text-xs text-gray-400">{form.permissionKeys.length} selected</span>
            </div>

            <div className="space-y-4">
              {Object.entries(PERM_GROUPS).map(([group, keys]) => {
                const available = keys.filter((k) => knownKeys.includes(k));
                if (available.length === 0) return null;
                const allChecked = available.every((k) => form.permissionKeys.includes(k));
                const someChecked = available.some((k) => form.permissionKeys.includes(k));
                return (
                  <div key={group} className="border border-gray-100 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleGroup(available)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold transition-colors ${allChecked ? 'bg-brand-50 text-brand-800' : someChecked ? 'bg-amber-50 text-amber-800' : 'bg-gray-50 text-gray-700'}`}
                    >
                      <span>{group}</span>
                      <span className="text-xs font-normal opacity-70">{available.filter((k) => form.permissionKeys.includes(k)).length}/{available.length} — click to toggle all</span>
                    </button>
                    <div className="p-3 grid grid-cols-2 gap-2">
                      {available.map((key) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer group">
                          <input type="checkbox" className="accent-brand-600" checked={form.permissionKeys.includes(key)}
                            onChange={() => togglePerm(key)} />
                          <span className="text-xs font-mono text-gray-600 group-hover:text-gray-900">{key.split(':')[1]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}

              {ungrouped.length > 0 && (
                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 text-sm font-semibold text-gray-700">Other</div>
                  <div className="p-3 grid grid-cols-2 gap-2">
                    {ungrouped.map((key) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="accent-brand-600" checked={form.permissionKeys.includes(key)}
                          onChange={() => togglePerm(key)} />
                        <span className="text-xs font-mono text-gray-600">{key}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white rounded-b-xl">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Role'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminRoles() {
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'create' | { role }

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/roles'),
      api.get('/permissions').catch(() => ({ data: [] })),
    ])
      .then(([rolesRes, permsRes]) => {
        setRoles(rolesRes.data);
        // Flatten all permission keys from existing roles if /permissions endpoint doesn't exist
        const fromRoles = rolesRes.data.flatMap((r) => r.permissions?.map((rp) => rp.permission) || []);
        const deduped = [...new Map([...fromRoles, ...permsRes.data].map((p) => [p.key, p])).values()];
        setAllPermissions(deduped);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const roleColors = {
    admin: 'bg-purple-100 text-purple-700',
    organiser: 'bg-blue-100 text-blue-700',
    attendee: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
          <p className="text-gray-500 text-sm mt-1">Manage what each role is allowed to do on the platform</p>
        </div>
        <button onClick={() => setModal('create')} className="btn-primary">+ Create Role</button>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" /></div>
      ) : (
        <div className="space-y-4">
          {roles.map((role) => (
            <div key={role.id} className="card p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900">{role.displayName}</h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[role.name] || 'bg-gray-100 text-gray-600'}`}>{role.name}</span>
                  {role.isSystem && <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">System</span>}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-sm text-gray-400">{role._count?.userRoles || 0} user{(role._count?.userRoles || 0) !== 1 ? 's' : ''}</span>
                  <button
                    onClick={() => setModal({ role })}
                    className="text-xs text-brand-600 hover:underline font-medium"
                  >
                    Edit
                  </button>
                </div>
              </div>
              {role.description && <p className="text-sm text-gray-500 mb-3">{role.description}</p>}
              <div className="flex flex-wrap gap-1.5">
                {role.permissions?.map((rp) => (
                  <span key={rp.permission.key} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-mono">{rp.permission.key}</span>
                ))}
                {role.permissions?.length === 0 && <span className="text-xs text-gray-400 italic">No permissions assigned</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <RoleModal
          role={modal === 'create' ? null : modal.role}
          allPermissions={allPermissions}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
