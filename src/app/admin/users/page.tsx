"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { timeAgo } from "@/lib/utils";

type UserData = {
  id: string;
  name: string | null;
  email: string;
  handle: string | null;
  role: string;
  tier: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
  _count: { bots: number };
};

type UsersResponse = {
  users: UserData[];
  total: number;
  page: number;
  pages: number;
};

const USER_ROLES = ["SPECTATOR", "BOT_BUILDER", "DEVELOPER", "ADMIN"] as const;
const TIERS = ["FREE", "BYOB_FREE", "BYOB_PRO", "SPARK", "PULSE", "GRID", "ADMIN"] as const;

const TIER_COLORS: Record<string, string> = {
  FREE: "text-rudo-dark-muted border-rudo-card-border bg-rudo-card-bg",
  BYOB_FREE: "text-rudo-dark-muted border-rudo-card-border bg-rudo-card-bg",
  BYOB_PRO: "text-rudo-dark-muted border-rudo-card-border bg-rudo-card-bg",
  SPARK: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
  PULSE: "text-rudo-blue border-rudo-blue/20 bg-rudo-blue-soft",
  GRID: "text-green-400 border-green-400/20 bg-green-400/5",
  ADMIN: "text-rudo-rose border-rudo-rose/20 bg-rudo-rose-soft",
};

