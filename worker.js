export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Get all thoughts in a section
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

    // Create a thought
    if (url.pathname === "/api/thoughts" && request.method === "POST") {
      const data = await request.json();

      const section = data.section?.trim();
      const title = data.title?.trim();

      if (!section || !title) {
        return Response.json(
          { error: "Section and thought are required." },
          { status: 400 }
        );
      }

      const result = await env.DB.prepare(
        `INSERT INTO thoughts (section, title)
         VALUES (?, ?)`
      )
        .bind(section, title)
        .run();

      const thought = await env.DB.prepare(
        `SELECT * FROM thoughts WHERE id = ?`
      )
        .bind(result.meta.last_row_id)
        .first();

      return Response.json(thought);
    }

    // Get one thought and its entries
    if (
      url.pathname.match(/^\/api\/thoughts\/\d+$/) &&
      request.method === "GET"
    ) {
      const id = url.pathname.split("/").pop();

      const thought = await env.DB.prepare(
        `SELECT * FROM thoughts WHERE id = ?`
      )
        .bind(id)
        .first();

      if (!thought) {
        return Response.json(
          { error: "Thought not found." },
          { status: 404 }
        );
      }

      const { results: entries } = await env.DB.prepare(
        `SELECT * FROM thought_entries
         WHERE thought_id = ?
         ORDER BY created_at ASC, id ASC`
      )
        .bind(id)
        .all();

      return Response.json({
        ...thought,
        entries
      });
    }

    // Edit the original thought
    if (
      url.pathname.match(/^\/api\/thoughts\/\d+$/) &&
      request.method === "PATCH"
    ) {
      const id = url.pathname.split("/").pop();
      const data = await request.json();

      const title = data.title?.trim();

      if (!title) {
        return Response.json(
          { error: "Thought cannot be empty." },
          { status: 400 }
        );
      }

      await env.DB.prepare(
        `UPDATE thoughts
         SET title = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
        .bind(title, id)
        .run();

      const thought = await env.DB.prepare(
        `SELECT * FROM thoughts WHERE id = ?`
      )
        .bind(id)
        .first();

      return Response.json(thought);
    }

    // Add an entry to a thought
    if (
      url.pathname.match(/^\/api\/thoughts\/\d+\/entries$/) &&
      request.method === "POST"
    ) {
      const thoughtId = url.pathname.split("/")[3];

      const data = await request.json();
      const content = data.content?.trim();

      if (!content) {
        return Response.json(
          { error: "Entry cannot be empty." },
          { status: 400 }
        );
      }

      const thought = await env.DB.prepare(
        `SELECT id FROM thoughts WHERE id = ?`
      )
        .bind(thoughtId)
        .first();

      if (!thought) {
        return Response.json(
          { error: "Thought not found." },
          { status: 404 }
        );
      }

      const result = await env.DB.prepare(
        `INSERT INTO thought_entries
         (
           thought_id,
           content,
           original_date,
           original_date_label,
           entry_types,
           custom_type
         )
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(
          thoughtId,
          content,
          data.original_date || null,
          data.original_date_label?.trim() || null,
          data.entry_types?.trim() || null,
          data.custom_type?.trim() || null
        )
        .run();

      await env.DB.prepare(
        `UPDATE thoughts
         SET updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
        .bind(thoughtId)
        .run();

      const entry = await env.DB.prepare(
        `SELECT * FROM thought_entries WHERE id = ?`
      )
        .bind(result.meta.last_row_id)
        .first();

      return Response.json(entry);
    }

    // Edit an entry
    if (
      url.pathname.match(/^\/api\/entries\/\d+$/) &&
      request.method === "PATCH"
    ) {
      const id = url.pathname.split("/").pop();
      const data = await request.json();

      const content = data.content?.trim();

      if (!content) {
        return Response.json(
          { error: "Entry cannot be empty." },
          { status: 400 }
        );
      }

      await env.DB.prepare(
        `UPDATE thought_entries
         SET content = ?,
             original_date = ?,
             original_date_label = ?,
             entry_types = ?,
             custom_type = ?
         WHERE id = ?`
      )
        .bind(
          content,
          data.original_date || null,
          data.original_date_label?.trim() || null,
          data.entry_types?.trim() || null,
          data.custom_type?.trim() || null,
          id
        )
        .run();

      const entry = await env.DB.prepare(
        `SELECT * FROM thought_entries WHERE id = ?`
      )
        .bind(id)
        .first();

      return Response.json(entry);
    }

    // Delete an individual entry
    if (
      url.pathname.match(/^\/api\/entries\/\d+$/) &&
      request.method === "DELETE"
    ) {
      const id = url.pathname.split("/").pop();

      await env.DB.prepare(
        `DELETE FROM thought_entries WHERE id = ?`
      )
        .bind(id)
        .run();

      return Response.json({ success: true });
    }

    // Delete a thought and everything inside it
    if (
      url.pathname.match(/^\/api\/thoughts\/\d+$/) &&
      request.method === "DELETE"
    ) {
      const id = url.pathname.split("/").pop();

      await env.DB.prepare(
        `DELETE FROM thought_entries WHERE thought_id = ?`
      )
        .bind(id)
        .run();

      await env.DB.prepare(
        `DELETE FROM thoughts WHERE id = ?`
      )
        .bind(id)
        .run();

      return Response.json({ success: true });
    }

    // ─────────────────────────────────────────────
    // NARRATIVE MEDICINE CONCEPT MAP
    // ─────────────────────────────────────────────

    // Get all connections for a section
    if (
      url.pathname === "/api/connections" &&
      request.method === "GET"
    ) {
      const section = url.searchParams.get("section");

      const { results } = await env.DB.prepare(
        `SELECT * FROM thought_connections
         WHERE section = ?
         ORDER BY created_at ASC`
      )
        .bind(section)
        .all();

      return Response.json(results);
    }

    // Connect two thoughts
    if (
      url.pathname === "/api/connections" &&
      request.method === "POST"
    ) {
      const data = await request.json();

      const section = data.section?.trim();
      let thoughtA = Number(data.thought_a_id);
      let thoughtB = Number(data.thought_b_id);

      if (!section || !thoughtA || !thoughtB) {
        return Response.json(
          { error: "Section and two thoughts are required." },
          { status: 400 }
        );
      }

      if (thoughtA === thoughtB) {
        return Response.json(
          { error: "A thought cannot connect to itself." },
          { status: 400 }
        );
      }

      if (thoughtA > thoughtB) {
        [thoughtA, thoughtB] = [thoughtB, thoughtA];
      }

      const thought1 = await env.DB.prepare(
        `SELECT id, section FROM thoughts WHERE id = ?`
      )
        .bind(thoughtA)
        .first();

      const thought2 = await env.DB.prepare(
        `SELECT id, section FROM thoughts WHERE id = ?`
      )
        .bind(thoughtB)
        .first();

      if (
        !thought1 ||
        !thought2 ||
        thought1.section !== section ||
        thought2.section !== section
      ) {
        return Response.json(
          { error: "Those thoughts could not be connected." },
          { status: 400 }
        );
      }

      await env.DB.prepare(
        `INSERT OR IGNORE INTO thought_connections
         (section, thought_a_id, thought_b_id)
         VALUES (?, ?, ?)`
      )
        .bind(section, thoughtA, thoughtB)
        .run();

      const connection = await env.DB.prepare(
        `SELECT * FROM thought_connections
         WHERE section = ?
         AND thought_a_id = ?
         AND thought_b_id = ?`
      )
        .bind(section, thoughtA, thoughtB)
        .first();

      return Response.json(connection);
    }

    // Delete a connection
    if (
      url.pathname.match(/^\/api\/connections\/\d+$/) &&
      request.method === "DELETE"
    ) {
      const id = url.pathname.split("/").pop();

      await env.DB.prepare(
        `DELETE FROM thought_connections WHERE id = ?`
      )
        .bind(id)
        .run();

      return Response.json({ success: true });
    }

    // Get saved bubble positions
    if (
      url.pathname === "/api/positions" &&
      request.method === "GET"
    ) {
      const section = url.searchParams.get("section");

      const { results } = await env.DB.prepare(
        `SELECT p.thought_id, p.x, p.y
         FROM thought_positions p
         JOIN thoughts t ON t.id = p.thought_id
         WHERE t.section = ?`
      )
        .bind(section)
        .all();

      return Response.json(results);
    }

    // Save a bubble position
    if (
      url.pathname === "/api/positions" &&
      request.method === "POST"
    ) {
      const data = await request.json();

      const thoughtId = Number(data.thought_id);
      const x = Number(data.x);
      const y = Number(data.y);

      if (
        !thoughtId ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {
        return Response.json(
          { error: "A valid thought position is required." },
          { status: 400 }
        );
      }

      const thought = await env.DB.prepare(
        `SELECT id FROM thoughts WHERE id = ?`
      )
        .bind(thoughtId)
        .first();

      if (!thought) {
        return Response.json(
          { error: "Thought not found." },
          { status: 404 }
        );
      }

      await env.DB.prepare(
        `INSERT INTO thought_positions
         (thought_id, x, y, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(thought_id)
         DO UPDATE SET
           x = excluded.x,
           y = excluded.y,
           updated_at = CURRENT_TIMESTAMP`
      )
        .bind(thoughtId, x, y)
        .run();

      return Response.json({
        success: true,
        thought_id: thoughtId,
        x,
        y
      });
    }

    return env.ASSETS.fetch(request);
  }
};
