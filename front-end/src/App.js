import React, { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import './index.css';

const FileDropZone = () => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState(null);
  const inputRef = useRef(null);

  const isValidFileType = (file) => {
    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    return validTypes.includes(file.type);
  };

  const sendFileToBackend = async (fileItem) => {
    try {
      const formData = new FormData();
      formData.append('file', fileItem.file);

      const response = await axios.post('http://127.0.0.1:5000/receiver', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('OCR backend response:', response.data);
      if (response.data.flag === "True" && Array.isArray(response.data.output)) {
        setFiles(prev => prev.map(f =>
          f.id === fileItem.id
            ? { ...f, ocrResult: response.data.output }
            : f
        ));
      } else {
        setFiles(prev => prev.map(f =>
          f.id === fileItem.id
            ? { ...f, status: 'error', error: 'OCR processing failed: Invalid flag or output format.' }
            : f
        ));
      }
    } catch (error) {
      console.error('Error sending file to backend:', error);
      setFiles(prev => prev.map(f =>
        f.id === fileItem.id
          ? { ...f, status: 'error', error: 'OCR processing failed. Please try again.' }
          : f
      ));
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchError('Please enter a file name to search.');
      setSearchResults([]);
      return;
    }

    try {
      const response = await axios.get(`http://127.0.0.1:5000/search_pdf?filename=${encodeURIComponent(searchQuery)}`);
      console.log('Search backend response:', response.data);
      if (response.data.flag === "True" && Array.isArray(response.data.output)) {
        setSearchResults(response.data.output);
        setSearchError(null);
      } else {
        setSearchResults([]);
        setSearchError('Search failed: Invalid flag or output format.');
      }
    } catch (error) {
      console.error('Error searching files:', error);
      setSearchResults([]);
      setSearchError('Search failed. Please try again.');
    }
  };

  const simulateUpload = (fileItem) => {
    const fileId = fileItem.id;
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;

      setFiles(prev => prev.map(f =>
        f.id === fileId
          ? { ...f, progress: Math.min(progress, 100) }
          : f
      ));

      if (progress >= 100) {
        clearInterval(interval);
        const isSuccess = Math.random() > 0.2;

        setTimeout(() => {
          setFiles(prev => prev.map(f =>
            f.id === fileId
              ? {
                  ...f,
                  status: isSuccess ? 'success' : 'error',
                  progress: 100,
                  error: isSuccess ? undefined : 'Upload failed. Please try again.'
                }
              : f
          ));
          if (isSuccess) {
            sendFileToBackend(fileItem);
          }
        }, 200);
      }
    }, 100);
  };

  const handleFiles = useCallback((fileList) => {
    const newFiles = Array.from(fileList)
      .filter(isValidFileType)
      .map(file => ({
        file,
        id: Math.random().toString(36).substring(7),
        status: 'pending',
        progress: 0
      }));

    setFiles(prev => [...prev, ...newFiles]);

    newFiles.forEach(fileItem => {
      setFiles(prev => prev.map(f =>
        f.id === fileItem.id
          ? { ...f, status: 'uploading' }
          : f
      ));
      simulateUpload(fileItem);
    });
  }, []);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleInputChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleBrowseClick = () => {
    inputRef.current.click();
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const retryUpload = (fileId) => {
    const fileItem = files.find(f => f.id === fileId);
    if (!fileItem) return;

    setFiles(prev => prev.map(f =>
      f.id === fileId
        ? { ...f, status: 'uploading', progress: 0, error: undefined, ocrResult: undefined }
        : f
    ));
    simulateUpload(fileItem);
  };

  const clearAll = () => {
    setFiles([]);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="app">
      <div className="container">
        <div className="header">
          <h1 className="title">File Drop Zone</h1>
          <p className="subtitle">Upload your PDF documents and images with ease</p>
        </div>

        <div
          className={`drop-zone ${dragActive ? 'active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          role="region"
          aria-label="File drop zone"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleBrowseClick();
            }
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
            onChange={handleInputChange}
            className="file-input"
            aria-label="Upload files"
          />

          <div className="drop-content">
            <div className={`upload-icon ${dragActive ? 'active' : ''}`}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>

            <div>
              <p className="drop-text">
                {dragActive ? "Drop your files here" : "Drag & drop your files"}
              </p>
              <p className="drop-subtext">
                Supports PDF, JPG, PNG, GIF, WebP
              </p>
              <button
                className="browse-btn"
                onClick={handleBrowseClick}
                aria-label="Browse files"
              >
                Browse Files
              </button>
            </div>
          </div>
        </div>

        <div className="search-section">
          <h3 className="search-title">Search Files</h3>
          <div className="search-input-group">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter file name (e.g., Candidate Task.pdf)"
              className="search-input"
              aria-label="Search files by name"
            />
            <button
              onClick={handleSearch}
              className="search-btn"
              aria-label="Search files"
            >
              Search
            </button>
          </div>
          {searchError && <p className="search-error">{searchError}</p>}
          {searchResults.length > 0 && (
            <div className="search-results">
              <h4>Search Results ({searchResults.length})</h4>
              {searchResults.map((result, index) => (
                <div key={index} className="search-result-item">
                  <div className="search-result-header">
                    <p className="search-result-name">{result.pdf}</p>
                  </div>
                  <div className="ocr-results">
                    <div className="ocr-page">
                      <h4>Page: {result['page num'] || `Page ${index + 1}`}</h4>
                      <ul>
                        {Array.isArray(result.text) ? (
                          result.text.map((line, lineIndex) => (
                            <li key={lineIndex}>{line}</li>
                          ))
                        ) : (
                          <li className="error">No text available</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {files.length > 0 && (
          <div className="file-list">
            <div className="file-list-header">
              <h3>Uploaded Files ({files.length})</h3>
              <button onClick={clearAll} className="clear-btn">Clear All</button>
            </div>

            <div className="files">
              {files.map((fileItem) => (
                <div key={fileItem.id} className="file-item">
                  <div className="file-content">
                    <div className="file-icon">
                      {fileItem.file.type === 'application/pdf' ? (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14,2 14,8 20,8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                          <polyline points="10,9 9,9 8,9"/>
                        </svg>
                      ) : (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21,15 16,10 5,21"/>
                        </svg>
                      )}
                    </div>

                    <div className="file-details">
                      <div className="file-header">
                        <p className="file-name">{fileItem.file.name}</p>
                        <div className="file-actions">
                          {fileItem.status === 'success' && (
                            <svg className="status-icon success" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                              <polyline points="22,4 12,14.01 9,11.01"/>
                            </svg>
                          )}
                          {fileItem.status === 'error' && (
                            <svg className="status-icon error" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"/>
                              <line x1="12" y1="8" x2="12" y2="12"/>
                              <line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                          )}
                          <button
                            onClick={() => removeFile(fileItem.id)}
                            className="remove-btn"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18"/>
                              <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="file-info">
                        <span>{formatFileSize(fileItem.file.size)}</span>
                        <span className="status">{fileItem.status}</span>
                      </div>

                      {fileItem.status === 'uploading' && (
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${fileItem.progress}%` }}
                          />
                        </div>
                      )}

                      {fileItem.status === 'success' && (
                        <div className="progress-bar success" />
                      )}

                      {fileItem.status === 'error' && (
                        <div className="error-section">
                          <div className="progress-bar error" />
                          <div className="error-content">
                            <p className="error-message">{fileItem.error}</p>
                            <button
                              onClick={() => retryUpload(fileItem.id)}
                              className="retry-btn"
                            >
                              Retry
                            </button>
                          </div>
                        </div>
                      )}

                      {fileItem.status === 'success' && fileItem.ocrResult && Array.isArray(fileItem.ocrResult) && (
                        <div className="ocr-results">
                          {fileItem.ocrResult.map((page, index) => (
                            <div key={index} className="ocr-page">
                              <h4>Page: {page['page num'] || `Page ${index + 1}`}</h4>
                              <ul>
                                {Array.isArray(page.text) ? (
                                  page.text.map((line, lineIndex) => (
                                    <li key={lineIndex}>{line}</li>
                                  ))
                                ) : (
                                  <li className="error">No text available</li>
                                )}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileDropZone;