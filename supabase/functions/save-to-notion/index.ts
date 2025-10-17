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

    // database_id is now optional - if not provided, create page in workspace root
    const parentPageId = tokenData.database_id;

    // Get note data from request
    const { structuredContent, summary, children, duration } = await req.json();

    if (!structuredContent) {
      throw new Error('Structured content is required');
    }

    // Create title from date and children
    const date = new Date();
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const childStr = children && children.length > 0 ? ` - ${children.join(', ')}` : '';
    const title = `${dateStr}${childStr}`;

    console.log('Creating Notion page with title:', title);

    // Build page content blocks
    const contentBlocks = [];

    // Add structured content
    contentBlocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: '📝 What happened:' } }],
      },
    });

    contentBlocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: structuredContent.whatHappened } }],
      },
    });

    contentBlocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: '👶 How they behaved:' } }],
      },
    });

    contentBlocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: structuredContent.howTheyBehaved } }],
      },
    });

    contentBlocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: '💡 What that shows:' } }],
      },
    });

    contentBlocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: structuredContent.whatThatShows } }],
      },
    });

    // Add summary if available
    if (summary) {
      contentBlocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: '✨ Summary:' } }],
        },
      });

      contentBlocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: summary } }],
        },
      });
    }

    // Determine parent
    let parent;
    if (parentPageId) {
      // Format page ID if provided
      let formattedPageId = parentPageId.replace(/-/g, '');
      if (formattedPageId.length === 32) {
        formattedPageId = `${formattedPageId.slice(0, 8)}-${formattedPageId.slice(8, 12)}-${formattedPageId.slice(12, 16)}-${formattedPageId.slice(16, 20)}-${formattedPageId.slice(20)}`;
      }
      parent = { page_id: formattedPageId };
    } else {
      // Create in workspace root
      parent = { type: 'workspace', workspace: true };
    }

    // Create Notion page
    const notionResponse = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent,
        properties: {
          title: {
            title: [{ text: { content: title } }],
          },
        },
        children: contentBlocks,
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