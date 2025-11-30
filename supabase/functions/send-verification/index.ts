// Send Verification Email - StarTrade
// Generates and sends a 5-character verification code via email
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate verification code using our database function
    const { data: codeResult, error: codeError } = await supabase
      .rpc('create_verification_code', { email_param: email });

    if (codeError) {
      console.error('Error generating code:', codeError);
      throw new Error('Failed to generate verification code');
    }

    const verificationCode = codeResult;

    // Send email via Resend
    if (!resendApiKey) {
      // If no Resend key, log the code for development
      console.log(`[DEV] Verification code for ${email}: ${verificationCode}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Verification code sent (dev mode)',
          // Only include code in development!
          devCode: verificationCode 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send real email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'StarTrade <onboarding@resend.dev>', // Resend's test domain
        to: [email],
        subject: `Your StarTrade Verification Code: ${verificationCode}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="100%" max-width="480px" cellpadding="0" cellspacing="0" style="background-color: #1a1a24; border-radius: 16px; padding: 40px;">
                    <tr>
                      <td align="center" style="padding-bottom: 24px;">
                        <span style="font-size: 48px;">⭐</span>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding-bottom: 8px;">
                        <h1 style="color: #ffffff; font-size: 24px; margin: 0;">StarTrade</h1>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding-bottom: 32px;">
                        <p style="color: #9ca3af; font-size: 16px; margin: 0;">Verify your email to get started</p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding-bottom: 16px;">
                        <p style="color: #9ca3af; font-size: 14px; margin: 0;">Your verification code is:</p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding-bottom: 32px;">
                        <div style="background-color: #2a2a3a; border-radius: 12px; padding: 20px 40px; display: inline-block;">
                          <span style="color: #8b5cf6; font-size: 36px; font-weight: bold; letter-spacing: 8px; font-family: monospace;">${verificationCode}</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding-bottom: 24px;">
                        <p style="color: #6b7280; font-size: 14px; margin: 0;">
                          This code expires in <strong style="color: #9ca3af;">10 minutes</strong>
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center">
                        <p style="color: #4b5563; font-size: 12px; margin: 0;">
                          If you didn't request this code, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
        text: `Your StarTrade verification code is: ${verificationCode}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this code, you can safely ignore this email.`,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('Resend error:', errorData);
      throw new Error('Failed to send verification email');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Verification code sent to your email' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send verification email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
