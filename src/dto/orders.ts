export interface Order {
  id: number;
  driver_id: number | null;
  client_id: number;
  order_id: number;
  order_type: 'city' | 'interregional';
  order_status: OrderStatuses;
  created_at: Date;
  updated_at: Date;
}

export enum OrderStatuses {
  ClientCancelled = 'client_cancelled',
  DriverCancelled = 'driver_cancelled',
  New = 'new',
  DriverAccepted = 'driver_accepted',
  ClientGoingOut = 'client_going_out',
  TripStarted = 'trip_started',
  OrderCompleted = 'order_completed',
}
export interface CityOrder {
  id: number;
  points: Points;
  tariff_id: number;
  cargo_type: CargoType;
  payment_type: 'cash' | any;
  card_id: number | null;
  has_conditioner: boolean;
  for_another: boolean;
  for_another_phone: string | null;
  receiver_comments: string | null;
  receiver_phone: string | null;
  price: number;
  comments: string | null;
  ride_info: RideInfo;
  created_at: Date;
}

enum CargoType {
  No = 'no',
  Small = 'small',
  Medium = 'medium',
  Large = 'large',
}

enum PaymentType {
  Cash = 'cash',
}

interface Points {
  distance: number | null;
  points: Point[];
}

interface Point {
  address: string;
  location: string;
}

interface RideInfo {
  driver_last_location: string | null;
  driver_last_address: string | null;
  order_amount: number | null;
  wait_time: number | null;
  wait_time_amount: number | null;
  ride_distance: number | null;
  ride_amount: number | null;
  ride_time: number | null;
  commission: number | null;
}

export interface OrderInfo {
  id: number;
  client_id: number;
  distance: number | null;
  from: string;
  to: string | null;
  from_loc: string;
  to_loc: string | null;
  payment_type: 'cash' | any;
  tariff_id: number;
  has_conditioner: boolean;
  comments: string | null;
  status: OrderStatuses;
  attempts: number;
  jobId: string;
}
