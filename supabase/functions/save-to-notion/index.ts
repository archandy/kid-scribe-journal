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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's Notion token
    const { data: tokenData, error: tokenError } = await supabase
      .from('notion_tokens')
      .select('access_token, database_id')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('No Notion connection found. Please connect to Notion first.');
    }

    if (!tokenData.database_id) {
      throw new Error('No database ID configured. Please set your database ID in Settings.');
    }

    // Get note data from request
    const { transcript, audioUrl, children, tags, sentiment, duration, location } = await req.json();

    if (!transcript) {
      throw new Error('Transcript is required');
    }

    // Extract title from transcript (first 60 chars)
    const title = transcript.substring(0, 60) + (transcript.length > 60 ? '...' : '');

    // Format database ID correctly (Notion expects UUID format with hyphens)
    let formattedDatabaseId = tokenData.database_id.replace(/-/g, ''); // Remove any existing hyphens first
    
    // Add hyphens in UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    if (formattedDatabaseId.length === 32) {
      formattedDatabaseId = `${formattedDatabaseId.slice(0, 8)}-${formattedDatabaseId.slice(8, 12)}-${formattedDatabaseId.slice(12, 16)}-${formattedDatabaseId.slice(16, 20)}-${formattedDatabaseId.slice(20)}`;
    }
    
    console.log('Using database ID:', formattedDatabaseId);
    console.log('Access token length:', tokenData.access_token.length);

    // Test: Try to retrieve the database to verify access
    console.log('Testing database access...');
    const testResponse = await fetch(`https://api.notion.com/v1/databases/${formattedDatabaseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Notion-Version': '2022-06-28',
      },
    });

    if (!testResponse.ok) {
      const testError = await testResponse.text();
      console.error('Database access test failed:', testResponse.status, testError);
      throw new Error(`Cannot access database. Please ensure: 1) The database ID is correct, 2) Your Notion integration has been added to this database via "..." → "Connections". Error: ${testError}`);
    }

    console.log('Database access verified successfully');

    // Create Notion page
    const notionResponse = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: formattedDatabaseId },
        properties: {
          'Title': {
            title: [{ text: { content: title } }],
          },
          'Date': {
            date: { start: new Date().toISOString() },
          },
          'Transcript': {
            rich_text: [{ text: { content: transcript } }],
          },
          ...(audioUrl && {
            'Audio URL': {
              url: audioUrl,
            },
          }),
          ...(children && children.length > 0 && {
            'Children': {
              multi_select: children.map((c: string) => ({ name: c })),
            },
          }),
          ...(tags && tags.length > 0 && {
            'Tags': {
              multi_select: tags.map((t: string) => ({ name: t })),
            },
          }),
          ...(sentiment && {
            'Sentiment': {
              select: { name: sentiment },
            },
          }),
          ...(duration && {
            'Duration (s)': {
              number: Math.round(duration),
            },
          }),
          ...(location && {
            'Location': {
              rich_text: [{ text: { content: location } }],
            },
          }),
          'Source': {
            select: { name: 'mobile PWA' },
          },
        },
      }),
    });

    if (!notionResponse.ok) {
      const error = await notionResponse.text();
      console.error('Notion API error:', error);
      throw new Error(`Failed to create Notion page: ${error}`);
    }

    const notionPage = await notionResponse.json();
    console.log('Successfully created Notion page:', notionPage.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        pageId: notionPage.id,
        url: notionPage.url,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in save-to-notion:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});