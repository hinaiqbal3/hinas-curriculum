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
      const parts = url.pathname.split("/");
      const thoughtId = parts[3];

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
        `INSERT INTO thought_entries (thought_id, content)
         VALUES (?, ?)`
      )
        .bind(thoughtId, content)
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
         SET content = ?
         WHERE id = ?`
      )
        .bind(content, id)
        .run();

      const entry = await env.DB.prepare(
        `SELECT * FROM thought_entries WHERE id = ?`
      )
        .bind(id)
        .first();

      return Response.json(entry);
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

    return env.ASSETS.fetch(request);
  }
};
