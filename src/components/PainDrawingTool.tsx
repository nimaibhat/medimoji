'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  RotateCcw, 
  Palette, 
  Zap, 
  Circle, 
  Square, 
  Minus,
  Download,
  Send,
  AlertTriangle,
  Heart,
  Brain,
  Bone,
  RotateCw,
  Loader2
} from 'lucide-react';
import ThreeDBodyDiagram from './ThreeDBodyDiagram';
import { useAuth } from '@/contexts/AuthContext';

interface PainPoint {
  id: string;
  position: [number, number, number];
  intensity: number; // 1-10
  type: 'sharp' | 'dull' | 'burning' | 'throbbing' | 'numbness' | 'tingling';
  size: number;
  timestamp: Date;
  bodyView: 'front' | 'back';
  bodyPart?: string; // Add body part detection
}

interface PainDrawingToolProps {
  isOpen: boolean;
  onClose: () => void;
  onSendPainReport?: (report: PainReport) => void;
}

interface PainReport {
  painPoints: PainPoint[];
  bodyView: 'front' | 'back';
  timestamp: Date;
  analysis: {
    content: string;
  };
}

const PAIN_TYPES = [
  { id: 'sharp', label: 'Sharp/Stabbing', icon: Zap, color: '#ef4444', pattern: 'jagged' },
  { id: 'dull', label: 'Dull/Aching', icon: Circle, color: '#f97316', pattern: 'filled' },
  { id: 'burning', label: 'Burning', icon: Square, color: '#dc2626', pattern: 'wavy' },
  { id: 'throbbing', label: 'Throbbing', icon: Heart, color: '#be185d', pattern: 'pulsing' },
  { id: 'numbness', label: 'Numbness', icon: Minus, color: '#6b7280', pattern: 'dots' },
  { id: 'tingling', label: 'Tingling', icon: Brain, color: '#8b5cf6', pattern: 'dots' }
];

const INTENSITY_COLORS = [
  '#f3f4f6', '#fef3c7', '#fde68a', '#f59e0b', '#f97316', 
  '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'
];

