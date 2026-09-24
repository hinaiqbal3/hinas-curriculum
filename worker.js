export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // For now, we're just testing that our Worker is alive.
    if (url.pathname === "/api/test") {
      return Response.json({
        message: "Hina's Curriculum is connected."
      });
    }

    // Everything else — including your homepage —
    // continues to come from the existing website.
    return env.ASSETS.fetch(request);
  }
};
