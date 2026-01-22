export const dynamic = "force-dynamic";

async function getSlots() {
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
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
        Slots MVP
      </h1>

      <form
        action="/api/slots"
        method="post"
        style={{
          display: "grid",
          gap: 12,
          padding: 16,
          border: "1px solid #333",
          borderRadius: 12,
          marginBottom: 24,
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <label>Pitch</label>
          <input name="pitch" required placeholder="Pitch A" />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Start</label>
          <input name="startsAt" type="datetime-local" required />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>End</label>
          <input name="endsAt" type="datetime-local" required />
        </div>

        <button type="submit">Create Slot</button>

        <p style={{ opacity: 0.7, marginTop: 4 }}>
          Note: for now this form submits as JSON is not supported by pure HTML
          POST. We’ll switch it to a client component next.
        </p>
      </form>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
        Existing Slots
      </h2>

      <ul style={{ display: "grid", gap: 10 }}>
        {slots.map((s: any) => (
          <li
            key={s.id}
            style={{
              padding: 12,
              border: "1px solid #333",
              borderRadius: 12,
            }}
          >
            <div>
              <b>{s.pitch}</b>
            </div>
            <div>
              {new Date(s.startsAt).toLocaleString()} →{" "}
              {new Date(s.endsAt).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
