import type { ReservationSource } from '@shire/shared';

export const STAFF_RESERVATION_SOURCES = ['host_dashboard', 'staff_phone'] as const;

export type StaffReservationSource = (typeof STAFF_RESERVATION_SOURCES)[number];

export function toStaffReservationSource(source?: ReservationSource | null): StaffReservationSource {
  switch (source) {
    case 'staff_phone':
    case 'phone':
      return 'staff_phone';
    default:
      return 'host_dashboard';
  }
}

export function getReservationSourceLabel(source?: ReservationSource | null): string | null {
  switch (source) {
    case 'host_dashboard':
    case 'manual':
      return 'Host';
    case 'staff_phone':
    case 'phone':
      return 'Phone';
    case 'website_widget':
    case 'web':
      return 'Web';
    case 'app_native':
      return 'App';
    case 'google_business_profile':
    case 'google':
      return 'Google';
    case 'walk_in':
      return 'Walk-In';
    case 'opentable':
      return 'OpenTable';
    case 'sevenrooms':
      return 'SevenRooms';
    case 'resy':
      return 'Resy';
    case 'yelp':
      return 'Yelp';
    case 'import':
      return 'Import';
    default:
      return null;
  }
}
