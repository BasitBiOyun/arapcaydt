import React, { useRef, useState } from 'react';
import { 
  UploadSimple, 
  FileImage, 
  ArrowsClockwise, 
  Trash, 
  Lightbulb, 
  CheckCircle 
} from '@phosphor-icons/react';
import { SAMPLE_QUESTION_IMAGE_1, SAMPLE_QUESTION_IMAGE_2 } from '../projects/sampleData';

interface ImageUploaderProps {
  currentImageUrl: string;
  imageFileName?: string;
  onImageSelected: (dataUrl: string, fileName: string) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  currentImageUrl,
  imageFileName,
  onImageSelected,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Lütfen geçerli bir JPG veya PNG görsel dosyası yükleyin.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        onImageSelected(result, file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[#1C1917] flex items-center gap-1.5">
          <FileImage size={15} weight="bold" className="text-[#8B1E2D]" />
          <span>Soru Görseli (JPG / PNG)</span>
        </label>
        <span className="text-[11px] text-[#787670] font-mono-code">
          {imageFileName || 'Görsel Seçildi'}
        </span>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        }}
      />

      {/* Upload Zone & Quick Switcher */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded p-3.5 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-[#8B1E2D] bg-[#FAF1F2]'
            : 'border-[#D9D8CF] hover:border-[#8B1E2D] bg-[#FAF9F5]'
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-1.5 text-xs">
          <div className="w-8 h-8 rounded-full bg-[#F0EFEB] flex items-center justify-center text-[#55544F]">
            <UploadSimple size={16} weight="bold" />
          </div>
          <div className="font-medium text-[#1C1917]">
            Görseli buraya sürükleyin veya <span className="text-[#8B1E2D] underline">dosya seçin</span>
          </div>
          <div className="text-[11px] text-[#787670]">
            PNG veya JPG (ÖSYM kitapçık kırpması veya yüksek çözünürlüklü soru)
          </div>
        </div>
      </div>

      {/* Quick Sample Selector for Teacher Convenience */}
      <div className="pt-1 flex items-center justify-between text-xs">
        <span className="text-[11px] text-[#666560] flex items-center gap-1">
          <Lightbulb size={13} className="text-[#B48419]" />
          <span>Hızlı Örnek YDT Sorusu Seç:</span>
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onImageSelected(SAMPLE_QUESTION_IMAGE_1, '2023_ydt_soru_14.png')}
            className="px-2 py-1 rounded text-[11px] font-mono-code bg-[#F2F1EB] hover:bg-[#E7E5DC] text-[#33322E] border border-[#D5D4CC] cursor-pointer"
          >
            2023 - S.14
          </button>
          <button
            type="button"
            onClick={() => onImageSelected(SAMPLE_QUESTION_IMAGE_2, '2022_ydt_soru_24.png')}
            className="px-2 py-1 rounded text-[11px] font-mono-code bg-[#F2F1EB] hover:bg-[#E7E5DC] text-[#33322E] border border-[#D5D4CC] cursor-pointer"
          >
            2022 - S.24
          </button>
        </div>
      </div>
    </div>
  );
};
