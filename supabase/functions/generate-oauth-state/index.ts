import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Generating OAuth state token');

    // Get authenticated user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate cryptographically secure random state token
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const stateToken = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    console.log('Generated secure state token');

    // Clean up old expired tokens for this user
    await supabaseClient
      .from('oauth_states')
      .delete()
      .eq('user_id', user.id)
      .lt('expires_at', new Date().toISOString());

    // Store state token in database
    const { error: insertError } = await supabaseClient
      .from('oauth_states')
      .insert({
        user_id: user.id,
        state_token: stateToken,
      });

    if (insertError) {
      console.error('Failed to store state token:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate state token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('State token stored successfully');

    return new Response(
      JSON.stringify({ state_token: stateToken }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating oauth state:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
