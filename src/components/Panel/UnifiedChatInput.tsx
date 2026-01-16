/**
 * Unified Chat Input Component
 * Reusable input with context tags and image upload support
 * Used across all views in the SDK
 */

import { useCallback, useRef, useState } from 'preact/hooks';
import {
  clearUserContext,
  removeUserContext,
  setPendingMessage,
  setPendingUserContext,
  userContext,
  pendingImages,
  isUploadingImages,
  addPendingImage,
  updateImageStatus,
  removePendingImage,
  clearPendingImages,
  getReadyImages,
  type PendingImage,
  type ChatImage,
} from '../../store/chat';
import { navigateToChat } from '../../store/router';
import { ContextTagList } from './ContextTag';
import type { UserContextItem } from '../../types';
import { useAPI } from '../context';

// Arrow up icon for send button
const SEND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;

// Image icon for upload button
const IMAGE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

// Close icon for image removal
const X_CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

// Max height for 6 lines
const MAX_INPUT_HEIGHT = 146;

interface UnifiedChatInputProps {
  /** Placeholder text for the input */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Custom submit handler - if provided, will be called instead of default navigation */
  onSubmit?: (message: string, context: UserContextItem[], images: ChatImage[]) => void;
  /** Whether to show context tags (default: true) */
  showContextTags?: boolean;
  /** Whether to show image upload button (default: true) */
  showImageUpload?: boolean;
  /** Additional CSS class for the wrapper */
  className?: string;
}

export function UnifiedChatInput({
  placeholder = 'Ask anything...',
  disabled = false,
  onSubmit,
  showContextTags = true,
  showImageUpload = true,
  className = '',
}: UnifiedChatInputProps) {
  const api = useAPI();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const resizeTextarea = useCallback(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    textarea.style.height = '41px';
    const scrollHeight = textarea.scrollHeight;

    if (scrollHeight > MAX_INPUT_HEIGHT) {
      textarea.style.height = `${MAX_INPUT_HEIGHT}px`;
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.height = `${scrollHeight}px`;
      textarea.style.overflowY = 'hidden';
    }
  }, []);

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

  const handleInputChange = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    setInputValue(target.value);
    resizeTextarea();
  };

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    const currentContext = [...userContext.value];
    const currentImages = getReadyImages();
    const hasContext = currentContext.length > 0;
    const hasImages = currentImages.length > 0;

    // Require either text, context, or images to submit
    if (!trimmed && !hasContext && !hasImages) return;

    // Don't submit while images are uploading
    if (isUploadingImages.value) return;

    // Clear context and images now that we have copies
    if (hasContext) {
      clearUserContext();
    }
    clearPendingImages();

    if (onSubmit) {
      // Custom handler (e.g., ChatView sends directly)
      onSubmit(trimmed, currentContext, currentImages);
    } else {
      // Default: store message and pending context, then navigate to chat
      if (hasContext) {
        setPendingUserContext(currentContext);
      }
      setPendingMessage(trimmed);
      navigateToChat();
    }

    // Clear input
    setInputValue('');
    if (inputRef.current) {
      inputRef.current.style.height = '41px';
      inputRef.current.style.overflowY = 'hidden';
    }
  }, [inputValue, onSubmit]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isUploading = isUploadingImages.value;
  const canSubmit = inputValue.trim() || userContext.value.length > 0 || pendingImages.value.some(img => img.status === 'ready');

  const wrapperClass = `_pillar-unified-input-wrapper pillar-unified-input-wrapper ${isDragging ? '_pillar-unified-input-wrapper--dragging' : ''} ${className}`.trim();

  return (
    <div
      class={wrapperClass}
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

      {/* Context tags - below images */}
      {showContextTags && (
        <ContextTagList contexts={userContext.value} onRemove={removeUserContext} />
      )}

      <textarea
        ref={inputRef}
        class="_pillar-unified-input pillar-unified-input"
        placeholder={isDragging ? 'Drop image here...' : placeholder}
        value={inputValue}
        onInput={handleInputChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        disabled={disabled}
        style={{ height: '41px' }}
      />

      <div class="_pillar-unified-input-row pillar-unified-input-row">
        {/* Image upload button */}
        {showImageUpload && (
          <button
            type="button"
            class="_pillar-chat-image-btn pillar-chat-image-btn"
            onClick={openFilePicker}
            disabled={disabled || isUploading || pendingImages.value.length >= 4}
            aria-label="Attach image"
            title="Attach image (max 4)"
            dangerouslySetInnerHTML={{ __html: IMAGE_ICON }}
          />
        )}
        <button
          type="button"
          class="_pillar-unified-send-btn pillar-unified-send-btn"
          onClick={handleSubmit}
          disabled={disabled || isUploading || !canSubmit}
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
