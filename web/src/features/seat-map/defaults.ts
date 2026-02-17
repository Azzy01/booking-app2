import { MAP_SCHEMA_VERSION, type MapDraftDocument } from "./types";

export function createDefaultDraftMap(): MapDraftDocument {
  return {
    schemaVersion: MAP_SCHEMA_VERSION,
    floors: [
      {
        id: "f1",
        name: "Floor 1",
        width: 2000,
        height: 1200,
        backgroundImageUrl: null,
        rooms: [],
        walls: [],
      },
    ],
    seats: [],
  };
}