const ROLE_COLORS: Record<string, string> = {
  SPECTATOR: "text-rudo-dark-muted border-rudo-card-border bg-rudo-card-bg",
  BOT_BUILDER: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
  DEVELOPER: "text-rudo-blue border-rudo-blue/20 bg-rudo-blue-soft",
  ADMIN: "text-rudo-rose border-rudo-rose/20 bg-rudo-rose-soft",
};

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");

  // Inline editing
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editTier, setEditTier] = useState("");
  const [saving, setSaving] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(value);
      setPage(1);
    }, 300);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (roleFilter) params.set("role", roleFilter);
      if (tierFilter) params.set("tier", tierFilter);
      params.set("page", String(page));

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (res.ok) {
        const data: UsersResponse = await res.json();
        setUsers(data.users);
        setTotalPages(data.pages);
        setTotal(data.total);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [query, roleFilter, tierFilter, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Start editing a user
  function startEdit(user: UserData) {
    setEditingUserId(user.id);
    setEditRole(user.role);
    setEditTier(user.tier);
  }

  function cancelEdit() {
    setEditingUserId(null);
    setEditRole("");
    setEditTier("");
  }

  // Save role/tier changes
  async function saveEdit() {
    if (!editingUserId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingUserId,
          role: editRole,
          tier: editTier,
        }),
      });
      if (res.ok) {
        setEditingUserId(null);
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update user");
      }
    } catch {
      alert("Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  // Delete user
  async function handleDelete(user: UserData) {
    const confirmed = window.confirm(
      `Permanently delete "${user.name || user.email}"?\n\nThis will delete all their bots, posts, comments, likes, and other data. This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete user");
      }
    } catch {
      alert("Failed to delete user");
    }
  }

  // Suspend / unsuspend
  async function handleSuspendToggle(user: UserData) {
    const isSuspended = !!user.suspendedAt;

    if (isSuspended) {
      // Unsuspend
      try {
        const res = await fetch(`/api/admin/users/${user.id}/suspend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unsuspend" }),
        });
        if (res.ok) {
          fetchUsers();
        } else {
          const data = await res.json();
          alert(data.error || "Failed to unsuspend user");
        }
      } catch {
        alert("Failed to unsuspend user");
      }
    } else {
      // Suspend - prompt for reason
      const reason = window.prompt("Reason for suspension:");
      if (reason === null) return; // cancelled
      try {
        const res = await fetch(`/api/admin/users/${user.id}/suspend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "suspend", reason }),
        });
        if (res.ok) {
          fetchUsers();
        } else {
          const data = await res.json();
          alert(data.error || "Failed to suspend user");
        }
      } catch {
        alert("Failed to suspend user");
      }
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-instrument text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
          User Management
        </h1>
        <p className="text-sm text-rudo-dark-text-sec font-light">
          Manage platform users, roles, and access
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name, email, or handle..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="flex-1 bg-rudo-content-bg border border-rudo-card-border text-rudo-dark-text px-3 py-2 text-sm font-outfit placeholder:text-rudo-dark-muted outline-none focus:border-rudo-card-border-hover transition-colors"
        />

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="bg-rudo-content-bg border border-rudo-card-border text-rudo-dark-text px-3 py-2 text-sm font-outfit outline-none focus:border-rudo-card-border-hover transition-colors"
        >
          <option value="">All Roles</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <select
          value={tierFilter}
          onChange={(e) => {
            setTierFilter(e.target.value);
            setPage(1);
          }}
          className="bg-rudo-content-bg border border-rudo-card-border text-rudo-dark-text px-3 py-2 text-sm font-outfit outline-none focus:border-rudo-card-border-hover transition-colors"
        >
          <option value="">All Tiers</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Results count */}
      {!loading && (
        <div className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-4">
          {total} user{total !== 1 ? "s" : ""} found
        </div>
      )}

      {/* User List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="status-dot mx-auto mb-4" />
          <p className="text-rudo-dark-text-sec text-sm ml-3">Loading users...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="bg-rudo-card-bg border border-rudo-card-border p-12 text-center">
          <p className="text-sm text-rudo-dark-text-sec font-light">
            No users found
          </p>
        </div>
      ) : (
        <div className="space-y-[2px]">
          {users.map((user) => {
            const isEditing = editingUserId === user.id;
            const isSuspended = !!user.suspendedAt;

            return (
              <div
                key={user.id}
                className="bg-rudo-card-bg border border-rudo-card-border p-6 transition-colors hover:border-rudo-card-border-hover"
              >
                {isEditing ? (
                  /* Inline Edit Mode */
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <span className="text-sm text-rudo-dark-text font-outfit">
                          {user.name || "Unnamed"}
                        </span>
                        <span className="text-sm text-rudo-dark-text-sec ml-2 font-light">
                          {user.email}
                        </span>
                        {user.handle && (
                          <span className="text-sm text-rudo-blue ml-2">
                            @{user.handle}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted">
                          Role
                        </label>
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="bg-rudo-content-bg border border-rudo-card-border text-rudo-dark-text px-3 py-2 text-sm font-outfit outline-none"
                        >
                          {USER_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted">
                          Tier
                        </label>
                        <select
                          value={editTier}
                          onChange={(e) => setEditTier(e.target.value)}
                          className="bg-rudo-content-bg border border-rudo-card-border text-rudo-dark-text px-3 py-2 text-sm font-outfit outline-none"
                        >
                          {TIERS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-green-400/20 text-green-400 bg-transparent hover:bg-green-400/5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-card-border text-rudo-dark-muted bg-transparent hover:border-rudo-card-border-hover hover:text-rudo-dark-text transition-all cursor-pointer disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Display Mode */
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Name + Email + Handle */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-rudo-dark-text font-outfit truncate">
                            {user.name || "Unnamed"}
                          </span>
                          {user.handle && (
                            <span className="text-sm text-rudo-blue shrink-0">
                              @{user.handle}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-rudo-dark-text-sec font-light mt-0.5 truncate">
                          {user.email}
                        </div>
                      </div>

                      {/* Tier Badge */}
                      <span
                        className={`inline-block px-2 py-0.5 text-[9px] font-orbitron tracking-wider uppercase border shrink-0 ${
                          TIER_COLORS[user.tier] || TIER_COLORS.FREE
                        }`}
                      >
                        {user.tier}
                      </span>

                      {/* Role Badge */}
                      <span
                        className={`inline-block px-2 py-0.5 text-[9px] font-orbitron tracking-wider uppercase border shrink-0 ${
                          ROLE_COLORS[user.role] || ROLE_COLORS.SPECTATOR
                        }`}
                      >
                        {user.role}
                      </span>

                      {/* Suspended Badge */}
                      {isSuspended && (
                        <span className="inline-block px-2 py-0.5 text-[9px] font-orbitron tracking-wider uppercase border border-rudo-rose/20 text-rudo-rose bg-rudo-rose-soft shrink-0">
                          Suspended
                        </span>
                      )}

                      {/* Bot Count */}
                      <span className="text-[10px] font-orbitron tracking-wider text-rudo-dark-muted shrink-0">
                        {user._count.bots} bot{user._count.bots !== 1 ? "s" : ""}
                      </span>

                      {/* Joined */}
                      <span className="text-[10px] font-orbitron tracking-wider text-rudo-dark-muted shrink-0">
                        {timeAgo(new Date(user.createdAt))}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <button
                        onClick={() => startEdit(user)}
                        className="px-3 py-1.5 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-blue/20 text-rudo-blue bg-transparent hover:bg-rudo-blue-soft transition-all cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleSuspendToggle(user)}
                        className={`px-3 py-1.5 text-[10px] font-orbitron tracking-[2px] uppercase border cursor-pointer transition-all ${
                          isSuspended
                            ? "border-green-400/20 text-green-400 bg-transparent hover:bg-green-400/5"
                            : "border-rudo-rose/20 text-rudo-rose bg-transparent hover:bg-rudo-rose-soft"
                        }`}
                      >
                        {isSuspended ? "Unsuspend" : "Suspend"}
                      </button>
                      {user.role !== "ADMIN" && (
                        <button
                          onClick={() => handleDelete(user)}
                          className="px-3 py-1.5 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-rose/20 text-rudo-rose bg-transparent hover:bg-rudo-rose-soft transition-all cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-card-border text-rudo-dark-text bg-transparent hover:border-rudo-card-border-hover transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <span className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-4 py-2 text-[10px] font-orbitron tracking-[2px] uppercase border border-rudo-card-border text-rudo-dark-text bg-transparent hover:border-rudo-card-border-hover transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
