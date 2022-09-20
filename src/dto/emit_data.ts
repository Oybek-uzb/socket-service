import { EventBody } from './event_body';

export interface EmitData {
  room: string | undefined;
  socket: string;
  data: any;
}

export interface EmitDataForRedis {
  emit_data: EmitData;
  timer: string | null;
  attempts: number;
  isReceived: boolean;
}
