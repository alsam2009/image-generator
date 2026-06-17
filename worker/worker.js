export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    // Auth check
    const auth = request.headers.get("Authorization");
    const expectedKey = env.API_KEY || "";

    if (!auth || auth !== "Bearer " + expectedKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", debug: "Expected: Bearer " + expectedKey + " Got: " + auth }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const body = await request.json();
      const { prompt, model = "@cf/stabilityai/stable-diffusion-xl-base-1.0", width = 1024, height = 1024 } = body;

      if (!prompt || prompt.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: "Prompt is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Clamp dimensions: min 256, max 2048, must be multiple of 64
      const clamp = (v) => Math.min(2048, Math.max(256, Math.round(v / 64) * 64));

      const payload = {
        prompt: prompt.trim(),
        width: clamp(width),
        height: clamp(height),
      };

      console.log("Generating:", model, payload.width, "x", payload.height);

      const result = await env.Ai.run(model, payload);

      return new Response(result, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "image/png",
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
      console.error("Worker error:", err);
      return new Response(
        JSON.stringify({ error: err.message || "Generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  },
};
