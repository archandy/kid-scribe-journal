import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getLanguageInstruction = (language: string) => {
  const instructions: Record<string, string> = {
    'en': 'Generate a concise summary in English.',
    'ja': '日本語で簡潔な要約を生成してください。',
    'ko': '한국어로 간결한 요약을 생성하세요.'
  };
  return instructions[language] || instructions['en'];
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, language = 'en' } = await req.json();

    if (!transcript) {
      throw new Error('Transcript is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating summary for transcript...');
    console.log('Language:', language);

    const languageInstruction = getLanguageInstruction(language);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that analyzes parent journal entries about their children. ${languageInstruction} Identify key behavioral patterns and developmental milestones. Create relevant hashtags for categorization and trend analysis.`
          },
          {
            role: 'user',
            content: `Analyze this journal entry and provide a summary with behavioral hashtags:\n\n${transcript}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'analyze_journal_entry',
              description: 'Analyze a parent journal entry about their child and return a summary with behavioral hashtags',
              parameters: {
                type: 'object',
                properties: {
                  summary: {
                    type: 'string',
                    description: 'A concise summary of the journal entry focusing on key insights'
                  },
                  tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Behavioral hashtags (3-5 tags) categorizing the child\'s behavior, development, or activity. Examples: creativity, curiosity, motor-skills, language-development, social-skills, problem-solving, emotional-regulation'
                  }
                },
                required: ['summary', 'tags'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'analyze_journal_entry' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('Failed to generate summary');
    }

    const data = await response.json();
    
    // Extract structured output from tool call
    const toolCall = data.choices[0].message.tool_calls?.[0];
    if (!toolCall || !toolCall.function.arguments) {
      throw new Error('Failed to get structured response from AI');
    }
    
    const analysis = JSON.parse(toolCall.function.arguments);
    const { summary, tags } = analysis;

    console.log('Summary and tags generated successfully');
    console.log('Tags:', tags);

    return new Response(
      JSON.stringify({ summary, tags }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-summary function:', error);
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
