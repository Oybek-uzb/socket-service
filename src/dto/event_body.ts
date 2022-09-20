export interface EventBody {
  id?: number;
  client_id?: number | undefined;
  driver_id?: number | undefined;
  location?: string | undefined;
  order_amount?: number | undefined;
  status?: string;
  emit_action_id: string;
}
