import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faPlus } from "@fortawesome/free-solid-svg-icons";

import type { Organization } from "@/org/org.types";

type OrganizationSwitcherProps = {
  currentOrganization: Organization;
  organizations: Organization[];
  onSwitch: (organizationId: string) => void | Promise<void>;
  onCreate: () => void;
  showCreate?: boolean;
};

function OrganizationSwitcher({
  currentOrganization,
  organizations,
  onSwitch,
  onCreate,
  showCreate = true,
}: OrganizationSwitcherProps) {
  return (
    <div className="flex items-center gap-2" aria-label="Organization switcher">
      <div className="relative min-w-0">
        <select
          aria-label="Active organization"
          value={currentOrganization.id}
          onChange={(event) => void onSwitch(event.target.value)}
          className="max-w-52 appearance-none truncate rounded-xl border border-white/10 bg-slate-900 py-1.5 pr-8 pl-3 text-xs font-medium text-white transition-colors focus:border-red-500/30 focus:outline-none"
        >
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
        <FontAwesomeIcon
          icon={faChevronDown}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-2.5 size-3 -translate-y-1/2 text-slate-400"
        />
      </div>

      {showCreate ? (
        <button
          type="button"
          onClick={onCreate}
          aria-label="Create another organization"
          title="Create another organization"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-slate-300 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
        >
          <FontAwesomeIcon icon={faPlus} aria-hidden="true" className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

export { OrganizationSwitcher };
export type { OrganizationSwitcherProps };
