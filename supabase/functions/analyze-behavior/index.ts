import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getLanguageInstruction = (language: string): string => {
  const instructions: { [key: string]: string } = {
    en: "Respond in English",
    ja: "日本語で回答してください",
    ko: "한국어로 답변해주세요",
  };
  return instructions[language] || instructions.en;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { language = 'en', childId } = await req.json();

    // Get user's family_id
    const { data: familyMember } = await supabaseClient
      .from("family_members")
      .select("family_id")
      .eq("user_id", user.id)
      .single();

    if (!familyMember) {
      return new Response(JSON.stringify({ error: "No family found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get child name if filtering
    let childName: string | null = null;
    if (childId) {
      const { data: childData } = await supabaseClient
        .from("children")
        .select("name")
        .eq("id", childId)
        .single();
      childName = childData?.name || null;
    }

    // Build query for notes
    let notesQuery = supabaseClient
      .from("notes")
      .select("summary, tags, children, structured_content, date")
      .eq("family_id", familyMember.family_id)
      .order("date", { ascending: false })
      .limit(50); // Analyze last 50 notes

    // Filter by child if specified
    if (childName) {
      notesQuery = notesQuery.contains("children", [childName]);
    }

    const { data: notes } = await notesQuery;

    if (!notes || notes.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No notes found",
          summary: "",
          topHashtags: [],
          encouragement: "",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get unique children from notes
    const allChildren = new Set<string>();
    notes.forEach(note => {
      if (note.children) {
        note.children.forEach((child: string) => allChildren.add(child));
      }
    });

    // Prepare transcript for AI
    const transcript = notes.map(note => {
      return `Date: ${note.date}\nChildren: ${note.children?.join(', ') || 'N/A'}\nSummary: ${note.summary}\nTags: ${note.tags?.join(', ') || 'N/A'}\n`;
    }).join('\n---\n');

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const languageInstruction = getLanguageInstruction(language);
    const childrenList = Array.from(allChildren).join(', ');

    const systemPrompt = `You are an AI assistant helping parents understand their children's behavior patterns. ${languageInstruction}.
Analyze the parent's journal entries and provide insights about each child's behavior trends.`;

    const userPrompt = `Based on these parent journal entries about their children (${childrenList}), analyze the behavior patterns:

${transcript}

Please provide:
1. A brief overall summary of each child's behavior patterns (2-3 sentences per child)
2. The top 3 most common behavioral themes/hashtags that appear across entries
3. One positive, encouraging sentence parents can say to their child to reinforce good behavior

Use the analyze_behavior_patterns function to structure your response.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_behavior_patterns",
              description: "Analyze children's behavior patterns from parent journal entries",
              parameters: {
                type: "object",
                properties: {
                  childSummaries: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        childName: { type: "string" },
                        summary: { type: "string" }
                      },
                      required: ["childName", "summary"]
                    },
                    description: "Summary of each child's behavior patterns"
                  },
                  topHashtags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Top 3 behavioral themes/hashtags"
                  },
                  encouragement: {
                    type: "string",
                    description: "One positive sentence for parents to tell their child"
                  }
                },
                required: ["childSummaries", "topHashtags", "encouragement"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "analyze_behavior_patterns" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI response:", JSON.stringify(aiData, null, 2));

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({
        childSummaries: analysis.childSummaries || [],
        topHashtags: analysis.topHashtags || [],
        encouragement: analysis.encouragement || "",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in analyze-behavior function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});