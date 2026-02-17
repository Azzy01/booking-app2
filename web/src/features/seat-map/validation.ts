import {
  MAP_SCHEMA_VERSION,
  type MapDraftDocument,
  type SeatGeometry,
  type SeatTypeValue,
} from "./types";

export type LabelUniquenessScope = "CLUB" | "FLOOR";

export interface ValidationIssue {
  code: string;
  message: string;
  path: string;
}

export interface ValidationOptions {
  labelUniquenessScope?: LabelUniquenessScope;
  requireSegmentAssignment?: boolean;
  requireAtLeastOneSeat?: boolean;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  parsed?: MapDraftDocument;
}

const VALID_SEAT_TYPES = new Set<SeatTypeValue>(["PC", "CONSOLE", "VR", "OTHER"]);

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function isFiniteNumber(input: unknown): input is number {
  return typeof input === "number" && Number.isFinite(input);
}

function geometryWithinFloor(geometry: SeatGeometry, width: number, height: number): boolean {
  if (geometry.type === "RECT") {
    return (
      geometry.x >= 0 &&
      geometry.y >= 0 &&
      geometry.width > 0 &&
      geometry.height > 0 &&
      geometry.x + geometry.width <= width &&
      geometry.y + geometry.height <= height
    );
  }

  return (
    geometry.radius > 0 &&
    geometry.x - geometry.radius >= 0 &&
    geometry.y - geometry.radius >= 0 &&
    geometry.x + geometry.radius <= width &&
    geometry.y + geometry.radius <= height
  );
}

