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