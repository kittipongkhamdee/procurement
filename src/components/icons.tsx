type IconProps = { className?: string };

function base(paths: React.ReactNode) {
  return function Icon({ className }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
        {paths}
      </svg>
    );
  };
}

export const HomeIcon = base(
  <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5M5.5 10v9a1 1 0 0 0 1 1H9.5v-6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6H17.5a1 1 0 0 0 1-1v-9" />,
);

export const FolderIcon = base(
  <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 7.5a1 1 0 0 1 1-1H9l2 2h8.5a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-11Z" />,
);

export const FileTextIcon = base(
  <>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 3.5h8l4 4v13a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
    <path strokeLinecap="round" d="M9 12h6M9 15.5h6M9 8.5h3" />
  </>,
);

export const ClipboardCheckIcon = base(
  <>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 4.5h7a1 1 0 0 1 1 1V6h1a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h1v-.5a1 1 0 0 1 1-1Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 13.5 11 15l3.5-4" />
  </>,
);

export const ShoppingCartIcon = base(
  <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 4.5h2l2 12.5h10l1.5-8h-13M9 20a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm8 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />,
);

export const StoreIcon = base(
  <path strokeLinecap="round" strokeLinejoin="round" d="M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9M3 6l1.5-2.5h15L21 6M3 6l.7 3.2A1.7 1.7 0 0 0 5.4 10.5h0a1.7 1.7 0 0 0 1.6-1.1M7 9.4a1.7 1.7 0 0 0 3.3 0M10.3 9.4a1.7 1.7 0 0 0 3.4 0M13.7 9.4a1.7 1.7 0 0 0 3.3 0M17 9.4a1.7 1.7 0 0 0 3.3.9" />,
);

export const FileSignatureIcon = base(
  <>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 3.5H7a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9l-5-5.5Z" />
    <path strokeLinecap="round" d="M9 12.5s1-1 2 0 2 0 2 0M9 16h6" />
  </>,
);

export const TruckIcon = base(
  <>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6.5h9v9H3zM12 10h4l3 3v2.5h-7zM6 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10.5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
  </>,
);

export const WalletIcon = base(
  <>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 7.5a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-11Z" />
    <path strokeLinecap="round" d="M3.5 7.5 15 4l3 3.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
  </>,
);

export const CoinsIcon = base(
  <>
    <ellipse cx="9" cy="7" rx="5.5" ry="3" />
    <path strokeLinecap="round" d="M3.5 7v4c0 1.66 2.46 3 5.5 3s5.5-1.34 5.5-3V7" />
    <path strokeLinecap="round" d="M3.5 11v4c0 1.66 2.46 3 5.5 3 .9 0 1.75-.12 2.5-.34" />
    <path strokeLinecap="round" d="M13.5 10.3c3 .2 5 1.4 5 2.7 0 1.5-2.5 2.7-5.5 2.7-1 0-1.9-.13-2.7-.36" />
    <path strokeLinecap="round" d="M13.5 14v2.7c0 1.3 2 2.5 5 2.5s5-1.2 5-2.5V14" />
  </>,
);

export const ArchiveIcon = base(
  <>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 5.5h17v3.5h-17z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 9v9a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V9" />
    <path strokeLinecap="round" d="M10 13h4" />
  </>,
);

export const UsersIcon = base(
  <>
    <circle cx="9" cy="8" r="3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 19c.5-3.2 2.7-5 5.5-5s5 1.8 5.5 5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 6a3 3 0 0 1 0 5.8M18 19c-.3-2.2-1.3-3.7-2.8-4.5" />
  </>,
);

export const SettingsIcon = base(
  <>
    <circle cx="12" cy="12" r="3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 13.5a1.8 1.8 0 0 0 .36 1.98l.06.07a2.17 2.17 0 1 1-3.07 3.07l-.07-.06a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.65V20a2.17 2.17 0 0 1-4.33 0v-.1a1.8 1.8 0 0 0-1.17-1.65 1.8 1.8 0 0 0-1.98.36l-.07.06a2.17 2.17 0 1 1-3.07-3.07l.06-.07a1.8 1.8 0 0 0 .36-1.98 1.8 1.8 0 0 0-1.65-1.1H4a2.17 2.17 0 0 1 0-4.33h.1a1.8 1.8 0 0 0 1.65-1.17 1.8 1.8 0 0 0-.36-1.98l-.06-.07a2.17 2.17 0 1 1 3.07-3.07l.07.06a1.8 1.8 0 0 0 1.98.36H10.5a1.8 1.8 0 0 0 1.1-1.65V4a2.17 2.17 0 0 1 4.33 0v.1a1.8 1.8 0 0 0 1.1 1.65 1.8 1.8 0 0 0 1.98-.36l.07-.06a2.17 2.17 0 1 1 3.07 3.07l-.06.07a1.8 1.8 0 0 0-.36 1.98V10.5a1.8 1.8 0 0 0 1.65 1.1H20a2.17 2.17 0 0 1 0 4.33h-.1a1.8 1.8 0 0 0-1.65 1.1Z" />
  </>,
);

export const SearchIcon = base(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path strokeLinecap="round" d="m20 20-4-4" />
  </>,
);

export const BellIcon = base(
  <>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 16v-5a6 6 0 1 0-12 0v5l-1.5 2.5h15L18 16Z" />
    <path strokeLinecap="round" d="M10 21a2 2 0 0 0 4 0" />
  </>,
);

export const MenuIcon = base(<path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />);

export const CloseIcon = base(<path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />);

export const ChevronLeftIcon = base(<path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-7 7 7 7" />);

export const ChevronRightIcon = base(<path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />);

export const PlusIcon = base(<path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />);

export const CheckIcon = base(<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />);

export const LightbulbIcon = base(
  <>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 18h6M10 21h4M8.5 14.5A5.5 5.5 0 1 1 15.5 14.5c-.8.9-1.5 1.7-1.5 2.5h-4c0-.8-.7-1.6-1.5-2.5Z" />
    <path strokeLinecap="round" d="M12 3v1.5M4.5 6l1 1M19.5 6l-1 1" />
  </>,
);

export const DownloadIcon = base(
  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0 4-4m-4 4-4-4M5 18.5h14" />,
);

export const TrashIcon = base(
  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13M10 11v6m4-6v6" />,
);

export const LogOutIcon = base(
  <>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 8V6a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 12h10.5m0 0-3-3m3 3-3 3" />
  </>,
);

export const GridIcon = base(
  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
);

export function WordFileIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#2563eb" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="white" fontFamily="sans-serif">
        W
      </text>
    </svg>
  );
}

export function PdfFileIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#dc2626" />
      <text x="12" y="15" textAnchor="middle" fontSize="7" fontWeight="700" fill="white" fontFamily="sans-serif">
        PDF
      </text>
    </svg>
  );
}
