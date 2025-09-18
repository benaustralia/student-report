import React from 'react';

interface ReportTemplateProps {
  studentName: string;
  classLevel: string;
  classLocation: string;
  comments: string;
  teacher: string;
  date: string;
  artwork?: string;
}

export const ReportTemplate: React.FC<ReportTemplateProps> = ({
  studentName,
  classLevel,
  classLocation,
  comments,
  teacher,
  date,
  artwork
}) => {
  return (
    <div className="w-full max-w-md mx-auto bg-white border rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 text-center">
        <h1 className="text-xl font-bold">Student Report</h1>
        <p className="text-sm opacity-90">Rising Brush Academy</p>
      </div>

      {/* Student Info */}
      <div className="p-4 border-b">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-semibold text-gray-600">Student:</span>
            <p className="text-gray-800">{studentName}</p>
          </div>
          <div>
            <span className="font-semibold text-gray-600">Class:</span>
            <p className="text-gray-800">{classLevel}</p>
          </div>
          <div>
            <span className="font-semibold text-gray-600">Location:</span>
            <p className="text-gray-800">{classLocation}</p>
          </div>
          <div>
            <span className="font-semibold text-gray-600">Date:</span>
            <p className="text-gray-800">{date}</p>
          </div>
        </div>
      </div>

      {/* Artwork */}
      {artwork && (
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-600 mb-2">Artwork</h3>
          <div className="flex justify-center">
            <img 
              src={artwork} 
              alt="Student artwork" 
              className="max-w-full h-auto max-h-48 object-contain rounded border"
            />
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-600 mb-2">Teacher Comments</h3>
        <div className="bg-gray-50 p-3 rounded min-h-[100px]">
          <p className="text-gray-800 whitespace-pre-wrap">{comments || 'No comments provided.'}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-100 p-4 text-center text-sm text-gray-600">
        <p>Teacher: {teacher}</p>
        <p>Generated on {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
};

export default ReportTemplate;
