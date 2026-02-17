export const MAP_SCHEMA_VERSION = 1 as const;

export type SeatTypeValue = "PC" | "CONSOLE" | "VR" | "OTHER";
export type GeometryShape = "RECT" | "CIRCLE";

export interface Point {
  x: number;
  y: number;
}

export interface RectGeometry {
  type: "RECT";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface CircleGeometry {
  type: "CIRCLE";
  x: number;
  y: number;
  radius: number;
}

export type SeatGeometry = RectGeometry | CircleGeometry;

export interface RoomRectGeometry {
  type: "RECT";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoomPolygonGeometry {
  type: "POLYGON";
  points: Point[];
}

export type RoomGeometry = RoomRectGeometry | RoomPolygonGeometry;

export interface RoomElement {
  id: string;
  name: string;
  color?: string | null;
  geometry: RoomGeometry;
}

export interface WallElement {
  id: string;
  points: Point[];
  thickness?: number;
}

export interface FloorElement {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundImageUrl?: string | null;
  rooms: RoomElement[];
  walls: WallElement[];
}

export interface SeatElement {
  id: string;
  label: string;
  floorId: string;
  roomId?: string | null;
  segmentId: string;
  seatType: SeatTypeValue;
  geometry: SeatGeometry;
  meta?: Record<string, unknown> | null;
  disabled?: boolean;
}

export interface MapDraftDocument {
  schemaVersion: typeof MAP_SCHEMA_VERSION;
  floors: FloorElement[];
  seats: SeatElement[];
}

export type AvailabilityStatus = "AVAILABLE" | "HELD" | "BOOKED" | "DISABLED";
