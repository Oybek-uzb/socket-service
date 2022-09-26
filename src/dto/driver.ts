export interface Driver {
    id: number;
    latitude: number | null;
    longitude: number | null;
}
export interface DriverFromGeoRedis {
 key: string;
 distance: number | null;
 latitude: number | null;
 longitude: number | null;
}
