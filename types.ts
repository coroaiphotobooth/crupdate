
export interface Concept {
  id: string;
  name: string;
  prompt: string;
  thumbnail: string;
}

export interface EventRecord {
  id: string;
  name: string;
  description: string;
  folderId: string;
  createdAt: string;
  isActive: boolean;
}

export type AspectRatio = '16:9' | '9:16' | '3:2' | '2:3';

export interface PhotoboothSettings {
  eventName: string;
  eventDescription: string;
  folderId: string;
  selectedModel: string; // Changed from apiKey to selectedModel
  overlayImage: string | null;
  backgroundImage: string | null;
  autoResetTime: number; // seconds
  adminPin: string;
  orientation: 'portrait' | 'landscape';
  outputRatio: AspectRatio; // New field for specific aspect ratio
  activeEventId?: string;
  cameraRotation: number; // 0, 90, 180, 270
}

export interface GalleryItem {
  id: string;
  createdAt: string;
  conceptName: string;
  imageUrl: string;
  downloadUrl: string;
  token: string;
  eventId?: string;
}

export enum AppState {
  LANDING = 'LANDING',
  THEMES = 'THEMES',
  CAMERA = 'CAMERA',
  GENERATING = 'GENERATING',
  RESULT = 'RESULT',
  GALLERY = 'GALLERY',
  ADMIN = 'ADMIN'
}
