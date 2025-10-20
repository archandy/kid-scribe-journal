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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
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

    // Get user's family
    const { data: familyMember, error: familyError } = await supabaseClient
      .from('family_members')
      .select('family_id, role')
      .eq('user_id', user.id)
      .single();

    if (familyError || !familyMember) {
      console.error('Family error:', familyError);
      return new Response(
        JSON.stringify({ error: 'No family found for user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has permission (owner or admin)
    if (!['owner', 'admin'].includes(familyMember.role)) {
      return new Response(
        JSON.stringify({ error: 'Only family owners or admins can send invitations' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is trying to invite themselves
    if (email.toLowerCase() === user.email?.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'You cannot invite yourself' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is already in the family
    const { data: existingMember } = await supabaseClient
      .from('family_members')
      .select('id')
      .eq('family_id', familyMember.family_id)
      .eq('user_id', (await supabaseClient
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle())?.data?.id || '')
      .maybeSingle();

    if (existingMember) {
      return new Response(
        JSON.stringify({ error: 'User is already a member of this family' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing pending invitation
    const { data: existingInvitation } = await supabaseClient
      .from('family_invitations')
      .select('id, status')
      .eq('family_id', familyMember.family_id)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvitation) {
      return new Response(
        JSON.stringify({ error: 'An invitation has already been sent to this email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate invitation token
    const token = crypto.randomUUID();

    // Create invitation
    const { data: invitation, error: invitationError } = await supabaseClient
      .from('family_invitations')
      .insert({
        family_id: familyMember.family_id,
        invited_by: user.id,
        email: email,
        token: token,
        status: 'pending',
      })
      .select()
      .single();

    if (invitationError) {
      console.error('Invitation error:', invitationError);
      return new Response(
        JSON.stringify({ error: 'Failed to create invitation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate invitation link
    const invitationLink = `${req.headers.get('origin')}/accept-invitation?token=${token}`;

    console.log('Invitation created:', { email, token, invitationLink });

    return new Response(
      JSON.stringify({ 
        success: true, 
        invitation,
        invitationLink 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});