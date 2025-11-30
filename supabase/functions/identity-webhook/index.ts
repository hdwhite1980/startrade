// Supabase Edge Function: Handle Stripe Identity Verification Webhooks
// Processes verification results and updates user status

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.5.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
    
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the signature from headers
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("No Stripe signature found");
    }

    // Get raw body
    const body = await req.text();
    
    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Received Stripe event:", event.type);

    // Handle identity verification events
    if (event.type === "identity.verification_session.verified" ||
        event.type === "identity.verification_session.requires_input" ||
        event.type === "identity.verification_session.canceled") {
      
      const session = event.data.object as Stripe.Identity.VerificationSession;
      const userId = session.metadata?.user_id;
      
      if (!userId) {
        console.error("No user_id in session metadata");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      let identityStatus: string;
      let dob: string | null = null;
      let firstName: string | null = null;
      let lastName: string | null = null;
      let country: string | null = null;

      switch (event.type) {
        case "identity.verification_session.verified":
          identityStatus = "VERIFIED";
          
          // Extract verified data
          if (session.verified_outputs) {
            // DOB
            if (session.verified_outputs.dob) {
              const { year, month, day } = session.verified_outputs.dob;
              if (year && month && day) {
                dob = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              }
            }
            
            // Name
            if (session.verified_outputs.first_name) {
              firstName = session.verified_outputs.first_name;
            }
            if (session.verified_outputs.last_name) {
              lastName = session.verified_outputs.last_name;
            }
            
            // ID country
            if (session.verified_outputs.id_number_type) {
              // Country is in the document
            }
          }
          
          // Get document country from last_verification_report if available
          if (session.last_verification_report) {
            try {
              const report = await stripe.identity.verificationReports.retrieve(
                session.last_verification_report as string
              );
              if (report.document?.issuing_country) {
                country = report.document.issuing_country;
              }
            } catch (e) {
              console.error("Error fetching verification report:", e);
            }
          }
          break;
          
        case "identity.verification_session.requires_input":
          identityStatus = "REQUIRES_INPUT";
          break;
          
        case "identity.verification_session.canceled":
          identityStatus = "REJECTED";
          break;
          
        default:
          identityStatus = "PENDING";
      }

      // Calculate if user is 21+
      let is21Plus = false;
      if (dob) {
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        is21Plus = age >= 21;
      }

      // Update user profile
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          identity_status: identityStatus,
          date_of_birth: dob,
          legal_first_name: firstName,
          legal_last_name: lastName,
          id_country: country,
          is_21_plus: is21Plus,
          identity_verified_at: identityStatus === "VERIFIED" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) {
        console.error("Error updating user profile:", updateError);
        throw updateError;
      }

      console.log(`Updated user ${userId}: status=${identityStatus}, is_21_plus=${is21Plus}, dob=${dob}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
