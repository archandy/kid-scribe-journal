import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getSystemPrompt = (language: string, childName: string) => {
  const languageInstruction = language === 'ja' 
    ? 'すべての回答は日本語で行ってください。'
    : language === 'ko'
    ? '모든 답변은 한국어로 해주세요.'
    : 'Respond in English.';

  return `You are a child development specialist who analyzes children's drawings.
${languageInstruction}

Analyze this child's drawing for ${childName} and provide a gentle, parent-friendly report.
Focus on what the artwork may express about the child's current emotional state, personality traits, developmental indicators, and creativity.

Provide insights in the following JSON structure:
{
  "emotional_indicators": {
    "analysis": "Your analysis of colors, line strength, shapes, expressions, space usage",
    "tones": ["confidence", "joy", "curiosity"] 
  },
  "personality_traits": {
    "analysis": "Signs of introversion/extroversion, confidence level, attention to detail, energy level, or imagination",
    "traits": ["creative", "detail-oriented", "expressive"]
  },
  "developmental_indicators": {
    "analysis": "Assessment of drawing structure, human figure development, spatial arrangement, complexity, color understanding, or fine motor signs",
    "level": "age-appropriate or advanced or developing"
  },
  "creativity_imagination": {
    "analysis": "Originality, storytelling elements, recurring motifs, pattern creation, character design, or unique combinations",
    "highlights": ["unique color choices", "imaginative characters"]
  },
  "summary": "A short encouraging summary (2-3 sentences) about what the artwork suggests about the child's growth"
}

Keep the tone supportive, positive, and non-diagnostic.
Do not give medical or psychological judgments.
Provide gentle interpretations only.
Return ONLY valid JSON, no markdown or extra text.`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, childName, language = 'en' } = await req.json();

    if (!imageUrl || !childName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: imageUrl, childName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log(`Analyzing drawing for ${childName} in ${language}`);

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
            content: getSystemPrompt(language, childName)
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please analyze this drawing by ${childName}.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse the JSON response
    let analysis;
    try {
      // Remove any markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse analysis response');
    }

    console.log('Analysis complete for', childName);

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-drawing:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to analyze drawing';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
