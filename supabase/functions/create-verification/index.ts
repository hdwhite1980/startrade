// Supabase Edge Function: Create Stripe Identity Verification Session
// Users must verify their identity to bet with real USDC

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.5.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user already has a pending or verified session
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("identity_status, stripe_verification_session_id")
      .eq("id", user.id)
      .single();

    if (profile?.identity_status === "VERIFIED") {
      return new Response(
        JSON.stringify({ 
          error: "Already verified",
          status: "VERIFIED"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get return URL from request body
    const { returnUrl } = await req.json().catch(() => ({}));
    const baseReturnUrl = returnUrl || "startrade://verify-callback";

    // Create Stripe Identity Verification Session
    const verificationSession = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: {
        user_id: user.id,
        email: user.email || "",
      },
      options: {
        document: {
          // Require document with DOB
          require_id_number: false,
          require_live_capture: true,
          require_matching_selfie: true,
          allowed_types: ["driving_license", "passport", "id_card"],
        },
      },
      return_url: `${baseReturnUrl}?session_id={CHECKOUT_SESSION_ID}`,
    });

    // Update user profile with pending session
    await supabase
      .from("user_profiles")
      .update({
        identity_status: "PENDING",
        stripe_verification_session_id: verificationSession.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    // Return the verification URL
    return new Response(
      JSON.stringify({
        verificationUrl: verificationSession.url,
        sessionId: verificationSession.id,
        status: "PENDING",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error creating verification session:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
