'use client';

import React, { useRef, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html, Environment } from '@react-three/drei';
import * as THREE from 'three';

interface PainPoint {
  id: string;
  position: [number, number, number];
  intensity: number;
  type: 'sharp' | 'dull' | 'burning' | 'throbbing' | 'numbness' | 'tingling';
  size: number;
  timestamp: Date;
  bodyView: 'front' | 'back';
  bodyPart?: string; // Add body part detection
}

interface ThreeDBodyDiagramProps {
  painPoints: PainPoint[];
  onPainPointAdd: (point: PainPoint) => void;
  selectedPainType: PainPoint['type'];
  selectedIntensity: number;
  bodyView: 'front' | 'back';
  onBodyViewChange: (view: 'front' | 'back') => void;
  gender: 'male' | 'female';
  onGenderChange: (gender: 'male' | 'female') => void;
  showWireframe: boolean;
  onWireframeToggle: () => void;
}

// Professional 3D Human Model Component using GLB
function HumanModel({ painPoints, onPainPointAdd, selectedPainType, selectedIntensity, bodyView, gender, showWireframe }: {
  painPoints: PainPoint[];
  onPainPointAdd: (point: PainPoint) => void;
  selectedPainType: PainPoint['type'];
  selectedIntensity: number;
  bodyView: 'front' | 'back';
  gender: 'male' | 'female';
  showWireframe: boolean;
}) {
  // Use the appropriate model based on gender
  const modelPath = gender === 'male' ? '/Lowpoly Male (Rigged).glb' : '/Lowpoly Female (Rigged).glb';
  const { scene, materials, animations } = useGLTF(modelPath);
  const meshRef = useRef<THREE.Group>(null);
  const { camera, raycaster, mouse } = useThree();
  const [hovered, setHovered] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [lastClickCoords, setLastClickCoords] = useState<{x: number, y: number, z: number, bodyPart: string} | null>(null);

  // Timeout fallback if GLB model doesn't load
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (!modelLoaded) {
        console.log('GLB model taking too long, using fallback');
        setUseFallback(true);
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timer);
  }, [modelLoaded]);


  // Keyboard shortcut for debug mode
  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'd') {
        setShowDebugInfo(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Clone the scene to avoid issues with multiple instances
  const clonedScene = React.useMemo(() => {
    if (!scene) {
      console.log('Scene not loaded yet');
      return null;
    }
    
    console.log('Scene loaded, cloning...', scene);
    const cloned = scene.clone();
    
    // Set up materials for better appearance and memory efficiency
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = false; // Disable shadows to reduce GPU load
        child.receiveShadow = false;
        
        // Ensure the mesh is visible
        child.visible = true;
        
        console.log('Processing mesh:', child.name, child.visible);
        
        // Optimize materials for better performance
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat: THREE.Material) => {
              if (mat instanceof THREE.MeshStandardMaterial) {
                mat.roughness = 0.8;
                mat.metalness = 0.1;
                mat.envMapIntensity = 0.5; // Reduce environment intensity
                mat.wireframe = true; // Always show wireframe
                mat.transparent = true;
                mat.opacity = 0.4; // Slightly more opaque wireframe
                mat.color.setHex(0x87CEEB); // Light blue wireframe
                mat.needsUpdate = true;
                // Disable expensive features
                mat.envMap = null;
              }
            });
          } else if (child.material instanceof THREE.MeshStandardMaterial) {
            child.material.roughness = 0.8;
            child.material.metalness = 0.1;
            child.material.envMapIntensity = 0.5; // Reduce environment intensity
            child.material.wireframe = true; // Always show wireframe
            child.material.transparent = true;
            child.material.opacity = 0.4; // Slightly more opaque wireframe
            child.material.color.setHex(0x87CEEB); // Light blue wireframe
            child.material.needsUpdate = true;
            // Disable expensive features
            child.material.envMap = null;
          }
        }
        
        // Reduce geometry complexity if needed
        if (child.geometry && child.geometry.attributes.position.count > 10000) {
          console.log('High poly mesh detected:', child.name, child.geometry.attributes.position.count);
        }
      }
    });
    
    // Scale and position the model appropriately
    cloned.scale.setScalar(0.8); // Slightly smaller to reduce GPU load
    cloned.position.set(0, -1, 0);
    
    console.log('Model cloned and ready');
    setModelLoaded(true);
    return cloned;
  }, [scene, showWireframe]);

  // Function to detect body part based on 3D coordinates
  // Calibrated using actual coordinate data from male model
  const detectBodyPart = (x: number, y: number, z: number): string => {
    // Using calibrated coordinate ranges from actual model data
    // Calibration points: Nose(1.62), Chest(1.38), Shoulders(±0.19,1.45), Middle torso(1.26), 
    // Elbows(±0.32,1.21), Pelvis(0.87), Hands(±0.55,0.91), Knees(±0.16,0.5), Feet(±0.26,0.04)
    // Hips: Left(-0.15,0.91,0.04), Right(0.15,0.91,0.04)
    // Back: Upper(0,1.37,-0.14), Mid(0,1.17,-0.09), Lower(0,1.04,-0.12)
    // Back Shoulders: z ≈ -0.11 (negative Z = back side)
    // X coordinate: negative = left side, positive = right side
    
    // Head and face region (y > 1.55) - above nose level
    if (y > 1.55) {
      // Check Z coordinate for more specific head parts
      if (z > 0.1) {
        return 'Face';
      } else if (z < -0.05) {
        return 'Back of Head';
      }
      return 'Head';
    }
    
    // Neck region (y: 1.45 - 1.55) - between shoulders and nose
    else if (y > 1.45) {
      return 'Neck';
    }
    
    // Shoulder region (y: 1.35 - 1.45) - around shoulder level
    else if (y > 1.35) {
      if (Math.abs(x) > 0.15) {
        // Check Z coordinate for front vs back shoulders
        if (z < -0.08) {
          return x < 0 ? 'Back Left Shoulder' : 'Back Right Shoulder';
        } else {
          return x < 0 ? 'Left Shoulder' : 'Right Shoulder';
        }
      }
      return 'Upper Chest';
    }
    
    // Chest region (y: 1.25 - 1.35) - around chest level
    else if (y > 1.25) {
      if (Math.abs(x) > 0.15) {
        return x < 0 ? 'Left Shoulder Blade' : 'Right Shoulder Blade';
      }
      // Check Z coordinate for back vs front
      if (z < -0.1) {
        return 'Upper Back';
      }
      return 'Chest';
    }
    
    // Middle torso region (y: 1.15 - 1.25) - around middle torso level
    else if (y > 1.15) {
      if (Math.abs(x) > 0.3) {
        return x < 0 ? 'Left Elbow' : 'Right Elbow';
      }
      // Check Z coordinate for back vs front
      if (z < -0.05) {
        return 'Mid Back';
      }
      return 'Middle Torso';
    }
    
    // Lower torso region (y: 1.0 - 1.15) - between middle torso and pelvis
    else if (y > 1.0) {
      if (Math.abs(x) > 0.3) {
        return x < 0 ? 'Left Forearm' : 'Right Forearm';
      }
      // Check Z coordinate for back vs front
      if (z < -0.08) {
        return 'Lower Back';
      }
      return 'Lower Torso';
    }
    
    // Pelvis and hand region (y: 0.8 - 1.0) - around pelvis and hand level
    else if (y > 0.8) {
      if (Math.abs(x) > 0.5) {
        // Check Z coordinate for more specific hand parts
        if (z > 0.05) {
          return x < 0 ? 'Left Fingers' : 'Right Fingers';
        } else {
          return x < 0 ? 'Left Hand' : 'Right Hand';
        }
      } else if (Math.abs(x) > 0.3) {
        return x < 0 ? 'Left Wrist' : 'Right Wrist';
      } else if (Math.abs(x) > 0.1 && Math.abs(x) < 0.2) {
        // Check for hips specifically (around x=±0.15, y=0.91)
        return x < 0 ? 'Left Hip' : 'Right Hip';
      }
      return 'Pelvis';
    }
    
    // Thigh region (y: 0.6 - 0.8) - between pelvis and knees
    else if (y > 0.6) {
      return x < 0 ? 'Left Thigh' : 'Right Thigh';
    }
    
    // Knee region (y: 0.4 - 0.6) - around knee level
    else if (y > 0.4) {
      if (Math.abs(x) > 0.1 && Math.abs(x) < 0.2) {
        return x < 0 ? 'Left Knee' : 'Right Knee';
      }
      // Check Z coordinate for shins (front) vs calves (back)
      if (z > 0.05) {
        return x < 0 ? 'Left Shin' : 'Right Shin';
      } else if (z < -0.05) {
        return x < 0 ? 'Left Calf' : 'Right Calf';
      }
      return x < 0 ? 'Left Lower Leg' : 'Right Lower Leg';
    }
    
    // Lower leg region (y: 0.2 - 0.4) - between knees and feet
    else if (y > 0.2) {
      if (Math.abs(x) > 0.2) {
        return x < 0 ? 'Left Ankle' : 'Right Ankle';
      }
      // Check Z coordinate for shins (front) vs calves (back)
      if (z > 0.05) {
        return x < 0 ? 'Left Shin' : 'Right Shin';
      } else if (z < -0.05) {
        return x < 0 ? 'Left Calf' : 'Right Calf';
      }
      return x < 0 ? 'Left Lower Leg' : 'Right Lower Leg';
    }
    
    // Foot region (y: 0.0 - 0.2) - around foot level
    else if (y > 0.0) {
      if (Math.abs(x) > 0.2) {
        // Check Z coordinate for more specific foot parts
        if (z > 0.05) {
          return x < 0 ? 'Left Toes' : 'Right Toes';
        } else {
          return x < 0 ? 'Left Foot' : 'Right Foot';
        }
      }
      return x < 0 ? 'Left Lower Leg' : 'Right Lower Leg';
    }
    
    // Very bottom - toes region
    else {
      if (Math.abs(x) > 0.2) {
        return x < 0 ? 'Left Toes' : 'Right Toes';
      }
      return x < 0 ? 'Left Foot' : 'Right Foot';
    }
  };

  // Handle click events for pain point placement
  const handleClick = (event: { point: THREE.Vector3; stopPropagation: () => void }) => {
    event.stopPropagation();
    
    // Get intersection point
    const intersection = event.point;
    if (intersection) {
      const bodyPart = detectBodyPart(intersection.x, intersection.y, intersection.z);
      
      // Store coordinates for debug display
      setLastClickCoords({
        x: intersection.x,
        y: intersection.y,
        z: intersection.z,
        bodyPart: bodyPart
      });
      
      // Debug logging to help calibrate coordinates
      console.log(`Click coordinates: x=${intersection.x.toFixed(2)}, y=${intersection.y.toFixed(2)}, z=${intersection.z.toFixed(2)}`);
      console.log(`Detected body part: ${bodyPart}`);
      console.log(`Model loaded: ${modelLoaded}, Using fallback: ${useFallback}`);
      
      const newPainPoint: PainPoint = {
        id: `pain-${Date.now()}`,
        position: [intersection.x, intersection.y, intersection.z],
        intensity: selectedIntensity,
        type: selectedPainType,
        size: Math.max(0.05, selectedIntensity * 0.02),
        timestamp: new Date(),
        bodyView: bodyView,
        bodyPart: bodyPart,
      };
      
      onPainPointAdd(newPainPoint);
    }
  };

  // Pain point colors based on intensity
  const getPainColor = (intensity: number) => {
    const colors = [
      '#f3f4f6', '#fef3c7', '#fde68a', '#f59e0b', '#f97316', 
      '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#450a0a'
    ];
    return colors[Math.min(intensity - 1, colors.length - 1)];
  };

  // Render different pain point types
  const renderPainPoint = (point: PainPoint) => {
    const [x, y, z] = point.position;
    const color = getPainColor(point.intensity);

    switch (point.type) {
      case 'sharp':
        return (
          <group key={point.id} position={[x, y, z]}>
            {/* Sharp pain - spikes */}
            {[...Array(3)].map((_, i) => (
              <mesh key={i} position={[0, i * 0.02, 0]}>
                <coneGeometry args={[0.01, 0.1, 4]} />
                <meshBasicMaterial color={color} />
              </mesh>
            ))}
          </group>
        );

      case 'dull':
        return (
          <mesh key={point.id} position={[x, y, z]}>
            <sphereGeometry args={[point.size, 16, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.7} />
          </mesh>
        );

      case 'burning':
        return (
          <group key={point.id} position={[x, y, z]}>
            {/* Burning pain - flame-like shapes */}
            {[...Array(4)].map((_, i) => (
              <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
                <coneGeometry args={[0.02, 0.08, 6]} />
                <meshBasicMaterial color={color} transparent opacity={0.8} />
              </mesh>
            ))}
          </group>
        );

      case 'throbbing':
        return (
          <ThrobbingPainPoint key={point.id} position={[x, y, z]} color={color} size={point.size} />
        );

      case 'numbness':
      case 'tingling':
        return (
          <group key={point.id} position={[x, y, z]}>
            {/* Scattered dots for numbness/tingling */}
            {[...Array(8)].map((_, i) => (
              <mesh key={i} position={[
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1
              ]}>
                <sphereGeometry args={[0.005, 8, 8]} />
                <meshBasicMaterial color={color} />
              </mesh>
            ))}
          </group>
        );

      default:
        return (
          <mesh key={point.id} position={[x, y, z]}>
            <sphereGeometry args={[point.size, 16, 16]} />
            <meshBasicMaterial color={color} />
          </mesh>
        );
    }
  };

  // Show loading state if model isn't ready
  if ((!clonedScene || !modelLoaded) && !useFallback) {
    return (
      <group>
        <Html center>
          <div className="text-gray-600 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            Loading 3D Model...
          </div>
        </Html>
        {/* Fallback simple body while loading */}
        <mesh position={[0, 0, 0]} onClick={handleClick}>
          <boxGeometry args={[0.5, 2, 0.3]} />
          <meshStandardMaterial color="#fdbcb4" />
        </mesh>
      </group>
    );
  }

  // Use fallback model if GLB failed to load
  if (useFallback) {
    return (
      <group ref={meshRef} rotation={[0, bodyView === 'back' ? Math.PI : 0, 0]}>
        {/* Fallback simple human body */}
        <mesh position={[0, 0, 0]} onClick={handleClick} castShadow receiveShadow>
          <boxGeometry args={[0.6, 2.2, 0.4]} />
          <meshStandardMaterial 
            color="#87CEEB" 
            wireframe={true}
            transparent={true}
            opacity={0.4}
          />
        </mesh>
        
        {/* Head */}
        <mesh position={[0, 1.2, 0]} onClick={handleClick} castShadow receiveShadow>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial 
            color="#87CEEB" 
            wireframe={true}
            transparent={true}
            opacity={0.4}
          />
        </mesh>
        
        {/* Arms */}
        <mesh position={[-0.5, 0.5, 0]} onClick={handleClick} castShadow receiveShadow>
          <cylinderGeometry args={[0.1, 0.1, 1, 8]} />
          <meshStandardMaterial 
            color="#87CEEB" 
            wireframe={true}
            transparent={true}
            opacity={0.4}
          />
        </mesh>
        <mesh position={[0.5, 0.5, 0]} onClick={handleClick} castShadow receiveShadow>
          <cylinderGeometry args={[0.1, 0.1, 1, 8]} />
          <meshStandardMaterial 
            color="#87CEEB" 
            wireframe={true}
            transparent={true}
            opacity={0.4}
          />
        </mesh>
        
        {/* Legs */}
        <mesh position={[-0.2, -1.1, 0]} onClick={handleClick} castShadow receiveShadow>
          <cylinderGeometry args={[0.12, 0.12, 1.2, 8]} />
          <meshStandardMaterial 
            color="#87CEEB" 
            wireframe={true}
            transparent={true}
            opacity={0.4}
          />
        </mesh>
        <mesh position={[0.2, -1.1, 0]} onClick={handleClick} castShadow receiveShadow>
          <cylinderGeometry args={[0.12, 0.12, 1.2, 8]} />
          <meshStandardMaterial 
            color="#87CEEB" 
            wireframe={true}
            transparent={true}
            opacity={0.4}
          />
        </mesh>


        {/* Render pain points */}
        {painPoints
          .filter(point => point.bodyView === bodyView)
          .map(renderPainPoint)}
      </group>
    );
  }

  return (
    <group ref={meshRef} rotation={[0, bodyView === 'back' ? Math.PI : 0, 0]}>
      {/* Professional 3D Human Model - Solid */}
      {clonedScene && (
        <>
          <primitive 
            object={clonedScene} 
            scale={[1, 1, 1]}
            position={[0, -1, 0]}
          />
          <mesh
            onClick={handleClick}
            visible={false} // Make it invisible
          >
            <primitive object={clonedScene.clone()} />
          </mesh>
        </>
      )}



      {/* Render pain points */}
      {painPoints
        .filter(point => point.bodyView === bodyView)
        .map(renderPainPoint)}

      {/* Debug info overlay */}
      {showDebugInfo && (
        <Html position={[0, 2, 0]} center>
          <div className="bg-black/80 text-white p-2 rounded text-xs max-w-xs">
            <div className="font-bold mb-1">Debug Mode (Press &apos;D&apos; to toggle)</div>
            {lastClickCoords ? (
              <div>
                <div>X: {lastClickCoords.x.toFixed(2)}</div>
                <div>Y: {lastClickCoords.y.toFixed(2)}</div>
                <div>Z: {lastClickCoords.z.toFixed(2)}</div>
                <div>Body Part: {lastClickCoords.bodyPart}</div>
                <div className="mt-1 text-yellow-300">
                  Y Position: {lastClickCoords.y.toFixed(2)} (Head: 1.62, Feet: 0.04)
                </div>
                <div className="mt-1 text-green-300">
                  Model: {useFallback ? 'Fallback' : 'GLB'} | Loaded: {modelLoaded ? 'Yes' : 'No'}
                </div>
              </div>
            ) : (
              <div>Click on the model to see coordinates</div>
            )}
          </div>
        </Html>
      )}

      {/* Visual indicators for clickable areas */}
      {showDebugInfo && useFallback && (
        <>
          {/* Head clickable area indicator */}
          <mesh position={[0, 1.2, 0]}>
            <sphereGeometry args={[0.35, 16, 16]} />
            <meshBasicMaterial color="#87CEEB" transparent opacity={0.3} wireframe />
          </mesh>
          
          {/* Torso clickable area indicator */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.7, 2.4, 0.5]} />
            <meshBasicMaterial color="#87CEEB" transparent opacity={0.3} wireframe />
          </mesh>
          
          {/* Left arm clickable area indicator */}
          <mesh position={[-0.5, 0.5, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 1.2, 8]} />
            <meshBasicMaterial color="#87CEEB" transparent opacity={0.3} wireframe />
          </mesh>
          
          {/* Right arm clickable area indicator */}
          <mesh position={[0.5, 0.5, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 1.2, 8]} />
            <meshBasicMaterial color="#87CEEB" transparent opacity={0.3} wireframe />
          </mesh>
          
          {/* Left leg clickable area indicator */}
          <mesh position={[-0.2, -1.1, 0]}>
            <cylinderGeometry args={[0.17, 0.17, 1.4, 8]} />
            <meshBasicMaterial color="#87CEEB" transparent opacity={0.3} wireframe />
          </mesh>
          
          {/* Right leg clickable area indicator */}
          <mesh position={[0.2, -1.1, 0]}>
            <cylinderGeometry args={[0.17, 0.17, 1.4, 8]} />
            <meshBasicMaterial color="#87CEEB" transparent opacity={0.3} wireframe />
          </mesh>
        </>
      )}
    </group>
  );
}

