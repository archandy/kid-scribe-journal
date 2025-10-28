import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1) Read Authorization header
    const authHeader = req.headers.get("Authorization") || "";
    const jwtToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    console.log("Authorization header present:", !!authHeader);
    console.log("JWT token present:", !!jwtToken);

    if (!jwtToken) {
      console.error("Missing/empty Authorization header");
      return new Response(JSON.stringify({ error: "Unauthenticated" }), { status: 401, headers: corsHeaders });
    }

    // 2) Verify user with anon client + explicit token
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await authClient.auth.getUser(jwtToken);

    if (authError || !user) {
      console.error("Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized", details: authError?.message }), { status: 401, headers: corsHeaders });
    }

    console.log("Authenticated user:", user.email);

    // 3) Admin client for DB ops
    const admin = createClient(supabaseUrl, serviceKey);

    // 4) Read body
    let body: any = {};
    try { body = await req.json(); } catch {}
    const token: string | undefined = body?.token;
    if (!token) {
      return new Response(JSON.stringify({ error: "Token is required" }), { status: 400, headers: corsHeaders });
    }

    // 5) Invitation lookup
    const { data: invitation, error: invitationError } = await admin
      .from("family_invitations")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (invitationError || !invitation) {
      console.error("Invitation not found:", invitationError?.message);
      return new Response(JSON.stringify({ error: "Invalid invitation token" }), { status: 404, headers: corsHeaders });
    }

    // 6) State checks
    if (invitation.status === "accepted") {
      return new Response(JSON.stringify({ error: "This invitation has already been accepted" }), { status: 400, headers: corsHeaders });
    }
    if (invitation.status === "cancelled") {
      return new Response(JSON.stringify({ error: "This invitation has been cancelled" }), { status: 400, headers: corsHeaders });
    }
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      await admin.from("family_invitations").update({ status: "expired" }).eq("id", invitation.id);
      return new Response(JSON.stringify({ error: "This invitation has expired" }), { status: 400, headers: corsHeaders });
    }

    // 7) Email match (if enforced)
    if (invitation.email && invitation.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
      return new Response(JSON.stringify({ error: "This invitation was sent to a different email address" }), { status: 403, headers: corsHeaders });
    }

    // 8) Existing membership check
    const { data: existingMembership } = await admin
      .from("family_members")
      .select("id,family_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingMembership) {
      if (existingMembership.family_id === invitation.family_id) {
        await admin.from("family_invitations").update({ status: "accepted" }).eq("id", invitation.id);
        return new Response(JSON.stringify({ error: "You are already a member of this family" }), { status: 400, headers: corsHeaders });
      }
      return new Response(JSON.stringify({ error: "You are already a member of another family. Please leave first." }), { status: 400, headers: corsHeaders });
    }

    // 9) Create membership
    const { error: memberError } = await admin
      .from("family_members")
      .insert({ family_id: invitation.family_id, user_id: user.id, role: "member" });

    if (memberError) {
      console.error("Member insert error:", memberError.message);
      return new Response(JSON.stringify({ error: "Failed to add you to the family" }), { status: 500, headers: corsHeaders });
    }

    // 10) Mark accepted
    await admin.from("family_invitations").update({ status: "accepted" }).eq("id", invitation.id);

    console.log("Invitation accepted:", { user_id: user.id, family_id: invitation.family_id });

    return new Response(JSON.stringify({ success: true, message: "Successfully joined the family!" }), { status: 200, headers: corsHeaders });
  } catch (e: any) {
    console.error("Unhandled error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
