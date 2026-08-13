import React from 'react';
import { useExamUpload } from '../../hooks/useExamUpload';
import { EXAM_OPTIONS, PAPER_TYPE_OPTIONS, YEAR_OPTIONS, SET_OPTIONS } from '../../constants/exam';

export function ExamUploadForm() {
  const {
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
    isUploading,
    statusMessage,
    isDragOver,
    fileInputRef,
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleSubmit,
  } = useExamUpload();

  return (
    <div className="admin-card">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
          {uploadMode === 'ANSWER_KEY' ? 'Upload Answer Key PDF' : 'Upload Exam Question Paper PDF'}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
          {uploadMode === 'ANSWER_KEY'
            ? 'Upload answer key PDF and select mandatory Target Paper Set Code to initiate Pipeline 2.'
            : 'Select exam parameters and upload your question paper PDF to initiate Pipeline 1.'}
        </p>
      </div>

      {/* Mode Switcher Buttons */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => setUploadMode('QUESTION_PAPER')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            border: uploadMode === 'QUESTION_PAPER' ? '2px solid var(--royal, #2563eb)' : '1px solid #e2e8f0',
            backgroundColor: uploadMode === 'QUESTION_PAPER' ? '#eff6ff' : '#ffffff',
            color: uploadMode === 'QUESTION_PAPER' ? '#1e40af' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          📄 Question Paper PDF
        </button>
        <button
          type="button"
          onClick={() => setUploadMode('ANSWER_KEY')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            border: uploadMode === 'ANSWER_KEY' ? '2px solid var(--royal, #2563eb)' : '1px solid #e2e8f0',
            backgroundColor: uploadMode === 'ANSWER_KEY' ? '#eff6ff' : '#ffffff',
            color: uploadMode === 'ANSWER_KEY' ? '#1e40af' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          🔑 Answer Key PDF
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          {/* Exam Name Select */}
          <div className="form-group">
            <label htmlFor="exam_name" className="form-label">
              Exam Name
            </label>
            <select
              id="exam_name"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="form-select"
              required
            >
              {EXAM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Year Select */}
          <div className="form-group">
            <label htmlFor="year" className="form-label">
              Year
            </label>
            <select
              id="year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="form-select"
              required
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Mandatory Target Set Code Select */}
          <div className="form-group">
            <label htmlFor="set_code" className="form-label" style={{ fontWeight: 700 }}>
              Target Paper Set Code <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              id="set_code"
              value={setCode}
              onChange={(e) => setSetCode(e.target.value)}
              className="form-select"
              required
              style={{ borderColor: !setCode ? '#fca5a5' : undefined }}
            >
              {SET_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label} ({s.value})
                </option>
              ))}
            </select>
          </div>

          {/* Paper Type Select (only for Question Paper mode) */}
          {uploadMode === 'QUESTION_PAPER' && (
            <div className="form-group">
              <label htmlFor="paper_type" className="form-label">
                Paper Type
              </label>
              <select
                id="paper_type"
                value={paperType}
                onChange={(e) => setPaperType(e.target.value)}
                className="form-select"
              >
                {PAPER_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`dropzone ${isDragOver ? 'active' : ''}`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="application/pdf"
            style={{ display: 'none' }}
          />

          <div style={{ fontSize: 36, marginBottom: 12 }}>
            {selectedFile ? (uploadMode === 'ANSWER_KEY' ? '🔑' : '📄') : '☁️'}
          </div>

          {selectedFile ? (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--royal)' }}>
                {selectedFile.name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click or drag to replace
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
                Click to upload {uploadMode === 'ANSWER_KEY' ? 'Answer Key' : 'Question Paper'} PDF file
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Only PDF format supported (max size 25MB)
              </div>
            </div>
          )}
        </div>

        {/* Status Message Notification Card */}
        {statusMessage && (
          <div className={`alert-card ${statusMessage.isError ? 'error' : 'success'}`}>
            <span>{statusMessage.isError ? '⚠️' : '✅'}</span>
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-primary anim-glow"
          disabled={isUploading}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: 15,
            fontWeight: 700,
            borderRadius: 12,
            opacity: isUploading ? 0.7 : 1,
            cursor: isUploading ? 'not-allowed' : 'pointer',
          }}
        >
          {isUploading ? (
            <>
              <span style={{ display: 'inline-block', animation: 'spin-slow 2s linear infinite' }}>⏳</span>
              Uploading {uploadMode === 'ANSWER_KEY' ? 'Answer Key' : 'Question Paper'} PDF...
            </>
          ) : uploadMode === 'ANSWER_KEY' ? (
            `Upload Answer Key (Target Set: ${setCode})`
          ) : (
            `Upload Question Paper (${setCode})`
          )}
        </button>
      </form>
    </div>
  );
}
