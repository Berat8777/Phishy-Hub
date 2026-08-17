import * as ImagePicker from 'expo-image-picker';
import type { PickedAsset } from '../api/endpoints/files';

/** Normalizes an expo-image-picker result (gallery OR camera capture — both return the same `ImagePickerAsset` shape) into the `{uri,name,mimeType}` shape `files.ts::uploadFile` expects. */
function toPickedAsset(asset: ImagePicker.ImagePickerAsset): PickedAsset {
  const uriParts = asset.uri.split('/');
  const fallbackName = uriParts[uriParts.length - 1] || `upload-${Date.now()}`;
  return {
    uri: asset.uri,
    name: asset.fileName ?? fallbackName,
    mimeType: asset.mimeType ?? 'image/jpeg',
  };
}

export async function pickFromGallery(): Promise<PickedAsset | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return toPickedAsset(result.assets[0]);
}

export async function captureFromCamera(): Promise<PickedAsset | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return toPickedAsset(result.assets[0]);
}
