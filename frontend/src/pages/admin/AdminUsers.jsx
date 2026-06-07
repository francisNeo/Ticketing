import { useState, useEffect } from 'react';
import api from '../../api/client';

const ALL_ROLES = ['attendee', 'organiser', 'admin'];

function UserModal({ user, roles, onClose, onSaved }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    roleNames: user?.userRoles?.map((ur) => ur.role.name) || ['attendee'],
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleRole = (roleName) => {
    setForm((f) => ({
      ...f,
      roleNames: f.roleNames.includes(roleName)
        ? f.roleNames.filter((r) => r !== roleName)
        : [...f.roleNames, roleName],
    }));
  };

  const handleSave = async () => {
    setError('');
    if (!form.name || !form.email) { setError('Name and email are required'); return; }
    if (!isEdit && form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (form.roleNames.length === 0) { setError('Select at least one role'); return; }

    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/admin/users/${user.id}/roles`, { roleNames: form.roleNames });
      } else {
        await api.post('/admin/users', form);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const roleInfo = {
    attendee: { label: 'Attendee', desc: 'Can browse events and manage their own tickets', color: 'bg-gray-100 text-gray-700 border-gray-200' },
    organiser: { label: 'Event Admin', desc: 'Can create events, manage payments and attendees', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    admin: { label: 'Platform Admin', desc: 'Full platform access — users, roles, plans, analytics', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit User Roles' : 'Create Portal User'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          {!isEdit && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <input className="input" placeholder="Jane Doe" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                <input type="email" className="input" placeholder="jane@example.com" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Temporary Password</label>
                <input type="password" className="input" placeholder="Min 8 characters" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">User can change this after their first login</p>
              </div>
            </>
          )}

          {isEdit && (
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
              <div className="font-medium text-gray-900">{user.name}</div>
              <div className="text-gray-500">{user.email}</div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Assign Roles</label>
            <div className="space-y-2">
              {(roles.length > 0 ? roles : ALL_ROLES.map((n) => ({ name: n, displayName: roleInfo[n]?.label || n }))).map((role) => {
                const info = roleInfo[role.name] || { label: role.displayName || role.name, desc: '', color: 'bg-gray-50 text-gray-700 border-gray-200' };
                const checked = form.roleNames.includes(role.name);
                return (
                  <label key={role.name}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked ? `${info.color} ring-1 ring-current` : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="checkbox" className="mt-0.5 accent-brand-600" checked={checked}
                      onChange={() => toggleRole(role.name)} />
                    <div>
                      <div className="text-sm font-medium">{info.label}</div>
                      {info.desc && <div className="text-xs text-gray-500 mt-0.5">{info.desc}</div>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : isEdit ? 'Update Roles' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'create' | { user }
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/admin/users', { params: { search: search || undefined, page, limit: 20 } }),
      api.get('/roles'),
    ])
      .then(([usersRes, rolesRes]) => {
        setUsers(usersRes.data.users);
        setTotal(usersRes.data.total);
        setRoles(rolesRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, page]);

  const roleColors = {
    admin: 'bg-purple-100 text-purple-700',
    organiser: 'bg-blue-100 text-blue-700',
    attendee: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portal Users</h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage user accounts and role assignments</p>
        </div>
        <button onClick={() => setModal('create')} className="btn-primary">+ Create User</button>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { role: 'attendee', label: 'Attendee', desc: 'Browses events, registers, manages own tickets', icon: '🎟️' },
          { role: 'organiser', label: 'Event Admin', desc: 'Creates events, manages payments & attendees', icon: '🎯' },
          { role: 'admin', label: 'Platform Admin', desc: 'Full access — users, roles, plans, analytics', icon: '🛡️' },
        ].map((r) => (
          <div key={r.role} className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <span>{r.icon}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleColors[r.role]}`}>{r.label}</span>
            </div>
            <p className="text-xs text-gray-500">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Search + table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <input className="input max-w-xs text-sm" placeholder="Search by name or email..."
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <span className="text-sm text-gray-400">{total} user{total !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="p-10 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" /></div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-gray-400">No users found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['User', 'Email', 'Roles', 'Joined', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                        <span className="text-brand-700 font-semibold text-xs">{u.name[0].toUpperCase()}</span>
                      </div>
                      <span className="font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{u.email}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1.5 flex-wrap">
                      {u.userRoles?.map((ur) => (
                        <span key={ur.role.id}
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[ur.role.name] || 'bg-gray-100 text-gray-600'}`}>
                          {ur.role.name === 'organiser' ? 'Event Admin' : ur.role.name === 'admin' ? 'Platform Admin' : 'Attendee'}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => setModal({ user: u })}
                      className="text-xs text-brand-600 hover:underline font-medium">
                      Edit Roles
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {total > 20 && (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm py-1.5">← Previous</button>
            <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
            <button disabled={users.length < 20} onClick={() => setPage(p => p + 1)} className="btn-secondary text-sm py-1.5">Next →</button>
          </div>
        )}
      </div>

      {modal && (
        <UserModal
          user={modal === 'create' ? null : modal.user}
          roles={roles}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
