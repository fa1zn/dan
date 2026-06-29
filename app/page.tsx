export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 48, maxWidth: 720 }}>
      <h1 style={{ marginBottom: 4 }}>Dan</h1>
      <p style={{ marginTop: 0, color: "#666", fontSize: 18 }}>Pam&rsquo;s sales guy</p>
      <p>
        Dan works the North American franchise dealership market. This is his book of
        business: the system of record for every OEM-affiliated rooftop in the US and Canada.
      </p>
      <p>
        Phase 1 (this repo) is the data pipeline that builds and maintains the dataset. See{" "}
        <code>/pipeline</code> and the README. The dashboard where Dan works his accounts lands
        in Phase 2 and reads the pipeline&rsquo;s SQLite database.
      </p>
    </main>
  );
}
