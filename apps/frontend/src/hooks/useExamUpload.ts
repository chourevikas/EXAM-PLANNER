import { useState, useRef } from 'react';
import { StatusMessage } from '../types/exam';
import { uploadExamPaper, uploadAnswerKey } from '../services/examService';

export function useExamUpload() {
  const [uploadMode, setUploadMode] = useState<'QUESTION_PAPER' | 'ANSWER_KEY'>('QUESTION_PAPER');
  const [examName, setExamName] = useState('upsc');
  const [year, setYear] = useState('2024');
  const [setCode, setSetCode] = useState('SET_A');
  const [paperType, setPaperType] = useState('previous_year_question');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setStatusMessage(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
        setStatusMessage(null);
      } else {
        setStatusMessage({ text: 'Please select a valid PDF file.', isError: true });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setStatusMessage({ text: 'Please select a PDF file to upload.', isError: true });
      return;
    }

    if (!setCode || !setCode.trim()) {
      setStatusMessage({ text: 'Target Paper Set Code (e.g. SET_A, SET_B, SET_C, SET_D) is required.', isError: true });
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);

    try {
      if (uploadMode === 'ANSWER_KEY') {
        const result = await uploadAnswerKey({
          examName,
          year,
          set_code: setCode,
          file: selectedFile,
        });
        setStatusMessage({
          text: `Success! Answer key pipeline initiated for ${result.canonical_exam_code || examName} (Target Set: ${result.target_set_code || setCode}).`,
          isError: false,
        });
      } else {
        const result = await uploadExamPaper({
          examName,
          year,
          paperType,
          set_code: setCode,
          file: selectedFile,
        });
        setStatusMessage({
          text: `Success! Question paper uploaded to S3: ${result.s3_path || result.message || 'File stored successfully.'}`,
          isError: false,
        });
      }
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setStatusMessage({
        text: err.message || 'Unable to connect to backend server.',
        isError: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadMode,
    setUploadMode,
    examName,
    setExamName,
    year,
    setYear,
    setCode,
    setSetCode,
    paperType,
    setPaperType,
    selectedFile,
    setSelectedFile,
    isUploading,
    statusMessage,
    isDragOver,
    fileInputRef,
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleSubmit,
  };
}
