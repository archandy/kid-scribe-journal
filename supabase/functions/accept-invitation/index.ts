import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwtToken = authHeader.replace('Bearer ', '');
    
    // Create client for authentication check with the JWT token
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Get the authenticated user using the JWT token
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Authenticated user:', user.email);

    // Create admin client for database operations (using service role key)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { token } = await req.json();

    if (!token || typeof token !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get invitation
    const { data: invitation, error: invitationError } = await supabaseClient
      .from('family_invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (invitationError || !invitation) {
      console.error('Invitation not found:', invitationError);
      return new Response(
        JSON.stringify({ error: 'Invalid invitation token' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if invitation is already accepted
    if (invitation.status === 'accepted') {
      return new Response(
        JSON.stringify({ error: 'This invitation has already been accepted' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if invitation is expired
    if (invitation.status === 'expired' || new Date(invitation.expires_at) < new Date()) {
      await supabaseClient
        .from('family_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      return new Response(
        JSON.stringify({ error: 'This invitation has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if invitation is cancelled
    if (invitation.status === 'cancelled') {
      return new Response(
        JSON.stringify({ error: 'This invitation has been cancelled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if email matches
    if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'This invitation was sent to a different email address' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is already in a family
    const { data: existingMembership } = await supabaseClient
      .from('family_members')
      .select('id, family_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingMembership) {
      // Check if it's the same family
      if (existingMembership.family_id === invitation.family_id) {
        // Already a member, mark invitation as accepted
        await supabaseClient
          .from('family_invitations')
          .update({ status: 'accepted' })
          .eq('id', invitation.id);

        return new Response(
          JSON.stringify({ error: 'You are already a member of this family' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ 
            error: 'You are already a member of another family. Please leave your current family first.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Add user to family
    const { error: memberError } = await supabaseClient
      .from('family_members')
      .insert({
        family_id: invitation.family_id,
        user_id: user.id,
        role: 'member',
      });

    if (memberError) {
      console.error('Member error:', memberError);
      return new Response(
        JSON.stringify({ error: 'Failed to add you to the family' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark invitation as accepted
    const { error: updateError } = await supabaseClient
      .from('family_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('Update error:', updateError);
    }

    console.log('Invitation accepted:', { user_id: user.id, family_id: invitation.family_id });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Successfully joined the family!'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});