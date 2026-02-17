export const dynamic = "force-dynamic";

interface SlotDto {
  id: string;
  clubId: string;
  label: string;
  startsAt: string;
  endsAt: string;
}

async function getSlots(): Promise<SlotDto[]> {
  const res = await fetch("http://localhost:3000/api/slots", {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to load slots");
  return res.json();
}

export default async function SlotsPage() {
  const slots = await getSlots();

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
        Slots API (Draft)
      </h1>

      <p style={{ marginBottom: 20, opacity: 0.8 }}>
        Create slots with <code>POST /api/clubs/{"{clubId}"}/slots</code> and read
        all slots from <code>GET /api/slots?clubId=...</code>.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
        Existing Slots
      </h2>

      {slots.length === 0 ? (
        <p style={{ opacity: 0.8 }}>No slots yet.</p>
      ) : (
        <ul style={{ display: "grid", gap: 10 }}>
          {slots.map((slot) => (
            <li
              key={slot.id}
              style={{
                padding: 12,
                border: "1px solid #333",
                borderRadius: 12,
              }}
            >
              <div>
                <b>{slot.label}</b>
              </div>
              <div style={{ opacity: 0.8 }}>Club: {slot.clubId}</div>
              <div>{`${new Date(slot.startsAt).toLocaleString()} -> ${new Date(slot.endsAt).toLocaleString()}`}</div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
