import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export async function POST(request: NextRequest) {
  try {
    const { painPoints, userId, bodyView } = await request.json();

    // Console log the raw data being sent to the LLM
    console.log('=== PAIN ANALYSIS REQUEST ===');
    console.log('Raw request data:', { painPoints, userId, bodyView });
    console.log('Pain points count:', painPoints?.length || 0);
    console.log('Body view:', bodyView);
    console.log('User ID:', userId);

    if (!painPoints || !Array.isArray(painPoints)) {
      return NextResponse.json(
        { error: 'Pain points array is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get user's OpenAI API key from Firestore using Admin SDK
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const openaiApiKey = userDoc.exists 
      ? userDoc.data()?.openaiApiKey 
      : process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 400 }
      );
    }

    // Create OpenAI client directly
    const openai = new ChatOpenAI({
      apiKey: openaiApiKey,
      model: 'gpt-4o-mini',
      temperature: 0.7,
    });

    // Prepare pain data for analysis
    const painData = painPoints.map(point => ({
      bodyPart: point.bodyPart,
      painType: point.type,
      intensity: point.intensity
    }));

    // Console log the processed pain data
    console.log('=== PROCESSED PAIN DATA ===');
    console.log('Processed pain data:', JSON.stringify(painData, null, 2));

    // Create the analysis prompt
    const systemPrompt = `You are a medical AI assistant specializing in pain pattern analysis. Analyze the provided pain data and generate a professional, structured medical assessment in markdown format.

Your analysis should be:
- Professional and clinically appropriate
- Focused on the main pain points and their characteristics
- Clear about pain severity and type
- Provide broad but helpful possible conditions
- Include practical recommendations
- Use proper markdown formatting with ## headers, bullet points, and other markdown elements

Be thorough but concise. Use medical terminology appropriately. Consider both acute and chronic pain patterns. Format your response in clean, readable markdown.`;

    const userPrompt = `Please analyze this pain data and provide a professional medical assessment in markdown format:

Body View: ${bodyView}
Pain Points: ${JSON.stringify(painData, null, 2)}

Provide a structured markdown analysis covering:

## Severity Assessment
- Overall pain severity (mild/moderate/severe) based on intensity and distribution

## Main Pain Points
- Primary areas of pain and their characteristics

## Pain Type Analysis
- Types of pain present (sharp, dull, burning, throbbing, etc.) and their clinical significance

## Possible Conditions
- Broad possible conditions based on pain patterns (acknowledge limitations of pain-only assessment)

## Recommendations
- Appropriate next steps for evaluation or management

## Clinical Notes
- Additional professional observations and context

Use proper markdown formatting with ## headers, bullet points, and any other markdown elements that would enhance readability. Avoid emojis and keep it professional.`;

    // Console log the prompts being sent to the LLM
    console.log('=== PROMPTS SENT TO LLM ===');
    console.log('System Prompt:', systemPrompt);
    console.log('User Prompt:', userPrompt);
    console.log('Model:', 'gpt-4o-mini');
    console.log('Temperature:', 0.7);

    // Get AI analysis
    const response = await openai.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ]);

    // Console log the LLM response
    console.log('=== LLM RESPONSE ===');
    console.log('Raw LLM response:', response.content);
    console.log('Response type:', typeof response.content);

    // Return the structured text response directly
    const analysis = {
      content: response.content as string
    };

    // Console log the final response being sent back
    console.log('=== FINAL RESPONSE ===');
    console.log('Final analysis being sent:', analysis);
    console.log('=== END PAIN ANALYSIS REQUEST ===\n');

    return NextResponse.json(analysis);

  } catch (error) {
    console.error('Error analyzing pain:', error);
    
    // Fallback analysis if AI fails
    const fallbackAnalysis = {
      content: `## Severity Assessment
- Moderate pain severity based on available data

## Main Pain Points
- AI analysis temporarily unavailable

## Pain Type Analysis
- Unable to determine pain characteristics at this time

## Possible Conditions
- Further evaluation recommended

## Recommendations
- Retry analysis or seek professional medical assessment

## Clinical Notes
- AI analysis temporarily unavailable. Please try again or consult with a healthcare provider for proper assessment.`
    };

    return NextResponse.json(fallbackAnalysis);
  }
}
