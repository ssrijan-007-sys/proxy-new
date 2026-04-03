/// <reference lib="deno.ns" />
// @ts-nocheck


const DELHIVERY_API_KEY = Deno.env.get("DELHIVERY_API_KEY");

if (!DELHIVERY_API_KEY) {
  console.error("❌ DELHIVERY_API_KEY not found");
}

/* ==============================
   CORS HEADERS
============================== */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* ==============================
   SERVER
============================== */
Deno.serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const method = req.method;

  /* ==============================
     HEALTH CHECK
  ============================== */
  if (url.pathname === "/" && method === "GET") {
    return new Response("ShreeJee Delhivery Proxy Running ✅", {
      headers: corsHeaders,
    });
  }

  /* ==============================
     FETCH WAYBILLS
  ============================== */
  if (url.pathname === "/fetch-waybills" && method === "POST") {
    try {
      const { count } = await req.json();

      const response = await fetch(
        `https://track.delhivery.com/waybill/api/bulk/json/?count=${count}`,
        {
          headers: {
            Authorization: `Token ${DELHIVERY_API_KEY}`,
          },
        }
      );

      const text = await response.text();

      const waybills = text
        .replace(/"/g, "")
        .split(",")
        .map(wb => wb.trim())
        .filter(Boolean);

      return Response.json(
        { waybills, count: waybills.length },
        { headers: corsHeaders }
      );
    } catch (err) {
      return Response.json(
        { error: "Waybill fetch failed", details: err.message },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  /* ==============================
     CREATE ORDER / MANIFEST
  ============================== */
  if (url.pathname === "/create-order" && method === "POST") {
    try {
      const body = await req.json();

      const formBody =
        "format=json&data=" +
        encodeURIComponent(JSON.stringify(body));

      const response = await fetch(
        "https://track.delhivery.com/api/cmu/create.json",
        {
          method: "POST",
          headers: {
            Authorization: `Token ${DELHIVERY_API_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: formBody,
        }
      );

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
      console.log("Create Order Response:", data);
      return Response.json(data, { headers: corsHeaders });
    } catch (err) {
      return Response.json(
        { error: "Create Order Failed", details: err.message },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  /* ==============================
     PINCODE SERVICEABILITY
  ============================== */
  if (url.pathname === "/serviceability" && method === "GET") {
    try {
      const pin = url.searchParams.get("pin");
      if (!pin) {
        return Response.json(
          { error: "pin is required" },
          { status: 400, headers: corsHeaders }
        );
      }

      const response = await fetch(
        `https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=${pin}`,
        {
          headers: {
            Authorization: `Token ${DELHIVERY_API_KEY}`,
          },
        }
      );

      const data = await response.json();
      return Response.json(data, { headers: corsHeaders });
    } catch (err) {
      return Response.json(
        { error: "Serviceability check failed", details: err.message },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  /* ==============================
     TRACK SHIPMENTS (SINGLE / BULK)
  ============================== */
  if (url.pathname === "/track" && method === "GET") {
    try {
      const waybills = url.searchParams.get("waybills");

      if (!waybills) {
        return Response.json(
          { error: "waybills query param required" },
          { status: 400, headers: corsHeaders }
        );
      }

      const response = await fetch(
        `https://track.delhivery.com/api/v1/packages/json/?waybill=${waybills}`,
        {
          headers: {
            Authorization: `Token ${DELHIVERY_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();
      return Response.json(data, { headers: corsHeaders });
    } catch (err) {
      return Response.json(
        { error: "Tracking failed", details: err.message },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  /* ==============================
     EDIT SHIPMENT
  ============================== */
  if (url.pathname === "/update-shipment" && method === "POST") {
    try {
      const body = await req.json();

      const response = await fetch(
        "https://track.delhivery.com/api/p/edit",
        {
          method: "POST",
          headers: {
            Authorization: `Token ${DELHIVERY_API_KEY}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();
      return Response.json(data, { headers: corsHeaders });
    } catch (err) {
      return Response.json(
        { error: "Shipment update failed", details: err.message },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  /* ==============================
     CANCEL SHIPMENT
  ============================== */
  if (url.pathname === "/cancel-shipment" && method === "POST") {
    try {
      const { waybill } = await req.json();

      const response = await fetch(
        "https://track.delhivery.com/api/p/edit",
        {
          method: "POST",
          headers: {
            Authorization: `Token ${DELHIVERY_API_KEY}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            waybill,
            cancellation: true,
          }),
        }
      );

      const data = await response.json();
      return Response.json(data, { headers: corsHeaders });
    } catch (err) {
      return Response.json(
        { error: "Cancel shipment failed", details: err.message },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  return new Response("Not Found", { status: 404, headers: corsHeaders });
});
