import { useState, useRef } from 'react';
import { StatusMessage } from '../types/exam';
import { uploadExamPaper } from '../services/examService';

export interface ConflictModalState {
  isOpen: boolean;
  title: string;
  message: string;
  options: string[];
  payload?: any;
}

export function useExamUpload() {
  const [uploadMode, setUploadMode] = useState<'QUESTION_PAPER'>('QUESTION_PAPER');
  const [examName, setExamName] = useState('upsc');
  const [year, setYear] = useState('2024');
  const [setCode, setSetCode] = useState('SET_A');
  const [paperType, setPaperType] = useState('previous_year_question');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [conflictModal, setConflictModal] = useState<ConflictModalState | null>(null);

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

  const executeUpload = async (conflictResolution: string = 'CHECK') => {
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
      await uploadExamPaper({
        examName,
        year,
        paperType,
        set_code: setCode,
        file: selectedFile,
        conflict_resolution: conflictResolution,
      });
      setStatusMessage({
        text: `Question paper uploaded successfully. AI extraction pipeline is now processing in the background.`,
        isError: false,
      });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      if (err.status === 409 && err.payload && err.payload.requires_confirmation) {
        setConflictModal({
          isOpen: true,
          title: 'Active Task Conflict Detected',
          message: err.payload.message || 'A pipeline task is already active for this exam paper. Please select how you want to proceed:',
          options: err.payload.options || ['RESTART', 'CANCEL'],
        });
      } else {
        setStatusMessage({
          text: err.message || 'Unable to connect to backend server.',
          isError: true,
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeUpload('CHECK');
  };

  const handleConflictResolve = async (chosenOption: string) => {
    setConflictModal(null);
    if (chosenOption === 'CANCEL') {
      setStatusMessage({ text: 'Upload operation cancelled by user.', isError: false });
      return;
    }
    await executeUpload(chosenOption);
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
    conflictModal,
    setConflictModal,
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleSubmit,
    handleConflictResolve,
  };
}
