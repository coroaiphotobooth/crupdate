
import { GalleryItem, PhotoboothSettings, Concept, EventRecord } from '../types';
import { DEFAULT_GAS_URL } from '../constants';

const getGasUrl = () => {
  return localStorage.getItem('APPS_SCRIPT_BASE_URL') || DEFAULT_GAS_URL;
};

export const fetchSettings = async () => {
  const url = getGasUrl();
  const response = await fetch(`${url}?action=getSettings`);
  return await response.json();
};

export const uploadToDrive = async (base64Image: string, metadata: any) => {
  const url = getGasUrl();
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        action: 'uploadGenerated',
        image: base64Image,
        ...metadata
      })
    });
    return await response.json();
  } catch (error) {
    return { ok: false, error: "FETCH_FAILED" };
  }
};

export const fetchGallery = async (eventId?: string): Promise<GalleryItem[]> => {
  const url = getGasUrl();
  const query = eventId ? `&eventId=${eventId}` : '';
  const response = await fetch(`${url}?action=gallery${query}`);
  const data = await response.json();
  return data.items || [];
};

export const fetchEvents = async (): Promise<EventRecord[]> => {
  const url = getGasUrl();
  const response = await fetch(`${url}?action=getEvents`);
  const data = await response.json();
  return data.items || [];
};

export const saveSettingsToGas = async (settings: PhotoboothSettings, pin: string) => {
  const url = getGasUrl();
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ action: 'updateSettings', pin, settings })
    });
    const data = await response.json();
    return data.ok;
  } catch (error) { return false; }
};

export const uploadOverlayToGas = async (base64Image: string, pin: string) => {
  const url = getGasUrl();
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ action: 'uploadOverlay', pin, image: base64Image })
    });
    return await response.json();
  } catch (error) { return { ok: false }; }
};

export const uploadBackgroundToGas = async (base64Image: string, pin: string) => {
  const url = getGasUrl();
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ action: 'uploadBackground', pin, image: base64Image })
    });
    return await response.json();
  } catch (error) { return { ok: false }; }
};

export const setActiveEventOnGas = async (id: string, pin: string) => {
  const url = getGasUrl();
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'setActiveEvent', id, pin })
  });
  return await response.json();
};

export const deletePhotoFromGas = async (id: string, pin: string) => {
  const url = getGasUrl();
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'deletePhoto', pin, id })
  });
  return await response.json();
};

export const deleteEventOnGas = async (id: string, pin: string) => {
  const url = getGasUrl();
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'deleteEvent', id, pin })
  });
  return await response.json();
};

export const createEventOnGas = async (name: string, description: string, folderId: string, pin: string) => {
  const url = getGasUrl();
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'createEvent', name, description, folderId, pin })
  });
  return await response.json();
};

export const saveConceptsToGas = async (concepts: Concept[], pin: string) => {
  const url = getGasUrl();
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ action: 'updateConcepts', pin, concepts })
    });
    const data = await response.json();
    return data.ok;
  } catch (error) { return false; }
};
