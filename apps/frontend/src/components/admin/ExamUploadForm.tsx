import React from 'react';
import { useExamUpload } from '../../hooks/useExamUpload';
import { EXAM_OPTIONS, PAPER_TYPE_OPTIONS, YEAR_OPTIONS, GROUPED_YEAR_OPTIONS, SET_OPTIONS } from '../../constants/exam';

export function ExamUploadForm() {
  const {
    uploadMode,
    setUploadMode,
    availableExamTypes,
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
          Upload Exam Question Paper PDF
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
          Upload your question paper PDF. The pipeline deterministically extracts questions, options, answer keys, solutions, reverse logic, and syllabus hierarchy in a single pass.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          {/* Exam Name Select */}
          <div className="form-group">
            <label htmlFor="exam_name" className="form-label">
              Target Exam Type
            </label>
            <select
              id="exam_name"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="form-select"
              required
            >
              {availableExamTypes && availableExamTypes.length > 0 ? (
                availableExamTypes.map((opt) => (
                  <option key={opt.id} value={opt.type}>
                    {opt.name} ({opt.type.toUpperCase()})
                  </option>
                ))
              ) : (
                EXAM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Year Select */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <label htmlFor="year" className="form-label" style={{ marginBottom: 0 }}>
                Year
              </label>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                1900 – {YEAR_OPTIONS[0]}
              </span>
            </div>
            <select
              id="year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="form-select"
              required
            >
              {GROUPED_YEAR_OPTIONS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </optgroup>
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

          {/* Paper Type Select */}
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
            {selectedFile ? '📄' : '☁️'}
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
                Click to upload Question Paper PDF file
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
            borderRadius: 0,
            opacity: isUploading ? 0.7 : 1,
            cursor: isUploading ? 'not-allowed' : 'pointer',
          }}
        >
          {isUploading ? (
            <>
              <span style={{ display: 'inline-block', animation: 'spin-slow 2s linear infinite' }}>⏳</span>
              Uploading Question Paper PDF...
            </>
          ) : (
            `Upload Question Paper (${setCode})`
          )}
        </button>
      </form>
    </div>
  );
}
