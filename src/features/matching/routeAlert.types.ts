export interface RouteAlert {
  id: string;
  userId: string | null;
  email: string;
  pickupLocationId: string;
  dropLocationId: string;
  pickupName: string;
  dropName: string;
  date: string;
  createdAt: string;
  status: 'ACTIVE' | 'NOTIFIED' | 'CANCELLED';
}

export interface CreateRouteAlertInput {
  userId?: string | null;
  email: string;
  pickupLocationId: string;
  dropLocationId: string;
  pickupName: string;
  dropName: string;
  date: string;
}
