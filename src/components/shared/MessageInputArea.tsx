/**
 * Message Input Area Component
 * Shared input component with image upload support
 * Used by HomeView, ChatInput, and ChatView
 */

import { h } from 'preact';
import { useRef, useCallback, useState } from 'preact/hooks';
import { useAPI } from '../context';
import {
  pendingImages,
  isUploadingImages,
  addPendingImage,
  updateImageStatus,
  removePendingImage,
  type PendingImage,
} from '../../store/chat';

const SEND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

const IMAGE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

const X_CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

export interface MessageInputAreaProps {
  /** Called when user submits a message */
  onSubmit: (message: string) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Whether the input is disabled (e.g., while loading) */
  disabled?: boolean;
  /** Optional ref to the textarea for external focus control */
  inputRef?: preact.RefObject<HTMLTextAreaElement>;
  /** Whether to show the container border (for standalone use) */
  showBorder?: boolean;
}

export function MessageInputArea({
  onSubmit,
  placeholder = "Ask a question... (paste or drop images)",
  disabled = false,
  inputRef: externalInputRef,
  showBorder = true,
}: MessageInputAreaProps) {
  const api = useAPI();
  const internalInputRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = externalInputRef || internalInputRef;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Upload a single image file
  const uploadImage = useCallback(async (file: File) => {
    if (pendingImages.value.length >= 4) return;

    const id = `img-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const preview = URL.createObjectURL(file);

    const pendingImage: PendingImage = {
      id,
      file,
      preview,
      status: 'uploading',
    };

    addPendingImage(pendingImage);

    try {
      const response = await api.uploadImage(file);
      updateImageStatus(id, 'ready', response.url);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Upload failed';
      updateImageStatus(id, 'error', undefined, errorMsg);
    }
  }, [api]);

  // Handle multiple image files
  const handleImageFiles = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    const availableSlots = 4 - pendingImages.value.length;
    imageFiles.slice(0, availableSlots).forEach(uploadImage);
  }, [uploadImage]);

  // Handle paste event for images
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      handleImageFiles(imageFiles);
    }
  }, [handleImageFiles]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files) {
      handleImageFiles(files);
    }
  }, [handleImageFiles]);

  // Handle file input change
  const handleFileSelect = useCallback((e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files) {
      handleImageFiles(input.files);
      input.value = ''; // Reset for next selection
    }
  }, [handleImageFiles]);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSubmit = useCallback(() => {
    if (!inputRef.current || disabled || isUploadingImages.value) return;

    const message = inputRef.current.value.trim();
    if (!message) return;

    // Clear input
    inputRef.current.value = '';
    inputRef.current.style.height = 'auto';

    onSubmit(message);
  }, [onSubmit, disabled, inputRef]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [inputRef]);

  // Only disable buttons while uploading - keep textarea enabled so user can keep typing
  const isUploading = isUploadingImages.value;
  const isButtonDisabled = disabled || isUploading;

  return (
    <div
      class={`_pillar-chat-view-input-area pillar-chat-view-input-area ${isDragging ? '_pillar-chat-view-input-area--dragging' : ''}`}
      style={!showBorder ? { border: 'none', padding: '0' } : undefined}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Pending images preview */}
      {pendingImages.value.length > 0 && (
        <div class="_pillar-chat-images-preview pillar-chat-images-preview">
          {pendingImages.value.map((img) => (
            <div key={img.id} class="_pillar-chat-image-thumb pillar-chat-image-thumb">
              <img src={img.preview} alt="Upload preview" />
              {img.status === 'uploading' && (
                <div class="_pillar-chat-image-loading pillar-chat-image-loading">
                  <div class="_pillar-loading-spinner pillar-loading-spinner" style={{ width: '16px', height: '16px' }} />
                </div>
              )}
              {img.status === 'error' && (
                <div class="_pillar-chat-image-error pillar-chat-image-error" title={img.error}>!</div>
              )}
              <button
                type="button"
                class="_pillar-chat-image-remove pillar-chat-image-remove"
                onClick={() => removePendingImage(img.id)}
                aria-label="Remove image"
                dangerouslySetInnerHTML={{ __html: X_CLOSE_ICON }}
              />
            </div>
          ))}
        </div>
      )}

      <div class="_pillar-chat-view-input-wrapper pillar-chat-view-input-wrapper">
        {/* Image upload button */}
        <button
          type="button"
          class="_pillar-chat-image-btn pillar-chat-image-btn"
          onClick={openFilePicker}
          disabled={isButtonDisabled || pendingImages.value.length >= 4}
          aria-label="Attach image"
          title="Attach image (max 4)"
          dangerouslySetInnerHTML={{ __html: IMAGE_ICON }}
        />
        <textarea
          ref={inputRef}
          class="_pillar-chat-view-input pillar-chat-view-input"
          placeholder={isDragging ? "Drop image here..." : placeholder}
          rows={1}
          aria-label="Message input"
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onPaste={handlePaste}
          disabled={disabled}
        />
        <button
          type="button"
          class="_pillar-chat-view-send-btn pillar-chat-view-send-btn"
          onClick={handleSubmit}
          disabled={isButtonDisabled}
          aria-label="Send message"
          dangerouslySetInnerHTML={{ __html: SEND_ICON }}
        />
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div class="_pillar-chat-drop-overlay pillar-chat-drop-overlay">
          <span dangerouslySetInnerHTML={{ __html: IMAGE_ICON }} />
          <span>Drop image here</span>
        </div>
      )}
    </div>
  );
}