// Animated throbbing pain point component
function ThrobbingPainPoint({ position, color, size }: { position: [number, number, number], color: string, size: number }) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      const time = state.clock.elapsedTime;
      groupRef.current.children.forEach((child, i) => {
        const scale = 1 + Math.sin(time * 3 + i) * 0.3;
        child.scale.setScalar(scale);
      });
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Pulsing spheres that work on any surface */}
      {[...Array(3)].map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[size / 20 + i * 0.02, 16, 16]} />
          <meshBasicMaterial 
            color={color} 
            transparent 
            opacity={0.6 - i * 0.15} 
            wireframe={i === 0} // Inner sphere is solid, outer ones are wireframe
          />
        </mesh>
      ))}
    </group>
  );
}

// Optimized lighting setup to prevent context loss
function Lighting() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
    </>
  );
}

// Environment for realistic reflections
function SceneEnvironment() {
  return (
    <Environment preset="studio" />
  );
}

// Main 3D Body Diagram Component
export default function ThreeDBodyDiagram({
  painPoints,
  onPainPointAdd,
  selectedPainType,
  selectedIntensity,
  bodyView,
  onBodyViewChange,
  gender,
  onGenderChange,
  showWireframe,
  onWireframeToggle
}: ThreeDBodyDiagramProps) {
  const [contextLost, setContextLost] = useState(false);

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    console.warn('WebGL context lost, attempting recovery...');
    setContextLost(true);
  };

  const handleContextRestored = () => {
    console.log('WebGL context restored');
    setContextLost(false);
  };

  // Add event listeners for context loss
  React.useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('webglcontextlost', handleContextLost);
      canvas.addEventListener('webglcontextrestored', handleContextRestored);
      
      return () => {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      };
    }
  }, []);

  if (contextLost) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-lg overflow-hidden relative flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-lg font-medium mb-2">WebGL Context Lost</div>
          <div className="text-gray-600 mb-4">The 3D rendering context was lost. Please refresh the page.</div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-lg overflow-hidden relative">
      <Canvas
        camera={{ position: [0, 1, 4], fov: 60 }}
        style={{ width: '100%', height: '100%' }}
        shadows={false}
        onCreated={({ camera, scene, gl }) => {
          // Ensure proper camera setup - positioned at chest level
          camera.position.set(0, 1, 4);
          camera.lookAt(0, 0, 0);
          
          // Configure renderer for better stability
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          
          // Add context loss handling
          gl.domElement.addEventListener('webglcontextlost', handleContextLost);
          gl.domElement.addEventListener('webglcontextrestored', handleContextRestored);
        }}
      >
        <Lighting />
        {/* Disabled environment to prevent context loss */}
        {/* <SceneEnvironment /> */}
        
        {/* Simplified ground plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]}>
          <planeGeometry args={[20, 20]} />
          <meshBasicMaterial color="#f0f9ff" transparent opacity={0.1} />
        </mesh>
        
        <Suspense fallback={
          <Html center>
            <div className="text-gray-600">Loading 3D Model...</div>
          </Html>
        }>
          <HumanModel
            painPoints={painPoints}
            onPainPointAdd={onPainPointAdd}
            selectedPainType={selectedPainType}
            selectedIntensity={selectedIntensity}
            bodyView={bodyView}
            gender={gender}
            showWireframe={showWireframe}
          />
        </Suspense>
        
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          enableRotate={true}
          zoomToCursor={true}
          minDistance={1.5}
          maxDistance={8}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI - Math.PI / 6}
          autoRotate={false}
          autoRotateSpeed={0.5}
        />
      </Canvas>
      
      {/* Control buttons */}
      <div className="absolute top-4 right-4 flex gap-2">
        {/* Gender indicator */}
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2">
          <span className="text-sm font-medium text-gray-700 capitalize">
            {gender === 'male' ? '♂' : '♀'} {gender} Model
          </span>
        </div>
      </div>

      {/* Instructions overlay */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <p className="text-sm text-gray-700 text-center">
            Click on the 3D model to mark pain locations. Rotate with mouse, zoom with scroll wheel.
          </p>
        </div>
      </div>
    </div>
  );
}