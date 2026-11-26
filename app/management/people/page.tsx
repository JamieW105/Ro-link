"use client";
import { LoadingState } from "@/app/management/SiteContentFields";
import { Status } from "@/components/ui/status";
import { PageIcon } from "@/components/dashboard/PageIcon";
import { Select } from "@/components/ui/select";
import { Card, CardTitle, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { useDashboardFeedback } from "@/components/dashboard/DashboardFeedback";

import { Trash2 as LucideTrash2 } from "lucide-react";

import { useEffect, useState } from "react";

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
  { id: "RO_LINK_DASHBOARD", name: "Ro-Link Dashboard" },
  { id: "MANAGE_SERVERS", name: "Manage Servers" },
  { id: "POST_JOB_APPLICATION", name: "Post Job Application" },
  { id: "POST_UPDATES", name: "Post Updates" },
  { id: "BLOCK_SERVERS", name: "Block Servers" },
  { id: "MANAGE_MODULES", name: "Manage Modules" },
  { id: "SITE_TESTING_ACCESS", name: "Site Testing Access" },
  { id: "MANAGE_RO_LINK", name: "Manage Ro-Link (Full Admin)" },
];

export default function ManagePeople() {
  const { confirm, notify } = useDashboardFeedback();
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
      fetch("/api/management/roles").then((res) => res.json()),
      fetch("/api/management/users").then((res) => res.json()),
    ])
      .then(([rolesData, usersData]) => {
        setRoles(rolesData);
        setUsers(usersData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName || newRolePerms.length === 0) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/management/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoleName, permissions: newRolePerms }),
      });
      if (res.ok) {
        const data = await res.json();
        setRoles((prev) => [...prev, data]);
        setNewRoleName("");
        setNewRolePerms([]);
      }
    } catch {
      notify("Error creating role");
    } finally {
      setProcessing(false);
    }
  };

  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userIdToAssign || !roleIdToAssign) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/management/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discordId: userIdToAssign,
          roleId: roleIdToAssign,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers((prev) => {
          const existing = prev.findIndex(
            (u) => u.discord_id === data.discord_id,
          );
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
    } catch {
      notify("Error assigning user");
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveUser = async (id: string) => {
    if (
      !(await confirm(
        "Are you sure you want to remove this user's management access?",
      ))
    )
      return;
    try {
      const res = await fetch(`/api/management/users/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.discord_id !== id));
      }
    } catch {
      notify("Error removing user");
    }
  };

  const handleTogglePerm = (permId: string) => {
    setNewRolePerms((prev) =>
      prev.includes(permId)
        ? prev.filter((p) => p !== permId)
        : [...prev, permId],
    );
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-12 pb-20">
      <header>
        <h1 className="text-2xl  text-foreground tracking-tight flex items-center gap-3 font-semibold">
          <PageIcon name="roles" compact /> People & Roles
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage global Ro-Link staff and their permissions.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Roles Management */}
        <div className="space-y-6">
          <Card className="bg-card border border-border p-6 rounded-xl space-y-6">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                Create Management Role
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <form onSubmit={handleCreateRole} className="space-y-4">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground   mb-2 block">
                    Role Name
                  </label>
                  <Input
                    aria-label="Role Name"
                    type="text"
                    className="w-full border text-sm"
                    placeholder="e.g. Moderator, Manager..."
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground   mb-3 block">
                    Permissions
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {ALL_PERMISSIONS.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-3 p-3 bg-background border border-border rounded-xl cursor-pointer hover:border-border transition-all group"
                      >
                        <Checkbox
                          checked={newRolePerms.includes(p.id)}
                          onCheckedChange={() => handleTogglePerm(p.id)}
                        />
                        <span className="text-sm font-medium text-foreground group-hover:text-foreground transition-colors">
                          {p.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button
                  variant="default"
                  type="submit"
                  disabled={
                    processing || !newRoleName || newRolePerms.length === 0
                  }
                  className="w-full disabled:opacity-50 mt-4 transition-all "
                >
                  {processing ? "Creating..." : "Create Role"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-card border border-border rounded-xl overflow-hidden">
            <CardHeader className="p-6 border-b border-border">
              <CardTitle className="text-sm font-semibold text-foreground  ">
                Existing Roles
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {roles.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No roles created yet.
                  </div>
                ) : (
                  roles.map((role) => (
                    <div key={role.id} className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-foreground">
                          {role.name}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {role.permissions.map((p) => (
                          <Status render={<span />} variant="default" key={p}>
                            {p.replace(/_/g, " ")}
                          </Status>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Management */}
        <div className="space-y-6">
          <Card className="bg-card border border-border p-6 rounded-xl space-y-6">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                Assign User to Role
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <form onSubmit={handleAssignUser} className="space-y-4">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground   mb-2 block">
                    Discord User ID
                  </label>
                  <Input
                    aria-label="Discord User ID"
                    type="text"
                    className="w-full border text-sm"
                    placeholder="Enter Discord User ID..."
                    value={userIdToAssign}
                    onChange={(e) => setUserIdToAssign(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground   mb-2 block">
                    Select Role
                  </label>
                  <Select
                    aria-label="Management role"
                    value={roleIdToAssign}
                    onValueChange={setRoleIdToAssign}
                    options={[
                      { value: "", label: "Select a role..." },
                      ...roles.map((role) => ({
                        value: role.id,
                        label: role.name,
                      })),
                    ]}
                  />
                </div>
                <Button
                  variant="default"
                  type="submit"
                  disabled={processing || !userIdToAssign || !roleIdToAssign}
                  className="w-full disabled:opacity-50 mt-4 transition-all "
                >
                  {processing ? "Assigning..." : "Assign Access"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-card border border-border rounded-xl overflow-hidden">
            <CardHeader className="p-6 border-b border-border">
              <CardTitle className="text-sm font-semibold text-foreground  ">
                Authorized Users
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="table-responsive">
                <Table className="w-full min-w-[560px] text-left text-sm">
                  <TableHeader className="bg-muted/40 text-muted-foreground font-semibold  text-[10px] ">
                    <TableRow>
                      <TableHead className="px-6 py-4">Discord ID</TableHead>
                      <TableHead className="px-6 py-4">Role</TableHead>
                      <TableHead className="px-6 py-4 text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border">
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="px-6 py-10 text-center text-muted-foreground"
                        >
                          No staff members assigned.
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow
                          key={user.discord_id}
                          className="hover:bg-muted/40"
                        >
                          <TableCell className="px-6 py-4 font-mono text-xs text-foreground">
                            {user.discord_id}
                          </TableCell>
                          <TableCell className="px-6 py-4">
                            <Status render={<span />} variant="default">
                              {user.role?.name || "N/A"}
                            </Status>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-right">
                            <Button
                              aria-label="Remove item"
                              type="button"
                              variant="outline"
                              onClick={() => handleRemoveUser(user.discord_id)}
                              className="transition-all"
                            >
                              <LucideTrash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
