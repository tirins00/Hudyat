import { createContext } from 'react';

/**
 * Shared context populated by `ActiveDrillWatcher` so `AppShell` can stack the
 * persistent "ACTIVE DRILL — Return to Alert" banner cleanly below the mobile
 * sticky top bar and beside the desktop sidebar without overlapping content.
 */
export const ActiveDrillBannerContext = createContext(null);
