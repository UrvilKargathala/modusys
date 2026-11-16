import type { OrgUser } from "@shared/mock/users";

export function MentionDropdown({
  users,
  onSelect,
}: {
  users: OrgUser[];
  onSelect: (user: OrgUser) => void;
}) {
  if (users.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 z-10 mb-1 w-56 overflow-hidden rounded-lg border border-grey-100 bg-card shadow-lg">
      {users.slice(0, 6).map((user) => (
        <button
          key={user.id}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(user);
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-body text-grey-700 hover:bg-light-600"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-transparent text-xs font-medium text-primary">
            {user.name[0]}
          </span>
          {user.name}
        </button>
      ))}
    </div>
  );
}
