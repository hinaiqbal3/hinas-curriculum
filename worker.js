export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Get all thoughts from one section
    if (url.pathname === "/api/thoughts" && request.method === "GET") {
      const section = url.searchParams.get("section");

      const { results } = await env.DB.prepare(
        `SELECT * FROM thoughts
         WHERE section = ?
         ORDER BY created_at DESC`
      )
        .bind(section)
        .all();

      return Response.json(results);
    }

    // Create a new thought
    if (url.pathname === "/api/thoughts" && request.method === "POST") {
      const data = await request.json();

      const section = data.section?.trim();
      const title = data.title?.trim();

      if (!section || !title) {
        return Response.json(
          { error: "Section and title are required." },
          { status: 400 }
        );
      }

      const result = await env.DB.prepare(
        `INSERT INTO thoughts (section, title)
         VALUES (?, ?)`
      )
        .bind(section, title)
        .run();

      return Response.json({
        id: result.meta.last_row_id,
        section,
        title
      });
    }

    // Add/update the longer text inside a thought
    if (
      url.pathname.startsWith("/api/thoughts/") &&
      request.method === "PUT"
    ) {
      const id = url.pathname.split("/").pop();
      const data = await request.json();

      await env.DB.prepare(
        `UPDATE thoughts
         SET body = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
        .bind(data.body ?? "", id)
        .run();

      return Response.json({ success: true });
    }

    return env.ASSETS.fetch(request);
  }
};
