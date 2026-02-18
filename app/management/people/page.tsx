'use client';

import { useEffect, useState } from 'react';

interface Role {
    id: string;
    name: string;
    permissions: string[];
}

interface User {
    discord_id: string;
    role: Role;
    added_at: string;
}

const ALL_PERMISSIONS = [
    { id: 'RO_LINK_DASHBOARD', name: 'Ro-Link Dashboard' },
    { id: 'MANAGE_SERVERS', name: 'Manage Servers' },
    { id: 'POST_JOB_APPLICATION', name: 'Post Job Application' },
    { id: 'BLOCK_SERVERS', name: 'Block Servers' },
    { id: 'MANAGE_RO_LINK', name: 'Manage Ro-Link (Full Admin)' },
];

export default function ManagePeople() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    // New Role Form
    const [newRoleName, setNewRoleName] = useState("");
    const [newRolePerms, setNewRolePerms] = useState<string[]>([]);

    // Assign User Form
    const [userIdToAssign, setUserIdToAssign] = useState("");
    const [roleIdToAssign, setRoleIdToAssign] = useState("");

    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch('/api/management/roles').then(res => res.json()),
            fetch('/api/management/users').then(res => res.json())
        ]).then(([rolesData, usersData]) => {
            setRoles(rolesData);
            setUsers(usersData);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const handleCreateRole = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRoleName || newRolePerms.length === 0) return;
        setProcessing(true);
        try {
            const res = await fetch('/api/management/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newRoleName, permissions: newRolePerms })
            });
            if (res.ok) {
                const data = await res.json();
                setRoles(prev => [...prev, data]);
                setNewRoleName("");
                setNewRolePerms([]);
            }
        } catch (err) {
            alert("Error creating role");
        } finally {
            setProcessing(false);
        }
    };

    const handleAssignUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userIdToAssign || !roleIdToAssign) return;
        setProcessing(true);
        try {
            const res = await fetch('/api/management/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ discordId: userIdToAssign, roleId: roleIdToAssign })
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(prev => {
                    const existing = prev.findIndex(u => u.discord_id === data.discord_id);
                    if (existing > -1) {
                        const next = [...prev];
                        next[existing] = data;
                        return next;
                    }
                    return [data, ...prev];
                });
                setUserIdToAssign("");
                setRoleIdToAssign("");
            }
        } catch (err) {
            alert("Error assigning user");
        } finally {
            setProcessing(false);
        }
    };

    const handleRemoveUser = async (id: string) => {
        if (!confirm("Are you sure you want to remove this user's management access?")) return;
        try {
            const res = await fetch(`/api/management/users/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setUsers(prev => prev.filter(u => u.discord_id !== id));
            }
        } catch (err) {
            alert("Error removing user");
        }
    };

    const handleTogglePerm = (permId: string) => {
        setNewRolePerms(prev =>
            prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
        );
    };

    return (
        <div className="space-y-12 pb-20">
            <header>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">People & Roles</h1>
                <p className="text-slate-400 mt-1">Manage global Ro-Link staff and their permissions.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Roles Management */}
                <div className="space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl space-y-6">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                            Create Management Role
                        </h2>
                        <form onSubmit={handleCreateRole} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Role Name</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-sky-500"
                                    placeholder="e.g. Moderator, Manager..."
                                    value={newRoleName}
                                    onChange={(e) => setNewRoleName(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">Permissions</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {ALL_PERMISSIONS.map(p => (
                                        <label key={p.id} className="flex items-center gap-3 p-3 bg-slate-950/50 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-all group">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-sky-600 focus:ring-sky-600 focus:ring-offset-slate-900"
                                                checked={newRolePerms.includes(p.id)}
                                                onChange={() => handleTogglePerm(p.id)}
                                            />
                                            <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{p.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={processing || !newRoleName || newRolePerms.length === 0}
                                className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold mt-4 transition-all shadow-lg shadow-sky-900/20"
                            >
                                {processing ? "Creating..." : "Create Role"}
                            </button>
                        </form>
                    </div>

                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-slate-800">
                            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Existing Roles</h3>
                        </div>
                        <div className="divide-y divide-slate-800">
                            {roles.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-sm">No roles created yet.</div>
                            ) : (
                                roles.map(role => (
                                    <div key={role.id} className="p-6">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-bold text-white">{role.name}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {role.permissions.map(p => (
                                                <span key={p} className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-bold text-sky-400">
                                                    {p.replace(/_/g, ' ')}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Users Management */}
                <div className="space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl space-y-6">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                            Assign User to Role
                        </h2>
                        <form onSubmit={handleAssignUser} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Discord User ID</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
                                    placeholder="Enter Discord User ID..."
                                    value={userIdToAssign}
                                    onChange={(e) => setUserIdToAssign(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Select Role</label>
                                <select
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
                                    value={roleIdToAssign}
                                    onChange={(e) => setRoleIdToAssign(e.target.value)}
                                    required
                                >
                                    <option value="">Select a role...</option>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                            <button
                                type="submit"
                                disabled={processing || !userIdToAssign || !roleIdToAssign}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold mt-4 transition-all shadow-lg shadow-emerald-900/20"
                            >
                                {processing ? "Assigning..." : "Assign Access"}
                            </button>
                        </form>
                    </div>

                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-slate-800">
                            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Authorized Users</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-800/10 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Discord ID</th>
                                        <th className="px-6 py-4">Role</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {users.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-10 text-center text-slate-500">No staff members assigned.</td>
                                        </tr>
                                    ) : (
                                        users.map(user => (
                                            <tr key={user.discord_id} className="hover:bg-slate-800/20">
                                                <td className="px-6 py-4 font-mono text-xs text-white">{user.discord_id}</td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                                        {user.role?.name || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handleRemoveUser(user.discord_id)}
                                                        className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
