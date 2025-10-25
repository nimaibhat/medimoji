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
  RotateCw
} from 'lucide-react';
import ThreeDBodyDiagram from './ThreeDBodyDiagram';

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
    possibleConditions: string[];
    severity: 'mild' | 'moderate' | 'severe';
    recommendations: string[];
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
  const [painPoints, setPainPoints] = useState<PainPoint[]>([]);
  const [selectedPainType, setSelectedPainType] = useState<PainPoint['type']>('sharp');
  const [selectedIntensity, setSelectedIntensity] = useState(5);
  const [bodyView, setBodyView] = useState<'front' | 'back'>('front');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [showWireframe, setShowWireframe] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const handlePainPointAdd = (point: PainPoint) => {
    setPainPoints(prev => [...prev, point]);
  };

  const analyzePainPattern = (): PainReport['analysis'] => {
    const currentViewPoints = painPoints.filter(p => p.bodyView === bodyView);
    
    if (currentViewPoints.length === 0) {
      return {
        possibleConditions: [],
        severity: 'mild',
        recommendations: ['Please mark areas of pain on the body diagram']
      };
    }

    const avgIntensity = currentViewPoints.reduce((sum, p) => sum + p.intensity, 0) / currentViewPoints.length;
    const severity = avgIntensity <= 3 ? 'mild' : avgIntensity <= 7 ? 'moderate' : 'severe';
    
    const conditions: string[] = [];
    const recommendations: string[] = [];
    
    // Pattern recognition logic
    const hasLowerBackPain = currentViewPoints.some(p => 
      p.position[1] > 0.3 && p.position[0] > -0.2 && p.position[0] < 0.2 && bodyView === 'back'
    );
    
    const hasChestPain = currentViewPoints.some(p => 
      p.position[1] > 0.5 && p.position[1] < 1.0 && p.position[0] > -0.2 && p.position[0] < 0.2 && bodyView === 'front'
    );
    
    const hasBilateralPain = currentViewPoints.length >= 2 && 
      currentViewPoints.every(p => p.intensity > 5);
    
    if (hasLowerBackPain) {
      conditions.push('Lower back pain');
      recommendations.push('Consider sciatica or muscle strain');
    }
    
    if (hasChestPain) {
      conditions.push('Chest pain');
      recommendations.push('Seek immediate medical attention if severe');
    }
    
    if (hasBilateralPain) {
      conditions.push('Bilateral pain pattern');
      recommendations.push('May indicate systemic condition');
    }
    
    if (conditions.length === 0) {
      conditions.push('Localized pain');
      recommendations.push('Monitor pain intensity and duration');
    }
    
    return {
      possibleConditions: conditions,
      severity,
      recommendations
    };
  };

  const generatePainReport = (): PainReport => {
    return {
      painPoints,
      bodyView,
      timestamp: new Date(),
      analysis: analyzePainPattern()
    };
  };

  const handleSendReport = () => {
    const report = generatePainReport();
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
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8">
          <div className="text-center">
            <Bone className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Draw Your Pain</h2>
            <p className="text-gray-600 mb-8">Select your gender to begin marking pain locations on the 3D body model</p>
            
            <div className="space-y-4">
              <button
                onClick={() => setGender('male')}
                className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">♂</span>
                </div>
                <span className="text-lg font-medium text-blue-900">Male</span>
              </button>
              
              <button
                onClick={() => setGender('female')}
                className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-pink-50 border-2 border-pink-200 rounded-lg hover:bg-pink-100 hover:border-pink-300 transition-colors"
              >
                <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">♀</span>
                </div>
                <span className="text-lg font-medium text-pink-900">Female</span>
              </button>
            </div>
            
            <div className="mt-6">
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 text-sm"
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Bone className="h-6 w-6 text-red-500" />
            <h2 className="text-xl font-semibold text-gray-900">Draw Your Pain</h2>
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
          <div className="w-80 border-r border-gray-200 flex flex-col relative z-0 bg-white">
            {/* Pain Type Selector */}
            <div className="p-4 border-b border-gray-200 relative z-0">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Pain Type</h3>
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
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      type="button"
                      style={{ 
                        pointerEvents: 'auto',
                        position: 'relative',
                        zIndex: 1
                      }}
                    >
                      <Icon className="h-5 w-5 mx-auto mb-1" style={{ color: type.color }} />
                      <span className="text-xs text-gray-700">{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Intensity Slider */}
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Pain Intensity</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Mild (1)</span>
                  <span className="text-sm text-gray-500">Severe (10)</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={selectedIntensity}
                  onChange={(e) => setSelectedIntensity(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer border border-black focus:outline-none focus:ring-0"
                  style={{
                    background: `linear-gradient(to right, ${INTENSITY_COLORS[0]} 0%, ${INTENSITY_COLORS[9]} 100%)`,
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
                    <span className="text-lg font-semibold text-gray-900">{selectedIntensity}</span>
                    <div 
                      className="w-6 h-6 rounded-full mt-1"
                      style={{ backgroundColor: INTENSITY_COLORS[selectedIntensity - 1] }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 space-y-3">
              <button
                onClick={clearPainPoints}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Clear All</span>
              </button>
              
              <button
                onClick={() => setShowAnalysis(true)}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <AlertTriangle className="h-4 w-4" />
                <span>Analyze Pain</span>
              </button>
            </div>

            {/* Instructions */}
            <div className="p-4 text-xs text-gray-500 space-y-2">
              <p><strong>Instructions:</strong></p>
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

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            {painPoints.filter(p => p.bodyView === bodyView).length} pain point(s) marked
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSendReport}
              disabled={painPoints.length === 0}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Send className="h-4 w-4" />
              <span>Send Pain Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Analysis Modal */}
      {showAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pain Analysis</h3>
            
            {(() => {
              const analysis = analyzePainPattern();
              return (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Severity Level</h4>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      analysis.severity === 'mild' ? 'bg-green-100 text-green-800' :
                      analysis.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {analysis.severity.charAt(0).toUpperCase() + analysis.severity.slice(1)}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Possible Conditions</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {analysis.possibleConditions.map((condition, index) => (
                        <li key={index}>• {condition}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {analysis.recommendations.map((rec, index) => (
                        <li key={index}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })()}
            
            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAnalysis(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
              <button
                onClick={handleSendReport}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
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
