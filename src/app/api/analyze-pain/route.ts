import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export async function POST(request: NextRequest) {
  try {
    const { painPoints, userId, bodyView } = await request.json();

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
      intensity: point.intensity,
      timestamp: point.timestamp
    }));

    // Create the analysis prompt
    const systemPrompt = `You are a medical AI assistant specializing in pain pattern analysis. Analyze the provided pain data and generate a professional, refined medical assessment.

Your analysis should be:
- Professional and clinically appropriate
- Focused on the main pain points and their characteristics
- Clear about pain severity and type
- Provide broad but helpful possible conditions
- Include practical recommendations

Be thorough but concise. Use medical terminology appropriately. Consider both acute and chronic pain patterns.`;

    const userPrompt = `Please analyze this pain data and provide a professional medical assessment:

Body View: ${bodyView}
Pain Points: ${JSON.stringify(painData, null, 2)}

Provide a structured analysis focusing on:

1. **Main Pain Points**: Identify the primary areas of pain and their characteristics
2. **Severity Assessment**: Evaluate overall pain severity (mild/moderate/severe) based on intensity and distribution
3. **Pain Type Analysis**: Describe the types of pain present (sharp, dull, burning, throbbing, etc.) and what they may indicate
4. **Possible Conditions**: Provide broad possible conditions based on pain patterns (acknowledge limitations of pain-only assessment)
5. **Recommendations**: Suggest appropriate next steps for evaluation or management

Format your response as a JSON object with these exact keys:
{
  "severity": "mild|moderate|severe",
  "mainPainPoints": "Professional description of primary pain areas and characteristics",
  "painTypeAnalysis": "Analysis of pain types and their clinical significance",
  "possibleConditions": ["broad condition 1", "broad condition 2", ...],
  "recommendations": ["recommendation 1", "recommendation 2", ...],
  "clinicalNotes": "Additional professional observations and context"
}`;

    // Get AI analysis
    const response = await openai.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ]);

    // Try to parse the JSON response
    let analysis;
    try {
      analysis = JSON.parse(response.content as string);
    } catch (parseError) {
      // If JSON parsing fails, create a structured response from the text
      analysis = {
        severity: 'moderate',
        mainPainPoints: 'Pain pattern analysis required',
        painTypeAnalysis: 'Unable to analyze pain types from current data',
        possibleConditions: ['Further evaluation needed'],
        recommendations: ['Consult with healthcare provider for detailed assessment'],
        clinicalNotes: response.content
      };
    }

    return NextResponse.json(analysis);

  } catch (error) {
    console.error('Error analyzing pain:', error);
    
    // Fallback analysis if AI fails
    const fallbackAnalysis = {
      severity: 'moderate',
      mainPainPoints: 'Pain assessment unavailable - AI analysis failed',
      painTypeAnalysis: 'Unable to determine pain characteristics',
      possibleConditions: ['Clinical evaluation required'],
      recommendations: ['Manual clinical assessment recommended'],
      clinicalNotes: 'AI analysis temporarily unavailable. Please consult with a healthcare provider for proper assessment.'
    };

    return NextResponse.json(fallbackAnalysis);
  }
}