export default function PainDrawingTool({ isOpen, onClose, onSendPainReport }: PainDrawingToolProps) {
  const { user } = useAuth();
  const [painPoints, setPainPoints] = useState<PainPoint[]>([]);
  const [selectedPainType, setSelectedPainType] = useState<PainPoint['type']>('sharp');
  const [selectedIntensity, setSelectedIntensity] = useState(5);
  const [bodyView, setBodyView] = useState<'front' | 'back'>('front');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [showWireframe, setShowWireframe] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<{ 
    content: string; 
    summary: string;
    severity?: string;
    mainPainPoints?: string;
    painTypeAnalysis?: string;
    possibleConditions?: string[];
    recommendations?: string[];
    clinicalNotes?: string;
  } | null>(null);

  const handlePainPointAdd = (point: PainPoint) => {
    setPainPoints(prev => [...prev, point]);
  };

  const analyzePainPattern = async (): Promise<PainReport['analysis']> => {
    const currentViewPoints = painPoints.filter(p => p.bodyView === bodyView);
    
    if (currentViewPoints.length === 0) {
      return {
        content: `## Severity Assessment
- Mild pain severity (no pain points marked)

## Main Pain Points
- No pain points marked on the body diagram

## Pain Type Analysis
- Unable to analyze without pain point data

## Possible Conditions
- No specific conditions identified

## Recommendations
- Please mark areas of pain on the body diagram

## Clinical Notes
- No pain data available for analysis`
      };
    }

    if (!user) {
      return {
        content: `## Severity Assessment
- Moderate pain severity (user not authenticated)

## Main Pain Points
- Unable to analyze without user authentication

## Pain Type Analysis
- Authentication required for AI analysis

## Possible Conditions
- User not authenticated

## Recommendations
- Please log in to use AI analysis

## Clinical Notes
- User authentication required for pain analysis`
      };
    }

    setIsAnalyzing(true);
    
    try {
      const response = await fetch('/api/analyze-pain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          painPoints: currentViewPoints,
          userId: user.uid,
          bodyView: bodyView
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze pain');
      }

      const analysis = await response.json();
      setAiAnalysis(analysis);
      
      // Return the structured text content directly
      return {
        content: analysis.content || 'Analysis unavailable'
      };
    } catch (error) {
      console.error('Error analyzing pain:', error);
      
      // Fallback to basic analysis
      const avgIntensity = currentViewPoints.reduce((sum, p) => sum + p.intensity, 0) / currentViewPoints.length;
      const severity = avgIntensity <= 3 ? 'mild' : avgIntensity <= 7 ? 'moderate' : 'severe';
      
      return {
        content: `## Severity Assessment
- ${severity.charAt(0).toUpperCase() + severity.slice(1)} pain severity based on intensity levels

## Main Pain Points
- AI analysis temporarily unavailable

## Pain Type Analysis
- Unable to determine pain characteristics at this time

## Possible Conditions
- AI analysis temporarily unavailable

## Recommendations
- Retry analysis or consult healthcare provider

## Clinical Notes
- AI analysis temporarily unavailable. Please try again or consult with a healthcare provider for proper assessment.`
      };
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generatePainReport = async (): Promise<PainReport> => {
    const analysis = await analyzePainPattern();
    return {
      painPoints,
      bodyView,
      timestamp: new Date(),
      analysis
    };
  };

  const handleSendReport = async () => {
    const report = await generatePainReport();
    
    // Console log the pain report being sent
    console.log('=== PAIN REPORT BEING SENT ===');
    console.log('Full pain report:', JSON.stringify(report, null, 2));
    console.log('Analysis data:', JSON.stringify(report.analysis, null, 2));
    console.log('=== END PAIN REPORT ===\n');
    
    if (onSendPainReport) {
      onSendPainReport(report);
    }
    setShowAnalysis(false);
    onClose();
  };

  const clearPainPoints = () => {
    setPainPoints([]);
  };

  if (!isOpen) return null;

  // Show gender selection screen if no gender is selected
  if (gender === null) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8" style={{ backgroundColor: '#F8FBFC' }}>
          <div className="text-center">
            <div className="w-16 h-16 rounded-lg flex items-center justify-center shadow-sm overflow-hidden bg-white border-2 mx-auto mb-4" style={{ borderColor: '#113B5C' }}>
              <Bone className="h-8 w-8" style={{ color: '#113B5C' }} />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: '#113B5C' }}>Pain Assessment</h2>
            <p className="text-sm font-medium" style={{ color: '#76C5E0' }}>Select your gender to begin marking pain locations</p>
            <p className="text-gray-600 mb-8 mt-2">Choose the appropriate body model for accurate pain mapping</p>
            
            <div className="space-y-4">
              <button
                onClick={() => setGender('male')}
                className="w-full flex items-center justify-center space-x-3 px-6 py-4 rounded-lg border-2 transition-colors"
                style={{ 
                  backgroundColor: '#F8FBFC', 
                  borderColor: '#76C5E0',
                  color: '#113B5C'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#E8F4F8';
                  e.currentTarget.style.borderColor = '#113B5C';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#F8FBFC';
                  e.currentTarget.style.borderColor = '#76C5E0';
                }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#113B5C' }}>
                  <span className="text-white font-bold text-sm">♂</span>
                </div>
                <span className="text-lg font-medium">Male</span>
              </button>
              
              <button
                onClick={() => setGender('female')}
                className="w-full flex items-center justify-center space-x-3 px-6 py-4 rounded-lg border-2 transition-colors"
                style={{ 
                  backgroundColor: '#F8FBFC', 
                  borderColor: '#76C5E0',
                  color: '#113B5C'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#E8F4F8';
                  e.currentTarget.style.borderColor = '#113B5C';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#F8FBFC';
                  e.currentTarget.style.borderColor = '#76C5E0';
                }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#113B5C' }}>
                  <span className="text-white font-bold text-sm">♀</span>
                </div>
                <span className="text-lg font-medium">Female</span>
              </button>
            </div>
            
            <div className="mt-6">
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl h-[90vh] flex flex-col" style={{ backgroundColor: '#F8FBFC' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#76C5E0' }}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm overflow-hidden bg-white border-2" style={{ borderColor: '#113B5C' }}>
              <Bone className="h-6 w-6" style={{ color: '#113B5C' }} />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight" style={{ color: '#113B5C' }}>Pain Assessment</h2>
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#76C5E0' }}>3D Body Mapping</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex">
          {/* Left Panel - Tools */}
          <div className="w-80 border-r flex flex-col relative z-0 bg-white" style={{ borderColor: '#76C5E0' }}>
            {/* Pain Type Selector */}
            <div className="p-6 border-b relative z-0" style={{ borderColor: '#76C5E0' }}>
              <h3 className="text-sm font-medium mb-3" style={{ color: '#113B5C' }}>Pain Type</h3>
              <div className="grid grid-cols-2 gap-2">
                {PAIN_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Pain type clicked:', type.id);
                        setSelectedPainType(type.id as PainPoint['type']);
                      }}
                      className={`p-3 rounded-lg border-2 transition-colors cursor-pointer select-none relative z-20 ${
                        selectedPainType === type.id
                          ? 'border-2'
                          : 'border-2 hover:border-opacity-70'
                      }`}
                      type="button"
                      style={{ 
                        pointerEvents: 'auto',
                        position: 'relative',
                        zIndex: 1,
                        backgroundColor: selectedPainType === type.id ? '#F8FBFC' : 'white',
                        borderColor: selectedPainType === type.id ? '#113B5C' : '#76C5E0',
                        color: '#113B5C'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedPainType !== type.id) {
                          e.currentTarget.style.backgroundColor = '#F8FBFC';
                          e.currentTarget.style.borderColor = '#113B5C';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedPainType !== type.id) {
                          e.currentTarget.style.backgroundColor = 'white';
                          e.currentTarget.style.borderColor = '#76C5E0';
                        }
                      }}
                    >
                      <Icon className="h-5 w-5 mx-auto mb-1" style={{ color: '#113B5C' }} />
                      <span className="text-xs" style={{ color: '#113B5C' }}>{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Intensity Slider */}
            <div className="p-6 border-b" style={{ borderColor: '#76C5E0' }}>
              <h3 className="text-sm font-medium mb-3" style={{ color: '#113B5C' }}>Pain Intensity</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#76C5E0' }}>Mild (1)</span>
                  <span className="text-sm" style={{ color: '#76C5E0' }}>Severe (10)</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={selectedIntensity}
                  onChange={(e) => setSelectedIntensity(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer border focus:outline-none focus:ring-0"
                  style={{
                    background: `linear-gradient(to right, #76C5E0 0%, #113B5C 100%)`,
                    borderColor: '#76C5E0',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none'
                  }}
                />
                {/* Positioned elements to align with slider handle - in their own space */}
                <div className="relative h-16 flex items-center justify-center">
                  <div 
                    className="absolute flex flex-col items-center pointer-events-none"
                    style={{
                      left: `calc(${((selectedIntensity - 1) / 9) * 100}% - 12px)`,
                      transform: 'translateX(0)'
                    }}
                  >
                    <span className="text-lg font-semibold" style={{ color: '#113B5C' }}>{selectedIntensity}</span>
                    <div 
                      className="w-6 h-6 rounded-full mt-1 border-2"
                      style={{ 
                        backgroundColor: INTENSITY_COLORS[selectedIntensity - 1],
                        borderColor: '#113B5C'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 space-y-3">
              <button
                onClick={clearPainPoints}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg border-2 transition-colors"
                style={{ 
                  backgroundColor: 'white', 
                  borderColor: '#76C5E0',
                  color: '#113B5C'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F8FBFC';
                  e.currentTarget.style.borderColor = '#113B5C';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#76C5E0';
                }}
              >
                <RotateCcw className="h-4 w-4" />
                <span>Clear All</span>
              </button>
              
              <button
                onClick={() => setShowAnalysis(true)}
                disabled={isAnalyzing}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  backgroundColor: '#113B5C', 
                  color: 'white'
                }}
                onMouseEnter={(e) => {
                  if (!isAnalyzing) {
                    e.currentTarget.style.backgroundColor = '#0F2A3F';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isAnalyzing) {
                    e.currentTarget.style.backgroundColor = '#113B5C';
                  }
                }}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4" />
                    <span>Analyze Pain</span>
                  </>
                )}
              </button>
            </div>

            {/* Instructions */}
            <div className="p-6 text-xs space-y-2" style={{ color: '#76C5E0' }}>
              <p><strong style={{ color: '#113B5C' }}>Instructions:</strong></p>
              <p>• Click on the 3D body to mark pain locations</p>
              <p>• Rotate the body with your mouse</p>
              <p>• Zoom in/out with scroll wheel</p>
              <p>• Use different pain types for accurate representation</p>
              <p>• Adjust intensity with the slider</p>
            </div>
          </div>

          {/* Right Panel - 3D Body Diagram */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 relative" style={{ pointerEvents: 'auto' }}>
              <ThreeDBodyDiagram
                painPoints={painPoints}
                onPainPointAdd={handlePainPointAdd}
                selectedPainType={selectedPainType}
                selectedIntensity={selectedIntensity}
                bodyView={bodyView}
                onBodyViewChange={setBodyView}
                gender={gender}
                onGenderChange={setGender}
                showWireframe={showWireframe}
                onWireframeToggle={() => setShowWireframe(!showWireframe)}
              />
            </div>
          </div>
        </div>

      </div>

      {/* Analysis Modal */}
      {showAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6" style={{ backgroundColor: '#F8FBFC' }}>
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm overflow-hidden bg-white border-2" style={{ borderColor: '#113B5C' }}>
                <AlertTriangle className="h-6 w-6" style={{ color: '#113B5C' }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight" style={{ color: '#113B5C' }}>AI Pain Analysis</h3>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#76C5E0' }}>Clinical Assessment</p>
              </div>
            </div>
            
            {isAnalyzing ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" style={{ color: '#113B5C' }} />
                  <p className="text-sm" style={{ color: '#76C5E0' }}>AI is analyzing your pain pattern...</p>
                </div>
              </div>
            ) : aiAnalysis ? (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium mb-2" style={{ color: '#113B5C' }}>Severity Assessment</h4>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    aiAnalysis?.severity === 'mild' ? 'bg-green-100 text-green-800' :
                    aiAnalysis?.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {aiAnalysis?.severity ? aiAnalysis.severity.charAt(0).toUpperCase() + aiAnalysis.severity.slice(1) : 'Unknown'}
                  </div>
                </div>
                
                {aiAnalysis.mainPainPoints && (
                  <div>
                    <h4 className="text-sm font-medium mb-2" style={{ color: '#113B5C' }}>Main Pain Points</h4>
                    <p className="text-sm" style={{ color: '#76C5E0' }}>{aiAnalysis.mainPainPoints}</p>
                  </div>
                )}
                
                {aiAnalysis.painTypeAnalysis && (
                  <div>
                    <h4 className="text-sm font-medium mb-2" style={{ color: '#113B5C' }}>Pain Type Analysis</h4>
                    <p className="text-sm" style={{ color: '#76C5E0' }}>{aiAnalysis.painTypeAnalysis}</p>
                  </div>
                )}
                
                {aiAnalysis.possibleConditions && aiAnalysis.possibleConditions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2" style={{ color: '#113B5C' }}>Possible Conditions</h4>
                    <ul className="text-sm space-y-1" style={{ color: '#76C5E0' }}>
                      {aiAnalysis.possibleConditions.map((condition: string, index: number) => (
                        <li key={index}>• {condition}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {aiAnalysis.recommendations && aiAnalysis.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2" style={{ color: '#113B5C' }}>Recommendations</h4>
                    <ul className="text-sm space-y-1" style={{ color: '#76C5E0' }}>
                      {aiAnalysis.recommendations.map((rec: string, index: number) => (
                        <li key={index}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {aiAnalysis.clinicalNotes && (
                  <div>
                    <h4 className="text-sm font-medium mb-2" style={{ color: '#113B5C' }}>Clinical Notes</h4>
                    <p className="text-sm" style={{ color: '#76C5E0' }}>{aiAnalysis.clinicalNotes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: '#76C5E0' }}>Click "Analyze Pain" to get AI-powered analysis</p>
              </div>
            )}
            
            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowAnalysis(false);
                  setAiAnalysis(null);
                }}
                className="px-4 py-2 rounded-lg border-2 transition-colors"
                style={{ 
                  backgroundColor: 'white', 
                  borderColor: '#76C5E0',
                  color: '#113B5C'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F8FBFC';
                  e.currentTarget.style.borderColor = '#113B5C';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#76C5E0';
                }}
              >
                Close
              </button>
              <button
                onClick={handleSendReport}
                disabled={isAnalyzing}
                className="px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  backgroundColor: '#113B5C', 
                  color: 'white'
                }}
                onMouseEnter={(e) => {
                  if (!isAnalyzing) {
                    e.currentTarget.style.backgroundColor = '#0F2A3F';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isAnalyzing) {
                    e.currentTarget.style.backgroundColor = '#113B5C';
                  }
                }}
              >
                Send Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
