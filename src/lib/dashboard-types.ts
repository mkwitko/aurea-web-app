import type { GetDashboardQueryResponse } from '@/api/generated/types/GetDashboard';

// Kubb types `nextAction.endDate`, `recent[].at` and `loop.experiment.endDate`
// as `Date` because the OpenAPI schema marks them `date-time`, but the wire
// format — and every fixture in this repo that isn't running through the JSON
// body of a mocked fetch — is really an ISO string; nothing here ever gets a
// live `Date` instance. Narrowing each wire-shape leaf to what it actually is,
// instead of chasing a mismatched generated type with casts at every call
// site, keeps every consumer typed without `any`. This is the single
// definition of the dashboard's wire shape; components re-export the type
// they own so no downstream import breaks.

export type DashboardNextAction = Omit<GetDashboardQueryResponse['nextAction'], 'endDate'> & {
  endDate: string | null;
};

export type DashboardRecentItem = Omit<GetDashboardQueryResponse['recent'][number], 'at'> & {
  at: string;
};

type DashboardLoopResponse = NonNullable<GetDashboardQueryResponse['loop']>;

/** The response's `loop`, narrowed to the non-null case. */
export type DashboardLoop = Omit<DashboardLoopResponse, 'experiment'> & {
  experiment: (Omit<NonNullable<DashboardLoopResponse['experiment']>, 'endDate'> & { endDate: string | null }) | null;
};
