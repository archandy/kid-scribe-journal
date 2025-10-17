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

    // Clean database ID (remove hyphens if present)
    const cleanDatabaseId = tokenData.database_id.replace(/-/g, '');
    console.log('Using database ID:', cleanDatabaseId);
    console.log('Access token length:', tokenData.access_token.length);

    // Create Notion page
    const notionResponse = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: cleanDatabaseId },
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