export function validateDraftMap(
  input: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const labelScope = options.labelUniquenessScope ?? "CLUB";
  const requireSegment = options.requireSegmentAssignment ?? true;
  const requireSeats = options.requireAtLeastOneSeat ?? false;

  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [{ code: "INVALID_ROOT", message: "Draft map must be an object.", path: "$" }],
    };
  }

  if (input.schemaVersion !== MAP_SCHEMA_VERSION) {
    issues.push({
      code: "INVALID_SCHEMA_VERSION",
      message: `schemaVersion must be ${MAP_SCHEMA_VERSION}.`,
      path: "schemaVersion",
    });
  }

  const floorsValue = input.floors;
  const seatsValue = input.seats;

  if (!Array.isArray(floorsValue)) {
    issues.push({ code: "INVALID_FLOORS", message: "floors must be an array.", path: "floors" });
  }

  if (!Array.isArray(seatsValue)) {
    issues.push({ code: "INVALID_SEATS", message: "seats must be an array.", path: "seats" });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const floors = floorsValue as unknown[];
  const seats = seatsValue as unknown[];

  if (floors.length === 0) {
    issues.push({ code: "NO_FLOORS", message: "At least one floor is required.", path: "floors" });
  }

  if (requireSeats && seats.length === 0) {
    issues.push({
      code: "NO_SEATS",
      message: "At least one seat is required before publish.",
      path: "seats",
    });
  }

  const floorBounds = new Map<string, { width: number; height: number }>();
  const floorRooms = new Map<string, Set<string>>();
  const floorIds = new Set<string>();

  floors.forEach((rawFloor, floorIndex) => {
    const basePath = `floors[${floorIndex}]`;

    if (!isRecord(rawFloor)) {
      issues.push({
        code: "INVALID_FLOOR",
        message: "Each floor must be an object.",
        path: basePath,
      });
      return;
    }

    const floorId = rawFloor.id;
    const width = rawFloor.width;
    const height = rawFloor.height;

    if (typeof floorId !== "string" || floorId.trim().length === 0) {
      issues.push({
        code: "INVALID_FLOOR_ID",
        message: "Floor id is required.",
        path: `${basePath}.id`,
      });
      return;
    }

    if (floorIds.has(floorId)) {
      issues.push({
        code: "DUPLICATE_FLOOR_ID",
        message: `Duplicate floor id: ${floorId}.`,
        path: `${basePath}.id`,
      });
      return;
    }
    floorIds.add(floorId);

    if (!isFiniteNumber(width) || width <= 0) {
      issues.push({
        code: "INVALID_FLOOR_WIDTH",
        message: "Floor width must be a positive number.",
        path: `${basePath}.width`,
      });
    }

    if (!isFiniteNumber(height) || height <= 0) {
      issues.push({
        code: "INVALID_FLOOR_HEIGHT",
        message: "Floor height must be a positive number.",
        path: `${basePath}.height`,
      });
    }

    if (isFiniteNumber(width) && width > 0 && isFiniteNumber(height) && height > 0) {
      floorBounds.set(floorId, { width, height });
    }

    const rooms = rawFloor.rooms;
    if (rooms !== undefined && !Array.isArray(rooms)) {
      issues.push({
        code: "INVALID_ROOMS",
        message: "rooms must be an array when present.",
        path: `${basePath}.rooms`,
      });
    }

    const roomIds = new Set<string>();
    if (Array.isArray(rooms)) {
      rooms.forEach((rawRoom, roomIndex) => {
        const roomPath = `${basePath}.rooms[${roomIndex}]`;
        if (!isRecord(rawRoom) || typeof rawRoom.id !== "string" || rawRoom.id.trim().length === 0) {
          issues.push({
            code: "INVALID_ROOM",
            message: "Room id is required.",
            path: `${roomPath}.id`,
          });
          return;
        }
        if (roomIds.has(rawRoom.id)) {
          issues.push({
            code: "DUPLICATE_ROOM_ID",
            message: `Duplicate room id on floor ${floorId}: ${rawRoom.id}.`,
            path: `${roomPath}.id`,
          });
          return;
        }
        roomIds.add(rawRoom.id);
      });
    }

    floorRooms.set(floorId, roomIds);
  });

  const seatIds = new Set<string>();
  const labelKeys = new Set<string>();

  seats.forEach((rawSeat, seatIndex) => {
    const basePath = `seats[${seatIndex}]`;

    if (!isRecord(rawSeat)) {
      issues.push({ code: "INVALID_SEAT", message: "Seat must be an object.", path: basePath });
      return;
    }

    const seatId = rawSeat.id;
    const label = rawSeat.label;
    const floorId = rawSeat.floorId;
    const segmentId = rawSeat.segmentId;
    const seatType = rawSeat.seatType;
    const roomId = rawSeat.roomId;

    if (typeof seatId !== "string" || seatId.trim().length === 0) {
      issues.push({
        code: "INVALID_SEAT_ID",
        message: "Seat id is required.",
        path: `${basePath}.id`,
      });
      return;
    }

    if (seatIds.has(seatId)) {
      issues.push({
        code: "DUPLICATE_SEAT_ID",
        message: `Duplicate seat id: ${seatId}.`,
        path: `${basePath}.id`,
      });
      return;
    }
    seatIds.add(seatId);

    if (typeof label !== "string" || label.trim().length === 0) {
      issues.push({
        code: "INVALID_SEAT_LABEL",
        message: "Seat label is required.",
        path: `${basePath}.label`,
      });
    }

    if (typeof floorId !== "string" || floorId.trim().length === 0) {
      issues.push({
        code: "INVALID_SEAT_FLOOR",
        message: "Seat floorId is required.",
        path: `${basePath}.floorId`,
      });
      return;
    }

    const floor = floorBounds.get(floorId);
    if (!floor) {
      issues.push({
        code: "UNKNOWN_FLOOR",
        message: `Seat floorId does not exist: ${floorId}.`,
        path: `${basePath}.floorId`,
      });
      return;
    }

    if (requireSegment && (typeof segmentId !== "string" || segmentId.trim().length === 0)) {
      issues.push({
        code: "MISSING_SEGMENT",
        message: "segmentId is required.",
        path: `${basePath}.segmentId`,
      });
    }

    if (typeof seatType !== "string" || !VALID_SEAT_TYPES.has(seatType as SeatTypeValue)) {
      issues.push({
        code: "INVALID_SEAT_TYPE",
        message: "seatType must be one of PC, CONSOLE, VR, OTHER.",
        path: `${basePath}.seatType`,
      });
    }

    if (roomId !== undefined && roomId !== null && typeof roomId !== "string") {
      issues.push({
        code: "INVALID_ROOM_REF",
        message: "roomId must be a string when present.",
        path: `${basePath}.roomId`,
      });
    }

    if (typeof roomId === "string") {
      const knownRooms = floorRooms.get(floorId);
      if (knownRooms && !knownRooms.has(roomId)) {
        issues.push({
          code: "UNKNOWN_ROOM",
          message: `Seat roomId does not exist on floor ${floorId}: ${roomId}.`,
          path: `${basePath}.roomId`,
        });
      }
    }

    const geometry = rawSeat.geometry;
    if (!isRecord(geometry) || (geometry.type !== "RECT" && geometry.type !== "CIRCLE")) {
      issues.push({
        code: "INVALID_GEOMETRY",
        message: "Seat geometry must be RECT or CIRCLE.",
        path: `${basePath}.geometry`,
      });
      return;
    }

    let normalizedGeometry: SeatGeometry | null = null;

    if (geometry.type === "RECT") {
      if (
        !isFiniteNumber(geometry.x) ||
        !isFiniteNumber(geometry.y) ||
        !isFiniteNumber(geometry.width) ||
        !isFiniteNumber(geometry.height)
      ) {
        issues.push({
          code: "INVALID_RECT_GEOMETRY",
          message: "RECT geometry requires numeric x, y, width, height.",
          path: `${basePath}.geometry`,
        });
      } else {
        normalizedGeometry = {
          type: "RECT",
          x: geometry.x,
          y: geometry.y,
          width: geometry.width,
          height: geometry.height,
          rotation: isFiniteNumber(geometry.rotation) ? geometry.rotation : undefined,
        };
      }
    }

    if (geometry.type === "CIRCLE") {
      if (!isFiniteNumber(geometry.x) || !isFiniteNumber(geometry.y) || !isFiniteNumber(geometry.radius)) {
        issues.push({
          code: "INVALID_CIRCLE_GEOMETRY",
          message: "CIRCLE geometry requires numeric x, y, radius.",
          path: `${basePath}.geometry`,
        });
      } else {
        normalizedGeometry = {
          type: "CIRCLE",
          x: geometry.x,
          y: geometry.y,
          radius: geometry.radius,
        };
      }
    }

    if (normalizedGeometry && !geometryWithinFloor(normalizedGeometry, floor.width, floor.height)) {
      issues.push({
        code: "SEAT_OUTSIDE_FLOOR",
        message: `Seat ${seatId} is outside floor bounds (${floor.width}x${floor.height}).`,
        path: `${basePath}.geometry`,
      });
    }

    if (typeof label === "string" && label.trim().length > 0) {
      const labelKey = labelScope === "CLUB" ? label.toLowerCase() : `${floorId}::${label.toLowerCase()}`;
      if (labelKeys.has(labelKey)) {
        issues.push({
          code: "DUPLICATE_LABEL",
          message: `Duplicate seat label for scope ${labelScope}: ${label}.`,
          path: `${basePath}.label`,
        });
      } else {
        labelKeys.add(labelKey);
      }
    }
  });

  return {
    ok: issues.length === 0,
    issues,
    parsed: issues.length === 0 ? (input as unknown as MapDraftDocument) : undefined,
  };
}
