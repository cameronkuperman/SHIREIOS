export interface RouteOutput {
  routeId: string;
  routedTable: {
    tableId: string;
    section: string;
  };
  routedWaiter: {
    waiterId: string;
    waiterName: string;
  };
  routedCleaner: {
    cleanerId: string;
  } | null;
}
