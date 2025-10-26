'use client';

import React from 'react';

interface CustomIconProps {
  name: 'pain-assessment' | 'voice-translation' | 'medical-illustration' | 'surgical-procedure' | 'treatment-guidelines' | 'patient-education' | 'schedule-email' | '3d-body-model' | 'medical-records';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const iconPaths = {
  'pain-assessment': (
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
  ),
  'voice-translation': (
    <g>
      {/* Microphone for voice input */}
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
      {/* Translation arrows */}
      <path d="M8 8l2 2-2 2" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 8l-2 2 2 2" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </g>
  ),
  'medical-illustration': (
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
  ),
  'surgical-procedure': (
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  ),
  'treatment-guidelines': (
    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
  ),
  'patient-education': (
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
  ),
  'schedule-email': (
    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
  ),
  '3d-body-model': (
    <g>
      {/* Human body silhouette */}
      <path d="M12 2c-1.1 0-2 .9-2 2v1c0 .55.45 1 1 1s1-.45 1-1V4c0-.55.45-1 1-1s1 .45 1 1v1c0 .55.45 1 1 1s1-.45 1-1V4c0-1.1-.9-2-2-2z"/>
      <path d="M12 6c-2.21 0-4 1.79-4 4v6c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2v-6c0-2.21-1.79-4-4-4z"/>
      <path d="M10 12c0-1.1.9-2 2-2s2 .9 2 2v4c0 1.1-.9 2-2 2s-2-.9-2-2v-4z"/>
      {/* 3D effect lines */}
      <path d="M8 8l2 2" stroke="currentColor" strokeWidth="0.5" fill="none" strokeLinecap="round"/>
      <path d="M16 8l-2 2" stroke="currentColor" strokeWidth="0.5" fill="none" strokeLinecap="round"/>
    </g>
  ),
  'medical-records': (
    <g>
      {/* Medical chart/document */}
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
      {/* Medical cross */}
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round"/>
    </g>
  )
};

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5', 
  lg: 'h-6 w-6'
};

export default function CustomIcon({ name, className = '', size = 'md' }: CustomIconProps) {
  return (
    <svg
      className={`${sizeClasses[size]} ${className}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      {iconPaths[name]}
    </svg>
  );
}
