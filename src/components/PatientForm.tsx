'use client';

import { useState } from 'react';
import { Calendar, User, Clock, Save, ArrowRight } from 'lucide-react';

interface PatientInfo {
  patientName: string;
  patientId?: string;
  date: string;
  time: string;
  doctorName: string;
  visitType: string;
  notes?: string;
}

interface PatientFormProps {
  onStartConversation: (patientInfo: PatientInfo) => void;
  onCancel: () => void;
}

export default function PatientForm({ onStartConversation, onCancel }: PatientFormProps) {
  const [formData, setFormData] = useState<PatientInfo>({
    patientName: '',
    patientId: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    doctorName: '',
    visitType: 'consultation',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientName.trim()) {
      alert('Please enter patient name');
      return;
    }
    console.log('Submitting patient form:', formData);
    onStartConversation(formData);
  };

  const handleChange = (field: keyof PatientInfo, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <User className="h-6 w-6 text-gray-600" />
              <h1 className="text-2xl font-semibold text-gray-900">New Patient Conversation</h1>
            </div>
            
            <p className="text-gray-600">
              Please fill in the patient details to start a voice translation session.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Patient Information */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center">
                <User className="h-4 w-4 mr-2 text-gray-500" />
                Patient Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Patient Name *
                  </label>
                  <input
                    type="text"
                    value={formData.patientName}
                    onChange={(e) => handleChange('patientName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-gray-900 text-sm"
                    placeholder="Enter patient name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Patient ID
                  </label>
                  <input
                    type="text"
                    value={formData.patientId}
                    onChange={(e) => handleChange('patientId', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-gray-900 text-sm"
                    placeholder="Optional patient ID"
                  />
                </div>
              </div>
            </div>

            {/* Appointment Details */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                Appointment Details
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleChange('date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-gray-900 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time
                  </label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => handleChange('time', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-gray-900 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Doctor Information */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center">
                <User className="h-4 w-4 mr-2 text-gray-500" />
                Doctor Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Doctor Name
                  </label>
                  <input
                    type="text"
                    value={formData.doctorName}
                    onChange={(e) => handleChange('doctorName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-gray-900 text-sm"
                    placeholder="Enter doctor name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Visit Type
                  </label>
                  <select
                    value={formData.visitType}
                    onChange={(e) => handleChange('visitType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-gray-900 text-sm"
                  >
                    <option value="consultation">Consultation</option>
                    <option value="follow-up">Follow-up</option>
                    <option value="emergency">Emergency</option>
                    <option value="routine">Routine Check</option>
                    <option value="specialist">Specialist Visit</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Additional Notes */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-medium text-gray-900 mb-4">Additional Notes</h3>
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-gray-900 text-sm"
                rows={3}
                placeholder="Any additional notes about this visit..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-6">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                <ArrowRight className="h-4 w-4" />
                <span>Start Conversation</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
