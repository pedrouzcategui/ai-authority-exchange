type ActionIconProps = {
  className?: string;
};

type ActionTooltipProps = {
  label: string;
};

const defaultClassName = "h-[18px] w-[18px]";

function getIconClassName(className?: string) {
  return className ?? defaultClassName;
}

export function ActionTooltip({ label }: ActionTooltipProps) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-0 bottom-full z-20 mb-2 translate-y-1 whitespace-nowrap rounded-xl bg-[rgba(51,71,91,0.94)] px-3 py-2 text-xs font-medium text-white opacity-0 shadow-lg transition duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
    >
      {label}
    </span>
  );
}

export function FindMatchesIcon({ className }: ActionIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={getIconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  );
}

export function CategoryIcon({ className }: ActionIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={getIconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <rect x="4" y="5" width="7" height="6" rx="1.5" />
      <rect x="13" y="5" width="7" height="6" rx="1.5" />
      <rect x="8.5" y="13" width="7" height="6" rx="1.5" />
    </svg>
  );
}

export function CategorySectorIcon({ className }: ActionIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={getIconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <circle cx="8" cy="8" r="3.5" />
      <circle cx="16" cy="8" r="3.5" />
      <circle cx="12" cy="16" r="3.5" />
      <path d="M10.6 10.6 11.4 13" />
      <path d="M13.4 10.6 12.6 13" />
    </svg>
  );
}

export function ExternalLinkIcon({ className }: ActionIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={getIconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M14 5h5v5" />
      <path d="M10 14 19 5" />
      <path d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
    </svg>
  );
}

export function BackIcon({ className }: ActionIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={getIconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M15 18 9 12l6-6" />
      <path d="M9 12h10" />
    </svg>
  );
}

export function CreateMatchIcon({ className }: ActionIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={getIconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M8.5 8.5 15.5 15.5" />
      <path d="M15.5 8.5 8.5 15.5" opacity="0.45" />
      <circle cx="7" cy="12" r="3" />
      <circle cx="17" cy="12" r="3" />
      <path d="M12 5v4" />
      <path d="M10 7h4" />
    </svg>
  );
}

export function DraftEmailIcon({ className }: ActionIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={getIconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" />
      <path d="m5 8 7 5 7-5" />
      <path d="M18.5 4.5v4" />
      <path d="M16.5 6.5h4" />
    </svg>
  );
}

export function EditBusinessIcon({ className }: ActionIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={getIconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M4 20h4l10.2-10.2a2.1 2.1 0 0 0 0-3L17.2 5a2.1 2.1 0 0 0-3 0L4 15.2V20Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}

export function EditLinksIcon({ className }: ActionIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={getIconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="m7.4 16.6-1.6 1.6a3 3 0 1 1-4.2-4.2l3.6-3.6a3 3 0 0 1 4.2 0" />
      <path d="m16.6 7.4 1.6-1.6a3 3 0 0 1 4.2 4.2l-3.6 3.6a3 3 0 0 1-4.2 0" />
    </svg>
  );
}

export function PlusIcon({ className }: ActionIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={getIconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function SaveIcon({ className }: ActionIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={getIconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M5 6.5A1.5 1.5 0 0 1 6.5 5h9.9a1.5 1.5 0 0 1 1.06.44l1.1 1.1A1.5 1.5 0 0 1 19 7.6v9.9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17.5v-11Z" />
      <path d="M8 5.5v4h7v-4" />
      <path d="M8 19v-5.5h8V19" />
    </svg>
  );
}

export function TrashIcon({ className }: ActionIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={getIconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M4.5 7h15" />
      <path d="M9.5 4.5h5" />
      <path d="M8 7v10.5A1.5 1.5 0 0 0 9.5 19h5a1.5 1.5 0 0 0 1.5-1.5V7" />
      <path d="M10 10.5v5" />
      <path d="M14 10.5v5" />
    </svg>
  );
}
