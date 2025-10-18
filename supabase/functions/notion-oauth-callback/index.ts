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
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code) {
      throw new Error('No authorization code provided');
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${Deno.env.get('NOTION_CLIENT_ID')}:${Deno.env.get('NOTION_CLIENT_SECRET')}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/notion-oauth-callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      throw new Error(`Failed to exchange code for token: ${error}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Token exchange successful');

    // Validate state token (CSRF protection)
    if (!state) {
      throw new Error('No state token provided');
    }

    // Create Supabase client with service role to validate state token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate and retrieve state token from database
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select('user_id, expires_at')
      .eq('state_token', state)
      .single();

    if (stateError || !stateData) {
      console.error('Invalid state token:', stateError);
      throw new Error('Invalid or expired state token');
    }

    // Check if token has expired
    if (new Date(stateData.expires_at) < new Date()) {
      console.error('State token expired');
      throw new Error('State token has expired');
    }

    const userId = stateData.user_id;
    console.log('State token validated successfully');

    // Delete the used state token (one-time use)
    await supabase
      .from('oauth_states')
      .delete()
      .eq('state_token', state);

    console.log('Used state token deleted');

    // Store token in database
    const { error: insertError } = await supabase
      .from('notion_tokens')
      .upsert({
        user_id: userId,
        access_token: tokenData.access_token,
        workspace_id: tokenData.workspace_id,
        workspace_name: tokenData.workspace_name,
      }, {
        onConflict: 'user_id'
      });

    if (insertError) {
      console.error('Failed to store token:', insertError);
      throw insertError;
    }

    console.log('Token stored successfully');

    // Check if this is a mobile redirect flow (no opener window)
    const isMobileFlow = !!state;
    
    if (isMobileFlow) {
      // Mobile flow - redirect back to settings
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Notion Connected</title>
            <meta http-equiv="refresh" content="2;url=/settings">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
              }
              .container {
                text-align: center;
              }
              h1 { margin: 0 0 16px; }
              p { opacity: 0.9; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>✓ Connected to Notion</h1>
              <p>Redirecting back to settings...</p>
            </div>
          </body>
        </html>
        `,
        {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        }
      );
    }

    // Desktop popup flow
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Notion Connected</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
            }
            h1 { margin: 0 0 16px; }
            p { opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✓ Connected to Notion</h1>
            <p>You can close this window</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'NOTION_AUTH_SUCCESS' }, '*');
              setTimeout(() => window.close(), 2000);
            }
          </script>
        </body>
      </html>
      `,
      {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      }
    );
  } catch (error) {
    console.error('Error in notion-oauth-callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              color: white;
            }
            .container {
              text-align: center;
            }
            h1 { margin: 0 0 16px; }
            p { opacity: 0.9; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✗ Connection Failed</h1>
            <p>${errorMessage}</p>
            <p>You can close this window</p>
          </div>
        </body>
      </html>
      `,
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      }
    );
  }
});